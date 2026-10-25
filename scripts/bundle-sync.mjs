#!/usr/bin/env node
/**
 * Keeps the bundled skills in step with vendor/bundles.json. A bundle is a whole skill that another repository of the
 * owner releases; it is copied byte for byte from the commit of its release tag into skills/<name>/, with the
 * repository's licence as LICENSE.
 *
 *   sync [--only <name>]                  network: fetch each pinned commit, prove the tag points at it, copy the skill
 *   check                                 offline: every bundled skill matches its record, file for file
 *   update [--only <name>] [--report <file>]
 *                                         network: move each bundle to its repository's latest release, then sync it;
 *                                         the report says which bundles moved
 *
 * Every command takes --root <dir>. Git runs through execFile, never a shell. Sync refuses symlinks, submodules, unsafe
 * names, git metadata, metadata.json, folders agents treat specially, a second visible SKILL.md, and any image, font,
 * media file or archive except the images BUNDLED_MEDIA allows; it writes into a staging folder and swaps it into
 * place only when every file passed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  GIT_METADATA_NAMES,
  LICENSE_NAMES,
  MEDIA_EXTENSIONS,
  ROOT,
  SKILLS_DIR,
  compareStrings,
  copyrightLines,
  formatJson,
  hasSafeNames,
  isMainModule,
  parseFrontmatter,
  pathProblem,
  readJson,
  unsafeFolder,
  writeRegular,
  sha256,
} from './lib/vendor.mjs';
import { BUNDLED_MEDIA, BUNDLES_FILE, BUNDLE_LICENCE, bundleDir, loadBundles, validateBundles, verifyBundle } from './lib/bundles.mjs';

const execFileAsync = promisify(execFile);
const RESERVED_SEGMENTS = new Set(['.claude-plugin', '.codex-plugin', '.claude', '.agents', '.codex', '.git', '.vendor']);
const OBJECT_PATTERN = /^[0-9a-f]{40,64}$/;
const TAG_URL = /\/releases\/tag\/(v\d+\.\d+\.\d+)$/;
const USAGE = 'Usage: node scripts/bundle-sync.mjs <sync [--only <name>] | check | update [--only <name>] [--report <file>]> [--root <dir>]';

async function git(args, { buffer = false } = {}) {
  const { stdout } = await execFileAsync('git', args, {
    encoding: buffer ? 'buffer' : 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

/**
 * The commit a release tag points at on GitHub, peeled through an annotated tag.
 */
