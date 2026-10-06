import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  NAME,
  PAYLOAD,
  REPO_ONLY,
  SUMS_FILE,
  attributeProblems,
  changelogProblems,
  checkRelease,
  pack,
  readZip,
  releaseNotes,
  verifyAssets,
} from '../scripts/release.mjs';
import { sha256 } from '../scripts/lib/vendor.mjs';
import { ROOT, canCreate, commitTree, copyCheckout, isolatedGitEnv, materialize, removeTree, runScript, tempDir } from './helpers.mjs';

const RELEASE = path.join(ROOT, 'scripts', 'release.mjs');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const vendored = (root, ...segments) => path.join(root, 'skills', 'apple', '.vendor', 'demo-part', ...segments);
const write = (root, relative, data) => {
  const file = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
const sums = (zip, file) => `${sha256(fs.readFileSync(file))}  ${zip}\n`;

/**
 * The guard's base fixture made releasable: package.json, skills.json and the repository's licence, notices,
 * changelog, git attributes and ignore rules, committed after `mutate` ran.
 */
function releaseFixture(t, mutate = () => {}) {
  const root = materialize();
  t.after(() => removeTree(root));
  for (const file of ['.gitattributes', '.gitignore', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md']) fs.copyFileSync(path.join(ROOT, file), path.join(root, file));
  write(root, 'package.json', `${JSON.stringify({ name: NAME, version: '0.0.0', private: true }, null, 2)}\n`);
  write(root, 'skills.json', `${JSON.stringify([{ name: 'apple', path: 'skills/apple' }], null, 2)}\n`);
  mutate(root);
  commitTree(root);
  return root;
}

function gitIn(root, t) {
  const home = tempDir('design-pro-max-home-');
  t.after(() => removeTree(home));
  return (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', `user.email=${['fixture', 'users.noreply.github.com'].join('@')}`, '-c', 'commit.gpgsign=false', ...args], { env: isolatedGitEnv(home), encoding: 'utf8' }).trim();
}

test('the repository is ready to pack', () => {
  assert.deepEqual(checkRelease(ROOT).problems, []);
});

test('pack builds one ZIP with the payload, every hidden part and a checksum file', (t) => {
  const root = copyCheckout({ commit: true });
  t.after(() => removeTree(root));
  const result = pack(root);
  assert.equal(result.zip, `${NAME}-v0.0.0.zip`);
  assert.equal(result.parts, 38);
  assert.deepEqual(result.skills, ['apple']);
  assert.match(fs.readFileSync(path.join(result.dist, SUMS_FILE), 'utf8'), /^[0-9a-f]{64} {2}design-pro-max-v0\.0\.0\.zip\n$/);
  const prefix = `${NAME}-v0.0.0/`;
  const entries = readZip(fs.readFileSync(path.join(result.dist, result.zip)));
  assert.ok(entries.every((entry) => entry.name.startsWith(prefix)));
  const files = entries.filter((entry) => !entry.directory).map((entry) => entry.name.slice(prefix.length));
  assert.equal(files.length, result.files);
  assert.deepEqual([...new Set(files.map((file) => file.split('/')[0]))].sort(), [...PAYLOAD].sort());
  for (const file of ['package.json', 'scripts/release.mjs', 'vendor/sources.json', 'test/release.test.mjs', '.gitattributes']) assert.ok(!files.includes(file), file);
  assert.equal(files.filter((file) => /^skills\/apple\/\.vendor\/.+\/UPSTREAM\.json$/.test(file)).length, 38);
  assert.equal(files.filter((file) => /^skills\/apple\/\.vendor\/.+\/LICENSE$/.test(file)).length, 38);
  assert.ok(files.includes('skills/apple/references/parts-index.md'));
  assert.ok(files.includes('skills/apple/assets/apple.svg'));
  if (process.platform !== 'win32') {
    const script = entries.find((entry) => entry.name.endsWith('/xcode-build-benchmark/scripts/benchmark_builds.py'));
    assert.ok(script.mode & 0o100, 'executable bits survive git archive');
  }
});

test('verify accepts packed assets and rejects tampered checksum files', (t) => {
  const root = releaseFixture(t);
  const { dist, zip } = pack(root);
  assert.equal(verifyAssets(dist, { root }).parts, 1);
  const copy = (mutate) => {
    const dir = tempDir('design-pro-max-assets-');
    t.after(() => removeTree(dir));
    fs.cpSync(dist, dir, { recursive: true });
    mutate(dir);
    return dir;
  };
  const sumsFile = (dir) => path.join(dir, SUMS_FILE);
  const tampered = copy((dir) => fs.writeFileSync(sumsFile(dir), fs.readFileSync(sumsFile(dir), 'utf8').replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'))));
  assert.throws(() => verifyAssets(tampered), /design-pro-max-v0\.0\.0\.zip: does not match SHA256SUMS\.txt/);
  const two = copy((dir) => fs.appendFileSync(sumsFile(dir), `${'0'.repeat(64)}  ${NAME}-plugin-v0.0.0.zip\n`));
  assert.throws(() => verifyAssets(two), /must name exactly one file, the release ZIP; it names 2/);
  const plugin = copy((dir) => {
    fs.renameSync(path.join(dir, zip), path.join(dir, `${NAME}-plugin-v0.0.0.zip`));
    fs.writeFileSync(sumsFile(dir), sums(`${NAME}-plugin-v0.0.0.zip`, path.join(dir, `${NAME}-plugin-v0.0.0.zip`)));
  });
  assert.throws(() => verifyAssets(plugin), /installers skip ZIPs with "plugin" in the name/);
  const missing = copy((dir) => fs.rmSync(path.join(dir, zip)));
  assert.throws(() => verifyAssets(missing), /design-pro-max-v0\.0\.0\.zip: is missing/);
});

const BROKEN = [
  ['a second visible SKILL.md', (root) => write(root, 'skills/apple/extra/SKILL.md', '---\nname: extra\ndescription: Another.\n---\n'), /one SKILL\.md outside dot-folders per skill in skills\.json \(skills\/apple\/SKILL\.md\); it holds skills\/apple\/SKILL\.md, skills\/apple\/extra\/SKILL\.md/],
  ['a __pycache__ folder', (root) => write(root, 'skills/apple/.vendor/demo-part/scripts/__pycache__/tool.cpython-314.pyc', 'cache'), /skills\/apple\/\.vendor\/demo-part\/scripts\/__pycache__: __pycache__ folders must not ship/],
  ['a metadata.json file', (root) => write(root, 'skills/apple/metadata.json', '{}\n'), /skills\/apple\/metadata\.json: installers drop files named metadata\.json/],
  ['an unreviewed image', (root) => write(root, 'skills/apple/assets/other.png', PNG), /skills\/apple\/assets\/other\.png: \.png file not on the reviewed list/],
  ['an image under a text name', (root) => write(root, 'skills/apple/notes.md', PNG), /skills\/apple\/notes\.md: PNG image not on the reviewed list/],
  ['an edited vendored file', (root) => fs.appendFileSync(vendored(root, 'SKILL.md'), 'edited\n'), /skills\/apple\/\.vendor\/demo-part\/SKILL\.md: differs from UPSTREAM\.json/],
  ['a part without its LICENSE', (root) => fs.rmSync(vendored(root, 'LICENSE')), /skills\/apple\/\.vendor\/demo-part\/LICENSE: is missing/],
  ['a stray vendored file', (root) => write(root, 'skills/apple/.vendor/demo-part/notes.md', 'not upstream\n'), /skills\/apple\/\.vendor\/demo-part\/notes\.md: belongs to no part/],
  ['a part missing from the manifest', (root) => {
    const file = path.join(root, 'vendor', 'sources.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.parts.push({ ...data.parts[0], id: 'demo-two' });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }, /the archive must hold the 2 parts of vendor\/sources\.json; missing: demo-two; unexpected: none/],
];

for (const [label, mutate, message] of BROKEN) {
  test(`pack refuses an archive with ${label}`, (t) => {
    const root = releaseFixture(t, mutate);
    assert.throws(() => pack(root), message);
  });
}

test('pack refuses an archive with a symlink', { skip: !canCreate('symlink') && 'cannot create a symlink here' }, (t) => {
  const root = releaseFixture(t, (base) => fs.symlinkSync('SKILL.md', path.join(base, 'skills', 'apple', 'alias.md')));
  assert.throws(() => pack(root), /skills\/apple\/alias\.md: is a symlink/);
});

test('pack needs a clean tree, a current skills.json and HEAD at the tag', (t) => {
  const root = releaseFixture(t, (base) => {
    write(base, 'package.json', `${JSON.stringify({ name: NAME, version: '0.1.0', private: true }, null, 2)}\n`);
    write(base, 'CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-07\n\n### Added\n\n- First release.\n');
  });
  const git = gitIn(root, t);
  git('tag', 'v0.1.0');
  assert.equal(pack(root, 'v0.1.0').zip, `${NAME}-v0.1.0.zip`);
  assert.throws(() => pack(root, 'v0.2.0'), /tag v0\.2\.0 does not match package\.json version 0\.1\.0/);
  fs.appendFileSync(path.join(root, 'README.md'), 'More.\n');
  assert.throws(() => pack(root), /Commit every change before packing/);
  git('commit', '--quiet', '-am', 'more');
  assert.throws(() => pack(root, 'v0.1.0'), /HEAD is not v0\.1\.0/);
  write(root, 'skills.json', '[]\n');
  git('commit', '--quiet', '-am', 'stale');
  assert.throws(() => pack(root), /skills\.json does not match the skill folders; run node scripts\/gen\.mjs/);
});

test('check ties a tag to package.json and a dated CHANGELOG entry', (t) => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-07\n\n### Added\n\n- First release.\n\n## [0.0.1] - 2026-10-01\n\n- Old.\n';
  const root = releaseFixture(t, (base) => {
    write(base, 'package.json', `${JSON.stringify({ name: NAME, version: '0.1.0', private: true }, null, 2)}\n`);
    write(base, 'CHANGELOG.md', changelog);
  });
  assert.deepEqual(checkRelease(root, 'v0.1.0').problems, []);
  assert.equal(releaseNotes(changelog, '0.1.0'), '### Added\n\n- First release.');
  assert.throws(() => releaseNotes(changelog, '0.2.0'), /no notes for 0\.2\.0/);
  assert.match(checkRelease(root, 'v0.2.0').problems.join('\n'), /does not match package\.json version 0\.1\.0/);
  assert.match(checkRelease(root, '0.1.0').problems.join('\n'), /0\.1\.0 is not a vX\.Y\.Z tag/);
  assert.match(changelogProblems(changelog.replace('## [Unreleased]\n', '## [Unreleased]\n\n- Pending.\n'), '0.1.0').join('\n'), /\[Unreleased\] still holds entries/);
  assert.match(changelogProblems(changelog.replace(' - 2026-10-07', ''), '0.1.0').join('\n'), /\[0\.1\.0\] needs a date/);
  assert.match(changelogProblems(changelog, '0.0.1').join('\n'), /\[0\.0\.1\] must be the newest version entry/);
  assert.match(changelogProblems(changelog, '0.3.0').join('\n'), /needs exactly one "## \[0\.3\.0\] - YYYY-MM-DD" entry/);
  const unreleased = releaseFixture(t);
  assert.match(checkRelease(unreleased, 'v0.0.0').problems.join('\n'), /version 0\.0\.0 cannot be released/);
});

test('every repo-only path is export-ignore and nothing else is', () => {
  const lines = REPO_ONLY.map((item) => `/${item} export-ignore`);
  assert.deepEqual(attributeProblems(lines.join('\n')), []);
  assert.match(attributeProblems(lines.slice(1).join('\n')).join('\n'), /must have the line "\/\.github export-ignore"/);
  assert.match(attributeProblems([...lines, '*.md export-ignore'].join('\n')).join('\n'), /"\*\.md export-ignore" is not a repo-only path/);
  assert.match(attributeProblems([...lines, 'skills/apple/.vendor export-ignore'].join('\n')).join('\n'), /is not a repo-only path/);
  assert.match(attributeProblems([...lines, 'vendor export-ignore'].join('\n')).join('\n'), /"vendor export-ignore" is not a repo-only path/);
});

test('the release commands report usage errors and results', (t) => {
  for (const args of [[], ['publish'], ['notes'], ['verify'], ['check', '--root'], ['check', 'v1.0.0', 'v2.0.0']]) {
    const result = runScript(RELEASE, args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Usage: node scripts\/release\.mjs|--root needs a value|Unknown argument/, args.join(' '));
  }
  const root = releaseFixture(t);
  const check = runScript(RELEASE, ['check', '--root', root]);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Release inputs are ready for v0\.0\.0\./);
  const packed = runScript(RELEASE, ['pack', '--root', root]);
  assert.equal(packed.status, 0, packed.stderr);
  assert.match(packed.stdout, /Packed .*design-pro-max-v0\.0\.0\.zip with \d+ files, 1 parts and the skill\(s\) apple/);
  const verified = runScript(RELEASE, ['verify', path.join(root, 'dist'), '--root', root]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /Verified design-pro-max-v0\.0\.0\.zip/);
  const empty = tempDir('design-pro-max-empty-');
  t.after(() => removeTree(empty));
  const failed = runScript(RELEASE, ['verify', empty, '--root', root]);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /SHA256SUMS\.txt: is missing/);
  const notes = runScript(RELEASE, ['notes', 'v0.0.0', '--root', root]);
  assert.equal(notes.status, 1);
  assert.match(notes.stderr, /version 0\.0\.0 cannot be released/);
});
