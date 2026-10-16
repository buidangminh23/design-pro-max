import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  OWN_PARTS,
  citationProblems,
  ledgerProblems,
  loadCases,
  loadLedger,
  loadRules,
  partTextFiles,
  rulesProblems,
} from '../scripts/lib/evidence.mjs';
import { SKILL_DIR, walk } from '../scripts/lib/vendor.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const ledger = loadLedger(ROOT);
const rules = loadRules(ROOT);
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'token-budget.json'), 'utf8'));
const shared = (file) => import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', file)).href);
const lib = (file) => import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'launch-scroll', 'assets', 'lib', file)).href);

test('the evidence ledger and the rule registry follow the proof contract', () => {
  assert.deepEqual(ledgerProblems(ledger), []);
  assert.deepEqual(rulesProblems(ROOT, rules, ledger), []);
  const errors = rules.filter((rule) => rule.part === 'launch-scroll' && rule.level === 'error').map((rule) => rule.id);
  assert.deepEqual(errors, ['LS-GATE-01', 'LS-GATE-02', 'LS-GEOM-01', 'LS-VID-01', 'LS-VID-02', 'LS-VID-03', 'LS-VID-04', 'LS-VID-05']);
});

test('the registry rejects an error rule without a fail fixture or with inferred evidence only', () => {
  const broken = rules.map((rule) => (rule.id === 'LS-VID-04' ? { ...rule, fixtures: { pass: rule.fixtures.pass, fail: [] } } : rule));
  assert.ok(rulesProblems(ROOT, broken, ledger).some((problem) => problem.startsWith('LS-VID-04: an error rule needs a fail fixture')));
  const inferred = rules.map((rule) => (rule.id === 'LS-GATE-02' ? { ...rule, evidence: ['SC-N0'] } : rule));
  assert.ok(rulesProblems(ROOT, inferred, ledger).some((problem) => problem.includes('LS-GATE-02: an error rule needs evidence that is not inferred')));
  const wrongCase = rules.map((rule) => (rule.id === 'LS-VID-05' ? { ...rule, fixtures: { pass: ['scrub-video'], fail: ['vid-04-200-only'] } } : rule));
  assert.ok(rulesProblems(ROOT, wrongCase, ledger).some((problem) => problem.includes('not a fail case for this rule')));
});

test('the ledger rejects local paths, bad sources and missing hashes', () => {
  const entry = { ...ledger.entries['SC-7'], method: 'Ran it in /tmp/bench', source: 'http://example.com', sourceSha: '0' };
  const problems = ledgerProblems({ entries: { 'SC-7': entry } });
  for (const pattern of [/names a local path/, /source must be an https URL/, /sourceSha must be a SHA-256/]) assert.ok(problems.some((problem) => pattern.test(problem)), String(pattern));
});

test('own part text cites only known ids, and every number with a unit is backed by what it cites', () => {
  const files = [...OWN_PARTS.flatMap((part) => partTextFiles(ROOT, part)), `${SKILL_DIR}/shared/motion-classes.md`];
  assert.ok(files.length >= 5, files.join(', '));
  for (const file of files) assert.deepEqual(citationProblems(fs.readFileSync(path.join(ROOT, file), 'utf8'), file, ledger, rules), [], file);
});

test('the citation lint fails a bare number, an unknown id and a number its citation does not hold', () => {
  const lint = (text) => citationProblems(text, 'x.md', ledger, rules);
  assert.match(lint('Load it 300vh ahead.')[0], /needs a citation/);
  assert.match(lint('A fact (SC-99).')[0], /SC-99 is not in evidence\/ledger\.json/);
  assert.match(lint('Load it 400vh ahead (SC-4).')[0], /400 beside SC-4 is in none of their values/);
  assert.match(lint('A rule [LS-VID-09].')[0], /LS-VID-09 is not in rules\.json/);
  assert.deepEqual(lint('Load it 150-250vh ahead (SC-4).'), []);
  assert.deepEqual(lint('```\nffmpeg -g 6 -crf 21 film.mp4 30fps\n```'), []);
  assert.deepEqual(lint('Use `animation-range: contain 0% contain 100%`.'), []);
});

