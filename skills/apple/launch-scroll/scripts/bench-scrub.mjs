/**
 * launch-scroll advisory benchmark: how many distinct frames a fast scroll sweep shows for a scrubbed film and for an
 * image sequence of the same clip, in headless Chromium (Playwright from the user's project). It helps decide between
 * the two; it never fails a build, and it is not a device measurement.
 *
 *   node bench-scrub.mjs --film <film.mp4> --sequence <sequence.json> [--project <folder>] [--fps 30]
 *                        [--frames-per-step 1] [--radius 8] [--viewport WxH]
 *
 * The film is loaded into a Blob URL and driven by assets/lib/seek-queue.js; the sequence by
 * assets/lib/frame-window.js. Each sweep sets one progress step per animation frame (or per --frames-per-step frames)
 * from 0 to 1, one step per frame of that medium (the film's duration x --fps, the sequence's count), and counts the
 * distinct frames presented (requestVideoFrameCallback) or drawn while the sweep runs; nothing after its last step counts. Output: JSON lines under
 * LS-WARN-SEQ, level pass for measurements and warn when the sequence shows no more frames than the film; exit 0, or
 * 2 for a missing tool or bad usage, 3 for a sandbox block. Never 1: this is advice, not a rule.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { startServer } from '../../shared/server.mjs';

export const BOUNDARY =
  'Proof boundary: advisory only. Headless Chromium on this machine, often with software decode, and one sweep per ' +
  'medium; frame counts vary by device, browser, decoder and load, and say nothing about iOS Safari, Low Power Mode ' +
  'or real scrolling. Repeat on the target devices before choosing.';

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'lib');

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>bench-scrub</title></head>
<body style="margin:0">
<video id="film" muted playsinline style="width:640px;height:360px"></video>
<canvas id="sequence" style="width:640px;height:360px"></canvas>
<script type="module">
  import { createSeekQueue, frameIndex } from './lib/seek-queue.js';
  import { createFrameWindow, frameAt, loadManifest, coverRect } from './lib/frame-window.js';
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function sweep(steps, framesPerStep, apply, counter) {
    counter.on = true;
    for (let step = 0; step <= steps; step += 1) {
      apply(steps ? step / steps : 1);
      for (let frame = 0; frame < framesPerStep; frame += 1) await nextFrame();
    }
    counter.on = false;
    await wait(500);
  }
  window.bench = {
    async film({ url, fps, framesPerStep }) {
      const video = document.getElementById('film');
      const blob = await (await fetch(url)).blob();
      video.src = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('the film did not load')); });
      try { await video.play(); } catch {} finally { video.pause(); }
      const count = Math.max(1, Math.round(video.duration * fps));
      const shown = new Set();
      const counter = { on: false };
      const watch = () => video.requestVideoFrameCallback((now, meta) => { if (counter.on) shown.add(Math.floor(meta.mediaTime * fps + 1e-3)); watch(); });
      watch();
      const queue = createSeekQueue(video, { fps });
      queue.seekToFrame(0);
      await wait(300);
      const started = performance.now();
      await sweep(count - 1, framesPerStep, (progress) => queue.seekToFrame(frameIndex(progress, count)), counter);
      return { count, shown: shown.size, ms: Math.round(performance.now() - started) };
    },
    async sequence({ url, framesPerStep, radius }) {
      const canvas = document.getElementById('sequence');
      const context = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 360;
      const manifest = await loadManifest(url);
      let target = 0;
      const shown = new Set();
      const counter = { on: false };
      const draw = () => {
        const best = frames.nearest(frameAt(target, manifest.count));
        if (!best) return;
        const rect = coverRect(best.bitmap.width, best.bitmap.height, canvas.width, canvas.height);
        context.drawImage(best.bitmap, rect.x, rect.y, rect.width, rect.height);
        if (counter.on) shown.add(best.index);
      };
      const frames = createFrameWindow({ urls: manifest.urls, radius, onDecoded: () => requestAnimationFrame(draw) });
      frames.setCenter(0);
      const deadline = performance.now() + 10000;
      while (frames.fetched < manifest.count && performance.now() < deadline) await wait(50);
      const started = performance.now();
      await sweep(manifest.count - 1, framesPerStep, (progress) => {
        target = progress;
        frames.setCenter(frameAt(progress, manifest.count));
        draw();
      }, counter);
      return { count: manifest.count, shown: shown.size, ms: Math.round(performance.now() - started), peak: frames.live };
    },
  };
  window.benchReady = true;
</script>
</body></html>
`;

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(value));
  if (!match) throw new UsageError(`--viewport needs WIDTHxHEIGHT, got ${value}.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseArgs(argv) {
  const options = { film: null, sequence: null, project: process.cwd(), fps: 30, framesPerStep: 1, radius: 8, viewport: { width: 1280, height: 800 } };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      return argv[++index];
    };
    if (arg === '--film') options.film = value();
    else if (arg === '--sequence') options.sequence = value();
    else if (arg === '--project') options.project = value();
    else if (arg === '--fps') options.fps = Number(value());
    else if (arg === '--frames-per-step') options.framesPerStep = Number(value());
    else if (arg === '--radius') options.radius = Number(value());
    else if (arg === '--viewport') options.viewport = parseViewport(value());
    else throw new UsageError(`Unknown argument ${arg}.`, 'Usage: node bench-scrub.mjs --film <film.mp4> --sequence <sequence.json> [--project <folder>] [--fps 30] [--frames-per-step 1] [--radius 8] [--viewport WxH]');
  }
  if (!options.film || !options.sequence) throw new UsageError('Give both --film and --sequence (a sequence.json from make-sequence.mjs).');
  if (!Number.isFinite(options.fps) || options.fps <= 0) throw new UsageError('--fps must be a positive number.');
  for (const key of ['framesPerStep', 'radius']) if (!Number.isInteger(options[key]) || options[key] < (key === 'radius' ? 0 : 1)) throw new UsageError(`--${key === 'framesPerStep' ? 'frames-per-step' : 'radius'} must be a whole number${key === 'radius' ? ', 0 or more' : ', 1 or more'}.`);
  return options;
}

export function verdict(film, sequence) {
  const filmShare = film.shown / film.count;
  const sequenceShare = sequence.shown / sequence.count;
  return { filmShare, sequenceShare, sequenceWins: sequenceShare > filmShare + 0.05 };
}

function buildSite(options, folder) {
  fs.mkdirSync(path.join(folder, 'lib'), { recursive: true });
  for (const name of fs.readdirSync(LIB)) if (name.endsWith('.js')) fs.copyFileSync(path.join(LIB, name), path.join(folder, 'lib', name));
  fs.copyFileSync(options.film, path.join(folder, 'film.mp4'));
  fs.cpSync(path.dirname(path.resolve(options.sequence)), path.join(folder, 'sequence'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'index.html'), PAGE);
  return `sequence/${path.basename(options.sequence)}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const file of [options.film, options.sequence]) if (!fs.existsSync(file)) throw new UsageError(`${file} does not exist.`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(options.sequence, 'utf8'));
  } catch {
    throw new UsageError(`${options.sequence} is not a sequence manifest (JSON written by make-sequence.mjs).`);
  }
  if (!Number.isInteger(manifest.count) || typeof manifest.frames !== 'string') throw new UsageError(`${options.sequence} lacks count or frames.`);
  const playwright = await loadPlaywright(options.project);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-scroll-bench-'));
  const report = createReport({ tool: 'bench-scrub', boundary: BOUNDARY });
  let served = null;
  let browser = null;
  try {
    const sequenceUrl = buildSite(options, scratch);
    served = await startServer({ root: scratch, mode: 'range' });
    browser = await launchChromium(playwright);
    const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(new URL('index.html', served.url).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.benchReady === true, null, { timeout: 10000 });
    const where = (count) => `${count} steps, ${options.framesPerStep} animation frame(s) each`;
    const film = await page.evaluate((args) => window.bench.film(args), { url: 'film.mp4', fps: options.fps, framesPerStep: options.framesPerStep });
    report.pass('LS-WARN-SEQ', `film sweep, ${where(film.count)}`, `${film.shown} of ${film.count} frames shown in ${film.ms} ms`, 'advisory: compare with the sequence');
    const sequence = await page.evaluate((args) => window.bench.sequence(args), { url: sequenceUrl, framesPerStep: options.framesPerStep, radius: options.radius });
    report.pass('LS-WARN-SEQ', `sequence sweep, ${where(sequence.count)}`, `${sequence.shown} of ${sequence.count} frames drawn in ${sequence.ms} ms; ${sequence.peak} decoded at the end`, 'advisory: compare with the film');
    const result = verdict(film, sequence);
    const measured = `film ${Math.round(result.filmShare * 100)} %, sequence ${Math.round(result.sequenceShare * 100)} % of frames shown`;
    if (result.sequenceWins) report.pass('LS-WARN-SEQ', 'comparison', measured, 'a sequence earns its bytes only where the film drops frames');
    else report.warn('LS-WARN-SEQ', 'comparison', measured, 'the film keeps up here, so a sequence adds bytes and memory for no visible gain');
    await context.close();
  } finally {
    await browser?.close();
    await served?.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  report.summary();
  return 0;
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
