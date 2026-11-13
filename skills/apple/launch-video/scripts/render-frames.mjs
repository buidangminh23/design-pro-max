/**
 * launch-video renderer: steps a page's animations frame by frame in headless Chromium (Playwright from the user's
 * project) and captures each frame at device pixel ratio 2, then checks the frames it wrote. It never uses the
 * built-in page recording, which writes VP8 at 25 fps in CSS pixels.
 *
 *   node render-frames.mjs (--url <url> | --serve <folder> [--page <path>]) --slot WxH --duration <s> [--fps 30]
 *                          [--selector <css>] [--viewport WxH] [--alpha] [--out <folder in $TMPDIR>] [--force]
 *                          [--project <folder>]
 *   node render-frames.mjs --check <frames folder | video> [--slot WxH] [--duration <s>] [--fps 30]
 *
 * How a frame is made: the page's clock (page.clock) is installed and paused before the page loads, so it stands
 * still while the page loads and frame 0 is time 0 for the animations and the clock alike. Every animation is paused,
 * and for frame i at time t = i / fps each animation's currentTime is set to t (animations that appear later are
 * stepped from the frame they appear in), then the page clock runs to t, so timers, Date.now() and performance.now()
 * read t, and requestAnimationFrame callbacks due by t run after the animations were set. Every image inside the
 * viewport must be decoded and painted within 10 s, then the viewport (or --selector) is captured as frame-<i>.png. An
 * image that is not painted stops the render with a failure naming the element and the frame. render.json is written
 * with complete: false before the first frame and complete: true after the last, so a failed render can be rerun into
 * the same --out.
 *
 * Rule LV-RENDER-01: a master has duration x fps frames at twice the slot's CSS pixels, every image painted, and is
 * never the built-in page recording. Frames are captures, so they stay in $TMPDIR; encode.mjs writes the clips.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { startServer } from '../../shared/server.mjs';

export const GENERATOR = 'design-pro-max launch-video render-frames';
export const VERSION = '0.2.0';
export const DPR = 2;
export const IMAGE_TIMEOUT_MS = 10000;
export const CLOCK_START = Date.parse('2026-01-01T00:00:00Z');
export const BOUNDARY =
  'Proof boundary: headless Chromium proves frame count, pixel size, animation stepping and image decoding; it does ' +
  'not prove how the page looks in another browser, CSS background images, video inside the page, or taste.';

const FRAME = /^frame-(\d{5})\.png$/;
const USAGE = 'Usage: node render-frames.mjs (--url <url> | --serve <folder> [--page <path>]) --slot WxH --duration <s> [--fps 30] [--selector <css>] [--viewport WxH] [--alpha] [--out <folder>] [--force] [--project <folder>]\n       node render-frames.mjs --check <frames folder | video> [--slot WxH] [--duration <s>] [--fps 30]';

export const expectedFrames = (duration, fps) => Math.round(duration * fps);
export const frameName = (index) => `frame-${String(index).padStart(5, '0')}.png`;

export function parseSize(value, flag) {
  const match = /^(\d{1,5})x(\d{1,5})$/.exec(String(value));
  if (!match) throw new UsageError(`${flag} needs WIDTHxHEIGHT in CSS pixels, got ${value}.`, USAGE);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseArgs(argv) {
  const options = { url: null, serve: null, page: 'index.html', check: null, slot: null, viewport: null, duration: null, fps: null, selector: null, alpha: false, out: null, force: false, project: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--url') options.url = value();
    else if (arg === '--serve') options.serve = value();
    else if (arg === '--page') options.page = value();
    else if (arg === '--check') options.check = value();
    else if (arg === '--slot') options.slot = parseSize(value(), '--slot');
    else if (arg === '--viewport') options.viewport = parseSize(value(), '--viewport');
    else if (arg === '--duration') options.duration = Number(value());
    else if (arg === '--fps') options.fps = Number(value());
    else if (arg === '--selector') options.selector = value();
    else if (arg === '--alpha') options.alpha = true;
    else if (arg === '--out') options.out = value();
    else if (arg === '--force') options.force = true;
    else if (arg === '--project') options.project = value();
    else throw new UsageError(`Unknown argument ${arg}.`, USAGE);
  }
  for (const key of ['duration', 'fps']) if (options[key] !== null && (!Number.isFinite(options[key]) || options[key] <= 0)) throw new UsageError(`--${key} must be a positive number.`, USAGE);
  if (options.check) {
    if (options.url || options.serve) throw new UsageError('--check reads frames or a video; leave out --url and --serve.', USAGE);
    return options;
  }
  if (!options.url === !options.serve) throw new UsageError('Give exactly one of --url, --serve or --check.', USAGE);
  if (!options.slot || !options.duration) throw new UsageError('A render needs --slot and --duration.', USAGE);
  options.fps ??= 30;
  options.viewport ??= options.slot;
  return options;
}

/** Width and height from a PNG header, or null when the bytes are not a PNG. */
export function pngSize(bytes) {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readHeader(file) {
  const handle = fs.openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(24);
    fs.readSync(handle, bytes, 0, 24, 0);
    return pngSize(bytes);
  } finally {
    fs.closeSync(handle);
  }
}

