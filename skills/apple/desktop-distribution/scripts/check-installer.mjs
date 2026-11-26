/**
 * desktop-distribution static check of a shell installer for a Mac app (the script people run with curl ... | bash).
 * It reads the script as text and runs nothing.
 *
 *   node check-installer.mjs <install script> [more scripts]
 *
 * Errors: DD-INSTALL-01, a download over plain http or with certificate checks turned off, or a download whose
 * SHA-256 is never computed and compared; DD-INSTALL-02, no `codesign --verify --deep --strict` of the unpacked app
 * before it replaces the installed copy; DD-INSTALL-03, the installed app removed or copied over in place instead of
 * staged with ditto and swapped in with two renames. Warnings: DD-WARN-XATTR, quarantine removed with an xattr that
 * PATH picks, or before the checksum and signature checks; DD-WARN-REGISTER, no LaunchServices registration after the
 * swap (and, for an app with extensions, no pluginkit -a). The destination is a literal /Applications/... .app path or
 * a variable assigned one. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY =
  'Proof boundary: a static read of the installer text; it does not run the script, download anything, follow functions it sources from elsewhere, ' +
  'or prove that the published checksum matches the published archive.';

const CHECKSUM = /\b(?:shasum\s+(?:-[a-z]*\s+)*-a\s*256|sha256sum|openssl\s+(?:dgst\s+-sha256|sha256))\b/;

/** Logical lines of a shell script: comments removed, backslash continuations joined, first line number kept. */
export function shellLines(text) {
  const out = [];
  let pending = null;
  String(text).split(/\r?\n/).forEach((raw, index) => {
    const line = stripComment(raw);
    if (pending) {
      pending.text += ` ${line.trim()}`;
    } else {
      pending = { number: index + 1, text: line };
    }
    if (/\\\s*$/.test(pending.text)) pending.text = pending.text.replace(/\\\s*$/, '').trimEnd();
    else {
      if (pending.text.trim()) out.push({ number: pending.number, text: pending.text.trim() });
      pending = null;
    }
  });
  if (pending?.text.trim()) out.push({ number: pending.number, text: pending.text.trim() });
  return out;
}

export function stripComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === '\\' && quote === '"') index += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '#' && (index === 0 || /\s/.test(line[index - 1])) && !(index === 0 && line.startsWith('#!'))) return line.slice(0, index);
    else if (index === 0 && line.startsWith('#!')) return '';
  }
  return line;
}

