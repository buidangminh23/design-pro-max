import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadCases, loadRules } from '../scripts/lib/evidence.mjs';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { PARTS, desktopDistributionArgs } from '../scripts/verify.mjs';
import { ROOT, removeTree, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'desktop-distribution');
const script = (name) => import(pathToFileURL(path.join(PART, 'scripts', name)).href);
const fixture = (...file) => path.join(ROOT, 'fixtures', 'desktop-distribution', ...file);
const { createReport } = await import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', 'report.mjs')).href);
const { evaluateRun } = await import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', 'harness.mjs')).href);
const silent = () => createReport({ tool: 't', write: () => {} });
const levels = (report, rule) => report.findings.filter((finding) => finding.rule === rule).map((finding) => finding.level);

test('desktop-distribution has ten error rules with fixtures and eight warnings, and every warn rule with a check has a warn case', () => {
  const rules = loadRules(ROOT).filter((rule) => rule.part === 'desktop-distribution');
  assert.deepEqual(rules.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['DD-SIGN-01', 'DD-TEAM-01', 'DD-GATE-01', 'DD-INSTALL-01', 'DD-INSTALL-02', 'DD-INSTALL-03', 'DD-CASK-01', 'DD-CASK-02', 'DD-CASK-03', 'DD-FEED-01']);
  assert.equal(rules.filter((rule) => rule.level === 'warn').length, 8);
  const cases = loadCases(ROOT, 'desktop-distribution');
  for (const rule of rules.filter((entry) => entry.level === 'warn' && entry.check && entry.id !== 'DD-WARN-REGISTER' && entry.id !== 'DD-WARN-XATTR')) {
    assert.ok(cases.some((entry) => entry.expect === 'warn' && [entry.rule].flat().includes(rule.id)), `${rule.id} has a warn case`);
  }
  assert.ok(cases.some((entry) => entry.expect === 'warn' && [entry.rule].flat().includes('DD-WARN-XATTR') && [entry.rule].flat().includes('DD-WARN-REGISTER')));
  assert.ok(PARTS.includes('desktop-distribution'));
});

test('every desktop-distribution case is judged right from the repository copy, red first', () => {
  const skill = path.join(ROOT, SKILL_DIR);
  for (const entry of loadCases(ROOT, 'desktop-distribution').map((item) => ({ ...item, part: 'desktop-distribution' }))) {
    const result = spawnSync(process.execPath, desktopDistributionArgs(entry, skill), { encoding: 'utf8', timeout: 60_000 });
    const verdict = evaluateRun(entry, { code: result.status, stdout: result.stdout });
    assert.ok(verdict.ok, `${entry.id}: ${verdict.problems.join('; ')}`);
  }
});

test('codesign and spctl output are read into signature kinds, teams and Gatekeeper answers', async () => {
  const { parseCodesignInfo, parseSpctl } = await script('probe-app.mjs');
  const developer = parseCodesignInfo('CodeDirectory v=20500 size=1 flags=0x10000(runtime) hashes=1\nAuthority=Developer ID Application: Example (ABCDE12345)\nTimestamp=Jan 1, 2026\nTeamIdentifier=ABCDE12345\n');
  assert.deepEqual([developer.kind, developer.team, developer.runtime, developer.timestamp], ['developer-id', 'ABCDE12345', true, true]);
  const adhoc = parseCodesignInfo('CodeDirectory v=20400 size=1 flags=0x2(adhoc) hashes=1\nSignature=adhoc\nTeamIdentifier=not set\n');
  assert.deepEqual([adhoc.kind, adhoc.team], ['adhoc', null]);
  assert.equal(parseCodesignInfo('x: code object is not signed at all').kind, 'unsigned');
  assert.equal(parseCodesignInfo('Authority=Apple Development: A (B)\nTeamIdentifier=B').kind, 'development');
  assert.deepEqual(parseSpctl('A.app: accepted\nsource=Notarized Developer ID\n', 0), { accepted: true, source: 'Notarized Developer ID' });
  assert.equal(parseSpctl('A.app: rejected\nsource=Unnotarized Developer ID\n', 3).accepted, false);
});

