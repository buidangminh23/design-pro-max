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
  const guarded = 'var last: Bool?\nx.observe(\\.effectiveAppearance) { b, _ in self.paint(b) }\nfunc paint(_ b: NSButton) { let d = b.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua\n guard d != last else { return }\n last = d\n b.needsDisplay = true }';
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
    scanSources([file], asked, { configurable: ['Kinds.w'] });
    assert.deepEqual(asked.findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-CONFIG-01 error']);
    fs.writeFileSync(path.join(folder, 'K.swift'), 'enum Kinds { static let w = "com.example.w" }\n');
    for (const kind of ['com.example.w', 'w', 'Kinds.w']) {
      const named = silent();
      scanSources([file, path.join(folder, 'K.swift')], named, { configurable: [kind] });
      assert.deepEqual(named.findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-CONFIG-01 error'], kind);
    }
    const other = silent();
    scanSources([file, path.join(folder, 'K.swift')], other, { configurable: ['com.example.other'] });
    assert.deepEqual(other.findings.map(({ rule, level }) => `${rule} ${level}`), ['MW-CONFIG-01 pass', 'MW-CONFIG-01 warn']);
    fs.writeFileSync(path.join(folder, 'I.swift'), 'struct Pick: WidgetConfigurationIntent { @Parameter(title: "A") var a: E? }\n');
    const unused = silent();
    scanSources([file, path.join(folder, 'I.swift')], unused);
    assert.equal(unused.findings[0].level, 'error');
    assert.match(unused.findings[0].measured, /Pick is declared/);
  } finally {
    removeTree(folder);
  }
});

test('the scan follows publisher chains, method references and rooted key paths, and needs a dominating guard', async () => {
  const { appearanceObservations, untracedObservation, widgetFacts, parseArguments } = await script('scan-swift.mjs');
  const judged = (source) => appearanceObservations(source).map(({ redraws, guarded }) => `${redraws ? 'redraws' : 'quiet'} ${guarded ? 'guarded' : 'unguarded'}`);
  const head = 'final class T {\n var last: Bool?\n var seen = 0\n';
  const observe = (handler, rest = '') => `${head} init() { o = b.observe(\\.effectiveAppearance) { b, _ in self.paint(b) } }\n func paint(_ b: NSButton) { ${handler} }${rest} }`;
  assert.deepEqual(judged(`${head} init() { b.publisher(for: \\.effectiveAppearance).map { $0.name }.sink { _ in self.b.needsDisplay = true } } }`), ['redraws unguarded']);
  assert.deepEqual(judged(`${head} init() { b.publisher(for: \\.effectiveAppearance).map(\\.name).removeDuplicates().sink { _ in self.b.needsDisplay = true } } }`), ['redraws guarded']);
  assert.deepEqual(judged(`${head} init() { b.publisher(for: \\.effectiveAppearance).sink(receiveValue: apply).store(in: &s) }\n func other() { print(1) }\n func apply(_ a: NSAppearance) { b.image = nil } }`), ['redraws unguarded']);
  assert.deepEqual(judged(`${head} init() { b.publisher(for: \\.effectiveAppearance).assign(to: \\.image, on: b) } }`), ['redraws unguarded']);
  assert.deepEqual(judged(`${head} init() { o = b.observe(\\NSStatusBarButton.effectiveAppearance) { b, _ in b.displayIfNeeded() } } }`), ['redraws unguarded']);
  assert.deepEqual(judged(`${head} init() { o = b.observe(\\.effectiveAppearance, changeHandler: paint) }\n func paint(_ b: NSButton, _ c: Any) { b.layer?.contents = nil } }`), ['redraws unguarded']);
  assert.deepEqual(judged(observe('b.needsDisplay = true\n let d = true\n guard d != last else { return }\n last = d')), ['redraws unguarded']);
  assert.deepEqual(judged(observe('let d = true\n if d != last { seen += 1 }\n b.contentTintColor = nil')), ['redraws unguarded']);
  assert.deepEqual(judged(observe('let d = true\n if d != last { b.needsDisplay = true }')), ['redraws guarded']);
  assert.deepEqual(judged(observe('let d = true\n if d == self.last { return }\n b.needsDisplay = true')), ['redraws guarded']);
  assert.deepEqual(judged(observe('let d = true\n let e = false\n guard d != e else { return }\n b.needsDisplay = true')), ['redraws unguarded']);
  assert.equal(untracedObservation('NotificationCenter.default.addObserver(self, selector: #selector(f), name: n, object: nil)\nlet x = b.effectiveAppearance'), true);
  assert.equal(untracedObservation('let x = b.effectiveAppearance.bestMatch(from: [.aqua])'), false);
  assert.deepEqual(widgetFacts('AppIntentConfiguration(kind: K.a, intent: Shared.Pick.self, provider: P()) { _ in }').configurations.map(({ intent, kind }) => ({ intent, kind })), [{ intent: 'Pick', kind: 'K.a' }]);
  assert.deepEqual(parseArguments(['--configurable', 'a, b', 'Sources']), { inputs: ['Sources'], configurable: ['a', 'b'] });
  assert.throws(() => parseArguments(['--configurable', 'Sources']), /Usage/);
  assert.throws(() => parseArguments(['--configurable', '--x', 'Sources']), /--configurable needs/);
});

