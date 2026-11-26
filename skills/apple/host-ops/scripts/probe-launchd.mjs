/**
 * host-ops launchd probe, read-only: runs launchctl print for one job, or reads a recorded copy of its output, and
 * reports whether launchd has the job in the domain named, loaded from the property list on disk, with the program and
 * arguments that file holds now, and whether its last run exited 0. It never loads, unloads, starts or stops a job; it
 * prints the commands to run.
 *
 *   node probe-launchd.mjs --label <label> [--domain gui/<uid>|user/<uid>|system] [--plist <file>] [--print <file> [--exit <code>]]
 *
 * --domain defaults to gui/<the current uid>. --plist compares the loaded path, program and arguments with that file,
 * which catches an edited file that was never reloaded. --print reads recorded output of
 * `launchctl print <domain>/<label>` instead of running it, so a report from another Mac can be judged; --exit gives
 * that run's exit code. Without --print the probe runs launchctl on macOS only; elsewhere it reports the rule as
 * skipped. Error: HO-LAUNCHD-01. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReport, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';
import { parsePlist, PlistError } from './check-plist.mjs';

export const BOUNDARY = 'Proof boundary: what launchctl print said at one moment about one job in one domain; a job that is loaded and exited 0 once can still fail on its next trigger, and a state of not running between StartInterval runs is normal. Prove a job by forcing each branch it has and reading the output and timestamps it writes.';
const NOT_FOUND = /Could not find service|Bad request|No such process/i;
const DOMAIN = /^(?:gui|user)\/\d+$|^system$/;

/** The fields of `launchctl print` this probe reads: path, program, arguments, state and the last exit code. */
export function parsePrint(text) {
  const lines = String(text).split(/\r?\n/);
  const field = (name) => {
    const line = lines.find((item) => new RegExp(`^\\t${name} = `).test(item));
    return line ? line.slice(line.indexOf('=') + 1).trim() : null;
  };
  const argsStart = lines.findIndex((line) => /^\targuments = \{\s*$/.test(line));
  let args = null;
  if (argsStart >= 0) {
    args = [];
    for (let index = argsStart + 1; index < lines.length && !/^\t\}\s*$/.test(lines[index]); index += 1) args.push(lines[index].trim());
  }
  const exit = field('last exit code');
  return { path: field('path'), program: field('program'), arguments: args, state: field('state'), lastExit: exit, notFound: NOT_FOUND.test(text) && !field('path') };
}

const shellQuote = (value) => (/^[\w./:=@%+,-]+$/.test(value) ? value : `'${String(value).replace(/'/g, "'\\''")}'`);

export function reloadCommands(domain, label, plist) {
  const file = plist ? shellQuote(plist) : '<path to the .plist>';
  return `launchctl bootout ${domain}/${label}; launchctl bootstrap ${domain} ${file}; launchctl print ${domain}/${label}`;
}

export function judge({ label, domain, plistFile, plist, print, exitCode }, report) {
  const rule = 'HO-LAUNCHD-01';
  const where = `${domain}/${label}`;
  const parsed = parsePrint(print);
  if (parsed.notFound || exitCode === 113) {
    const other = domain === 'system' ? `gui/<uid>/${label}` : `system/${label}`;
    report.error(rule, where, `launchd has no job ${label} in ${domain}`, `bootstrap it: launchctl bootstrap ${domain} ${plistFile ? shellQuote(plistFile) : '<path to the .plist>'}; a LaunchDaemon lives in system, which launchctl list as a user does not show (try launchctl print ${other})`);
    return;
  }
  if (!parsed.path && !parsed.program && !parsed.arguments) {
    report.error(rule, where, 'the launchctl print output has no path, program or arguments', 'the full output of launchctl print <domain>/<label>');
    return;
  }
  report.pass(rule, where, `loaded from ${parsed.path ?? 'an unknown file'}, state ${parsed.state ?? 'unknown'}`, `loaded in ${domain}`);
  if (plist) {
    if (parsed.path && path.resolve(parsed.path) !== path.resolve(plistFile)) report.error(rule, where, `loaded from ${parsed.path}, not from ${plistFile}`, `the job loaded from the file you edited: ${reloadCommands(domain, label, plistFile)}`);
    const wantArgs = Array.isArray(plist.ProgramArguments) ? plist.ProgramArguments : typeof plist.Program === 'string' ? [plist.Program] : [];
    const wantProgram = typeof plist.Program === 'string' ? plist.Program : wantArgs[0];
    const programDiffers = parsed.program && wantProgram && parsed.program !== wantProgram;
    const argsDiffer = parsed.arguments && Array.isArray(plist.ProgramArguments) && JSON.stringify(parsed.arguments) !== JSON.stringify(wantArgs);
    if (programDiffers || argsDiffer) {
      report.error(rule, where, `launchd runs ${[parsed.program, ...(parsed.arguments ?? []).slice(1)].filter(Boolean).join(' ')} but the file now says ${wantArgs.join(' ')}`, `launchd keeps the copy it loaded until the job is booted out and bootstrapped again: ${reloadCommands(domain, label, plistFile)}`);
    } else report.pass(rule, where, 'the loaded program and arguments match the file', 'the loaded copy equals the file on disk');
  }
  const exit = parsed.lastExit;
  if (exit === null || /never exited/i.test(exit)) report.pass(rule, where, `last exit code: ${exit ?? 'not shown'}`, 'no failed run');
  else if (/^0$/.test(exit)) report.pass(rule, where, 'last exit code 0', 'exit 0');
  else report.error(rule, where, `last exit code ${exit}`, 'a last run that exited 0; read the job\'s StandardErrorPath file or /usr/bin/log show --predicate \'process == "<program name>"\' --last 1h for the cause');
}