/** LV-RENDER-01 on a frames folder: the frame count, numbering and every frame's pixel size. */
export function checkFrameFolder(folder, expected, report) {
  const where = path.basename(folder);
  const names = fs.readdirSync(folder).filter((name) => FRAME.test(name)).sort();
  const count = expectedFrames(expected.duration, expected.fps);
  report.check('LV-RENDER-01', names.length === count, `${where}: frame count`, `${names.length} frames`, `${count} frames (${expected.duration} s x ${expected.fps} fps)`);
  const gaps = names.filter((name, index) => name !== frameName(index));
  report.check('LV-RENDER-01', !gaps.length, `${where}: numbering`, gaps.length ? `first gap at ${gaps[0]}` : `frame-00000 to ${names.at(-1) ?? 'none'}`, 'consecutive from frame-00000.png');
  const want = { width: expected.slot.width * DPR, height: expected.slot.height * DPR };
  const wrong = [];
  for (const name of names) {
    const size = readHeader(path.join(folder, name));
    if (!size || size.width !== want.width || size.height !== want.height) wrong.push(`${name} ${size ? `${size.width}x${size.height}` : 'not a PNG'}`);
  }
  report.check('LV-RENDER-01', names.length > 0 && !wrong.length, `${where}: pixel size`, wrong.length ? `${wrong.length} wrong, e.g. ${wrong[0]}` : names.length ? `${want.width}x${want.height} on every frame` : 'no frames', `${want.width}x${want.height} (the ${expected.slot.width}x${expected.slot.height} slot at ${DPR}x)`);
}

function countFrames(file) {
  const result = runTool('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  const count = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(count) ? count : null;
}

/** LV-RENDER-01 on a video master: frame count, pixel size and the built-in recording's signature. */
export function checkVideoMaster(file, expected, report) {
  const where = path.basename(file);
  const info = probeMedia(file);
  if (!info.video) {
    report.error('LV-RENDER-01', where, 'no video stream', 'a master video');
    return;
  }
  const count = countFrames(file);
  const want = expectedFrames(expected.duration, expected.fps);
  report.check('LV-RENDER-01', count === want, `${where}: frame count`, `${count ?? 'unknown'} frames at ${Math.round((info.video.fps ?? 0) * 100) / 100} fps`, `${want} frames (${expected.duration} s x ${expected.fps} fps)`);
  const size = { width: expected.slot.width * DPR, height: expected.slot.height * DPR };
  report.check('LV-RENDER-01', info.video.width === size.width && info.video.height === size.height, `${where}: pixel size`, `${info.video.width}x${info.video.height}`, `${size.width}x${size.height} (the ${expected.slot.width}x${expected.slot.height} slot at ${DPR}x)`);
  const recorded = info.video.codec === 'vp8' && Math.round(info.video.fps ?? 0) === 25;
  report.check('LV-RENDER-01', !recorded, `${where}: source`, `${info.video.codec} at ${Math.round((info.video.fps ?? 0) * 100) / 100} fps`, 'a stepped render, not the built-in page recording (VP8, 25 fps, CSS pixels)');
}

export function checkMaster(target, options, report) {
  if (!fs.existsSync(target)) throw new UsageError(`${target} does not exist.`);
  const folder = fs.statSync(target).isDirectory();
  let manifest = {};
  if (folder && fs.existsSync(path.join(target, 'render.json'))) manifest = JSON.parse(fs.readFileSync(path.join(target, 'render.json'), 'utf8'));
  const expected = { slot: options.slot ?? manifest.slot, fps: options.fps ?? manifest.fps ?? 30, duration: options.duration ?? manifest.duration };
  if (!expected.slot || !expected.duration) throw new UsageError(`Checking ${target} needs --slot and --duration (or a render.json beside the frames).`, USAGE);
  if (folder) checkFrameFolder(target, expected, report);
  else checkVideoMaster(target, expected, report);
}

/** True when a folder, existing or not, lies inside the temporary folder, compared by real paths. */
export function insideTmp(folder, tmp = os.tmpdir()) {
  const base = fs.realpathSync.native(tmp);
  let existing = path.resolve(folder);
  const rest = [];
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const relative = path.relative(base, path.join(fs.realpathSync.native(existing), ...rest));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function checkOut(options) {
  if (!options.out) return;
  const folder = path.resolve(options.out);
  if (!insideTmp(folder)) throw new UsageError(`--out ${folder} is outside $TMPDIR (${os.tmpdir()}).`, 'Frames are captures and stay in $TMPDIR; encode.mjs writes the clips into the project.');
  if (fs.existsSync(folder) && fs.readdirSync(folder).length && !options.force) {
    let ours = false;
    try {
      ours = JSON.parse(fs.readFileSync(path.join(folder, 'render.json'), 'utf8')).generator === GENERATOR;
    } catch {
      ours = false;
    }
    if (!ours) throw new UsageError(`Stopped: ${folder} is not empty and was not written by render-frames.mjs.`, 'Choose another --out or pass --force.');
  }
}

function prepareOut(options) {
  if (!options.out) return fs.mkdtempSync(path.join(os.tmpdir(), 'launch-video-frames-'));
  const folder = path.resolve(options.out);
  if (fs.existsSync(folder)) for (const name of fs.readdirSync(folder)) if (FRAME.test(name) || name === 'render.json') fs.rmSync(path.join(folder, name));
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

export function renderManifest(options, complete) {
  return { generator: GENERATOR, version: VERSION, complete, page: options.serve ? options.page : options.url, selector: options.selector, slot: options.slot, dpr: DPR, fps: options.fps, duration: options.duration, frames: expectedFrames(options.duration, options.fps), alpha: options.alpha };
}

const writeManifest = (out, options, complete) => fs.writeFileSync(path.join(out, 'render.json'), `${JSON.stringify(renderManifest(options, complete), null, 2)}\n`);

const STEP = ({ t }) => {
  const state = window.__lvRender ?? (window.__lvRender = { births: new Map(), last: 0 });
  for (const animation of document.getAnimations()) {
    if (!state.births.has(animation)) {
      animation.pause();
      state.births.set(animation, state.last);
    }
    animation.currentTime = Math.max(0, t - state.births.get(animation));
  }
  state.last = t;
};

const PAINTED = async (pending) => {
  const describe = (element) => `<img${element.id ? ` id="${element.id}"` : ''}${element.className ? ` class="${element.className}"` : ''} src="${(element.getAttribute('src') ?? '').slice(0, 120)}">`;
  const inView = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && getComputedStyle(element).visibility !== 'hidden';
  };
  const images = [...document.images].filter(inView);
  if (pending) return images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => `${describe(image)} ${image.complete ? 'failed to load' : `still loading after ${pending} ms`}`);
  const failed = [];
  for (const image of images) {
    if (!image.complete || image.naturalWidth === 0) await image.decode().catch(() => {});
    if (!image.complete || image.naturalWidth === 0) failed.push(`${describe(image)} failed to load`);
  }
  await document.fonts.ready;
  return failed;
};

const unpaintedImages = async (page) => {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS); });
  const settled = await Promise.race([page.evaluate(PAINTED, 0), late]).finally(() => clearTimeout(timer));
  return settled ?? page.evaluate(PAINTED, IMAGE_TIMEOUT_MS);
};

