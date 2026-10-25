import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BUNDLES_FILE, isBundledMedia, loadBundles, validateBundles, verifyBundle } from '../scripts/lib/bundles.mjs';
import { bundleFileProblem, check, update } from '../scripts/bundle-sync.mjs';
import { checkHistory } from '../scripts/check-history.mjs';
import { sha256 } from '../scripts/lib/vendor.mjs';
import { ROOT, commitUpstream, isolatedGitEnv, removeTree, runScript, tempDir, upstreamDir, upstreamEnv } from './helpers.mjs';

const SYNC = path.join(ROOT, 'scripts', 'bundle-sync.mjs');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const MIT = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
const SKILL = (name) => `---\nname: ${name}\ndescription: A bundled skill for tests.\n---\n\n# ${name}\n`;
const IDENTITY = ['-c', 'user.name=Fixture', '-c', `user.email=${['fixture', 'users.noreply.github.com'].join('@')}`, '-c', 'commit.gpgsign=false'];

const entry = (file, data) => ({ path: file, sha256: sha256(Buffer.from(data)), bytes: Buffer.from(data).length, executable: false });

function bundleRecord(name, files) {
  return {
    name,
    repo: 'example/icons',
    tag: 'v1.0.0',
    commit: 'b'.repeat(40),
    path: `skills/${name}`,
    license: { file: 'LICENSE', sha256: sha256(Buffer.from(MIT)), copyright: 'Copyright (c) 2026 Example' },
    files: Object.entries(files).map(([file, data]) => entry(file, data)).sort((a, b) => (a.path < b.path ? -1 : 1)),
  };
}

