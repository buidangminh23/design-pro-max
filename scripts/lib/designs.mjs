/**
 * The designs registry: one designs/<name>.json per design skill, each naming its folder skills/<name>. Scripts that
 * used to assume skills/apple iterate over this list instead. The canonical shared runtime lives in shared/ at the
 * repository root; gen.mjs copies it byte for byte into every design's own shared/ folder, because hosts and
 * updaters install one skill folder at a time.
 *
 * Vendored third-party parts belong to the primary design only, the one vendor/sources.json describes. Another
 * design that wants vendored parts needs its own manifest first.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DESIGNS_DIR = 'designs';
export const SHARED_DIR = 'shared';
export const PRIMARY_DESIGN = 'apple';
export const DESIGN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const DESIGN_KEYS = ['design', 'skill'];

export const designSkillDir = (name) => `skills/${name}`;
export const designVendorDir = (name) => `${designSkillDir(name)}/.vendor`;
export const designSharedDir = (name) => `${designSkillDir(name)}/${SHARED_DIR}`;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The problems with one design record read from designs/<file>.
 */
export function designProblems(file, design) {
  const label = `${DESIGNS_DIR}/${file}`;
  if (!design || typeof design !== 'object' || Array.isArray(design)) return [`${label}: must be a JSON object`];
  const problems = [];
  const stem = file.replace(/\.json$/, '');
  for (const key of DESIGN_KEYS) if (typeof design[key] !== 'string') problems.push(`${label}: needs a string ${key}`);
  if (typeof design.design === 'string') {
    if (!DESIGN_NAME.test(design.design)) problems.push(`${label}: design ${JSON.stringify(design.design)} must be lowercase words joined by "-"`);
    if (design.design !== stem) problems.push(`${label}: design ${JSON.stringify(design.design)} must match its file name ${stem}`);
    if (typeof design.skill === 'string' && design.skill !== designSkillDir(design.design)) problems.push(`${label}: skill must be ${designSkillDir(design.design)}`);
  }
  if ('marks' in design && (!Array.isArray(design.marks) || design.marks.some((mark) => typeof mark !== 'string' || !mark.trim()))) {
    problems.push(`${label}: marks must be a list of non-empty strings`);
  }
  if ('owner' in design && (typeof design.owner !== 'string' || !design.owner.trim())) problems.push(`${label}: owner must be a non-empty string`);
  return problems;
}

/**
 * Every design in designs/*.json, sorted by name, each with the folders scripts derive from it. Throws when a record
 * is malformed or when the primary design is missing.
 */
export function loadDesigns(root) {
  const dir = path.join(root, DESIGNS_DIR);
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name).sort(compare)
    : [];
  const designs = [];
  const problems = [];
  for (const file of files) {
    let design;
    try {
      design = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (error) {
      problems.push(`${DESIGNS_DIR}/${file}: ${error.message}`);
      continue;
    }
    const found = designProblems(file, design);
    if (found.length) {
      problems.push(...found);
      continue;
    }
    designs.push({
      ...design,
      name: design.design,
      file: `${DESIGNS_DIR}/${file}`,
      marks: design.marks ?? [],
      primary: design.design === PRIMARY_DESIGN,
      skillDir: designSkillDir(design.design),
      vendorDir: designVendorDir(design.design),
      sharedDir: designSharedDir(design.design),
    });
  }
  if (!problems.length && !designs.some((design) => design.primary)) problems.push(`${DESIGNS_DIR}/${PRIMARY_DESIGN}.json: the primary design is missing`);
  if (problems.length) throw new Error(problems.join('\n'));
  return designs;
}

/**
 * The design names in designs/, or the primary design alone when the folder has none, as in a minimal test checkout.
 */
export function designNames(root) {
  const dir = path.join(root, DESIGNS_DIR);
  if (!fs.existsSync(dir) || !fs.readdirSync(dir).some((name) => name.endsWith('.json'))) return [PRIMARY_DESIGN];
  return loadDesigns(root).map((design) => design.name);
}
