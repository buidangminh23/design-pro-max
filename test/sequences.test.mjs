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
  assert.equal(radiusForBudget(10, 640, 360), -1);
  assert.equal(radiusForBudget(decodedBytes(1, 640, 360), 640, 360), 0);
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
  assert.equal(frameUrl('frames/f%04d.jpg', 12345), 'frames/f12345.jpg');
  assert.equal(frameUrl('frames/f%4d.jpg', 7), 'frames/f%4d.jpg');
  assert.equal(validateManifest({ count: 3, width: 640, height: 360, frames: 'frames/f%4d.jpg' }).length, 1);
  assert.equal(validateManifest({ count: 3, width: 640, height: 360, frames: 'frames/f%04d-%04d.jpg' }).length, 1);
  assert.deepEqual(validateManifest({ count: 3, width: 640, height: 360, frames: 'f%d.jpg' }), []);
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

test('the frame window fetches nearest the current frame first, window before the rest', async () => {
  const { fetchOrder } = await lib();
  const order = [...fetchOrder(290, 8, 300, 1)];
  assert.equal(order.length, 300);
  assert.equal(new Set(order).size, 300);
  assert.deepEqual(order.slice(0, 3), [290, 291, 289]);
  assert.ok(order.slice(0, 17).every((index) => index >= 282 && index <= 298), order.slice(0, 17).join(','));
  assert.deepEqual(order.slice(17, 20), [299, 281, 280]);
  assert.equal(order.at(-1), 0);
  assert.deepEqual([...fetchOrder(10, 1, 20, -1)].slice(0, 7), [10, 9, 11, 8, 12, 7, 13]);
});

const bitmapFactory = () => {
  const open = new Set();
  return {
    open,
    decode: async (blob) => {
      const bitmap = { name: blob, width: 4, height: 3, close: () => open.delete(bitmap) };
      open.add(bitmap);
      return bitmap;
    },
  };
};

test('a frame fetch that never answers times out and does not hold a decode slot', async () => {
  const { createFrameWindow } = await lib();
  const urls = Array.from({ length: 12 }, (_, index) => `f${index}`);
  const { decode } = bitmapFactory();
  const errors = [];
  const hung = new Set(['f4', 'f6']);
  const frames = createFrameWindow({
    urls,
    radius: 2,
    decodeConcurrency: 2,
    timeoutMs: 30,
    retries: 1,
    fetchFrame: (url, signal) => (hung.has(url)
      ? new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason ?? new Error('aborted')), { once: true }))
      : Promise.resolve(url)),
    decode,
    onError: (error) => errors.push(error),
  });
  frames.setCenter(5);
  for (let round = 0; round < 20; round += 1) await settle();
  assert.equal(frames.live, 3, 'frames 3, 5 and 7 decode while 4 and 6 hang');
  await new Promise((resolve) => setTimeout(resolve, 80));
  for (let round = 0; round < 20; round += 1) await settle();
  assert.equal(errors.length, 2, 'both hung fetches time out');
  assert.equal(frames.failed(4) && frames.failed(6), true);
  frames.destroy();
});

test('a frame that keeps failing is retried a few times, then skipped; losing the current frame is reported', async () => {
  const { createFrameWindow } = await lib();
  const urls = Array.from({ length: 30 }, (_, index) => `f${index}`);
  const { decode } = bitmapFactory();
  const attempts = new Map();
  const errors = [];
  const lost = [];
  const frames = createFrameWindow({
    urls,
    radius: 3,
    retries: 2,
    fetchFrame: async (url) => {
      attempts.set(url, (attempts.get(url) ?? 0) + 1);
      if (['f9', 'f10', 'f11'].includes(url)) throw new Error(`HTTP 404 for ${url}`);
      return url;
    },
    decode,
    onError: (error) => errors.push(error),
    onLost: (index) => lost.push(index),
  });
  for (let step = 0; step < 20; step += 1) {
    frames.setCenter(step % 2 ? 10 : 11);
    for (let round = 0; round < 10; round += 1) await settle();
  }
  for (const url of ['f9', 'f10', 'f11']) assert.equal(attempts.get(url), 2, `${url} tried ${attempts.get(url)} times`);
  assert.equal(errors.length, 6);
  assert.equal(frames.live, 4, 'the rest of the 7-frame window still decodes');
  assert.deepEqual(lost, [11]);
  assert.equal(frames.lost, true);
  frames.destroy();
});