export async function render(options, report) {
  checkOut(options);
  const playwright = await loadPlaywright(options.project);
  const served = options.serve ? await startServer({ root: options.serve, mode: 'range' }) : null;
  const url = served ? new URL(options.page, served.url).href : options.url;
  let browser;
  let out;
  let failed = false;
  try {
    browser = await launchChromium(playwright);
    out = prepareOut(options);
    process.stderr.write(`render-frames ${VERSION} writes ${expectedFrames(options.duration, options.fps)} frames to ${out}\n`);
    writeManifest(out, options, false);
    const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: DPR, reducedMotion: 'no-preference' });
    await context.clock.install({ time: CLOCK_START });
    await context.clock.pauseAt(CLOCK_START);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const loaded = await page.waitForLoadState('load', { timeout: IMAGE_TIMEOUT_MS }).then(() => true, () => false);
    if (loaded) await page.evaluate(() => document.fonts.ready);
    await page.evaluate(STEP, { t: 0 });
    const target = options.selector ? page.locator(options.selector).first() : page;
    const count = expectedFrames(options.duration, options.fps);
    let advanced = 0;
    for (let index = 0; index < count; index += 1) {
      const t = (index * 1000) / options.fps;
      await page.evaluate(STEP, { t });
      const due = Math.round(t);
      if (due > advanced) {
        await page.clock.runFor(due - advanced);
        advanced = due;
      }
      const unpainted = await unpaintedImages(page);
      if (unpainted.length) {
        report.error('LV-RENDER-01', `frame ${index} (${(t / 1000).toFixed(3)} s)`, `not painted: ${unpainted.join(', ')}`, 'every image inside the frame decoded and painted before capture');
        failed = true;
        break;
      }
      await target.screenshot({ path: path.join(out, frameName(index)), omitBackground: options.alpha, animations: 'allow', scale: 'device' });
    }
    await context.close();
  } finally {
    await browser?.close();
    await served?.close();
  }
  if (failed) return out;
  writeManifest(out, options, true);
  report.pass('LV-RENDER-01', `${path.basename(out)}: images`, 'every image inside every frame was painted', 'every image decoded and painted before capture');
  checkMaster(out, options, report);
  process.stderr.write(`frames: ${out}\nnext: node ${path.join(path.dirname(fileURLToPath(import.meta.url)), 'encode.mjs')} ${out} --out <folder in the project>\n`);
  return out;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'render-frames', boundary: BOUNDARY });
  if (options.check) checkMaster(options.check, options, report);
  else {
    if (options.serve && !fs.existsSync(options.serve)) throw new UsageError(`${options.serve} does not exist.`);
    await render(options, report);
  }
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
