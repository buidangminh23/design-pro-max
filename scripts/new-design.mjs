#!/usr/bin/env node
/**
 * Scaffolds a second (or later) design skill beside the primary one:
 *
 *   designs/<name>.json          the design record: its name, its folder and the marks it may name
 *   skills/<name>/SKILL.md       a router stub whose frontmatter name matches its folder
 *   skills/<name>/assets/icon.svg
 *                                a neutral placeholder icon of its own, never a brand logo
 *   skills/<name>/NOTICE.md      only with --marks: a trademarks block that gen.mjs fills in
 *   skills/<name>/shared/        the byte-identical copy of shared/, written by gen.mjs
 *
 * then runs gen.mjs so skills.json and every generated file include the new design.
 *
 *   node scripts/new-design.mjs <name> [--marks "<mark>, <mark>"] [--owner "<owner>"] [--root <dir>]
 *
 * A design name is neutral: lowercase words joined by "-", naming no mark of any design, so a brand never becomes a
 * skill name. The placeholder icon is new media, so release verification rejects it until its bytes are reviewed and
 * recorded in scripts/lib/media.mjs; the script prints the hash to record.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DESIGNS_DIR, DESIGN_NAME, designSkillDir, loadDesigns } from './lib/designs.mjs';
import { ROOT, SKILLS_DIR, formatJson, isMainModule, sha256 } from './lib/vendor.mjs';
import { writeGenerated } from './gen.mjs';

const USAGE = 'Usage: node scripts/new-design.mjs <name> [--marks "<mark>, <mark>"] [--owner "<owner>"] [--root <dir>]';

export const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="4">
  <rect x="8" y="8" width="48" height="48" rx="12"/>
  <circle cx="32" cy="32" r="10"/>
</svg>
`;

const words = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * The marks that a design name contains as whole words, compared case-insensitively.
 */
export function marksInName(name, marks) {
  const nameWords = words(name);
  return marks.filter((mark) => {
    const markWords = words(mark);
    if (!markWords.length) return false;
    return nameWords.some((_, start) => markWords.every((word, offset) => nameWords[start + offset] === word));
  });
}

export function routerStub(name) {
  return `---
name: ${name}
description: For the ${name} design. Use when a task asks for the ${name} design, not for the other designs of design-pro-max.
---

# ${name}

A scaffold: this design has no parts yet.

- \`shared/\` is a generated copy of the repository's \`shared/\` folder. Edit \`shared/\` at the repository root and run \`node scripts/gen.mjs\`; never edit the copy.
- \`assets/icon.svg\` is a neutral placeholder icon of this design's own.
`;
}

export function noticeStub(name) {
  return `# Notice

This notice belongs to the ${name} skill of design-pro-max.

<!-- gen:trademarks -->
<!-- /gen:trademarks -->
`;
}

function parseArgs(argv) {
  const options = { name: null, marks: [], owner: null, root: ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (['--marks', '--owner', '--root'].includes(flag)) {
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value\n${USAGE}`);
      if (flag === '--marks') options.marks = value.split(',').map((mark) => mark.trim()).filter(Boolean);
      if (flag === '--owner') options.owner = value.trim();
      if (flag === '--root') options.root = path.resolve(value);
      index += 1;
    } else if (!flag.startsWith('--') && options.name === null) {
      options.name = flag;
    } else {
      throw new Error(`Unknown argument: ${flag}\n${USAGE}`);
    }
  }
  if (!options.name) throw new Error(`A design name is required\n${USAGE}`);
  return options;
}

/**
 * Create the design's files below `root` and regenerate. Returns the created paths and the generator's changes.
 */
export function newDesign(root, name, { marks = [], owner = null } = {}) {
  if (!DESIGN_NAME.test(name)) throw new Error(`${name}: a design name is lowercase words joined by "-"`);
  const designs = loadDesigns(root);
  const record = `${DESIGNS_DIR}/${name}.json`;
  const skill = designSkillDir(name);
  if (designs.some((design) => design.name === name) || fs.existsSync(path.join(root, ...record.split('/')))) throw new Error(`${record} already exists`);
  if (fs.existsSync(path.join(root, SKILLS_DIR, name))) throw new Error(`${skill} already exists; pick a name no skill uses`);
  const named = marksInName(name, [...new Set([...marks, ...designs.flatMap((design) => design.marks)])]);
  if (named.length) throw new Error(`${name}: a design name must be neutral, but it names ${named.join(', ')}`);
  if (owner !== null && !marks.length) throw new Error('--owner needs --marks: it names the owner of those marks');

  const created = [];
  const write = (relative, content) => {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { flag: 'wx' });
    created.push(relative);
  };
  write(record, formatJson({ design: name, skill, marks, ...(owner ? { owner } : {}) }));
  write(`${skill}/SKILL.md`, routerStub(name));
  write(`${skill}/assets/icon.svg`, ICON);
  if (marks.length) write(`${skill}/NOTICE.md`, noticeStub(name));
  return { created, changes: writeGenerated(root) };
}

function main(argv) {
  const options = parseArgs(argv);
  const { created, changes } = newDesign(options.root, options.name, { marks: options.marks, owner: options.owner });
  for (const file of created) process.stdout.write(`Created ${file}.\n`);
  for (const line of changes) process.stdout.write(`${line}\n`);
  const icon = `${designSkillDir(options.name)}/assets/icon.svg`;
  process.stdout.write([
    '',
    'Next steps:',
    `- Review ${icon} and add it to REVIEWED_MEDIA in scripts/lib/media.mjs with sha256 ${sha256(Buffer.from(ICON))}, or replace it with the design's own icon and record that hash.`,
    '- Add the design to README.md and to CHANGELOG.md under [Unreleased].',
    '- Run npm test and node scripts/vendor-guard.mjs.',
    '',
  ].join('\n'));
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
