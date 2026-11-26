/**
 * host-ops static scan, read-only: reads shell scripts, AppleScript files and launchd property lists as text and
 * reports the host automation anti-patterns this part has rules for. It never runs what it reads and runs anywhere
 * Node runs.
 *
 *   node scan-host.mjs <file or folder> [...]
 *
 * Shell files are .sh, .bash, .zsh and .command files and files without an extension whose first line is a shell
 * shebang; AppleScript files are .applescript; property lists are .plist files written as XML.
 *
 * Errors: HO-ENV-01, a .env file read as shell code (source or . of a .env file, export $(cat .env), eval of its text);
 * HO-PIPE-01, a pipeline that ends in grep -q while pipefail is on; HO-PRIV-01, an administrator password handled by
 * the script (sudo -S or --stdin, a password in do shell script); HO-OSA-01, tell application followed by a variable
 * or an unquoted name outside a using terms from block; HO-TMP-01, a git worktree or clone made under /tmp or
 * /private/tmp, or a launchd job whose program, arguments or working directory live there. Warnings: HO-WARN-OPENENV,
 * open -a or open -b without env -i; HO-WARN-LOG, log show or stream in a zsh script without /usr/bin/log;
 * HO-WARN-SSH, an ssh remote command in double quotes that expands $ on the local machine. Output follows the shared
 * checker contract; exit 1 only for an error rule. It prints the fix for each finding and changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';

export const BOUNDARY = 'Proof boundary: a static read of the text in the files given, line by line; it does not run the scripts, follow sourced files or variables, expand aliases or see what a job does at run time. Run the job once and read its output and launchctl print to prove behaviour.';

const SKIPPED_FOLDERS = new Set(['.git', 'node_modules', '.build', 'build', 'DerivedData', 'Pods']);
const SHELL_EXTENSIONS = new Set(['.sh', '.bash', '.zsh', '.command']);
const SHEBANG = /^#!\s*(?:\/usr\/bin\/env\s+(?:-\S+\s+)*)?\S*\b(sh|bash|zsh|dash|ksh)\b/;

const SOURCED_ENV = /(?:^|[;&|({]\s*|\s)(?:source|\.)\s+["']?[^\s;&|"']*\.env(?:\.[\w.-]+)?["']?(?=$|[\s;&|)}])/;
const EXPORTED_ENV = /\b(?:export|eval|set\s+--)\s+["']?\$\(\s*(?:cat|grep|sed|awk|xargs|tr|egrep|<)[^)]*\.env\b/;
const QUIET_GREP = /\|\s*(?:command\s+)?e?grep\s+(?:-[A-Za-z]*q[A-Za-z]*|--quiet|--silent)\b/;
const PIPEFAIL_ON = /\bset\s+(?:-[A-Za-z]*o\s+pipefail|-o\s+pipefail|-[A-Za-z]+\s+-o\s+pipefail)\b|\bset\s+-[A-Za-z]*\s+pipefail\b|\bsetopt\s+(?:pipe_?fail)\b/i;
const PIPEFAIL_OFF = /\bset\s+\+o\s+pipefail\b|\bunsetopt\s+pipe_?fail\b/i;
const SUDO_STDIN = /\bsudo\s+(?:-[A-Za-z]+\s+)*(?:-[A-Za-z]*S[A-Za-z]*|--stdin)\b/;
const SCRIPT_PASSWORD = /\bdo\s+shell\s+script\b.*\bpassword\b/;
const TELL_VARIABLE = /\btell\s+(?:application|app)\s+(?!(?:id\s+)?\\?["'])(\(|\$\{?[A-Za-z_]\w*\}?|[A-Za-z_]\w*)/;
const TERMS_START = /\busing\s+terms\s+from\b/;
const TERMS_END = /\bend\s+using\s+terms\s+from\b/;
const TMP_PATH = String.raw`["']?(?:\/private)?\/tmp\/`;
const GIT_IN_TMP = new RegExp(String.raw`\bgit\s+(?:-C\s+\S+\s+)?(?:worktree\s+add|clone)\b.*\s${TMP_PATH}`);
const OPEN_APP = /(?:^|[;&|({]\s*|\s)(?:\/usr\/bin\/)?open\s+(?:-\w+\s+)*-[ab]\s/;
const ENV_CLEAN = /\benv\s+-i\b/;
const LOG_COMMAND = /(?:^|[;&|({]\s*|\s|\$\()log\s+(?:show|stream|collect|stats|erase|config)\b/;
const SSH_LOCAL_EXPANSION = /\bssh\b[^"'\n]*\s"([^"]*\$[({A-Za-z_][^"]*)"/;

export function listFiles(inputs) {
  const files = [];
  const visit = (target, given) => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) throw new UsageError(`Not found: ${target}`);
    if (stat.isFile()) {
      if (given || kindOf(target)) files.push(target);
      return;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && SKIPPED_FOLDERS.has(entry.name)) continue;
      visit(path.join(target, entry.name), false);
    }
  };
  for (const input of inputs) visit(input, true);
  return files.filter((file) => kindOf(file));
}

/** shell, applescript or plist for a file this scan reads; null for any other file. */
export function kindOf(file, text) {
  const extension = path.extname(file).toLowerCase();
  if (SHELL_EXTENSIONS.has(extension)) return 'shell';
  if (extension === '.applescript') return 'applescript';
  if (extension === '.plist') return 'plist';
  if (extension) return null;
  const head = text ?? readHead(file);
  return SHEBANG.test(head.split('\n')[0] ?? '') ? 'shell' : null;
}

