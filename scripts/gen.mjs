#!/usr/bin/env node
/**
 * Writes the files derived from the skill folders and vendor/sources.json, or checks them with --check:
 *
 *   skills.json                              every skill as { name, path }, for installers
 *   skills/apple/references/parts-index.md   every part with its group, status, activation check, prerequisites and
 *                                            errata pointers
 *   README.md                                the credits table and the trademark line
 *   skills/apple/NOTICE.md                   the trademark line
 *
 *   node scripts/gen.mjs [--check] [--root <dir>]
 *
 * In README.md and NOTICE.md only the lines between <!-- gen:<name> --> and <!-- /gen:<name> --> are generated. The
 * trademark line names the Apple marks that the project's own shipped text uses, plus the Apple logo while the skill
 * ships it as its icon, and adds Cisco's IOS sentence whenever it names iOS.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  SKILLS_DIR,
  SKILL_DIR,
  SOURCES_FILE,
  VENDOR_DIR,
  authorsFrom,
  compareStrings,
  copyrightLines,
  describeEntry,
  formatJson,
  isMainModule,
  isMitLicence,
  loadSources,
  parseFrontmatter,
  readRegular,
  walk,
  writeRegular,
} from './lib/vendor.mjs';

export const SKILLS_FILE = 'skills.json';
export const PARTS_INDEX_FILE = `${SKILL_DIR}/references/parts-index.md`;
export const README_FILE = 'README.md';
export const NOTICE_FILE = `${SKILL_DIR}/NOTICE.md`;
export const LOGO_FILE = `${SKILL_DIR}/assets/apple.svg`;
export const APPLE_MARKS = ['Apple', 'iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS', 'iPhone', 'iPad', 'Mac', 'Apple Watch', 'Safari', 'Siri', 'Swift', 'SwiftUI', 'Xcode', 'TestFlight', 'App Store'];
export const CISCO_SENTENCE = 'IOS is a trademark or registered trademark of Cisco in the U.S. and other countries and is used under license.';

const OWN_TEXT_FILES = [README_FILE, 'CHANGELOG.md', SKILLS_FILE];
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt']);
const POINTER = /((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z0-9]+):(\d+(?:-\d+)?)((?:(?:,\s*|,?\s+and\s+):\d+(?:-\d+)?)*)/g;
const USAGE = 'Usage: node scripts/gen.mjs [--check] [--root <dir>]';

const startMarker = (name) => `<!-- gen:${name} -->`;
const endMarker = (name) => `<!-- /gen:${name} -->`;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const groupOf = (part) => (part.id.includes('/') ? part.id.split('/')[0] : '');
const groupTitle = (group) => (group ? `\`${group}/\`` : 'Top level');

function readText(root, relative) {
  let bytes;
  try {
    bytes = readRegular(path.join(root, ...relative.split('/')));
  } catch (error) {
    throw new Error(`${relative}: ${error.code === 'ENOTREG' ? error.message : `cannot be read (${error.code ?? error.message})`}`);
  }
  if (bytes === null) throw new Error(`${relative}: is missing`);
  return bytes.toString('utf8');
}

/**
 * Every skill folder under skills/ as { name, path }, sorted by name. A folder whose SKILL.md names another skill is
 * an error, because installers find a skill by its folder.
 */
export function skillsList(root = ROOT) {
  const base = path.join(root, SKILLS_DIR);
  const names = fs.existsSync(base) ? fs.readdirSync(base).sort(compareStrings) : [];
  const skills = [];
  for (const folder of names) {
    const relative = `${SKILLS_DIR}/${folder}`;
    if (folder.startsWith('.') || describeEntry(root, relative)?.kind !== 'dir') continue;
    const name = parseFrontmatter(readText(root, `${relative}/SKILL.md`))?.name;
    if (name !== folder) throw new Error(`${relative}/SKILL.md: frontmatter name ${JSON.stringify(name ?? null)} must match its folder ${folder}`);
    skills.push({ name, path: relative });
  }
  if (!skills.length) throw new Error(`${SKILLS_DIR}/ holds no skill`);
  return skills;
}

/**
 * The file:line pointers in one erratum: "references/a.md:381, :386 and :418 use ..." gives
 * ["references/a.md:381, :386, :418"]. An erratum about a whole part gives an empty list.
 */
export function errataPointers(text) {
  return [...text.matchAll(POINTER)].map((match) => {
    const more = [...match[3].matchAll(/:(\d+(?:-\d+)?)/g)].map((item) => `:${item[1]}`);
    return [`${match[1]}:${match[2]}`, ...more].join(', ');
  });
}

