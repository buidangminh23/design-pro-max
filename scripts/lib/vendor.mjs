/**
 * Shared helpers for the vendored parts of the apple skill: the source manifest, path and glob rules, licence
 * parsing, SKILL.md frontmatter, reads and writes that never follow a symlink or block on a FIFO, and the on-disk
 * walk that both the sync tool and the guard rely on.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SOURCES_FILE = 'vendor/sources.json';
export const SKILLS_DIR = 'skills';
export const SKILL_DIR = `${SKILLS_DIR}/apple`;
export const VENDOR_DIR = `${SKILL_DIR}/.vendor`;
export const UPSTREAM_FILE = 'UPSTREAM.json';
export const NOTICES_FILE = 'THIRD_PARTY_NOTICES.md';
export const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
export const METADATA_KEYS = ['active', 'activation', 'prerequisites', 'risks', 'errata', 'appleText'];
export const PART_KEYS = ['id', 'repo', 'commit', 'path', 'exclude', ...METADATA_KEYS];
export const RECORD_KEYS = ['schema', 'id', 'name', 'repo', 'commit', 'path', 'exclude', 'license', 'fetched', ...METADATA_KEYS, 'files'];
export const APPLE_TEXT_KEYS = ['file', 'lines', 'source', 'reason'];
export const IGNORED_NAMES = new Set(['.DS_Store']);
export const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
export const GIT_METADATA_NAMES = new Set(['.gitattributes', '.gitignore', '.gitmodules', '.lfsconfig']);
export const MEDIA_EXTENSIONS = new Set([
  '.7z', '.aac', '.avif', '.bmp', '.bz2', '.dmg', '.eot', '.gif', '.gz', '.heic', '.heif', '.icns', '.ico', '.jpeg',
  '.jpg', '.m4a', '.mkv', '.mov', '.mp3', '.mp4', '.otf', '.pdf', '.pkg', '.png', '.rar', '.svg', '.tar', '.tgz', '.tif',
  '.tiff', '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2', '.xz', '.zip',
]);

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)?$/;
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GLOB_PATTERN = /^[A-Za-z0-9._*?/-]+$/;
const LINES_PATTERN = /^[1-9]\d*(?:-[1-9]\d*)?(?:, [1-9]\d*(?:-[1-9]\d*)?)*$/;
const NOT_REGULAR_CODES = new Set(['ELOOP', 'EMLINK', 'EISDIR', 'ENXIO', 'EFTYPE']);
const OPEN_READ = fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0) | (fs.constants.O_NOFOLLOW ?? 0);
const OPEN_WRITE = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NONBLOCK ?? 0) | (fs.constants.O_NOFOLLOW ?? 0);

const MIT_TEMPLATE = `MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export const compareStrings = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const formatJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const partDir = (root, id) => path.join(root, ...VENDOR_DIR.split('/'), ...id.split('/'));
export const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isSentence = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Deep equality for the plain JSON values stored in the manifest and in UPSTREAM.json.
 */
export function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * True when the script at `moduleUrl` is the one Node was started with, also when it was started through a
 * symlinked path such as macOS /tmp.
 */