function writeTree(root, files) {
  for (const [file, data] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
}

function bundleOnDisk(t, name = 'icons-pro-max') {
  const root = tempDir('design-pro-max-bundle-');
  t.after(() => removeTree(root));
  const files = { 'SKILL.md': SKILL(name), 'assets/logo.png': PNG };
  writeTree(root, Object.fromEntries([...Object.entries(files), ['LICENSE', MIT]].map(([file, data]) => [`skills/${name}/${file}`, data])));
  const manifest = { schema: 1, bundles: [bundleRecord(name, files)] };
  writeTree(root, { [BUNDLES_FILE]: `${JSON.stringify(manifest, null, 2)}\n` });
  return { root, manifest };
}

test('the committed bundles match vendor/bundles.json file for file', () => {
  const result = check(ROOT);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(loadBundles(ROOT).bundles.map((bundle) => bundle.name), ['design-spacing-rhythm', 'icons-pro-max']);
});

test('every committed bundle is pinned to a release tag and records SKILL.md and its licence', () => {
  for (const bundle of loadBundles(ROOT).bundles) {
    assert.match(bundle.tag, /^v\d+\.\d+\.\d+$/);
    assert.match(bundle.commit, /^[0-9a-f]{40}$/);
    assert.ok(bundle.files.some((file) => file.path === 'SKILL.md'), bundle.name);
    assert.ok(fs.existsSync(path.join(ROOT, 'skills', bundle.name, 'LICENSE')), bundle.name);
  }
});

test('the manifest validator names every malformed field', () => {
  const good = bundleRecord('icons-pro-max', { 'SKILL.md': SKILL('icons-pro-max') });
  assert.deepEqual(validateBundles({ schema: 1, bundles: [good] }), []);
  const cases = [
    [{ ...good, tag: 'latest' }, /tag must be a vX\.Y\.Z release tag/],
    [{ ...good, commit: 'abc' }, /commit must be a full 40-character SHA/],
    [{ ...good, name: 'apple' }, /apple is the project's own skill/],
    [{ ...good, files: [{ ...good.files[0], path: '../SKILL.md' }] }, /is not a safe relative path/],
    [{ ...good, files: [entry('README.md', 'x')] }, /files must include SKILL\.md/],
    [{ ...good, files: [entry('b.md', 'x'), entry('SKILL.md', 'y')] }, /files must be sorted by path/],
    [{ ...good, extra: true }, /unknown keys extra/],
  ];
  for (const [bundle, message] of cases) assert.match(validateBundles({ schema: 1, bundles: [bundle] }).join('\n'), message);
  assert.match(validateBundles({ schema: 1, bundles: [good, good] }).join('\n'), /duplicate name/);
});

test('bundled media passes only for an allowed bundle, folder and extension with the recorded bytes', () => {
  const icons = { schema: 1, bundles: [bundleRecord('icons-pro-max', { 'SKILL.md': 'x', 'assets/logo.png': PNG, 'logo.png': PNG })] };
  assert.equal(isBundledMedia(icons, 'skills/icons-pro-max/assets/logo.png', PNG), true);
  assert.equal(isBundledMedia(icons, 'skills/icons-pro-max/assets/logo.png', Buffer.concat([PNG, Buffer.from([1])])), false);
  assert.equal(isBundledMedia(icons, 'skills/icons-pro-max/assets/other.png', PNG), false);
  assert.equal(isBundledMedia(icons, 'skills/icons-pro-max/logo.png', PNG), false);
  const other = { schema: 1, bundles: [bundleRecord('design-spacing-rhythm', { 'SKILL.md': 'x', 'assets/logo.png': PNG })] };
  assert.equal(isBundledMedia(other, 'skills/design-spacing-rhythm/assets/logo.png', PNG), false);
});

test('an upstream file is refused for links, names, metadata, a second skill and media outside the rules', () => {
  assert.equal(bundleFileProblem('icons-pro-max', 'assets/tech/node.svg', '100644'), null);
  assert.equal(bundleFileProblem('icons-pro-max', 'references/guide.md', '100755'), null);
  const refused = [
    ['icons-pro-max', 'assets/link.svg', '120000', /symlink/],
    ['icons-pro-max', 'vendor', '160000', /submodule/],
    ['icons-pro-max', 'assets/a b.svg', '100644', /characters other than/],
    ['icons-pro-max', 'nested/.gitattributes', '100644', /git metadata/],
    ['icons-pro-max', 'metadata.json', '100644', /metadata\.json/],
    ['icons-pro-max', '.claude/settings.json', '100644', /treat specially/],
    ['icons-pro-max', 'LICENSE', '100644', /collides with the LICENSE/],
    ['icons-pro-max', 'extra/SKILL.md', '100644', /second visible SKILL\.md/],
    ['icons-pro-max', 'assets/font.woff2', '100644', /outside the media the bundle rules allow/],
    ['icons-pro-max', 'docs/shot.png', '100644', /outside the media the bundle rules allow/],
    ['design-spacing-rhythm', 'assets/logo.svg', '100644', /outside the media the bundle rules allow/],
  ];
  for (const [name, file, mode, message] of refused) assert.match(bundleFileProblem(name, file, mode) ?? '', message, file);
});

test('verifyBundle reports an edited, an extra and a missing file and a changed licence', (t) => {
  const { root, manifest } = bundleOnDisk(t);
  const [bundle] = manifest.bundles;
  assert.deepEqual(verifyBundle(root, bundle, { modes: false }), []);
  fs.appendFileSync(path.join(root, 'skills', 'icons-pro-max', 'SKILL.md'), 'edited\n');
  fs.writeFileSync(path.join(root, 'skills', 'icons-pro-max', 'notes.md'), 'extra\n');
  fs.rmSync(path.join(root, 'skills', 'icons-pro-max', 'assets', 'logo.png'));
  fs.appendFileSync(path.join(root, 'skills', 'icons-pro-max', 'LICENSE'), 'more\n');
  const problems = verifyBundle(root, bundle, { modes: false }).join('\n');
  assert.match(problems, /SKILL\.md: differs from example\/icons at v1\.0\.0/);
  assert.match(problems, /notes\.md: is not a file of example\/icons at v1\.0\.0/);
  assert.match(problems, /assets\/logo\.png: is missing/);
  assert.match(problems, /LICENSE: differs from the licence recorded/);
});

function tagUpstream(home, repo, tag) {
  execFileSync('git', ['-C', upstreamDir(home, repo), ...IDENTITY, 'tag', '-a', tag, '-m', tag], { env: isolatedGitEnv(home) });
}

test('sync copies a bundle from its tagged commit, writes its licence and records every file', (t) => {
  const home = tempDir('design-pro-max-home-');
  const root = tempDir('design-pro-max-root-');
  t.after(() => {
    removeTree(home);
    removeTree(root);
  });
  const commit = commitUpstream(home, 'example/icons', {
    LICENSE: MIT,
    'README.md': 'not bundled\n',
    'skills/icons-pro-max/SKILL.md': SKILL('icons-pro-max'),
    'skills/icons-pro-max/assets/tech/node.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
  });
  tagUpstream(home, 'example/icons', 'v1.0.0');
  const pin = { name: 'icons-pro-max', repo: 'example/icons', tag: 'v1.0.0', commit, path: 'skills/icons-pro-max' };
  writeTree(root, { [BUNDLES_FILE]: `${JSON.stringify({ schema: 1, bundles: [pin] }, null, 2)}\n` });
  const result = runScript(SYNC, ['sync', '--root', root], { env: upstreamEnv(home) });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Synced icons-pro-max v1\.0\.0: 2 files/);
  assert.equal(fs.readFileSync(path.join(root, 'skills', 'icons-pro-max', 'LICENSE'), 'utf8'), MIT);
  assert.ok(!fs.existsSync(path.join(root, 'skills', 'icons-pro-max', 'README.md')));
  const [bundle] = loadBundles(root).bundles;
  assert.deepEqual(bundle.files.map((file) => file.path), ['SKILL.md', 'assets/tech/node.svg']);
  assert.equal(runScript(SYNC, ['check', '--root', root]).status, 0);
  fs.appendFileSync(path.join(root, 'skills', 'icons-pro-max', 'SKILL.md'), 'edited\n');
  const broken = runScript(SYNC, ['check', '--root', root]);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /SKILL\.md: differs from example\/icons at v1\.0\.0/);
});

