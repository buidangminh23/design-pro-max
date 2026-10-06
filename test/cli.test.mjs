import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { VENDOR_DIR } from '../scripts/lib/vendor.mjs';
import { ROOT, canCreate, materialize, removeTree, runScript, tempDir } from './helpers.mjs';

const SYNC = path.join(ROOT, 'scripts', 'vendor-sync.mjs');
const GUARD = path.join(ROOT, 'scripts', 'vendor-guard.mjs');
const vendorPath = (root, ...segments) => path.join(root, ...VENDOR_DIR.split('/'), ...segments);

/**
 * The repository reached through a symlink, the way macOS reaches /tmp through /private/tmp.
 */
function linkedRepository(t) {
  const holder = tempDir('design-pro-max-link-');
  t.after(() => removeTree(holder));
  const link = path.join(holder, 'repository');
  fs.symlinkSync(ROOT, link, 'dir');
  return link;
}

test('vendor-sync runs and fails loudly when started through a symlinked path', { skip: !canCreate('symlink') && 'cannot create a symlink here' }, (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  fs.rmSync(vendorPath(root, 'demo-part', 'LICENSE'));
  const linked = path.join(linkedRepository(t), 'scripts', 'vendor-sync.mjs');
  const result = runScript(linked, ['check', '--root', root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[check\] demo-part\/LICENSE: missing/);
  const notices = runScript(linked, ['notices', '--check', '--root', root]);
  assert.equal(notices.status, 1);
  assert.match(notices.stderr, /demo-part\/LICENSE: is missing; run sync/);
});

test('vendor-guard runs and fails loudly when started through a symlinked path', { skip: !canCreate('symlink') && 'cannot create a symlink here' }, (t) => {
  const root = materialize('secrets');
  t.after(() => removeTree(root));
  const linked = path.join(linkedRepository(t), 'scripts', 'vendor-guard.mjs');
  const result = runScript(linked, ['--root', root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[secrets\] skills\/apple\/\.vendor\/demo-part\/references\/setup\.md: looks like a GitHub token \(line 1\)/);
  assert.match(result.stderr, /Guard failed with 1 problem/);
  const clean = materialize();
  t.after(() => removeTree(clean));
  const passed = runScript(linked, ['--root', clean, '--json']);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(JSON.parse(passed.stdout).ok, true);
});

test('vendor-guard reports usage errors with a non-zero exit', () => {
  const missing = runScript(GUARD, ['--root']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--root needs a value/);
  const unknown = runScript(GUARD, ['--fix']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown argument: --fix/);
});

test('vendor-guard reports a FIFO at a part file instead of hanging', { skip: !canCreate('fifo') && 'cannot create a FIFO here' }, (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const licence = vendorPath(root, 'demo-part', 'LICENSE');
  fs.rmSync(licence);
  execFileSync('mkfifo', [licence]);
  const result = runScript(GUARD, ['--root', root], { timeout: 30_000 });
  assert.equal(result.signal, null, 'the guard finished');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[filesystem\] skills\/apple\/\.vendor\/demo-part\/LICENSE: is not a regular file/);
  assert.match(result.stderr, /\[filesystem\] skills\/apple\/\.vendor\/demo-part\/LICENSE: special files are not allowed/);
});

test('vendor-sync reports usage errors with a non-zero exit', () => {
  for (const args of [[], ['publish'], ['check', '--root'], ['check', '--force']]) {
    const result = runScript(SYNC, args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Usage: node scripts\/vendor-sync\.mjs/, args.join(' '));
  }
  assert.match(runScript(SYNC, ['check', '--root']).stderr, /--root needs a value/);
});

test('check reports FIFOs at the names it reads instead of hanging', { skip: !canCreate('fifo') && 'cannot create a FIFO here' }, (t) => {
  const expected = { LICENSE: /\[check\] demo-part\/LICENSE: is a special file\n/, 'UPSTREAM.json': /\[check\] demo-part: UPSTREAM\.json is not a regular file; run sync\n/ };
  for (const [name, message] of Object.entries(expected)) {
    const root = materialize();
    t.after(() => removeTree(root));
    const file = vendorPath(root, 'demo-part', name);
    fs.rmSync(file);
    execFileSync('mkfifo', [file]);
    const result = runScript(SYNC, ['check', '--root', root], { timeout: 30_000 });
    assert.equal(result.signal, null, `check finished with a FIFO at ${name}`);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /: missing\n/);
  }
  const root = materialize();
  t.after(() => removeTree(root));
  const sources = path.join(root, 'vendor', 'sources.json');
  fs.rmSync(sources);
  execFileSync('mkfifo', [sources]);
  const result = runScript(SYNC, ['check', '--root', root], { timeout: 30_000 });
  assert.equal(result.signal, null, 'check finished with a FIFO as the manifest');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /vendor\/sources\.json: is not a regular file/);
});