test('own parts keep PART.md lean, without frontmatter, with one level of references', () => {
  const cap = Math.floor(5000 * budget.charsPerToken);
  for (const part of OWN_PARTS) {
    const folder = path.join(ROOT, SKILL_DIR, part);
    const text = fs.readFileSync(path.join(folder, 'PART.md'), 'utf8');
    assert.ok(!text.startsWith('---'), `${part}/PART.md has no frontmatter`);
    assert.ok(text.split('\n').length <= 300, `${part}/PART.md lines`);
    assert.ok(text.length <= cap, `${part}/PART.md is ${text.length} characters, cap ${cap}`);
    const references = path.join(folder, 'references');
    for (const entry of fs.readdirSync(references, { withFileTypes: true })) {
      assert.ok(entry.isFile() && entry.name.endsWith('.md'), `${part}/references/${entry.name} is a flat markdown file`);
      const body = fs.readFileSync(path.join(references, entry.name), 'utf8');
      if (entry.name !== 'evidence.md' && body.split('\n').length > 50) assert.match(body, /^## Contents$/m, `${part}/references/${entry.name} has a table of contents`);
    }
    for (const reference of text.match(/`references\/[^`]+`/g) ?? []) assert.ok(fs.existsSync(path.join(folder, reference.slice(1, -1))), reference);
    for (const asset of text.match(/`(?:assets|scripts)\/[^`\s]+`/g) ?? []) assert.ok(fs.existsSync(path.join(folder, asset.slice(1, -1))), asset);
  }
});

test('no own file in the skill names a research folder or a private path', () => {
  const pattern = /\bresearch\/|skill-motion-research|\/Volumes\/|\/Users\/|[A-Z]:\\Users\\/;
  for (const part of [...OWN_PARTS, 'shared']) {
    for (const entry of walk(path.join(ROOT, SKILL_DIR, part))) {
      if (entry.kind !== 'file') continue;
      const text = fs.readFileSync(path.join(ROOT, SKILL_DIR, part, ...entry.path.split('/')), 'utf8');
      assert.ok(!pattern.test(text), `${part}/${entry.path}`);
    }
  }
});

test('every fixture case names an existing page, a known checker and known media', async () => {
  const { buildFixtureMedia } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'fixture-media.mjs')).href);
  const recipes = buildFixtureMedia.toString().match(/'([a-z0-9-]+)':|\b([a-z]+):\s*path\.join/g).map((key) => key.replace(/[':]|\s*path\.join/g, ''));
  for (const part of OWN_PARTS) {
    for (const entry of loadCases(ROOT, part)) {
      assert.ok(['probe-scene', 'check-media'].includes(entry.checker), entry.id);
      assert.ok(['pass', 'fail'].includes(entry.expect), entry.id);
      if (entry.page) {
        const page = entry.page.startsWith('reference/') ? path.join(ROOT, SKILL_DIR, part, 'assets', entry.page) : path.join(ROOT, 'fixtures', part, entry.page);
        assert.ok(fs.existsSync(page), `${entry.id}: ${entry.page}`);
      }
      for (const recipe of [...Object.values(entry.media ?? {}), ...(entry.files ?? [])]) assert.ok(recipes.includes(recipe), `${entry.id}: ${recipe}`);
    }
  }
});

test('the harness judges fail and pass runs red-first', async () => {
  const { evaluateRun } = await shared('harness.mjs');
  const line = (rule, level) => JSON.stringify({ rule, level, where: 'w', measured: 'm', expected: 'e' });
  const summary = JSON.stringify({ tool: 't', errors: 1, warnings: 0, passed: 1, skipped: 0, boundary: 'b' });
  const red = { code: 1, stdout: [line('LS-VID-04', 'error'), summary].join('\n') };
  assert.equal(evaluateRun({ rule: 'LS-VID-04', expect: 'fail' }, red).ok, true);
  assert.equal(evaluateRun({ rule: 'LS-VID-03', expect: 'fail' }, red).ok, false);
  assert.equal(evaluateRun({ rule: 'LS-VID-04', expect: 'pass' }, red).ok, false);
  const green = { code: 0, stdout: [line('LS-VID-04', 'pass'), summary].join('\n') };
  assert.equal(evaluateRun({ rule: 'LS-VID-04', expect: 'pass' }, green).ok, true);
  assert.equal(evaluateRun({ rule: ['LS-VID-04', 'LS-VID-05'], expect: 'pass' }, green).ok, false, 'an unchecked rule is not green');
  assert.equal(evaluateRun({ rule: 'LS-VID-04', expect: 'fail' }, { code: 2, stdout: '' }).ok, false);
});

const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
};
const u32 = (...values) => Buffer.concat(values.map((value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}));
const full = (...parts) => Buffer.concat([u32(0), ...parts]);

