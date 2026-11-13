/**
 * menubar-widgets stale extension probe, read-only: finds the app extensions inside an installed app, lists their
 * running processes with ps and lsof, and reports any that started before the bundle was installed or run an
 * executable outside it. It never stops a process; it prints the commands to run.
 *
 *   node probe-extension.mjs --app <path to the installed .app> [--installed <date and time>] [--ps <file>] [--lsof <file>]
 *
 * --ps and --lsof read recorded output of `ps -axww -o pid=,lstart=,args=` and `lsof -a -p <pids> -d txt -Fpn` instead
 * of running them, so the probe can judge a report from another machine. Without them it runs both, on macOS only;
 * elsewhere it reports the rule as skipped. Error: MW-STALE-01. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReport, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';

export const BOUNDARY = 'Proof boundary: process start times from ps (whole seconds) and executable mappings from lsof at one moment; it does not prove which process WidgetKit asks for timelines or what the placed widget draws. Look at the widget after the fix.';
const START_TOLERANCE_MS = 1000;
const LSTART = /^\s*(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/;

const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

export function plistString(text, key) {
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(text);
  return match ? match[1] : null;
}

function readPlist(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 6).toString('latin1') !== 'bplist') return bytes.toString('utf8');
  const result = spawnSync('plutil', ['-convert', 'xml1', '-o', '-', file], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new UsageError(`Cannot read the binary property list ${file}; plutil is needed on macOS.`);
  return result.stdout;
}

export function findExtensions(app) {
  const folder = path.join(app, 'Contents', 'PlugIns');
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter((name) => name.endsWith('.appex')).sort().map((name) => {
    const appex = path.join(folder, name);
    const info = path.join(appex, 'Contents', 'Info.plist');
    const executable = fs.existsSync(info) ? plistString(readPlist(info), 'CFBundleExecutable') : null;
    return { name, appex, executable: executable ?? name.replace(/\.appex$/, ''), binary: path.join(appex, 'Contents', 'MacOS', executable ?? name.replace(/\.appex$/, '')) };
  });
}

export function parsePs(text) {
  return String(text).split(/\r?\n/).map((line) => LSTART.exec(line)).filter(Boolean).map((match) => ({ pid: Number(match[1]), started: new Date(match[2]), lstart: match[2].replace(/\s+/g, ' '), args: match[3] }));
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

export function extensionProcesses(processes, executable) {
  const tail = `/Contents/MacOS/${executable}`;
  return processes.filter((process) => {
    const index = process.args.indexOf(`.appex${tail}`);
    if (index < 0) return false;
    const rest = process.args.slice(index + `.appex${tail}`.length);
    return rest === '' || rest.startsWith(' ');
  });
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

export function judge({ extension, process, mapping, installed }) {
  const runs = (mapping ?? []).find((file) => file.endsWith(`/Contents/MacOS/${extension.executable}`)) ?? null;
  const early = process.started.getTime() < installed.getTime() - START_TOLERANCE_MS;
  const outside = runs !== null && !samePath(runs, extension.binary);
  const reasons = [];
  if (early) reasons.push(`started ${process.lstart}, before the bundle was installed (${installed.toString()})`);
  if (outside) reasons.push(`runs ${runs}, outside the installed app`);
  return { stale: early || outside, reasons, runs };
}

export function fixCommands(extension, pids) {
  return `stop the stale process and re-register the extension: kill ${pids.join(' ')}; pluginkit -a ${quote(extension.appex)}; then call WidgetCenter.shared.reloadAllTimelines() from the app (better: do all three at app launch)`;
}

function runTool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new UsageError(`${command} is not on PATH.`);
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

export function probe({ app, installedAt, psText, lsofText, report }) {
  const extensions = findExtensions(app);
  if (!extensions.length) throw new UsageError(`No app extension in ${path.join(app, 'Contents', 'PlugIns')}.`);
  const processes = parsePs(psText);
  const mapping = parseLsof(lsofText ?? '');
  for (const extension of extensions) {
    const binary = fs.statSync(extension.binary, { throwIfNoEntry: false });
    const installed = installedAt ?? (binary ? binary.mtime : fs.statSync(extension.appex).mtime);
    const running = extensionProcesses(processes, extension.executable);
    if (!running.length) {
      report.skip('MW-STALE-01', extension.name, 'no process of this extension is running; place its widget and run the probe again');
      continue;
    }
    for (const process of running) {
      const verdict = judge({ extension, process, mapping: mapping.get(process.pid), installed });
      const where = `${extension.name} pid ${process.pid}`;
      if (verdict.stale) report.error('MW-STALE-01', where, verdict.reasons.join('; '), fixCommands(extension, [process.pid]));
      else report.pass('MW-STALE-01', where, verdict.runs ? `started ${process.lstart} and runs the installed copy` : `started ${process.lstart}, after the install; lsof gave no mapping`, 'started after the install and runs the installed copy');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const app = option(args, '--app');
  if (!app) throw new UsageError('Usage: node probe-extension.mjs --app <path to the installed .app> [--installed <date and time>] [--ps <file>] [--lsof <file>]');
  if (!fs.existsSync(app)) throw new UsageError(`Not found: ${app}`);
  const installedOption = option(args, '--installed');
  const installedAt = installedOption ? new Date(installedOption) : null;
  if (installedAt && Number.isNaN(installedAt.getTime())) throw new UsageError(`Cannot read --installed ${installedOption}.`);
  const psFile = option(args, '--ps');
  const lsofFile = option(args, '--lsof');
  const report = createReport({ tool: 'probe-extension', boundary: BOUNDARY });
  if (!psFile && process.platform !== 'darwin') {
    report.skip('MW-STALE-01', app, `this probe reads macOS processes and this is ${process.platform}; record ps and lsof on the Mac and pass --ps and --lsof`);
    return report.summary();
  }
  const psText = psFile ? fs.readFileSync(psFile, 'utf8') : runTool('ps', ['-axww', '-o', 'pid=,lstart=,args=']);
  if (!psFile && !parsePs(psText).length) throw new SandboxError('Blocked: ps listed no process at all, so the process table is hidden from this session.', currentCommand());
  let lsofText = lsofFile ? fs.readFileSync(lsofFile, 'utf8') : '';
  if (!lsofFile) {
    const pids = findExtensions(app).flatMap((extension) => extensionProcesses(parsePs(psText), extension.executable)).map((item) => item.pid);
    if (pids.length) lsofText = runTool('lsof', ['-a', '-p', pids.join(','), '-d', 'txt', '-Fpn']);
  }
  probe({ app: path.resolve(app), installedAt, psText, lsofText, report });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
