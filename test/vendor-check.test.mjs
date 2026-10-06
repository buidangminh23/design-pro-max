import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_EXTENSIONS, NOTICES_FILE, RECORD_KEYS, UPSTREAM_FILE, VENDOR_DIR, copyrightLines, isExcluded, isMitLicence, loadSources, readUpstream, walk } from '../scripts/lib/vendor.mjs';
import { MEDIA_NOTICES } from '../scripts/lib/media.mjs';
import { buildNotices, checkVendor, chooseLicence, planPart } from '../scripts/vendor-sync.mjs';
import { ROOT, canCreate, materialize, removeTree, tempDir } from './helpers.mjs';

const manifest = loadSources(ROOT);
const vendorPath = (root, ...segments) => path.join(root, ...VENDOR_DIR.split('/'), ...segments);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

test('the vendored tree matches the manifest and every UPSTREAM.json', () => {
  const { parts, problems } = checkVendor(ROOT);
  assert.deepEqual(problems, []);
  assert.equal(parts, 38);
});

test('every part ships SKILL.md, an MIT LICENSE and a complete UPSTREAM.json', () => {
  for (const part of manifest.parts) {
    const dir = vendorPath(ROOT, ...part.id.split('/'));
    assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')), `${part.id}/SKILL.md`);
    assert.ok(isMitLicence(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')), `${part.id}/LICENSE`);
    const record = readUpstream(ROOT, part.id);
    assert.equal(record.schema, 1);
    assert.equal(record.name, part.id.split('/').at(-1));
    assert.equal(record.license.spdx, 'MIT');
    assert.match(record.fetched, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(record), RECORD_KEYS);
    assert.ok(record.files.some((file) => file.path === 'LICENSE'), `${part.id} lists its LICENSE`);
    for (const file of record.files) assert.equal(typeof file.executable, 'boolean', `${part.id}/${file.path}`);
  }
});

test('no vendored part ships images, media, fonts, archives or agent UI metadata', () => {
  const shipped = walk(ROOT, VENDOR_DIR).filter((entry) => entry.kind === 'file').map((entry) => entry.path);
  assert.deepEqual(shipped.filter((file) => MEDIA_EXTENSIONS.has(path.posix.extname(file).toLowerCase())), []);
  assert.deepEqual(shipped.filter((file) => /\/agents\/openai\.yaml$/.test(file)), []);
  for (const id of ['swiftui-expert-skill', 'swift-concurrency', 'swift-testing-pro', 'swiftdata-pro']) {
    const part = manifest.parts.find((item) => item.id === id);
    assert.ok(part.exclude.includes('agents/**') && part.exclude.includes('assets/**'), id);
  }
});

test('THIRD_PARTY_NOTICES.md is up to date and credits every part', () => {
  const current = fs.readFileSync(path.join(ROOT, NOTICES_FILE), 'utf8');
  assert.equal(current, buildNotices(ROOT));
  for (const part of manifest.parts) assert.ok(current.includes(`\`${part.id}\``), part.id);
  for (const author of ['Antoine van der Lee', 'Paul Hudson', 'Rudrank Riyam', 'Thomas Ricouard']) assert.ok(current.includes(author), author);
  assert.match(current, /belong to Apple and are not covered by the licences below/);
});

test('check reports edited, missing, unlisted and stray files and stale metadata', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const part = vendorPath(root, 'demo-part');
  assert.deepEqual(checkVendor(root).problems, []);

  fs.appendFileSync(path.join(part, 'SKILL.md'), 'edited\n');
  fs.rmSync(path.join(part, 'LICENSE'));
  fs.writeFileSync(path.join(part, 'extra.md'), 'not upstream\n');
  fs.mkdirSync(vendorPath(root, 'stray'));
  const sources = path.join(root, 'vendor', 'sources.json');
  const data = readJson(sources);
  data.parts[0].errata = ['A new erratum.'];
  writeJson(sources, data);

  const problems = checkVendor(root).problems.join('\n');
  assert.match(problems, /demo-part\/SKILL\.md: content differs/);
  assert.match(problems, /demo-part\/LICENSE: missing/);
  assert.match(problems, /demo-part\/extra\.md: not listed in UPSTREAM\.json/);
  assert.match(problems, /\.vendor\/stray: belongs to no part/);
  assert.match(problems, /errata differs from vendor\/sources\.json/);
});

test('check fails when a part folder or its record is missing', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const part = vendorPath(root, 'demo-part');
  fs.rmSync(path.join(part, UPSTREAM_FILE));
  assert.match(checkVendor(root).problems.join('\n'), /UPSTREAM\.json is missing/);
  fs.rmSync(part, { recursive: true });
  assert.match(checkVendor(root).problems.join('\n'), /folder is missing/);
});

