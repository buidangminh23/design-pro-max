#!/usr/bin/env node
/**
 * Fails when any commit reachable from HEAD adds an image, font, media file or archive that is not a reviewed file
 * with its reviewed bytes, or any file inside a vendored part's assets/ or agents/ folder. The whole history counts,
 * because a file that was ever pushed can come back through a revert, an old tag or a fork.
 *
 *   node scripts/check-history.mjs [--root <dir>] [--rev <revision>]
 *
 * Files are recognised by extension and by their first bytes, so an image saved under a text name is caught too.
 * The reviewed list is REVIEWED_MEDIA in scripts/lib/media.mjs. A shallow clone fails, since its older commits
 * cannot be read.
 */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, isMainModule } from './lib/vendor.mjs';
import { isReviewedMedia, mediaKind } from './lib/media.mjs';
import { visiblePath } from './vendor-guard.mjs';

const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'];
const VENDORED_EXTRA = /^skills\/[^/]+\/\.vendor\/(?:[^/]+\/)*?(assets|agents)\//;
const RAW_LINE = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/;
const NO_OBJECT = /^0+$/;
const GITLINK = '160000';
const USAGE = 'Usage: node scripts/check-history.mjs [--root <dir>] [--rev <revision>]';

function gitIn(root) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of GIT_ENV_KEYS) delete env[key];
  return (args, input) => execFileSync('git', ['-C', root, ...args], { env, input, maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}

/**
 * Every file version that a commit reachable from `rev` adds or changes, as { commit, path, mode, object }, plus the
 * number of commits. Merge commits are compared with each parent, so a file that only a merge brings in is listed.
 */
export function historyEntries(root = ROOT, rev = 'HEAD') {
  const git = gitIn(root);
  const output = git(['-c', 'log.showRoot=true', '-c', 'log.showSignature=false', 'log', '--no-color', '-m', '--no-renames', '--raw', '--no-abbrev', '-z', '--format=commit %H', rev, '--']).toString('utf8');
  const tokens = output.split('\0');
  const commits = new Set();
  const entries = [];
  let commit = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = /^\n+(?:commit |:)/.test(tokens[index]) ? tokens[index].replace(/^\n+/, '') : tokens[index];
    if (!token) continue;
    if (token.startsWith('commit ')) {
      commit = token.slice('commit '.length);
      commits.add(commit);
      continue;
    }
    const raw = RAW_LINE.exec(token);
    if (!raw || index + 1 >= tokens.length) throw new Error(`unexpected git log output near ${JSON.stringify(token.slice(0, 80))}`);
    index += 1;
    const [, , mode, , object, status] = raw;
    if (status === 'D' || NO_OBJECT.test(object)) continue;
    entries.push({ commit, path: tokens[index], mode, object });
  }
  return { commits: commits.size, entries };
}

/**
 * The bytes of every blob in `objects`, read with one git cat-file --batch call.
 */
export function readBlobs(root, objects) {
  const blobs = new Map();
  if (!objects.length) return blobs;
  const output = gitIn(root)(['cat-file', '--batch'], `${objects.join('\n')}\n`);
  let offset = 0;
  for (const object of objects) {
    const newline = output.indexOf(0x0a, offset);
    const [name, type, size] = output.toString('utf8', offset, newline).split(' ');
    if (name !== object || type !== 'blob' || !/^\d+$/.test(size ?? '')) throw new Error(`git cat-file could not read ${object} as a blob`);
    const start = newline + 1;
    blobs.set(object, output.subarray(start, start + Number(size)));
    offset = start + Number(size) + 1;
  }
  return blobs;
}

/**
 * Check every file version in the history of `rev`. Returns { ok, problems, stats }.
 */
export function checkHistory(root = ROOT, rev = 'HEAD') {
  const git = gitIn(root);
  if (git(['rev-parse', '--is-shallow-repository']).toString('utf8').trim() === 'true') {
    return { ok: false, problems: ['the clone is shallow, so older commits cannot be checked; fetch the full history (actions/checkout with fetch-depth: 0)'], stats: { commits: 0, files: 0, reviewed: 0 } };
  }
  try {
    git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]);
  } catch {
    throw new Error(`${rev} does not name a commit`);
  }
  const { commits, entries } = historyEntries(root, rev);
  const files = entries.filter((entry) => entry.mode !== GITLINK);
  const blobs = readBlobs(root, [...new Set(files.map((entry) => entry.object))]);
  const problems = [];
  const seen = new Set();
  let reviewed = 0;
  for (const entry of files) {
    const key = `${entry.path}\0${entry.object}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const where = `${entry.commit.slice(0, 12)} ${visiblePath(entry.path)}`;
    const extra = VENDORED_EXTRA.exec(entry.path);
    if (extra) problems.push(`${where}: sits in a vendored part's ${extra[1]}/ folder; exclude ${extra[1]}/** in vendor/sources.json`);
    const bytes = blobs.get(entry.object);
    const kind = mediaKind(entry.path, bytes);
    if (!kind) continue;
    if (isReviewedMedia(entry.path, bytes)) reviewed += 1;
    else problems.push(`${where}: ${kind} not on the reviewed list in scripts/lib/media.mjs`);
  }
  return { ok: problems.length === 0, problems, stats: { commits, files: seen.size, reviewed } };
}

function parseArgs(argv) {
  const options = { root: ROOT, rev: 'HEAD' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== '--root' && flag !== '--rev') throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === '--root') options.root = path.resolve(value);
    else options.rev = value;
    index += 1;
  }
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  const report = checkHistory(options.root, options.rev);
  const summary = `${report.stats.commits} commits, ${report.stats.files} file versions, ${report.stats.reviewed} reviewed media file(s)`;
  if (report.ok) {
    process.stdout.write(`History check passed (${summary}).\n`);
    return;
  }
  for (const problem of report.problems) process.stderr.write(`[history] ${problem}\n`);
  process.stderr.write(`History check failed with ${report.problems.length} problem(s) (${summary}).\n`);
  process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${String(error.stderr ?? '').trim() || error.message}\n`);
    process.exitCode = 1;
  }
}
