/**
 * desktop-distribution signature probe, read-only: runs `codesign --verify --deep --strict`, reads `codesign -dv` for
 * the app and every Mach-O file inside it, asks Gatekeeper with `spctl --assess --type execute`, looks for helpers
 * that start a runtime from outside the bundle, and checks which build tools come first on PATH. It never signs,
 * strips, moves or opens anything.
 *
 *   node probe-app.mjs --app <path to the built .app> [--record <file.json>]
 *
 * --record reads recorded command output instead of running the commands, so the probe can judge a report from
 * another Mac: {"verify": {"status", "output"}, "spctl": {"status", "output"}, "code": {"<path inside the app, or
 * .>": {"status", "output"}}, "tools": {"<tool>": ["<every hit on PATH, in order>"]}}. Without it the probe runs the
 * commands on macOS only; elsewhere it reports every rule as skipped. The text scan reads the --app folder whenever it
 * exists. Errors: DD-SIGN-01, the deep strict verification fails or nested code is unsigned; DD-TEAM-01, nested code
 * signed by another team than the app, or a helper that starts node, python, ruby, deno or bun from outside the
 * bundle; DD-GATE-01, a Developer ID app that Gatekeeper does not accept as notarized. Warnings: DD-WARN-ADHOC, an ad
 * hoc or development signature; DD-WARN-RUNTIME, Developer ID code without the hardened runtime or a secure
 * timestamp; DD-WARN-PATH, a build tool that resolves outside /usr/bin, /bin, /usr/sbin or /sbin. Output follows the
 * shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';

export const BOUNDARY =
  'Proof boundary: codesign and spctl answers for this copy of the app at one moment, and a text scan of its bundle; ' +
  'it does not prove what a peer process accepts at run time, what a quarantined download shows on another Mac, or that the notary ticket is stapled. ' +
  "Check a helper's acceptance in the app's own logs.";

export const SYSTEM_DIRS = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];
export const BUILD_TOOLS = ['xattr', 'codesign', 'ditto', 'hdiutil', 'plutil', 'spctl', 'pkgutil'];
const MACHO = new Set(['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'bebafeca']);
const MAX_CODE = 400;
const MAX_TEXT_BYTES = 256 * 1024;
const TEXT_EXTENSIONS = new Set(['.plist', '.json', '.sh', '.command', '.js', '.mjs', '.cjs', '.py', '.rb', '.txt', '.conf', '.zsh', '.bash']);
export const OUTSIDE_RUNTIME = [
  { pattern: /\/opt\/homebrew\/(?:bin|opt\/[\w.@-]+\/bin)\/(node|python3?|ruby|deno|bun)\b/, why: 'a Homebrew runtime' },
  { pattern: /\/usr\/local\/bin\/(node|python3?|ruby|deno|bun)\b/, why: 'a runtime in /usr/local/bin' },
  { pattern: /\.(?:nvm|volta|fnm|asdf)\/[^\s"']*\b(node)\b/, why: 'a version-manager runtime in the home folder' },
  { pattern: /^#!\s*\/usr\/bin\/env\s+(node|python3?|ruby|deno|bun)\b/m, why: 'whichever runtime PATH finds first' },
];

/** Fields of `codesign -dv --verbose=4` output (printed on stderr). */
export function parseCodesignInfo(text) {
  const value = (key) => String(text).match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() ?? null;
  const authorities = [...String(text).matchAll(/^Authority=(.*)$/gm)].map((match) => match[1].trim());
  const flags = String(text).match(/flags=0x[0-9a-f]+\(([^)]*)\)/i)?.[1]?.split(',').map((flag) => flag.trim()) ?? [];
  const unsigned = /not signed at all/i.test(text);
  const team = value('TeamIdentifier');
  const adhoc = value('Signature') === 'adhoc' || flags.includes('adhoc');
  let kind = 'other';
  if (unsigned) kind = 'unsigned';
  else if (adhoc) kind = 'adhoc';
  else if (authorities.some((name) => name.startsWith('Developer ID Application'))) kind = 'developer-id';
  else if (authorities.some((name) => /^(?:Apple Development|Mac Developer)/.test(name))) kind = 'development';
  else if (authorities.some((name) => /^(?:Apple Distribution|3rd Party Mac Developer Application|Apple Mac OS Application Signing)/.test(name))) kind = 'app-store';
  return { unsigned, kind, team: team && team !== 'not set' ? team : null, authorities, flags, runtime: flags.includes('runtime'), timestamp: Boolean(value('Timestamp')) };
}

