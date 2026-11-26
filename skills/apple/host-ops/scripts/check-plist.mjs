/**
 * host-ops launchd property list check, read-only: lints a LaunchAgent or LaunchDaemon property list and the keys
 * launchd needs to start the job. On macOS it also runs plutil -lint on each file; elsewhere that step is reported as
 * skipped and the structure is read from the XML text. It never loads, unloads or edits a job.
 *
 *   node check-plist.mjs <file.plist or folder> [...]
 *
 * Error: HO-PLIST-01, a file plutil or the XML reader rejects, a root that is not a dictionary, a missing or empty
 * Label, no Program and no ProgramArguments, ProgramArguments that is not a non-empty array of strings, or a program
 * path that is not absolute (launchd searches only its own short PATH). Warnings: HO-PLIST-01 for a file name that is
 * not <Label>.plist; HO-WARN-TCC, a job whose program is a shell or a script interpreter and whose arguments reach a
 * folder macOS protects (an external volume, Desktop, Documents, Downloads, iCloud Drive), since privacy permissions
 * follow the binary launchd starts. A binary property list is converted with plutil on macOS and is a usage error
 * elsewhere. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReport, dropProject, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';

export const BOUNDARY = 'Proof boundary: the property list text and, on macOS, plutil -lint; it does not prove that launchd loaded this copy, that the program exists or runs, or which privacy permissions the program holds. Run probe-launchd.mjs for the loaded job and read the job output after one run.';

const INTERPRETERS = /(?:^|\/)(?:bash|sh|zsh|dash|ksh|env|python\d*(?:\.\d+)?|perl|ruby|osascript)$/;
const PROTECTED = new RegExp(String.raw`(?:^|[\s="'])(?:\/Volumes\/|~?\/?(?:[^\s"']*\/)?(?:Desktop|Documents|Downloads)(?:\/|$)|[^\s"']*Library\/Mobile Documents\/)`);

export class PlistError extends Error {}

/** Parses the XML form of a property list into plain values; dates and data stay strings. */
export function parsePlist(text) {
  const body = text.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[\s\S]*?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const tokens = [...body.matchAll(/<(\/?)([A-Za-z]+)(?:\s[^>]*?)?\s*(\/?)>|([^<]+)/g)];
  let index = 0;
  const next = () => tokens[index++];
  const skipSpace = () => {
    while (index < tokens.length && tokens[index][4] !== undefined && !tokens[index][4].trim()) index += 1;
  };
  const decode = (value) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const readText = (tag) => {
    let value = '';
    while (index < tokens.length && tokens[index][4] !== undefined) value += next()[4];
    const close = next();
    if (!close || close[1] !== '/' || close[2] !== tag) throw new PlistError(`<${tag}> is not closed`);
    return decode(value);
  };
  const readValue = () => {
    skipSpace();
    const token = next();
    if (!token || token[4] !== undefined || token[1] === '/') throw new PlistError('a value is missing');
    const [, , tag, selfClosing] = token;
    if (selfClosing) {
      if (tag === 'true') return true;
      if (tag === 'false') return false;
      if (tag === 'dict') return {};
      if (tag === 'array') return [];
      if (tag === 'string') return '';
      throw new PlistError(`<${tag}/> is not a property list value`);
    }
    if (tag === 'string' || tag === 'date' || tag === 'data') return readText(tag);
    if (tag === 'integer' || tag === 'real') {
      const value = readText(tag).trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new PlistError(`<${tag}>${value}</${tag}> is not a number`);
      return Number(value);
    }
    if (tag === 'true' || tag === 'false') {
      const close = next();
      if (!close || close[1] !== '/' || close[2] !== tag) throw new PlistError(`<${tag}> is not closed`);
      return tag === 'true';
    }
    if (tag === 'array') {
      const items = [];
      for (;;) {
        skipSpace();
        const peek = tokens[index];
        if (!peek) throw new PlistError('<array> is not closed');
        if (peek[1] === '/' && peek[2] === 'array') {
          index += 1;
          return items;
        }
        items.push(readValue());
      }
    }
    if (tag === 'dict') {
      const dict = {};
      for (;;) {
        skipSpace();
        const peek = next();
        if (!peek) throw new PlistError('<dict> is not closed');
        if (peek[1] === '/' && peek[2] === 'dict') return dict;
        if (peek[2] !== 'key' || peek[1] === '/') throw new PlistError(`expected <key> in a dictionary, found <${peek[1]}${peek[2] ?? 'text'}>`);
        const key = readText('key');
        if (Object.hasOwn(dict, key)) throw new PlistError(`the key ${key} appears twice`);
        dict[key] = readValue();
      }
    }
    throw new PlistError(`<${tag}> is not a property list value`);
  };
  skipSpace();
  const open = next();
  if (!open || open[2] !== 'plist' || open[1] === '/') throw new PlistError('no <plist> element');
  const value = readValue();
  skipSpace();
  const close = next();
  if (!close || close[1] !== '/' || close[2] !== 'plist') throw new PlistError('</plist> is missing or text follows the value');
  skipSpace();
  if (index < tokens.length) throw new PlistError('text follows </plist>');
  return value;
}

