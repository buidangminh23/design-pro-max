import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { checkHistory } from '../scripts/check-history.mjs';
import { REVIEWED_MEDIA, isReviewedMedia, mediaKind } from '../scripts/lib/media.mjs';
import { ROOT, isolatedGitEnv, removeTree, runScript, tempDir } from './helpers.mjs';

const CHECK = path.join(ROOT, 'scripts', 'check-history.mjs');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'history');
const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif: [...Buffer.from('GIF89a')],
  woff2: [...Buffer.from('wOF2')],
};
const IDENTITY = ['-c', 'user.name=Fixture', '-c', `user.email=${['fixture', 'users.noreply.github.com'].join('@')}`, '-c', 'commit.gpgsign=false'];
const isShallow = () => execFileSync('git', ['-C', ROOT, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
const withoutCommit = (problems) => problems.map((problem) => problem.replace(/^[0-9a-f]{12} /, '')).sort();

/**
 * Each expected message starts exactly one of the problems, and there are no others.
 */
function assertProblems(problems, expected) {
  const found = withoutCommit(problems);
  assert.equal(found.length, expected.length, found.join('\n'));
  for (const message of expected) assert.equal(found.filter((line) => line.startsWith(message)).length, 1, `${message}\nin:\n${found.join('\n')}`);
}

function contentOf(spec) {
  if (typeof spec === 'string') return spec;
  if (spec.copy) return fs.readFileSync(path.join(ROOT, ...spec.copy.split('/')));
  return Buffer.concat([Buffer.from(SIGNATURES[spec.signature]), Buffer.alloc(32)]);
}

/**
 * A git repository built from the steps of a history fixture. Each step writes and removes files, then commits.
 */
function repository(t, steps) {
  const root = tempDir('design-pro-max-history-');
  const home = tempDir('design-pro-max-home-');
  t.after(() => {
    removeTree(root);
    removeTree(home);
  });
  const env = isolatedGitEnv(home);
  const git = (...args) => execFileSync('git', ['-C', root, ...IDENTITY, ...args], { env, encoding: 'utf8' }).trim();
  const apply = (step) => {
    for (const [file, spec] of Object.entries(step.files ?? {})) {
      const target = path.join(root, ...file.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contentOf(spec));
    }
    for (const file of step.remove ?? []) fs.rmSync(path.join(root, ...file.split('/')));
    git('add', '--all');
  };
  const commit = (step, message = 'step') => {
    apply(step);
    git('commit', '--quiet', '--allow-empty', '-m', message);
  };
  git('init', '--quiet');
  steps.forEach((step, index) => commit(step, `step ${index + 1}`));
  return { root, env, git, apply, commit };
}

test('the repository history holds no unreviewed media and no vendored agents/ or assets/ files', { skip: isShallow() && 'this clone is shallow' }, () => {
  const report = checkHistory(ROOT);
  assert.deepEqual(report.problems, []);
  assert.equal(report.stats.reviewed, 1);
});

for (const name of fs.readdirSync(FIXTURES).filter((file) => file.endsWith('.json')).sort()) {
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
  test(`history fixture ${name.slice(0, -'.json'.length)}: ${spec.description}`, (t) => {
    const { root } = repository(t, spec.commits);
    const report = checkHistory(root);
    assertProblems(report.problems, spec.expect);
    assert.equal(report.ok, spec.expect.length === 0);
  });
}

test('the command exits 1 on a failing history and names each file', (t) => {
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'image-in-old-commit.json'), 'utf8'));
  const { root } = repository(t, spec.commits);
  const failed = runScript(CHECK, ['--root', root]);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /^\[history\] [0-9a-f]{12} docs\/shot\.png: \.png file not on the reviewed list/m);
  assert.match(failed.stderr, /History check failed with 1 problem\(s\) \(2 commits/);
  const clean = repository(t, JSON.parse(fs.readFileSync(path.join(FIXTURES, 'clean.json'), 'utf8')).commits);
  const passed = runScript(CHECK, ['--root', clean.root]);
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /History check passed \(2 commits, \d+ file versions, 1 reviewed media file\(s\)\)/);
  assert.match(runScript(CHECK, ['--rev']).stderr, /--rev needs a value/);
  assert.match(runScript(CHECK, ['--all']).stderr, /Unknown argument: --all/);
  assert.match(runScript(CHECK, ['--root', clean.root, '--rev', 'no-such-branch']).stderr, /no-such-branch does not name a commit/);
});

