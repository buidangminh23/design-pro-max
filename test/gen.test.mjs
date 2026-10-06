import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR, loadSources } from '../scripts/lib/vendor.mjs';
import {
  CISCO_SENTENCE,
  NOTICE_FILE,
  PARTS_INDEX_FILE,
  README_FILE,
  SKILLS_FILE,
  errataPointers,
  generate,
  replaceBlock,
  staleFiles,
  trademarkLine,
  usedMarks,
} from '../scripts/gen.mjs';
import { ROOT, copyCheckout, removeTree, runScript } from './helpers.mjs';

const GEN = path.join(ROOT, 'scripts', 'gen.mjs');
const manifest = loadSources(ROOT);
const read = (root, file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');

test('the committed generated files are up to date', () => {
  assert.deepEqual(staleFiles(ROOT), []);
});

test('skills.json lists the apple skill and its folder', () => {
  assert.deepEqual(JSON.parse(read(ROOT, SKILLS_FILE)), [{ name: 'apple', path: 'skills/apple' }]);
});

test('the parts index covers every part with its group, status, activation and errata pointers', () => {
  const index = read(ROOT, PARTS_INDEX_FILE);
  for (const part of manifest.parts) {
    assert.ok(index.includes(`### \`${part.id.split('/').at(-1)}\``), `${part.id} heading`);
    assert.ok(index.includes(`- Guide: \`.vendor/${part.id}/SKILL.md\``), `${part.id} guide`);
    assert.ok(index.includes(`\`.vendor/${part.id}/UPSTREAM.json\``), `${part.id} record`);
    assert.ok(index.includes(part.activation), `${part.id} activation`);
    for (const item of part.prerequisites) assert.ok(index.includes(item), `${part.id} prerequisite`);
  }
  assert.match(index, /\| `xcode-build\/` \| 6 \| 0 \|/);
  assert.match(index, /\| `app-store-connect\/` \| 25 \| 0 \|/);
  assert.match(index, /- Errata \(3\): `SKILL\.md:89`; `references\/threading\.md:306, :342, :470`; `SKILL\.md:20`/);
  assert.match(index, /- Errata \(1\): `references\/batch-operations\.md:26-34`/);
});

test('the router points to the parts index', () => {
  const router = read(ROOT, `${SKILL_DIR}/SKILL.md`);
  assert.ok(router.includes('`references/parts-index.md`'));
  assert.ok(fs.existsSync(path.join(ROOT, ...PARTS_INDEX_FILE.split('/'))));
});

test('errataPointers extracts file and line pointers', () => {
  assert.deepEqual(errataPointers('references/latest-apis.md:381, :386 and :418 use APIs that are absent.'), ['references/latest-apis.md:381, :386, :418']);
  assert.deepEqual(errataPointers('SKILL.md:89: withTaskGroup waits for its children.'), ['SKILL.md:89']);
  assert.deepEqual(errataPointers('the handler (references/batch-operations.md:26-34) never returns true'), ['references/batch-operations.md:26-34']);
  assert.deepEqual(errataPointers('SKILL.md:28 and references/checks.md:11 both pass a flag.'), ['SKILL.md:28', 'references/checks.md:11']);
  assert.deepEqual(errataPointers('Does not cover Swift 6.4 or Xcode 26.'), []);
});

test('usedMarks finds whole-word marks only, in a fixed order', () => {
  assert.deepEqual(usedMarks('SwiftUI on iPadOS with Xcode'), ['iPadOS', 'SwiftUI', 'Xcode']);
  assert.deepEqual(usedMarks('Swift 6 and the App Store, for iOS'), ['iOS', 'Swift', 'App Store']);
  assert.deepEqual(usedMarks('apple pie, macos, ios, IOS, Macs'), []);
  assert.deepEqual(usedMarks('Apple-platform code on a Mac'), ['Apple', 'Mac']);
});

test('trademarkLine credits the marks, the logo and Cisco when iOS is named', () => {
  assert.equal(trademarkLine(['Apple', 'Xcode']), 'Apple and Xcode are trademarks of Apple Inc., registered in the U.S. and other countries and regions.');
  assert.equal(trademarkLine(['Swift']), 'Swift is a trademark of Apple Inc., registered in the U.S. and other countries and regions.');
  assert.equal(trademarkLine(['Apple', 'iOS'], { logo: true }), `Apple, the Apple logo and iOS are trademarks of Apple Inc., registered in the U.S. and other countries and regions. ${CISCO_SENTENCE}`);
  assert.equal(trademarkLine(['Xcode'], { logo: true }), 'The Apple logo and Xcode are trademarks of Apple Inc., registered in the U.S. and other countries and regions.');
  assert.equal(trademarkLine([]), '');
});

test('README.md and NOTICE.md carry the generated trademark line', () => {
  const { trademarks, marks } = generate(ROOT);
  assert.deepEqual(marks, ['Apple', 'iOS', 'macOS', 'Swift', 'SwiftUI', 'Xcode', 'TestFlight', 'App Store']);
  assert.ok(trademarks.startsWith('Apple, the Apple logo, iOS, macOS, Swift, SwiftUI, Xcode, TestFlight and App Store are trademarks of Apple Inc.'));
  assert.ok(trademarks.endsWith(CISCO_SENTENCE));
  assert.ok(read(ROOT, README_FILE).includes(trademarks));
  assert.ok(read(ROOT, NOTICE_FILE).includes(trademarks));
});

test('replaceBlock rewrites only the lines between its markers', () => {
  const text = 'a\n<!-- gen:x -->\nold\n<!-- /gen:x -->\nb\n';
  assert.equal(replaceBlock(text, 'x', 'new', 'f.md'), 'a\n<!-- gen:x -->\n\nnew\n\n<!-- /gen:x -->\nb\n');
  assert.throws(() => replaceBlock('a\n', 'x', 'new', 'f.md'), /f\.md: needs exactly one <!-- gen:x --> line/);
  assert.throws(() => replaceBlock(`${text}${text}`, 'x', 'new', 'f.md'), /needs exactly one/);
});

test('gen --check names stale files and gen rewrites them', (t) => {
  const root = copyCheckout();
  t.after(() => removeTree(root));
  const readme = path.join(root, README_FILE);
  fs.writeFileSync(readme, fs.readFileSync(readme, 'utf8').replace('`204dba7c6725`', '`000000000000`'));
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), `${fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')}\nNow on iPhone too.\n`);
  fs.rmSync(path.join(root, SKILLS_FILE));
  const check = runScript(GEN, ['--check', '--root', root]);
  assert.equal(check.status, 1);
  assert.match(check.stderr, /^skills\.json is out of date/m);
  assert.match(check.stderr, /^README\.md is out of date/m);
  assert.match(check.stderr, /^skills\/apple\/NOTICE\.md is out of date/m);
  const write = runScript(GEN, ['--root', root]);
  assert.equal(write.status, 0, write.stderr);
  assert.match(write.stdout, /Wrote README\.md\./);
  assert.ok(read(root, README_FILE).includes('`204dba7c6725`'));
  assert.match(read(root, NOTICE_FILE), /iOS, macOS, iPhone, Swift/);
  const again = runScript(GEN, ['--check', '--root', root]);
  assert.equal(again.status, 0, again.stderr);
});

test('gen fails loudly on missing markers, a misnamed skill and bad arguments', (t) => {
  const root = copyCheckout();
  t.after(() => removeTree(root));
  const notice = path.join(root, ...NOTICE_FILE.split('/'));
  fs.writeFileSync(notice, fs.readFileSync(notice, 'utf8').replace('<!-- /gen:trademarks -->\n', ''));
  const markers = runScript(GEN, ['--check', '--root', root]);
  assert.equal(markers.status, 1);
  assert.match(markers.stderr, /skills\/apple\/NOTICE\.md: needs exactly one <!-- gen:trademarks --> line/);
  fs.mkdirSync(path.join(root, 'skills', 'other'));
  fs.writeFileSync(path.join(root, 'skills', 'other', 'SKILL.md'), '---\nname: misnamed\ndescription: A second skill.\n---\n');
  const misnamed = runScript(GEN, ['--root', root]);
  assert.equal(misnamed.status, 1);
  assert.match(misnamed.stderr, /skills\/other\/SKILL\.md: frontmatter name "misnamed" must match its folder other/);
  assert.match(runScript(GEN, ['--root']).stderr, /--root needs a value/);
  assert.match(runScript(GEN, ['--fix']).stderr, /Unknown argument: --fix/);
});
