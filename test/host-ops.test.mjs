import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { loadCases, loadRules } from '../scripts/lib/evidence.mjs';
import { PARTS } from '../scripts/verify.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'host-ops');
const part = (...file) => import(pathToFileURL(path.join(PART, ...file)).href);
const fixture = (...file) => path.join(ROOT, 'fixtures', 'host-ops', ...file);
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'token-budget.json'), 'utf8'));

function collect() {
  const findings = [];
  const add = (level) => (rule, where, measured, expected) => findings.push({ rule, level, where, measured, expected });
  return { findings, error: add('error'), warn: add('warn'), pass: add('pass'), skip: (rule, where, reason) => findings.push({ rule, level: 'skip', where, measured: reason }) };
}

const levels = (findings, rule) => findings.filter((finding) => finding.rule === rule).map((finding) => finding.level);

test('host-ops has seven error rules, each with fixtures, and four warnings with a warn case each', () => {
  const own = loadRules(ROOT).filter((rule) => rule.part === 'host-ops');
  assert.deepEqual(own.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['HO-ENV-01', 'HO-PIPE-01', 'HO-PRIV-01', 'HO-OSA-01', 'HO-TMP-01', 'HO-PLIST-01', 'HO-LAUNCHD-01']);
  assert.deepEqual(own.filter((rule) => rule.level === 'warn').map((rule) => rule.id).sort(), ['HO-WARN-LOG', 'HO-WARN-OPENENV', 'HO-WARN-SSH', 'HO-WARN-TCC']);
  const cases = loadCases(ROOT, 'host-ops');
  for (const rule of own.filter((entry) => entry.level === 'warn')) assert.ok(cases.some((entry) => entry.expect === 'warn' && [entry.rule].flat().includes(rule.id)), `${rule.id} has a warn case`);
  assert.ok(PARTS.includes('host-ops'));
});

test('scan-host judges the fixture scripts red-first', async () => {
  const { scanFiles } = await part('scripts', 'scan-host.mjs');
  const run = (...files) => {
    const report = collect();
    scanFiles(files.map((file) => fixture(...file.split('/'))), report);
    return report.findings;
  };
  assert.ok(levels(run('scripts/env-sourced.sh'), 'HO-ENV-01').includes('error'));
  assert.ok(levels(run('scripts/env-export.zsh'), 'HO-ENV-01').includes('error'));
  assert.deepEqual(levels(run('scripts/env-read.sh'), 'HO-ENV-01'), ['pass']);
  assert.ok(levels(run('scripts/pipefail-grep.sh'), 'HO-PIPE-01').includes('error'));
  assert.deepEqual(levels(run('scripts/pipefail-fixed.sh'), 'HO-PIPE-01'), ['pass']);
  assert.deepEqual(levels(run('scripts/grep-q-without-pipefail.sh'), 'HO-PIPE-01'), ['pass']);
  assert.ok(levels(run('scripts/sudo-stdin.sh'), 'HO-PRIV-01').includes('error'));
  assert.ok(levels(run('applescript/admin-password.applescript'), 'HO-PRIV-01').includes('error'));
  assert.deepEqual(levels(run('scripts/admin-dialog.sh'), 'HO-PRIV-01'), ['pass']);
  assert.ok(levels(run('applescript/tell-variable.applescript'), 'HO-OSA-01').includes('error'));
  assert.ok(levels(run('applescript/tell-in-shell.sh'), 'HO-OSA-01').includes('error'));
  assert.deepEqual(levels(run('applescript/tell-literal.applescript'), 'HO-OSA-01'), ['pass']);
  assert.ok(levels(run('scripts/tmp-worktree.sh'), 'HO-TMP-01').includes('error'));
  assert.ok(levels(run('plists/com.example.tmp.plist'), 'HO-TMP-01').includes('error'));
  assert.deepEqual(levels(run('scripts/kept-worktree.sh'), 'HO-TMP-01'), ['pass']);
  assert.deepEqual(levels(run('scripts/open-env.sh'), 'HO-WARN-OPENENV'), ['warn']);
  assert.deepEqual(levels(run('scripts/open-clean.sh'), 'HO-WARN-OPENENV'), []);
  assert.deepEqual(levels(run('scripts/log-builtin.zsh'), 'HO-WARN-LOG'), ['warn']);
  assert.deepEqual(levels(run('scripts/ssh-double.sh'), 'HO-WARN-SSH'), ['warn']);
});

test('the scan helpers strip comments and recognise shells', async () => {
  const { shellCode, appleScriptLines, kindOf } = await part('scripts', 'scan-host.mjs');
  assert.equal(shellCode('echo "a # b" # source .env').trim(), 'echo "a # b"');
  assert.equal(shellCode("echo 'x#y'"), "echo 'x#y'");
  assert.deepEqual(appleScriptLines('tell application "A" -- tell application x\n(* tell application y *)\n# z'), ['tell application "A" ', '', '']);
  assert.equal(kindOf('run', '#!/usr/bin/env bash\n'), 'shell');
  assert.equal(kindOf('run', 'plain text\n'), null);
  assert.equal(kindOf('job.plist'), 'plist');
});