test('check refuses symlinked part and group folders instead of following them', { skip: !canCreate('symlink') && 'cannot create a symlink here' }, (t) => {
  const root = materialize();
  const outside = tempDir();
  t.after(() => {
    removeTree(root);
    removeTree(outside);
  });
  fs.renameSync(vendorPath(root, 'demo-part'), path.join(outside, 'demo-part'));
  fs.symlinkSync(path.join(outside, 'demo-part'), vendorPath(root, 'demo-part'));
  assert.match(checkVendor(root).problems.join('\n'), /skills\/apple\/\.vendor\/demo-part is a symlink/);

  fs.rmSync(vendorPath(root, 'demo-part'));
  fs.mkdirSync(path.join(outside, 'grp'));
  fs.renameSync(path.join(outside, 'demo-part'), path.join(outside, 'grp', 'demo-part'));
  fs.symlinkSync(path.join(outside, 'grp'), vendorPath(root, 'grp'));
  const sources = path.join(root, 'vendor', 'sources.json');
  const data = readJson(sources);
  data.parts[0].id = 'grp/demo-part';
  writeJson(sources, data);
  const problems = checkVendor(root).problems.join('\n');
  assert.match(problems, /skills\/apple\/\.vendor\/grp is a symlink/);
  assert.doesNotMatch(problems, /content differs/);
});

test('check reports a changed executable bit', { skip: process.platform === 'win32' && 'file modes do not apply on Windows' }, (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  fs.chmodSync(vendorPath(root, 'demo-part', 'SKILL.md'), 0o755);
  assert.match(checkVendor(root).problems.join('\n'), /demo-part\/SKILL\.md: executable bit differs from UPSTREAM\.json/);
});

test('check names the broken record and keeps checking the other parts', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  fs.cpSync(vendorPath(root, 'demo-part'), vendorPath(root, 'demo-two'), { recursive: true });
  const sources = path.join(root, 'vendor', 'sources.json');
  const data = readJson(sources);
  data.parts.push({ ...data.parts[0], id: 'demo-two' });
  writeJson(sources, data);
  const second = vendorPath(root, 'demo-two', UPSTREAM_FILE);
  writeJson(second, { ...readJson(second), id: 'demo-two' });
  assert.deepEqual(checkVendor(root).problems, []);

  const first = vendorPath(root, 'demo-part', UPSTREAM_FILE);
  const record = readJson(first);
  record.files[1] = null;
  writeJson(first, record);
  const problems = checkVendor(root).problems;
  assert.ok(problems.includes('demo-part: UPSTREAM.json files[1] is not an object'), problems.join('\n'));
  assert.ok(problems.every((problem) => !problem.startsWith('demo-two')), problems.join('\n'));

  fs.writeFileSync(second, '{ not json');
  assert.match(checkVendor(root).problems.join('\n'), /demo-two: UPSTREAM\.json is not valid JSON/);
  fs.writeFileSync(sources, '{ not json');
  assert.throws(() => checkVendor(root), /vendor\/sources\.json: is not valid JSON/);
});

test('check verifies that appleText names shipped files and existing lines', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const quotes = [
    { file: 'SKILL.md', lines: '2-3', source: 'A test source.', reason: 'A test reason.' },
    { file: 'SKILL.md', lines: '40', source: 'A test source.', reason: 'A test reason.' },
    { file: 'references/missing.md', lines: '1', source: 'A test source.', reason: 'A test reason.' },
  ];
  const sources = path.join(root, 'vendor', 'sources.json');
  writeJson(sources, { ...readJson(sources), parts: [{ ...readJson(sources).parts[0], appleText: quotes }] });
  const upstream = vendorPath(root, 'demo-part', UPSTREAM_FILE);
  writeJson(upstream, { ...readJson(upstream), appleText: quotes });
  const problems = checkVendor(root).problems;
  assert.deepEqual(problems, [
    'demo-part: appleText SKILL.md:40 is past the end of the file (8 lines)',
    'demo-part: appleText names references/missing.md, which the part does not ship',
  ]);
});

const entry = (mode, file, type = 'blob') => ({ mode, type, object: 'a'.repeat(40), path: file });

