import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PRIMARY_DESIGN, SHARED_DIR, designProblems, loadDesigns } from '../scripts/lib/designs.mjs';
import { designTrademarkLine, sharedFiles, staleFiles, strayShared, writeGenerated } from '../scripts/gen.mjs';
import { designProblemsForRelease } from '../scripts/release.mjs';
import { runGuard } from '../scripts/vendor-guard.mjs';
import { marksInName, newDesign } from '../scripts/new-design.mjs';
import { ROOT, copyCheckout, removeTree, runScript } from './helpers.mjs';

const GEN = path.join(ROOT, 'scripts', 'gen.mjs');
const NEW_DESIGN = path.join(ROOT, 'scripts', 'new-design.mjs');
const file = (root, relative) => path.join(root, ...relative.split('/'));
const read = (root, relative) => fs.readFileSync(file(root, relative), 'utf8');

test('the registry lists the primary design with the folders scripts derive from it', () => {
  const designs = loadDesigns(ROOT);
  const apple = designs.find((design) => design.name === PRIMARY_DESIGN);
  assert.ok(apple?.primary);
  assert.equal(apple.skillDir, 'skills/apple');
  assert.equal(apple.vendorDir, 'skills/apple/.vendor');
  assert.equal(apple.sharedDir, 'skills/apple/shared');
});

test('every design ships shared/ byte for byte', () => {
  const files = sharedFiles(ROOT);
  assert.ok(files.includes('harness.mjs'));
  for (const design of loadDesigns(ROOT)) {
    for (const name of files) assert.ok(fs.readFileSync(file(ROOT, `${design.sharedDir}/${name}`)).equals(fs.readFileSync(file(ROOT, `${SHARED_DIR}/${name}`))), `${design.sharedDir}/${name}`);
  }
  assert.deepEqual(strayShared(ROOT), []);
  assert.deepEqual(designProblemsForRelease(ROOT), []);
});

test('a design record must name its own folder and a lowercase name', () => {
  assert.deepEqual(designProblems('studio.json', { design: 'studio', skill: 'skills/studio', marks: [] }), []);
  assert.match(designProblems('studio.json', { design: 'other', skill: 'skills/other' }).join('\n'), /must match its file name studio/);
  assert.match(designProblems('studio.json', { design: 'studio', skill: 'skills/apple' }).join('\n'), /skill must be skills\/studio/);
  assert.match(designProblems('Studio.json', { design: 'Studio', skill: 'skills/Studio' }).join('\n'), /lowercase words/);
  assert.match(designProblems('studio.json', { design: 'studio', skill: 'skills/studio', marks: [''] }).join('\n'), /marks must be a list/);
});

test('gen --check fails on byte drift and stray files in a design shared copy, and a write repairs both', () => {
  const root = copyCheckout();
  try {
    const copy = 'skills/apple/shared/harness.mjs';
    fs.appendFileSync(file(root, copy), ' ');
    fs.writeFileSync(file(root, 'skills/apple/shared/extra.mjs'), 'export {};\n');
    assert.deepEqual(staleFiles(root), [copy]);
    assert.deepEqual(strayShared(root), ['skills/apple/shared/extra.mjs']);
    const check = runScript(GEN, ['--check', '--root', root]);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /skills\/apple\/shared\/harness\.mjs is out of date/);
    assert.match(check.stderr, /skills\/apple\/shared\/extra\.mjs is not in shared\//);
    assert.match(designProblemsForRelease(root).join('\n'), /harness\.mjs: differs from shared\/harness\.mjs/);
    const changes = writeGenerated(root);
    assert.ok(changes.includes(`Wrote ${copy}.`));
    assert.ok(changes.some((line) => line.startsWith('Removed skills/apple/shared/extra.mjs')));
    assert.equal(runScript(GEN, ['--check', '--root', root]).status, 0);
  } finally {
    removeTree(root);
  }
});

