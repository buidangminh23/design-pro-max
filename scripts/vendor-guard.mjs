#!/usr/bin/env node
/**
 * Offline guard for the repository. Hard rules fail the run: the source manifest, vendored licences, part files,
 * sizes, file system entries, file types and encodings, unsafe names, hidden Unicode, secrets, skill layout and
 * personal data in the project's own files. Risky command patterns are counted and reported as warnings only.
 *
 *   node scripts/vendor-guard.mjs [--root <dir>] [--json]
 *
 * In a git checkout the guard checks what git would ship: tracked files and untracked files that are not ignored.
 * Elsewhere it walks the folder. Every file is read without following symlinks, binary files are checked against
 * their signatures and scanned for secrets, and nothing is skipped silently. Extra private words to block in own
 * files can be listed, comma-separated, in DESIGN_PRO_MAX_PRIVATE_TERMS.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  GIT_METADATA_NAMES,
  MEDIA_EXTENSIONS,
  ROOT,
  SKILLS_DIR,
  SKILL_DIR,
  SOURCES_FILE,
  UPSTREAM_FILE,
  VENDOR_DIR,
  compareStrings,
  describeEntry,
  frontmatterProblems,
  hasSafeNames,
  isMainModule,
  isMitLicence,
  parseFrontmatter,
  pathProblem,
  readRegular,
  unsafeFolder,
  validateSources,
  walk,
} from './lib/vendor.mjs';

export const LIMITS = { file: 512 * 1024, part: 1024 * 1024, vendor: 3 * 1024 * 1024 };
export const RULES = ['sources', 'licence', 'part-files', 'size', 'filesystem', 'file-types', 'paths', 'hidden-unicode', 'secrets', 'layout', 'personal'];

const ROOT_SKIP = new Set(['.git', 'node_modules']);
const OWN_EXCLUDED = [`${VENDOR_DIR}/`, 'test/fixtures/'];
const RESERVED_DIRS = new Set(['.claude', '.agents', '.codex', '.git']);
const PLUGIN_DIRS = new Set(['.claude-plugin', '.codex-plugin']);
const SKILL_FOLDER = /^skills\/[^./][^/]*$/;
const VISIBLE_SKILL = /^skills\/[^/]+\/SKILL\.md$/;
const IMPLICIT_INVOCATION = /^\s*allow_implicit_invocation\s*:\s*['"]?(?:true|yes|on)\b/im;
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const HIDDEN_CHARACTERS = /[\u{0}-\u{8}\u{B}\u{C}\u{E}-\u{1F}\u{7F}-\u{9F}\u{AD}\u{34F}\u{61C}\u{115F}\u{1160}\u{17B4}\u{17B5}\u{180E}\u{200B}-\u{200F}\u{2028}-\u{202E}\u{2060}-\u{2064}\u{2066}-\u{2069}\u{3164}\u{FEFF}\u{FFA0}\u{FFF9}-\u{FFFB}\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]|(?<!\p{Emoji})[\u{FE00}-\u{FE0F}]/gu;
const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX'];
const GENERIC_NAMES = new Set([
  'admin', 'administrator', 'build', 'builder', 'buildkite', 'circleci', 'codespace', 'codespaces', 'docker', 'github',
  'gitpod', 'guest', 'imac', 'jenkins', 'localhost', 'mac-mini', 'macbook', 'macbook-air', 'macbook-pro', 'node', 'root',
  'runner', 'travis', 'ubuntu', 'user', 'users', 'vscode',
]);
const BASE_VOCABULARY = [
  'agent', 'agents', 'apple', 'changelog', 'claude', 'codex', 'design', 'fixture', 'fixtures', 'guard', 'license',
  'licence', 'notices', 'readme', 'router', 'scripts', 'skill', 'skills', 'sources', 'swift', 'tests', 'upstream', 'vendor',
  'xcode',
];

const toBytes = (value) => (typeof value === 'string' ? Buffer.from(value, 'latin1') : Buffer.from(value));
const startsWith = (bytes, ...prefixes) => prefixes.some((prefix) => {
  const expected = toBytes(prefix);
  return bytes.length >= expected.length && bytes.subarray(0, expected.length).equals(expected);
});
const hasAt = (bytes, offset, text) => bytes.subarray(offset, offset + text.length).toString('latin1') === text;

/**
 * The leading bytes each binary file type must start with. A file named like one of these but holding something else
 * fails the file-types rule, so text cannot hide behind an image name.
 */