/** Variables whose value names an app under an Applications folder, and the literal paths themselves. */
export function destinations(lines) {
  const names = new Set();
  for (const { text } of lines) {
    const match = text.match(/^(?:export\s+|local\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.+)$/);
    if (match && /Applications\/[^\s"']*\.app\b/.test(match[2])) names.add(match[1]);
  }
  for (const { text } of lines) {
    const match = text.match(/^(?:export\s+|local\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)=["']?\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?["']?$/);
    if (match && names.has(match[2])) names.add(match[1]);
  }
  return names;
}

const words = (text) => (text.match(/"[^"]*"|'[^']*'|[^\s;|&]+/g) ?? []).map((word) => word.replace(/^["']|["']$/g, ''));

export function isDestination(word, names) {
  if (/Applications\/[^\s]*\.app\/?$/.test(word) && !/\$\{?[A-Za-z_]/.test(word.replace(/\$\{?HOME\}?/, ''))) return true;
  const variable = word.match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?\/?$/);
  return Boolean(variable && names.has(variable[1]));
}

/** Commands of one logical line, split on ;, &&, || and pipes, each as its word list. */
const PREFIXES = new Set(['sudo', 'command', 'exec', 'then', 'else', 'do', 'if', 'elif', 'while', 'until', '!', '{', '(']);
const commands = (text) =>
  text
    .split(/\s*(?:;|&&|\|\||\|)\s*/)
    .map(words)
    .map((list) => {
      let start = 0;
      while (start < list.length && PREFIXES.has(list[start])) start += 1;
      return list.slice(start);
    })
    .filter((list) => list.length);

/** Values of plain assignments, for resolving a download URL held in a variable. */
export function assignments(lines) {
  const values = new Map();
  for (const { text } of lines) {
    const match = text.match(/^(?:export\s+|local\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)=["']?([^"'\s]*)["']?$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export function checkInstaller(text, file, report) {
  const lines = shellLines(text);
  const names = destinations(lines);
  const values = assignments(lines);
  const where = (line) => `${file}:${line.number}`;
  const steps = lines.flatMap((line) => commands(line.text).map((argv) => ({ line, argv })));

  const downloads = steps.filter(({ argv }) => ['curl', 'wget'].includes(path.posix.basename(argv[0])));
  if (!downloads.length) report.skip('DD-INSTALL-01', file, 'the script downloads nothing with curl or wget');
  for (const { line, argv } of downloads) {
    const resolve = (word) => word.replace(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/, (all, name) => values.get(name) ?? all);
    const plain = argv.map(resolve).find((word) => /^http:\/\//.test(word));
    const insecure = argv.some((word) => ['-k', '--insecure', '--no-check-certificate'].includes(word) || /^-[A-Za-z]*k[A-Za-z]*$/.test(word) && argv[0] === 'curl' && !word.startsWith('--'));
    if (plain) report.error('DD-INSTALL-01', where(line), `downloads ${plain} over plain http`, 'https only');
    else if (insecure) report.error('DD-INSTALL-01', where(line), 'turns certificate checks off', 'https with certificate checks');
  }
  if (downloads.length) {
    const sums = lines.filter((line) => CHECKSUM.test(line.text));
    const compared = sums.some((line) => /\s(?:-c|--check|--status)\b/.test(line.text)) || (sums.length > 0 && lines.some((line) => /\[\[?\s.*(?:!=|==|\s=\s)/.test(line.text) && /\$\{?[A-Za-z_]/.test(line.text) && line.number >= sums[0].number));
    if (!sums.length) report.error('DD-INSTALL-01', file, 'no SHA-256 of the download is computed', 'shasum -a 256 (or sha256sum) compared with the published checksum before anything is unpacked');
    else if (!compared) report.error('DD-INSTALL-01', where(sums[0]), 'a SHA-256 is computed but never compared', 'a comparison with the published checksum that stops the script on a mismatch');
    else report.pass('DD-INSTALL-01', where(sums[0]), 'https download with its SHA-256 compared', 'https and a checked SHA-256');
  }

  const intoDest = steps.filter(({ argv }) => argv[0] === 'mv' && argv.length >= 3 && isDestination(argv.at(-1), names) && !isDestination(argv[argv.length - 2], names));
  const aside = steps.filter(({ argv }) => argv[0] === 'mv' && argv.length >= 3 && argv.slice(1, -1).some((word) => isDestination(word, names)));
  const swapLine = intoDest.length ? intoDest[0].line.number : Infinity;

  const signsOrShows = (argv) => argv.some((word) => ['-d', '--display', '-s', '--sign'].includes(word));
  const verifies = steps.filter(({ argv }) => path.posix.basename(argv[0]) === 'codesign' && !signsOrShows(argv) && (argv.includes('--verify') || argv.some((word) => /^-[A-Za-z]*v[A-Za-z]*$/.test(word))));
  const strict = verifies.filter(({ argv }) => argv.includes('--deep') && argv.includes('--strict'));
  if (!verifies.length) report.error('DD-INSTALL-02', file, 'the unpacked app is never verified with codesign', 'codesign --verify --deep --strict on the staged copy before the swap');
  else if (!strict.length) report.error('DD-INSTALL-02', where(verifies[0].line), `codesign verifies without ${['--deep', '--strict'].filter((flag) => !verifies[0].argv.includes(flag)).join(' and ')}`, 'codesign --verify --deep --strict');
  else if (strict[0].line.number > swapLine) report.error('DD-INSTALL-02', where(strict[0].line), 'the signature is verified only after the app was moved into place', 'verification of the staged copy before the swap');
  else report.pass('DD-INSTALL-02', where(strict[0].line), 'codesign --verify --deep --strict before the swap', 'verified before the swap');

  const removed = steps.filter(({ argv, line }) => argv[0] === 'rm' && argv.some((word) => /^-[A-Za-z]*[rR]/.test(word)) && argv.slice(1).some((word) => isDestination(word, names)) && line.number < swapLine);
  const copied = steps.filter(({ argv }) => ['cp', 'rsync', 'ditto'].includes(argv[0]) && argv.length >= 3 && isDestination(argv.at(-1), names));
  const staged = steps.filter(({ argv }) => argv[0] === 'ditto' && !isDestination(argv.at(-1), names));
  const problems = [];
  if (copied.length) problems.push([copied[0].line, `${copied[0].argv[0]} writes straight into the installed app`]);
  if (removed.length) problems.push([removed[0].line, 'the installed app is deleted before the new copy is in place']);
  if (!staged.length) problems.push([null, 'no ditto staging copy']);
  if (!intoDest.length) problems.push([null, 'no rename of the staged copy into place']);
  else if (!aside.some(({ line }) => line.number <= swapLine)) problems.push([intoDest[0].line, 'the installed app is not renamed aside before the staged copy is renamed into place']);
  if (!names.size && !lines.some((line) => /Applications\/[^\s"']*\.app/.test(line.text))) report.skip('DD-INSTALL-03', file, 'no destination under an Applications folder was found');
  else if (problems.length) for (const [line, problem] of problems) report.error('DD-INSTALL-03', line ? where(line) : file, problem, 'stage with ditto beside the destination, rename the old app aside, rename the staged app into place, then remove the old one');
  else report.pass('DD-INSTALL-03', where(intoDest[0].line), 'ditto staging and a two-rename swap', 'staged copy, two renames');

  const quarantine = lines.filter((line) => /xattr\b/.test(line.text) && /com\.apple\.quarantine/.test(line.text));
  for (const line of quarantine) {
    const tool = commands(line.text).find((argv) => /xattr$/.test(argv[0]))?.[0] ?? 'xattr';
    const firstCheck = Math.min(...[...strict.map((step) => step.line.number)], Infinity);
    if (tool !== '/usr/bin/xattr') report.warn('DD-WARN-XATTR', where(line), `runs ${tool}, which PATH may resolve to another xattr`, '/usr/bin/xattr by its full path');
    else if (line.number < firstCheck) report.warn('DD-WARN-XATTR', where(line), 'removes quarantine before the signature is verified', 'remove quarantine only from the copy that passed the checksum and the signature check');
    else report.pass('DD-WARN-XATTR', where(line), '/usr/bin/xattr after the checks', '/usr/bin/xattr on the verified copy');
  }
  const registered = lines.some((line) => /lsregister\b/i.test(line.text) && /\s-f\b/.test(line.text));
  const plugins = lines.some((line) => /\bpluginkit\b/.test(line.text) && /\s-a\b/.test(line.text));
  report.check('DD-WARN-REGISTER', registered, file, registered ? `lsregister -f${plugins ? ' and pluginkit -a' : ''} after the swap` : 'no lsregister -f after the swap', 'lsregister -f on the installed app, and pluginkit -a for its extensions', 'warn');
}

async function main() {
  const files = dropProject(process.argv.slice(2));
  if (!files.length || files.some((file) => file.startsWith('--'))) throw new UsageError('Usage: node check-installer.mjs <install script> [more scripts]');
  const report = createReport({ tool: 'check-installer', boundary: BOUNDARY });
  for (const file of files) {
    if (!fs.existsSync(file)) throw new UsageError(`Not found: ${file}`);
    checkInstaller(fs.readFileSync(file, 'utf8'), path.basename(file), report);
  }
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