function readHead(file) {
  try {
    const handle = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(200);
    const read = fs.readSync(handle, buffer, 0, buffer.length, 0);
    fs.closeSync(handle);
    return buffer.subarray(0, read).toString('utf8');
  } catch {
    return '';
  }
}

export function isZsh(file, text) {
  return path.extname(file).toLowerCase() === '.zsh' || /^#!.*\bzsh\b/.test(text.split('\n')[0] ?? '');
}

/** A shell line without its comment: drops text after a # that starts a word outside quotes. */
export function shellCode(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === '\\' && quote === '"') index += 1;
      else if (char === quote) quote = null;
    } else if (char === '\\') index += 1;
    else if (char === '"' || char === "'") quote = char;
    else if (char === '#' && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index);
  }
  return line;
}

/** AppleScript lines without comments: --, # and nested (* *) blocks. */
export function appleScriptLines(text) {
  const lines = [];
  let depth = 0;
  for (const raw of text.split(/\r?\n/)) {
    let out = '';
    let index = 0;
    let quoted = false;
    while (index < raw.length) {
      const two = raw.slice(index, index + 2);
      if (depth) {
        if (two === '(*') depth += 1;
        if (two === '*)') depth -= 1;
        index += two === '(*' || two === '*)' ? 2 : 1;
        continue;
      }
      if (quoted) {
        if (raw[index] === '\\') {
          out += raw.slice(index, index + 2);
          index += 2;
          continue;
        }
        if (raw[index] === '"') quoted = false;
        out += raw[index];
        index += 1;
        continue;
      }
      if (raw[index] === '"') quoted = true;
      else if (two === '(*') {
        depth += 1;
        index += 2;
        continue;
      } else if (two === '--' || raw[index] === '#') break;
      out += raw[index];
      index += 1;
    }
    lines.push(out);
  }
  return lines;
}

function tellFindings(lines, where, report) {
  let terms = 0;
  let found = false;
  lines.forEach((line, index) => {
    if (TERMS_START.test(line) && !TERMS_END.test(line)) terms += 1;
    const match = TELL_VARIABLE.exec(line);
    if (match && !terms) {
      found = true;
      report.error('HO-OSA-01', where(index), `tell application ${match[1]}: the target is a variable or an unquoted name, so AppleScript does not load the app's dictionary at compile time and its terms fail or mean something else`, 'tell application "<literal app name>" (check the name against a list first and interpolate it as a quoted literal), or wrap the block in using terms from application "<name>"');
    }
    if (TERMS_END.test(line)) terms = Math.max(0, terms - 1);
  });
  return found;
}

