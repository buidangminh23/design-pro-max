import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RECORD_KEYS, VENDOR_DIR, readUpstream } from '../scripts/lib/vendor.mjs';
import { ROOT, canCreate, commitUpstream, isolatedGitEnv, materialize, removeTree, runScript, tempDir, upstreamEnv } from './helpers.mjs';

const SYNC = path.join(ROOT, 'scripts', 'vendor-sync.mjs');
const MIT = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'guard', 'base', 'skills', 'apple', '.vendor', 'demo-part', 'LICENSE'), 'utf8');
const SKILL = '---\nname: demo-part\ndescription: A demonstration part used by the sync tests.\n---\n\n# demo-part\n';
const vendorPath = (root, ...segments) => path.join(root, ...VENDOR_DIR.split('/'), ...segments);

/**
 * A checkout whose manifest pins one part to a fake upstream repository holding `files` and a root MIT licence.
 */
function setup(t, files, overrides = {}) {
  const home = tempDir('design-pro-max-upstream-');
  const root = materialize();
  t.after(() => {
    removeTree(home);
    removeTree(root);
  });
  const commit = commitUpstream(home, 'fake/demo', { LICENSE: MIT, ...files });
  fs.rmSync(vendorPath(root, 'demo-part'), { recursive: true });
  const part = { id: 'demo-part', repo: 'fake/demo', commit, path: 'skills/demo-part', exclude: [], active: true, activation: 'None; active by default.', prerequisites: [], risks: [], errata: [], appleText: [], ...overrides };
  fs.writeFileSync(path.join(root, 'vendor', 'sources.json'), `${JSON.stringify({ schema: 1, parts: [part] }, null, 2)}\n`);
  const run = (...args) => runScript(SYNC, [...args, '--root', root], { env: upstreamEnv(home) });
  return { home, root, run };
}

test('sync copies a part byte for byte with its modes, then stays offline', (t) => {
  const { home, root, run } = setup(t, {
    'skills/demo-part/SKILL.md': SKILL,
    'skills/demo-part/scripts/run.sh': { text: '#!/bin/sh\necho demo\n', executable: true },
    'skills/demo-part/agents/openai.yaml': 'interface:\n  display_name: Demo\n',
    'skills/other/SKILL.md': SKILL,
  }, { exclude: ['agents/**'] });
  const first = run('sync');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /fetched\s+demo-part \(3 files/);
  const dir = vendorPath(root, 'demo-part');
  assert.equal(fs.readFileSync(path.join(dir, 'scripts', 'run.sh'), 'utf8'), '#!/bin/sh\necho demo\n');
  assert.equal(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8'), MIT);
  assert.ok(!fs.existsSync(path.join(dir, 'agents')));
  const record = readUpstream(root, 'demo-part');
  assert.deepEqual(Object.keys(record), RECORD_KEYS);
  assert.deepEqual(record.files.map((file) => [file.path, file.executable]), [['LICENSE', false], ['SKILL.md', false], ['scripts/run.sh', true]]);
  if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(dir, 'scripts', 'run.sh')).mode & 0o100);
  const check = runScript(SYNC, ['check', '--root', root]);
  assert.equal(check.status, 0, check.stderr);

  const offline = runScript(SYNC, ['sync', '--root', root], {
    env: isolatedGitEnv(home, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'url.file:///design-pro-max-no-such-upstream/.insteadOf', GIT_CONFIG_VALUE_0: 'https://github.com/' }),
  });
  assert.equal(offline.status, 0, offline.stderr);
  assert.match(offline.stdout, /unchanged\s+demo-part/);
});

test('sync never writes through a symlinked group folder', { skip: !canCreate('symlink') && 'cannot create a symlink here' }, (t) => {
  const { root, run } = setup(t, { 'skills/demo-part/SKILL.md': SKILL }, { id: 'grp/demo-part' });
  const outside = tempDir('design-pro-max-outside-');
  t.after(() => removeTree(outside));
  fs.writeFileSync(path.join(outside, 'sentinel.txt'), 'keep me\n');
  fs.symlinkSync(outside, vendorPath(root, 'grp'));
  for (const args of [['sync'], ['sync', '--force']]) {
    const result = run(...args);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /skills\/apple\/\.vendor\/grp is a symlink; remove it before syncing/);
  }
  assert.deepEqual(fs.readdirSync(outside), ['sentinel.txt']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'keep me\n');
});

test('sync refuses upstream files that collide with generated names or change what git stores', (t) => {
  const { root, run } = setup(t, {
    'skills/demo-part/SKILL.md': SKILL,
    'skills/demo-part/License': 'An upstream notice that LICENSE would overwrite on a case-insensitive disk.\n',
    'skills/demo-part/.gitignore': 'references/\n',
    'skills/demo-part/assets/logo.png': 'not an image\n',
  });
  const result = run('sync');
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /License: differs only in case from the LICENSE that sync writes; exclude it/);
  assert.match(result.stderr, /\.gitignore: is git metadata/);
  assert.match(result.stderr, /assets\/logo\.png: is an image, media, font or archive file/);
  assert.ok(!fs.existsSync(vendorPath(root, 'demo-part')));
});
