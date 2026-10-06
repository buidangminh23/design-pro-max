#!/usr/bin/env node
/**
 * Release tooling. A release is one ZIP that git archive makes from the tagged commit, plus SHA256SUMS.txt naming it,
 * in the shape the owner's installers read: one folder holding skills/<name>/ with its hidden .vendor/ folder,
 * skills.json, README.md, LICENSE, THIRD_PARTY_NOTICES.md and CHANGELOG.md. Repo-only paths are export-ignore in
 * .gitattributes; nothing under skills/ ever is.
 *
 *   check [vX.Y.Z]   validate the release inputs; with a tag, also the version and its CHANGELOG entry
 *   notes vX.Y.Z     print the CHANGELOG entry of that version
 *   pack [vX.Y.Z]    write dist/design-pro-max-vX.Y.Z.zip and dist/SHA256SUMS.txt from HEAD, then verify them
 *   verify <dir>     verify a folder holding SHA256SUMS.txt and the ZIP it names, such as downloaded release assets
 *
 * Every command takes --root <dir>. Verification reads the ZIP itself: one visible SKILL.md per skill in skills.json,
 * every vendored file equal to its UPSTREAM.json hash, one MIT LICENSE per part, exactly the parts of
 * vendor/sources.json, no symlinks, __pycache__ folders, compiled Python or metadata.json files, and no image, font,
 * media file or archive other than a reviewed file with its reviewed bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import {
  ROOT,
  SOURCES_FILE,
  UPSTREAM_FILE,
  VENDOR_DIR,
  compareStrings,
  describeEntry,
  fileEntryProblem,
  isMainModule,
  isMitLicence,
  loadSources,
  parseFrontmatter,
  pathProblem,
  readRegular,
  sha256,
  writeRegular,
} from './lib/vendor.mjs';
import { isReviewedMedia, mediaKind } from './lib/media.mjs';
import { SKILLS_FILE, skillsList } from './gen.mjs';
import { visiblePath } from './vendor-guard.mjs';

export const NAME = 'design-pro-max';
export const SUMS_FILE = 'SHA256SUMS.txt';
export const PAYLOAD = ['CHANGELOG.md', 'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', SKILLS_FILE, 'skills'];
export const REPO_ONLY = ['.github', '.gitattributes', '.gitignore', 'CONTRIBUTING.md', 'designs', 'evals', 'evidence', 'fixtures', 'package.json', 'rules.json', 'scripts', 'test', 'vendor'];

const VERSION = /^\d+\.\d+\.\d+$/;
const TAG = /^v(\d+\.\d+\.\d+)$/;
const ZIP_NAME = new RegExp(`^${NAME}-v(\\d+\\.\\d+\\.\\d+)\\.zip$`);
const SUM_LINE = /^([0-9a-f]{64}) [ *](\S+)$/;
const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX'];
const USAGE = 'Usage: node scripts/release.mjs <check [vX.Y.Z] | notes vX.Y.Z | pack [vX.Y.Z] | verify <dir>> [--root <dir>]';

function readText(base, relative) {
  let bytes;
  try {
    bytes = readRegular(path.join(base, ...relative.split('/')));
  } catch (error) {
    throw new Error(`${relative}: ${error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`}`);
  }
  if (bytes === null) throw new Error(`${relative}: is missing`);
  return bytes.toString('utf8');
}

function gitIn(root) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of GIT_ENV_KEYS) delete env[key];
  return (args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
}

/**
 * Problems with the export-ignore lines of .gitattributes: every repo-only path must be export-ignore by a line of its
 * own, anchored at the root, and no other path may be, so a pattern can never drop a file under skills/.
 */
export function attributeProblems(text) {
  const problems = [];
  const ignored = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && /(?:^|\s)export-ignore(?:\s|$)/.test(line))
    .map((line) => line.split(/\s+/)[0]);
  for (const item of REPO_ONLY) if (!ignored.includes(`/${item}`)) problems.push(`.gitattributes must have the line "/${item} export-ignore"`);
  for (const pattern of ignored) if (!REPO_ONLY.includes(pattern.slice(1)) || !pattern.startsWith('/')) problems.push(`.gitattributes: "${pattern} export-ignore" is not a repo-only path; only ${REPO_ONLY.map((item) => `/${item}`).join(', ')} may be export-ignore`);
  return problems;
}