test('sync refuses a tag that no longer points at the pinned commit and a skill named otherwise', (t) => {
  const home = tempDir('design-pro-max-home-');
  const root = tempDir('design-pro-max-root-');
  t.after(() => {
    removeTree(home);
    removeTree(root);
  });
  const first = commitUpstream(home, 'example/icons', { LICENSE: MIT, 'skills/icons-pro-max/SKILL.md': SKILL('other-name') });
  tagUpstream(home, 'example/icons', 'v1.0.0');
  commitUpstream(home, 'example/icons', { 'skills/icons-pro-max/notes.md': 'later\n' });
  tagUpstream(home, 'example/icons', 'v1.1.0');
  const write = (pin) => writeTree(root, { [BUNDLES_FILE]: `${JSON.stringify({ schema: 1, bundles: [{ name: 'icons-pro-max', repo: 'example/icons', path: 'skills/icons-pro-max', ...pin }] }, null, 2)}\n` });
  write({ tag: 'v1.1.0', commit: first });
  const moved = runScript(SYNC, ['sync', '--root', root], { env: upstreamEnv(home) });
  assert.equal(moved.status, 1);
  assert.match(moved.stderr, /tag v1\.1\.0 points at [0-9a-f]{40}, not the pinned/);
  write({ tag: 'v1.0.0', commit: first });
  const named = runScript(SYNC, ['sync', '--root', root], { env: upstreamEnv(home) });
  assert.equal(named.status, 1);
  assert.match(named.stderr, /frontmatter name "other-name" must be icons-pro-max/);
  assert.ok(!fs.existsSync(path.join(root, 'skills', 'icons-pro-max')));
});

