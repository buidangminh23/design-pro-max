/**
 * web-shells static check: reads a project's Capacitor or Tauri config, the copies Capacitor puts in the native
 * projects, and the config inside a built .app or an unzipped .ipa, and reports which origin each one will load.
 * Nothing is built, run or installed.
 *
 *   node check-shell.mjs --project <folder> [--bundle <built .app or unzipped .ipa folder>] [--expect-origin <origin>]
 *   node check-shell.mjs --bundle <folder> --expect-origin <https origin or "bundled">
 *
 * Errors: WS-ORIGIN-01, a config or bundle that loads another origin than --expect-origin, or the bundled build when a
 * remote origin is expected; WS-ORIGIN-02, a shipping config that points at a loopback, private-network, shared or
 * link-local host, or at plain http; WS-BUNDLE-01, a native-project copy or a built bundle whose server URL differs
 * from the project's config. Warnings: WS-ORIGIN-01, more than one Capacitor config file; WS-ORIGIN-02, a single-label
 * host or server.cleartext or server.allowNavigation in a shipping config; WS-WARN-STAGING, an origin whose host name
 * carries a staging, dev, preview or test label; WS-WARN-BUNDLED, a remote shell that also carries a full web build;
 * WS-WARN-PUSH, web code that subscribes to Web Push inside a WebView shell with no native remote-push plugin.
 * A server URL the config computes is skipped with its reason, never guessed. Output follows the shared checker
 * contract; a run in which every check was skipped exits 2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY =
  'Proof boundary: a static read of the shell configs and the bundle folder; it does not build or launch the app, ' +
  'resolve configs computed at build time, read a Tauri binary, or prove what a device loads at run time.';

export const CAPACITOR_FILES = ['capacitor.config.ts', 'capacitor.config.js', 'capacitor.config.json'];
export const NATIVE_COPIES = ['ios/App/App/capacitor.config.json', 'android/app/src/main/assets/capacitor.config.json'];
export const TAURI_FOLDERS = ['src-tauri', '.'];
export const TAURI_BASES = ['tauri.conf.json', 'tauri.conf.json5', 'Tauri.toml'];
export const TAURI_PLATFORMS = ['macos', 'ios', 'windows', 'linux', 'android'];
export const STAGING_LABEL = /^(?:staging|stage|stg|dev|develop|development|preview|test|testing|qa|uat|sandbox|beta)$/i;
export const PUSH_PLUGINS = ['@capacitor/push-notifications', '@capacitor-firebase/messaging', '@capacitor-community/fcm', 'onesignal-cordova-plugin'];
const CAPACITOR_RUNTIME = new Set(['cordova.js', 'cordova_plugins.js', 'native-bridge.js']);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.astro', '.html']);
const SKIPPED_FOLDERS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'ios', 'android', 'target', '.next', '.nuxt', '.svelte-kit', 'coverage', 'public']);
const MAX_SOURCE_FILES = 4000;
const QUOTES = new Set(['"', "'", '`']);
const OPENERS = '{[(';
const CLOSERS = '}])';

function skipString(text, index) {
  const quote = text[index];
  let at = index + 1;
  while (at < text.length && text[at] !== quote) at += text[at] === '\\' ? 2 : 1;
  return at + 1;
}

export function stripComments(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (QUOTES.has(char)) {
      const end = skipString(text, index);
      out += text.slice(index, end);
      index = end;
    } else if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      const close = text.indexOf('*/', index + 2);
      const end = close < 0 ? text.length : close + 2;
      out += text.slice(index, end).replace(/[^\n]/g, ' ');
      index = end;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

function closingIndex(text, open) {
  let depth = 0;
  let index = open;
  while (index < text.length) {
    const char = text[index];
    if (QUOTES.has(char)) {
      index = skipString(text, index);
      continue;
    }
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char)) {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

function parseEntry(raw) {
  if (raw.startsWith('...')) return { spread: true, raw };
  const match = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*(:)?/.exec(raw);
  if (!match) return { computedKey: true, raw };
  const key = match[2] ?? match[3];
  if (!match[4]) return { key, shorthand: true, raw };
  return { key, value: raw.slice(match[0].length).trim() };
}

export function objectEntries(text, open) {
  const close = closingIndex(text, open);
  if (close < 0) return null;
  const entries = [];
  let start = open + 1;
  let depth = 0;
  const push = (end) => {
    const raw = text.slice(start, end).trim();
    if (raw) entries.push(parseEntry(raw));
    start = end + 1;
  };
  let index = open + 1;
  while (index < close) {
    const char = text[index];
    if (QUOTES.has(char)) {
      index = skipString(text, index);
      continue;
    }
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char)) depth -= 1;
    else if (char === ',' && depth === 0) push(index);
    index += 1;
  }
  push(close);
  return entries;
}

