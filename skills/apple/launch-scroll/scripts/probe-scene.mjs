/**
 * launch-scroll probe: loads a page in headless Chromium (Playwright from the user's project), finds each pinned
 * scene and checks the LS error rules it can observe from outside.
 *
 *   node probe-scene.mjs --url <page url> [options]
 *   node probe-scene.mjs --serve <folder> [--page <path>] [--server range|200] [options]
 *
 * Options: --scene <selector> (default [data-scene]), --viewport WxH (repeatable; default 1440x900 and 390x844),
 * --project <folder with Playwright> (default: the current folder), --no-media (skip ffmpeg and ffprobe checks).
 *
 * Rules: LS-GATE-01 reduced motion and a rejected muted play() leave the scene in normal flow at its end state with
 * no film requested; LS-GATE-02 a viewport shorter than the stage plus its sticky offset does not pin; LS-GEOM-01 the
 * box is travel + 100vh, the sticky child fills the viewport below its offset and stays put while progress runs, and
 * progress stays in [0, 1] and never runs backwards on a forward sweep; LS-VID-03 no currentTime write while seeking
 * and no fastSeek(); LS-VID-04 the film is seekable (a Blob URL, MediaSource or 206 Range responses); LS-VID-05 the
 * start image is frame 0 and the video stays hidden until it has presented a frame. LS-VID-01 and LS-VID-02 run on
 * the film files through the shared check-media. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkScrubFile, checkSourceSet, probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { MODES, startServer } from '../../shared/server.mjs';

export const DEFAULT_VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
export const LIMITS = Object.freeze({ ssim: 0.99, travelMinVh: 70, travelMaxVh: 300, sweepSteps: 48, settleMs: 3000, loadMs: 10000 });

const VIDEO_URL = /\.(?:mp4|m4v|mov|webm)(?:[?#]|$)/i;
const TOLERANCE = { px: 2, progress: 0.002 };

export const INSTRUMENT = String.raw`(() => {
  const log = { seekingWrites: 0, firstWrite: null, fastSeekCalls: 0, earlyVisible: [], playRejected: false };
  Object.defineProperty(window, '__lsProbe', { value: log, enumerable: false });
  const media = HTMLMediaElement.prototype;
  const time = Object.getOwnPropertyDescriptor(media, 'currentTime');
  Object.defineProperty(media, 'currentTime', {
    configurable: true,
    enumerable: time.enumerable,
    get() { return time.get.call(this); },
    set(value) {
      if (this.seeking) { log.seekingWrites += 1; if (log.firstWrite === null) log.firstWrite = value; }
      time.set.call(this, value);
    },
  });
  const nativeFastSeek = media.fastSeek;
  media.fastSeek = function fastSeek(value) {
    log.fastSeekCalls += 1;
    return nativeFastSeek ? nativeFastSeek.call(this, value) : time.set.call(this, value);
  };
  if (window.__lsRejectPlay) {
    media.play = function play() {
      log.playRejected = true;
      return Promise.reject(new DOMException('play() rejected by the probe', 'NotAllowedError'));
    };
  }
  const presented = new WeakSet();
  const watched = new WeakSet();
  const flagged = new WeakSet();
  const watch = (video) => {
    if (watched.has(video)) return;
    watched.add(video);
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => presented.add(video));
  };
  new MutationObserver(() => document.querySelectorAll('video').forEach(watch))
    .observe(document, { childList: true, subtree: true });
  const onScreen = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  };
  const visible = (element) => element.checkVisibility
    ? element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : getComputedStyle(element).opacity !== '0';
  const tick = () => {
    for (const video of document.querySelectorAll('video')) {
      watch(video);
      if (!presented.has(video) && !flagged.has(video) && visible(video) && onScreen(video)) {
        flagged.add(video);
        log.earlyVisible.push(video.currentSrc || video.getAttribute('src') || '(no source yet)');
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(value));
  if (!match) throw new UsageError(`--viewport needs WIDTHxHEIGHT, got ${value}.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseArgs(argv) {
  const options = { url: null, serve: null, page: 'index.html', server: 'range', scene: '[data-scene]', viewports: [], project: process.cwd(), media: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      return argv[++index];
    };
    if (arg === '--url') options.url = value();
    else if (arg === '--serve') options.serve = value();
    else if (arg === '--page') options.page = value();
    else if (arg === '--server') options.server = value();
    else if (arg === '--scene') options.scene = value();
    else if (arg === '--viewport') options.viewports.push(parseViewport(value()));
    else if (arg === '--project') options.project = value();
    else if (arg === '--no-media') options.media = false;
    else throw new UsageError(`Unknown argument ${arg}.`, 'Usage: node probe-scene.mjs (--url <url> | --serve <folder> [--page <path>] [--server range|200]) [--scene <selector>] [--viewport WxH] [--project <folder>] [--no-media]');
  }
  if (!options.url === !options.serve) throw new UsageError('Give exactly one of --url or --serve.');
  if (!MODES.includes(options.server)) throw new UsageError(`--server must be one of ${MODES.join(', ')}.`);
  if (!options.viewports.length) options.viewports = DEFAULT_VIEWPORTS;
  return options;
}

const frames = (page, count = 2) => page.evaluate((n) => new Promise((resolve) => {
  const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
  step(n);
}), count);

const scrollTo = async (page, y) => {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await frames(page);
};

/** Waits until no scene reports a pending gate, so the measured state is the settled one. */
async function settle(page, selector) {
  await page.waitForLoadState('load');
  await page.waitForFunction((sel) => [...document.querySelectorAll(sel)].every((scene) => !String(scene.dataset.sceneReason ?? '').includes('gate-pending')), selector, { timeout: LIMITS.settleMs }).catch(() => {});
  await frames(page, 3);
}