function runPlutil(args) {
  const result = spawnSync('plutil', args, { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') throw new UsageError('plutil is not on PATH.', `plutil ships with macOS in /usr/bin. Run again with PATH=/usr/bin:/bin:/usr/sbin:/sbin ${currentCommand()}`);
  if (['EPERM', 'EACCES'].includes(result.error?.code)) throw new SandboxError('Blocked: plutil could not run.', currentCommand());
  return result;
}

/** Reads one file: on macOS through plutil -lint and, for a binary list, plutil -convert; elsewhere from its XML. */
export function readPlist(file, platform = process.platform) {
  const bytes = fs.readFileSync(file);
  const binary = bytes.subarray(0, 8).toString('latin1') === 'bplist00';
  let lint = null;
  if (platform === 'darwin') {
    const result = runPlutil(['-lint', file]);
    lint = { ok: result.status === 0, message: `${result.stdout}${result.stderr}`.trim() };
  }
  if (binary) {
    if (platform !== 'darwin') throw new UsageError(`${file} is a binary property list; only plutil can read it.`, 'On the Mac: plutil -convert xml1 -o job.xml.plist <file>, then check that copy.');
    const converted = runPlutil(['-convert', 'xml1', '-o', '-', file]);
    if (converted.status !== 0) return { lint, error: converted.stderr.trim() || 'plutil could not convert the file' };
    return { lint, ...parseSafely(converted.stdout) };
  }
  return { lint, ...parseSafely(bytes.toString('utf8')) };
}

function parseSafely(text) {
  try {
    return { value: parsePlist(text) };
  } catch (error) {
    if (error instanceof PlistError) return { error: error.message };
    throw error;
  }
}

export function listFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const stat = fs.statSync(input, { throwIfNoEntry: false });
    if (!stat) throw new UsageError(`Not found: ${input}`);
    if (stat.isFile()) files.push(input);
    else for (const entry of fs.readdirSync(input).sort()) if (entry.endsWith('.plist')) files.push(path.join(input, entry));
  }
  return files;
}

export function judgeJob(file, read, report, { label = (value) => value } = {}) {
  const where = label(file);
  const rule = 'HO-PLIST-01';
  if (read.lint === null) report.skip(rule, where, 'plutil -lint runs on macOS only; the XML text was read instead');
  else if (!read.lint.ok) report.error(rule, where, `plutil -lint: ${read.lint.message}`, 'a property list plutil -lint accepts');
  if (read.error) {
    report.error(rule, where, `the property list does not parse: ${read.error}`, 'well-formed XML with one <dict> inside <plist>; check it with plutil -lint');
    return;
  }
  const job = read.value;
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    report.error(rule, where, 'the root value is not a dictionary', 'a <dict> with Label and Program or ProgramArguments');
    return;
  }
  const problems = [];
  if (typeof job.Label !== 'string' || !job.Label.trim()) problems.push('Label is missing or empty');
  const args = job.ProgramArguments;
  if (args !== undefined && (!Array.isArray(args) || !args.length || args.some((item) => typeof item !== 'string'))) problems.push('ProgramArguments is not a non-empty array of strings');
  if (job.Program !== undefined && typeof job.Program !== 'string') problems.push('Program is not a string');
  if (job.Program === undefined && args === undefined) problems.push('neither Program nor ProgramArguments is set');
  const program = typeof job.Program === 'string' ? job.Program : Array.isArray(args) && typeof args[0] === 'string' ? args[0] : null;
  if (program !== null && !program.startsWith('/')) problems.push(`the program ${program} is not an absolute path; launchd looks it up only in /usr/bin:/bin:/usr/sbin:/sbin`);
  if (problems.length) {
    report.error(rule, where, problems.join('; '), 'a Label and an absolute Program or ProgramArguments[0], such as /usr/local/bin/node or /bin/zsh');
  } else {
    report.pass(rule, where, `${job.Label} runs ${program}`, 'Label and an absolute program path');
    const base = path.basename(file, '.plist');
    if (base !== job.Label) report.warn(rule, where, `the file is ${path.basename(file)} but the Label is ${job.Label}`, `${job.Label}.plist, so launchctl print and bootout find the job by the name you see`);
  }
  if (program && INTERPRETERS.test(program)) {
    const reached = [job.WorkingDirectory, ...(Array.isArray(args) ? args.slice(1) : [])].filter((item) => typeof item === 'string' && PROTECTED.test(item));
    if (reached.length) report.warn('HO-WARN-TCC', where, `${program} starts a job that reaches ${reached.join(', ')}; macOS asks for and records the privacy permission against ${program} itself`, 'run a dedicated binary that holds the permission, or keep the files outside protected folders; do not grant Full Disk Access to a shell, which would extend it to every script that shell runs');
  }
}

export function parseArguments(args) {
  const inputs = [];
  for (const arg of args) {
    if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`);
    inputs.push(arg);
  }
  if (!inputs.length) throw new UsageError('Usage: node check-plist.mjs <file.plist or folder> [...]');
  return { inputs };
}

async function main() {
  const { inputs } = parseArguments(dropProject(process.argv.slice(2)));
  const files = listFiles(inputs);
  if (!files.length) throw new UsageError('No .plist file found.');
  const report = createReport({ tool: 'check-plist', boundary: BOUNDARY });
  for (const file of files) judgeJob(file, readPlist(file), report, { label: (value) => path.relative(process.cwd(), value) || value });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