export function literalString(value) {
  const text = String(value ?? '').trim();
  const quoted = /^(['"])((?:(?!\1)[^\\\n])*)\1$/.exec(text);
  if (quoted) return quoted[2];
  const template = /^`([^`$\\]*)`$/.exec(text);
  return template ? template[1] : null;
}

function exportedObject(text) {
  const exported = /\bexport\s+default\s+|\bmodule\.exports\s*=\s*/.exec(text);
  if (!exported) return { reason: 'the file has no export default or module.exports' };
  let at = exported.index + exported[0].length;
  while (/\s/.test(text[at] ?? '')) at += 1;
  if (text[at] === '{') return { open: at };
  const name = /^([A-Za-z_$][\w$]*)\s*(?:;|$)/m.exec(text.slice(at));
  if (!name) return { reason: 'the exported config is not an object literal' };
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name[1].replace(/\$/g, '\\$')}\\b[^=;]*=\\s*`).exec(text);
  if (!declaration) return { reason: `${name[1]} is not declared in the file` };
  const open = declaration.index + declaration[0].length;
  return text[open] === '{' ? { open } : { reason: `${name[1]} is not an object literal` };
}

const computed = (reason, webDir = null) => ({ url: null, computed: true, reason, webDir });

function readServerObject(text) {
  const entries = objectEntries(text, 0);
  if (!entries) return computed('the server object does not close');
  const url = entries.find((entry) => entry.key === 'url');
  const flags = {
    cleartext: entries.some((entry) => entry.key === 'cleartext' && entry.value === 'true'),
    allowNavigation: entries.some((entry) => entry.key === 'allowNavigation'),
  };
  if (!url) return entries.some((entry) => entry.spread || entry.computedKey) ? computed('server spreads another object, which may set url') : { url: null, ...flags };
  if (url.shorthand) return computed('server.url is a variable');
  const literal = literalString(url.value);
  if (literal === null) return computed(`server.url is the expression ${url.value.replace(/\s+/g, ' ').slice(0, 80)}`);
  return { url: literal.trim() || null, ...flags };
}

export function capacitorServerUrl(text, file) {
  if (file.endsWith('.json')) {
    let config;
    try {
      config = JSON.parse(text);
    } catch (error) {
      throw new UsageError(`${file} is not valid JSON: ${error.message}`);
    }
    const url = config?.server?.url;
    return {
      url: typeof url === 'string' && url.trim() ? url.trim() : null,
      webDir: config?.webDir ?? null,
      cleartext: config?.server?.cleartext === true,
      allowNavigation: Array.isArray(config?.server?.allowNavigation) ? config.server.allowNavigation.length > 0 : Boolean(config?.server?.allowNavigation),
    };
  }
  const clean = stripComments(text);
  const found = exportedObject(clean);
  if (found.reason) return computed(found.reason);
  const entries = objectEntries(clean, found.open);
  if (!entries) return computed('the exported config object does not close');
  const webDirEntry = entries.find((entry) => entry.key === 'webDir');
  const webDir = webDirEntry?.value ? literalString(webDirEntry.value) : null;
  const server = entries.find((entry) => entry.key === 'server');
  if (!server) return entries.some((entry) => entry.spread || entry.computedKey) ? computed('the config spreads another object, which may set server', webDir) : { url: null, webDir };
  if (server.shorthand) return computed('server is a variable, not an object literal in the exported config', webDir);
  if (!server.value.startsWith('{')) return computed(`server is the expression ${server.value.replace(/\s+/g, ' ').slice(0, 80)}`, webDir);
  return { ...readServerObject(server.value), webDir };
}

const isUrl = (value) => typeof value === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

export function tauriRelease(config) {
  const windows = config?.app?.windows ?? config?.tauri?.windows ?? [];
  const windowUrl = windows.find((window) => isUrl(window?.url))?.url ?? null;
  const dist = config?.build?.frontendDist ?? config?.build?.distDir ?? null;
  if (windowUrl) return { url: windowUrl, via: 'app.windows[].url', dist: isUrl(dist) ? null : dist };
  if (isUrl(dist)) return { url: dist, via: 'build.frontendDist', dist: null };
  return { url: null, via: 'build.frontendDist', dist };
}