function readScene(page, selector, index) {
  return page.evaluate(({ sel, at }) => {
    const scene = document.querySelectorAll(sel)[at];
    if (!scene) return null;
    const stickies = [scene, ...scene.querySelectorAll('*')].filter((element) => getComputedStyle(element).position === 'sticky');
    const sticky = scene.querySelector('[data-scene-sticky]') ?? stickies[0] ?? null;
    const stage = scene.querySelector('[data-scene-stage]') ?? sticky?.firstElementChild ?? null;
    const rect = scene.getBoundingClientRect();
    const raw = getComputedStyle(scene).getPropertyValue('--scene-progress').trim();
    const exposed = raw === '' ? null : Number.parseFloat(raw);
    const video = scene.querySelector('video[data-scrub]') ?? scene.querySelector('video');
    const sources = video ? [...video.querySelectorAll('source')].map((source) => source.dataset.src || source.getAttribute('src')).filter(Boolean) : [];
    if (video && !sources.length && (video.getAttribute('src') || video.dataset.src)) sources.push(video.dataset.src || video.getAttribute('src'));
    const start = scene.querySelector('[data-scene-startframe]');
    return {
      pinned: stickies.length > 0,
      state: scene.dataset.sceneState ?? null,
      reason: scene.dataset.sceneReason ?? null,
      top: rect.top + scrollY,
      height: rect.height,
      viewport: innerHeight,
      stickyHeight: sticky ? sticky.getBoundingClientRect().height : null,
      stickyTop: sticky ? Number.parseFloat(getComputedStyle(sticky).top) || 0 : null,
      stickyRectTop: sticky ? sticky.getBoundingClientRect().top : null,
      stageHeight: stage ? stage.getBoundingClientRect().height : null,
      exposed: Number.isFinite(exposed) ? exposed : null,
      geometric: (() => {
        const travel = rect.height - innerHeight;
        return travel > 0 ? -rect.top / travel : null;
      })(),
      cssTimeline: [scene, ...scene.querySelectorAll('*')].some((element) => !['auto', ''].includes(getComputedStyle(element).animationTimeline ?? 'auto')),
      video: video ? {
        currentSrc: video.currentSrc || video.getAttribute('src') || '',
        readyState: video.readyState,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        seekableEnd: video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0,
        sources: sources.map((source) => new URL(source, location.href).href),
        poster: video.poster || null,
        width: video.videoWidth,
        height: video.videoHeight,
      } : null,
      startframe: start ? new URL(start.currentSrc || start.getAttribute('src'), location.href).href : video?.poster || null,
    };
  }, { sel: selector, at: index });
}

async function newPage(browser, viewport, { reducedMotion = 'no-preference', rejectPlay = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion });
  if (rejectPlay) await context.addInitScript(() => Object.defineProperty(window, '__lsRejectPlay', { value: true }));
  await context.addInitScript(INSTRUMENT);
  const page = await context.newPage();
  const media = [];
  const responses = new Map();
  page.on('request', (request) => {
    if (request.resourceType() === 'media' || VIDEO_URL.test(request.url())) media.push(request.url());
  });
  page.on('response', (response) => {
    const type = response.headers()['content-type'] ?? '';
    if (type.startsWith('video/') && !media.includes(response.url())) media.push(response.url());
    const list = responses.get(response.url()) ?? [];
    list.push(response.status());
    responses.set(response.url(), list);
  });
  return { context, page, media, responses };
}

