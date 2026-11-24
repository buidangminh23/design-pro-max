import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const SKILL_ROOT = path.join(ROOT, 'skills', 'apple');
const RELATIVE = /`(\.\.?\/[^`\s]+)`|\]\((\.\.?\/[^)\s]+)\)/g;

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.vendor') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function relativeTargets(file) {
  const text = fs.readFileSync(file, 'utf8');
  return [...text.matchAll(RELATIVE)]
    .map((match) => match[1] ?? match[2])
    .filter((target) => !target.includes('<'));
}

function brokenTargets(file) {
  return relativeTargets(file).filter((target) => {
    const resolved = path.resolve(path.dirname(file), target.split('#')[0]);
    return !fs.existsSync(resolved);
  });
}

test('the skill markdown has relative links to check', () => {
  const count = markdownFiles(SKILL_ROOT).reduce((sum, file) => sum + relativeTargets(file).length, 0);
  assert.ok(count > 20, `found ${count} relative links`);
});

test('every relative link in the skill markdown resolves from its own file', () => {
  const broken = markdownFiles(SKILL_ROOT).flatMap((file) =>
    brokenTargets(file).map((target) => `${path.relative(ROOT, file)} -> ${target}`),
  );
  assert.deepEqual(broken, []);
});