export async function tagCommit(repo, tag) {
  const listing = await git(['ls-remote', '--tags', `https://github.com/${repo}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  const lines = listing.split('\n').filter(Boolean).map((line) => line.split('\t'));
  const peeled = lines.find(([, ref]) => ref === `refs/tags/${tag}^{}`) ?? lines.find(([, ref]) => ref === `refs/tags/${tag}`);
  if (!peeled) throw new Error(`${repo}: has no tag ${tag}`);
  return peeled[0];
}

/**
 * The tag of a repository's latest GitHub release, read from the redirect of /releases/latest.
 */
export async function latestTag(repo) {
  const response = await fetch(`https://github.com/${repo}/releases/latest`, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';
  const match = TAG_URL.exec(location);
  if (!match) throw new Error(`${repo}: /releases/latest did not redirect to a vX.Y.Z release (status ${response.status})`);
  return match[1];
}

async function fetchCommit(dir, repo, commit) {
  await git(['init', '--quiet', dir]);
  await git(['-C', dir, '-c', 'protocol.version=2', 'fetch', '--quiet', '--depth=1', '--no-tags', `https://github.com/${repo}.git`, commit]);
  const listing = await git(['-C', dir, 'ls-tree', '-r', '-z', '--full-tree', commit]);
  return listing.split('\0').filter(Boolean).map((record) => {
    const tab = record.indexOf('\t');
    const [mode, type, object] = record.slice(0, tab).split(' ');
    return { mode, type, object, path: record.slice(tab + 1) };
  });
}

async function readBlob(dir, object) {
  if (!OBJECT_PATTERN.test(object)) throw new Error(`unexpected git object id ${object}`);
  return git(['-C', dir, 'cat-file', 'blob', object], { buffer: true });
}

/**
 * Why one upstream file of a bundle cannot be copied as it is, or null when it can.
 */
export function bundleFileProblem(name, relative, mode) {
  const problem = pathProblem(relative);
  if (problem) return `path ${problem}`;
  const segments = relative.split('/');
  const base = segments.at(-1);
  if (!hasSafeNames(relative)) return 'name uses characters other than letters, digits, ".", "_" and "-"';
  if (mode === '120000') return 'is a symlink';
  if (mode === '160000') return 'is a submodule';
  if (mode !== '100644' && mode !== '100755') return `unsupported file mode ${mode}`;
  if (segments.slice(0, -1).some((segment) => RESERVED_SEGMENTS.has(segment))) return 'sits in a folder that agents or plugins treat specially';
  if (GIT_METADATA_NAMES.has(base)) return 'is git metadata';
  if (base === 'metadata.json') return 'installers drop files named metadata.json';
  if (relative === BUNDLE_LICENCE) return 'collides with the LICENSE that sync writes';
  if (base === 'SKILL.md' && relative !== 'SKILL.md' && !segments.slice(0, -1).some((segment) => segment.startsWith('.'))) return 'is a second visible SKILL.md, which hosts would register as a skill';
  const extension = path.posix.extname(base).toLowerCase();
  if (MEDIA_EXTENSIONS.has(extension)) {
    const rule = BUNDLED_MEDIA.get(name);
    if (!rule || !relative.startsWith(rule.folder) || !rule.extensions.has(extension)) return 'is an image, media, font or archive file outside the media the bundle rules allow';
  }
  return null;
}

/**
 * The files of one bundle at its pinned commit, read into memory, with the licence and every problem found.
 */
async function readBundle(bundle) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-sync-'));
  try {
    const entries = await fetchCommit(dir, bundle.repo, bundle.commit);
    const prefix = `${bundle.path}/`;
    const problems = [];
    const files = [];
    for (const entry of entries.filter((item) => item.path.startsWith(prefix))) {
      const relative = entry.path.slice(prefix.length);
      const problem = bundleFileProblem(bundle.name, relative, entry.mode);
      if (problem) {
        problems.push(`${bundle.path}/${relative}: ${problem}`);
        continue;
      }
      files.push({ path: relative, executable: entry.mode === '100755', bytes: await readBlob(dir, entry.object) });
    }
    const licence = entries.find((item) => LICENSE_NAMES.includes(item.path) && item.type === 'blob');
    if (!licence) problems.push('the repository has no LICENSE, LICENSE.md, LICENSE.txt or COPYING at its root');
    const licenceBytes = licence ? await readBlob(dir, licence.object) : null;
    const skill = files.find((file) => file.path === 'SKILL.md');
    const name = skill ? parseFrontmatter(skill.bytes.toString('utf8'))?.name : null;
    if (!skill) problems.push(`${bundle.path}/SKILL.md: is missing`);
    else if (name !== bundle.name) problems.push(`${bundle.path}/SKILL.md: frontmatter name ${JSON.stringify(name ?? null)} must be ${bundle.name}`);
    files.sort((a, b) => compareStrings(a.path, b.path));
    return { files, licence, licenceBytes, problems };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeBundle(root, bundle, files, licenceBytes) {
  const folder = bundleDir(bundle.name);
  const unsafe = unsafeFolder(root, folder);
  if (unsafe) throw new Error(`${unsafe}; refusing to write`);
  const skills = path.join(root, SKILLS_DIR);
  const staging = path.join(skills, `.bundle-sync-${process.pid}`);
  const target = path.join(root, ...folder.split('/'));
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const file of files) {
      const destination = path.join(staging, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      writeRegular(destination, file.bytes);
      fs.chmodSync(destination, file.executable ? 0o755 : 0o644);
    }
    writeRegular(path.join(staging, BUNDLE_LICENCE), licenceBytes);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function writeManifest(root, manifest) {
  const problems = validateBundles(manifest);
  if (problems.length) throw new Error(`refusing to write an invalid ${BUNDLES_FILE}:\n- ${problems.join('\n- ')}`);
  writeRegular(path.join(root, ...BUNDLES_FILE.split('/')), formatJson(manifest));
}

/**
 * Fetch one bundle at its pin, prove its tag points at that commit, copy it into place and record its files.
 */
export async function syncBundle(root, bundle) {
  const tagged = await tagCommit(bundle.repo, bundle.tag);
  if (tagged !== bundle.commit) throw new Error(`${bundle.name}: ${bundle.repo} tag ${bundle.tag} points at ${tagged}, not the pinned ${bundle.commit}`);
  const { files, licence, licenceBytes, problems } = await readBundle(bundle);
  if (problems.length) throw new Error(`${bundle.name} cannot be bundled:\n- ${problems.join('\n- ')}`);
  writeBundle(root, bundle, files, licenceBytes);
  const licenceText = licenceBytes.toString('utf8');
  const record = {
    ...bundle,
    license: { file: licence.path, sha256: sha256(licenceBytes), copyright: copyrightLines(licenceText).join('; ') },
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.bytes), bytes: file.bytes.length, executable: file.executable })),
  };
  const after = verifyBundle(root, record);
  if (after.length) throw new Error(`${bundle.name} did not verify after the copy:\n- ${after.join('\n- ')}`);
  return record;
}

