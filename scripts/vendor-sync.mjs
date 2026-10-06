#!/usr/bin/env node
/**
 * Keeps skills/apple/.vendor in step with vendor/sources.json.
 *
 *   sync [--only <id>] [--force]   fetch each pinned repository once and copy every part byte for byte
 *   check                          verify offline that every part matches its UPSTREAM.json and the manifest
 *   notices [--check]              regenerate THIRD_PARTY_NOTICES.md, or fail when it is out of date
 *
 * Every command also takes --root <dir>. Git always runs through execFile, never through a shell. Sync refuses to
 * start while a symlink or special file sits in the vendor folder or on the way down to it, and never writes outside
 * the real vendor folder.
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
  METADATA_KEYS,
  NOTICES_FILE,
  ROOT,
  SOURCES_FILE,
  UPSTREAM_FILE,
  VENDOR_DIR,
  assertInsideVendor,
  authorsFrom,
  compareStrings,
  copyrightLines,
  fileEntryProblem,
  formatJson,
  hasSafeNames,
  isExcluded,
  isMainModule,
  isMitLicence,
  lineRange,
  loadSources,
  loadUpstream,
  orderRecord,
  parseFrontmatter,
  partDir,
  pathProblem,
  readRegular,
  sameJson,
  sha256,
  unsafeFolder,
  vendorTreeProblems,
  walk,
  writeRegular,
} from './lib/vendor.mjs';

const execFileAsync = promisify(execFile);
const OBJECT_PATTERN = /^[0-9a-f]{40,64}$/;
const RESERVED_SEGMENTS = new Set(['.claude-plugin', '.codex-plugin', '.claude', '.agents', '.codex', '.git']);
const GENERATED_NAMES = new Map([['license', 'LICENSE'], [UPSTREAM_FILE.toLowerCase(), UPSTREAM_FILE]]);
const CHECKS_MODES = process.platform !== 'win32';
const USAGE = 'Usage: node scripts/vendor-sync.mjs <sync [--only <id>] [--force] | check | notices [--check]> [--root <dir>]';

/**
 * Run git with an argument list and return stdout as text, or as a Buffer when `buffer` is set.
 */
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
 * Shallow-fetch one commit into `dir` and list every tracked entry of its tree.
 */