/**
 * The activation check and the prerequisites that the parts of one group share: the activation that most parts use
 * when at least two do, and the prerequisites every part lists.
 */
function sharedByGroup(parts) {
  if (parts.length < 2) return { activation: null, prerequisites: [] };
  const counts = new Map();
  for (const part of parts) counts.set(part.activation, (counts.get(part.activation) ?? 0) + 1);
  const [activation, uses] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const prerequisites = parts[0].prerequisites.filter((item) => parts.every((part) => part.prerequisites.includes(item)));
  return { activation: uses >= 2 ? activation : null, prerequisites };
}

function partEntry(part, shared) {
  const lines = [
    `### \`${part.id.split('/').at(-1)}\``,
    '',
    `- Guide: \`.vendor/${part.id}/SKILL.md\``,
    `- Status: ${part.active ? 'active' : 'inactive until its activation check passes'}`,
  ];
  if (part.activation !== shared.activation) lines.push(`- Activation: ${part.activation}`);
  const own = part.prerequisites.filter((item) => !shared.prerequisites.includes(item));
  if (own.length) lines.push('- Prerequisites:', ...own.map((item) => `  - ${item}`));
  const pointers = part.errata.map(errataPointers);
  const located = pointers.filter((list) => list.length).map((list) => list.map((pointer) => `\`${pointer}\``).join(', '));
  const general = pointers.filter((list) => !list.length).length;
  const whole = general ? [`${located.length ? 'plus ' : ''}${general === 1 ? 'one' : general} about the whole part`] : [];
  lines.push(part.errata.length ? `- Errata (${part.errata.length}): ${[...located, ...whole].join('; ')}` : '- Errata: none recorded');
  lines.push(part.risks.length ? `- Risks: ${part.risks.length}` : '- Risks: none recorded');
  lines.push(`- Record: \`.vendor/${part.id}/UPSTREAM.json\` holds the full text of all of the above`);
  return lines;
}

/**
 * skills/apple/references/parts-index.md: every part by group, with its status, activation check, prerequisites and
 * the file:line pointers of its errata. Text the parts of a group share is stated once for the group.
 */
