import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadCases, loadRules } from '../scripts/lib/evidence.mjs';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { menubarWidgetsArgs, runsHere } from '../scripts/verify.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'menubar-widgets');
const script = (name) => import(pathToFileURL(path.join(PART, 'scripts', name)).href);
const { createReport } = await import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', 'report.mjs')).href);
const silent = () => createReport({ tool: 't', write: () => {} });

function copyOutside(t) {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'menubar-widgets']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  return { outside, scripts: path.join(outside, 'apple', 'menubar-widgets', 'scripts') };
}

function runAs(platform, file, args) {
  const preload = `data:text/javascript,Object.defineProperty(process,'platform',{value:'${platform}'})`;
  return spawnSync(process.execPath, ['--import', preload, file, ...args], { encoding: 'utf8', timeout: 60_000 });
}

const lines = (stdout) => stdout.split('\n').filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));

test('menubar-widgets has its error rules, each with an existing check and fixtures, and its batch caps match the rule', async () => {
  const rules = loadRules(ROOT).filter((rule) => rule.part === 'menubar-widgets');
  assert.deepEqual(rules.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['MW-APPEAR-01', 'MW-CONFIG-01', 'MW-STALE-01', 'MW-SNAP-01', 'MW-SNAP-02']);
  for (const rule of rules.filter((item) => item.check)) assert.ok(fs.existsSync(path.join(ROOT, SKILL_DIR, ...rule.check.split('/'))), rule.id);
  const { DEFAULT_BATCH, MAX_BATCH } = await script('snapshot-widgets.mjs');
  const batch = rules.find((rule) => rule.id === 'MW-WARN-BATCH');
  assert.ok(batch.values.includes(String(DEFAULT_BATCH)) && batch.values.includes(String(MAX_BATCH)), batch.values);
  assert.ok(MAX_BATCH <= 60, 'the cap stays at or under the measured abort point');
  const cases = loadCases(ROOT, 'menubar-widgets');
  for (const entry of cases.filter((item) => item.checker === 'snapshot-widgets')) assert.equal(entry.platform, 'darwin', entry.id);
});

test('the Swift scan strips comments, keeps strings and follows a handler into the functions it calls', async () => {
  const { stripComments, blockAfter, appearanceObservations, widgetFacts } = await script('scan-swift.mjs');
  const source = 'let a = "// not a comment" // gone\n/* x\n y */ let b = 1';
  const stripped = stripComments(source);
  assert.equal(stripped.length, source.length);
  assert.deepEqual(stripped.split('\n').map((line) => line.trim()), ['let a = "// not a comment"', '', 'let b = 1']);
  assert.equal(blockAfter('f { a { b } c } d', 0).body, '{ a { b } c }');
  const loop = 'x.observe(\\.effectiveAppearance) { b, _ in self.paint(b) }\nfunc paint(_ b: NSButton) { b.needsDisplay = true }';
  assert.deepEqual(appearanceObservations(loop).map(({ redraws, guarded }) => ({ redraws, guarded })), [{ redraws: true, guarded: false }]);
  const guarded = 'x.observe(\\.effectiveAppearance) { b, _ in self.paint(b) }\nfunc paint(_ b: NSButton) { let d = b.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua\n guard d != last else { return }\n last = d\n b.needsDisplay = true }';
  assert.deepEqual(appearanceObservations(guarded).map(({ redraws, guarded: ok }) => ({ redraws, ok })), [{ redraws: true, ok: true }]);
  const commented = '// x.observe(\\.effectiveAppearance) { b, _ in b.needsDisplay = true }';
  assert.deepEqual(appearanceObservations(commented), []);
  const facts = widgetFacts('struct Pick: WidgetConfigurationIntent { @Parameter(title: "A") var a: E? }\nAppIntentConfiguration(kind: "K", intent: Pick.self, provider: P()) { _ in }');
  assert.deepEqual(facts.intents.map(({ name, parameters }) => ({ name, parameters })), [{ name: 'Pick', parameters: true }]);
  assert.deepEqual(facts.configurations.map(({ type, intent, literalKind }) => ({ type, intent, literalKind })), [{ type: 'AppIntentConfiguration', intent: 'Pick', literalKind: '"K"' }]);
});