export function mergePatch(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const base = target !== null && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete base[key];
    else base[key] = mergePatch(base[key], value);
  }
  return base;
}

const PRIVATE_V4 = [/^127\./, /^10\./, /^192\.168\./, /^172\.(?:1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

function mappedV4(host) {
  const match = /^::ffff:(.+)$/.exec(host);
  if (!match) return null;
  if (/^[\d.]+$/.test(match[1])) return match[1];
  const groups = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(match[1]);
  if (!groups) return null;
  const [high, low] = [parseInt(groups[1], 16), parseInt(groups[2], 16)];
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

const hostOf = (parsed) => parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
const isIp = (host) => /^[\d.]+$/.test(host) || host.includes(':');

export function unshippableReason(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `not a valid URL: ${url}`;
  }
  const host = hostOf(parsed);
  const v4 = mappedV4(host) ?? host;
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return `${host} is the device itself, not the developer's machine`;
  if (host === '::' || v4 === '0.0.0.0') return `${host} is the unspecified address, not a server`;
  if (PRIVATE_V4.some((pattern) => pattern.test(v4)) || /^f[cd][0-9a-f]{2}:|^fe[89ab][0-9a-f]:/.test(host)) return `${host} is a loopback, private-network, shared or link-local address`;
  if (['.local', '.lan', '.internal', '.home.arpa'].some((suffix) => host.endsWith(suffix))) return `${host} resolves only on a local network`;
  if (parsed.protocol === 'http:') return `${parsed.origin} is plain http`;
  if (parsed.protocol !== 'https:') return `${parsed.protocol} is not a web origin`;
  return null;
}

export function singleLabelHost(url) {
  try {
    const host = hostOf(new URL(url));
    return host && !host.includes('.') && !isIp(host) && host !== 'localhost' ? host : null;
  } catch {
    return null;
  }
}

export function stagingLabel(url) {
  try {
    const host = hostOf(new URL(url));
    if (isIp(host)) return null;
    const labels = host.split('.');
    const suffix = labels.length >= 3 && labels.at(-1).length === 2 && /^(?:co|com|net|org|gov|edu|ac)$/.test(labels.at(-2)) ? 3 : 2;
    return labels.slice(0, -suffix).find((label) => STAGING_LABEL.test(label)) ?? null;
  } catch {
    return null;
  }
}

export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export function bundleConfigs(folder, depth = 5) {
  const found = [];
  const walk = (dir, level) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) if (entry.isFile() && entry.name === 'capacitor.config.json') found.push(path.join(dir, entry.name));
    if (level >= depth) return;
    for (const entry of entries) if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(path.join(dir, entry.name), level + 1);
  };
  walk(folder, 0);
  return found;
}

export function webBuildFiles(folder) {
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!(dir === folder && entry.name === 'plugins') && entry.name !== 'node_modules') walk(full);
      } else if (/\.(?:m?js|cjs)$/.test(entry.name) && !CAPACITOR_RUNTIME.has(entry.name)) files.push(path.relative(folder, full));
    }
  };
  walk(folder);
  return files;
}

export function webPushUses(project) {
  const hits = [];
  let seen = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (seen >= MAX_SOURCE_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name) && !entry.name.startsWith('.')) walk(full);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        seen += 1;
        const text = fs.readFileSync(full, 'utf8');
        if (/pushManager\s*\.\s*subscribe\s*\(/i.test(text)) hits.push(path.relative(project, full));
      }
    }
  };
  walk(project);
  return hits;
}

function readDependencies(project) {
  const file = path.join(project, 'package.json');
  if (!fs.existsSync(file)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.keys({ ...json.dependencies, ...json.devDependencies });
  } catch {
    return [];
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new UsageError(`${file} is not valid JSON: ${error.message}`);
  }
}

function capacitorShells(project) {
  const present = CAPACITOR_FILES.map((name) => path.join(project, name)).filter((file) => fs.existsSync(file));
  if (!present.length) return [];
  const [capacitor, ...ignored] = present;
  const read = capacitorServerUrl(fs.readFileSync(capacitor, 'utf8'), capacitor);
  const web = typeof read.webDir === 'string' ? path.resolve(project, read.webDir) : null;
  const shells = [{ kind: 'capacitor', role: 'config', file: capacitor, ...read, web, ignored }];
  for (const copy of NATIVE_COPIES) {
    const file = path.join(project, ...copy.split('/'));
    if (fs.existsSync(file)) shells.push({ kind: 'capacitor', role: 'native copy', file, ...capacitorServerUrl(fs.readFileSync(file, 'utf8'), file), web: path.join(path.dirname(file), 'public') });
  }
  return shells;
}