test('the probe parses ps and lsof, matches only the extension executable and allows a second of clock rounding', async () => {
  const { parsePs, parseLsof, extensionProcesses, judge, plistString } = await script('probe-extension.mjs');
  const processes = parsePs([
    '  7 Fri Nov 13 09:00:00 2026 /Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W --flag',
    '  8 Fri Nov 13 09:00:00 2026 /Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/WHelper',
    '  9 Fri Nov 13 09:00:00 2026 /usr/bin/W',
    'garbage line',
  ].join('\n'), 'Z');
  assert.equal(processes.length, 3);
  assert.equal(processes[0].started.toISOString(), '2026-11-13T09:00:00.000Z');
  const extension = { app: '/Applications/My App.app', identifier: 'com.example.w', executable: 'W', binary: '/Applications/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W' };
  assert.deepEqual(extensionProcesses(processes, extension).map((item) => item.pid), [7]);
  assert.deepEqual([...parseLsof('p7\nn/a/W\nn/usr/lib/dyld\np8\nn/b').entries()], [[7, ['/a/W', '/usr/lib/dyld']], [8, ['/b']]]);
  assert.equal(plistString('<key>CFBundleExecutable</key>\n\t<string>W</string>', 'CFBundleExecutable'), 'W');
  const process = { pid: 7, started: new Date('2026-11-13T09:00:00Z'), lstart: 'x', launched: extension.binary };
  assert.equal(judge({ extension, process, mapping: [extension.binary], installed: new Date('2026-11-13T09:00:00.900Z') }).stale, false);
  assert.equal(judge({ extension, process, mapping: [extension.binary], installed: new Date('2026-11-13T09:00:02Z') }).stale, true);
  assert.equal(judge({ extension, process, mapping: ['/private/var/folders/x/T/old/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W'], installed: new Date('2026-11-13T08:00:00Z') }).stale, true);
});

