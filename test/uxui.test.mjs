import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/vendor.mjs';
import { UXUI_DATA, UXUI_FILE, UXUI_SKILL, checkUxui, loadUxui } from '../scripts/uxui-sync.mjs';

const CLI = path.join(ROOT, ...UXUI_SKILL.split('/'), 'scripts', 'lucian-uxui.mjs');
const OFFLINE_ENV = { ...process.env, LUCIAN_UXUI_BASE: 'http://127.0.0.1:9', LUCIAN_UXUI_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'uxui-cache-')) };
const run = (...args) => execFileSync(process.execPath, [CLI, ...args], { env: OFFLINE_ENV, encoding: 'utf8' });

test('the bundled uxui-prompt data matches its record', () => {
  assert.deepEqual(checkUxui(ROOT), []);
  assert.equal(loadUxui(ROOT).files.filter((file) => /\/e\/\d+\.txt$/.test(file.path)).length, 480);
});

test('the uxui-prompt CLI searches, fetches and prints tokens with no network', () => {
  assert.match(run('search', 'pricing', 'toggle', '--limit', '3'), /^056 {2}/m);
  assert.match(run('get', '056'), /^<!-- Lucian UX\/UI Prompt #056 · MIT License/);
  assert.match(run('tokens'), /--ux-/);
  assert.match(run('info'), /source: bundled/);
});

test('check reports a changed, a missing and an extra data file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxui-check-'));
  fs.mkdirSync(path.join(root, 'vendor'));
  fs.copyFileSync(path.join(ROOT, UXUI_FILE), path.join(root, UXUI_FILE));
  fs.cpSync(path.join(ROOT, ...UXUI_DATA.split('/')), path.join(root, ...UXUI_DATA.split('/')), { recursive: true });
  const data = path.join(root, ...UXUI_DATA.split('/'), 'api', 'v1', 'en');
  fs.appendFileSync(path.join(data, 'tokens.css'), '\n');
  fs.rmSync(path.join(data, 'e', '001.txt'));
  fs.writeFileSync(path.join(data, 'e', '999.txt'), 'x');
  const problems = checkUxui(root).join('\n');
  assert.match(problems, /tokens\.css: bytes differ/);
  assert.match(problems, /e\/001\.txt: missing/);
  assert.match(problems, /e\/999\.txt: not recorded/);
});