function changelogSections(text) {
  const headings = [...text.matchAll(/^## \[([^\]\r\n]+)\]([^\r\n]*)$/gm)];
  return headings.map((match, index) => ({
    name: match[1],
    rest: match[2],
    body: text.slice(match.index + match[0].length, index + 1 < headings.length ? headings[index + 1].index : text.length).trim(),
  }));
}

/**
 * Problems with the CHANGELOG for a release of `version`: [Unreleased] must be empty, and the first version entry
 * must be that version, dated, with notes.
 */
export function changelogProblems(text, version) {
  const sections = changelogSections(text);
  const problems = [];
  const unreleased = sections.find((section) => section.name === 'Unreleased');
  if (unreleased?.body) problems.push('CHANGELOG.md: [Unreleased] still holds entries; move them under the version being released');
  const versions = sections.filter((section) => section.name !== 'Unreleased');
  const matching = versions.filter((section) => section.name === version);
  if (matching.length !== 1) problems.push(`CHANGELOG.md needs exactly one "## [${version}] - YYYY-MM-DD" entry`);
  else if (versions[0] !== matching[0]) problems.push(`CHANGELOG.md: [${version}] must be the newest version entry`);
  else if (!/^ - \d{4}-\d{2}-\d{2}$/.test(matching[0].rest)) problems.push(`CHANGELOG.md: [${version}] needs a date: "## [${version}] - YYYY-MM-DD"`);
  else if (!matching[0].body) problems.push(`CHANGELOG.md: [${version}] has no notes`);
  return problems;
}

/**
 * The notes of one version entry in CHANGELOG.md.
 */
export function releaseNotes(text, version) {
  const entry = changelogSections(text).filter((section) => section.name === version);
  if (entry.length !== 1 || !entry[0].body) throw new Error(`CHANGELOG.md has no notes for ${version}`);
  return entry[0].body;
}

/**
 * Validate the release inputs of a checkout. With a tag, the tag must be vX.Y.Z for the package version and the
 * CHANGELOG must hold that version's entry.
 */
export function checkRelease(root = ROOT, tag = null) {
  const problems = [];
  let pkg = {};
  try {
    pkg = JSON.parse(readText(root, 'package.json'));
  } catch (error) {
    problems.push(error.message);
  }
  if (pkg.name !== NAME || pkg.private !== true) problems.push(`package.json must name the private package ${NAME}`);
  const version = typeof pkg.version === 'string' && VERSION.test(pkg.version) ? pkg.version : null;
  if (!version) problems.push('package.json version must be major.minor.patch');
  for (const item of PAYLOAD) if (!describeEntry(root, item)) problems.push(`${item}: is missing`);
  try {
    problems.push(...attributeProblems(readText(root, '.gitattributes')));
  } catch (error) {
    problems.push(error.message);
  }
  try {
    if (JSON.stringify(JSON.parse(readText(root, SKILLS_FILE))) !== JSON.stringify(skillsList(root))) problems.push(`${SKILLS_FILE} does not match the skill folders; run node scripts/gen.mjs`);
  } catch (error) {
    problems.push(error.message);
  }
  if (tag !== null) {
    const match = TAG.exec(tag);
    if (!match) problems.push(`${tag} is not a vX.Y.Z tag`);
    else if (version && match[1] !== version) problems.push(`tag ${tag} does not match package.json version ${version}`);
    if (version === '0.0.0') problems.push('version 0.0.0 cannot be released; raise it in package.json');
    if (version) {
      try {
        problems.push(...changelogProblems(readText(root, 'CHANGELOG.md'), version));
      } catch (error) {
        problems.push(error.message);
      }
    }
  }
  return { version, problems };
}

/**
 * The entries of a ZIP archive, read from its central directory: name, Unix mode, whether it is a folder or a
 * symlink, and the uncompressed bytes. Stored and deflated entries are supported, as git archive writes them.
 */
export function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error('is not a ZIP archive');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('is a ZIP64 archive, which is not expected here');
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('has a corrupt central directory');
    const madeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const attributes = buffer.readUInt32LE(offset + 38);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (flags & 0x1) throw new Error(`${name}: is encrypted`);
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`${name}: has a corrupt local header`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + compressed);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`${name}: uses compression method ${method}`);
    if (data.length !== size) throw new Error(`${name}: inflates to ${data.length} bytes instead of ${size}`);
    if (typeof zlib.crc32 === 'function' && zlib.crc32(data) !== crc) throw new Error(`${name}: fails its CRC check`);
    const mode = madeBy >> 8 === 3 ? attributes >>> 16 : 0;
    entries.push({ name, mode, directory: name.endsWith('/'), symlink: (mode & 0o170000) === 0o120000, data });
  }
  return entries;
}

