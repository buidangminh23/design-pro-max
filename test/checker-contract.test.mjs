import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const SKILL = path.join(ROOT, SKILL_DIR);
const script = (...parts) => path.join(SKILL, ...parts);
const scratch = (t) => {
  const folder = tempDir();
  t.after(() => removeTree(folder));
  return folder;
};
const summaryOf = (stdout) => stdout.trim().split('\n').map((line) => JSON.parse(line)).find((line) => typeof line.boundary === 'string');

test('the checkers that load no Playwright accept and ignore --project, as the router passes it to every checker', (t) => {
  const folder = scratch(t);
  const project = path.join(folder, 'project');
  fs.mkdirSync(project);
  const css = path.join(folder, 'page.css');
  fs.writeFileSync(css, 'body { font-family: system-ui; }\n');
  const swift = path.join(ROOT, 'fixtures', 'menubar-widgets', 'swift', 'appear-01-kvo-redraw.swift');
  const runs = [
    [script('launch-page', 'scripts', 'lint-css.mjs'), ['--project', project, css], /"tool":"lint-css"/],
    [script('menubar-widgets', 'scripts', 'scan-swift.mjs'), ['--project', project, swift], /"tool":"scan-swift"/],
    [script('menubar-widgets', 'scripts', 'snapshot-widgets.mjs'), ['--project', project, '--out', folder, '--update', swift], /--update needs --baseline/],
    [script('launch-video', 'scripts', 'encode.mjs'), ['missing.mov', '--project', project, '--out', path.join(folder, 'out')], /missing\.mov does not exist/],
    [script('launch-scroll', 'scripts', 'encode-scrub.mjs'), ['missing.mov', '--project', project, '--out', path.join(folder, 'out')], /missing\.mov does not exist/],
    [script('launch-scroll', 'scripts', 'make-sequence.mjs'), ['missing.mov', '--project', project, '--out', path.join(folder, 'out')], /missing\.mov does not exist/],
    [script('shared', 'check-media.mjs'), ['--project', project, '--poster', 'a.jpg', 'clip.mp4'], /need --profile demo/],
  ];
  for (const [file, args, expected] of runs) {
    const result = runScript(file, args);
    const output = `${result.stdout}${result.stderr}`;
    assert.doesNotMatch(output, /Unknown option|Usage: node lint-css/, `${path.basename(file)}: ${result.stderr}`);
    assert.match(output, expected, `${path.basename(file)}: ${result.stderr}`);
  }
  assert.equal(runScript(script('launch-page', 'scripts', 'lint-css.mjs'), ['--project']).status, 2, '--project still needs a value');
});