test('planPart applies excludes and refuses symlinks, submodules and reserved names', () => {
  const part = { path: 'pack/skill', commit: 'b'.repeat(40), exclude: ['skills/**', '.claude-plugin/**'] };
  const clean = planPart([
    entry('100644', 'pack/skill/SKILL.md'),
    entry('100755', 'pack/skill/scripts/run.py'),
    entry('120000', 'pack/skill/skills/skill/references'),
    entry('100644', 'pack/skill/.claude-plugin/plugin.json'),
    entry('100644', 'pack/other/SKILL.md'),
  ], part);
  assert.deepEqual(clean.problems, []);
  assert.deepEqual(clean.files.map((file) => [file.path, file.executable]), [['SKILL.md', false], ['scripts/run.py', true]]);

  const dirty = planPart([
    entry('100644', 'pack/skill/SKILL.md'),
    entry('120000', 'pack/skill/link.md'),
    entry('160000', 'pack/skill/vendor', 'commit'),
    entry('100644', 'pack/skill/.codex/config.toml'),
    entry('100644', 'pack/skill/metadata.json'),
    entry('100644', 'pack/skill/UPSTREAM.json'),
    entry('100644', 'pack/skill/Readme.md'),
    entry('100644', 'pack/skill/README.md'),
  ], { ...part, exclude: [] }).problems.join('\n');
  assert.match(dirty, /link\.md: is a symlink/);
  assert.match(dirty, /vendor: is a submodule/);
  assert.match(dirty, /\.codex\/config\.toml: sits in a folder/);
  assert.match(dirty, /metadata\.json: installers drop/);
  assert.match(dirty, /UPSTREAM\.json: collides/);
  assert.match(dirty, /differs only in case/);
  assert.match(planPart([entry('100644', 'pack/skill')], part).problems.join('\n'), /is a file, not a folder/);
  assert.match(planPart([], part).problems.join('\n'), /no files under pack\/skill/);
});

test('planPart refuses generated-name collisions, nested git metadata, media files and unsafe names', () => {
  const part = { path: 'pack/skill', commit: 'b'.repeat(40), exclude: [] };
  const problems = planPart([
    entry('100644', 'pack/skill/SKILL.md'),
    entry('100644', 'pack/skill/License'),
    entry('100644', 'pack/skill/upstream.json'),
    entry('100644', 'pack/skill/docs/.gitignore'),
    entry('100644', 'pack/skill/.gitattributes'),
    entry('100644', 'pack/skill/assets/icon.svg'),
    entry('100644', 'pack/skill/notes copy.md'),
  ], part).problems.join('\n');
  assert.match(problems, /^License: differs only in case from the LICENSE that sync writes/m);
  assert.match(problems, /^upstream\.json: collides with the generated record/m);
  assert.match(problems, /^docs\/\.gitignore: is git metadata/m);
  assert.match(problems, /^\.gitattributes: is git metadata/m);
  assert.match(problems, /^assets\/icon\.svg: is an image, media, font or archive file/m);
  assert.match(problems, /^notes copy\.md: name uses characters other than/m);
  assert.deepEqual(planPart([entry('100644', 'pack/skill/SKILL.md'), entry('100644', 'pack/skill/LICENSE')], part).problems, []);
});

test('chooseLicence prefers the part licence and falls back to the root licence', () => {
  const part = { path: 'pack/skill' };
  const root = [entry('100644', 'LICENSE'), entry('100644', 'pack/skill/SKILL.md')];
  assert.deepEqual(chooseLicence(root, part, [{ path: 'SKILL.md', object: 'c'.repeat(40) }]), { file: 'LICENSE', object: 'a'.repeat(40) });
  assert.deepEqual(chooseLicence(root, part, [{ path: 'LICENSE.md', object: 'd'.repeat(40) }]), { file: 'pack/skill/LICENSE.md', object: 'd'.repeat(40) });
  assert.equal(chooseLicence([entry('100644', 'README.md')], part, []), null);
});

test('exclude globs are anchored at the part folder and match the folders above a file', () => {
  assert.ok(isExcluded('skills/swift-testing-pro/SKILL.md', ['skills/**']));
  assert.ok(isExcluded('agents/openai.yaml', ['agents']));
  assert.ok(isExcluded('agents/openai.yaml', ['agents/']));
  assert.ok(isExcluded('agents', ['agents/']));
  assert.ok(isExcluded('docs/a/b.png', ['**/*.png']));
  assert.ok(isExcluded('scripts/__pycache__/x.pyc', ['**/__pycache__']));
  assert.ok(!isExcluded('scripts/__pycache__/x.pyc', ['__pycache__']));
  assert.ok(!isExcluded('docs/a.md', ['*.md']));
  assert.ok(!isExcluded('deep/.DS_Store', ['.DS_Store']));
  assert.ok(!isExcluded('references/skills.md', ['skills/**']));
  assert.ok(!isExcluded('SKILL.md', []));
});

test('a licence line that starts with COPYRIGHT HOLDERS is licence text, not a copyright notice', () => {
  const wrapped = MEDIA_NOTICES.find((media) => media.project === 'devicon').licence;
  assert.ok(wrapped.split('\n').some((line) => line.startsWith('COPYRIGHT HOLDERS')));
  assert.ok(isMitLicence(wrapped));
  assert.deepEqual(copyrightLines(wrapped), ['Copyright (c) 2015 konpa']);
});