/** Gatekeeper's answer from `spctl --assess --verbose=4` output. */
export function parseSpctl(text, status) {
  const accepted = status === 0 && /:\s*accepted\b/.test(text);
  return { accepted, source: String(text).match(/^source=(.*)$/m)?.[1]?.trim() ?? null };
}

const isMacho = (file) => {
  try {
    const handle = fs.openSync(file, 'r');
    const head = Buffer.alloc(4);
    const read = fs.readSync(handle, head, 0, 4, 0);
    fs.closeSync(handle);
    return read === 4 && MACHO.has(head.toString('hex'));
  } catch {
    return false;
  }
};

function* walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/** Mach-O files inside the app other than its main executable, as paths relative to the app. */
export function nestedCode(app) {
  const contents = path.join(app, 'Contents');
  if (!fs.existsSync(contents)) return [];
  const main = path.join(contents, 'MacOS');
  const found = [];
  for (const file of walk(contents)) {
    if (path.dirname(file) === main) continue;
    if (isMacho(file)) found.push(path.relative(app, file).split(path.sep).join('/'));
  }
  return found.sort();
}

/** Lines in the bundle's text files that start a runtime from outside the bundle. */
export function outsideRuntimes(app) {
  const contents = path.join(app, 'Contents');
  if (!fs.existsSync(contents)) return [];
  const hits = [];
  for (const file of walk(contents)) {
    const size = fs.statSync(file).size;
    if (size > MAX_TEXT_BYTES || isMacho(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) && !text.startsWith('#!')) continue;
    for (const { pattern, why } of OUTSIDE_RUNTIME) {
      const match = text.match(pattern);
      if (!match) continue;
      const line = text.slice(0, match.index).split('\n').length;
      hits.push({ file: `${path.relative(app, file).split(path.sep).join('/')}:${line}`, runtime: match[1], why });
    }
  }
  return hits;
}

export function judgeSignature({ verify, code, spctl, report }) {
  report.check('DD-SIGN-01', verify.status === 0, '.', verify.status === 0 ? 'codesign --verify --deep --strict passed' : `codesign --verify --deep --strict exited ${verify.status}: ${tail(verify.output)}`, 'the seal of the app and all nested code verifies');
  if (!code['.']) throw new UsageError('The recording has no codesign -dv output for the app itself (code["."]).');
  const host = parseCodesignInfo(code['.'].output);
  for (const [where, run] of Object.entries(code)) {
    if (where === '.') continue;
    const info = parseCodesignInfo(run.output);
    if (info.unsigned) {
      report.error('DD-SIGN-01', where, 'not signed at all', 'every nested executable, library and bundle signed before the app is signed');
      continue;
    }
    const same = info.team === host.team && (info.kind === 'adhoc') === (host.kind === 'adhoc');
    report.check('DD-TEAM-01', same, where, `team ${info.team ?? 'not set'} (${info.kind})`, `team ${host.team ?? 'not set'} (${host.kind}), the app's own`);
  }
  if (host.kind === 'developer-id') {
    const gate = parseSpctl(spctl.output, spctl.status);
    const notarized = gate.accepted && /Notarized Developer ID/i.test(gate.source ?? '');
    report.check('DD-GATE-01', notarized, '.', `spctl ${gate.accepted ? 'accepted' : 'rejected'}${gate.source ? `, source=${gate.source}` : ''}`, 'accepted, source=Notarized Developer ID');
    report.check('DD-WARN-RUNTIME', host.runtime && host.timestamp, '.', `hardened runtime ${host.runtime ? 'on' : 'off'}, secure timestamp ${host.timestamp ? 'present' : 'missing'}`, 'hardened runtime and a secure timestamp, which notarization requires', 'warn');
  } else if (host.kind === 'adhoc' || host.kind === 'development') {
    report.skip('DD-GATE-01', '.', `${host.kind} signature: Gatekeeper rejects it on other Macs by design`);
    report.warn('DD-WARN-ADHOC', '.', `${host.kind === 'adhoc' ? 'ad hoc' : 'development'} signature${host.team ? ` (team ${host.team})` : ''}`, 'Developer ID and notarization for anyone downloading it; an ad hoc build only through an installer that checks its checksum and signature');
  } else if (host.kind === 'unsigned') {
    report.error('DD-SIGN-01', '.', 'the app is not signed at all', 'signed; on Apple silicon unsigned arm64 code does not run');
  } else {
    report.skip('DD-GATE-01', '.', `${host.kind} signature: not a Developer ID build`);
  }
}

