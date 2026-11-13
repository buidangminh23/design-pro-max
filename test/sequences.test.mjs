import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'launch-scroll');
const lib = () => import(pathToFileURL(path.join(PART, 'assets', 'lib', 'frame-window.js')).href);
const script = (name) => import(pathToFileURL(path.join(PART, 'scripts', name)).href);
const hasTool = (tool) => !spawnSync(tool, ['-version'], { windowsHide: true }).error;
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the frame window computes memory, radius, ranges and decode order', async () => {
  const { decodedBytes, windowFrames, radiusForBudget, frameAt, windowRange, decodeOrder, nearestIndex, frameUrl, coverRect, validateManifest } = await lib();
  assert.equal(decodedBytes(600, 1920, 1080), 4976640000);
  assert.equal(windowFrames(8, 90), 17);
  assert.equal(windowFrames(8, 5), 5);
  assert.equal(radiusForBudget(decodedBytes(17, 640, 360), 640, 360), 8);
  assert.equal(radiusForBudget(decodedBytes(18, 640, 360), 640, 360), 8);
  assert.equal(radiusForBudget(10, 640, 360), 0);
  assert.equal(frameAt(0, 90), 0);
  assert.equal(frameAt(1, 90), 89);
  assert.equal(frameAt(1.4, 90), 89);
  assert.equal(frameAt(0.5, 1), 0);
  assert.deepEqual(windowRange(0, 8, 90), { start: 0, end: 16 });
  assert.deepEqual(windowRange(45, 8, 90), { start: 37, end: 53 });
  assert.deepEqual(windowRange(89, 8, 90), { start: 73, end: 89 });
  assert.deepEqual(windowRange(2, 8, 5), { start: 0, end: 4 });
  assert.deepEqual(decodeOrder(10, 1, 90, 1), [10, 11, 9]);
  assert.deepEqual(decodeOrder(10, 1, 90, -1), [10, 9, 11]);
  assert.equal(nearestIndex(10, [3, 12, 8]), 8);
  assert.equal(nearestIndex(10, []), -1);
  assert.equal(frameUrl('frames/f%04d.jpg', 7), 'frames/f0007.jpg');
  assert.equal(frameUrl('f%d.png', 12), 'f12.png');
  assert.deepEqual(coverRect(1600, 900, 800, 800), { x: -311.1111111111111, y: 0, width: 1422.2222222222222, height: 800 });
  assert.deepEqual(validateManifest({ count: 3, width: 640, height: 360, frames: 'frames/f%04d.jpg' }), []);
  assert.equal(validateManifest({ count: 0, width: 640, height: 360, frames: 'f.jpg' }).length, 2);
});

test('the frame window keeps only its decoded window and closes what leaves it', async () => {
  const { createFrameWindow } = await lib();
  const urls = Array.from({ length: 40 }, (_, index) => `f${index}`);
  const open = new Set();
  let peak = 0;
  const fetched = [];
  const frames = createFrameWindow({
    urls,
    radius: 2,
    fetchFrame: async (url) => {
      fetched.push(url);
      return url;
    },
    decode: async (blob) => {
      const bitmap = { name: blob, width: 4, height: 3, close: () => open.delete(bitmap) };
      open.add(bitmap);
      peak = Math.max(peak, open.size);
      return bitmap;
    },
  });
  for (const center of [0, 5, 10, 20, 39, 0]) {
    frames.setCenter(center);
    for (let round = 0; round < 20; round += 1) await settle();
    assert.ok(frames.live <= 5, `window at ${center} holds ${frames.live}`);
    assert.equal(frames.nearest(center)?.index, center);
  }
  for (let round = 0; round < 40; round += 1) await settle();
  assert.ok(peak <= 5 + 2, `at most the window plus the decodes in flight were open at once (peak ${peak})`);
  assert.ok(open.size <= 5, `${open.size} bitmaps still open`);
  assert.equal(new Set(fetched).size, 40, 'every encoded frame is fetched once');
  assert.equal(fetched.length, 40);
  frames.destroy();
  assert.equal(open.size, 0);
});

test('make-sequence plans its costs and refuses bad arguments', async () => {
  const { budgetFor, costLines, outputSize, encoderFor, frameArgs, parseArgs, estimateFrames } = await script('make-sequence.mjs');
  const cost = budgetFor({ frames: 600, width: 1920, height: 1080, radius: 8, budgetMb: 512 });
  assert.equal(cost.over, true);
  assert.equal(cost.window, 17 * 1920 * 1080 * 4);
  assert.match(costLines(cost, 50 * 1024 * 1024).join('\n'), /download, every frame: 50 MB[\s\S]*GOP-6 film/);
  assert.deepEqual(outputSize({ width: 1920, height: 1080 }, 960), { width: 960, height: 540 });
  assert.equal(estimateFrames(2, 30), 60);
  assert.equal(encoderFor('jpg', []), 'mjpeg');
  assert.equal(encoderFor('webp', ['mjpeg']), null);
  assert.equal(encoderFor('avif', ['libsvtav1']), 'libsvtav1');
  assert.ok(frameArgs('avif', 'libsvtav1', 60).includes('avif'));
  assert.throws(() => parseArgs(['m.mov', '--out', 'x', '--format', 'gif']), /--format must be one of/);
  assert.throws(() => parseArgs(['m.mov']), /Usage/);
  assert.equal(parseArgs(['m.mov', '--dry-run']).dryRun, true);
});