test('new-design scaffolds a neutral design that gen --check accepts', () => {
  const root = copyCheckout();
  try {
    const skillsBefore = JSON.parse(read(root, 'skills.json'));
    const result = runScript(NEW_DESIGN, ['studio', '--marks', 'Acme, Widget Pro', '--owner', 'Acme Corp', '--root', root]);
    assert.equal(result.status, 0, result.stderr);
    for (const created of ['designs/studio.json', 'skills/studio/SKILL.md', 'skills/studio/assets/icon.svg', 'skills/studio/NOTICE.md']) assert.ok(fs.existsSync(file(root, created)), created);
    assert.deepEqual(JSON.parse(read(root, 'designs/studio.json')), { design: 'studio', skill: 'skills/studio', marks: ['Acme', 'Widget Pro'], owner: 'Acme Corp' });
    assert.deepEqual(JSON.parse(read(root, 'skills.json')), [...skillsBefore, { name: 'studio', path: 'skills/studio' }].sort((a, b) => (a.name < b.name ? -1 : 1)));
    for (const name of sharedFiles(root)) assert.ok(fs.readFileSync(file(root, `skills/studio/shared/${name}`)).equals(fs.readFileSync(file(root, `shared/${name}`))), name);
    assert.equal(runScript(GEN, ['--check', '--root', root]).status, 0);
    assert.deepEqual(designProblemsForRelease(root), []);
    assert.equal(read(root, 'README.md'), read(ROOT, 'README.md'), 'a neutral design leaves the README untouched');
    assert.equal(read(root, 'skills/apple/NOTICE.md'), read(ROOT, 'skills/apple/NOTICE.md'));

    fs.appendFileSync(file(root, 'skills/studio/SKILL.md'), '\nWorks with Acme boards.\n');
    assert.deepEqual(staleFiles(root), ['skills/studio/NOTICE.md']);
    writeGenerated(root);
    assert.ok(read(root, 'skills/studio/NOTICE.md').includes('Acme is a trademark of Acme Corp. The studio skill is not affiliated with or endorsed by Acme Corp.'));

    const layout = (problems) => problems.filter((problem) => problem.check === 'layout');
    assert.deepEqual(layout(runGuard(root).problems), []);
    fs.mkdirSync(file(root, 'skills/studio/.vendor/part'), { recursive: true });
    fs.writeFileSync(file(root, 'skills/studio/.vendor/part/SKILL.md'), '---\nname: part\ndescription: x\n---\n');
    assert.match(layout(runGuard(root).problems).map((problem) => `${problem.file}: ${problem.message}`).join('\n'), /skills\/studio\/\.vendor: vendored parts belong to the apple design/);
  } finally {
    removeTree(root);
  }
});

test('new-design refuses names that are taken, malformed or name a mark', () => {
  const root = copyCheckout();
  try {
    assert.throws(() => newDesign(root, 'apple'), /already exists/);
    assert.throws(() => newDesign(root, 'uxui-prompt'), /already exists/);
    assert.throws(() => newDesign(root, 'Studio'), /lowercase words/);
    assert.throws(() => newDesign(root, 'ios-kit'), /must be neutral, but it names iOS/);
    assert.throws(() => newDesign(root, 'widget-pro-kit', { marks: ['Widget Pro'] }), /names Widget Pro/);
    assert.throws(() => newDesign(root, 'studio', { owner: 'Acme Corp' }), /--owner needs --marks/);
    assert.equal(fs.existsSync(file(root, 'designs/studio.json')), false);
  } finally {
    removeTree(root);
  }
});

test('marksInName matches whole words only', () => {
  assert.deepEqual(marksInName('mac-kit', ['Mac', 'iOS']), ['Mac']);
  assert.deepEqual(marksInName('machine-kit', ['Mac']), []);
  assert.deepEqual(marksInName('apple-tv-kit', ['Apple TV', 'TV']), ['Apple TV', 'TV']);
});

test('the trademark line of another design names its owner or stays generic', () => {
  assert.equal(designTrademarkLine({ name: 'studio' }, []), '');
  assert.equal(designTrademarkLine({ name: 'studio' }, ['Acme']), 'Acme is a trademark of its owner. The studio skill is not affiliated with or endorsed by its owner.');
  assert.equal(designTrademarkLine({ name: 'studio', owner: 'Acme Corp' }, ['Acme', 'Widget']), 'Acme and Widget are trademarks of Acme Corp. The studio skill is not affiliated with or endorsed by Acme Corp.');
});