export function buildPartsIndex(manifest) {
  const groups = new Map();
  for (const part of manifest.parts) {
    const group = groupOf(part);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(part);
  }
  const lines = [
    '# Parts index',
    '',
    `Generated from \`${SOURCES_FILE}\` by \`node scripts/gen.mjs\`; do not edit it by hand. Paths are relative to the apple skill's folder, the folder of \`SKILL.md\`; an erratum pointer such as \`SKILL.md:89\` is relative to its part's folder. An erratum overrides the line it names, and each part's \`UPSTREAM.json\` holds the full text of its prerequisites, risks and errata.`,
    '',
    '| Group | Parts | Active |',
    '|---|---|---|',
    ...[...groups].map(([group, parts]) => `| ${groupTitle(group)} | ${parts.length} | ${parts.filter((part) => part.active).length} |`),
  ];
  for (const [group, parts] of groups) {
    const shared = group ? sharedByGroup(parts) : { activation: null, prerequisites: [] };
    lines.push('', `## ${groupTitle(group)}`);
    if (shared.activation) lines.push('', `Activation, unless a part below names its own: ${shared.activation}`);
    if (shared.prerequisites.length) lines.push('', 'Prerequisites of every part below:', '', ...shared.prerequisites.map((item) => `- ${item}`));
    for (const part of parts) lines.push('', ...partEntry(part, shared));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The README credits table: one row per part with its authors from its LICENSE, its repository and its pinned commit.
 */
export function buildCredits(root, manifest) {
  const rows = manifest.parts.map((part) => {
    const licence = readText(root, `${VENDOR_DIR}/${part.id}/LICENSE`);
    const authors = copyrightLines(licence).map(authorsFrom).filter(Boolean).join('; ') || 'not stated';
    return `| \`${part.id}\` | ${authors} | [${part.repo}](https://github.com/${part.repo}) | \`${part.commit.slice(0, 12)}\` | ${isMitLicence(licence) ? 'MIT' : 'see its LICENSE'} |`;
  });
  return ['| Part | Author | Repository | Commit | Licence |', '|---|---|---|---|---|', ...rows].join('\n');
}

/**
 * The Apple marks a text uses, in the order of APPLE_MARKS. A mark counts only as a whole word: Swift inside SwiftUI
 * or iPad inside iPadOS does not.
 */
export function usedMarks(text) {
  return APPLE_MARKS.filter((mark) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(mark)}(?![\\p{L}\\p{N}_])`, 'u').test(text));
}

/**
 * The trademark sentence for a list of marks, with the Apple logo after Apple when `logo` is set and Cisco's IOS
 * sentence when iOS is named.
 */
export function trademarkLine(marks, { logo = false } = {}) {
  const names = [...marks];
  if (logo) names.splice(names.includes('Apple') ? names.indexOf('Apple') + 1 : 0, 0, 'the Apple logo');
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const sentence = `${list[0].toUpperCase()}${list.slice(1)} ${names.length === 1 ? 'is a trademark' : 'are trademarks'} of Apple Inc., registered in the U.S. and other countries and regions.`;
  return marks.includes('iOS') ? `${sentence} ${CISCO_SENTENCE}` : sentence;
}

/**
 * Replace the lines between the start and end markers of one gen block, keeping the markers.
 */
export function replaceBlock(text, name, body, file) {
  const lines = text.split('\n');
  const starts = lines.flatMap((line, index) => (line === startMarker(name) ? [index] : []));
  const ends = lines.flatMap((line, index) => (line === endMarker(name) ? [index] : []));
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new Error(`${file}: needs exactly one ${startMarker(name)} line followed by one ${endMarker(name)} line`);
  }
  return [...lines.slice(0, starts[0] + 1), '', ...body.split('\n'), '', ...lines.slice(ends[0])].join('\n');
}

function withoutBlocks(text) {
  return text.replace(/^<!-- gen:trademarks -->$[\s\S]*?^<!-- \/gen:trademarks -->$/gm, '');
}

/**
 * The project's own text that ships in a release: README.md, CHANGELOG.md, skills.json and every text file in a skill
 * folder outside its dot-folders. Generated files are taken from `generated` when present there.
 */
function ownText(root, generated) {
  const files = new Set(OWN_TEXT_FILES);
  for (const skill of skillsList(root)) {
    for (const entry of walk(root, skill.path)) {
      const inside = entry.path.slice(skill.path.length + 1).split('/');
      if (entry.kind !== 'file' || inside.some((segment) => segment.startsWith('.'))) continue;
      if (TEXT_EXTENSIONS.has(path.posix.extname(entry.path).toLowerCase())) files.add(entry.path);
    }
  }
  for (const file of generated.keys()) files.add(file);
  const texts = [];
  for (const file of [...files].sort(compareStrings)) {
    if (generated.has(file)) texts.push(generated.get(file));
    else if (describeEntry(root, file)?.kind === 'file') texts.push(readText(root, file));
  }
  return withoutBlocks(texts.join('\n'));
}

/**
 * Every generated file with its expected content, plus the marks and the trademark line they were built from.
 */
export function generate(root = ROOT) {
  const manifest = loadSources(root);
  const files = new Map();
  files.set(SKILLS_FILE, formatJson(skillsList(root)));
  files.set(PARTS_INDEX_FILE, buildPartsIndex(manifest));
  const readme = replaceBlock(readText(root, README_FILE), 'credits', buildCredits(root, manifest), README_FILE);
  files.set(README_FILE, readme);
  const marks = usedMarks(ownText(root, files));
  const line = trademarkLine(marks, { logo: describeEntry(root, LOGO_FILE)?.kind === 'file' });
  files.set(README_FILE, replaceBlock(readme, 'trademarks', line, README_FILE));
  files.set(NOTICE_FILE, replaceBlock(readText(root, NOTICE_FILE), 'trademarks', line, NOTICE_FILE));
  return { files, marks, trademarks: line };
}

/**
 * The generated files whose content on disk differs from what generate() builds.
 */
export function staleFiles(root = ROOT) {
  const { files } = generate(root);
  const stale = [];
  for (const [file, content] of files) {
    let current = null;
    try {
      current = readRegular(path.join(root, ...file.split('/')))?.toString('utf8') ?? null;
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
    if (current !== content) stale.push(file);
  }
  return stale;
}

function parseArgs(argv) {
  const options = { check: false, root: ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--check') {
      options.check = true;
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
  if (options.check) {
    const stale = staleFiles(options.root);
    for (const file of stale) process.stderr.write(`${file} is out of date; run node scripts/gen.mjs\n`);
    if (stale.length) process.exitCode = 1;
    else process.stdout.write('Generated files are up to date.\n');
    return;
  }
  const { files } = generate(options.root);
  for (const [file, content] of files) {
    const target = path.join(options.root, ...file.split('/'));
    if (readRegular(target)?.toString('utf8') === content) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeRegular(target, content);
    process.stdout.write(`Wrote ${file}.\n`);
  }
  process.stdout.write('Generated files are up to date.\n');
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
