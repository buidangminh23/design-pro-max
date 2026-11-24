/**
 * menubar-widgets stale extension probe, read-only: finds the app extensions inside an installed app, lists their
 * running processes with ps and lsof, and reports any that started before the bundle was installed or run an
 * executable outside it. It never stops a process; it prints the commands to run.
 *
 *   node probe-extension.mjs --app <path to the installed .app> [--installed <date and time>] [--ps <file> --tz <offset>] [--lsof <file>]
 *
 * A process belongs to an extension when its ps arguments run <name>.appex/Contents/MacOS/<executable> and that
 * extension bundle has the installed extension's identifier, or no longer exists and sat inside an app of the same
 * name (a removed or temporary copy). Other apps' extensions and a debug copy under another identifier are ignored.
 * The install time is the later of the change time and the birth time of the extension and its executable, since
 * updaters keep the modification time; --installed overrides it. The executable path comes from lsof, else from the
 * ps arguments.
 *
 * --ps and --lsof read recorded output of `LC_ALL=C ps -axww -o pid=,lstart=,args=` and `lsof -a -p <pids> -d txt -Fpn`
 * instead of running them, so the probe can judge a report from another machine; --tz gives that machine's UTC offset
 * (Z or +hh:mm), which a recording needs; a recorded --ps without --lsof never runs lsof on this machine and takes the
 * executable path from the ps arguments. Without them it runs both, on macOS only; elsewhere it reports the rule as
 * skipped. Error: MW-STALE-01. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReport, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';

export const BOUNDARY = 'Proof boundary: process start times from ps (whole seconds) and executable mappings from lsof, or the ps arguments, at one moment; it does not prove which process WidgetKit asks for timelines or what the placed widget draws. Look at the widget after the fix.';
const START_TOLERANCE_MS = 1000;
const LSTART = /^\s*(\d+)\s+([A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(\d{4}))\s+(.*)$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const OFFSET = /^(?:Z|[+-]\d{2}:\d{2})$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
const pad = (value) => String(value).padStart(2, '0');
const SYSTEM_PATH = 'PATH="/bin:/usr/bin:/usr/sbin:$PATH"';

export function systemToolHint(command, argv = process.argv) {
  return `${command} ships with macOS in /bin, /usr/bin or /usr/sbin, which are missing from PATH. Run the probe again with them: ${SYSTEM_PATH} ${currentCommand(argv)}. Off macOS, run the probe on the Mac, or record ps and lsof there and pass --ps, --tz and --lsof.`;
}

export function plutilHint(file, inBundle, platform = process.platform) {
  if (platform === 'darwin') return systemToolHint('plutil');
  const installed = quote(`<path to the installed .app>/${inBundle}`);
  return `Off macOS there is no plutil to install. On the Mac, write an XML copy to another file, leaving the installed app untouched because its code signature seals this file: plutil -convert xml1 -o Info.xml ${installed}. Then put that Info.xml in place of ${quote(file)} in the copy here and run the probe again, or run the probe on the Mac.`;
}

export function plistString(text, key) {
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(text);
  return match ? match[1] : null;
}

function readPlist(file, inBundle) {
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 6).toString('latin1') !== 'bplist') return bytes.toString('utf8');
  const result = spawnSync('plutil', ['-convert', 'xml1', '-o', '-', file], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') throw new UsageError(`Cannot read the binary property list ${file}: plutil is not on PATH.`, plutilHint(file, inBundle));
  if (result.error || result.status !== 0) throw new UsageError(`Cannot read the binary property list ${file}: ${String(result.stderr || result.error?.message || '').trim()}`);
  return result.stdout;
}

export function findExtensions(app) {
  const folder = path.join(app, 'Contents', 'PlugIns');
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter((name) => name.endsWith('.appex')).sort().map((name) => {
    const appex = path.join(folder, name);
    const info = path.join(appex, 'Contents', 'Info.plist');
    const plist = fs.existsSync(info) ? readPlist(info, path.relative(app, info).split(path.sep).join('/')) : '';
    const executable = plistString(plist, 'CFBundleExecutable') ?? name.replace(/\.appex$/, '');
    return { name, app, appex, identifier: plistString(plist, 'CFBundleIdentifier'), executable, binary: path.join(appex, 'Contents', 'MacOS', executable) };
  });
}

export function parsePs(text, tz = null) {
  return String(text).split(/\r?\n/).map((line) => LSTART.exec(line)).filter(Boolean).map((match) => {
    const [, pid, lstart, month, day, hour, minute, second, year, args] = match;
    const iso = `${year}-${pad(MONTHS.indexOf(month) + 1)}-${pad(day)}T${pad(hour)}:${minute}:${second}`;
    return { pid: Number(pid), started: new Date(tz ? `${iso}${tz}` : iso), lstart: lstart.replace(/\s+/g, ' '), args };
  });
}

export function parseInstalled(value, tz = null) {
  return new Date(tz && LOCAL_DATE_TIME.test(value) ? `${value}${tz}` : value);
}

export function installTime(extension) {
  const times = [extension.appex, extension.binary].flatMap((file) => {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return stat ? [stat.ctimeMs, stat.birthtimeMs].filter((value) => value > 0) : [];
  });
  return new Date(Math.max(...times));
}

export function parseLsof(text) {
  const mapped = new Map();
  let pid = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid !== null) {
      if (!mapped.has(pid)) mapped.set(pid, []);
      mapped.get(pid).push(line.slice(1));
    }
  }
  return mapped;
}

const samePath = (a, b) => {
  const variants = (value) => {
    const resolved = path.resolve(value);
    const set = new Set([resolved, resolved.replace(/^\/private(?=\/)/, '')]);
    try {
      set.add(fs.realpathSync.native(resolved));
    } catch {}
    return set;
  };
  const left = variants(a);
  return [...variants(b)].some((value) => left.has(value));
};

const SEPARATORS = path.sep === '\\' ? ['/', '\\'] : ['/'];

const isAbsolutePath = (file) => typeof file === 'string' && (file.startsWith('/') || (path.sep === '\\' && path.win32.isAbsolute(file)));

export function launchedPath(args, executable) {
  for (const sep of SEPARATORS) {
    const tail = ['.appex', 'Contents', 'MacOS', executable].join(sep);
    for (let from = args.indexOf(tail); from >= 0; from = args.indexOf(tail, from + 1)) {
      const end = from + tail.length;
      if (end === args.length || args[end] === ' ') return args.slice(0, end);
    }
  }
  return null;
}

const APP_NAME = path.sep === '\\' ? /([^/\\]+\.app)[/\\]Contents[/\\]PlugIns[/\\][^/\\]+\.appex[/\\]Contents[/\\]MacOS[/\\][^/\\]+$/ : /([^/]+\.app)\/Contents\/PlugIns\/[^/]+\.appex\/Contents\/MacOS\/[^/]+$/;

const appName = (file) => APP_NAME.exec(file)?.[1] ?? null;

export function ownsProcess(extension, launched) {
  if (!isAbsolutePath(launched)) return false;
  if (samePath(launched, extension.binary)) return true;
  const info = path.join(path.dirname(path.dirname(path.dirname(launched))), 'Contents', 'Info.plist');
  if (fs.existsSync(info)) return extension.identifier !== null && plistString(readPlist(info), 'CFBundleIdentifier') === extension.identifier;
  return appName(launched) === path.basename(extension.app);
}

export function extensionProcesses(processes, extension) {
  return processes.flatMap((process) => {
    const launched = launchedPath(process.args, extension.executable);
    if (!launched) return [];
    if (!isAbsolutePath(launched)) return [{ ...process, launched: null }];
    return ownsProcess(extension, launched) ? [{ ...process, launched }] : [];
  });
}

export function judge({ extension, process, mapping, installed }) {
  const mapped = (mapping ?? []).find((file) => file.endsWith(`/Contents/MacOS/${extension.executable}`)) ?? null;
  if (!process.launched && mapped && !ownsProcess(extension, mapped)) return { foreign: true };
  const fromArgs = process.launched;
  const runs = mapped ?? fromArgs;
  const source = mapped ? 'lsof' : fromArgs ? 'the ps arguments' : null;
  const early = process.started.getTime() < installed.getTime() - START_TOLERANCE_MS;
  const outside = runs !== null && !samePath(runs, extension.binary);
  const reasons = [];
  if (early) reasons.push(`started ${process.lstart}, before the bundle was installed (${installed.toISOString()})`);
  if (outside) reasons.push(`runs ${runs} (from ${source}), outside the installed app`);
  return { stale: early || outside, reasons, runs, source };
}

export function fixCommands(extension, pids) {
  return `stop the stale process and re-register the extension: kill ${pids.join(' ')}; pluginkit -a ${quote(extension.appex)}; then call WidgetCenter.shared.reloadAllTimelines() from the app (better: do all three at app launch)`;
}

function runTool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new UsageError(`${command} is not on PATH.`, systemToolHint(command));
  const blocked = ['EPERM', 'EACCES'].includes(result.error?.code) || (/not permitted|sandbox/i.test(result.stderr ?? '') && !result.stdout);
  if (blocked) throw new SandboxError(`Blocked: ${command} could not read the process table.`, currentCommand());
  if (result.error) throw result.error;
  return result.stdout ?? '';
}

function option(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  if (index + 1 >= args.length) throw new UsageError(`${flag} needs a value.`);
  return args[index + 1];
}

export function probe({ app, installedAt, psText, lsofText, tz = null, report }) {
  const extensions = findExtensions(app);
  if (!extensions.length) throw new UsageError(`No app extension in ${path.join(app, 'Contents', 'PlugIns')}.`);
  const processes = parsePs(psText, tz);
  const mapping = parseLsof(lsofText ?? '');
  for (const extension of extensions) {
    const installed = installedAt ?? installTime(extension);
    const judged = extensionProcesses(processes, extension).map((process) => ({ process, verdict: judge({ extension, process, mapping: mapping.get(process.pid), installed }) })).filter(({ verdict }) => !verdict.foreign);
    if (!judged.length) {
      report.skip('MW-STALE-01', extension.name, 'no process of this extension is running; place its widget and run the probe again');
      continue;
    }
    for (const { process, verdict } of judged) {
      const where = `${extension.name} pid ${process.pid}`;
      if (verdict.stale) report.error('MW-STALE-01', where, verdict.reasons.join('; '), fixCommands(extension, [process.pid]));
      else if (!verdict.runs) report.warn('MW-STALE-01', where, `started ${process.lstart}, after the install, but neither lsof nor the ps arguments gave its executable path`, 'an executable path inside the installed app; rerun with lsof available');
      else report.pass('MW-STALE-01', where, `started ${process.lstart} and runs the installed copy (from ${verdict.source})`, 'started after the install and runs the installed copy');
    }
  }
}

function readOptions(args) {
  const app = option(args, '--app');
  if (!app) throw new UsageError('Usage: node probe-extension.mjs --app <path to the installed .app> [--installed <date and time>] [--ps <file> --tz <offset>] [--lsof <file>]');
  if (!fs.existsSync(app)) throw new UsageError(`Not found: ${app}`);
  const psFile = option(args, '--ps');
  const lsofFile = option(args, '--lsof');
  const tz = option(args, '--tz');
  if (tz && !OFFSET.test(tz)) throw new UsageError(`--tz takes Z or +hh:mm, not ${tz}.`);
  if (psFile && !tz) throw new UsageError("A recorded --ps needs --tz with the recording machine's UTC offset (Z or +hh:mm), since ps prints local times without one.");
  if (tz && !psFile) throw new UsageError("--tz describes a recorded --ps; a live run uses this machine's time zone.");
  const installedOption = option(args, '--installed');
  if (installedOption && !HAS_OFFSET.test(installedOption) && !LOCAL_DATE_TIME.test(installedOption)) throw new UsageError(`Write --installed as YYYY-MM-DDTHH:MM:SS, with or without a UTC offset, not ${installedOption}.`);
  const installedAt = installedOption ? parseInstalled(installedOption, tz) : null;
  if (installedAt && Number.isNaN(installedAt.getTime())) throw new UsageError(`Cannot read --installed ${installedOption}.`);
  return { app: path.resolve(app), psFile, lsofFile, tz, installedAt };
}

async function main() {
  const { app, psFile, lsofFile, tz, installedAt } = readOptions(process.argv.slice(2));
  const report = createReport({ tool: 'probe-extension', boundary: BOUNDARY });
  if (!psFile && process.platform !== 'darwin') {
    report.skip('MW-STALE-01', app, `this probe reads macOS processes and this is ${process.platform}; record ps and lsof on the Mac and pass --ps, --tz and --lsof`);
    return report.summary();
  }
  const psText = psFile ? fs.readFileSync(psFile, 'utf8') : runTool('ps', ['-axww', '-o', 'pid=,lstart=,args=']);
  if (psFile && !parsePs(psText, tz).length) throw new UsageError(`No process line in ${psFile} could be read. Record it with LC_ALL=C ps -axww -o pid=,lstart=,args= so the start times are in English.`);
  if (!psFile && !parsePs(psText).length) throw new SandboxError('Blocked: ps listed no process at all, so the process table is hidden from this session.', currentCommand());
  let lsofText = lsofFile ? fs.readFileSync(lsofFile, 'utf8') : '';
  if (!lsofFile && !psFile) {
    const pids = findExtensions(app).flatMap((extension) => extensionProcesses(parsePs(psText), extension)).map((item) => item.pid);
    if (pids.length) lsofText = runTool('lsof', ['-a', '-p', pids.join(','), '-d', 'txt', '-Fpn']);
  }
  probe({ app, installedAt, psText, lsofText, tz, report });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