test('update leaves a bundle at its latest release alone without fetching anything', async (t) => {
  const { root, manifest } = bundleOnDisk(t);
  const before = fs.readFileSync(path.join(root, BUNDLES_FILE), 'utf8');
  const report = await update(root, { latest: async () => manifest.bundles[0].tag, commitOf: async () => assert.fail('no fetch expected') });
  assert.deepEqual(report, { changed: false, bundles: [] });
  assert.equal(fs.readFileSync(path.join(root, BUNDLES_FILE), 'utf8'), before);
});

function historyRepo(t) {
  const root = tempDir('design-pro-max-history-');
  const home = tempDir('design-pro-max-home-');
  t.after(() => {
    removeTree(root);
    removeTree(home);
  });
  const env = isolatedGitEnv(home);
  const git = (...args) => execFileSync('git', ['-C', root, ...IDENTITY, ...args], { env, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const commit = (files, remove = []) => {
    writeTree(root, files);
    for (const file of remove) fs.rmSync(path.join(root, ...file.split('/')));
    git('add', '--all');
    git('commit', '--quiet', '--allow-empty', '-m', 'step');
  };
  return { root, commit };
}

const manifestText = (name, files) => `${JSON.stringify({ schema: 1, bundles: [bundleRecord(name, files)] }, null, 2)}\n`;

test('the history accepts a bundled image recorded at its commit, even after a later update replaced it', (t) => {
  const { root, commit } = historyRepo(t);
  const old = { 'SKILL.md': SKILL('icons-pro-max'), 'assets/logo.png': PNG };
  commit({ 'skills/icons-pro-max/SKILL.md': old['SKILL.md'], 'skills/icons-pro-max/assets/logo.png': PNG, [BUNDLES_FILE]: manifestText('icons-pro-max', old) });
  const next = Buffer.concat([PNG, Buffer.from([7])]);
  commit({ 'skills/icons-pro-max/assets/logo.png': next, [BUNDLES_FILE]: manifestText('icons-pro-max', { ...old, 'assets/logo.png': next }) });
  const report = checkHistory(root);
  assert.deepEqual(report.problems, []);
  assert.equal(report.stats.reviewed, 2);
});

test('the history refuses a bundled image the manifest of its commit does not record, and images of other bundles', (t) => {
  const { root, commit } = historyRepo(t);
  const files = { 'SKILL.md': SKILL('icons-pro-max'), 'assets/logo.png': PNG };
  commit({ 'skills/icons-pro-max/SKILL.md': files['SKILL.md'], 'skills/icons-pro-max/assets/logo.png': PNG, [BUNDLES_FILE]: manifestText('icons-pro-max', files) });
  commit({ 'skills/icons-pro-max/assets/logo.png': Buffer.concat([PNG, Buffer.from([9])]) });
  const report = checkHistory(root);
  assert.equal(report.problems.length, 1, report.problems.join('\n'));
  assert.match(report.problems[0], /skills\/icons-pro-max\/assets\/logo\.png: \.png file that vendor\/bundles\.json at that commit does not record/);

  const second = historyRepo(t);
  const spacing = { 'SKILL.md': SKILL('design-spacing-rhythm'), 'assets/logo.png': PNG };
  second.commit({ 'skills/design-spacing-rhythm/SKILL.md': spacing['SKILL.md'], 'skills/design-spacing-rhythm/assets/logo.png': PNG, [BUNDLES_FILE]: manifestText('design-spacing-rhythm', spacing) });
  const refused = checkHistory(second.root);
  assert.equal(refused.problems.length, 1, refused.problems.join('\n'));
  assert.match(refused.problems[0], /design-spacing-rhythm\/assets\/logo\.png: \.png file that vendor\/bundles\.json at that commit does not record with these bytes, or that BUNDLED_MEDIA does not allow/);
});