async function sweep(page, selector, index, scene, steps = LIMITS.sweepSteps) {
  const start = Math.max(0, scene.top - scene.viewport);
  const end = scene.top + scene.height;
  const samples = [];
  for (let step = 0; step <= steps; step += 1) {
    await scrollTo(page, start + ((end - start) * step) / steps);
    samples.push(await readScene(page, selector, index));
  }
  await page.waitForTimeout(400);
  samples.push(await readScene(page, selector, index));
  return samples;
}

function checkGeometry(report, where, scene, samples) {
  const fill = scene.stickyHeight + scene.stickyTop;
  report.check('LS-GEOM-01', Math.abs(fill - scene.viewport) <= TOLERANCE.px, `${where}: sticky child`, `${Math.round(scene.stickyHeight)}px + ${Math.round(scene.stickyTop)}px offset in a ${scene.viewport}px viewport`, 'sticky height + offset = 100vh (or lvh, svh)');
  const travel = scene.height - scene.viewport;
  report.check('LS-GEOM-01', travel > 0, `${where}: box`, `${Math.round(scene.height)}px box, ${Math.round(travel)}px travel`, 'box = travel + 100vh with travel > 0');
  const drift = samples.filter((sample) => sample.geometric > 0.02 && sample.geometric < 0.98 && Math.abs(sample.stickyRectTop - sample.stickyTop) > 1.5);
  report.check('LS-GEOM-01', !drift.length, `${where}: pinning`, drift.length ? `sticky child moved at ${drift.length} of ${samples.length} steps (first at progress ${drift[0].geometric.toFixed(3)})` : 'stays at its offset for the whole travel', 'pinned while progress runs from 0 to 1');
  const values = samples.map((sample) => sample.exposed);
  if (values.every((value) => value === null)) {
    report.warn('LS-GEOM-01', `${where}: progress`, '--scene-progress is not exposed; geometry only', 'progress on --scene-progress');
  } else {
    const outside = values.filter((value) => value === null || value < -TOLERANCE.progress || value > 1 + TOLERANCE.progress);
    report.check('LS-GEOM-01', !outside.length, `${where}: progress range`, outside.length ? `${outside.length} reading(s) outside [0, 1], e.g. ${outside[0]}` : 'all readings in [0, 1]', 'progress clamped to [0, 1]');
    const backwards = values.findIndex((value, at) => at > 0 && value + TOLERANCE.progress < values[at - 1]);
    report.check('LS-GEOM-01', backwards < 0, `${where}: progress direction`, backwards < 0 ? 'never decreases on a forward sweep' : `fell from ${values[backwards - 1]} to ${values[backwards]}`, 'monotonic on a forward sweep');
    report.check('LS-GEOM-01', values[0] <= 0.01 && values[values.length - 1] >= 0.99, `${where}: progress ends`, `${values[0]} before, ${values[values.length - 1]} after`, '0 before the scene, 1 after it');
  }
  const travelVh = (travel / scene.viewport) * 100;
  report.check('LS-WARN-TRAVEL', travelVh >= LIMITS.travelMinVh && travelVh <= LIMITS.travelMaxVh, `${where}: travel`, `${Math.round(travelVh)}vh`, `${LIMITS.travelMinVh}-${LIMITS.travelMaxVh}vh`, 'warn');
  if (scene.cssTimeline) report.warn('LS-WARN-SUPPORTS', `${where}: CSS scroll timeline`, 'not provable here', 'inside @supports over a static fallback, checked in Firefox');
}

async function waitForFilm(page, selector, index) {
  await page.waitForFunction(({ sel, at }) => {
    const scene = document.querySelectorAll(sel)[at];
    const video = scene?.querySelector('video[data-scrub]') ?? scene?.querySelector('video');
    return !video || video.readyState >= 2 || scene?.dataset.scrubState === 'failed';
  }, { sel: selector, at: index }, { timeout: LIMITS.loadMs }).catch(() => {});
}