function tauriShell(file, config, role) {
  const release = tauriRelease(config);
  return { kind: 'tauri', role, file, ...release, web: release.dist ? path.resolve(path.dirname(file), release.dist) : null };
}

function tauriShells(project) {
  for (const folder of TAURI_FOLDERS) {
    const dir = path.join(project, folder);
    const base = TAURI_BASES.map((name) => path.join(dir, name)).find((file) => fs.existsSync(file));
    if (!base) continue;
    if (!base.endsWith('.json')) return [{ kind: 'tauri', role: 'config', file: base, unparsed: `${path.basename(base)} is not read here; convert it to tauri.conf.json or check its window URL and frontendDist by hand` }];
    const config = readJson(base);
    const shells = [tauriShell(base, config, 'config')];
    for (const platform of TAURI_PLATFORMS) {
      for (const name of [`tauri.${platform}.conf.json`, `tauri.${platform}.conf.json5`, `Tauri.${platform}.toml`]) {
        const file = path.join(dir, name);
        if (!fs.existsSync(file)) continue;
        if (!name.endsWith('.json')) shells.push({ kind: 'tauri', role: `${platform} override`, file, unparsed: `${name} is not read here; check its window URL and frontendDist by hand` });
        else shells.push(tauriShell(file, mergePatch(config, readJson(file)), `config merged with ${name}`));
      }
    }
    return shells;
  }
  return [];
}

export function projectShells(project) {
  return [...capacitorShells(project), ...tauriShells(project)];
}

const describe = (shell) => (shell.url ? originOf(shell.url) : shell.computed ? 'a URL computed at build time' : 'the bundled web build');

function judgeOrigin(shell, where, expected, report) {
  const loads = describe(shell);
  if (!expected) report.skip('WS-ORIGIN-01', where, `loads ${loads}; pass --expect-origin to judge it`);
  else if (expected === 'bundled') report.check('WS-ORIGIN-01', !shell.url, where, `loads ${loads}`, 'the bundled web build');
  else report.check('WS-ORIGIN-01', Boolean(shell.url) && originOf(shell.url) === expected, where, `loads ${loads}`, expected);
}

function judgeRemote(shell, where, report) {
  const reason = unshippableReason(shell.url);
  report.check('WS-ORIGIN-02', !reason, where, reason ?? `${originOf(shell.url)} is a public https origin`, 'a public https origin in every config that ships');
  const single = !reason && singleLabelHost(shell.url);
  if (single) report.warn('WS-ORIGIN-02', where, `${single} is a single-label host, which resolves only through a local network's search domain`, 'a fully qualified public host name');
  const label = stagingLabel(shell.url);
  if (label) report.warn('WS-WARN-STAGING', where, `host label "${label}"`, 'the production origin in the config that ships');
  const extra = webBuildFiles(shell.web);
  if (extra.length) report.warn('WS-WARN-BUNDLED', where, `${extra.length} script files beside a remote server URL (${extra.slice(0, 3).join(', ')})`, 'only an offline page; if the server URL is dropped the app opens this frozen copy');
}

function judgeServerOptions(shell, where, report) {
  const options = [shell.cleartext && 'server.cleartext is true', shell.allowNavigation && 'server.allowNavigation is set'].filter(Boolean);
  if (options.length) report.warn('WS-ORIGIN-02', where, options.join('; '), 'neither in a config that ships: Capacitor documents both for development servers only');
}

function judgeCopy(shell, where, projectConfig, relative, report) {
  if (!projectConfig) report.skip('WS-BUNDLE-01', where, 'no project config to compare with (pass --project)');
  else if (projectConfig.computed) report.skip('WS-BUNDLE-01', where, 'the project computes its server URL at build time');
  else report.check('WS-BUNDLE-01', (shell.url ?? null) === (projectConfig.url ?? null), where, `server URL ${shell.url ?? 'none'}`, `server URL ${projectConfig.url ?? 'none'} as in ${relative(projectConfig.file)}; run npx cap sync, then build again in Xcode or Android Studio`);
}

function judgePush(project, relative, report) {
  const uses = webPushUses(project);
  if (!uses.length) return;
  const dependencies = readDependencies(project);
  if (PUSH_PLUGINS.some((name) => dependencies.includes(name))) return;
  report.warn('WS-WARN-PUSH', relative(uses[0]), `Web Push subscribed in ${uses.length} file(s) with no native remote-push plugin (local notifications cannot receive a push)`, 'native remote push through a plugin in the shell, or a home-screen web app for Web Push');
}

