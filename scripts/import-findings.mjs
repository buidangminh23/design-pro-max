#!/usr/bin/env node
/**
 * Ties evidence/ledger.json to the private research folder that the entries were written from. The folder never
 * enters the repository; this script runs on the owner's machine before each tag.
 *
 *   node scripts/import-findings.mjs --check <research folder>   prove every id maps to its source and the hashes match
 *   node scripts/import-findings.mjs --write <research folder>   record the current hashes in sourceSha
 *
 * A finding id <AREA>-<n> is findings[n] of research/<area>.findings.json; its hash is the SHA-256 of that finding as
 * JSON. A notes id <AREA>-N<k> is a section of research/<area>.md, hashed from its heading to the next heading of the
 * same or a higher level. Policies (POL-<k>) have no source file and keep a hash of their own claim. An area code that
 * AREAS does not name, such as one for a private benchmark, resolves to the one findings file in the folder that no
 * named area claims, so its name stays out of the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEDGER_FILE, loadLedger } from './lib/evidence.mjs';
import { ROOT, formatJson, isMainModule, sha256 } from './lib/vendor.mjs';

export const AREAS = { AM: 'apple-motion', AD: 'apple-design', TQ: 'techniques-2026', PV: 'product-video', SC: 'scroll-cinema', EC: 'ecosystem' };

const FINDINGS_SUFFIX = '.findings.json';

/** The area name behind a code: from AREAS, or the single findings file in the folder that no named area claims. */
export function areaName(folder, code) {
  if (AREAS[code]) return { name: AREAS[code] };
  const named = new Set(Object.values(AREAS));
  const unclaimed = fs.readdirSync(folder).filter((file) => file.endsWith(FINDINGS_SUFFIX)).map((file) => file.slice(0, -FINDINGS_SUFFIX.length)).filter((name) => !named.has(name));
  if (unclaimed.length === 1) return { name: unclaimed[0] };
  return { problem: `unknown area ${code}: ${unclaimed.length} unnamed findings files, expected one` };
}

/** Notes ids and the heading that opens their section. */
export const NOTES = {
  'SC-N0': '### R4.',
  'SC-N1': '### R1.',
  'TQ-N0': '## 6.',
  'TQ-N1': '## 6.',
};

function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start < 0) return null;
  const level = heading.match(/^#+/)[0].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#+)\s/.exec(lines[index]);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** The SHA-256 of the private source behind one ledger id, or an explanation of why it has none. */
export function sourceHash(folder, id, entry) {
  if (id.startsWith('POL-')) return { sha: sha256(Buffer.from(entry.claim)) };
  const [area, index] = id.split('-');
  const { name, problem } = areaName(folder, area);
  if (problem) return { problem: `${id}: ${problem}` };
  if (index.startsWith('N')) {
    const heading = NOTES[id];
    if (!heading) return { problem: `${id}: no notes section is mapped for it` };
    const file = path.join(folder, `${name}.md`);
    if (!fs.existsSync(file)) return { problem: `${id}: ${name}.md is missing` };
    const text = section(fs.readFileSync(file, 'utf8'), heading);
    return text ? { sha: sha256(Buffer.from(text)) } : { problem: `${id}: ${name}.md has no section ${heading}` };
  }
  const file = path.join(folder, `${name}${FINDINGS_SUFFIX}`);
  if (!fs.existsSync(file)) return { problem: `${id}: ${name}${FINDINGS_SUFFIX} is missing` };
  const finding = JSON.parse(fs.readFileSync(file, 'utf8')).findings?.[Number(index)];
  return finding ? { sha: sha256(Buffer.from(JSON.stringify(finding))) } : { problem: `${id}: ${name}.findings.json has no finding ${index}` };
}

export function compare(folder, ledger) {
  const problems = [];
  const hashes = {};
  for (const [id, entry] of Object.entries(ledger.entries)) {
    const result = sourceHash(folder, id, entry);
    if (result.problem) problems.push(result.problem);
    else {
      hashes[id] = result.sha;
      if (entry.sourceSha !== result.sha) problems.push(`${id}: sourceSha differs from its source; reread the source and rerun --write`);
    }
  }
  return { problems, hashes };
}

function main(argv) {
  const [mode, folder] = argv;
  if (!['--check', '--write'].includes(mode) || !folder) throw new Error('Usage: node scripts/import-findings.mjs --check|--write <research folder>');
  const research = fs.existsSync(path.join(folder, 'research')) ? path.join(folder, 'research') : folder;
  const ledger = loadLedger(ROOT);
  const { problems, hashes } = compare(research, ledger);
  if (mode === '--write') {
    const missing = problems.filter((problem) => !problem.includes('sourceSha differs'));
    if (missing.length) throw new Error(missing.join('\n'));
    for (const [id, sha] of Object.entries(hashes)) ledger.entries[id].sourceSha = sha;
    fs.writeFileSync(path.join(ROOT, ...LEDGER_FILE.split('/')), formatJson(ledger));
    process.stdout.write(`Recorded ${Object.keys(hashes).length} source hashes in ${LEDGER_FILE}.\n`);
    return 0;
  }
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  if (!problems.length) process.stdout.write(`All ${Object.keys(hashes).length} ledger ids map to their sources.\n`);
  return problems.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
