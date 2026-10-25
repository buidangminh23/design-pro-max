/**
 * Bundled skills: whole skills that another repository of the same owner releases, copied byte for byte into
 * skills/<name>/ from the commit of a release tag. vendor/bundles.json pins each one by repository, tag and commit and
 * records every file with its size, hash and executable bit, plus the repository's licence, which sync writes as
 * skills/<name>/LICENSE. The guard, the history check and the release check read this record; only a bundle named in
 * BUNDLED_MEDIA may ship images, and only under its folder there and with the bytes recorded at the same commit.
 */
import path from 'node:path';
import {
  ROOT,
  SKILLS_DIR,
  compareStrings,
  describeEntry,
  isPlainObject,
  isSafeRelativePath,
  readJson,
  readRegular,
  sha256,
  walk,
} from './vendor.mjs';

export const BUNDLES_FILE = 'vendor/bundles.json';
export const BUNDLE_LICENCE = 'LICENSE';
export const BUNDLE_KEYS = ['name', 'repo', 'tag', 'commit', 'path', 'license', 'files'];

/**
 * The bundles that may ship images, by skill name: the folder inside the skill that holds them and the extensions
 * allowed there. Every image must carry the bytes vendor/bundles.json records for it at the same commit.
 */
export const BUNDLED_MEDIA = new Map([
  ['icons-pro-max', { folder: 'assets/', extensions: new Set(['.png', '.svg']) }],
]);

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const bundleDir = (name) => `${SKILLS_DIR}/${name}`;

/**
 * Why one recorded file entry is malformed, or null when it is fine.
 */
function fileRecordProblem(file) {
  if (!isPlainObject(file)) return 'must be an object';
  const keys = Object.keys(file).sort(compareStrings).join(',');
  if (keys !== 'bytes,executable,path,sha256') return 'must have exactly path, sha256, bytes and executable';
  if (!isSafeRelativePath(file.path)) return `path ${JSON.stringify(file.path)} is not a safe relative path`;
  if (!SHA256_PATTERN.test(file.sha256)) return `${file.path}: sha256 must be 64 hex digits`;
  if (!Number.isInteger(file.bytes) || file.bytes < 0) return `${file.path}: bytes must be a whole number`;
  if (typeof file.executable !== 'boolean') return `${file.path}: executable must be true or false`;
  if (file.path === BUNDLE_LICENCE) return `${file.path}: the licence is recorded under license, not files`;
  return null;
}

/**
 * Every problem with the bundle manifest, as sentences. An empty list means it is valid.
 */
export function validateBundles(data) {
  if (!isPlainObject(data)) return ['the bundle manifest must be a JSON object'];
  const problems = [];
  if (data.schema !== 1) problems.push('schema must be 1');
  const unknownTop = Object.keys(data).filter((key) => !['schema', 'bundles'].includes(key));
  if (unknownTop.length) problems.push(`unknown top-level keys: ${unknownTop.join(', ')}`);
  if (!Array.isArray(data.bundles)) return [...problems, 'bundles must be an array'];
  const names = new Set();
  data.bundles.forEach((bundle, index) => {
    const label = typeof bundle?.name === 'string' && bundle.name ? bundle.name : `bundles[${index}]`;
    if (!isPlainObject(bundle)) {
      problems.push(`${label}: must be an object`);
      return;
    }
    const keys = Object.keys(bundle);
    const missing = BUNDLE_KEYS.filter((key) => !keys.includes(key));
    const unknown = keys.filter((key) => !BUNDLE_KEYS.includes(key));
    if (missing.length) problems.push(`${label}: missing ${missing.join(', ')}`);
    if (unknown.length) problems.push(`${label}: unknown keys ${unknown.join(', ')}`);
    if (typeof bundle.name !== 'string' || !NAME_PATTERN.test(bundle.name)) problems.push(`${label}: name must be lowercase words joined by hyphens`);
    else if (names.has(bundle.name)) problems.push(`${label}: duplicate name`);
    else names.add(bundle.name);
    if (bundle.name === 'apple') problems.push(`${label}: apple is the project's own skill and cannot be a bundle`);
    if (typeof bundle.repo !== 'string' || !REPO_PATTERN.test(bundle.repo) || bundle.repo.endsWith('.git')) problems.push(`${label}: repo must be a GitHub owner/name`);
    if (typeof bundle.tag !== 'string' || !TAG_PATTERN.test(bundle.tag)) problems.push(`${label}: tag must be a vX.Y.Z release tag`);
    if (typeof bundle.commit !== 'string' || !COMMIT_PATTERN.test(bundle.commit)) problems.push(`${label}: commit must be a full 40-character SHA`);
    if (!isSafeRelativePath(bundle.path)) problems.push(`${label}: path must be a relative folder without . or .. segments`);
    const licence = bundle.license;
    if (!isPlainObject(licence) || typeof licence.file !== 'string' || !SHA256_PATTERN.test(licence.sha256 ?? '') || typeof licence.copyright !== 'string') {
      problems.push(`${label}: license must record the upstream file, its sha256 and its copyright line`);
    }
    if (!Array.isArray(bundle.files) || !bundle.files.length) {
      problems.push(`${label}: files must be a non-empty list`);
      return;
    }
    const seen = new Set();
    for (const file of bundle.files) {
      const problem = fileRecordProblem(file);
      if (problem) {
        problems.push(`${label}: a file entry ${problem}`);
        continue;
      }
      if (seen.has(file.path.toLowerCase())) problems.push(`${label}: ${file.path} is listed twice or differs from another entry only in case`);
      seen.add(file.path.toLowerCase());
    }
    const sorted = bundle.files.map((file) => file?.path).filter((item) => typeof item === 'string');
    if (JSON.stringify(sorted) !== JSON.stringify([...sorted].sort(compareStrings))) problems.push(`${label}: files must be sorted by path`);
    if (!seen.has('skill.md')) problems.push(`${label}: files must include SKILL.md`);
  });
  return problems;
}