test('the probe ignores other apps and debug copies, falls back to the ps path and reads install time from ctime', async (t) => {
  const { extensionProcesses, judge, parsePs, installTime, parseInstalled, findExtensions } = await script('probe-extension.mjs');
  const folder = tempDir();
  t.after(() => removeTree(folder));
  const plist = (id) => `<plist><dict><key>CFBundleExecutable</key><string>W</string><key>CFBundleIdentifier</key><string>${id}</string></dict></plist>`;
  const bundle = (app, id) => {
    const appex = path.join(folder, app, 'Contents', 'PlugIns', 'W.appex', 'Contents');
    fs.mkdirSync(path.join(appex, 'MacOS'), { recursive: true });
    fs.writeFileSync(path.join(appex, 'Info.plist'), plist(id));
    fs.writeFileSync(path.join(appex, 'MacOS', 'W'), 'binary');
    return path.join(appex, 'MacOS', 'W');
  };
  const installed = bundle('Installed/My App.app', 'com.example.w');
  const debug = bundle('Debug/My App.app', 'com.example.w.debug');
  const [extension] = findExtensions(path.join(folder, 'Installed', 'My App.app'));
  assert.equal(extension.identifier, 'com.example.w');
  const table = parsePs([
    `  1 Fri Nov 13 08:00:00 2026 /Applications/Other.app/Contents/PlugIns/W.appex/Contents/MacOS/W`,
    `  2 Fri Nov 13 08:00:00 2026 ${debug}`,
    `  3 Fri Nov 13 08:00:00 2026 /private/var/folders/x/T/gone/My App.app/Contents/PlugIns/W.appex/Contents/MacOS/W`,
    `  4 Fri Nov 13 10:00:00 2026 ${installed}`,
  ].join('\n'), 'Z');
  const owned = extensionProcesses(table, extension);
  assert.deepEqual(owned.map((item) => item.pid), [3, 4]);
  const at = new Date('2026-11-13T09:00:00Z');
  const removed = judge({ extension, process: owned[0], mapping: undefined, installed: at });
  assert.equal(removed.stale, true);
  assert.match(removed.reasons.join(' '), /from the ps arguments/);
  assert.equal(judge({ extension, process: owned[1], mapping: undefined, installed: at }).stale, false);
  const unknown = judge({ extension, process: { pid: 5, started: new Date('2026-11-13T10:00:00Z'), lstart: 'x', launched: null }, mapping: undefined, installed: at });
  assert.deepEqual([unknown.stale, unknown.runs], [false, null]);
  const old = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(installed, old, old);
  fs.utimesSync(path.dirname(path.dirname(path.dirname(installed))), old, old);
  assert.ok(installTime(extension).getTime() > old.getTime() + 1000, 'an updater that keeps the modification time still moves the change time');
  assert.equal(parseInstalled('2026-11-13T09:00:00', '+07:00').toISOString(), '2026-11-13T02:00:00.000Z');
  assert.equal(parseInstalled('2026-11-13T09:00:00Z', '+07:00').toISOString(), '2026-11-13T09:00:00.000Z');
});

test('the probe rejects a recording it cannot read and one without its time zone', (t) => {
  const { outside, scripts } = copyOutside(t);
  const probe = path.join(scripts, 'probe-extension.mjs');
  const app = path.join(outside, 'Forecast.app');
  fs.cpSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'Forecast.app'), app, { recursive: true });
  const localized = path.join(outside, 'ps-localized.txt');
  fs.writeFileSync(localized, `  4242 ven 13 nov 09:03:17 2026 ${app}/Contents/PlugIns/ForecastWidget.appex/Contents/MacOS/ForecastWidget\n`);
  const unreadable = runScript(probe, ['--app', app, '--tz', 'Z', '--ps', localized, '--lsof', localized]);
  assert.equal(unreadable.status, 2, unreadable.stdout);
  assert.match(unreadable.stderr + unreadable.stdout, /LC_ALL=C/);
  const fresh = path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'ps-fresh.txt');
  assert.equal(runScript(probe, ['--app', app, '--ps', fresh, '--lsof', fresh]).status, 2);
  assert.equal(runScript(probe, ['--app', app, '--tz', 'GMT+7', '--ps', fresh, '--lsof', fresh]).status, 2);
});