function scanShell(file, text, where, report) {
  const lines = text.split(/\r?\n/);
  const code = lines.map(shellCode);
  const zsh = isZsh(file, text);
  let pipefail = false;
  const hit = { env: false, pipe: false, priv: false, tmp: false };
  let tells = null;
  code.forEach((line, index) => {
    if (PIPEFAIL_OFF.test(line)) pipefail = false;
    if (PIPEFAIL_ON.test(line)) pipefail = true;
    if (SOURCED_ENV.test(line) || EXPORTED_ENV.test(line)) {
      hit.env = true;
      report.error('HO-ENV-01', where(index), `reads a .env file as shell code: ${line.trim()}`, "never source a .env file: a line with an unbalanced quote, a $( or an & runs as a command and zsh prints the secret value in 'command not found'; read one value with grep -E '^NAME=' .env | cut -d= -f2- and check only its length");
    }
    if (pipefail && QUIET_GREP.test(line)) {
      hit.pipe = true;
      report.error('HO-PIPE-01', where(index), `grep -q ends a pipeline while pipefail is on: ${line.trim()}`, 'grep -q exits at the first match, the command before it can die of SIGPIPE, and pipefail then reports the pipeline as failed although it matched; capture the output first (out=$(cmd); case "$out" in *pattern*) ...) or use grep pattern >/dev/null');
    }
    if (SUDO_STDIN.test(line)) {
      hit.priv = true;
      report.error('HO-PRIV-01', where(index), `feeds a password to sudo on standard input: ${line.trim()}`, "the agent never sees or stores an administrator password: run the command with osascript -e 'do shell script \"<command>\" with administrator privileges' so macOS asks the user, or give the user the sudo command to run");
    }
    if (SCRIPT_PASSWORD.test(line)) {
      hit.priv = true;
      report.error('HO-PRIV-01', where(index), 'do shell script carries a password', 'drop the user name and password clauses and keep with administrator privileges, so macOS shows its own authentication dialog');
    }
    if (GIT_IN_TMP.test(line)) {
      hit.tmp = true;
      report.error('HO-TMP-01', where(index), `makes a git checkout under /tmp: ${line.trim()}`, 'macOS removes old files under /private/tmp on its own schedule and on restart; keep worktrees, clones and deploy folders under the home folder or another kept volume');
    }
    if (OPEN_APP.test(line) && !ENV_CLEAN.test(line)) {
      report.warn('HO-WARN-OPENENV', where(index), `open passes this shell's environment, tokens included, to the app: ${line.trim()}`, 'env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" SHELL="$SHELL" TMPDIR="$TMPDIR" PATH=/usr/bin:/bin:/usr/sbin:/sbin open -a <App>');
    }
    if (zsh && LOG_COMMAND.test(line) && !/\/usr\/bin\/log\s/.test(line)) {
      report.warn('HO-WARN-LOG', where(index), `in zsh, log is a builtin that lists logins, not the unified log: ${line.trim()}`, '/usr/bin/log show or /usr/bin/log stream');
    }
    const ssh = SSH_LOCAL_EXPANSION.exec(line);
    if (ssh) {
      report.warn('HO-WARN-SSH', where(index), `the remote command "${ssh[1]}" is in double quotes, so $ expands on this machine before ssh sends it`, "single quotes, or a here-document with a quoted delimiter: ssh <host> 'zsh -ls' <<'EOF' ... EOF");
    }
  });
  if (code.some((line) => /\btell\s+(?:application|app)\b/.test(line))) tells = tellFindings(code, where, report) ? 'error' : 'clean';
  return { ...hit, tells };
}