function rawManifest(root) {
  const data = readJson(root, BUNDLES_FILE);
  if (!Array.isArray(data?.bundles)) throw new Error(`${BUNDLES_FILE}: bundles must be an array`);
  return data;
}

function selected(manifest, only) {
  const chosen = manifest.bundles.filter((bundle) => !only || bundle.name === only);
  if (only && !chosen.length) throw new Error(`${BUNDLES_FILE} has no bundle named ${only}`);
  return chosen;
}

/**
 * Sync every bundle, or only one, and rewrite the manifest with the recorded files.
 */
export async function sync(root = ROOT, { only = null } = {}) {
  const manifest = rawManifest(root);
  const results = [];
  for (const bundle of selected(manifest, only)) {
    const record = await syncBundle(root, bundle);
    manifest.bundles[manifest.bundles.indexOf(bundle)] = record;
    results.push({ name: record.name, tag: record.tag, files: record.files.length, bytes: record.files.reduce((sum, file) => sum + file.bytes, 0) });
  }
  writeManifest(root, manifest);
  return results;
}

/**
 * Move every bundle, or only one, to its repository's latest release and sync the ones that moved.
 */
export async function update(root = ROOT, { only = null, latest = latestTag, commitOf = tagCommit } = {}) {
  const manifest = rawManifest(root);
  const moved = [];
  for (const bundle of selected(manifest, only)) {
    const tag = await latest(bundle.repo);
    if (tag === bundle.tag) continue;
    const next = { ...bundle, tag, commit: await commitOf(bundle.repo, tag) };
    manifest.bundles[manifest.bundles.indexOf(bundle)] = await syncBundle(root, next);
    moved.push({ name: bundle.name, repo: bundle.repo, from: bundle.tag, to: tag });
  }
  if (moved.length) writeManifest(root, manifest);
  return { changed: moved.length > 0, bundles: moved };
}

/**
 * Offline check of every bundled skill against vendor/bundles.json.
 */
export function check(root = ROOT) {
  const manifest = loadBundles(root);
  const problems = manifest.bundles.flatMap((bundle) => verifyBundle(root, bundle));
  return { ok: problems.length === 0, problems, bundles: manifest.bundles.length, files: manifest.bundles.reduce((sum, bundle) => sum + bundle.files.length + 1, 0) };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['sync', 'check', 'update'].includes(command)) throw new Error(USAGE);
  const options = { command, root: ROOT, only: null, report: null };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    const allowed = { '--root': true, '--only': command !== 'check', '--report': command === 'update' };
    if (!allowed[flag]) throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === '--root') options.root = path.resolve(value);
    else if (flag === '--only') options.only = value;
    else options.report = path.resolve(value);
    index += 1;
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  const out = (line) => process.stdout.write(`${line}\n`);
  if (options.command === 'check') {
    const result = check(options.root);
    for (const problem of result.problems) process.stderr.write(`[bundle] ${problem}\n`);
    if (result.ok) out(`Bundle check passed (${result.bundles} bundles, ${result.files} files).`);
    else {
      process.stderr.write(`Bundle check failed with ${result.problems.length} problem(s).\n`);
      process.exitCode = 1;
    }
    return;
  }
  if (options.command === 'sync') {
    for (const item of await sync(options.root, { only: options.only })) out(`Synced ${item.name} ${item.tag}: ${item.files} files, ${item.bytes} bytes.`);
    return;
  }
  const report = await update(options.root, { only: options.only });
  if (options.report) writeRegular(options.report, formatJson(report));
  if (!report.changed) out('Every bundle is at its latest release.');
  for (const item of report.bundles) out(`Moved ${item.name} from ${item.from} to ${item.to}.`);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${String(error.stderr ?? '').trim() || error.message}\n`);
    process.exitCode = 1;
  });
}