export function judgeRuntimes(app, report) {
  if (!fs.existsSync(path.join(app, 'Contents'))) {
    report.skip('DD-TEAM-01', app, 'no app folder to scan for helpers that start an outside runtime');
    return;
  }
  const hits = outsideRuntimes(app);
  for (const hit of hits) report.error('DD-TEAM-01', hit.file, `starts ${hit.runtime} from ${hit.why}, signed by another team or none`, "a runtime bundled inside the app and signed with the app's team");
  if (!hits.length) report.pass('DD-TEAM-01', 'Contents', 'no helper starts a runtime from outside the bundle', 'bundled runtimes only');
}

export function judgeTools(tools, report) {
  for (const tool of BUILD_TOOLS) {
    const hits = tools[tool];
    if (!hits?.length) continue;
    const first = hits[0];
    const system = SYSTEM_DIRS.includes(path.posix.dirname(first));
    report.check('DD-WARN-PATH', system, tool, `first on PATH: ${first}`, `the macOS copy in ${SYSTEM_DIRS.join(', ')}; put /usr/bin first when building and signing`, 'warn');
  }
}

const tail = (text) => String(text ?? '').trim().split('\n').slice(-2).join(' ').slice(0, 300);

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new UsageError(`${command} was not found.`, `${command} ships with macOS in /usr/bin or /usr/sbin. Run: PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" ${currentCommand()}`);
  if (result.error) throw result.error;
  return { status: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function liveTools() {
  const dirs = (process.env.PATH ?? '').split(':').filter(Boolean);
  const tools = {};
  for (const tool of BUILD_TOOLS) tools[tool] = dirs.map((dir) => path.posix.join(dir, tool)).filter((file) => fs.existsSync(file));
  return tools;
}

export function readRecording(file) {
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['verify', 'spctl', 'code']) if (!record[key]) throw new UsageError(`${file} has no "${key}" entry.`);
  return { verify: record.verify, spctl: record.spctl, code: record.code, tools: record.tools ?? {} };
}

export function parseArgs(argv) {
  const args = dropProject(argv);
  const options = { app: null, record: null };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const next = args[index + 1];
    if ((flag === '--app' || flag === '--record') && (!next || next.startsWith('--'))) throw new UsageError(`${flag} needs a value.`);
    if (flag === '--app') options.app = path.resolve(args[(index += 1)]);
    else if (flag === '--record') options.record = path.resolve(args[(index += 1)]);
    else throw new UsageError(`Unknown argument ${flag}.\nUsage: node probe-app.mjs --app <path to the built .app> [--record <file.json>]`);
  }
  if (!options.app) throw new UsageError('Usage: node probe-app.mjs --app <path to the built .app> [--record <file.json>]');
  if (options.record && !fs.existsSync(options.record)) throw new UsageError(`Not found: ${options.record}`);
  if (!options.record && !fs.existsSync(options.app)) throw new UsageError(`Not found: ${options.app}`);
  return options;
}

async function main() {
  const { app, record } = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'probe-app', boundary: BOUNDARY });
  if (!record && process.platform !== 'darwin') {
    for (const rule of ['DD-SIGN-01', 'DD-TEAM-01', 'DD-GATE-01']) report.skip(rule, app, `this probe runs codesign and spctl on macOS and this is ${process.platform}; record their output on the Mac and pass --record`);
    return report.summary();
  }
  let inputs;
  if (record) inputs = readRecording(record);
  else {
    const code = { '.': run('codesign', ['-dv', '--verbose=4', app]) };
    const nested = nestedCode(app);
    for (const item of nested.slice(0, MAX_CODE)) code[item] = run('codesign', ['-dv', '--verbose=4', path.join(app, item)]);
    if (nested.length > MAX_CODE) report.skip('DD-TEAM-01', app, `read the first ${MAX_CODE} of ${nested.length} nested Mach-O files`);
    inputs = { verify: run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]), spctl: run('spctl', ['--assess', '--type', 'execute', '--verbose=4', app]), code, tools: liveTools() };
  }
  judgeSignature({ ...inputs, report });
  judgeRuntimes(app, report);
  judgeTools(inputs.tools, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