/** The strings of a property list's ProgramArguments array, the Program and the WorkingDirectory, with their lines. */
export function plistPaths(text) {
  const found = [];
  const lineOf = (offset) => text.slice(0, offset).split('\n').length - 1;
  for (const key of ['Program', 'WorkingDirectory']) {
    const match = new RegExp(`<key>\\s*${key}\\s*</key>\\s*<string>([^<]*)</string>`).exec(text);
    if (match) found.push({ key, value: match[1].trim(), line: lineOf(match.index) });
  }
  const args = /<key>\s*ProgramArguments\s*<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(text);
  if (args) {
    const start = args.index + args[0].indexOf(args[1]);
    for (const item of args[1].matchAll(/<string>([^<]*)<\/string>/g)) found.push({ key: 'ProgramArguments', value: item[1].trim(), line: lineOf(start + item.index) });
  }
  return found;
}

function scanPlist(text, where, report) {
  let hit = false;
  for (const item of plistPaths(text)) {
    if (/^(?:\/private)?\/tmp\//.test(item.value)) {
      hit = true;
      report.error('HO-TMP-01', where(item.line), `${item.key} ${item.value} lives under /tmp`, 'macOS removes old files under /private/tmp, so the job loses its program or folder later; install the script and its folder under the home folder or /usr/local');
    }
  }
  return { tmp: hit };
}

export function scanFiles(files, report, { label = (file) => file } = {}) {
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const kind = kindOf(file, text);
    const where = (index) => `${label(file)}:${index + 1}`;
    if (kind === 'plist') {
      const hit = scanPlist(text, where, report);
      if (!hit.tmp) report.pass('HO-TMP-01', label(file), 'no program, argument or working directory under /tmp', 'paths outside /tmp');
      continue;
    }
    if (kind === 'applescript') {
      const lines = appleScriptLines(text);
      if (!tellFindings(lines, where, report)) report.pass('HO-OSA-01', label(file), 'every tell application names a quoted literal or sits in a using terms from block', 'literal app names');
      let priv = false;
      lines.forEach((line, index) => {
        if (SCRIPT_PASSWORD.test(line)) {
          priv = true;
          report.error('HO-PRIV-01', where(index), 'do shell script carries a password', 'drop the user name and password clauses and keep with administrator privileges, so macOS shows its own authentication dialog');
        }
      });
      if (!priv) report.pass('HO-PRIV-01', label(file), 'no password in the script', 'macOS asks for the password itself');
      continue;
    }
    const hit = scanShell(file, text, where, report);
    if (!hit.env) report.pass('HO-ENV-01', label(file), 'no .env file read as shell code', 'single values read with grep and cut');
    if (!hit.pipe) report.pass('HO-PIPE-01', label(file), 'no grep -q at the end of a pipeline under pipefail', 'captured output or grep without -q');
    if (!hit.priv) report.pass('HO-PRIV-01', label(file), 'no password fed to sudo or do shell script', 'macOS asks for the password itself');
    if (!hit.tmp) report.pass('HO-TMP-01', label(file), 'no git checkout under /tmp', 'checkouts in a kept folder');
    if (hit.tells === 'clean') report.pass('HO-OSA-01', label(file), 'every tell application names a quoted literal', 'literal app names');
  }
}

export function parseArguments(args) {
  const inputs = [];
  for (const arg of args) {
    if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`);
    inputs.push(arg);
  }
  if (!inputs.length) throw new UsageError('Usage: node scan-host.mjs <file or folder> [...]');
  return { inputs };
}

async function main() {
  const { inputs } = parseArguments(dropProject(process.argv.slice(2)));
  const files = listFiles(inputs);
  if (!files.length) throw new UsageError('No shell script, .applescript or .plist file found.');
  const report = createReport({ tool: 'scan-host', boundary: BOUNDARY });
  scanFiles(files, report, { label: (file) => path.relative(process.cwd(), file) || file });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