export const SIGNATURES = new Map([
  ['.png', (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['.jpg', (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff])],
  ['.jpeg', (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff])],
  ['.gif', (bytes) => startsWith(bytes, 'GIF87a', 'GIF89a')],
  ['.webp', (bytes) => hasAt(bytes, 0, 'RIFF') && hasAt(bytes, 8, 'WEBP')],
  ['.ico', (bytes) => startsWith(bytes, [0x00, 0x00, 0x01, 0x00])],
  ['.icns', (bytes) => hasAt(bytes, 0, 'icns')],
  ['.pdf', (bytes) => hasAt(bytes, 0, '%PDF-')],
  ['.zip', (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06])],
  ['.gz', (bytes) => startsWith(bytes, [0x1f, 0x8b])],
  ['.tgz', (bytes) => startsWith(bytes, [0x1f, 0x8b])],
  ['.mp4', (bytes) => hasAt(bytes, 4, 'ftyp')],
  ['.mov', (bytes) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].some((box) => hasAt(bytes, 4, box))],
  ['.woff', (bytes) => hasAt(bytes, 0, 'wOFF')],
  ['.woff2', (bytes) => hasAt(bytes, 0, 'wOF2')],
  ['.ttf', (bytes) => startsWith(bytes, [0x00, 0x01, 0x00, 0x00], 'true')],
  ['.otf', (bytes) => hasAt(bytes, 0, 'OTTO')],
]);