export function isMainModule(moduleUrl, entry = process.argv[1]) {
  if (!entry) return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

function notRegular() {
  const error = new Error('is not a regular file');
  error.code = 'ENOTREG';
  return error;
}

/**
 * The bytes of a regular file, or null when nothing is at that name. A symlink, folder, FIFO or device at the name
 * throws an error with code ENOTREG instead of being followed or read, so a planted FIFO never blocks a read.
 */
export function readRegular(file) {
  let fd;
  try {
    fd = fs.openSync(file, OPEN_READ);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    if (NOT_REGULAR_CODES.has(error.code)) throw notRegular();
    throw error;
  }
  try {
    if (!fs.fstatSync(fd).isFile()) throw notRegular();
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Write a regular file without following a symlink or blocking on a FIFO at its name.
 */
export function writeRegular(file, data) {
  let fd;
  try {
    fd = fs.openSync(file, OPEN_WRITE, 0o644);
  } catch (error) {
    if (NOT_REGULAR_CODES.has(error.code)) throw notRegular();
    throw error;
  }
  try {
    if (!fs.fstatSync(fd).isFile()) throw notRegular();
    fs.writeFileSync(fd, data);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Parse a JSON file below `root`. Every error names the file and says what is wrong with it.
 */
export function readJson(root, relative) {
  let bytes;
  try {
    bytes = readRegular(path.join(root, ...relative.split('/')));
  } catch (error) {
    throw new Error(`${relative}: ${error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`}`);
  }
  if (bytes === null) throw new Error(`${relative}: is missing`);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${relative}: is not valid JSON (${error.message})`);
  }
}

/**
 * Why a relative POSIX path is unsafe to write or ship, or null when it is fine.
 */
export function pathProblem(value) {
  if (typeof value !== 'string' || value === '') return 'is empty';
  if (value.includes('\\')) return 'contains a backslash';
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return 'is absolute';
  if (/[\u{0}-\u{1F}\u{7F}]/u.test(value)) return 'contains a control character';
  const segments = value.split('/');
  if (segments.some((segment) => segment === '')) return 'has an empty segment';
  if (segments.some((segment) => segment === '.' || segment === '..')) return 'has a . or .. segment';
  return null;
}

/**
 * True when every segment of a relative path uses only letters, digits, '.', '_' and '-'.
 */
export function hasSafeNames(value) {
  return value.split('/').every((segment) => SAFE_SEGMENT.test(segment));
}

/**
 * A manifest path: relative, forward slashes, plain ASCII segments, no . or .. segments.
 */
export function isSafeRelativePath(value) {
  return !pathProblem(value) && hasSafeNames(value);
}

/**
 * Compile an exclude glob: `**` spans folders, `*` and `?` stay inside one segment.
 */
export function globToRegExp(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      index += 1;
      if (glob[index + 1] === '/') {
        index += 1;
        source += '(?:.*/)?';
      } else {
        source += '.*';
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * True when the path, or any folder above it, matches one of the globs. Globs are anchored at the part folder, unlike
 * gitignore patterns: `agents/**` leaves out the top-level agents folder only and `**\/__pycache__` matches at any
 * depth. A trailing slash is dropped, so `agents/` also matches a file named agents.
 */
export function isExcluded(relativePath, patterns) {
  if (!patterns.length) return false;
  const expressions = patterns.map((pattern) => globToRegExp(pattern.replace(/\/+$/, '')));
  const segments = relativePath.split('/');
  for (let length = 1; length <= segments.length; length += 1) {
    const candidate = segments.slice(0, length).join('/');
    if (expressions.some((expression) => expression.test(candidate))) return true;
  }
  return false;
}

/**
 * The first and last line numbers named by an appleText `lines` value such as "12", "12-14" or "12, 30-31".
 */
export function lineRange(lines) {
  const numbers = lines.split(', ').flatMap((range) => range.split('-').map(Number));
  return { first: Math.min(...numbers), last: Math.max(...numbers) };
}

function hasDescendingRange(lines) {
  return lines.split(', ').some((range) => {
    const [start, end = start] = range.split('-').map(Number);
    return end < start;
  });
}

function appleTextProblems(entries) {
  if (!Array.isArray(entries)) return ['appleText must be a list'];
  const problems = [];
  entries.forEach((entry, index) => {
    const label = `appleText[${index}]`;
    const keys = isPlainObject(entry) ? Object.keys(entry) : [];
    if (keys.length !== APPLE_TEXT_KEYS.length || !APPLE_TEXT_KEYS.every((key) => keys.includes(key))) {
      problems.push(`${label} needs exactly the keys ${APPLE_TEXT_KEYS.join(', ')}`);
    } else if (!isSafeRelativePath(entry.file)) {
      problems.push(`${label}.file must be a path inside the part`);
    } else if (typeof entry.lines !== 'string' || !LINES_PATTERN.test(entry.lines)) {
      problems.push(`${label}.lines must look like "12", "12-14" or "12, 30-31"`);
    } else if (hasDescendingRange(entry.lines)) {
      problems.push(`${label}.lines has a range that ends before it starts`);
    } else if (!isSentence(entry.source) || !isSentence(entry.reason)) {
      problems.push(`${label} needs a source and a reason`);
    }
  });
  return problems;
}

/**
 * Every problem with the manifest, as readable sentences. An empty list means it is valid.
 */
export function validateSources(data) {
  if (!isPlainObject(data)) return ['the manifest must be a JSON object'];
  const problems = [];
  if (data.schema !== 1) problems.push('schema must be 1');
  const unknownTop = Object.keys(data).filter((key) => key !== 'schema' && key !== 'parts');
  if (unknownTop.length) problems.push(`unknown top-level keys: ${unknownTop.join(', ')}`);
  if (!Array.isArray(data.parts) || data.parts.length === 0) return [...problems, 'parts must be a non-empty array'];
  const ids = new Set();
  const pins = new Map();
  data.parts.forEach((part, index) => {
    const label = typeof part?.id === 'string' && part.id ? part.id : `parts[${index}]`;
    if (!isPlainObject(part)) {
      problems.push(`${label}: must be an object`);
      return;
    }
    const keys = Object.keys(part);
    const missing = PART_KEYS.filter((key) => !keys.includes(key));
    const unknown = keys.filter((key) => !PART_KEYS.includes(key));
    if (missing.length) problems.push(`${label}: missing ${missing.join(', ')}`);
    if (unknown.length) problems.push(`${label}: unknown keys ${unknown.join(', ')}`);
    if (typeof part.id !== 'string' || !ID_PATTERN.test(part.id)) {
      problems.push(`${label}: id must be lowercase words joined by hyphens, with at most one group folder`);
    } else if (ids.has(part.id)) {
      problems.push(`${label}: duplicate id`);
    } else {
      ids.add(part.id);
    }
    const repoValid = typeof part.repo === 'string' && REPO_PATTERN.test(part.repo) && !part.repo.endsWith('.git') && !/\/\.{1,2}$/.test(part.repo);
    if (!repoValid) problems.push(`${label}: repo must be a GitHub owner/name`);
    const commitValid = typeof part.commit === 'string' && COMMIT_PATTERN.test(part.commit);
    if (!commitValid) problems.push(`${label}: commit must be a full 40-character SHA`);
    if (!isSafeRelativePath(part.path)) problems.push(`${label}: path must be a relative folder without . or .. segments`);
    const excludeValid = Array.isArray(part.exclude) && part.exclude.every((glob) => typeof glob === 'string' && GLOB_PATTERN.test(glob) && !glob.startsWith('/') && !glob.split('/').includes('..'));
    if (!excludeValid) problems.push(`${label}: exclude must be a list of relative globs`);
    if (typeof part.active !== 'boolean') problems.push(`${label}: active must be true or false`);
    if (!isSentence(part.activation)) problems.push(`${label}: activation must be a sentence`);
    for (const key of ['prerequisites', 'risks', 'errata']) {
      const valid = Array.isArray(part[key]) && part[key].every(isSentence);
      if (!valid) problems.push(`${label}: ${key} must be a list of sentences`);
    }
    if (keys.includes('appleText')) for (const problem of appleTextProblems(part.appleText)) problems.push(`${label}: ${problem}`);
    if (repoValid && commitValid) {
      const pinned = pins.get(part.repo);
      if (pinned && pinned !== part.commit) problems.push(`${label}: every part from ${part.repo} must pin the same commit`);
      else pins.set(part.repo, part.commit);
    }
  });
  for (const id of ids) {
    const group = id.split('/')[0];
    if (id.includes('/') && ids.has(group)) problems.push(`${id}: its group folder ${group} is also a part`);
  }
  return problems;
}

/**
 * Read and validate vendor/sources.json, throwing one error that lists every problem.
 */
export function loadSources(root = ROOT) {
  const data = readJson(root, SOURCES_FILE);
  const problems = validateSources(data);
  if (problems.length) throw new Error(`${SOURCES_FILE} is invalid:\n- ${problems.join('\n- ')}`);
  return data;
}

/**
 * Every entry below `relative`, sorted, with its kind: dir, file, symlink or special. Symlinks and special files are
 * reported, never followed or read. Files carry their size and whether any executable bit is set. OS metadata files
 * and the names in `skip` are left out.
 */
export function walk(root, relative = '', { skip = new Set() } = {}) {
  const base = relative ? path.join(root, ...relative.split('/')) : root;
  let names;
  try {
    names = fs.readdirSync(base);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
  const out = [];
  for (const name of names.sort(compareStrings)) {
    if (IGNORED_NAMES.has(name)) continue;
    const child = relative ? `${relative}/${name}` : name;
    if (skip.has(child)) continue;
    const entry = describeEntry(root, child);
    if (!entry) continue;
    out.push(entry);
    if (entry.kind === 'dir') out.push(...walk(root, child, { skip }));
  }
  return out;
}

/**
 * One path below `root` as a walk entry, or null when nothing is there.
 */
export function describeEntry(root, relative) {
  let stat;
  try {
    stat = fs.lstatSync(path.join(root, ...relative.split('/')));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
  if (stat.isSymbolicLink()) return { path: relative, kind: 'symlink' };
  if (stat.isDirectory()) return { path: relative, kind: 'dir' };
  if (stat.isFile()) return { path: relative, kind: 'file', bytes: stat.size, executable: (stat.mode & 0o111) !== 0 };
  return { path: relative, kind: 'special' };
}

/**
 * The first step on the way from `root` down to `relative` that is a symlink or not a folder, as a sentence, or null
 * when every existing step is a real folder. Steps that do not exist yet are fine: sync creates them.
 */
export function unsafeFolder(root, relative) {
  const segments = relative.split('/');
  for (let length = 1; length <= segments.length; length += 1) {
    const entry = describeEntry(root, segments.slice(0, length).join('/'));
    if (!entry) return null;
    if (entry.kind === 'symlink') return `${entry.path} is a symlink`;
    if (entry.kind !== 'dir') return `${entry.path} is not a folder`;
  }
  return null;
}

/**
 * Symlinks and special files in the vendor folder or on the way down to it, as sentences. Sync and check refuse to
 * touch a tree that has any.
 */
export function vendorTreeProblems(root) {
  const above = unsafeFolder(root, VENDOR_DIR);
  if (above) return [above];
  return walk(root, VENDOR_DIR)
    .filter((entry) => entry.kind === 'symlink' || entry.kind === 'special')
    .map((entry) => `${entry.path} is a ${entry.kind === 'symlink' ? 'symlink' : 'special file'}`);
}

/**
 * Throw unless `target`, which may not exist yet, resolves inside the real vendor folder.
 */
export function assertInsideVendor(root, target) {
  const vendor = fs.realpathSync(path.join(root, ...VENDOR_DIR.split('/')));
  let existing = target;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const resolved = path.join(fs.realpathSync(existing), path.relative(existing, target));
  if (resolved !== vendor && !resolved.startsWith(`${vendor}${path.sep}`)) {
    throw new Error(`${path.relative(root, target).split(path.sep).join('/')} resolves outside ${VENDOR_DIR}; refusing to write`);
  }
}

const FRONTMATTER = /^\u{FEFF}?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u;
const KEY_LINE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/;
const BLOCK_INDICATOR = /^[>|][+-]?\d*$/;
const ESCAPES = {
  0: '\u{0}', a: '\u{7}', b: '\u{8}', t: '\t', n: '\n', v: '\u{B}', f: '\u{C}', r: '\r', e: '\u{1B}', ' ': ' ', '"': '"',
  '/': '/', '\\': '\\', N: '\u{85}', _: '\u{A0}', L: '\u{2028}', P: '\u{2029}',
};

function frontmatterEntries(block) {
  const lines = block.split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const pair = KEY_LINE.exec(lines[index]);
    if (!pair) continue;
    const continuation = [];
    while (index + 1 < lines.length && /^[ \t]+\S|^\s*$/.test(lines[index + 1]) && !/^[A-Za-z_][\w-]*:/.test(lines[index + 1])) {
      index += 1;
      continuation.push(lines[index].trim());
    }
    entries.push({ key: pair[1], head: (pair[2] ?? '').trim(), continuation });
  }
  return entries;
}

function fold(lines) {
  let out = '';
  let breaks = 0;
  for (const line of lines) {
    if (!line) {
      breaks += 1;
      continue;
    }
    if (out) out += breaks ? '\n'.repeat(breaks) : ' ';
    out += line;
    breaks = 0;
  }
  return out;
}

function decodeDoubleQuoted(body) {
  return body.replace(/\\(?:x([0-9A-Fa-f]{2})|u([0-9A-Fa-f]{4})|U([0-9A-Fa-f]{8})|([\s\S]))/g, (match, x, u, wide, single) => {
    const hex = x ?? u ?? wide;
    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return ESCAPES[single] ?? match;
  });
}

function scalarValue({ head, continuation }) {
  if (BLOCK_INDICATOR.test(head)) {
    const block = continuation.filter((line, position) => line || position < continuation.length - 1);
    return head.startsWith('>') ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
  }
  if (!head) return '';
  const value = fold([head, ...continuation]);
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  if (quoted) return quoted[1] === "'" ? quoted[2].replace(/''/g, "'") : decodeDoubleQuoted(quoted[2]);
  return value.replace(/[ \t]+#[\s\S]*$/, '');
}

/**
 * Top-level SKILL.md frontmatter keys. Handles plain, quoted and block (`>` or `|`) scalars the way YAML reads
 * them: folded lines, double-quoted escapes and trailing comments; nested mappings become empty strings.
 */
export function parseFrontmatter(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  const fields = {};
  for (const entry of frontmatterEntries(match[1])) fields[entry.key] = scalarValue(entry);
  return fields;
}

/**
 * Frontmatter that real YAML loaders reject or read differently from parseFrontmatter, as sentences: plain values
 * with ": ", " #" or a leading indicator, and quoted values without a closing quote.
 */
export function frontmatterProblems(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return ['has no frontmatter block'];
  const problems = [];
  for (const entry of frontmatterEntries(match[1])) {
    const { key, head } = entry;
    if (!head || BLOCK_INDICATOR.test(head)) continue;
    const value = fold([head, ...entry.continuation]);
    if (/^['"]/.test(head)) {
      if (!/^(['"])[\s\S]*\1$/.test(value) || value.length < 2) problems.push(`${key}: the quoted value has no closing quote`);
      continue;
    }
    if (/^(?:[[\]{},#&*!%@`]|[-?:](?:\s|$))/.test(value)) problems.push(`${key}: a plain value must not start with ${value[0]}; quote it`);
    if (/:(?:\s|$)/.test(value)) problems.push(`${key}: a plain value must not contain ": " or end with ":"; quote it`);
    if (/\s#/.test(value)) problems.push(`${key}: " #" starts a YAML comment; quote the value`);
  }
  return problems;
}

const isTitleLine = (line) => /^\s*#*\s*(?:the\s+)?mit\s+licen[cs]e(?:\s*\(mit\))?\s*$/i.test(line);
const isCopyrightLine = (line) => /^\s*(?:copyright\b(?!\s+holders\b)|\(c\)|\u{A9})/iu.test(line);

/**
 * Licence text without its title and copyright lines, whitespace collapsed, ready to compare with the MIT template.
 */
export function normalizeLicence(text) {
  return text
    .replace(/^\u{FEFF}/u, '')
    .split(/\r?\n/)
    .filter((line) => !isTitleLine(line) && !isCopyrightLine(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMitLicence(text) {
  return normalizeLicence(text) === normalizeLicence(MIT_TEMPLATE);
}

export function copyrightLines(text) {
  return text.replace(/^\u{FEFF}/u, '').split(/\r?\n/).filter(isCopyrightLine).map((line) => line.trim());
}

/**
 * The holder named in a copyright line: "Copyright (c) 2026 Jane Doe." becomes "Jane Doe".
 */
export function authorsFrom(line) {
  return line
    .replace(/^\s*copyright\b\s*/i, '')
    .replace(/^(?:\(c\)|\u{A9})\s*/iu, '')
    .replace(/^[\d\s,\u{2013}-]+/u, '')
    .replace(/\s*all rights reserved\.?\s*$/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
}

/**
 * Why one entry of an UPSTREAM.json file list is unusable, or null when it has a path, sha256, size and mode.
 */
export function fileEntryProblem(file) {
  if (!isPlainObject(file)) return 'is not an object';
  const problem = pathProblem(file.path);
  if (problem) return `path ${problem}`;
  if (typeof file.sha256 !== 'string' || !SHA256_PATTERN.test(file.sha256)) return 'needs a sha256';
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) return 'needs a byte count';
  if (typeof file.executable !== 'boolean') return 'needs executable: true or false';
  return null;
}

/**
 * An UPSTREAM.json record with its keys in the documented order: identity, licence and metadata first, the long file
 * list last, so a reader reaches the errata without paging through hashes. Unknown keys go to the end.
 */
export function orderRecord(record) {
  const ordered = {};
  for (const key of RECORD_KEYS) if (key in record) ordered[key] = record[key];
  for (const key of Object.keys(record)) if (!(key in ordered)) ordered[key] = record[key];
  return ordered;
}

/**
 * A part's UPSTREAM.json as `{ record, problem }`: the parsed object, or null with the reason it cannot be used.
 */
export function loadUpstream(root, id) {
  const relative = `${VENDOR_DIR}/${id}/${UPSTREAM_FILE}`;
  let record;
  try {
    record = readJson(root, relative);
  } catch (error) {
    return { record: null, problem: error.message.replace(`${relative}: `, `${UPSTREAM_FILE} `) };
  }
  return isPlainObject(record) ? { record, problem: null } : { record: null, problem: `${UPSTREAM_FILE} is not a JSON object` };
}

export function readUpstream(root, id) {
  return loadUpstream(root, id).record;
}