function sumsEntry(dir, problems) {
  let text;
  try {
    text = readText(dir, SUMS_FILE);
  } catch (error) {
    problems.push(error.message);
    return null;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const parsed = lines.map((line) => SUM_LINE.exec(line));
  if (parsed.some((match) => !match)) problems.push(`${SUMS_FILE} has a malformed line`);
  const zips = parsed.filter(Boolean).filter((match) => match[2].toLowerCase().endsWith('.zip'));
  if (lines.length !== 1 || zips.length !== 1) problems.push(`${SUMS_FILE} must name exactly one file, the release ZIP; it names ${lines.length}`);
  const match = zips[0];
  if (!match) return null;
  const [, hash, name] = match;
  if (name.toLowerCase().includes('plugin')) problems.push(`${name}: installers skip ZIPs with "plugin" in the name`);
  const version = ZIP_NAME.exec(name)?.[1];
  if (!version) problems.push(`${name}: must be named ${NAME}-vX.Y.Z.zip`);
  let buffer;
  try {
    buffer = readRegular(path.join(dir, name));
  } catch (error) {
    problems.push(`${name}: ${error.message}`);
  }
  if (!buffer) {
    if (buffer === null) problems.push(`${name}: is missing`);
    return null;
  }
  if (sha256(buffer) !== hash) problems.push(`${name}: does not match ${SUMS_FILE}`);
  return version ? { name, version, buffer } : null;
}

function skillProblems(files, problems) {
  let listed = null;
  try {
    listed = JSON.parse(files.get(SKILLS_FILE)?.data.toString('utf8') ?? 'null');
  } catch {
    problems.push(`${SKILLS_FILE}: is not valid JSON`);
  }
  const valid = Array.isArray(listed) && listed.length > 0 && listed.every((skill) => typeof skill?.name === 'string' && skill.path === `skills/${skill.name}`);
  if (!valid) {
    problems.push(`${SKILLS_FILE}: must list each skill as { "name": n, "path": "skills/n" }`);
    return [];
  }
  const visible = [...files.keys()].filter((file) => path.posix.basename(file) === 'SKILL.md' && !file.split('/').slice(0, -1).some((segment) => segment.startsWith('.'))).sort(compareStrings);
  const expected = listed.map((skill) => `${skill.path}/SKILL.md`).sort(compareStrings);
  if (JSON.stringify(visible) !== JSON.stringify(expected)) {
    problems.push(`the archive must hold one SKILL.md outside dot-folders per skill in ${SKILLS_FILE} (${expected.join(', ')}); it holds ${visible.length ? visible.join(', ') : 'none'}`);
  }
  for (const skill of listed) {
    const file = files.get(`${skill.path}/SKILL.md`);
    if (file && parseFrontmatter(file.data.toString('utf8'))?.name !== skill.name) problems.push(`${skill.path}/SKILL.md: frontmatter name must be ${skill.name}`);
  }
  return listed.map((skill) => skill.name);
}

function partProblems(files, problems) {
  const folders = [];
  const owned = new Set();
  const records = [...files.keys()].filter((file) => /^skills\/[^/]+\/\.vendor\/.+\/UPSTREAM\.json$/.test(file)).sort(compareStrings);
  for (const file of records) {
    owned.add(file);
    const folder = file.slice(0, -(UPSTREAM_FILE.length + 1));
    const id = folder.split('/').slice(3).join('/');
    folders.push(folder);
    let record;
    try {
      record = JSON.parse(files.get(file).data.toString('utf8'));
    } catch {
      problems.push(`${file}: is not valid JSON`);
      continue;
    }
    if (record?.id !== id) problems.push(`${file}: id ${JSON.stringify(record?.id)} does not match its folder ${id}`);
    if (!Array.isArray(record?.files)) {
      problems.push(`${file}: has no file list`);
      continue;
    }
    for (const item of record.files) {
      const issue = fileEntryProblem(item);
      if (issue) {
        problems.push(`${file}: a file entry ${issue}`);
        continue;
      }
      const name = `${folder}/${item.path}`;
      owned.add(name);
      const entry = files.get(name);
      if (!entry) problems.push(`${name}: is missing from the archive`);
      else if (entry.data.length !== item.bytes || sha256(entry.data) !== item.sha256) problems.push(`${name}: differs from ${UPSTREAM_FILE}`);
    }
    const licence = files.get(`${folder}/LICENSE`);
    if (!licence) problems.push(`${folder}/LICENSE: is missing`);
    else {
      if (!isMitLicence(licence.data.toString('utf8'))) problems.push(`${folder}/LICENSE: is not the MIT licence`);
      if (sha256(licence.data) !== record.license?.sha256) problems.push(`${folder}/LICENSE: does not match license.sha256 in ${UPSTREAM_FILE}`);
    }
  }
  for (const file of files.keys()) if (/^skills\/[^/]+\/\.vendor\//.test(file) && !owned.has(file)) problems.push(`${file}: belongs to no part`);
  return folders.sort(compareStrings);
}

/**
 * Verify release assets in `dir` against the installer contract and, with `root`, against that checkout's manifest.
 * Returns a summary or throws an error listing every problem.
 */
export function verifyAssets(dir, { root = null } = {}) {
  const problems = [];
  const zip = sumsEntry(dir, problems);
  if (!zip) throw new Error(`The release assets in ${dir} fail the installer contract:\n- ${problems.join('\n- ')}`);
  let entries = [];
  try {
    entries = readZip(zip.buffer);
  } catch (error) {
    problems.push(`${zip.name} ${error.message}`);
  }
  const prefix = `${NAME}-v${zip.version}/`;
  const files = new Map();
  const reported = new Set();
  const report = (message) => {
    if (!reported.has(message)) problems.push(message);
    reported.add(message);
  };
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix)) {
      report(`${visiblePath(entry.name)}: lies outside the ${prefix} folder`);
      continue;
    }
    const relative = entry.name.slice(prefix.length).replace(/\/$/, '');
    if (!relative) continue;
    const issue = pathProblem(relative);
    if (issue) {
      report(`${visiblePath(relative)}: path ${issue}`);
      continue;
    }
    const segments = relative.split('/');
    if (entry.symlink) report(`${relative}: is a symlink`);
    if (segments.includes('__pycache__')) report(`${segments.slice(0, segments.indexOf('__pycache__') + 1).join('/')}: __pycache__ folders must not ship`);
    if (entry.directory) continue;
    if (files.has(relative)) report(`${relative}: appears twice`);
    files.set(relative, entry);
    if (segments.at(-1) === 'metadata.json') report(`${relative}: installers drop files named metadata.json`);
    if (relative.endsWith('.pyc')) report(`${relative}: compiled Python must not ship`);
    const kind = mediaKind(relative, entry.data);
    if (kind && !isReviewedMedia(relative, entry.data)) report(`${relative}: ${kind} not on the reviewed list in scripts/lib/media.mjs`);
  }
  const top = new Set([...files.keys()].map((file) => file.split('/')[0]));
  for (const item of [...top].sort(compareStrings)) if (!PAYLOAD.includes(item)) report(`${item}: is not part of the release payload`);
  for (const item of PAYLOAD) if (!top.has(item)) report(`${item}: is missing from the archive`);
  const skills = skillProblems(files, problems);
  const parts = partProblems(files, problems);
  if (root) {
    const expected = loadSources(root).parts.map((part) => part.id).sort(compareStrings);
    const shipped = parts.filter((folder) => folder.startsWith(`${VENDOR_DIR}/`)).map((folder) => folder.slice(VENDOR_DIR.length + 1));
    const missing = expected.filter((id) => !shipped.includes(id));
    const extra = shipped.filter((id) => !expected.includes(id));
    if (missing.length || extra.length) report(`the archive must hold the ${expected.length} parts of ${SOURCES_FILE}; missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}`);
  }
  if (problems.length) throw new Error(`The release assets in ${dir} fail the installer contract:\n- ${problems.join('\n- ')}`);
  return { zip: zip.name, version: zip.version, files: files.size, parts: parts.length, skills };
}