async function fastSweep(page, scene) {
  const start = scene.top;
  const end = scene.top + scene.height - scene.viewport;
  for (const [from, to] of [[start, end], [end, start]]) {
    for (let step = 0; step <= 40; step += 1) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), from + ((to - from) * step) / 40);
      await frames(page, 1);
    }
  }
  await page.waitForTimeout(300);
}

/**
 * SSIM between frame 0 as a browser shows it (the film's bt709 limited-range pixels turned into RGB) and the start
 * image as decoded, both scaled to the film's size; a colour-matrix mismatch between the two lowers the score too.
 */
function ssim(film, image, width, height) {
  const display = `scale=${width}:${height}:flags=accurate_rnd+full_chroma_int`;
  const filter = `[0:v]select=eq(n\\,0),scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24,${display},format=yuv444p[a];[1:v]${display},format=rgb24,format=yuv444p[b];[a][b]ssim`;
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-i', film, '-i', image, '-filter_complex', filter, '-frames:v', '1', '-f', 'null', '-']);
  const match = /All:([0-9.]+)/.exec(result.stderr);
  return match ? Number(match[1]) : null;
}

async function download(context, url, folder) {
  const response = await context.request.get(url);
  if (!response.ok()) throw new Error(`HTTP ${response.status()} for ${url}`);
  const name = `${String(fs.readdirSync(folder).length).padStart(2, '0')}-${path.basename(new URL(url).pathname) || 'file'}`;
  const file = path.join(folder, name);
  fs.writeFileSync(file, await response.body());
  return file;
}

async function checkFilm(report, where, run, scene, options, checkedMedia, scratch) {
  const { page, context, responses } = run;
  const video = scene.video;
  const log = await page.evaluate(() => window.__lsProbe);
  report.check('LS-VID-03', log.seekingWrites === 0, `${where}: seeking`, `${log.seekingWrites} currentTime write(s) while seeking`, 'latest-wins queue: no write while seeking');
  report.check('LS-VID-03', log.fastSeekCalls === 0, `${where}: fastSeek`, `${log.fastSeekCalls} call(s)`, 'never fastSeek()');
  const src = video.currentSrc;
  if (!src) {
    report.error('LS-VID-04', `${where}: film`, `no film attached (readyState ${video.readyState})`, 'a seekable film once the scene is near');
  } else if (src.startsWith('blob:')) {
    report.pass('LS-VID-04', `${where}: film`, 'Blob URL or MediaSource', 'seekable regardless of the server');
  } else {
    const statuses = responses.get(src) ?? [];
    report.check('LS-VID-04', statuses.includes(206), `${where}: film`, `responses ${statuses.join(', ') || 'none'}, seekable to ${video.seekableEnd.toFixed(2)} of ${video.duration ?? '?'} s`, '206 Range responses, a Blob URL or MediaSource');
  }
  report.check('LS-VID-05', log.earlyVisible.length === 0, `${where}: reveal`, log.earlyVisible.length ? `visible before its first presented frame: ${log.earlyVisible.join(', ')}` : 'hidden until a frame was presented', 'shown after the first presented frame');
  if (!options.media) {
    report.skip('LS-VID-05', `${where}: start image`, '--no-media');
    return;
  }
  const films = video.sources.length ? video.sources : src && !src.startsWith('blob:') ? [src] : [];
  if (!scene.startframe) {
    report.error('LS-VID-05', `${where}: start image`, 'none ([data-scene-startframe] or poster)', 'a start image equal to frame 0');
  } else if (films.length) {
    const film = await download(context, films[0], scratch);
    const image = await download(context, scene.startframe, scratch);
    const info = probeMedia(film);
    const score = ssim(film, image, info.video?.width ?? 640, info.video?.height ?? 360);
    report.check('LS-VID-05', score !== null && score >= LIMITS.ssim, `${where}: start image`, score === null ? 'SSIM could not be measured' : `SSIM ${score.toFixed(4)} against frame 0`, `SSIM at least ${LIMITS.ssim}`);
  }
  const key = films.join('|');
  if (films.length && !checkedMedia.has(key)) {
    checkedMedia.add(key);
    const infos = [];
    for (const url of films) infos.push(probeMedia(await download(context, url, scratch)));
    for (const info of infos) checkScrubFile(info, report);
    checkSourceSet(infos, report, `${where}: sources`);
  }
}