async function fetchSource(dir, repo, commit) {
  await git(['init', '--quiet', dir]);
  await git(['-C', dir, '-c', 'protocol.version=2', 'fetch', '--quiet', '--depth=1', '--no-tags', `https://github.com/${repo}.git`, commit]);
  const resolved = (await git(['-C', dir, 'rev-parse', '--verify', '--quiet', `${commit}^{commit}`])).trim();
  if (resolved !== commit) throw new Error(`${repo}: fetched ${resolved || 'nothing'} instead of ${commit}`);
  const listing = await git(['-C', dir, 'ls-tree', '-r', '-z', '--full-tree', commit]);
  return listing
    .split('\0')
    .filter(Boolean)
    .map((record) => {
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
 * Why one upstream file cannot be copied into a part as it is, or null when it can.
 */
function fileProblem(relative, entry) {
  const problem = pathProblem(relative);
  if (problem) return `path ${problem}`;
  const segments = relative.split('/');
  const name = segments.at(-1);
  if (!hasSafeNames(relative)) return 'name uses characters other than letters, digits, ".", "_" and "-"; exclude it';
  if (entry.mode === '120000') return 'is a symlink; exclude it';
  if (entry.mode === '160000') return 'is a submodule; exclude it';
  if (entry.mode !== '100644' && entry.mode !== '100755') return `unsupported file mode ${entry.mode}`;
  if (segments.slice(0, -1).some((segment) => RESERVED_SEGMENTS.has(segment))) return 'sits in a folder that agents or plugins treat specially; exclude it';
  if (GIT_METADATA_NAMES.has(name)) return 'is git metadata that changes what git stores or checks out; exclude it';
  if (name === 'metadata.json') return 'installers drop files named metadata.json; exclude it';
  if (MEDIA_EXTENSIONS.has(path.posix.extname(name).toLowerCase())) return 'is an image, media, font or archive file; exclude it';
  const generated = GENERATED_NAMES.get(relative.toLowerCase());
  if (generated === UPSTREAM_FILE) return 'collides with the generated record; exclude it';
  if (generated && relative !== generated) return `differs only in case from the ${generated} that sync writes; exclude it`;
  return null;
}

/**
 * The upstream files that make up a part, after excludes, plus every reason the part cannot be copied as it is.
 */
export function planPart(entries, part) {
  const prefix = `${part.path}/`;
  const problems = [];
  const files = [];
  const self = entries.find((entry) => entry.path === part.path);
  if (self) problems.push(`${part.path} is a ${self.type === 'blob' ? 'file' : self.type}, not a folder`);
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const relative = entry.path.slice(prefix.length);
    if (isExcluded(relative, part.exclude)) continue;
    const problem = fileProblem(relative, entry);
    if (problem) problems.push(`${relative}: ${problem}`);
    else files.push({ path: relative, object: entry.object, executable: entry.mode === '100755' });
  }
  const seen = new Map();
  for (const file of files) {
    const key = file.path.toLowerCase();
    if (seen.has(key)) problems.push(`${file.path}: differs only in case from ${seen.get(key)}`);
    else seen.set(key, file.path);
  }
  if (!files.length && !problems.length) problems.push(`no files under ${part.path} at ${part.commit}`);
  return { files, problems };
}

/**
 * The licence a part ships with: its own licence file when it has one, otherwise the repository's root licence.
 */
export function chooseLicence(entries, part, files) {
  for (const name of LICENSE_NAMES) {
    const own = files.find((file) => file.path === name);
    if (own) return { file: `${part.path}/${name}`, object: own.object };
  }
  for (const name of LICENSE_NAMES) {
    const top = entries.find((entry) => entry.path === name && (entry.mode === '100644' || entry.mode === '100755'));
    if (top) return { file: name, object: top.object };
  }
  return null;
}

const today = () => new Date().toISOString().slice(0, 10);
const failed = (part, problems) => ({ id: part.id, status: 'failed', problems });
const lineCount = (text) => (text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));

function sameIdentity(record, part) {
  return record.repo === part.repo && record.commit === part.commit && record.path === part.path && sameJson(record.exclude, part.exclude);
}

function withMetadata(record, part) {
  const next = { ...record };
  for (const key of METADATA_KEYS) next[key] = part[key];
  return orderRecord(next);
}

/**
 * Every way a part on disk differs from its UPSTREAM.json and from the manifest. Offline; reads only local files and
 * never follows a symlink.
 */
export function verifyPart(root, part, record) {
  const label = part.id;
  const unsafe = unsafeFolder(root, `${VENDOR_DIR}/${part.id}`);
  if (unsafe) return [`${label}: ${unsafe}; symlinks are not allowed in ${VENDOR_DIR}`];
  const dir = partDir(root, part.id);
  if (!fs.existsSync(dir)) return [`${label}: folder is missing; run sync`];
  let current = record;
  if (current === undefined) {
    const loaded = loadUpstream(root, part.id);
    if (!loaded.record) return [`${label}: ${loaded.problem}; run sync`];
    current = loaded.record;
  }
  const problems = [];
  const read = (relative) => {
    try {
      return readRegular(path.join(dir, ...relative.split('/')));
    } catch (error) {
      problems.push(`${label}/${relative}: ${error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`}`);
      return undefined;
    }
  };
  if (current.schema !== 1) problems.push(`${label}: ${UPSTREAM_FILE} schema must be 1`);
  for (const key of ['id', 'repo', 'commit', 'path', 'exclude', ...METADATA_KEYS]) {
    if (!sameJson(current[key], part[key])) problems.push(`${label}: ${UPSTREAM_FILE} ${key} differs from ${SOURCES_FILE}; run sync`);
  }
  if (!Array.isArray(current.files)) return [...problems, `${label}: ${UPSTREAM_FILE} has no file list`];
  const listed = [];
  current.files.forEach((file, index) => {
    const problem = fileEntryProblem(file);
    if (problem) problems.push(`${label}: ${UPSTREAM_FILE} files[${index}] ${problem}`);
    else listed.push(file);
  });
  const names = listed.map((file) => file.path);
  if (!sameJson(names, [...new Set(names)].sort(compareStrings))) problems.push(`${label}: ${UPSTREAM_FILE} files are not sorted and unique`);
  const entries = walk(dir);
  const irregular = new Set();
  for (const entry of entries) {
    if (entry.kind !== 'symlink' && entry.kind !== 'special') continue;
    irregular.add(entry.path);
    problems.push(`${label}/${entry.path}: is a ${entry.kind === 'symlink' ? 'symlink' : 'special file'}`);
  }
  const actual = new Map(entries.filter((entry) => entry.kind === 'file' && entry.path !== UPSTREAM_FILE).map((entry) => [entry.path, entry]));
  for (const file of listed) {
    const entry = actual.get(file.path);
    if (!entry) {
      if (!irregular.has(file.path)) problems.push(`${label}/${file.path}: missing`);
      continue;
    }
    const bytes = read(file.path);
    if (bytes === undefined) continue;
    if (!bytes || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) problems.push(`${label}/${file.path}: content differs from ${UPSTREAM_FILE}`);
    if (CHECKS_MODES && entry.executable !== file.executable) problems.push(`${label}/${file.path}: executable bit differs from ${UPSTREAM_FILE}`);
  }
  const expected = new Set(names);
  for (const file of actual.keys()) if (!expected.has(file)) problems.push(`${label}/${file}: not listed in ${UPSTREAM_FILE}`);
  const licence = irregular.has('LICENSE') ? undefined : read('LICENSE');
  if (licence === null && !expected.has('LICENSE')) problems.push(`${label}/LICENSE: missing`);
  else if (licence && sha256(licence) !== current.license?.sha256) problems.push(`${label}/LICENSE: does not match license.sha256 in ${UPSTREAM_FILE}`);
  for (const quote of part.appleText) {
    if (!expected.has(quote.file)) {
      problems.push(`${label}: appleText names ${quote.file}, which the part does not ship`);
      continue;
    }
    const bytes = irregular.has(quote.file) ? undefined : read(quote.file);
    if (!bytes) continue;
    const total = lineCount(bytes.toString('utf8'));
    if (lineRange(quote.lines).last > total) problems.push(`${label}: appleText ${quote.file}:${quote.lines} is past the end of the file (${total} lines)`);
  }
  return problems;
}

/**
 * Offline check of the whole vendor folder against the manifest: no symlinks or special files, every part verifies
 * and nothing else is there.
 */
export function checkVendor(root = ROOT) {
  const manifest = loadSources(root);
  const problems = vendorTreeProblems(root).map((problem) => `${problem}; symlinks and special files are not allowed in ${VENDOR_DIR}`);
  for (const part of manifest.parts) {
    try {
      problems.push(...verifyPart(root, part));
    } catch (error) {
      problems.push(`${part.id}: ${error.message}`);
    }
  }
  if (!unsafeFolder(root, VENDOR_DIR)) {
    const partFolders = manifest.parts.map((part) => `${VENDOR_DIR}/${part.id}`);
    const groupFolders = new Set(manifest.parts.filter((part) => part.id.includes('/')).map((part) => `${VENDOR_DIR}/${part.id.split('/')[0]}`));
    for (const entry of walk(root, VENDOR_DIR)) {
      const inside = partFolders.some((folder) => entry.path === folder || entry.path.startsWith(`${folder}/`));
      if (!inside && !groupFolders.has(entry.path)) problems.push(`${entry.path}: belongs to no part in ${SOURCES_FILE}`);
    }
  }
  return { parts: manifest.parts.length, problems };
}

/**
 * Put a part's files and record in place through a staging folder inside the vendor folder, so a failed copy never
 * leaves half a part behind and nothing lands outside the real vendor folder.
 */
function writePart(root, part, contents, record) {
  const unsafe = unsafeFolder(root, `${VENDOR_DIR}/${part.id}`);
  if (unsafe) throw new Error(`${unsafe}; refusing to write`);
  const vendor = path.join(root, ...VENDOR_DIR.split('/'));
  fs.mkdirSync(vendor, { recursive: true });
  const stagingRoot = path.join(vendor, `.sync-${process.pid}`);
  const staging = path.join(stagingRoot, 'part');
  const target = partDir(root, part.id);
  assertInsideVendor(root, stagingRoot);
  assertInsideVendor(root, target);
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const file of contents) {
      const destination = path.join(staging, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      writeRegular(destination, file.bytes);
      fs.chmodSync(destination, file.executable ? 0o755 : 0o644);
    }
    writeRegular(path.join(staging, UPSTREAM_FILE), formatJson(record));
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    assertInsideVendor(root, target);
    fs.renameSync(staging, target);
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

/**
 * Copy one part from a fetched source into place, then write its UPSTREAM.json.
 */
async function installPart(root, source, part) {
  const { files, problems } = planPart(source.entries, part);
  const licence = chooseLicence(source.entries, part, files);
  if (!licence) problems.push('no LICENSE, LICENSE.md, LICENSE.txt or COPYING in the part or at the repository root');
  if (problems.length) return failed(part, problems);
  const licenceBytes = await readBlob(source.dir, licence.object);
  const licenceText = licenceBytes.toString('utf8');
  if (!isMitLicence(licenceText)) return failed(part, [`${licence.file} is not the MIT licence; the pinned copy stays as it is`]);
  const contents = [];
  for (const file of files) contents.push({ path: file.path, executable: file.executable, bytes: await readBlob(source.dir, file.object) });
  if (!files.some((file) => file.path === 'LICENSE')) contents.push({ path: 'LICENSE', executable: false, bytes: licenceBytes });
  contents.sort((a, b) => compareStrings(a.path, b.path));
  const skill = contents.find((file) => file.path === 'SKILL.md');
  const frontmatter = skill ? parseFrontmatter(skill.bytes.toString('utf8')) : null;
  if (!frontmatter?.name) return failed(part, ['SKILL.md with a frontmatter name is missing']);
  const described = contents.map((file) => ({ path: file.path, sha256: sha256(file.bytes), bytes: file.bytes.length, executable: file.executable }));
  const previous = loadUpstream(root, part.id).record;
  const unchangedFiles = previous && sameIdentity(previous, part) && sameJson(previous.files, described);
  const record = withMetadata({
    schema: 1,
    id: part.id,
    name: frontmatter.name,
    repo: part.repo,
    commit: part.commit,
    path: part.path,
    exclude: part.exclude,
    license: {
      spdx: 'MIT',
      file: licence.file,
      sha256: sha256(licenceBytes),
      copyright: copyrightLines(licenceText).join('; '),
    },
    fetched: unchangedFiles && previous.fetched ? previous.fetched : today(),
    files: described,
  }, part);
  writePart(root, part, contents, record);
  const after = verifyPart(root, part, record);
  if (after.length) return failed(part, after);
  return { id: part.id, status: 'fetched', files: described.length, bytes: described.reduce((sum, file) => sum + file.bytes, 0) };
}

/**
 * Refresh a part's metadata offline when its pin and files already verify. Returns null when the part needs a fetch.
 */
function refreshMetadata(root, part, force) {
  const current = loadUpstream(root, part.id).record;
  if (force || !current || !sameIdentity(current, part) || current.schema !== 1 || !Array.isArray(current.files)) return null;
  const next = withMetadata(current, part);
  if (verifyPart(root, part, next).length) return null;
  if (formatJson(next) === formatJson(current)) return { id: part.id, status: 'unchanged' };
  const file = path.join(partDir(root, part.id), UPSTREAM_FILE);
  assertInsideVendor(root, file);
  writeRegular(file, formatJson(next));
  return { id: part.id, status: 'metadata' };
}

/**
 * Bring the selected parts in line with the manifest. Parts whose pin and files already verify only get their
 * metadata refreshed, offline, unless `force` is set; the rest are fetched, one shallow clone per repository. Nothing
 * runs while the vendor tree holds a symlink or special file.
 */
export async function syncParts(root, parts, { force = false } = {}) {
  const unsafe = vendorTreeProblems(root);
  if (unsafe.length) return parts.map((part) => failed(part, unsafe.map((problem) => `${problem}; remove it before syncing`)));
  const results = new Map();
  const pending = new Map();
  for (const part of parts) {
    try {
      const refreshed = refreshMetadata(root, part, force);
      if (refreshed) {
        results.set(part.id, refreshed);
        continue;
      }
    } catch (error) {
      results.set(part.id, failed(part, [error.message]));
      continue;
    }
    const key = `${part.repo}@${part.commit}`;
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push(part);
  }
  for (const group of pending.values()) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pro-max-'));
    try {
      const entries = await fetchSource(dir, group[0].repo, group[0].commit);
      for (const part of group) {
        try {
          results.set(part.id, await installPart(root, { dir, entries }, part));
        } catch (error) {
          results.set(part.id, failed(part, [error.message.trim()]));
        }
      }
    } catch (error) {
      for (const part of group) if (!results.has(part.id)) results.set(part.id, failed(part, [error.message.trim()]));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return parts.map((part) => results.get(part.id));
}

const fence = (text) => {
  let marker = '```';
  while (text.includes(marker)) marker += '`';
  return marker;
};

/**
 * THIRD_PARTY_NOTICES.md built from the manifest and the LICENSE file of every part, grouped by source repository.
 */
export function buildNotices(root = ROOT) {
  const manifest = loadSources(root);
  const sources = new Map();
  for (const part of manifest.parts) {
    const key = `${part.repo}@${part.commit}`;
    if (!sources.has(key)) sources.set(key, { repo: part.repo, commit: part.commit, licences: new Map() });
    const licence = `${VENDOR_DIR}/${part.id}/LICENSE`;
    let bytes;
    try {
      bytes = readRegular(path.join(root, ...licence.split('/')));
    } catch (error) {
      throw new Error(`${licence}: ${error.message}`);
    }
    if (bytes === null) throw new Error(`${licence}: is missing; run sync`);
    const text = bytes.toString('utf8');
    const licences = sources.get(key).licences;
    if (!licences.has(text)) licences.set(text, []);
    licences.get(text).push(part.id);
  }
  const lines = [
    '# Third-party notices',
    '',
    'design-pro-max includes third-party agent skills, unmodified, in `skills/apple/.vendor/`. Each part keeps its upstream licence in its own `LICENSE` file and records its origin in `UPSTREAM.json`.',
    '',
    'Short passages that a part quotes from Apple, such as a sentence of Apple documentation, WWDC session titles, a few phrases or a short code listing, belong to Apple and are not covered by the licences below. Each part lists the known ones, with their sources, under `appleText` in its `UPSTREAM.json`.',
    '',
    'This file is generated by `node scripts/vendor-sync.mjs notices`. Do not edit it by hand.',
  ];
  for (const source of sources.values()) {
    for (const [text, ids] of source.licences) {
      const authors = copyrightLines(text).map(authorsFrom).filter(Boolean);
      const marker = fence(text);
      lines.push(
        '',
        `## ${source.repo}`,
        '',
        `- Authors: ${authors.length ? authors.join('; ') : 'not stated'}`,
        `- Repository: https://github.com/${source.repo}`,
        `- Commit: \`${source.commit}\``,
        `- Licence: ${isMitLicence(text) ? 'MIT' : 'see the text below'}`,
        `- Parts (${ids.length}): ${ids.map((id) => `\`${id}\``).join(', ')}`,
        '',
        `${marker}text`,
        text.replace(/^\u{FEFF}/u, '').trimEnd(),
        marker,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, only: null, force: false, check: false, root: ROOT };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value\n${USAGE}`);
      index += 1;
      return next;
    };
    if (flag === '--only' && command === 'sync') options.only = value();
    else if (flag === '--force' && command === 'sync') options.force = true;
    else if (flag === '--check' && command === 'notices') options.check = true;
    else if (flag === '--root') options.root = path.resolve(value());
    else throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
  }
  if (!['sync', 'check', 'notices'].includes(command)) throw new Error(USAGE);
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  const out = (line) => process.stdout.write(`${line}\n`);
  const err = (line) => process.stderr.write(`${line}\n`);
  if (options.command === 'sync') {
    const manifest = loadSources(options.root);
    const parts = options.only ? manifest.parts.filter((part) => part.id === options.only) : manifest.parts;
    if (!parts.length) throw new Error(`No part with id ${options.only} in ${SOURCES_FILE}`);
    const results = await syncParts(options.root, parts, { force: options.force });
    for (const result of results) {
      if (result.status === 'fetched') out(`fetched    ${result.id} (${result.files} files, ${result.bytes} bytes)`);
      else if (result.status === 'failed') err(`failed     ${result.id}\n${result.problems.map((problem) => `  - ${problem}`).join('\n')}`);
      else out(`${result.status.padEnd(10)} ${result.id}`);
    }
    const failures = results.filter((result) => result.status === 'failed').length;
    if (failures) {
      err(`Sync failed for ${failures} of ${results.length} part(s).`);
      process.exitCode = 1;
    } else {
      out(`Synced ${results.length} part(s).`);
    }
    return;
  }
  if (options.command === 'check') {
    const { parts, problems } = checkVendor(options.root);
    if (problems.length) {
      for (const problem of problems) err(`[check] ${problem}`);
      err(`Vendor check failed with ${problems.length} problem(s).`);
      process.exitCode = 1;
    } else {
      out(`Vendor check passed: ${parts} parts match ${SOURCES_FILE} and their ${UPSTREAM_FILE}.`);
    }
    return;
  }
  const content = buildNotices(options.root);
  const file = path.join(options.root, NOTICES_FILE);
  if (options.check) {
    let current = null;
    try {
      current = readRegular(file)?.toString('utf8') ?? null;
    } catch (error) {
      throw new Error(`${NOTICES_FILE}: ${error.message}`);
    }
    if (current !== content) {
      err(`${NOTICES_FILE} is out of date; run node scripts/vendor-sync.mjs notices`);
      process.exitCode = 1;
    } else {
      out(`${NOTICES_FILE} is up to date.`);
    }
    return;
  }
  writeRegular(file, content);
  out(`Wrote ${NOTICES_FILE}.`);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