/**
 * Parse and validate a bundle manifest held in memory, throwing one error that lists every problem.
 */
export function parseBundles(text, label = BUNDLES_FILE) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}: is not valid JSON (${error.message})`);
  }
  const problems = validateBundles(data);
  if (problems.length) throw new Error(`${label} is invalid:\n- ${problems.join('\n- ')}`);
  return data;
}

/**
 * The bundle manifest of a checkout, or an empty one when the checkout has none.
 */
export function loadBundles(root = ROOT) {
  if (describeEntry(root, BUNDLES_FILE)?.kind !== 'file') return { schema: 1, bundles: [] };
  const data = readJson(root, BUNDLES_FILE);
  const problems = validateBundles(data);
  if (problems.length) throw new Error(`${BUNDLES_FILE} is invalid:\n- ${problems.join('\n- ')}`);
  return data;
}

/**
 * The skill folders of the bundles, such as skills/icons-pro-max, from a manifest.
 */
export const bundleFolders = (manifest) => manifest.bundles.map((bundle) => bundleDir(bundle.name));

/**
 * True when `file`, a repository path, lies inside a bundled skill of the manifest.
 */
export function inBundle(manifest, file) {
  return manifest.bundles.some((bundle) => file.startsWith(`${bundleDir(bundle.name)}/`));
}

/**
 * True when `file` is an image the bundle rules allow and `bytes` are the bytes the manifest records for it: the
 * bundle is in BUNDLED_MEDIA, the file sits in that bundle's media folder with an allowed extension, and its size and
 * hash match its entry.
 */
export function isBundledMedia(manifest, file, bytes) {
  if (!bytes) return false;
  for (const bundle of manifest.bundles) {
    const prefix = `${bundleDir(bundle.name)}/`;
    if (!file.startsWith(prefix)) continue;
    const rule = BUNDLED_MEDIA.get(bundle.name);
    const inside = file.slice(prefix.length);
    if (!rule || !inside.startsWith(rule.folder) || !rule.extensions.has(path.posix.extname(inside).toLowerCase())) return false;
    const entry = bundle.files.find((item) => item.path === inside);
    return Boolean(entry) && entry.bytes === bytes.length && entry.sha256 === sha256(bytes);
  }
  return false;
}

/**
 * Offline check of one bundled skill on disk against its record: exactly the recorded files plus LICENSE, each with
 * its recorded size and hash, its executable bit when `modes` is set, and no symlink or special file.
 */
export function verifyBundle(root, bundle, { modes = process.platform !== 'win32' } = {}) {
  const folder = bundleDir(bundle.name);
  const problems = [];
  const top = describeEntry(root, folder);
  if (top?.kind !== 'dir') return [`${folder}: ${top ? 'is not a folder' : 'is missing'}; run node scripts/bundle-sync.mjs sync --only ${bundle.name}`];
  const expected = new Map(bundle.files.map((file) => [file.path, file]));
  const found = new Set();
  for (const entry of walk(root, folder)) {
    const inside = entry.path.slice(folder.length + 1);
    if (entry.kind === 'symlink' || entry.kind === 'special') {
      problems.push(`${entry.path}: is a ${entry.kind === 'symlink' ? 'symlink' : 'special file'}`);
      continue;
    }
    if (entry.kind !== 'file') continue;
    found.add(inside);
    const bytes = readRegular(path.join(root, ...entry.path.split('/')));
    if (inside === BUNDLE_LICENCE) {
      if (sha256(bytes) !== bundle.license.sha256) problems.push(`${entry.path}: differs from the licence recorded in ${BUNDLES_FILE}`);
      continue;
    }
    const record = expected.get(inside);
    if (!record) {
      problems.push(`${entry.path}: is not a file of ${bundle.repo} at ${bundle.tag}`);
      continue;
    }
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) problems.push(`${entry.path}: differs from ${bundle.repo} at ${bundle.tag}`);
    else if (modes && entry.executable !== record.executable) problems.push(`${entry.path}: its executable bit differs from ${BUNDLES_FILE}`);
  }
  for (const file of expected.keys()) if (!found.has(file)) problems.push(`${folder}/${file}: is missing`);
  if (!found.has(BUNDLE_LICENCE)) problems.push(`${folder}/${BUNDLE_LICENCE}: is missing`);
  return problems;
}