async function checkStatic(report, rule, where, browser, url, viewport, selector, index, condition) {
  const run = await newPage(browser, viewport, condition);
  try {
    await run.page.goto(url, { waitUntil: 'load' });
    await settle(run.page, selector);
    const first = await readScene(run.page, selector, index);
    if (!first) return;
    const pageHeight = await run.page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= pageHeight; y += Math.max(200, viewport.height / 2)) await scrollTo(run.page, y);
    await run.page.waitForTimeout(500);
    const scene = await readScene(run.page, selector, index);
    report.check(rule, !scene.pinned, `${where}: layout`, scene.pinned ? `still pinned (state ${scene.state ?? 'none'})` : 'normal flow', 'normal flow, no sticky stage');
    if (scene.exposed !== null) report.check(rule, scene.exposed >= 0.99, `${where}: end state`, `--scene-progress ${scene.exposed}`, 'end state (progress 1)');
    report.check(rule, run.media.length === 0, `${where}: film requests`, run.media.length ? run.media.map((entry) => path.basename(new URL(entry).pathname)).join(', ') : 'none', 'no film requested');
  } finally {
    await run.context.close();
  }
}

async function checkShortViewport(report, where, browser, url, viewport, selector, index, scene) {
  const need = Math.ceil(scene.stageHeight + scene.stickyTop);
  const height = need - 1;
  if (height < 200) {
    report.skip('LS-GATE-02', `${where}: short viewport`, `the stage needs only ${need}px`);
    return;
  }
  const run = await newPage(browser, { width: viewport.width, height });
  try {
    await run.page.goto(url, { waitUntil: 'load' });
    await settle(run.page, selector);
    const short = await readScene(run.page, selector, index);
    const fits = short.stageHeight + (short.stickyTop ?? 0) <= height;
    report.check('LS-GATE-02', !short.pinned || fits, `${where}: ${viewport.width}x${height}`, short.pinned ? `pinned with a ${Math.round(short.stageHeight)}px stage and ${Math.round(short.stickyTop ?? 0)}px offset` : 'normal flow', 'no pin when the stage plus its sticky offset does not fit');
  } finally {
    await run.context.close();
  }
}

export async function probe(options, report) {
  const playwright = await loadPlaywright(options.project);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-scroll-probe-'));
  const served = options.serve ? await startServer({ root: options.serve, mode: options.server }) : null;
  const url = served ? new URL(options.page, served.url).href : options.url;
  const browser = await launchChromium(playwright);
  const checkedMedia = new Set();
  try {
    for (const viewport of options.viewports) {
      const label = `${viewport.width}x${viewport.height}`;
      const run = await newPage(browser, viewport);
      let count = 0;
      try {
        await run.page.goto(url, { waitUntil: 'load' });
        await settle(run.page, options.scene);
        count = await run.page.evaluate((sel) => document.querySelectorAll(sel).length, options.scene);
        if (!count) throw new UsageError(`No element matches ${options.scene} on ${url}.`);
        for (let index = 0; index < count; index += 1) {
          const where = `scene ${index + 1} at ${label}`;
          const scene = await readScene(run.page, options.scene, index);
          if (!scene.pinned) {
            report.skip('LS-GEOM-01', where, `does not pin here (${scene.reason || 'no sticky stage'})`);
            report.skip('LS-GATE-02', where, 'does not pin at the full viewport');
          } else {
            await scrollTo(run.page, 0);
            const samples = await sweep(run.page, options.scene, index, scene);
            checkGeometry(report, where, scene, samples);
            await checkShortViewport(report, where, browser, url, viewport, options.scene, index, scene);
          }
          if (scene.video) {
            if (scene.pinned) {
              await scrollTo(run.page, scene.top);
              await waitForFilm(run.page, options.scene, index);
              await fastSweep(run.page, await readScene(run.page, options.scene, index));
              await checkFilm(report, where, run, await readScene(run.page, options.scene, index), options, checkedMedia, scratch);
            } else {
              report.skip('LS-VID-03', where, 'the scene does not pin, so nothing scrubs');
            }
          }
          await checkStatic(report, 'LS-GATE-01', `${where}, reduced motion`, browser, url, viewport, options.scene, index, { reducedMotion: 'reduce' });
          if (scene.video) await checkStatic(report, 'LS-GATE-01', `${where}, rejected play()`, browser, url, viewport, options.scene, index, { rejectPlay: true });
        }
      } finally {
        await run.context.close();
      }
    }
  } finally {
    await browser.close();
    await served?.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.serve && !fs.existsSync(options.serve)) throw new UsageError(`${options.serve} does not exist.`);
  const report = createReport({ tool: 'probe-scene' });
  await probe(options, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