/** A minimal H.264 MP4: one video track whose samples are single NAL units of the given types. */
function syntheticMp4({ nalTypes, sync, moovFirst = true }) {
  const samples = nalTypes.map((type) => Buffer.concat([u32(2), Buffer.from([type, 0x80])]));
  const sizes = samples.map((sample) => sample.length);
  const avcC = box('avcC', Buffer.from([1, 0x64, 0, 0x28, 0xff, 0xe0, 0x00]));
  const avc1 = box('avc1', Buffer.alloc(24), Buffer.from([0x02, 0x80, 0x01, 0x68]), Buffer.alloc(50), avcC);
  const build = (chunkOffset) => {
    const stbl = box('stbl',
      box('stsd', full(u32(1), avc1)),
      box('stsz', full(u32(0, sizes.length, ...sizes))),
      ...(sync ? [box('stss', full(u32(sync.length, ...sync)))] : []),
      box('stsc', full(u32(1, 1, sizes.length, 1))),
      box('stco', full(u32(1, chunkOffset))));
    const hdlr = box('hdlr', full(u32(0), Buffer.from('vide'), Buffer.alloc(12)));
    return box('moov', box('trak', box('mdia', hdlr, box('minf', stbl))));
  };
  const ftyp = box('ftyp', Buffer.from('isom'), u32(0));
  const mdat = box('mdat', ...samples);
  if (moovFirst) {
    const moovSize = build(0).length;
    return Buffer.concat([ftyp, build(ftyp.length + moovSize + 8), mdat]);
  }
  return Buffer.concat([ftyp, mdat, build(ftyp.length + 8)]);
}

test('the MP4 walker reads box order, keyframe spacing and IDR or recovery keyframes', async () => {
  const { inspectMp4, maxKeyframeDistance } = await shared('mp4.mjs');
  const closed = inspectMp4(syntheticMp4({ nalTypes: [5, 1, 1, 5, 1, 1], sync: [1, 4] }));
  assert.equal(closed.moovFirst, true);
  assert.equal(closed.video.codec, 'h264');
  assert.deepEqual(closed.video.keyframes.map((entry) => entry.kind), ['idr', 'idr']);
  assert.equal(maxKeyframeDistance([1, 4], 6), 3);
  const open = inspectMp4(syntheticMp4({ nalTypes: [5, 1, 1, 1, 1, 1], sync: [1, 4], moovFirst: false }));
  assert.equal(open.moovFirst, false);
  assert.deepEqual(open.video.keyframes.map((entry) => entry.kind), ['idr', 'recovery']);
  const intra = inspectMp4(syntheticMp4({ nalTypes: [5, 5, 5], sync: null }));
  assert.equal(intra.video.allSync, true);
  assert.equal(intra.video.keyframes.length, 3);
  assert.equal(maxKeyframeDistance([1], 60), 60);
});

test('the shared server answers Range with 206 in range mode and ignores it in 200 mode', async (t) => {
  const { startServer } = await shared('server.mjs');
  const root = tempDir();
  t.after(() => removeTree(root));
  fs.writeFileSync(path.join(root, 'film.mp4'), Buffer.alloc(1000, 7));
  for (const [mode, status, length, ranges] of [['range', 206, '100', 'bytes'], ['200', 200, '1000', null]]) {
    const served = await startServer({ root, mode });
    try {
      const response = await fetch(new URL('film.mp4', served.url), { headers: { Range: 'bytes=0-99' } });
      assert.equal(response.status, status, mode);
      assert.equal(response.headers.get('content-length'), length, mode);
      assert.equal(response.headers.get('accept-ranges'), ranges, mode);
      assert.equal((await fetch(new URL('../../etc/passwd', served.url))).status, 404);
      assert.equal(served.requests[0].range, 'bytes=0-99');
    } finally {
      await served.close();
    }
  }
});

test('the scene library clamps progress and the seek queue targets frame centres', async () => {
  const { sceneProgress, clampProgress } = await lib('scene-progress.js');
  assert.equal(sceneProgress({ top: 0, height: 3000 }, 1000), 0);
  assert.equal(sceneProgress({ top: -1000, height: 3000 }, 1000), 0.5);
  assert.equal(sceneProgress({ top: -5000, height: 3000 }, 1000), 1);
  assert.equal(sceneProgress({ top: 400, height: 3000 }, 1000), 0);
  assert.equal(clampProgress(-0.2), 0);
  const { frameIndex, frameTime } = await lib('seek-queue.js');
  assert.equal(frameIndex(0, 90), 0);
  assert.equal(frameIndex(1, 90), 89);
  assert.equal(frameIndex(0.5, 91), 45);
  assert.equal(frameTime(0, 30), 0.5 / 30);
});