test('only commits reachable from the checked revision count, and merges are checked against each parent', (t) => {
  const { root, git, apply, commit } = repository(t, [{ files: { 'README.md': '# Fixture\n' } }]);
  const main = git('rev-parse', '--abbrev-ref', 'HEAD');
  git('checkout', '--quiet', '-b', 'side');
  commit({ files: { 'docs/side.png': { signature: 'png' } } }, 'side image');
  git('checkout', '--quiet', main);
  commit({ files: { 'NOTES.md': 'main moves on\n' } }, 'main');
  assert.deepEqual(checkHistory(root).problems, []);
  assertProblems(checkHistory(root, 'side').problems, ['docs/side.png: .png file not on the reviewed list']);
  git('checkout', '--quiet', '-b', 'evil', main);
  git('merge', '--quiet', '--no-ff', '--no-commit', 'side');
  apply({ files: { 'docs/evil.gif': { signature: 'gif' } }, remove: ['docs/side.png'] });
  git('commit', '--quiet', '-m', 'merge side without its image, plus another');
  assertProblems(checkHistory(root, main).problems, []);
  assertProblems(checkHistory(root, 'evil').problems, ['docs/evil.gif: .gif file not on the reviewed list', 'docs/side.png: .png file not on the reviewed list']);
});

test('a shallow clone fails instead of passing on half the history', (t) => {
  const { root, env } = repository(t, [{ files: { 'README.md': '# Fixture\n' } }, { files: { 'NOTES.md': 'two\n' } }]);
  const shallow = tempDir('design-pro-max-shallow-');
  t.after(() => removeTree(shallow));
  execFileSync('git', ['clone', '--quiet', '--depth', '1', pathToFileURL(root).href, shallow], { env });
  const report = checkHistory(shallow);
  assert.equal(report.ok, false);
  assert.match(report.problems[0], /the clone is shallow/);
});

test('mediaKind recognises media by extension and by first bytes, and leaves ordinary text alone', () => {
  assert.equal(mediaKind('docs/logo.SVG'), '.svg file');
  assert.equal(mediaKind('fonts/a.woff2'), '.woff2 file');
  assert.equal(mediaKind('notes.md', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])), 'PNG image');
  assert.equal(mediaKind('clip.bin', Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypmp42')])), 'ISO media file (MP4, MOV, HEIC or AVIF)');
  assert.equal(mediaKind('pack.data', Buffer.from([0x1f, 0x8b, 0x08, 0x00])), 'gzip archive');
  assert.equal(mediaKind('icon.txt', Buffer.from('<!-- an icon -->\n<svg viewBox="0 0 1 1"/>')), 'SVG image');
  for (const text of ['Use free tools today.', 'BMI is a number.', 'ID3 tags hold titles.', 'icns are icons.', 'true story', 'OTTO von Bismarck', 'BZh9 is not bzip2', 'Rar! said the lion', 'Plain text saved under an image name.\n']) {
    assert.equal(mediaKind('notes.md', Buffer.from(text)), null, text);
  }
});

test('only the reviewed bytes of a reviewed path pass', () => {
  const file = [...REVIEWED_MEDIA.keys()][0];
  const bytes = fs.readFileSync(path.join(ROOT, ...file.split('/')));
  assert.equal(isReviewedMedia(file, bytes), true);
  assert.equal(isReviewedMedia(file, Buffer.concat([bytes, Buffer.from('\n')])), false);
  assert.equal(isReviewedMedia('skills/apple/assets/other.svg', bytes), false);
});