test('the snapshot runner splits batches, judges sizes and compares bytes', async () => {
  const { batches, judgeResult, compareWithBaseline, parseResults, duplicateFiles, platformControls, orphanBaselines } = await script('snapshot-widgets.mjs');
  assert.deepEqual(duplicateFiles([{ name: 'a/b', file: 'a-b.png' }, { name: 'a:b', file: 'a-b.png' }, { name: 'c', file: 'c.png' }]), [['a-b.png', ['a/b', 'a:b']]]);
  assert.deepEqual(platformControls([path.join(ROOT, 'fixtures', 'menubar-widgets', 'snapshot', 'PlaceholderCatalog.swift')]).map(({ control }) => control), ['ProgressView', 'Link']);
  assert.deepEqual(platformControls([path.join(ROOT, 'fixtures', 'menubar-widgets', 'snapshot', 'StepsCard.swift')]), []);
  assert.equal(judgeResult({ width: 170, height: 170, contentMargins: 16, neededWidth: 120, neededHeight: 120, pixels: [340, 340] }, 2).measured, '340x340 px; content needs 120x120 of 170x170 pt with 16 pt margins');
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
    assert.deepEqual(orphanBaselines(folder, ['a.png']), ['b.png', 'c.png']);
    assert.deepEqual(orphanBaselines(path.join(folder, 'none'), ['a.png']), []);
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
  const app = path.join(outside, 'Forecast.app');
  fs.cpSync(path.join(fixtures, 'probe', 'Forecast.app'), app, { recursive: true });
  const record = (name) => {
    const file = path.join(outside, name);
    fs.writeFileSync(file, fs.readFileSync(path.join(fixtures, 'probe', name), 'utf8').replaceAll('@APP@', app));
    return file;
  };
  const stale = runScript(probe, ['--app', app, '--installed', '2026-11-13T09:00:00', '--tz', '+00:00', '--ps', record('ps-removed-copy.txt'), '--lsof', record('lsof-removed-copy.txt')]);
  assert.equal(stale.status, 1, stale.stdout);
  assert.match(lines(stale.stdout)[0].expected, /pluginkit -a/);
  assert.doesNotMatch(lines(stale.stdout)[0].expected, /pkill|killall/);
  const fresh = runScript(probe, ['--app', app, '--installed', '2026-11-13T09:00:00', '--tz', '+00:00', '--ps', record('ps-fresh.txt'), '--lsof', record('lsof-fresh.txt')]);
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
  const app = path.join(outside, 'Forecast.app');
  fs.cpSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'Forecast.app'), app, { recursive: true });
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
  const probe = menubarWidgetsArgs({ id: 'p', part: 'menubar-widgets', checker: 'probe-extension', app: 'probe/Forecast.app', copies: ['probe/debug/Forecast.app'], installed: '2026-11-13T09:00:00', tz: '+00:00', ps: 'probe/ps-other-apps.txt', lsof: 'probe/lsof-other-apps.txt' }, skill, scratch);
  const app = probe[probe.indexOf('--app') + 1];
  assert.equal(probe[probe.indexOf('--tz') + 1], '+00:00');
  assert.ok(fs.existsSync(path.join(app, 'Contents', 'PlugIns', 'ForecastWidget.appex', 'Contents', 'Info.plist')));
  assert.ok(fs.existsSync(path.join(path.dirname(app), 'debug', 'Forecast.app', 'Contents', 'PlugIns', 'ForecastWidget.appex', 'Contents', 'Info.plist')));
  const recorded = fs.readFileSync(probe[probe.indexOf('--ps') + 1], 'utf8');
  assert.ok(recorded.includes(`${app}/Contents/PlugIns`) && recorded.includes(`${path.dirname(app)}/debug/Forecast.app`) && !recorded.includes('@'));
});

test('verify fails a snapshot case whose baseline run failed, with that run\'s output', { skip: process.platform !== 'darwin' && 'the snapshot runner needs macOS' }, (t) => {
  const scratch = tempDir();
  t.after(() => removeTree(scratch));
  const skill = path.join(scratch, 'skill');
  for (const folder of ['shared', 'menubar-widgets']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(skill, folder), { recursive: true });
  const args = menubarWidgetsArgs({ id: 's', part: 'menubar-widgets', checker: 'snapshot-widgets', baselineSources: ['snapshot/missing.swift'], sources: ['snapshot/Catalog.swift'] }, skill, scratch);
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(run.status, 4);
  assert.match(run.stderr, /baseline run exited 2[\s\S]*missing\.swift/);
});

test('a missing plutil gets the PATH rerun on macOS and, elsewhere, a conversion that leaves the signed app untouched', async () => {
  const { plutilHint } = await script('probe-extension.mjs');
  const inBundle = "Contents/PlugIns/It's.appex/Contents/Info.plist";
  assert.match(plutilHint(`/a/Copy.app/${inBundle}`, inBundle, 'darwin'), /PATH="\/bin:\/usr\/bin:\/usr\/sbin:\$PATH"/);
  const elsewhere = plutilHint(`/a b/Copy.app/${inBundle}`, inBundle, 'linux');
  assert.match(elsewhere, /plutil -convert xml1 -o Info\.xml '<path to the installed \.app>\/Contents\/PlugIns\/It'\\''s\.appex\/Contents\/Info\.plist'/);
  assert.match(elsewhere, /in place of '\/a b\/Copy\.app\/Contents\/PlugIns\/It'\\''s\.appex\/Contents\/Info\.plist' in the copy here/);
  assert.doesNotMatch(elsewhere, /plutil -convert xml1 '/);
  assert.doesNotMatch(elsewhere, /PATH=|record ps/);
});
