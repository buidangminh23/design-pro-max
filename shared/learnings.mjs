/**
 * Opt-in field learnings for the own parts: appends one dated entry to a journal inside the user's project, checks a
 * journal's entries, and reports whether learnings are on. Learnings are off until the journal exists; this script
 * creates it only with `--create`, which an agent passes after the user asked for it. It writes nothing else, never
 * outside the project, never into the installed skill, and refuses entries that carry secrets, emails, absolute paths,
 * IP addresses or this machine's host or user name.
 *
 *   node learnings.mjs status --project <dir> [--journal <relative path>]
 *   node learnings.mjs append --project <dir> --part <part> --verdict covered|gap|refinement
 *        --read <text> --change <text> --lesson <text> [--evidence <text>] [--date YYYY-MM-DD] [--journal <path>] [--create]
 *   node learnings.mjs check  --project <dir> [--journal <relative path>]
 *
 * Exit codes follow report.mjs: 0 done, 1 refused or an invalid entry, 2 bad usage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT, UsageError, isMain, runMain } from './report.mjs';

export const DEFAULT_JOURNAL = 'APPLE-LEARNINGS.md';
export const HEADER = '# Apple field learnings';
export const VERDICTS = Object.freeze(['covered', 'gap', 'refinement']);
export const FIELDS = Object.freeze([
  ['read', 'Read', true],
  ['change', 'Changed', true],
  ['lesson', 'Learned', true],
  ['evidence', 'Evidence', false],
]);
export const MAX_FIELD = 600;

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function ownParts(skillRoot = SKILL_ROOT) {
  return fs
    .readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillRoot, entry.name, 'PART.md')))
    .map((entry) => entry.name)
    .sort();
}

const PRIVATE_PATTERNS = [
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an API token', /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,})/],
  ['a secret assignment', /\b(?:password|passwd|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*\S+/i],
  ['an email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['an absolute path', /(?:^|[\s"'`(=])(?:\/(?:Users|home|Volumes|private|var|tmp|opt|etc)\/|~\/|[A-Za-z]:[\\/])/],
  ['an IP address', /\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)(?:\d{1,3}\.){3}\d{1,3}\b/],
  ['a local host name', /\b[A-Za-z0-9-]+\.local\b/],
];

function machineTerms() {
  const terms = [];
  try {
    terms.push(os.hostname().split('.')[0]);
  } catch {}
  try {
    terms.push(os.userInfo().username);
  } catch {}
  return terms.filter((term) => term && term.length >= 3);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reasons an entry text would leak something private; empty when it is clean. */
export function privacyProblems(text, terms = machineTerms()) {
  const problems = [];
  for (const [label, pattern] of PRIVATE_PATTERNS) if (pattern.test(text)) problems.push(`names ${label}`);
  for (const term of terms) if (new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(term)}(?:[^A-Za-z0-9]|$)`, 'i').test(text)) problems.push('names this machine or its user');
  return [...new Set(problems)];
}

const today = () => new Date().toISOString().slice(0, 10);

/** Validates entry fields and returns the problems; empty when the entry may be written. */
export function entryProblems(entry, { parts = ownParts(), terms } = {}) {
  const problems = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '')) problems.push('date must be YYYY-MM-DD');
  if (!parts.includes(entry.part)) problems.push(`part must be one of: ${parts.join(', ')}`);
  if (!VERDICTS.includes(entry.verdict)) problems.push(`verdict must be one of: ${VERDICTS.join(', ')}`);
  for (const [key, label, required] of FIELDS) {
    const value = entry[key];
    if (value === undefined || value === null || value === '') {
      if (required) problems.push(`${label} is required`);
      continue;
    }
    if (/[\r\n]/.test(value)) problems.push(`${label} must be one line`);
    if (value.length > MAX_FIELD) problems.push(`${label} is ${value.length} characters, at most ${MAX_FIELD}`);
    if (value.trim().startsWith('#')) problems.push(`${label} must not start a heading`);
    for (const problem of privacyProblems(value, terms)) problems.push(`${label} ${problem}`);
  }
  return problems;
}

export function formatEntry(entry) {
  const lines = [`## ${entry.date} · ${entry.part} · ${entry.verdict}`, ''];
  for (const [key, label] of FIELDS) if (entry[key]) lines.push(`- ${label}: ${entry[key].trim()}`);
  return `${lines.join('\n')}\n`;
}