/**
 * Build dist/<name>-vX.Y.Z.zip and dist/SHA256SUMS.txt from HEAD with git archive, then verify them.
 */
export function pack(root = ROOT, tag = null) {
  const { version, problems } = checkRelease(root, tag);
  if (problems.length) throw new Error(`The release inputs are not ready:\n- ${problems.join('\n- ')}`);
  const git = gitIn(root);
  if (git(['status', '--porcelain', '--untracked-files=normal'])) throw new Error('Commit every change before packing; the archive is made from HEAD');
  if (tag) {
    let tagged;
    try {
      tagged = git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
    } catch {
      throw new Error(`${tag} is not a tag in this repository`);
    }
    if (git(['rev-parse', 'HEAD']) !== tagged) throw new Error(`HEAD is not ${tag}; check out the tag before packing`);
  }
  const dist = path.join(root, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  const zipName = `${NAME}-v${version}.zip`;
  const zipPath = path.join(dist, zipName);
  git(['-c', 'core.autocrlf=false', 'archive', '--format=zip', `--prefix=${NAME}-v${version}/`, `--output=${zipPath}`, 'HEAD']);
  writeRegular(path.join(dist, SUMS_FILE), `${sha256(fs.readFileSync(zipPath))}  ${zipName}\n`);
  return { dist, ...verifyAssets(dist, { root }) };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, argument: null, root: ROOT };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === '--root') {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--root needs a value\n${USAGE}`);
      options.root = path.resolve(value);
      index += 1;
    } else if (!item.startsWith('--') && options.argument === null) {
      options.argument = item;
    } else {
      throw new Error(`Unknown argument: ${item}\n${USAGE}`);
    }
  }
  if (!['check', 'notes', 'pack', 'verify'].includes(command)) throw new Error(USAGE);
  if ((command === 'notes' || command === 'verify') && options.argument === null) throw new Error(USAGE);
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  const out = (line) => process.stdout.write(`${line}\n`);
  if (options.command === 'check') {
    const { version, problems } = checkRelease(options.root, options.argument);
    if (problems.length) {
      for (const problem of problems) process.stderr.write(`[release] ${problem}\n`);
      process.stderr.write(`Release check failed with ${problems.length} problem(s).\n`);
      process.exitCode = 1;
    } else {
      out(`Release inputs are ready for v${version}${options.argument ? ` (${options.argument})` : ''}.`);
    }
  } else if (options.command === 'notes') {
    const { version, problems } = checkRelease(options.root, options.argument);
    if (problems.length) throw new Error(`The release inputs are not ready:\n- ${problems.join('\n- ')}`);
    out(releaseNotes(readText(options.root, 'CHANGELOG.md'), version));
  } else if (options.command === 'pack') {
    const result = pack(options.root, options.argument);
    out(`Packed ${path.join(result.dist, result.zip)} with ${result.files} files, ${result.parts} parts and the skill(s) ${result.skills.join(', ')}; ${SUMS_FILE} names it.`);
  } else {
    const result = verifyAssets(path.resolve(options.argument), { root: options.root });
    out(`Verified ${result.zip}: ${result.files} files, ${result.parts} parts, the skill(s) ${result.skills.join(', ')}.`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
