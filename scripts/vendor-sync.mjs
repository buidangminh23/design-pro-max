#!/usr/bin/env node
/**
 * Keeps skills/apple/.vendor in step with vendor/sources.json.
 *
 *   sync [--only <id>] [--force]       fetch each pinned repository once and copy every part byte for byte
 *   check                              verify offline that every part matches its UPSTREAM.json and the manifest
 *   notices [--check]                  regenerate THIRD_PARTY_NOTICES.md, or fail when it is out of date
 *   stage --out <dir>                  stage the parts of every source whose upstream HEAD moved past its pin
 *   classify --from <dir> [--json | --markdown]
 *                                      compare a staged update with the tree: safe only when no shipped file of a
 *                                      moved part changes, otherwise needs-review with every reason
 *   confirm --from <dir>               network: re-fetch every moved source at its staged commit and require the
 *                                      staged parts to match a fresh copy, with the pin an ancestor of that commit
 *   apply --from <dir>                 check a staged update and copy it into the tree
 *
 * Every command also takes --root <dir>. Git always runs through execFile, never through a shell. Sync refuses to
 * start while a symlink or special file sits in the vendor folder or on the way down to it, and never writes outside
 * the real vendor folder. A staged folder holds report.json, the new vendor/sources.json and the complete folder of
 * every part of each moved source; classify and apply refuse anything else in it.
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
  PART_KEYS,
  ROOT,
  SKILLS_DIR,
  SKILL_DIR,
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
  readJson,
  readRegular,
  sameJson,
  sha256,
  unsafeFolder,
  validateSources,
  vendorTreeProblems,
  walk,
  writeRegular,
} from './lib/vendor.mjs';
import { RISKY_PATTERNS, visiblePath } from './vendor-guard.mjs';

const execFileAsync = promisify(execFile);
const OBJECT_PATTERN = /^[0-9a-f]{40,64}$/;
const RESERVED_SEGMENTS = new Set(['.claude-plugin', '.codex-plugin', '.claude', '.agents', '.codex', '.git']);
const GENERATED_NAMES = new Map([['license', 'LICENSE'], [UPSTREAM_FILE.toLowerCase(), UPSTREAM_FILE]]);
const CHECKS_MODES = process.platform !== 'win32';
const USAGE = 'Usage: node scripts/vendor-sync.mjs <sync [--only <id>] [--force] | check | notices [--check] | stage --out <dir> | classify --from <dir> [--json | --markdown] | confirm --from <dir> | apply --from <dir>> [--root <dir>]';

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
 * never follows a symlink. With `modes: false` executable bits are not compared, for staged files that came through
 * an artifact store that drops them.
 */