test('encode prints a shell-quoted rerun command when the sandbox blocks VideoToolbox', { skip: process.platform === 'win32' }, (t) => {
  const folder = scratch(t);
  const bin = path.join(folder, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'ffmpeg'), "#!/bin/sh\necho 'Cannot create compression session: -12908' >&2\nexit 1\n", { mode: 0o755 });
  const master = path.join(folder, 'my master');
  fs.mkdirSync(master);
  const header = Buffer.alloc(26);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  header.writeUInt32BE(640, 16);
  header.writeUInt32BE(360, 20);
  header[25] = 2;
  fs.writeFileSync(path.join(master, 'frame-00000.png'), header);
  const out = path.join(folder, 'out dir');
  const result = runScript(script('launch-video', 'scripts', 'encode.mjs'), [master, '--out', out, '--background', '#ffffff'], { env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  assert.equal(result.status, 3, result.stderr);
  assert.ok(result.stderr.includes(`'${master}'`), result.stderr);
  assert.ok(result.stderr.includes(`'${out}'`), result.stderr);
  assert.ok(result.stderr.includes("'#ffffff'"), result.stderr);
});

test('probe-webkit names the WebKit browser in its install command when Playwright is missing', (t) => {
  const project = scratch(t);
  const result = runScript(script('web-shells', 'scripts', 'probe-webkit.mjs'), ['--url', 'https://127.0.0.1:9/', '--project', project]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /npx playwright install webkit/);
  assert.doesNotMatch(result.stderr, /chromium-headless-shell/);
});

test('probe-extension judges a recorded --ps without running lsof, and prints a command when a system tool is missing', (t) => {
  const folder = scratch(t);
  const empty = path.join(folder, 'empty-path');
  fs.mkdirSync(empty);
  const app = path.join(folder, 'Forecast.app');
  fs.cpSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'Forecast.app'), app, { recursive: true });
  const ps = path.join(folder, 'ps.txt');
  fs.writeFileSync(ps, fs.readFileSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'ps-fresh.txt'), 'utf8').replaceAll('@APP@', app));
  const probe = script('menubar-widgets', 'scripts', 'probe-extension.mjs');
  const env = { ...process.env, PATH: empty };
  const recorded = runScript(probe, ['--app', app, '--installed', '2026-11-13T09:00:00', '--tz', '+00:00', '--ps', ps], { env });
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /from the ps arguments/);
  if (process.platform !== 'darwin') return;
  const live = runScript(probe, ['--app', app], { env });
  assert.equal(live.status, 2, live.stderr);
  assert.match(live.stderr, /ps is not on PATH/);
  assert.match(live.stderr, /PATH="\/bin:\/usr\/bin:\/usr\/sbin:\$PATH" node /);
});

test('off macOS a binary Info.plist without plutil asks for an XML copy from the Mac, not a new recording', (t) => {
  const folder = scratch(t);
  const empty = path.join(folder, 'empty-path');
  fs.mkdirSync(empty);
  const app = path.join(folder, 'Forecast.app');
  fs.cpSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'Forecast.app'), app, { recursive: true });
  const plists = fs.readdirSync(path.join(app, 'Contents', 'PlugIns')).map((name) => path.join(app, 'Contents', 'PlugIns', name, 'Contents', 'Info.plist'));
  for (const plist of plists) fs.writeFileSync(plist, Buffer.concat([Buffer.from('bplist00'), Buffer.alloc(32)]));
  const ps = path.join(folder, 'ps.txt');
  fs.writeFileSync(ps, fs.readFileSync(path.join(ROOT, 'fixtures', 'menubar-widgets', 'probe', 'ps-fresh.txt'), 'utf8').replaceAll('@APP@', app));
  const preload = "data:text/javascript,Object.defineProperty(process,'platform',{value:'linux'})";
  const probe = script('menubar-widgets', 'scripts', 'probe-extension.mjs');
  const args = ['--import', preload, probe, '--app', app, '--installed', '2026-11-13T09:00:00', '--tz', '+00:00', '--ps', ps];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, PATH: empty }, timeout: 60_000 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /plutil is not on PATH/);
  assert.match(result.stderr, /plutil -convert xml1 -o Info\.xml '<path to the installed \.app>\/Contents\/PlugIns\/[^'\/]+\.appex\/Contents\/Info\.plist'/);
  assert.doesNotMatch(result.stderr, /plutil -convert xml1 '/);
  assert.doesNotMatch(result.stderr, /record ps and lsof|PATH="\/bin/);
});

test('a missing openssl names the commands that install it', async () => {
  const { createSelfSignedCert } = await import(pathToFileURL(script('shared', 'server.mjs')).href);
  const saved = process.env.PATH;
  const folder = tempDir();
  process.env.PATH = path.join(folder, 'nothing');
  try {
    assert.throws(() => createSelfSignedCert(folder), (error) => error.code === 2 && /brew install openssl/.test(error.hint) && /apt install openssl/.test(error.hint));
  } finally {
    process.env.PATH = saved;
    removeTree(folder);
  }
});