test('the checkers run from a copy outside the repository and exit 2 for a missing tool or bad usage', (t) => {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'launch-scroll']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const project = path.join(outside, 'project');
  fs.mkdirSync(project);
  const probe = runScript(path.join(outside, 'apple', 'launch-scroll', 'scripts', 'probe-scene.mjs'), ['--serve', project, '--project', project]);
  assert.equal(probe.status, 2, probe.stderr);
  assert.match(probe.stderr, /Playwright is not installed/);
  assert.match(probe.stderr, /npm install --save-dev playwright/);
  const media = runScript(path.join(outside, 'apple', 'shared', 'check-media.mjs'), []);
  assert.equal(media.status, 2);
  assert.match(media.stderr, /Usage: node check-media\.mjs/);
  const encode = runScript(path.join(outside, 'apple', 'launch-scroll', 'scripts', 'encode-scrub.mjs'), ['missing.mov', '--out', path.join(outside, 'out')]);
  assert.equal(encode.status, 2);
  assert.match(encode.stderr, /missing\.mov does not exist/);
  const both = runScript(path.join(outside, 'apple', 'launch-scroll', 'scripts', 'probe-scene.mjs'), ['--url', 'http://127.0.0.1:9/', '--serve', project]);
  assert.equal(both.status, 2);
  assert.match(both.stderr, /exactly one of --url or --serve/);
});

test('the sandbox signatures map to exit 3 and its message', async () => {
  const { sandboxReason, rethrowSandbox } = await shared('sandbox.mjs');
  const { SandboxError, SANDBOX_MESSAGE } = await shared('report.mjs');
  assert.match(sandboxReason('bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)'), /launchd/);
  assert.match(sandboxReason('VTCompressionSessionCreate failed: -12908'), /VideoToolbox/);
  assert.equal(sandboxReason('net::ERR_CONNECTION_REFUSED'), null);
  assert.throws(() => rethrowSandbox(new Error('x -12908'), 'cmd'), SandboxError);
  assert.match(SANDBOX_MESSAGE('node probe.mjs'), /^This step must run outside the agent sandbox\. Ask the user to approve a rerun outside it, or to run: node probe\.mjs$/);
});

test('an area code the script does not name resolves to the one unclaimed findings file, and only then', async (t) => {
  const { AREAS, areaName, sourceHash } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'import-findings.mjs')).href);
  const folder = tempDir('findings-');
  t.after(() => removeTree(folder));
  fs.writeFileSync(path.join(folder, `${AREAS.SC}.findings.json`), JSON.stringify({ findings: [{ claim: 'named' }] }));
  fs.writeFileSync(path.join(folder, 'private-bench.findings.json'), JSON.stringify({ findings: [{ claim: 'zero' }, { claim: 'one' }] }));
  assert.deepEqual(areaName(folder, 'SC'), { name: AREAS.SC });
  assert.deepEqual(areaName(folder, 'XB'), { name: 'private-bench' });
  assert.ok(sourceHash(folder, 'XB-1', {}).sha);
  fs.writeFileSync(path.join(folder, 'second-bench.findings.json'), JSON.stringify({ findings: [] }));
  assert.match(areaName(folder, 'XB').problem, /2 unnamed findings files/);
  assert.ok(!Object.values(AREAS).some((name) => /notch/i.test(name)), 'no private benchmark is named in the script');
});

/** A video stand-in: writes start a seek, finish() ends it and returns the queued 'seeked' dispatch, as a browser does. */
function fakeVideo() {
  const listeners = [];
  const video = {
    seeking: false,
    duration: 10,
    writes: [],
    addEventListener: (type, fn) => type === 'seeked' && listeners.push(fn),
    removeEventListener: () => {},
    finish() {
      video.seeking = false;
      return () => listeners.forEach((fn) => fn());
    },
  };
  Object.defineProperty(video, 'currentTime', {
    set(value) {
      video.writes.push({ value, whileSeeking: video.seeking });
      video.seeking = true;
    },
  });
  return video;
}

test('the seek queue never writes while seeking, even when a seeked event arrives after a newer seek began', async () => {
  const { createSeekQueue, frameTime } = await lib('seek-queue.js');
  const video = fakeVideo();
  const queue = createSeekQueue(video, { fps: 30 });
  queue.seekToFrame(1);
  queue.seekToFrame(2);
  const seekedForFirst = video.finish();
  queue.seekToFrame(3);
  seekedForFirst();
  video.finish()();
  assert.deepEqual(video.writes.filter((write) => write.whileSeeking), []);
  assert.equal(video.writes.at(-1).value, frameTime(3, 30), 'the latest target wins');
});
