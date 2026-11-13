/**
 * web-shells static check: reads a project's Capacitor or Tauri config, the copies Capacitor puts in the native
 * projects, and the config inside a built .app or an unzipped .ipa, and reports which origin each one will load.
 * Nothing is built, run or installed.
 *
 *   node check-shell.mjs --project <folder> [--bundle <built .app or unzipped .ipa folder>] [--expect-origin <origin>]
 *   node check-shell.mjs --bundle <folder> --expect-origin <https origin or "bundled">
 *
 * Errors: WS-ORIGIN-01, a config or bundle that loads another origin than --expect-origin, or the bundled build when a
 * remote origin is expected; WS-ORIGIN-02, a shipping config that points at a loopback, private-network or link-local
 * host, or at plain http; WS-BUNDLE-01, a native-project copy or a built bundle whose server URL differs from the
 * project's config. Warnings: WS-WARN-STAGING, an origin whose host name carries a staging, dev, preview or test
 * label; WS-WARN-BUNDLED, a remote shell that also carries a full web build; WS-WARN-PUSH, web code that subscribes
 * to Web Push inside a WebView shell with no native push plugin. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY =
  'Proof boundary: a static read of the shell configs and the bundle folder; it does not build or launch the app, ' +
  'resolve configs computed at build time, read a Tauri binary, or prove what a device loads at run time.';

export const CAPACITOR_FILES = ['capacitor.config.json', 'capacitor.config.ts', 'capacitor.config.mts', 'capacitor.config.js', 'capacitor.config.mjs', 'capacitor.config.cjs'];
export const NATIVE_COPIES = ['ios/App/App/capacitor.config.json', 'android/app/src/main/assets/capacitor.config.json'];
export const TAURI_FILES = ['src-tauri/tauri.conf.json', 'tauri.conf.json'];
export const STAGING_LABEL = /^(?:staging|stage|stg|dev|develop|development|preview|test|testing|qa|uat|sandbox|beta)$/i;
export const PUSH_PLUGINS = ['@capacitor/push-notifications', '@capacitor-firebase/messaging', '@capacitor/local-notifications', 'tauri-plugin-notification', '@tauri-apps/plugin-notification'];
const CAPACITOR_RUNTIME = new Set(['cordova.js', 'cordova_plugins.js', 'native-bridge.js']);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.astro', '.html']);
const SKIPPED_FOLDERS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'ios', 'android', 'target', '.next', '.nuxt', '.svelte-kit', 'coverage', 'public']);
const MAX_SOURCE_FILES = 4000;

function blockAfter(text, key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(text);
  if (!match) return null;
  let depth = 0;
  for (let index = match.index + match[0].length - 1; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(match.index + match[0].length, index);
    }
  }
  return null;
}

/** The server URL of a Capacitor config: { url } for a literal, { url: null } for none, { computed } when code sets it. */
export function capacitorServerUrl(text, file) {
  if (file.endsWith('.json')) {
    let config;
    try {
      config = JSON.parse(text);
    } catch (error) {
      throw new UsageError(`${file} is not valid JSON: ${error.message}`);
    }
    const url = config?.server?.url;
    return { url: typeof url === 'string' && url.trim() ? url.trim() : null, webDir: config?.webDir ?? null };
  }
  const webDir = /\bwebDir\s*:\s*(['"`])([^'"`]+)\1/.exec(text)?.[2] ?? null;
  const server = blockAfter(text, 'server');
  if (!server) return { url: null, webDir };
  const literal = /(?:^|[\s,{])url\s*:\s*(['"])([^'"]+)\1/.exec(server);
  if (literal) return { url: literal[2].trim(), webDir };
  if (/(?:^|[\s,{])url\s*[:,}]/.test(server) || /(?:^|[\s,{])url\s*$/m.test(server)) return { url: null, computed: true, webDir };
  return { url: null, webDir };
}

const isUrl = (value) => typeof value === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

/** The URL a Tauri config ships: the first window's external URL, else frontendDist (or distDir) when it is a URL. */
export function tauriRelease(config) {
  const windows = config?.app?.windows ?? config?.tauri?.windows ?? [];
  const windowUrl = windows.find((window) => isUrl(window?.url))?.url ?? null;
  const dist = config?.build?.frontendDist ?? config?.build?.distDir ?? null;
  if (windowUrl) return { url: windowUrl, via: 'app.windows[].url' };
  if (isUrl(dist)) return { url: dist, via: 'build.frontendDist' };
  return { url: null, via: 'build.frontendDist' };
}

const PRIVATE_V4 = [/^127\./, /^10\./, /^192\.168\./, /^172\.(?:1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./];

/** Why a shipping shell must not load this URL, or null: loopback, private or link-local hosts and plain http. */
export function unshippableReason(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `not a valid URL: ${url}`;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return `${host} is the device itself, not the developer's machine`;
  if (PRIVATE_V4.some((pattern) => pattern.test(host)) || /^f[cd][0-9a-f]{2}:|^fe80:/.test(host)) return `${host} is a loopback, private-network or link-local address`;
  if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return `${host} resolves only on a local network`;
  if (parsed.protocol === 'http:') return `${parsed.origin} is plain http`;
  if (parsed.protocol !== 'https:') return `${parsed.protocol} is not a web origin`;
  return null;
}

export function stagingLabel(url) {
  try {
    return new URL(url).hostname.split('.').find((label) => STAGING_LABEL.test(label) || /^(?:staging|dev|preview|test)-|-(?:staging|dev|preview|test)$/i.test(label)) ?? null;
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

/** Every capacitor.config.json inside a built bundle folder, nearest first, up to a few levels down. */
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

/** Script files of a web build folder that are not Capacitor's own runtime: a full build ships them, an offline page does not. */
export function webBuildFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:m?js|cjs)$/.test(entry.name) && !CAPACITOR_RUNTIME.has(entry.name)) files.push(path.relative(folder, full));
    }
  };
  walk(folder);
  return files;
}

/** Source files of the project that subscribe to Web Push. */
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

function readCargo(project) {
  const file = path.join(project, 'src-tauri', 'Cargo.toml');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The shell configs a project holds: its Capacitor config with the native copies, and its Tauri config. */
export function projectShells(project) {
  const shells = [];
  const capacitor = CAPACITOR_FILES.map((name) => path.join(project, name)).find((file) => fs.existsSync(file));
  if (capacitor) {
    const read = capacitorServerUrl(fs.readFileSync(capacitor, 'utf8'), capacitor);
    shells.push({ kind: 'capacitor', role: 'config', file: capacitor, ...read });
    for (const copy of NATIVE_COPIES) {
      const file = path.join(project, ...copy.split('/'));
      if (fs.existsSync(file)) shells.push({ kind: 'capacitor', role: 'native copy', file, ...capacitorServerUrl(fs.readFileSync(file, 'utf8'), file), web: path.join(path.dirname(file), 'public') });
    }
  }
  const tauri = TAURI_FILES.map((name) => path.join(project, ...name.split('/'))).find((file) => fs.existsSync(file));
  if (tauri) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(tauri, 'utf8'));
    } catch (error) {
      throw new UsageError(`${tauri} is not valid JSON: ${error.message}`);
    }
    shells.push({ kind: 'tauri', role: 'config', file: tauri, ...tauriRelease(config) });
  }
  return shells;
}

const describe = (shell) => (shell.url ? originOf(shell.url) : shell.computed ? 'a URL computed at build time' : 'the bundled web build');

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
    const loads = describe(shell);
    if (shell.computed) {
      report.skip('WS-ORIGIN-01', where, 'the server URL is computed at build time; check the built bundle with --bundle');
      continue;
    }
    if (!expected) report.skip('WS-ORIGIN-01', where, `loads ${loads}; pass --expect-origin to judge it`);
    else if (expected === 'bundled') report.check('WS-ORIGIN-01', !shell.url, where, `loads ${loads}`, 'the bundled web build');
    else report.check('WS-ORIGIN-01', Boolean(shell.url) && originOf(shell.url) === expected, where, `loads ${loads}`, expected);
    if (shell.url) {
      const reason = unshippableReason(shell.url);
      report.check('WS-ORIGIN-02', !reason, where, reason ?? `${originOf(shell.url)} is a public https origin`, 'a public https origin in every config that ships');
      const label = stagingLabel(shell.url);
      if (label) report.warn('WS-WARN-STAGING', where, `host label "${label}"`, 'the production origin in the config that ships');
      const extra = shell.web ? webBuildFiles(shell.web) : [];
      if (extra.length) report.warn('WS-WARN-BUNDLED', where, `${extra.length} script files beside a remote server URL (${extra.slice(0, 3).join(', ')})`, 'only an offline page; if the server URL is dropped the app opens this frozen copy');
    } else {
      report.pass('WS-ORIGIN-02', where, 'no remote URL', null);
    }
    if (shell.role !== 'config' && shell.kind === 'capacitor') {
      if (!projectConfig) report.skip('WS-BUNDLE-01', where, 'no project config to compare with (pass --project)');
      else if (projectConfig.computed) report.skip('WS-BUNDLE-01', where, 'the project computes its server URL at build time');
      else report.check('WS-BUNDLE-01', (shell.url ?? null) === (projectConfig.url ?? null), where, `server URL ${shell.url ?? 'none'}`, `server URL ${projectConfig.url ?? 'none'} as in ${relative(projectConfig.file)}; run npx cap sync, then build again in Xcode or Android Studio`);
    }
  }
  if (project) {
    const uses = webPushUses(project);
    if (uses.length) {
      const dependencies = readDependencies(project);
      const native = PUSH_PLUGINS.some((name) => dependencies.includes(name)) || /tauri-plugin-notification/.test(readCargo(project));
      if (!native) report.warn('WS-WARN-PUSH', relative(uses[0]), `Web Push subscribed in ${uses.length} file(s) with no native push plugin`, 'native push through a plugin in the shell, or a home-screen web app for Web Push');
    }
  }
  return shells;
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
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