export const SECRET_PATTERNS = [
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{30,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['Telegram bot token', /\b\d{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/],
  ['Stripe key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['AWS key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/],
];

export const PERSONAL_PATTERNS = [
  ['home path', /(?:\/Users\/[A-Za-z][\w.-]*|\/home\/(?!runner\b)[a-z][\w.-]*\/|\b[A-Za-z]:\\Users\\)/],
  ['volume path', /\/Volumes\/[^\s/'"`)\]]+/],
  ['email address', /[\w.+-]+@(?!users\.noreply\.github\.com\b|anthropic\.com\b)[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/i],
];

export const RISKY_PATTERNS = [
  ['download piped to a shell', /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da|k|fi)?sh\b/g],
  ['rm with -r and -f', /\brm\s+-[A-Za-z]*(?:[rR][A-Za-z]*f|f[A-Za-z]*[rR])[A-Za-z]*/g],
  ['sudo', /\bsudo\s+[-\w]/g],
  ['eval', /\beval(?:\s*\(|\s+["'$`])/g],
];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const codePointLabel = (char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Words the project itself uses: the base vocabulary, every part id word and every skill folder name. An account or
 * host name equal to one of them cannot be told apart from the project's own text, so it is not a private term.
 */
export function projectVocabulary(parts = [], skillFolders = []) {
  const words = new Set(BASE_VOCABULARY);
  for (const text of [...parts.map((part) => part.id), ...skillFolders]) {
    for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) if (word) words.add(word);
  }
  return words;
}

/**
 * Account and machine names that must not appear in the project's own files: the current user name, the first label
 * of the host name and any extra terms from DESIGN_PRO_MAX_PRIVATE_TERMS. Short and generic names, and names that are
 * words of the project's own vocabulary, are skipped.
 */
export function privateTerms({ env = process.env, username, hostname, vocabulary = new Set() } = {}) {
  const terms = new Set();
  const add = (value) => {
    const term = String(value ?? '').trim();
    const lower = term.toLowerCase();
    if (term.length >= 4 && !GENERIC_NAMES.has(lower) && !vocabulary.has(lower)) terms.add(term);
  };
  try {
    add(username ?? os.userInfo().username);
  } catch {
    add(env.USER ?? env.USERNAME);
  }
  add(String(hostname ?? os.hostname()).split('.')[0]);
  for (const extra of String(env.DESIGN_PRO_MAX_PRIVATE_TERMS ?? '').split(',')) add(extra);
  return [...terms];
}

function lineOf(text, index) {
  let line = 1;
  for (let position = text.indexOf('\n'); position !== -1 && position < index; position = text.indexOf('\n', position + 1)) line += 1;
  return line;
}

function findAll(patterns, text) {
  const found = [];
  for (const [label, pattern] of patterns) {
    const match = pattern.exec(text);
    if (match) found.push({ label, line: lineOf(text, match.index) });
  }
  return found;
}

function personalScan(text, terms) {
  const found = findAll(PERSONAL_PATTERNS, text);
  for (const term of terms) {
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}])`, 'iu').exec(text);
    if (match) found.push({ label: `private name "${term}"`, line: lineOf(text, match.index) });
  }
  return found;
}

/**
 * Labels of the personal data found in a text: home or volume paths, email addresses and private terms.
 */
export function personalFindings(text, terms = []) {
  return personalScan(text, terms).map((finding) => finding.label);
}

export function secretFindings(text) {
  return findAll(SECRET_PATTERNS, text).map((finding) => finding.label);
}

/**
 * Hidden or control characters with their positions, as U+XXXX at line:column, found in one forward pass. Variation
 * selectors are allowed only right after an emoji, so a warning sign with its emoji selector stays legal.
 */
export function hiddenCharacters(text) {
  const found = [];
  let line = 1;
  let lineStart = 0;
  let nextNewline = text.indexOf('\n');
  for (const match of text.matchAll(HIDDEN_CHARACTERS)) {
    while (nextNewline !== -1 && nextNewline < match.index) {
      line += 1;
      lineStart = nextNewline + 1;
      nextNewline = text.indexOf('\n', lineStart);
    }
    found.push({ codePoint: codePointLabel(match[0]), line, column: match.index - lineStart + 1 });
  }
  return found;
}

/**
 * A path with every hidden or control character shown as <U+XXXX>, safe to print.
 */
export function visiblePath(text) {
  return text.replace(HIDDEN_CHARACTERS, (char) => `<${codePointLabel(char)}>`).replace(/[\u{0}-\u{1F}\u{7F}]/gu, (char) => `<${codePointLabel(char)}>`);
}

export function riskyCounts(text) {
  const counts = {};
  for (const [label, pattern] of RISKY_PATTERNS) {
    const total = [...text.matchAll(pattern)].length;
    if (total) counts[label] = total;
  }
  return counts;
}

function gitFiles(root) {
  const env = { ...process.env };
  for (const key of GIT_ENV_KEYS) delete env[key];
  const run = (args, encoding) => execFileSync('git', ['-C', root, ...args], { env, encoding, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  try {
    const top = run(['rev-parse', '--show-toplevel'], 'utf8').trim();
    if (!top || fs.realpathSync(top) !== fs.realpathSync(root)) return null;
    return [...new Set(run(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], 'utf8').split('\0').filter(Boolean))];
  } catch {
    return null;
  }
}

/**
 * The entries the guard checks. In a git checkout these are the files git would ship, tracked or untracked but not
 * ignored, plus the folders above them; elsewhere every entry under the root except .git and node_modules.
 */
export function listEntries(root) {
  const files = gitFiles(root);
  if (!files) return walk(root, '', { skip: ROOT_SKIP });
  const entries = new Map();
  for (const file of files) {
    const segments = file.split('/');
    for (let length = 1; length < segments.length; length += 1) {
      const folder = segments.slice(0, length).join('/');
      if (!entries.has(folder)) {
        const entry = describeEntry(root, folder);
        if (entry) entries.set(folder, entry);
      }
    }
    const entry = describeEntry(root, file);
    if (entry) entries.set(file, entry);
  }
  return [...entries.values()].sort((a, b) => compareStrings(a.path, b.path));
}

const isOwnFile = (file) => !OWN_EXCLUDED.some((prefix) => file.startsWith(prefix));

/**
 * Read a file below `root` by name without following a symlink or blocking on a FIFO. Returns its text, null when it
 * is missing, or undefined after reporting why it cannot be read.
 */
function readNamed(root, relative, fail) {
  try {
    const bytes = readRegular(path.join(root, ...relative.split('/')));
    return bytes === null ? null : bytes.toString('utf8');
  } catch (error) {
    fail('filesystem', relative, error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`);
    return undefined;
  }
}

function readSources(root, fail) {
  const text = readNamed(root, SOURCES_FILE, fail);
  if (text === undefined) return [];
  if (text === null) {
    fail('sources', SOURCES_FILE, 'is missing');
    return [];
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail('sources', SOURCES_FILE, `cannot be read as JSON: ${error.message}`);
    return [];
  }
  const issues = validateSources(data);
  for (const issue of issues) fail('sources', SOURCES_FILE, issue);
  return issues.length ? [] : data.parts;
}

function checkPart(root, part, fail) {
  const folder = `${VENDOR_DIR}/${part.id}`;
  if (unsafeFolder(root, folder)) return;
  if (!fs.existsSync(path.join(root, ...folder.split('/')))) {
    fail('part-files', folder, 'part folder is missing');
    return;
  }
  const skill = readNamed(root, `${folder}/SKILL.md`, fail);
  if (skill === null) {
    fail('part-files', `${folder}/SKILL.md`, 'missing');
  } else if (skill !== undefined) {
    const fields = parseFrontmatter(skill);
    if (!fields) fail('part-files', `${folder}/SKILL.md`, 'has no frontmatter block');
    else if (!fields.name || !fields.description) fail('part-files', `${folder}/SKILL.md`, 'frontmatter needs a name and a description');
    if (fields) for (const problem of frontmatterProblems(skill)) fail('part-files', `${folder}/SKILL.md`, `frontmatter ${problem}`);
  }
  const licence = readNamed(root, `${folder}/LICENSE`, fail);
  if (licence === null) fail('part-files', `${folder}/LICENSE`, 'missing');
  else if (licence !== undefined && !isMitLicence(licence)) fail('licence', `${folder}/LICENSE`, 'does not match the MIT licence template');
  const upstream = readNamed(root, `${folder}/${UPSTREAM_FILE}`, fail);
  if (upstream === null) fail('part-files', `${folder}/${UPSTREAM_FILE}`, 'missing');
  if (typeof upstream !== 'string') return;
  let record;
  try {
    record = JSON.parse(upstream);
  } catch (error) {
    fail('part-files', `${folder}/${UPSTREAM_FILE}`, `is not valid JSON (${error.message})`);
    return;
  }
  if (!record || typeof record !== 'object' || Array.isArray(record) || !Array.isArray(record.files)) {
    fail('part-files', `${folder}/${UPSTREAM_FILE}`, 'must be an object with a files list');
    return;
  }
  const recorded = [['path', record.path], ['license.file', record.license?.file], ...record.files.map((file, index) => [`files[${index}].path`, file?.path])];
  for (const [key, value] of recorded) {
    const problem = pathProblem(value);
    if (problem) fail('paths', `${folder}/${UPSTREAM_FILE}`, `${key} ${problem}: ${JSON.stringify(value)}`);
  }
}

function nameProblem(relative, vendored) {
  const problem = pathProblem(relative);
  if (problem) return problem;
  if (hiddenCharacters(relative).length) return 'contains a hidden or control character';
  if (vendored && !hasSafeNames(relative)) return 'uses characters other than letters, digits, ".", "_" and "-"';
  return null;
}

function checkSkills(root, entries, fail) {
  const skillEntries = entries.filter((entry) => entry.path.startsWith(`${SKILLS_DIR}/`));
  for (const entry of skillEntries) {
    const segments = entry.path.split('/');
    const name = segments.at(-1);
    if (entry.kind === 'dir' && RESERVED_DIRS.has(name)) fail('layout', entry.path, `folders named ${name} are not allowed under ${SKILLS_DIR}/`);
    if (entry.kind === 'dir' && PLUGIN_DIRS.has(name) && segments.length > 2) fail('layout', entry.path, `${name} must not sit inside a skill folder`);
    if (entry.kind === 'file' && name === 'metadata.json') fail('layout', entry.path, 'installers drop files named metadata.json');
    if (entry.kind === 'file' && GIT_METADATA_NAMES.has(name)) {
      fail('layout', entry.path, entry.path.startsWith(`${VENDOR_DIR}/`) ? 'nested git metadata changes what git stores; exclude it in vendor/sources.json' : 'git metadata under skills/ changes what git stores and what a release ships; keep attributes and ignore rules at the repository root');
    }
  }
  const visible = skillEntries
    .filter((entry) => entry.kind === 'file' && entry.path.endsWith('/SKILL.md'))
    .filter((entry) => !entry.path.split('/').slice(1, -1).some((segment) => segment.startsWith('.')))
    .map((entry) => entry.path);
  const folders = new Set([SKILL_DIR, ...skillEntries.filter((entry) => entry.kind === 'dir' && SKILL_FOLDER.test(entry.path)).map((entry) => entry.path)]);
  for (const folder of folders) if (!visible.includes(`${folder}/SKILL.md`)) fail('layout', `${folder}/SKILL.md`, 'missing');
  for (const file of visible) {
    if (!VISIBLE_SKILL.test(file)) {
      fail('layout', file, `only ${SKILLS_DIR}/<name>/SKILL.md may be a visible SKILL.md under ${SKILLS_DIR}/`);
      continue;
    }
    const text = readNamed(root, file, fail);
    if (typeof text !== 'string') continue;
    const fields = parseFrontmatter(text);
    const folder = file.split('/')[1];
    if (!fields?.name || !fields.description) fail('layout', file, 'frontmatter needs a name and a description');
    else if (fields.name !== folder) fail('layout', file, `frontmatter name ${JSON.stringify(fields.name)} must match its folder ${folder}`);
    for (const problem of fields ? frontmatterProblems(text) : []) fail('layout', file, `frontmatter ${problem}`);
  }
  return [...folders].map((folder) => folder.split('/')[1]);
}

/**
 * Run every rule against a checkout and return the hard problems, the warnings and a few totals.
 */
export function runGuard(root = ROOT, { terms } = {}) {
  const problems = [];
  const warnings = [];
  const fail = (check, file, message) => problems.push({ check, file, message });
  const entries = listEntries(root);
  const parts = readSources(root, fail);
  for (const part of parts) checkPart(root, part, fail);
  const skillFolders = checkSkills(root, entries, fail);
  const privateWords = terms ?? privateTerms({ vocabulary: projectVocabulary(parts, skillFolders) });

  let vendorBytes = 0;
  const partBytes = new Map(parts.map((part) => [`${VENDOR_DIR}/${part.id}/`, 0]));
  let textFiles = 0;
  let binaryFiles = 0;
  const risky = new Map();
  for (const entry of entries) {
    const vendored = entry.path.startsWith(`${VENDOR_DIR}/`);
    const badName = nameProblem(entry.path, vendored);
    if (badName) fail('paths', visiblePath(entry.path), `name ${badName}`);
    if (entry.kind === 'symlink') fail('filesystem', entry.path, 'symlinks are not allowed');
    if (entry.kind === 'special') fail('filesystem', entry.path, 'special files are not allowed');
    if (entry.kind !== 'file') continue;
    if (entry.bytes > LIMITS.file) fail('size', entry.path, `${entry.bytes} bytes, limit ${LIMITS.file}`);
    if (vendored) vendorBytes += entry.bytes;
    for (const prefix of partBytes.keys()) if (entry.path.startsWith(prefix)) partBytes.set(prefix, partBytes.get(prefix) + entry.bytes);

    let bytes;
    try {
      bytes = readRegular(path.join(root, ...entry.path.split('/')));
    } catch (error) {
      fail('filesystem', entry.path, error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`);
      continue;
    }
    if (bytes === null) {
      fail('filesystem', entry.path, 'disappeared while the guard ran');
      continue;
    }
    const extension = path.posix.extname(entry.path).toLowerCase();
    if (vendored && MEDIA_EXTENSIONS.has(extension)) fail('file-types', entry.path, 'images, media, fonts and archives are not vendored; exclude it in vendor/sources.json');
    const signature = SIGNATURES.get(extension);
    let text = null;
    if (signature) {
      binaryFiles += 1;
      if (!signature(bytes)) fail('file-types', entry.path, `does not start like a ${extension} file`);
    } else {
      try {
        text = UTF8.decode(bytes);
        textFiles += 1;
      } catch {
        fail('file-types', entry.path, 'is not valid UTF-8 text');
      }
    }
    const searchable = text ?? bytes.toString('latin1');
    const where = (line) => (text === null ? '' : ` (line ${line})`);
    for (const finding of findAll(SECRET_PATTERNS, searchable)) fail('secrets', entry.path, `looks like a ${finding.label}${where(finding.line)}`);
    if (isOwnFile(entry.path)) for (const finding of personalScan(searchable, privateWords)) fail('personal', entry.path, `contains a ${finding.label}${where(finding.line)}`);
    if (text === null) continue;
    const hidden = hiddenCharacters(text);
    if (hidden.length) {
      const shown = hidden.slice(0, 3).map((item) => `${item.codePoint} at ${item.line}:${item.column}`).join(', ');
      fail('hidden-unicode', entry.path, `${hidden.length} hidden or control character(s): ${shown}`);
    }
    if (entry.path.startsWith(`${SKILLS_DIR}/`) && entry.path.endsWith('/openai.yaml') && IMPLICIT_INVOCATION.test(text)) {
      fail('layout', entry.path, 'sets allow_implicit_invocation: true, which lets a host start the skill on its own; exclude agents/ in vendor/sources.json');
    }
    for (const [label, count] of Object.entries(riskyCounts(text))) {
      if (!risky.has(label)) risky.set(label, []);
      risky.get(label).push({ file: entry.path, count });
    }
  }
  for (const [prefix, bytes] of partBytes) if (bytes > LIMITS.part) fail('size', prefix.slice(0, -1), `part is ${bytes} bytes, limit ${LIMITS.part}`);
  if (vendorBytes > LIMITS.vendor) fail('size', VENDOR_DIR, `${vendorBytes} bytes, limit ${LIMITS.vendor}`);

  for (const [label, files] of risky) {
    const total = files.reduce((sum, item) => sum + item.count, 0);
    warnings.push({ check: 'risky', label, count: total, files });
  }
  return {
    ok: problems.length === 0,
    problems,
    warnings,
    stats: { entries: entries.length, textFiles, binaryFiles, parts: parts.length, vendorBytes },
  };
}

const USAGE = 'Usage: node scripts/vendor-guard.mjs [--root <dir>] [--json]';

function parseArgs(argv) {
  const options = { root: ROOT, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--json') {
      options.json = true;
    } else if (flag === '--root') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--root needs a value\n${USAGE}`);
      options.root = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
    }
  }
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  const report = runGuard(options.root);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const warning of report.warnings) {
      process.stdout.write(`warning [risky] ${warning.label}: ${warning.count} in ${warning.files.length} file(s)\n`);
      for (const item of warning.files) process.stdout.write(`  ${item.file} (${item.count})\n`);
    }
    for (const problem of report.problems) process.stderr.write(`[${problem.check}] ${problem.file}: ${problem.message}\n`);
    const binary = report.stats.binaryFiles ? `, ${report.stats.binaryFiles} binary files` : '';
    const summary = `${report.stats.parts} parts, ${report.stats.textFiles} text files${binary}, ${report.stats.vendorBytes} vendored bytes`;
    if (report.ok) process.stdout.write(`Guard passed (${summary}); ${report.warnings.length} warning type(s).\n`);
    else process.stderr.write(`Guard failed with ${report.problems.length} problem(s) (${summary}).\n`);
  }
  if (!report.ok) process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