test('the frame window empties and stops fetching when paused, and ignores calls after destroy', async () => {
  const { createFrameWindow } = await lib();
  const urls = Array.from({ length: 40 }, (_, index) => `f${index}`);
  const { decode, open } = bitmapFactory();
  const fetched = [];
  const frames = createFrameWindow({ urls, radius: 2, fetchConcurrency: 1, fetchFrame: (url) => new Promise((resolve) => setImmediate(() => resolve(fetched.push(url) && url))), decode });
  frames.setCenter(20);
  for (let round = 0; round < 6; round += 1) await settle();
  frames.pause();
  const before = fetched.length;
  for (let round = 0; round < 20; round += 1) await settle();
  assert.equal(frames.live, 0);
  assert.equal(open.size, 0);
  assert.ok(fetched.length <= before + 1, `${fetched.length - before} fetches after the pause`);
  assert.ok(fetched.length < 40);
  frames.destroy();
  frames.setCenter(5);
  for (let round = 0; round < 10; round += 1) await settle();
  assert.equal(open.size, 0);
});

test('make-sequence plans its costs and refuses bad arguments', async () => {
  const { budgetFor, costLines, outputSize, encoderFor, frameArgs, parseArgs, estimateFrames } = await script('make-sequence.mjs');
  const cost = budgetFor({ frames: 600, width: 1920, height: 1080, radius: 8, budgetMb: 512 });
  assert.equal(cost.over, true);
  assert.equal(cost.window, 17 * 1920 * 1080 * 4);
  assert.match(costLines(cost, 50 * 1024 * 1024).join('\n'), /download, every frame: 50 MB[\s\S]*GOP-6 film of the same clip at matched quality/);
  assert.doesNotMatch(costLines(cost, 50 * 1024 * 1024, { format: 'png', quality: 80 }).join('\n'), /GOP-6/);
  assert.doesNotMatch(costLines(cost, 50 * 1024 * 1024, { format: 'jpg', quality: 95 }).join('\n'), /GOP-6/);
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

test('make-sequence orders frames numerically past 9999 and moves a finished sequence into place', async (t) => {
  const { FRAME_FILE, byFrameNumber, commit, plan } = await script('make-sequence.mjs');
  assert.deepEqual(['f10000.jpg', 'f9999.jpg', 'f0002.jpg'].sort(byFrameNumber(FRAME_FILE)), ['f0002.jpg', 'f9999.jpg', 'f10000.jpg']);
  assert.ok(FRAME_FILE.test('f12345.webp'));
  const out = tempDir();
  t.after(() => removeTree(out));
  const outputs = plan({ out, format: 'jpg' }, 3);
  fs.mkdirSync(outputs.framesDir, { recursive: true });
  for (let index = 0; index < 5; index += 1) fs.writeFileSync(path.join(outputs.framesDir, `f000${index}.jpg`), 'old');
  fs.writeFileSync(path.join(outputs.framesDir, 'notes.txt'), 'keep');
  fs.writeFileSync(outputs.manifest, '{"old":true}');
  const staged = plan({ out, format: 'jpg' }, 3, path.join(out, '.make-sequence-test'));
  fs.mkdirSync(staged.framesDir, { recursive: true });
  for (let index = 0; index < 3; index += 1) fs.writeFileSync(path.join(staged.framesDir, `f000${index}.jpg`), 'new');
  for (const key of ['startframe', 'still', 'manifest']) fs.writeFileSync(staged[key], 'new');
  commit(staged, outputs);
  assert.deepEqual(fs.readdirSync(outputs.framesDir).sort(), ['f0000.jpg', 'f0001.jpg', 'f0002.jpg', 'notes.txt']);
  assert.equal(fs.readFileSync(path.join(outputs.framesDir, 'f0002.jpg'), 'utf8'), 'new');
  assert.equal(fs.readFileSync(outputs.manifest, 'utf8'), 'new');
});

test('the probe recognises sequence requests and judges the decoded window', async () => {
  const { sequenceUrls, frameWindowVerdict, frameUrlOf, sceneRequests, WINDOW_DEFAULTS } = await script('probe-scene.mjs');
  const { DEFAULTS } = await lib();
  assert.deepEqual(WINDOW_DEFAULTS, { radius: DEFAULTS.radius, decodeConcurrency: DEFAULTS.decodeConcurrency });
  const isSequence = sequenceUrls('http://h/sequence/sequence.json', { frames: 'frames/f%04d.jpg' });
  assert.equal(isSequence('http://h/sequence/sequence.json'), true);
  assert.equal(isSequence('http://h/sequence/frames/f0001.jpg'), true);
  assert.equal(isSequence('http://h/sequence/frames/notes.txt'), false);
  assert.equal(isSequence('http://h/sequence/startframe.jpg'), false);
  assert.equal(sequenceUrls('http://h/s.json', null)('http://h/other.jpg'), false);
  const flat = sequenceUrls('http://h/sequence/sequence.json', { frames: 'f%04d.jpg' });
  assert.equal(flat('http://h/sequence/f0042.jpg'), true);
  assert.equal(flat('http://h/sequence/still.jpg'), false);
  assert.equal(frameUrlOf('http://h/sequence/sequence.json', { frames: 'frames/f%04d.jpg' }, 0), 'http://h/sequence/frames/f0000.jpg');
  assert.equal(frameWindowVerdict({ peak: 17, width: 640, height: 360 }, 90).ok, true);
  assert.equal(frameWindowVerdict({ peak: 19, width: 640, height: 360 }, 90, { radius: 8 }).ok, true);
  assert.equal(frameWindowVerdict({ peak: 20, width: 640, height: 360 }, 90, { radius: 8 }).ok, false);
  assert.equal(frameWindowVerdict({ peak: 299, width: 640, height: 360 }, 300).ok, false);
  assert.equal(frameWindowVerdict({ peak: 7, width: 640, height: 360 }, 300, { radius: 2 }).ok, true);
  assert.equal(frameWindowVerdict({ peak: 8, width: 640, height: 360 }, 300, { radius: 2 }).ok, false);
  assert.equal(frameWindowVerdict({ peak: 3, width: 640, height: 360 }, 0).ok, false);
  assert.match(frameWindowVerdict({ peak: 3, width: 640, height: 360 }, 0).measured, /manifest could not be read/);
  assert.match(frameWindowVerdict({ peak: 90, width: 640, height: 360 }, 90, null, 'loaded frame <img> element(s)').measured, /90 loaded frame <img> element\(s\) at most of 90, limit 19/);
  const demo = 'http://h/media/demo.mp4';
  const film = 'http://h/film.mp4';
  assert.deepEqual(sceneRequests([demo, film], [], { inside: [film], outside: [demo] }, () => false), [film]);
  assert.deepEqual(sceneRequests([demo], ['http://h/sequence/frames/f0000.jpg'], { inside: [], outside: [demo] }, isSequence), ['http://h/sequence/frames/f0000.jpg']);
  assert.deepEqual(sceneRequests([film], [], { inside: [film], outside: [film] }, () => false), [film]);
  assert.deepEqual(sceneRequests(['http://h/js-only.mp4'], [], { inside: [], outside: [demo] }, () => false), ['http://h/js-only.mp4']);
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
  const clamped = path.join(outside, 'clamped');
  const wide = runScript(maker, [master, '--out', clamped, '--width', '640']);
  assert.equal(wide.status, 0, wide.stderr);
  const wideManifest = JSON.parse(fs.readFileSync(path.join(clamped, 'sequence.json'), 'utf8'));
  assert.deepEqual([wideManifest.width, wideManifest.height], [320, 180]);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(clamped, 'frames', 'f0000.jpg')], { encoding: 'utf8', windowsHide: true });
  assert.equal(probe.stdout.trim(), '320,180', 'frames are written at the clamped size the manifest states');
  assert.deepEqual(fs.readdirSync(clamped).filter((name) => name.startsWith('.')), [], 'no staging folder is left behind');
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