test('the file server CLI exits 3 with the rerun message when the sandbox blocks listening', (t) => {
  const folder = scratch(t);
  const patch = path.join(folder, 'deny-listen.mjs');
  fs.writeFileSync(patch, "import net from 'node:net';\nnet.Server.prototype.listen = function () {\n  const error = Object.assign(new Error('listen EPERM: operation not permitted 127.0.0.1'), { code: 'EPERM' });\n  process.nextTick(() => this.emit('error', error));\n  return this;\n};\n");
  const server = script('shared', 'server.mjs');
  const blocked = spawnSync(process.execPath, ['--import', pathToFileURL(patch).href, server, folder], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(blocked.status, 3, blocked.stderr);
  assert.match(blocked.stderr, /must run outside the agent sandbox/);
  assert.doesNotMatch(blocked.stderr, /^\s+at /m);
  const usage = runScript(server, []);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /Usage: node server\.mjs/);
});

test('check-embed files its playback warnings under a warn rule that describes them', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules.json'), 'utf8')).rules;
  const source = fs.readFileSync(script('launch-video', 'scripts', 'check-embed.mjs'), 'utf8');
  const calls = [...source.matchAll(/report\.check\('([A-Z0-9-]+)'[^\n]*?, '(warn)'\);/g)].map((match) => match[1]);
  assert.ok(calls.length >= 4, 'found the warn checks');
  for (const id of calls) assert.equal(rules.find((rule) => rule.id === id)?.level, 'warn', `${id} is reported at warn level`);
  const playback = rules.find((rule) => rule.id === 'LV-WARN-PLAYBACK');
  assert.ok(playback, 'LV-WARN-PLAYBACK is in rules.json');
  assert.ok(playback.statement.includes('half'), 'half');
});

test('LV-WARN-PLAYBACK claims and reports only what its cited evidence measured', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules.json'), 'utf8')).rules;
  const playback = rules.find((rule) => rule.id === 'LV-WARN-PLAYBACK');
  assert.deepEqual(playback.evidence, ['ON-11']);
  const unsupported = /one (?:active )?clip|at a time|at once|Save-Data/i;
  assert.doesNotMatch(playback.statement, unsupported);
  assert.doesNotMatch(playback.values, unsupported);
  const source = fs.readFileSync(script('launch-video', 'scripts', 'check-embed.mjs'), 'utf8');
  const calls = source.split('\n').filter((line) => line.includes("report.check('LV-WARN-PLAYBACK'"));
  assert.ok(calls.length >= 1, 'found the playback check');
  for (const line of calls) assert.doesNotMatch(line, unsupported);
  assert.doesNotMatch(source.slice(0, source.indexOf('*/')), unsupported);
});

test('every checker that runs no browser prints a proof boundary of its own, which does not claim a browser ran', async () => {
  const files = fs.readdirSync(SKILL, { recursive: true }).filter((file) => /(?:^|\/)(?:scripts\/[^/]+|shared\/check-media)\.mjs$/.test(file.split(path.sep).join('/')));
  assert.ok(files.length >= 15, `found ${files.length} checker scripts`);
  for (const file of files) {
    const source = fs.readFileSync(path.join(SKILL, file), 'utf8');
    if (source.includes('loadPlaywright')) continue;
    for (const call of source.matchAll(/createReport\(\{([^}]*)\}\)/g)) assert.match(call[1], /boundary/, `${file} passes a boundary to createReport`);
  }
  const { MEDIA_BOUNDARY } = await import(pathToFileURL(script('shared', 'check-media.mjs')).href);
  assert.doesNotMatch(MEDIA_BOUNDARY, /Chromium|gating|load order/);
  assert.match(MEDIA_BOUNDARY, /^Proof boundary: /);
});

test('summary lines still carry the boundary they were given', async () => {
  const { createReport } = await import(pathToFileURL(script('shared', 'report.mjs')).href);
  const lines = [];
  createReport({ tool: 't', boundary: 'Proof boundary: x.', write: (line) => lines.push(line) }).summary();
  assert.equal(summaryOf(lines.join('\n')).boundary, 'Proof boundary: x.');
});