/** Splits a journal into entries; malformed headings come back as problems. */
export function parseJournal(text) {
  const problems = [];
  const entries = [];
  const normalized = String(text).replace(/\r\n/g, '\n');
  if (!normalized.startsWith(`${HEADER}\n`) && normalized !== HEADER) problems.push(`the first line must be "${HEADER}"`);
  let current = null;
  for (const [index, line] of normalized.split('\n').entries()) {
    if (line.startsWith('## ')) {
      const match = line.match(/^## (\S+) · (\S+) · (\S+)$/);
      if (!match) {
        problems.push(`line ${index + 1}: an entry heading reads "## YYYY-MM-DD · <part> · <verdict>"`);
        current = null;
        continue;
      }
      current = { line: index + 1, date: match[1], part: match[2], verdict: match[3] };
      entries.push(current);
    } else if (current && line.startsWith('- ')) {
      const field = FIELDS.find(([, label]) => line.startsWith(`- ${label}: `));
      if (field) current[field[0]] = line.slice(`- ${field[1]}: `.length);
      else problems.push(`line ${index + 1}: unknown field`);
    }
  }
  return { entries, problems };
}

/** Resolves the journal inside the project or throws; never follows a symlink out of it. */
export function resolveJournal(project, journal = DEFAULT_JOURNAL, skillRoot = SKILL_ROOT) {
  if (!project) throw new UsageError('--project is required.', 'Pass the user project folder.');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new UsageError(`--project ${project} is not a folder.`);
  if (path.isAbsolute(journal) || /^[A-Za-z]:/.test(journal)) throw new UsageError('--journal must be a path relative to the project.');
  const root = fs.realpathSync.native(project);
  const skill = fs.realpathSync.native(skillRoot);
  const inside = (child, parent) => {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };
  if (inside(root, skill) || inside(skill, root)) throw new UsageError('The project must not be the installed skill or contain it; learnings belong to the user project.');
  const target = path.resolve(root, journal);
  if (!inside(target, root) || target === root) throw new UsageError('--journal must stay inside the project.');
  if (!target.endsWith('.md')) throw new UsageError('--journal must be a .md file.');
  const parent = path.dirname(target);
  if (fs.existsSync(parent) && !inside(fs.realpathSync.native(parent), root)) throw new UsageError('--journal must stay inside the project.');
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new UsageError('--journal must not be a symlink.');
  return target;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  const flags = new Set(['create']);
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) throw new UsageError(`Unexpected argument ${arg}.`);
    const name = arg.slice(2);
    if (flags.has(name)) {
      options[name] = true;
      continue;
    }
    if (index + 1 >= rest.length) throw new UsageError(`${arg} needs a value.`);
    options[name] = rest[(index += 1)];
  }
  return options;
}

const known = { status: ['project', 'journal'], check: ['project', 'journal'], append: ['project', 'journal', 'part', 'verdict', 'read', 'change', 'lesson', 'evidence', 'date', 'create'] };

export function main(argv = process.argv.slice(2), write = (line) => process.stdout.write(`${line}\n`)) {
  const options = parseArgs(argv);
  if (!known[options.command]) throw new UsageError('Usage: learnings.mjs status|append|check --project <dir> [...]', 'See the comment at the top of learnings.mjs.');
  for (const key of Object.keys(options)) if (key !== 'command' && !known[options.command].includes(key)) throw new UsageError(`--${key} is not an option of ${options.command}.`);
  const journal = resolveJournal(options.project, options.journal);
  const relative = path.relative(fs.realpathSync.native(options.project), journal).split(path.sep).join('/');
  const exists = fs.existsSync(journal);

  if (options.command === 'status') {
    const entries = exists ? parseJournal(fs.readFileSync(journal, 'utf8')).entries.length : 0;
    write(JSON.stringify({ learnings: exists ? 'on' : 'off', journal: relative, entries }));
    return EXIT.pass;
  }

  if (options.command === 'check') {
    if (!exists) {
      write(JSON.stringify({ learnings: 'off', journal: relative, problems: [] }));
      return EXIT.pass;
    }
    const { entries, problems } = parseJournal(fs.readFileSync(journal, 'utf8'));
    const parts = ownParts();
    for (const entry of entries) for (const problem of entryProblems(entry, { parts })) problems.push(`line ${entry.line}: ${problem}`);
    write(JSON.stringify({ learnings: 'on', journal: relative, entries: entries.length, problems }));
    return problems.length ? EXIT.fail : EXIT.pass;
  }

  if (!exists && !options.create) {
    write(JSON.stringify({ learnings: 'off', journal: relative, written: false, reason: 'No journal; learnings are off. Pass --create only after the user asked to record lessons.' }));
    return EXIT.fail;
  }
  if (exists) {
    const { problems } = parseJournal(fs.readFileSync(journal, 'utf8'));
    if (problems.some((problem) => problem.startsWith('the first line'))) {
      write(JSON.stringify({ learnings: 'off', journal: relative, written: false, reason: `The file exists but is not a journal; its first line must be "${HEADER}".` }));
      return EXIT.fail;
    }
  }
  const entry = { date: options.date ?? today(), part: options.part, verdict: options.verdict, read: options.read, change: options.change, lesson: options.lesson, evidence: options.evidence };
  const problems = entryProblems(entry);
  if (problems.length) {
    write(JSON.stringify({ learnings: 'on', journal: relative, written: false, problems }));
    return EXIT.fail;
  }
  if (!exists) {
    fs.mkdirSync(path.dirname(journal), { recursive: true });
    fs.writeFileSync(journal, `${HEADER}\n`);
  }
  const current = fs.readFileSync(journal, 'utf8');
  const separator = current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  fs.appendFileSync(journal, `${separator}${formatEntry(entry)}`);
  write(JSON.stringify({ learnings: 'on', journal: relative, written: true, entry: `${entry.date} · ${entry.part} · ${entry.verdict}` }));
  return EXIT.pass;
}

if (isMain(import.meta.url)) runMain(() => main());