export function checkShells({ project = null, bundle = null, expectOrigin = null }, report, relative = (file) => file) {
  const shells = project ? projectShells(project) : [];
  if (bundle) {
    const configs = bundleConfigs(bundle);
    if (!configs.length) report.skip('WS-BUNDLE-01', relative(bundle), 'no capacitor.config.json inside the bundle (a Tauri binary embeds its config and cannot be read here)');
    for (const file of configs) shells.push({ kind: 'capacitor', role: 'built bundle', file, ...capacitorServerUrl(fs.readFileSync(file, 'utf8'), file), web: path.join(path.dirname(file), 'public') });
  }
  if (!shells.length) throw new UsageError('No Capacitor or Tauri config found.', 'Pass --project with the folder that holds capacitor.config.* or src-tauri/tauri.conf.json, or --bundle with a built .app or unzipped .ipa.');
  const projectConfig = shells.find((shell) => shell.kind === 'capacitor' && shell.role === 'config');
  const expected = expectOrigin && expectOrigin !== 'bundled' ? originOf(expectOrigin) : expectOrigin;
  for (const shell of shells) {
    const where = `${relative(shell.file)} (${shell.kind} ${shell.role})`;
    if (shell.ignored?.length) report.warn('WS-ORIGIN-01', where, `also found ${shell.ignored.map((file) => path.basename(file)).join(', ')}, which the Capacitor CLI ignores while ${path.basename(shell.file)} exists`, 'one Capacitor config file');
    if (shell.unparsed) {
      report.skip('WS-ORIGIN-01', where, shell.unparsed);
      continue;
    }
    if (shell.computed) {
      report.skip('WS-ORIGIN-01', where, `${shell.reason ?? 'the server URL is computed'}; it is resolved at sync time, so check the built bundle with --bundle`);
      continue;
    }
    judgeOrigin(shell, where, expected, report);
    if (shell.url) judgeRemote(shell, where, report);
    else report.pass('WS-ORIGIN-02', where, 'no remote URL', null);
    judgeServerOptions(shell, where, report);
    if (shell.role !== 'config' && shell.kind === 'capacitor') judgeCopy(shell, where, projectConfig, relative, report);
  }
  if (project) judgePush(project, relative, report);
  return shells;
}

export function nothingJudged(findings) {
  return !findings.some((finding) => finding.level === 'pass' || finding.level === 'error');
}

export function parseArgs(argv) {
  const options = { project: null, bundle: null, expectOrigin: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[(index += 1)];
      if (!next || next.startsWith('--')) throw new UsageError(`${arg} needs a value.`);
      return next;
    };
    if (arg === '--project') options.project = path.resolve(value());
    else if (arg === '--bundle') options.bundle = path.resolve(value());
    else if (arg === '--expect-origin') options.expectOrigin = value();
    else throw new UsageError(`Unknown argument ${arg}.\nUsage: node check-shell.mjs --project <folder> [--bundle <folder>] [--expect-origin <origin|bundled>]`);
  }
  if (!options.project && !options.bundle) throw new UsageError('Usage: node check-shell.mjs --project <folder> [--bundle <folder>] [--expect-origin <origin|bundled>]');
  for (const key of ['project', 'bundle']) {
    if (!options[key]) continue;
    if (!fs.existsSync(options[key])) throw new UsageError(`${options[key]} does not exist.`);
    if (!fs.statSync(options[key]).isDirectory()) throw new UsageError(`${options[key]} is not a folder.`, key === 'bundle' ? 'Unzip an .ipa first (unzip App.ipa -d app) and pass the folder.' : undefined);
  }
  if (options.expectOrigin && options.expectOrigin !== 'bundled' && !/^https?:\/\/[^/]+/.test(options.expectOrigin)) throw new UsageError('--expect-origin takes an origin such as https://app.example.com, or "bundled".');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'check-shell', boundary: BOUNDARY });
  const relative = (file) => {
    for (const [label, base] of [['', options.project], ['bundle: ', options.bundle]]) {
      if (!base) continue;
      const inside = path.relative(base, file);
      if (!inside.startsWith('..') && !path.isAbsolute(inside)) return `${label}${inside || path.basename(file)}`;
    }
    return file;
  };
  checkShells(options, report, relative);
  if (nothingJudged(report.findings)) {
    throw new UsageError('Nothing was judged: every check above was skipped.', 'Pass --expect-origin <origin or "bundled">, or --bundle with the built .app or unzipped .ipa when the config computes its server URL.');
  }
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