export function readOptions(args) {
  const options = { label: null, domain: null, plistFile: null, printFile: null, exitCode: null };
  const value = (index, name) => {
    const item = args[index + 1];
    if (!item || item.startsWith('--')) throw new UsageError(`${name} needs a value.`);
    return item;
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--label') options.label = value(index, arg);
    else if (arg === '--domain') options.domain = value(index, arg);
    else if (arg === '--plist') options.plistFile = value(index, arg);
    else if (arg === '--print') options.printFile = value(index, arg);
    else if (arg === '--exit') options.exitCode = Number(value(index, arg));
    else if (arg === '--project') value(index, arg);
    else throw new UsageError(`Unknown option ${arg}.`);
    index += 1;
  }
  if (!options.label) throw new UsageError('Usage: node probe-launchd.mjs --label <label> [--domain gui/<uid>|user/<uid>|system] [--plist <file>] [--print <file> [--exit <code>]]');
  if (options.domain && !DOMAIN.test(options.domain)) throw new UsageError(`--domain ${options.domain} is not gui/<uid>, user/<uid> or system.`);
  if (options.exitCode !== null && (!Number.isInteger(options.exitCode) || !options.printFile)) throw new UsageError('--exit needs an integer and --print.');
  return options;
}

function readJobFile(file) {
  if (!file) return null;
  if (!fs.existsSync(file)) throw new UsageError(`Not found: ${file}`);
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8).toString('latin1') === 'bplist00') throw new UsageError(`${file} is a binary property list.`, 'Pass an XML copy: plutil -convert xml1 -o job.xml.plist <file>.');
  try {
    return parsePlist(bytes.toString('utf8'));
  } catch (error) {
    if (error instanceof PlistError) throw new UsageError(`${file} does not parse: ${error.message}. Run check-plist.mjs on it first.`);
    throw error;
  }
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const report = createReport({ tool: 'probe-launchd', boundary: BOUNDARY });
  const plist = readJobFile(options.plistFile);
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const domain = options.domain ?? (uid === null ? 'gui/$(id -u)' : `gui/${uid}`);
  let print;
  let exitCode = options.exitCode;
  if (options.printFile) print = fs.readFileSync(options.printFile, 'utf8');
  else if (process.platform !== 'darwin') {
    report.skip('HO-LAUNCHD-01', `${domain}/${options.label}`, `launchctl runs on macOS only and this is ${process.platform}; on the Mac run launchctl print ${domain}/${options.label} > print.txt 2>&1 and pass --print print.txt --exit $?`);
    return report.summary();
  } else {
    const result = spawnSync('launchctl', ['print', `${domain}/${options.label}`], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') throw new UsageError('launchctl is not on PATH.', `It ships with macOS in /bin. Run again with PATH=/usr/bin:/bin:/usr/sbin:/sbin ${currentCommand()}`);
    if (['EPERM', 'EACCES'].includes(result.error?.code) || (/Operation not permitted/i.test(result.stderr ?? '') && !result.stdout)) throw new SandboxError('Blocked: launchctl could not read launchd.', currentCommand());
    print = `${result.stdout}${result.stderr}`;
    exitCode = result.status;
  }
  judge({ label: options.label, domain, plistFile: options.plistFile, plist, print, exitCode }, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
