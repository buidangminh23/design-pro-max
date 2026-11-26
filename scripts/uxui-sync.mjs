#!/usr/bin/env node
/**
 * Keeps skills/uxui-prompt/data/ in step with vendor/uxui-prompt.json. The data is the English catalog, tokens and
 * elements of Seokwoooo/lucian-uxui-prompt (MIT), copied byte for byte from one pinned commit.
 *
 *   sync                      network: fetch the pinned commit and copy api/v1/index.json and api/v1/en/ into data/
 *   check                     offline: every data file matches its record, and no file is missing or extra
 *   update [--report <file>]  network: move the pin to the repository's default branch head, then sync
 *
 * Every command takes --root <dir>. Git runs through execFile, never a shell, with core.autocrlf off so the bytes are
 * the repository's own. Sync writes into a staging folder and swaps it into place only when every file passed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, compareStrings, formatJson, isMainModule, readJson, sha256, walk, writeRegular } from './lib/vendor.mjs';

const execFileAsync = promisify(execFile);
export const UXUI_FILE = 'vendor/uxui-prompt.json';
export const UXUI_SKILL = 'skills/uxui-prompt';
export const UXUI_DATA = `${UXUI_SKILL}/data`;
const COPIED = [/^api\/v1\/index\.json$/, /^api\/v1\/en\/(?:catalog\.tsv|tokens\.css|e\/\d{3,6}\.txt)$/];
const COMMIT = /^[0-9a-f]{40}$/;
const USAGE = 'Usage: node scripts/uxui-sync.mjs <sync | check | update [--report <file>]> [--root <dir>]';

export function loadUxui(root = ROOT) {
  const data = readJson(root, UXUI_FILE);
  const problems = [];
  if (data?.schema !== 1) problems.push('schema must be 1');
  if (data?.repo !== 'Seokwoooo/lucian-uxui-prompt') problems.push('repo must be Seokwoooo/lucian-uxui-prompt');
  if (!COMMIT.test(data?.commit ?? '')) problems.push('commit must be a 40-character SHA');
  if (!Array.isArray(data?.files) || !data.files.length) problems.push('files must be a non-empty list');
  else for (const file of data.files) if (!COPIED.some((pattern) => pattern.test(file.path)) || !/^[0-9a-f]{64}$/.test(file.sha256)) problems.push(`bad file record ${file.path}`);
  if (problems.length) throw new Error(`${UXUI_FILE}: ${problems.join('; ')}`);
  return data;
}

export function checkUxui(root = ROOT) {
  const record = loadUxui(root);
  const problems = [];
  const base = path.join(root, ...UXUI_DATA.split('/'));
  const expected = new Map(record.files.map((file) => [file.path, file]));
  const present = fs.existsSync(base) ? walk(base).filter((entry) => entry.kind !== 'dir') : [];
  for (const entry of present) {
    if (entry.kind !== 'file') problems.push(`${UXUI_DATA}/${entry.path}: only regular files are allowed`);
    else if (!expected.has(entry.path)) problems.push(`${UXUI_DATA}/${entry.path}: not recorded in ${UXUI_FILE}`);
  }
  for (const file of record.files) {
    const target = path.join(base, ...file.path.split('/'));
    if (!fs.existsSync(target)) { problems.push(`${UXUI_DATA}/${file.path}: missing`); continue; }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) problems.push(`${UXUI_DATA}/${file.path}: bytes differ from the record`);
  }
  return problems;
}

async function git(args, cwd) {
  const { stdout } = await execFileAsync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout.trim();
}

async function fetchTree(repo, commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxui-sync-'));
  await git(['init', '-q'], dir);
  await git(['remote', 'add', 'origin', `https://github.com/${repo}.git`], dir);
  await git(['fetch', '-q', '--depth', '1', 'origin', commit], dir);
  await git(['checkout', '-q', 'FETCH_HEAD'], dir);
  if ((await git(['rev-parse', 'HEAD'], dir)) !== commit) throw new Error(`fetched tree is not ${commit}`);
  return dir;
}

async function headCommit(repo) {
  const out = await git(['ls-remote', `https://github.com/${repo}.git`, 'HEAD'], process.cwd());
  const commit = out.split(/\s+/)[0];
  if (!COMMIT.test(commit)) throw new Error(`cannot read HEAD of ${repo}`);
  return commit;
}

export async function syncUxui(root = ROOT, commit) {
  const record = loadUxui(root);
  const pin = commit ?? record.commit;
  const tree = await fetchTree(record.repo, pin);
  try {
    const listed = (await git(['ls-tree', '-r', '--name-only', 'HEAD', 'api/v1'], tree)).split('\n').filter(Boolean);
    const files = listed.filter((name) => COPIED.some((pattern) => pattern.test(name))).sort(compareStrings);
    if (!files.some((name) => name.endsWith('/catalog.tsv'))) throw new Error('the commit has no api/v1/en/catalog.tsv');
    const staging = path.join(root, ...UXUI_SKILL.split('/'), '.data-staging');
    fs.rmSync(staging, { recursive: true, force: true });
    const records = [];
    for (const name of files) {
      const source = path.join(tree, ...name.split('/'));
      if (!fs.lstatSync(source).isFile()) throw new Error(`${name} is not a regular file`);
      const bytes = fs.readFileSync(source);
      const relative = name.slice('api/v1/'.length);
      const target = path.join(staging, 'api', 'v1', ...relative.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeRegular(target, bytes);
      records.push({ path: `api/v1/${relative}`, sha256: sha256(bytes), bytes: bytes.length });
    }
    const target = path.join(root, ...UXUI_DATA.split('/'));
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
    const moved = pin !== record.commit;
    writeRegular(path.join(root, ...UXUI_FILE.split('/')), formatJson({ ...record, commit: pin, files: records }));
    return { moved, from: record.commit, to: pin, count: records.length };
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
  }
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const [, value] = args.splice(at, 2);
    if (!value) throw new Error(USAGE);
    return value;
  };
  const root = path.resolve(take('--root') ?? ROOT);
  const report = take('--report');
  const [command, ...rest] = args;
  if (rest.length) throw new Error(USAGE);
  if (command === 'check') {
    const problems = checkUxui(root);
    for (const problem of problems) console.error(problem);
    if (problems.length) process.exitCode = 1;
    else console.log(`uxui-prompt data matches ${UXUI_FILE} (${loadUxui(root).files.length} files).`);
    return;
  }
  if (command === 'sync' || command === 'update') {
    const commit = command === 'update' ? await headCommit(loadUxui(root).repo) : undefined;
    const result = await syncUxui(root, commit);
    if (report) fs.writeFileSync(report, formatJson({ changed: result.moved, from: result.from, to: result.to }));
    console.log(`uxui-prompt data at ${result.to.slice(0, 7)} (${result.count} files)${result.moved ? `, moved from ${result.from.slice(0, 7)}` : ''}.`);
    return;
  }
  throw new Error(USAGE);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
