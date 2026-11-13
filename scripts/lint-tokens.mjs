#!/usr/bin/env node
/**
 * Trade-dress gate for token sets: fails a set whose values match 3 or more measured values of the reference sites
 * (type styles as a size with its tracking, content widths, nav heights, radii and breakpoints) within 1 px or
 * 0.001 em. Measured values are context for the launch-page part, never tokens; this lint keeps it that way.
 *
 *   node scripts/lint-tokens.mjs [<file.css> ...] [--json]   default: the shipped tokens.css and theme.tailwind.css
 *   node scripts/lint-tokens.mjs --build <values.json>       hash a private values file into evidence/token-hashes.json
 *
 * A set is the declarations outside any mode selector, or those plus the declarations of one
 * [data-launch-mode="<mode>"] selector, which override by name. The measured values are committed only as salted
 * hashes of "<category>:<value>" keys; the values file is private: {"type": [[px, em], ...], "width": [px, ...],
 * "nav": [...], "radius": [...], "breakpoint": [...]}. Exit 0 when every set stays under the limit, 1 when one does
 * not, 2 for bad usage.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, formatJson, isMainModule, sha256 } from './lib/vendor.mjs';
import { TAILWIND_CSS, TOKENS_CSS } from './lib/tokens.mjs';

export const HASHES_FILE = 'evidence/token-hashes.json';
export const LIMIT = 3;
export const CATEGORIES = ['type', 'width', 'nav', 'radius', 'breakpoint'];
const LENGTH = /(-?\d*\.?\d+)(px|rem|em)\b/g;
const MODE = /\[data-launch-mode=["']?([\w-]+)["']?\]/;

export const hashKey = (salt, key) => sha256(Buffer.from(`${salt}\0${key}`));

const thousandths = (value) => String(Number((value / 1000).toFixed(3)));

export function typeKey(size, tracking) {
  return `type:${Math.round(size)}:${thousandths(Math.round(tracking * 1000))}`;
}

export function candidateKeys(category, value, tracking) {
  const near = (center, step) => {
    const values = [];
    for (let k = Math.ceil(center / step - 1 - 1e-6); k <= Math.floor(center / step + 1 + 1e-6); k += 1) values.push(k);
    return values;
  };
  if (category === 'type') {
    return near(value, 1).flatMap((size) => near(tracking, 0.001).map((k) => `type:${size}:${thousandths(k)}`));
  }
  return near(value, 1).map((k) => `${category}:${k}`);
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function parseBlocks(css) {
  const text = stripComments(css);
  const frames = [{ selector: null, declarations: [] }];
  const blocks = [];
  let buffer = '';
  const declare = () => {
    const part = buffer.trim();
    buffer = '';
    const colon = part.indexOf(':');
    if (colon > 0 && frames.length > 1) frames.at(-1).declarations.push({ name: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() });
  };
  for (const char of text) {
    if (char === '{') {
      frames.push({ selector: buffer.trim(), declarations: [] });
      buffer = '';
    } else if (char === '}') {
      declare();
      const frame = frames.length > 1 ? frames.pop() : null;
      const context = frames.slice(1).map((entry) => entry.selector);
      if (frame?.declarations.length) blocks.push({ selector: frame.selector, context, declarations: frame.declarations });
    } else if (char === ';') {
      declare();
    } else {
      buffer += char;
    }
  }
  return blocks.map((block) => ({ ...block, media: block.context.filter((entry) => entry.startsWith('@media')).join(' and '), at: block.context }));
}

const lengths = (value, units) => [...String(value).matchAll(LENGTH)]
  .filter((match) => units.includes(match[2]))
  .map((match) => Number(match[1]) * (match[2] === 'rem' ? 16 : 1));

export function endpoints(value) {
  const found = lengths(value, ['px', 'rem']);
  if (/^clamp\(/i.test(String(value).trim()) && found.length >= 2) return [found[0], found.at(-1)];
  return found.length === 1 ? found : [];
}

function styleOf(name) {
  let match;
  if ((match = /^--type-(.+)-size$/.exec(name))) return { style: match[1], field: 'size' };
  if ((match = /^--type-(.+)-tracking$/.exec(name))) return { style: match[1], field: 'tracking' };
  if ((match = /^--text-(.+)--letter-spacing$/.exec(name))) return { style: match[1], field: 'tracking' };
  if ((match = /^--text-([^-][\w-]*?)$/.exec(name)) && !name.includes('--', 2)) return { style: match[1], field: 'size' };
  if ((match = /^--(?:font-size-(.+)|(.+)-font-size)$/.exec(name))) return { style: match[1] ?? match[2], field: 'size' };
  if ((match = /^--(?:letter-spacing-(.+)|(.+)-letter-spacing|tracking-(.+)|(.+)-tracking)$/.exec(name))) return { style: match[1] ?? match[2] ?? match[3] ?? match[4], field: 'tracking' };
  return null;
}

function categoryOf(name) {
  if (/radius/.test(name)) return 'radius';
  if (/nav/.test(name) && /height/.test(name)) return 'nav';
  if (/breakpoint|^--bp-/.test(name)) return 'breakpoint';
  if (/^--(?:container-|max-width|.*(?:-|^--)(?:width|measure|max)(?:-|$))/.test(name)) return 'width';
  return null;
}

export function collectSets(css) {
  const blocks = parseBlocks(css);
  const base = [];
  const modes = new Map();
  for (const block of blocks) {
    const lang = /:lang\(([\w-]+)\)/.exec(block.selector ?? '')?.[1];
    const mode = lang ? `lang ${lang}` : MODE.exec(block.selector ?? '')?.[1] ?? null;
    for (const declaration of block.declarations) {
      const entry = { ...declaration, media: block.media, selector: block.selector };
      if (mode) {
        if (!modes.has(mode)) modes.set(mode, []);
        modes.get(mode).push(entry);
      } else {
        base.push(entry);
      }
    }
  }
  const sets = [{ name: 'base', entries: base }];
  for (const [mode, entries] of modes) {
    const overridden = new Set(entries.map((entry) => `${entry.media}|${entry.name}`));
    sets.push({ name: mode, entries: [...base.filter((entry) => !overridden.has(`${entry.media}|${entry.name}`)), ...entries] });
  }
  const breakpoints = [...new Set(blocks.flatMap((block) => block.at).filter((entry) => entry.startsWith('@media')))]
    .flatMap((query) => [...query.matchAll(/(?:min|max)-width\s*:\s*(\d*\.?\d+)(px|em|rem)/g)].map((match) => Number(match[1]) * (match[2] === 'px' ? 1 : 16)));
  return { sets, breakpoints };
}

export function setCandidates(entries, breakpoints) {
  const found = [];
  const styles = new Map();
  for (const entry of entries) {
    const style = entry.name.startsWith('--') ? styleOf(entry.name) : null;
    if (style) {
      const key = `${entry.media}|${style.style}`;
      if (!styles.has(key)) styles.set(key, { media: entry.media, style: style.style });
      styles.get(key)[style.field] = entry.value;
      continue;
    }
    if (entry.name === 'font-size' || entry.name === 'letter-spacing') {
      const key = `${entry.media}|${entry.selector}`;
      if (!styles.has(key)) styles.set(key, { media: entry.media, style: entry.selector });
      styles.get(key)[entry.name === 'font-size' ? 'size' : 'tracking'] = entry.value;
      continue;
    }
    const category = entry.name.startsWith('--') ? categoryOf(entry.name)
      : entry.name === 'border-radius' ? 'radius'
        : entry.name === 'max-width' ? 'width'
          : entry.name === 'height' && /nav/.test(entry.selector ?? '') ? 'nav' : null;
    if (!category) continue;
    for (const value of lengths(entry.value, ['px', 'rem']).map((length) => length)) found.push({ category, value, where: `${entry.name}: ${entry.value}` });
  }
  const resolve = (media, style, field) => styles.get(`${media}|${style}`)?.[field] ?? styles.get(`|${style}`)?.[field];
  for (const { media, style } of styles.values()) {
    const size = resolve(media, style, 'size');
    const tracking = resolve(media, style, 'tracking');
    if (!size || !tracking) continue;
    const ems = lengths(tracking, ['em']);
    const track = ems.length ? ems[0] : /^0$/.test(String(tracking).trim()) ? 0 : null;
    if (track === null) continue;
    for (const value of endpoints(size)) found.push({ category: 'type', value, tracking: track, where: `${style}${media ? ` ${media}` : ''}: ${size} / ${tracking}` });
  }
  for (const value of breakpoints) found.push({ category: 'breakpoint', value, where: `@media ${value}px` });
  return found;
}

export function lintCss(css, hashes) {
  const known = new Set(hashes.values);
  const { sets, breakpoints } = collectSets(css);
  return sets.map((set) => {
    const matches = new Map();
    for (const candidate of setCandidates(set.entries, breakpoints)) {
      const hit = candidateKeys(candidate.category, candidate.value, candidate.tracking).find((key) => known.has(hashKey(hashes.salt, key)));
      if (hit && !matches.has(hit)) matches.set(hit, candidate);
    }
    const list = [...matches.values()].map((candidate) => ({ category: candidate.category, where: candidate.where }));
    return { set: set.name, matches: list, ok: list.length < LIMIT };
  });
}

export function loadHashes(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, ...HASHES_FILE.split('/')), 'utf8'));
}

export function buildHashes(values, salt = crypto.randomBytes(16).toString('hex')) {
  const keys = new Set();
  for (const category of CATEGORIES) {
    for (const value of values[category] ?? []) {
      keys.add(category === 'type' ? typeKey(value[0], value[1]) : `${category}:${Math.round(value)}`);
    }
  }
  return {
    description: 'Salted SHA-256 hashes of measured reference-site values for scripts/lint-tokens.mjs, one per "<category>:<value>" key. The values are private context and never committed in clear.',
    salt,
    values: [...keys].map((key) => hashKey(salt, key)).sort(),
  };
}

function main(argv) {
  const json = argv.includes('--json');
  const args = argv.filter((arg) => arg !== '--json');
  if (args[0] === '--build') {
    if (!args[1]) {
      process.stderr.write('Usage: node scripts/lint-tokens.mjs --build <values.json>\n');
      return 2;
    }
    const output = buildHashes(JSON.parse(fs.readFileSync(args[1], 'utf8')));
    fs.writeFileSync(path.join(ROOT, ...HASHES_FILE.split('/')), formatJson(output));
    process.stdout.write(`Wrote ${HASHES_FILE} with ${output.values.length} hashes.\n`);
    return 0;
  }
  if (args.some((arg) => arg.startsWith('--'))) {
    process.stderr.write('Usage: node scripts/lint-tokens.mjs [<file.css> ...] [--json] | --build <values.json>\n');
    return 2;
  }
  const files = args.length ? args : [TOKENS_CSS, TAILWIND_CSS].map((file) => path.join(ROOT, ...file.split('/')));
  const hashes = loadHashes();
  const results = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      process.stderr.write(`${file} does not exist\n`);
      return 2;
    }
    for (const result of lintCss(fs.readFileSync(file, 'utf8'), hashes)) results.push({ file: path.relative(ROOT, file) || file, ...result });
  }
  if (json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  else {
    for (const result of results) {
      process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${result.file} [${result.set}]: ${result.matches.length} measured value(s) matched, limit ${LIMIT - 1}\n`);
      for (const match of result.matches) process.stdout.write(`     ${match.category}: ${match.where}\n`);
    }
  }
  return results.every((result) => result.ok) ? 0 : 1;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