export function verifyPart(root, part, record, { modes = true } = {}) {
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
    if (CHECKS_MODES && modes && entry.executable !== file.executable) problems.push(`${label}/${file.path}: executable bit differs from ${UPSTREAM_FILE}`);
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

const COMMIT = /^[0-9a-f]{40}$/;
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const REPORT_FILE = 'report.json';
const SCRIPT_EXTENSIONS = new Set(['.applescript', '.bash', '.bat', '.cjs', '.cmd', '.cts', '.fish', '.js', '.lua', '.mjs', '.mts', '.php', '.pl', '.ps1', '.psm1', '.py', '.rb', '.scpt', '.sh', '.swift', '.ts', '.zsh']);
const SCRIPT_FOLDERS = new Set(['bin', 'hooks', 'scripts']);
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const URL_HOST = /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s/?#@"'<>()[\]{}`]*@)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi;
const SCP_HOST = /(?<![\w.-])[\w.-]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+):(?!\/\/)/gi;
const BARE_HOST = /(?<![\w@./:-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?=\/[\w~-])/gi;
const URL_LINK = /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s/?#@"'<>()[\]{}`]*@)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?::\d+)?([^\s"'<>()[\]{}`|\\]*)/gi;
const SCP_LINK = /(?<![\w.-])[\w.-]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+):(?!\/\/)([^\s"'<>()[\]{}`|\\]*)/gi;
const BARE_LINK = /(?<![\w@./:-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(\/[\w~-][^\s"'<>()[\]{}`|\\]*)/gi;
const LATIN = /\p{Script=Latin}/u;
const LOOKALIKE = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Cherokee}]/u;
const FENCE = /^\s*(?:```|~~~)/;

/**
 * Commands that the added lines of an upstream change are scanned for. They only point a reviewer at lines worth
 * reading: every change to a shipped file needs a review whatever they find, because no pattern can prove text safe.
 */
export const REVIEW_PATTERNS = [
  ...RISKY_PATTERNS,
  ['text piped to a shell', /\|\s*(?:sudo\s+)?(?:env\s+)?(?:\/[\w./-]*\/)?(?:ba|z|da|k|fi)?sh\b(?![\w.-])/g],
  ['download read by a shell', /\b(?:ba|z|da|k|fi)?sh\s+<\(|<\(\s*(?:curl|wget|iwr|irm)\b/gi],
  ['deletion with rm flags', /\brm\s+(?:-{1,2}[A-Za-z][\w-]*\s+)*-{1,2}(?:[A-Za-z]*[rRfF][A-Za-z]*|recursive|force)\b/g],
  ['recursive delete in PowerShell', /\bRemove-Item\b[^\n`]*-Recurse/gi],
  ['skipped permission checks', /--dangerously-skip-permissions|\bbypassPermissions\b|--permission-mode[ =]bypass|danger-full-access|--yolo\b|--ask-for-approval[ =]never\b|(?<![\w-])-a\s+never\b|--full-auto\b|approval_policy\s*=\s*["']?never/gi],
  ['decoded hidden payload', /\bbase64\s+(?:-d|-D|--decode)\b|\bFromBase64String\b|\batob\(/g],
  ['download piped to an interpreter', /\b(?:curl|wget|irm|iwr|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|]*\|\s*(?:sudo\s+)?(?:python[0-9.]*|node|deno|bun|perl|ruby|php|pwsh|powershell|iex)\b/gi],
  ['PowerShell expression run', /\b(?:iex|Invoke-Expression)\b/gi],
  ['downloaded code run inline', /\$\(\s*(?:curl|wget)\b|\b(?:ba|z)?sh\s+-c\s+["']?\$\(/gi],
  ['global software install', /\b(?:npm|pnpm|yarn)\s+(?:i|install|add)\s+(?:-g|--global)\b|\bpip3?\s+install\b|\bpipx\s+install\b|\buv\s+tool\s+install\b|\bgem\s+install\b|\bgo\s+install\b|\bbrew\s+install\b|\bcargo\s+install\b/g],
  ['code run without asking', /\bnpx\s+(?:-y|--yes)\b|\bpnpm\s+dlx\b|\bbunx\b|\buvx\b/g],
  ['package run with npx', /\bnpx\s+(?!-)[\w@./-]/g],
];

/**
 * Phrases that try to steer an agent rather than inform it.
 */
export const INJECTION_PATTERNS = [
  ['instruction override', /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|other|system|developer)\b[^.\n]{0,20}\b(?:instructions?|rules|prompts?|messages|directions|guidelines|guardrails)\b/gi],
  ['claimed role or system prompt', /\b(?:you are now|from now on,? you|new (?:system )?instructions|system prompt|developer message)\b/gi],
  ['action hidden from the user', /\b(?:do not|don't|never|without)\s+(?:tell(?:ing)?|inform(?:ing)?|notify(?:ing)?|show(?:ing)?|ask(?:ing)?|mention(?:ing)?|alert(?:ing)?|warn(?:ing)?)\b[^.\n]{0,20}\bthe\s+user\b/gi],
  ['secret sent elsewhere', /\b(?:exfiltrat\w*|send|upload|post|leak|forward)\b[^.\n]{0,40}\b(?:secrets?|credentials?|tokens?|api keys?|private keys?|ssh keys?|keychain|\.env)\b/gi],
  ['chat role tag', /<\/?\s*(?:system|assistant|developer|im_start|im_end)\b[^>\n]*>|\[\/?INST\]/gi],
  ['hidden HTML comment', /<!--/g],
  ['hidden Markdown comment', /^\s*\[[^\]\n]*\]:\s*(?:#|<>)/gm],
  ['collapsed HTML block', /<details\b/gi],
];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const short = (commit) => commit.slice(0, 12);
const decode = (bytes) => {
  try {
    return UTF8.decode(bytes);
  } catch {
    return null;
  }
};

/**
 * Host names a text points to: URL hosts, scp-style git hosts and bare domains followed by a path.
 */
export function hostsIn(text) {
  const hosts = new Set();
  for (const pattern of [URL_HOST, SCP_HOST, BARE_HOST]) for (const match of text.matchAll(pattern)) hosts.add(match[1].toLowerCase().replace(/\.+$/, ''));
  return hosts;
}

/**
 * Every place a text links to, as host plus path: URLs, scp-style git remotes and bare domains followed by a path. Two
 * links to one host with different paths are two links, so a new repository on a known host still counts as new.
 */
export function linksIn(text) {
  const links = new Set();
  for (const pattern of [URL_LINK, SCP_LINK, BARE_LINK]) {
    for (const match of text.matchAll(pattern)) {
      const host = match[1].toLowerCase().replace(/\.+$/, '');
      const tail = match[2].replace(/[.,;:!?*_~]+$/, '').replace(/\/+$/, '');
      links.add(tail ? `${host}${tail.startsWith('/') ? '' : '/'}${tail}` : host);
    }
  }
  return links;
}

/**
 * The lines of `next` that `previous` does not have, counting repeats, how many lines of `previous` are gone, and how
 * many of the added lines sit inside fenced code blocks of `next`.
 */
export function lineChanges(previous, next) {
  const left = new Map();
  for (const line of previous === '' ? [] : previous.split('\n')) left.set(line, (left.get(line) ?? 0) + 1);
  const added = [];
  let code = 0;
  let fenced = false;
  for (const line of next === '' ? [] : next.split('\n')) {
    const fence = FENCE.test(line);
    if (left.get(line)) {
      left.set(line, left.get(line) - 1);
    } else {
      added.push(line);
      if (fenced && !fence) code += 1;
    }
    if (fence) fenced = !fenced;
  }
  return { added, removed: [...left.values()].reduce((sum, count) => sum + count, 0), code };
}

/**
 * Words that mix Latin letters with look-alike letters from Cyrillic, Greek, Armenian or Cherokee, such as a Cyrillic
 * o inside an English word, which hide a phrase from a pattern that looks for it.
 */
export function mixedScriptWords(text) {
  return [...new Set(text.split(/[^\p{L}\p{M}]+/u).filter((word) => LATIN.test(word) && LOOKALIKE.test(word)))];
}

/**
 * The commit that HEAD of https://github.com/<repo>.git points to, read with git ls-remote.
 */
export async function upstreamHead(repo) {
  const output = await git(['ls-remote', '--quiet', `https://github.com/${repo}.git`, 'HEAD']);
  const head = output.split('\n').map((line) => line.split('\t')).find(([, ref]) => ref === 'HEAD')?.[0];
  if (!head || !COMMIT.test(head)) throw new Error(`could not read the upstream HEAD of ${repo}`);
  return head;
}

/**
 * The upstream HEAD of a repository and how the pin relates to it, from a blobless clone of its default branch:
 * ancestor, diverged (the history was rewritten) or missing.
 */
export async function upstreamHistory(repo, pin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pro-max-history-'));
  try {
    await git(['clone', '--quiet', '--bare', '--single-branch', '--no-tags', '--filter=blob:none', `https://github.com/${repo}.git`, dir]);
    const head = (await git(['-C', dir, 'rev-parse', '--verify', 'HEAD^{commit}'])).trim();
    if (!COMMIT.test(head)) throw new Error(`could not read the upstream HEAD of ${repo}`);
    try {
      await git(['-C', dir, 'merge-base', '--is-ancestor', pin, head]);
      return { head, relation: 'ancestor' };
    } catch (error) {
      if (error.code === 1) return { head, relation: 'diverged' };
      if (error.code === 128) return { head, relation: 'missing' };
      throw error;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Why the staged commit `to` of a repository cannot follow its pin `from`, or null when `to` is on the upstream default
 * branch and descends from `from`. Reads a blobless clone of the default branch.
 */
async function upstreamProblem(repo, from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pro-max-confirm-'));
  const is = async (args) => {
    try {
      await git(['-C', dir, ...args]);
      return true;
    } catch (error) {
      if (error.code === 1 || error.code === 128) return false;
      throw error;
    }
  };
  try {
    await git(['clone', '--quiet', '--bare', '--single-branch', '--no-tags', '--filter=blob:none', `https://github.com/${repo}.git`, dir]);
    if (!(await is(['cat-file', '-e', `${to}^{commit}`])) || !(await is(['merge-base', '--is-ancestor', to, 'HEAD']))) return `the staged commit ${to} is not on the upstream default branch`;
    if (!(await is(['merge-base', '--is-ancestor', from, to]))) return `the pinned commit ${from} is not an ancestor of the staged commit ${to}`;
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Re-fetch every moved source of a staged update at its staged commit and compare. The staged commit must be on the
 * upstream default branch and descend from the pin, and every moved part must match a fresh copy made the way sync
 * makes one, record for record apart from the fetch date. A staged folder only proves itself consistent; this proves
 * that its files are what upstream holds at the commits it names.
 */
export async function confirmUpdate(root, staged) {
  const view = readStaged(root, staged);
  if (view.problems.length) throw new Error(`The staged update in ${staged} cannot be used:\n- ${view.problems.join('\n- ')}`);
  const problems = [];
  const sources = [...view.moved].sort(compareStrings);
  for (const repo of sources) {
    const from = view.current.parts.find((part) => part.repo === repo).commit;
    const to = view.next.parts.find((part) => part.repo === repo).commit;
    try {
      const problem = await upstreamProblem(repo, from, to);
      if (problem) problems.push(`${repo}: ${problem}`);
    } catch (error) {
      problems.push(`${repo}: ${String(error.stderr || error.message).trim()}`);
    }
  }
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pro-max-fresh-'));
  try {
    const results = await syncParts(fresh, view.parts, { force: true });
    const undated = (record) => ({ ...record, fetched: null });
    for (const [index, part] of view.parts.entries()) {
      if (results[index].status === 'failed') {
        problems.push(...results[index].problems.map((problem) => `${part.id}: ${problem}`));
        continue;
      }
      if (!sameJson(undated(loadUpstream(staged, part.id).record), undated(loadUpstream(fresh, part.id).record))) {
        problems.push(`${part.id}: the staged files differ from a fresh copy of ${part.repo} at ${short(part.commit)}`);
      }
    }
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
  return { sources, parts: view.parts.map((part) => part.id), problems };
}

function pruneEmptyFolders(base, relative) {
  const dir = path.join(base, ...relative.split('/'));
  if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) return;
  for (const name of fs.readdirSync(dir)) pruneEmptyFolders(base, `${relative}/${name}`);
  if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
}

/**
 * Stage every source whose upstream HEAD moved past its pin into `out`: the new manifest, the complete folder of each
 * of its parts at the new HEAD (include path minus excludes, copied the way sync copies) and report.json. A source is
 * blocked, and stays at its pin, when the pin is not an ancestor of the new HEAD or when any of its parts fails sync,
 * for example because its licence is no longer MIT or a new upstream file is not allowed.
 */
export async function stageUpdates(root, out) {
  if (fs.existsSync(out) && (!fs.lstatSync(out).isDirectory() || fs.readdirSync(out).length)) throw new Error(`${out} must be an empty folder or not exist yet`);
  const manifest = loadSources(root);
  const sources = [];
  for (const part of manifest.parts) {
    let source = sources.find((item) => item.repo === part.repo);
    if (!source) {
      source = { repo: part.repo, from: part.commit, to: part.commit, status: 'current', parts: [], problems: [] };
      sources.push(source);
    }
    source.parts.push(part.id);
  }
  for (const source of sources) {
    try {
      if ((await upstreamHead(source.repo)) === source.from) continue;
      const history = await upstreamHistory(source.repo, source.from);
      source.to = history.head;
      if (history.head === source.from) continue;
      if (history.relation === 'ancestor') {
        source.status = 'behind';
      } else {
        source.status = 'blocked';
        source.problems.push(history.relation === 'missing'
          ? `the pinned commit ${source.from} is no longer in the upstream history`
          : `the pinned commit ${source.from} is not an ancestor of the upstream HEAD ${history.head}; the history was rewritten`);
      }
    } catch (error) {
      source.status = 'blocked';
      source.problems.push(String(error.stderr || error.message).trim());
    }
  }
  fs.mkdirSync(out, { recursive: true });
  const behind = sources.filter((source) => source.status === 'behind');
  if (behind.length) {
    const nextParts = manifest.parts.filter((part) => behind.some((source) => source.repo === part.repo)).map((part) => ({ ...part, commit: behind.find((source) => source.repo === part.repo).to }));
    const results = await syncParts(out, nextParts, { force: true });
    for (const source of behind) {
      const failures = results.filter((result) => result.status === 'failed' && source.parts.includes(result.id));
      if (!failures.length) {
        source.status = 'updated';
        continue;
      }
      source.status = 'blocked';
      source.problems.push(...failures.flatMap((failure) => failure.problems.map((problem) => `${failure.id}: ${problem}`)));
      for (const id of source.parts) fs.rmSync(partDir(out, id), { recursive: true, force: true });
    }
    pruneEmptyFolders(out, SKILLS_DIR);
  }
  const updated = sources.filter((source) => source.status === 'updated');
  if (updated.length) {
    const next = { ...manifest, parts: manifest.parts.map((part) => ({ ...part, commit: updated.find((source) => source.repo === part.repo)?.to ?? part.commit })) };
    fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
    writeRegular(path.join(out, ...SOURCES_FILE.split('/')), formatJson(next));
  }
  const report = { schema: 1, changed: updated.length > 0, sources: sources.map(({ repo, from, to, status, parts, problems }) => ({ repo, from, to, status, parts, problems })) };
  writeRegular(path.join(out, REPORT_FILE), formatJson(report));
  return report;
}

/**
 * Check a staged update against the tree without changing anything. Returns its problems and, when it has none, the
 * current and next manifests, the moved repositories and the parts that move with them.
 */
export function readStaged(root, staged) {
  const problems = [];
  const entries = walk(staged);
  for (const entry of entries) {
    if (entry.kind === 'symlink' || entry.kind === 'special') problems.push(`${visiblePath(entry.path)}: is a ${entry.kind === 'symlink' ? 'symlink' : 'special file'}; a staged update holds only folders and regular files`);
    else if (!hasSafeNames(entry.path)) problems.push(`${visiblePath(entry.path)}: uses characters other than letters, digits, ".", "_" and "-"`);
  }
  if (problems.length) return { problems };
  let next;
  try {
    next = readJson(staged, SOURCES_FILE);
  } catch (error) {
    return { problems: [`staged ${error.message}`] };
  }
  const issues = validateSources(next);
  if (issues.length) return { problems: issues.map((issue) => `staged ${SOURCES_FILE}: ${issue}`) };
  const current = loadSources(root);
  if (next.parts.length !== current.parts.length) return { problems: [`the staged ${SOURCES_FILE} adds or removes parts; only commits may change`] };
  next.parts.forEach((part, index) => {
    const changed = PART_KEYS.filter((key) => key !== 'commit' && !sameJson(part[key], current.parts[index][key]));
    if (changed.length) problems.push(`${part.id}: the staged ${SOURCES_FILE} changes ${changed.join(', ')}; only commits may change`);
  });
  if (problems.length) return { problems };
  const moved = new Set(next.parts.filter((part, index) => part.commit !== current.parts[index].commit).map((part) => part.repo));
  if (!moved.size) return { problems: [`the staged ${SOURCES_FILE} moves no source`] };
  const parts = next.parts.filter((part) => moved.has(part.repo));
  const allowed = new Set(['vendor', SOURCES_FILE, REPORT_FILE, SKILLS_DIR, SKILL_DIR, VENDOR_DIR]);
  for (const part of parts) if (part.id.includes('/')) allowed.add(`${VENDOR_DIR}/${part.id.split('/')[0]}`);
  for (const entry of entries) {
    if (allowed.has(entry.path)) continue;
    if (parts.some((part) => entry.path === `${VENDOR_DIR}/${part.id}` || entry.path.startsWith(`${VENDOR_DIR}/${part.id}/`))) continue;
    problems.push(`${entry.path}: lies outside the parts of the moved sources`);
  }
  for (const part of parts) for (const problem of verifyPart(staged, part, undefined, { modes: false })) problems.push(`staged ${problem}`);
  return { problems, current, next, parts, moved };
}

function partFiles(root, id, record) {
  const dir = partDir(root, id);
  return new Map(record.files.map((file) => [file.path, readRegular(path.join(dir, ...file.path.split('/')))]));
}

function knownLinks(files) {
  const links = new Set();
  for (const bytes of files.values()) {
    const text = bytes ? decode(bytes) : null;
    if (text !== null) for (const link of linksIn(text.normalize('NFKC'))) links.add(link);
  }
  return links;
}

/**
 * What the added lines of one file bring, as review reasons: commands and phrases worth a look, words that mix
 * scripts, fenced code and links the part did not have before. Phrases are also matched across line breaks.
 */
function addedSignals(label, file, change, known) {
  const reasons = [];
  const raw = change.added.join('\n');
  const text = raw.normalize('NFKC');
  const flat = text.replace(/\s+/g, ' ');
  const count = (pattern, ...texts) => Math.max(...texts.map((item) => [...item.matchAll(pattern)].length));
  for (const [name, pattern] of REVIEW_PATTERNS) {
    const found = count(pattern, text);
    if (found) reasons.push(`${label}: ${file} adds ${name} (${found})`);
  }
  for (const [name, pattern] of INJECTION_PATTERNS) {
    const found = count(pattern, text, flat);
    if (found) reasons.push(`${label}: ${file} adds ${name} (${found})`);
  }
  const mixed = mixedScriptWords(raw);
  if (mixed.length) reasons.push(`${label}: ${file} adds ${mixed.length} word(s) that mix Latin letters with look-alike letters of another script`);
  if (change.code) reasons.push(`${label}: ${file} adds ${change.code} line(s) of fenced code`);
  const links = [...linksIn(text)].filter((link) => !known.has(link)).sort(compareStrings);
  if (links.length) reasons.push(`${label}: ${file} adds ${links.length === 1 ? 'a link' : `${links.length} links`} to ${links.slice(0, 10).join(', ')}${links.length > 10 ? ', ...' : ''}`);
  return reasons;
}

function isScript(file, entry, text) {
  return SCRIPT_EXTENSIONS.has(path.posix.extname(file).toLowerCase())
    || entry.executable
    || (text ?? '').startsWith('#!')
    || file.split('/').slice(0, -1).some((segment) => SCRIPT_FOLDERS.has(segment));
}

function namedByManifest(part, file) {
  const names = [...new Set([file, path.posix.basename(file)])].map((name) => new RegExp(`(?<![\\w./-])${escapeRegExp(name)}(?![\\w-])`));
  return [part.activation, ...part.prerequisites, ...part.risks, ...part.errata].some((sentence) => names.some((name) => name.test(sentence)));
}

/**
 * Why one part's upstream change needs a person's review, comparing its current record and files with the staged
 * ones. An empty list means no file that ships in the part changed: only its pin and record move. Every added, removed
 * or edited file, executable bit, licence and skill name is a reason of its own, because an agent reads or runs these
 * files with the user's permissions and no pattern can prove new text safe. Each added or edited text file also lists
 * what its added lines bring, the edit of a script or of a file that Apple text or the part's activation,
 * prerequisites, risks or errata name, so the reviewer knows where to look.
 */
export function compareParts(part, before, oldFiles, after, newFiles) {
  const reasons = [];
  const label = part.id;
  const oldList = new Map(before.files.map((file) => [file.path, file]));
  const newList = new Map(after.files.map((file) => [file.path, file]));
  const added = [...newList.keys()].filter((file) => !oldList.has(file));
  const removed = [...oldList.keys()].filter((file) => !newList.has(file));
  const kept = [...newList.keys()].filter((file) => oldList.has(file));
  const edited = kept.filter((file) => oldList.get(file).sha256 !== newList.get(file).sha256);
  const modes = kept.filter((file) => oldList.get(file).executable !== newList.get(file).executable);
  for (const file of added) reasons.push(`${label}: adds ${file}`);
  for (const file of removed) reasons.push(`${label}: removes ${file}`);
  for (const file of modes) reasons.push(`${label}: changes the executable bit of ${file}`);
  if (edited.includes('LICENSE') || !sameJson(before.license, after.license)) reasons.push(`${label}: changes its licence`);
  if (before.name !== after.name) reasons.push(`${label}: renames its skill from ${before.name} to ${after.name}`);
  const changes = new Map();
  for (const file of edited) {
    if (file === 'LICENSE') continue;
    const oldText = decode(oldFiles.get(file) ?? Buffer.alloc(0));
    const newText = decode(newFiles.get(file) ?? Buffer.alloc(0));
    if (oldText === null || newText === null) {
      reasons.push(`${label}: edits ${file}, which is not UTF-8 text`);
    } else {
      const change = lineChanges(oldText, newText);
      changes.set(file, change);
      reasons.push(`${label}: edits ${file} (+${change.added.length} -${change.removed} lines)`);
    }
    if (isScript(file, oldList.get(file), oldText) || isScript(file, newList.get(file), newText)) reasons.push(`${label}: edits the script ${file}`);
    if (part.appleText.some((quote) => quote.file === file)) reasons.push(`${label}: edits ${file}, which holds Apple text listed in appleText`);
    if (namedByManifest(part, file)) reasons.push(`${label}: edits ${file}, which its activation, prerequisites, risks or errata name; re-check their line numbers`);
  }
  for (const file of added) {
    const text = decode(newFiles.get(file) ?? Buffer.alloc(0));
    if (text === null) reasons.push(`${label}: adds ${file}, which is not UTF-8 text`);
    else if (file !== 'LICENSE') changes.set(file, lineChanges('', text));
  }
  const known = knownLinks(oldFiles);
  for (const file of [...changes.keys()].sort(compareStrings)) reasons.push(...addedSignals(label, file, changes.get(file), known));
  return { reasons, files: { added, removed, edited, modes } };
}

function plain(text, limit = 300) {
  const flat = visiblePath(String(text).replace(/[\r\n\t]+/g, ' ')).replace(/`/g, "'").replace(/::/g, ': :');
  return flat.length > limit ? `${flat.slice(0, limit - 3)}...` : flat;
}

function blockedSources(staged) {
  let report;
  try {
    report = readJson(staged, REPORT_FILE);
  } catch {
    return [];
  }
  if (!Array.isArray(report?.sources)) return [];
  return report.sources
    .filter((source) => source?.status === 'blocked' && typeof source.repo === 'string' && REPO.test(source.repo))
    .map((source) => ({ repo: source.repo, problems: (Array.isArray(source.problems) ? source.problems : []).slice(0, 20).map((problem) => plain(problem)) }));
}

/**
 * Classify a staged update: 'safe' only when no file that ships in a moved part changes, so the pins move past upstream
 * commits that touched nothing in these parts; any other change is 'needs-review' with the reasons of compareParts.
 * Also returns the moved sources, the touched files, the sources the stage step blocked, and the title and commit
 * message for the pull request.
 */
export function classifyUpdate(root, staged) {
  const view = readStaged(root, staged);
  if (view.problems.length) throw new Error(`The staged update in ${staged} cannot be used:\n- ${view.problems.join('\n- ')}`);
  const reasons = [];
  const parts = [];
  for (const part of view.parts) {
    const before = loadUpstream(root, part.id).record;
    const after = loadUpstream(staged, part.id).record;
    if (!before || !Array.isArray(before.files)) {
      reasons.push(`${part.id}: has no usable UPSTREAM.json in the tree to compare with`);
      continue;
    }
    const result = compareParts(part, before, partFiles(root, part.id, before), after, partFiles(staged, part.id, after));
    reasons.push(...result.reasons);
    parts.push({ id: part.id, ...result.files });
  }
  const commitOf = (manifest, repo) => manifest.parts.find((part) => part.repo === repo).commit;
  const sources = [...view.moved].map((repo) => ({ repo, from: commitOf(view.current, repo), to: commitOf(view.next, repo), parts: view.parts.filter((part) => part.repo === repo).map((part) => part.id) }));
  const title = `chore(vendor): sync ${sources.length === 1 ? sources[0].repo : `${sources.length} upstream sources`}`;
  const message = `${title}\n\n${sources.map((source) => `${source.repo} ${short(source.from)}..${short(source.to)}`).join('\n')}\n`;
  return { verdict: reasons.length ? 'needs-review' : 'safe', reasons, sources, parts, blocked: blockedSources(staged), title, message };
}

/**
 * The pull request body for a classified update.
 */
export function renderProposal(result) {
  const lines = [
    '## Weekly vendor sync',
    '',
    `${result.sources.length === 1 ? 'One source' : `${result.sources.length} sources`} moved upstream. This pull request copies ${result.sources.length === 1 ? 'its' : 'their'} parts byte for byte at the new ${result.sources.length === 1 ? 'commit' : 'commits'}, as \`node scripts/vendor-sync.mjs stage\` fetched them, and regenerates the notices, the README credits and the parts index.`,
    '',
    '| Source | Parts | From | To |',
    '|---|---|---|---|',
    ...result.sources.map((source) => `| [${source.repo}](https://github.com/${source.repo}/compare/${source.from}...${source.to}) | ${source.parts.length} | \`${short(source.from)}\` | \`${short(source.to)}\` |`),
    '',
    '### Files',
    '',
  ];
  for (const part of result.parts) {
    const changes = [
      ...(part.edited.length ? [`edited ${part.edited.map((file) => `\`${file}\``).join(', ')}`] : []),
      ...(part.added.length ? [`added ${part.added.map((file) => `\`${file}\``).join(', ')}`] : []),
      ...(part.removed.length ? [`removed ${part.removed.map((file) => `\`${file}\``).join(', ')}`] : []),
      ...(part.modes.length ? [`changed the executable bit of ${part.modes.map((file) => `\`${file}\``).join(', ')}`] : []),
    ];
    lines.push(`- \`${part.id}\`: ${changes.length ? changes.join('; ') : 'no file changed; only the pin moves'}`);
  }
  lines.push('');
  if (result.verdict === 'safe') {
    lines.push('### Verdict: safe', '', 'No file that ships in these parts changed: upstream moved past the pins without touching them, so only the pins, the records and the generated credits move. The workflow runs the CI workflow on this branch and merges this pull request only when every job passes on its head commit and main has not moved.');
  } else {
    lines.push('### Verdict: needs review', '', ...result.reasons.map((reason) => `- \`${plain(reason)}\``), '', 'The workflow never merges this pull request. Agents read and run these files with the user\'s permissions, so every change to them waits for the owner, who compares this pull request with the upstream diff linked above. The workflow also starts the CI workflow on this branch.');
  }
  if (result.blocked.length) {
    lines.push('', '### Blocked sources', '', 'These sources moved too, but stay at their pins until someone looks at them:', '');
    for (const source of result.blocked) lines.push(`- \`${REPO.test(source.repo) ? source.repo : 'unknown source'}\`: ${source.problems.map((problem) => `\`${plain(problem)}\``).join('; ') || 'no reason recorded'}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Copy a checked staged update into the tree: each moved part through the same staging-folder swap that sync uses,
 * with executable bits taken from its UPSTREAM.json, then the new manifest. Every part is verified afterwards.
 */
export function applyUpdate(root, staged) {
  const view = readStaged(root, staged);
  if (view.problems.length) throw new Error(`The staged update in ${staged} cannot be used:\n- ${view.problems.join('\n- ')}`);
  const unsafe = vendorTreeProblems(root);
  if (unsafe.length) throw new Error(`${unsafe.join('; ')}; refusing to apply`);
  for (const part of view.parts) {
    const record = loadUpstream(staged, part.id).record;
    const dir = partDir(staged, part.id);
    const contents = record.files.map((file) => ({ path: file.path, executable: file.executable, bytes: readRegular(path.join(dir, ...file.path.split('/'))) }));
    writePart(root, part, contents, record);
  }
  writeRegular(path.join(root, ...SOURCES_FILE.split('/')), formatJson(view.next));
  const problems = view.parts.flatMap((part) => verifyPart(root, part));
  if (problems.length) throw new Error(`The applied update does not verify:\n- ${problems.join('\n- ')}`);
  return { parts: view.parts.map((part) => part.id), sources: [...view.moved].sort(compareStrings) };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, only: null, force: false, check: false, out: null, from: null, format: 'text', root: ROOT };
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
    else if (flag === '--out' && command === 'stage') options.out = path.resolve(value());
    else if (flag === '--from' && (command === 'classify' || command === 'confirm' || command === 'apply')) options.from = path.resolve(value());
    else if ((flag === '--json' || flag === '--markdown') && command === 'classify' && options.format === 'text') options.format = flag.slice(2);
    else if (flag === '--root') options.root = path.resolve(value());
    else throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
  }
  if (!['sync', 'check', 'notices', 'stage', 'classify', 'confirm', 'apply'].includes(command)) throw new Error(USAGE);
  if (command === 'stage' && !options.out) throw new Error(`stage needs --out <dir>\n${USAGE}`);
  if ((command === 'classify' || command === 'confirm' || command === 'apply') && !options.from) throw new Error(`${command} needs --from <dir>\n${USAGE}`);
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  const out = (line) => process.stdout.write(`${line}\n`);
  const err = (line) => process.stderr.write(`${line}\n`);
  if (options.command === 'stage') {
    const report = await stageUpdates(options.root, options.out);
    for (const source of report.sources) {
      if (source.status === 'current') out(`current    ${source.repo} at ${short(source.from)}`);
      else if (source.status === 'updated') out(`updated    ${source.repo} ${short(source.from)} -> ${short(source.to)} (${source.parts.length} part${source.parts.length === 1 ? '' : 's'})`);
      else err(`blocked    ${source.repo}\n${source.problems.map((problem) => `  - ${plain(problem, 2000)}`).join('\n')}`);
    }
    const count = (status) => report.sources.filter((source) => source.status === status).length;
    out(`Staged ${count('updated')} updated source(s) in ${options.out}; ${count('blocked')} blocked, ${count('current')} current.`);
    return;
  }
  if (options.command === 'classify') {
    const result = classifyUpdate(options.root, options.from);
    if (options.format === 'json') out(JSON.stringify(result, null, 2));
    else if (options.format === 'markdown') process.stdout.write(renderProposal(result));
    else {
      out(`Verdict: ${result.verdict} (${result.sources.map((source) => source.repo).join(', ')})`);
      for (const reason of result.reasons) out(`  - ${plain(reason, 2000)}`);
    }
    return;
  }
  if (options.command === 'confirm') {
    const result = await confirmUpdate(options.root, options.from);
    if (result.problems.length) {
      for (const problem of result.problems) err(`[confirm] ${plain(problem, 2000)}`);
      err(`The staged update does not match upstream: ${result.problems.length} problem(s).`);
      process.exitCode = 1;
    } else {
      out(`Confirmed ${result.parts.length} part(s) of ${result.sources.join(', ')} against upstream.`);
    }
    return;
  }
  if (options.command === 'apply') {
    const result = applyUpdate(options.root, options.from);
    out(`Applied ${result.parts.length} part(s) from ${result.sources.join(', ')}.`);
    return;
  }
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