test('the plist reader parses XML property lists and rejects broken ones', async () => {
  const { parsePlist, PlistError } = await part('scripts', 'check-plist.mjs');
  const value = parsePlist('<?xml version="1.0"?><plist version="1.0"><dict><key>Label</key><string>a &amp; b</string><key>N</key><integer>9</integer><key>T</key><true/><key>A</key><array><string>x</string></array></dict></plist>');
  assert.deepEqual(value, { Label: 'a & b', N: 9, T: true, A: ['x'] });
  assert.throws(() => parsePlist(fs.readFileSync(fixture('plists', 'com.example.broken.plist'), 'utf8')), PlistError);
  assert.throws(() => parsePlist('<plist><dict><key>a</key><string>1</string><key>a</key><string>2</string></dict></plist>'), /twice/);
});

test('check-plist judges the fixture jobs red-first', async () => {
  const { judgeJob, readPlist } = await part('scripts', 'check-plist.mjs');
  const run = (file) => {
    const report = collect();
    judgeJob(file, readPlist(file, 'linux'), report);
    return report.findings;
  };
  assert.deepEqual(levels(run(path.join(PART, 'assets', 'com.example.sync.plist')), 'HO-PLIST-01'), ['skip', 'pass']);
  for (const name of ['com.example.relative.plist', 'com.example.nolabel.plist', 'com.example.broken.plist']) assert.ok(levels(run(fixture('plists', name)), 'HO-PLIST-01').includes('error'), name);
  assert.deepEqual(levels(run(fixture('plists', 'com.example.backup.plist')), 'HO-WARN-TCC'), ['warn']);
  assert.deepEqual(levels(run(fixture('launchd', 'com.example.sync.plist')), 'HO-WARN-TCC'), []);
});

test('probe-launchd reads launchctl print and judges recorded jobs red-first', async () => {
  const { parsePrint, judge } = await part('scripts', 'probe-launchd.mjs');
  const { parsePlist } = await part('scripts', 'check-plist.mjs');
  const folder = '/fixture';
  const plistFile = `${folder}/com.example.sync.plist`;
  const plist = parsePlist(fs.readFileSync(fixture('launchd', 'com.example.sync.plist'), 'utf8'));
  const print = (name) => fs.readFileSync(fixture('launchd', name), 'utf8').replaceAll('@DIR@', folder);
  const parsed = parsePrint(print('print-current.txt'));
  assert.equal(parsed.program, '/usr/local/bin/node');
  assert.deepEqual(parsed.arguments, ['/usr/local/bin/node', '/usr/local/libexec/example-sync/sync.mjs', '--interval', '900']);
  assert.equal(parsed.lastExit, '0');
  assert.equal(parsed.state, 'not running');
  const run = (name, exitCode = 0) => {
    const report = collect();
    judge({ label: 'com.example.sync', domain: 'gui/501', plistFile, plist, print: print(name), exitCode }, report);
    return levels(report.findings, 'HO-LAUNCHD-01');
  };
  assert.ok(!run('print-current.txt').includes('error'));
  assert.ok(!run('print-never-exited.txt').includes('error'));
  for (const name of ['print-stale.txt', 'print-exit-78.txt', 'print-other-path.txt']) assert.ok(run(name).includes('error'), name);
  assert.deepEqual(run('print-not-found.txt', 113), ['error']);
});

test('the host-ops scripts run from a copy outside the repository and exit 2 for bad usage', (t) => {
  const outside = tempDir('host-ops-');
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'host-ops']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const script = (name) => path.join(outside, 'apple', 'host-ops', 'scripts', name);
  assert.equal(runScript(script('scan-host.mjs'), []).status, 2);
  assert.equal(runScript(script('check-plist.mjs'), []).status, 2);
  assert.equal(runScript(script('probe-launchd.mjs'), []).status, 2);
  assert.equal(runScript(script('probe-launchd.mjs'), ['--label', 'a', '--domain', 'nowhere']).status, 2);
  const fail = runScript(script('scan-host.mjs'), ['--project', outside, fixture('scripts', 'env-sourced.sh')]);
  assert.equal(fail.status, 1, fail.stdout);
  const pass = runScript(script('check-plist.mjs'), [path.join(outside, 'apple', 'host-ops', 'assets', 'com.example.sync.plist')]);
  assert.equal(pass.status, 0, pass.stdout);
  if (process.platform !== 'darwin') {
    const skipped = runScript(script('probe-launchd.mjs'), ['--label', 'com.example.sync']);
    assert.equal(skipped.status, 0, skipped.stderr);
    assert.match(skipped.stdout, /"level":"skip"/);
  }
});

test('the host-ops part stays inside its caps and its scripts never change the system', () => {
  const cap = Math.floor(5000 * budget.charsPerToken);
  const text = fs.readFileSync(path.join(PART, 'PART.md'), 'utf8');
  assert.ok(text.length <= cap, `${text.length} characters, cap ${cap}`);
  assert.ok(text.split('\n').length <= 300);
  for (const file of fs.readdirSync(path.join(PART, 'scripts'))) {
    const source = fs.readFileSync(path.join(PART, 'scripts', file), 'utf8');
    for (const call of source.matchAll(/spawnSync\('(\w+)', \[([^\]]*)\]/g)) assert.match(`${call[1]} ${call[2]}`, /^(?:plutil '-lint'|plutil '-convert'|plutil args|launchctl 'print')/, `${file}: ${call[0]}`);
    assert.doesNotMatch(source, /writeFileSync|rmSync|unlinkSync|renameSync/, `${file} writes nothing`);
  }
});
