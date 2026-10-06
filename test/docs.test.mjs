import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSources } from '../scripts/lib/vendor.mjs';
import { ROOT } from './helpers.mjs';

const manifest = loadSources(ROOT);
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

test('the README credits every part with its pinned commit', () => {
  const credits = readme.slice(readme.indexOf('\n## Credits\n'), readme.indexOf('\n## Maintenance\n'));
  assert.ok(credits.length > 0, 'the README has a Credits section before Maintenance');
  for (const part of manifest.parts) {
    const row = credits.split('\n').find((line) => line.startsWith(`| \`${part.id}\` |`));
    assert.ok(row, `${part.id} has a credits row`);
    assert.ok(row.includes(part.commit.slice(0, 12)), `${part.id} shows its commit`);
    assert.ok(row.includes(`https://github.com/${part.repo}`), `${part.id} links its repository`);
  }
});

test('the README carries the required disclaimers', () => {
  for (const sentence of [
    'design-pro-max is an independent open-source project and has not been authorized, sponsored, or otherwise approved by Apple Inc.',
    'Apple, Swift, SwiftUI, Xcode, TestFlight and App Store are trademarks of Apple Inc., registered in the U.S. and other countries and regions.',
    'design-pro-max is unrelated to nextlevelbuilder/ui-ux-pro-max.',
  ]) {
    assert.ok(readme.includes(sentence), sentence);
  }
});

test('the package manifest matches the repository conventions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'design-pro-max');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.scripts.test, 'node --test test/*.test.mjs');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('git keeps vendored bytes as they are', () => {
  const attributes = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  assert.match(attributes, /^skills\/apple\/\.vendor\/\*\* -text/m);
});