test('the scan judges an intent declared beside a StaticConfiguration and a widget asked to be configurable', async () => {
  const { scanSources } = await script('scan-swift.mjs');
  const folder = tempDir();
  try {
    const file = path.join(folder, 'W.swift');
    fs.writeFileSync(file, 'struct W: Widget { var body: some WidgetConfiguration { StaticConfiguration(kind: Kinds.w, provider: P()) { _ in } } }\n');
    const plain = silent();
    scanSources([file], plain);
    assert.deepEqual(plain.findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-CONFIG-01 pass']);
    const asked = silent();
    scanSources([file], asked, { configurable: true });
    assert.deepEqual(asked.findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-CONFIG-01 error']);
    fs.writeFileSync(path.join(folder, 'I.swift'), 'struct Pick: WidgetConfigurationIntent { @Parameter(title: "A") var a: E? }\n');
    const unused = silent();
    scanSources([file, path.join(folder, 'I.swift')], unused);
    assert.equal(unused.findings[0].level, 'error');
    assert.match(unused.findings[0].measured, /Pick is declared/);
  } finally {
    removeTree(folder);
  }
});

test('the probe parses ps and lsof, matches only the extension executable and allows a second of clock rounding', async () => {
  const { parsePs, parseLsof, extensionProcesses, judge, plistString } = await script('probe-extension.mjs');
  const processes = parsePs([
    '  7 Thu Nov 13 09:00:00 2026 /Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W --flag',
    '  8 Thu Nov 13 09:00:00 2026 /Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/WHelper',
    '  9 Thu Nov 13 09:00:00 2026 /usr/bin/W',
    'garbage line',
  ].join('\n'));
  assert.equal(processes.length, 3);
  assert.deepEqual(extensionProcesses(processes, 'W').map((item) => item.pid), [7]);
  assert.deepEqual([...parseLsof('p7\nn/a/W\nn/usr/lib/dyld\np8\nn/b').entries()], [[7, ['/a/W', '/usr/lib/dyld']], [8, ['/b']]]);
  assert.equal(plistString('<key>CFBundleExecutable</key>\n\t<string>W</string>', 'CFBundleExecutable'), 'W');
  const extension = { executable: 'W', binary: '/Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W' };
  const process = { pid: 7, started: new Date('2026-11-13T09:00:00'), lstart: 'x' };
  assert.equal(judge({ extension, process, mapping: [extension.binary], installed: new Date('2026-11-13T09:00:00.900') }).stale, false);
  assert.equal(judge({ extension, process, mapping: [extension.binary], installed: new Date('2026-11-13T09:00:02') }).stale, true);
  assert.equal(judge({ extension, process, mapping: ['/private/var/folders/x/T/old/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W'], installed: new Date('2026-11-13T08:00:00') }).stale, true);
});

test('the snapshot runner splits batches, judges sizes and compares bytes', async () => {
  const { batches, judgeResult, compareWithBaseline, parseResults } = await script('snapshot-widgets.mjs');
  assert.deepEqual(batches(0, 40), []);
  assert.deepEqual(batches(85, 40), [[0, 40], [40, 80], [80, 85]]);
  assert.equal(judgeResult({ width: 170, height: 170, neededHeight: 120, pixels: [340, 340] }, 2).ok, true);
  assert.equal(judgeResult({ width: 170, height: 170, neededHeight: 120, pixels: [340, 300] }, 2).ok, false);
  assert.equal(judgeResult({ width: 170, height: 170, neededHeight: 262, pixels: [], problem: 'clips' }, 2).ok, false);
  assert.deepEqual(parseResults('noise\n{"name":"a"}\n{broken\n'), [{ name: 'a' }]);
  const folder = tempDir();
  try {
    fs.writeFileSync(path.join(folder, 'a.png'), 'one');
    fs.writeFileSync(path.join(folder, 'b.png'), 'one');
    fs.writeFileSync(path.join(folder, 'c.png'), 'two');
    assert.equal(compareWithBaseline(path.join(folder, 'a.png'), path.join(folder, 'b.png')), 'same');
    assert.equal(compareWithBaseline(path.join(folder, 'a.png'), path.join(folder, 'c.png')), 'changed');
    assert.equal(compareWithBaseline(path.join(folder, 'a.png'), path.join(folder, 'none.png')), 'missing');
  } finally {
    removeTree(folder);
  }
});

test('the checkers run from a copy outside the repository, exit 2 on bad usage and 1 or 0 on the fixtures', (t) => {
  const { outside, scripts } = copyOutside(t);
  const fixtures = path.join(ROOT, 'fixtures', 'menubar-widgets');
  const scan = path.join(scripts, 'scan-swift.mjs');
  assert.equal(runScript(scan, []).status, 2);
  assert.equal(runScript(scan, ['--nope', fixtures]).status, 2);
  const red = runScript(scan, [path.join(fixtures, 'swift', 'appear-01-kvo-redraw.swift')]);
  assert.equal(red.status, 1, red.stdout);
  assert.ok(lines(red.stdout).some((finding) => finding.rule === 'MW-APPEAR-01' && finding.level === 'error'));
  const green = runScript(scan, [path.join(outside, 'apple', 'menubar-widgets', 'assets')]);
  assert.equal(green.status, 0, green.stdout);
  const probe = path.join(scripts, 'probe-extension.mjs');
  assert.equal(runScript(probe, []).status, 2);
  const app = path.join(outside, 'Usage.app');
  fs.cpSync(path.join(fixtures, 'probe', 'Usage.app'), app, { recursive: true });
  const record = (name) => {
    const file = path.join(outside, name);
    fs.writeFileSync(file, fs.readFileSync(path.join(fixtures, 'probe', name), 'utf8').replaceAll('@APP@', app));
    return file;
  };
  const stale = runScript(probe, ['--app', app, '--installed', '2026-11-13T09:00:00', '--ps', record('ps-removed-copy.txt'), '--lsof', record('lsof-removed-copy.txt')]);
  assert.equal(stale.status, 1, stale.stdout);
  assert.match(lines(stale.stdout)[0].expected, /pluginkit -a/);
  assert.doesNotMatch(lines(stale.stdout)[0].expected, /pkill|killall/);
  const fresh = runScript(probe, ['--app', app, '--installed', '2026-11-13T09:00:00', '--ps', record('ps-fresh.txt'), '--lsof', record('lsof-fresh.txt')]);
  assert.equal(fresh.status, 0, fresh.stdout);
  const snapshot = path.join(scripts, 'snapshot-widgets.mjs');
  assert.equal(runScript(snapshot, []).status, 2);
  assert.equal(runScript(snapshot, ['--out', outside, '--update', fixtures]).status, 2);
  assert.equal(runScript(snapshot, ['--out', outside, '--batch', '61', fixtures]).status, 2);
});

test('off macOS the snapshot runner and the live probe skip their rules and exit 0, never a false pass', (t) => {
  const { outside, scripts } = copyOutside(t);
  const snapshot = runAs('linux', path.join(scripts, 'snapshot-widgets.mjs'), ['--out', path.join(outside, 'png'), '--baseline', path.join(outside, 'base'), path.join(ROOT, 'fixtures', 'menubar-widgets', 'snapshot')]);
  assert.equal(snapshot.status, 0, snapshot.stderr);
  const findings = lines(snapshot.stdout).filter((line) => line.rule);
  assert.deepEqual(findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-SNAP-01 skip', 'MW-SNAP-02 skip']);
  assert.match(findings[0].measured, /need macOS; this is linux/);
  assert.ok(!fs.existsSync(path.join(outside, 'png')), 'nothing was rendered');
  const app = path.join(outside, 'Usage.app');
  fs.cpSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'Usage.app'), app, { recursive: true });
  const probe = runAs('linux', path.join(scripts, 'probe-extension.mjs'), ['--app', app]);
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(lines(probe.stdout).filter((line) => line.rule).map(({ rule, level }) => `${rule} ${level}`), ['MW-STALE-01 skip']);
});

test('verify skips platform cases elsewhere and builds menubar-widgets arguments from the copied part', (t) => {
  assert.equal(runsHere({ platform: 'darwin' }, 'linux'), false);
  assert.equal(runsHere({ platform: 'darwin' }, 'darwin'), true);
  assert.equal(runsHere({}, 'linux'), true);
  const scratch = tempDir();
  t.after(() => removeTree(scratch));
  const skill = path.join(scratch, 'skill');
  const scan = menubarWidgetsArgs({ part: 'menubar-widgets', checker: 'scan-swift', args: ['--configurable'], sources: ['assets/ConfigurableWidget.swift', 'swift/config-02-static-only.swift'] }, skill, scratch);
  assert.deepEqual(scan, [path.join(skill, 'menubar-widgets', 'scripts', 'scan-swift.mjs'), '--configurable', path.join(skill, 'menubar-widgets', 'assets', 'ConfigurableWidget.swift'), path.join(ROOT, 'fixtures', 'menubar-widgets', 'swift', 'config-02-static-only.swift')]);
  const probe = menubarWidgetsArgs({ id: 'p', part: 'menubar-widgets', checker: 'probe-extension', app: 'probe/Usage.app', installed: '2026-11-13T09:00:00', ps: 'probe/ps-fresh.txt', lsof: 'probe/lsof-fresh.txt' }, skill, scratch);
  const app = probe[probe.indexOf('--app') + 1];
  assert.ok(fs.existsSync(path.join(app, 'Contents', 'PlugIns', 'UsageWidget.appex', 'Contents', 'Info.plist')));
  assert.ok(fs.readFileSync(probe[probe.indexOf('--ps') + 1], 'utf8').includes(`${app}/Contents/PlugIns`));
});
