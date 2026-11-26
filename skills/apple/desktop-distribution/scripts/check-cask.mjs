/**
 * desktop-distribution static check of a Homebrew cask (a Ruby file in a tap). It reads the cask as text, runs no
 * Ruby and no brew, and is no replacement for `brew style --cask` and `brew audit --cask`.
 *
 *   node check-cask.mjs [--self-updating] <cask.rb> [more casks]
 *
 * Errors: DD-CASK-01, a Ruby flight block (preflight, postflight, uninstall_preflight, uninstall_postflight with
 * do ... end) where the current cask style wants its declarative install-step stanzas; DD-CASK-02, an uninstall stanza
 * that removes login items or files under ~/Library, which brew upgrade also runs, instead of leaving them to zap;
 * DD-CASK-03, with --self-updating (the app updates itself), no auto_updates true. Warning: DD-WARN-CASKSHA, sha256
 * :no_check, version :latest or a plain http url. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY =
  "Proof boundary: a static read of the cask text against the stanzas this part knows; it does not run Homebrew's style check or audit, " +
  'install the cask, or prove what brew upgrade does on a given Homebrew version.';

export const FLIGHT_BLOCK = /^\s*(preflight|postflight|uninstall_preflight|uninstall_postflight)\s+do\b/;

/** Ruby text with comments blanked, strings kept, line lengths kept. */
export function stripRubyComments(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => {
      let quote = null;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (quote) {
          if (char === '\\') index += 1;
          else if (char === quote) quote = null;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === '#') return line.slice(0, index);
      }
      return line;
    })
    .join('\n');
}

/** Each top-level call of `name` with its argument text, which may span lines until its brackets close. */
export function stanzas(text, name) {
  const lines = text.split('\n');
  const found = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!new RegExp(`^\\s*${name}(?:\\s|\\(|$)`).test(lines[index])) continue;
    let body = lines[index];
    let depth = 0;
    let end = index;
    const balance = (line) => {
      for (const char of line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '')) {
        if ('([{'.includes(char)) depth += 1;
        else if (')]}'.includes(char)) depth -= 1;
      }
    };
    balance(lines[index]);
    while ((depth > 0 || /,\s*$/.test(lines[end])) && end + 1 < lines.length) {
      end += 1;
      body += `\n${lines[end]}`;
      balance(lines[end]);
    }
    found.push({ line: index + 1, body });
  }
  return found;
}

const USER_FILES = /(?:~\/Library|#\{Dir\.home\}\/Library|\$HOME\/Library|ENV\["HOME"\][^,\]]*Library)/;

export function checkCask(source, file, { selfUpdating = false } = {}, report) {
  const text = stripRubyComments(source);
  if (!/^\s*cask\s+["']/m.test(text)) throw new UsageError(`${file} is not a cask: no cask "<token>" do line.`);
  const where = (line) => `${file}:${line}`;
  const blocks = text.split('\n').map((line, index) => ({ line: index + 1, match: line.match(FLIGHT_BLOCK) })).filter((item) => item.match);
  for (const block of blocks) report.error('DD-CASK-01', where(block.line), `a ${block.match[1]} do ... end Ruby block`, `the declarative ${block.match[1]}_steps stanza; confirm the name with brew style --cask on this Homebrew`);
  if (!blocks.length) report.pass('DD-CASK-01', file, 'no Ruby flight blocks', 'declarative stanzas only');

  const uninstalls = stanzas(text, 'uninstall');
  let clean = true;
  for (const { line, body } of uninstalls) {
    if (/\blogin_item:/.test(body)) {
      clean = false;
      report.error('DD-CASK-02', where(line), 'uninstall removes a login item, and brew upgrade runs uninstall too', 'login_item in zap');
    }
    for (const key of ['delete', 'trash', 'rmdir']) {
      const match = body.match(new RegExp(`\\b${key}:\\s*(\\[[^\\]]*\\]|"[^"]*"|'[^']*')`));
      if (match && USER_FILES.test(match[1])) {
        clean = false;
        report.error('DD-CASK-02', where(line), `uninstall ${key}s the user's files under ~/Library, which brew upgrade also runs`, `${key} of user files in zap`);
      }
    }
  }
  if (clean) report.pass('DD-CASK-02', file, uninstalls.length ? 'uninstall touches no login item and no user files' : 'no uninstall stanza', 'login items and user files only in zap');

  const autoUpdates = /^\s*auto_updates\s+true\b/m.test(text);
  if (selfUpdating) report.check('DD-CASK-03', autoUpdates, file, autoUpdates ? 'auto_updates true' : 'no auto_updates true for an app that updates itself', 'auto_updates true, with version and sha256 bumped for every release');
  else report.skip('DD-CASK-03', file, autoUpdates ? 'auto_updates true is set; pass --self-updating to check it as required' : 'pass --self-updating when the app updates itself');

  const loose = [];
  if (/^\s*sha256\s+:no_check\b/m.test(text)) loose.push('sha256 :no_check');
  if (/^\s*version\s+:latest\b/m.test(text)) loose.push('version :latest');
  if (/^\s*url\s+["']http:\/\//m.test(text)) loose.push('a plain http url');
  report.check('DD-WARN-CASKSHA', !loose.length, file, loose.length ? loose.join(', ') : 'a pinned version, an https url and a sha256', 'a pinned version, an https url and the sha256 of the release archive', 'warn');
}

export function parseArgs(argv) {
  const args = dropProject(argv);
  const selfUpdating = args.includes('--self-updating');
  const files = args.filter((arg) => arg !== '--self-updating');
  if (!files.length || files.some((file) => file.startsWith('--'))) throw new UsageError('Usage: node check-cask.mjs [--self-updating] <cask.rb> [more casks]');
  for (const file of files) if (!fs.existsSync(file)) throw new UsageError(`Not found: ${file}`);
  return { selfUpdating, files };
}

async function main() {
  const { selfUpdating, files } = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'check-cask', boundary: BOUNDARY });
  for (const file of files) checkCask(fs.readFileSync(file, 'utf8'), path.basename(file), { selfUpdating }, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
