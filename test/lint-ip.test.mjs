import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKS,
  appleTextFindings,
  hashTerm,
  hashedTermFindings,
  lintIp,
  loadDesign,
  phraseFindings,
  shingleWords,
  shingles,
  substitutionFindings,
  versionFindings,
} from '../scripts/lint-ip.mjs';
import { APPLE_MARKS } from '../scripts/gen.mjs';
import { ROOT } from './helpers.mjs';

const design = loadDesign(ROOT);
const SALT = 'fixture-salt';

test('lint-ip passes every check on the repository', () => {
  assert.deepEqual(CHECKS, ['identifiers', 'apple-text', 'phrases', 'substitution', 'privacy', 'versions']);
  assert.deepEqual(lintIp(ROOT), []);
});

test('designs/apple.json names the marks gen.mjs credits and the newest released OS', () => {
  assert.deepEqual(design.marks, APPLE_MARKS);
  assert.equal(typeof design.newestReleasedOS, 'number');
  for (const key of ['referentialPhrase', 'trademarkPolicy', 'siteTerms', 'measuringMethod', 'neverShip', 'appleText', 'phraseGates', 'signOff']) assert.ok(design[key], key);
});

test('identifiers: a reference line carrying one denylisted identifier fails, by hash only', () => {
  const hashes = [hashTerm(SALT, 'zz-hero-lockup'), hashTerm(SALT, 'clip_zz.mp4')];
  const text = 'Pin the stage.\nStyle it like `.zz-hero-lockup` and load clip_zz.mp4.\n';
  assert.deepEqual(hashedTermFindings(text, SALT, hashes).map((item) => [item.line, item.token]), [[2, 'zz-hero-lockup'], [2, 'clip_zz.mp4']]);
  assert.deepEqual(hashedTermFindings('Pin the stage with --scene-progress.\n', SALT, hashes), []);
  assert.deepEqual(hashedTermFindings('Load --ZZ-HERO-LOCKUP.\n', SALT, hashes).map((item) => item.token), ['zz-hero-lockup']);
});

test('apple text: a pasted paragraph of the corpus fails; a short attributed quote passes', () => {
  const source = 'Use a sticky container to keep the product in view while the reader scrolls through every feature of the page.';
  const corpus = shingles(shingleWords(source, 0), 8).map((item) => hashTerm(SALT, item.text));
  assert.deepEqual(appleTextFindings(`Intro.\n${source}\n`, SALT, corpus).map((item) => item.line), [2]);
  assert.deepEqual(appleTextFindings('As the guide puts it, "keep the product in view while the reader scrolls through every feature".\n', SALT, corpus), []);
  assert.deepEqual(appleTextFindings('Keep the product visible as the page scrolls.\n', SALT, corpus), []);
});

test('phrases: imitation and endorsement wording fails in English and Vietnamese; a disclaimer passes', () => {
  const find = (text) => phraseFindings(text, design.phraseGates, design.marks).map((item) => item.phrase);
  assert.equal(find('An Apple-style launch page for your app.').length, 1);
  assert.equal(find('Trang ra mắt chuẩn Apple cho ứng dụng.').length, 1);
  assert.equal(find('Officially approved for iPhone apps.').length, 2);
  assert.deepEqual(find('design-pro-max has not been authorized, sponsored, or otherwise approved by Apple Inc.'), []);
  assert.deepEqual(find('Design skills for coding agents, starting with guides for Apple platforms.'), []);
});

test('substitution: host substitution syntax fails in the router', () => {
  for (const line of ['Read @references/x.md first.', 'Run with $ARGUMENTS.', 'Use $1 as the name.', 'Root: ${CLAUDE_SKILL_DIR}/x', 'Now !`ls`.', 'See @guide.md.']) {
    assert.equal(substitutionFindings(line).length, 1, line);
  }
  for (const line of ['Email the maintainer via the issue tracker.', 'Pass `--project <path>`.', 'Costs $5 a month? No: it is free.'.replace('$5', 'five dollars')]) {
    assert.deepEqual(substitutionFindings(line), [], line);
  }
});

test('privacy: a reference that names a private machine fails', () => {
  const hashes = [hashTerm(SALT, 'zz-build-box')];
  assert.deepEqual(hashedTermFindings('Measured on ZZ-Build-Box at night.\n', SALT, hashes).map((item) => item.line), [1]);
});

test('versions: an erratum that names an unreleased seed fails', () => {
  assert.deepEqual(versionFindings('Fixed in iOS 28.1 beta 2.', 27).map((item) => item.version), ['iOS 28.1']);
  assert.deepEqual(versionFindings('Deprecated in SDK 26 and 27; works on macOS 15 to 26.', 27), []);
  assert.equal(versionFindings('Needs iOS 26 through 28.', 27).length, 1);
});