test('the probe recognises sequence requests and judges the decoded window', async () => {
  const { sequenceUrls, frameWindowVerdict } = await script('probe-scene.mjs');
  const isSequence = sequenceUrls('http://h/sequence/sequence.json', { frames: 'frames/f%04d.jpg' });
  assert.equal(isSequence('http://h/sequence/sequence.json'), true);
  assert.equal(isSequence('http://h/sequence/frames/f0001.jpg'), true);
  assert.equal(isSequence('http://h/sequence/startframe.jpg'), false);
  assert.equal(sequenceUrls('http://h/s.json', null)('http://h/other.jpg'), false);
  assert.equal(frameWindowVerdict({ peak: 17, width: 640, height: 360 }, 90).ok, true);
  assert.equal(frameWindowVerdict({ peak: 90, width: 640, height: 360 }, 90).ok, false);
  assert.match(frameWindowVerdict({ peak: 90, width: 640, height: 360 }, 90).measured, /90 decoded frame\(s\) at most of 90/);
});

test('bench-scrub only ever advises', async () => {
  const { verdict, parseArgs } = await script('bench-scrub.mjs');
  assert.equal(verdict({ shown: 64, count: 90 }, { shown: 90, count: 90 }).sequenceWins, true);
  assert.equal(verdict({ shown: 90, count: 90 }, { shown: 90, count: 90 }).sequenceWins, false);
  assert.throws(() => parseArgs(['--film', 'f.mp4']), /Give both --film and --sequence/);
});

test('the sequence scripts run from a copy outside the repository and exit 2 for a missing tool or bad usage', (t) => {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'launch-scroll']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const scripts = path.join(outside, 'apple', 'launch-scroll', 'scripts');
  const missing = runScript(path.join(scripts, 'make-sequence.mjs'), ['missing.mov', '--out', path.join(outside, 'out')]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing\.mov does not exist/);
  const format = runScript(path.join(scripts, 'make-sequence.mjs'), ['missing.mov', '--out', path.join(outside, 'out'), '--format', 'gif']);
  assert.equal(format.status, 2);
  assert.match(format.stderr, /--format must be one of jpg, png, webp, avif/);
  const usage = runScript(path.join(scripts, 'bench-scrub.mjs'), []);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /Give both --film and --sequence/);
  const project = path.join(outside, 'project');
  fs.mkdirSync(path.join(project, 'sequence'), { recursive: true });
  fs.writeFileSync(path.join(project, 'film.mp4'), Buffer.alloc(16));
  fs.writeFileSync(path.join(project, 'sequence', 'sequence.json'), JSON.stringify({ count: 2, width: 4, height: 4, frames: 'frames/f%04d.jpg' }));
  const noPlaywright = runScript(path.join(scripts, 'bench-scrub.mjs'), ['--film', path.join(project, 'film.mp4'), '--sequence', path.join(project, 'sequence', 'sequence.json'), '--project', project]);
  assert.equal(noPlaywright.status, 2, noPlaywright.stderr);
  assert.match(noPlaywright.stderr, /Playwright is not installed/);
  assert.ok(!fs.existsSync(path.join(outside, 'out')), 'nothing was written');
});

test('make-sequence prints its totals and refuses a sequence over the budget unless forced', { skip: !(hasTool('ffmpeg') && hasTool('ffprobe')) && 'needs ffmpeg and ffprobe' }, (t) => {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'launch-scroll']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const maker = path.join(outside, 'apple', 'launch-scroll', 'scripts', 'make-sequence.mjs');
  const master = path.join(outside, 'master.mp4');
  const made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-t', '1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', master], { encoding: 'utf8', windowsHide: true });
  assert.equal(made.status, 0, made.stderr);
  const dry = runScript(maker, [master, '--dry-run', '--width', '320']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stderr, /30 x 320 x 180 x 4 bytes = 6\.59 MB/);
  assert.match(dry.stdout, /"rule":"LS-WARN-SEQ","level":"pass"/);
  const out = path.join(outside, 'sequence');
  const refused = runScript(maker, [master, '--out', out, '--width', '320', '--budget-mb', '1']);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /over the 1 MB budget[\s\S]*--force/);
  assert.ok(!fs.existsSync(out), 'a refusal writes nothing');
  const forced = runScript(maker, [master, '--out', out, '--width', '320', '--budget-mb', '1', '--force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /"level":"warn"/);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'sequence.json'), 'utf8'));
  assert.equal(manifest.count, 30);
  assert.equal(fs.readdirSync(path.join(out, 'frames')).length, 30);
  assert.ok(manifest.downloadBytes > 0);
  for (const name of ['startframe.jpg', 'still.jpg']) assert.ok(fs.existsSync(path.join(out, name)), name);
  const foreign = path.join(outside, 'foreign');
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, 'sequence.json'), '{}');
  const stopped = runScript(maker, [master, '--out', foreign, '--width', '320']);
  assert.equal(stopped.status, 2);
  assert.match(stopped.stderr, /not written by make-sequence/);
});