test('the runtime scan flags Homebrew, /usr/local and env shebangs, and accepts a bundled runtime', async () => {
  const { outsideRuntimes } = await script('probe-app.mjs');
  assert.deepEqual(outsideRuntimes(fixture('probe', 'apps', 'Relay.app')), []);
  const hits = outsideRuntimes(fixture('probe', 'apps', 'RelayPath.app')).map((hit) => hit.file).sort();
  assert.deepEqual(hits, ['Contents/Resources/helper.json:2', 'Contents/Resources/helper/start.sh:1']);
});

test('the live probe skips off macOS and refuses a recording without the app entry', () => {
  const probe = path.join(PART, 'scripts', 'probe-app.mjs');
  if (process.platform !== 'darwin') {
    const run = spawnSync(process.execPath, [probe, '--app', fixture('probe', 'apps', 'Relay.app'), '--project', ROOT], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /"level":"skip"/);
  }
  const folder = tempDir();
  const record = path.join(folder, 'r.json');
  try {
    fs.writeFileSync(record, JSON.stringify({ verify: { status: 0, output: '' }, spctl: { status: 0, output: '' }, code: {} }));
    const run = spawnSync(process.execPath, [probe, '--app', 'X.app', '--record', record], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /code\["\."\]/);
  } finally {
    removeTree(folder);
  }
});

test('the installer reader joins continuations, drops comments outside quotes and follows destination variables', async () => {
  const { shellLines, destinations, isDestination, checkInstaller } = await script('check-installer.mjs');
  const lines = shellLines('#!/bin/bash\nA="/Applications/X.app" # dest\nB="$A"\ncurl -fsSL \\\n  -o x "https://e/x#frag"\n');
  assert.deepEqual(lines.map((line) => [line.number, line.text]), [[2, 'A="/Applications/X.app"'], [3, 'B="$A"'], [4, 'curl -fsSL -o x "https://e/x#frag"']]);
  const names = destinations(lines);
  assert.ok(names.has('A') && names.has('B'));
  assert.ok(isDestination('${B}', names) && isDestination('/Applications/Y.app', names) && !isDestination('$WORK/staged.app', names));
  const report = silent();
  checkInstaller('DEST="/Applications/X.app"\ncurl -fsSL -o a.zip "$URL"\n', 'i.sh', report);
  assert.deepEqual(levels(report, 'DD-INSTALL-01'), ['error']);
});

test('the cask reader ignores comments and flight words inside strings, and reads multi-line uninstall stanzas', async () => {
  const { stanzas, stripRubyComments, checkCask } = await script('check-cask.mjs');
  const text = stripRubyComments('cask "a" do\n  # postflight do\n  desc "a postflight do b"\n  uninstall quit: "x",\n            login_item: "A"\nend\n');
  assert.equal(stanzas(text, 'uninstall').length, 1);
  assert.match(stanzas(text, 'uninstall')[0].body, /login_item/);
  const report = silent();
  checkCask('cask "a" do\n  # postflight do\n  desc "a postflight do b"\nend\n', 'a.rb', {}, report);
  assert.deepEqual(levels(report, 'DD-CASK-01'), ['pass']);
  assert.deepEqual(levels(report, 'DD-CASK-03'), ['skip']);
});

test('a feed entry with an installer suffix counts for its platform', async () => {
  const { entryFor } = await script('check-feed.mjs');
  assert.equal(entryFor({ 'darwin-aarch64-app': {} }, 'darwin-aarch64').key, 'darwin-aarch64-app');
  assert.equal(entryFor({ 'darwin-aarch64x': {} }, 'darwin-aarch64'), null);
});
