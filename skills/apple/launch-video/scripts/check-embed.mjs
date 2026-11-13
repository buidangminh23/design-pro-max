/**
 * launch-video embed check: loads a page in headless Chromium (Playwright from the user's project) and checks how its
 * demo clips load, play and stop.
 *
 *   node check-embed.mjs --url <page url> [options]
 *   node check-embed.mjs --serve <folder> [--page <path>] [--server range|200] [options]
 *
 * Options: --selector <css> (default video), --viewport WxH (repeatable; default 1280x800), --project <folder with
 * Playwright> (default: the current folder).
 *
 * Rules: LV-EMBED-01 a clip below the fold at load has no autoplay attribute and preload="none"; one more than 600px
 * below it also has no source and no video byte requested before the reader scrolls (a lazy loader may start inside
 * that margin); every clip gets its source once near; LV-EMBED-02 any clip that
 * moves for more than 5 s on its own (any loop, or a longer one-shot) has a labelled control that pauses it, and under
 * reduced motion nothing plays, also after a clip has loaded. Warnings: a clip at least half visible plays, at most one
 * clip plays at once and Save-Data loads no video (under LV-EMBED-01); LV-WARN-DENSITY 1.3-2.0 video pixels per CSS
 * pixel; LV-WARN-AV1 AV1 listed first when present and an H.264 source always listed. Output follows the shared
 * checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { MODES, startServer } from '../../shared/server.mjs';

export const DEFAULT_VIEWPORTS = [{ width: 1280, height: 800 }];
export const LIMITS = Object.freeze({ pauseAfterSeconds: 5, densityMin: 1.3, densityMax: 2, loadMs: 6000, settleMs: 800, playRatio: 0.5, nearMarginPx: 600 });
export const BOUNDARY =
  'Proof boundary: headless Chromium proves load order, gating, playback state and controls; it does not prove iOS ' +
  'Safari autoplay policy, Low Power Mode, which codec WebKit picks, real device decoding or taste.';

const VIDEO_URL = /\.(?:mp4|m4v|mov|webm)(?:[?#]|$)/i;
const USAGE = 'Usage: node check-embed.mjs (--url <url> | --serve <folder> [--page <path>] [--server range|200]) [--selector <css>] [--viewport WxH] [--project <folder>]';

export const INSTRUMENT = String.raw`(() => {
  const log = { plays: 0, playing: [] };
  Object.defineProperty(window, '__lvEmbed', { value: log, enumerable: false });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { log.plays += 1; return play.apply(this, arguments); };
  document.addEventListener('playing', (event) => log.playing.push(event.target.currentSrc || '(no source)'), true);
  if (window.__lvSaveData) {
    const connection = { saveData: true, effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => connection });
  }
})();`;

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(value));
  if (!match) throw new UsageError(`--viewport needs WIDTHxHEIGHT, got ${value}.`, USAGE);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseArgs(argv) {
  const options = { url: null, serve: null, page: 'index.html', server: 'range', selector: 'video', viewports: [], project: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--url') options.url = value();
    else if (arg === '--serve') options.serve = value();
    else if (arg === '--page') options.page = value();
    else if (arg === '--server') options.server = value();
    else if (arg === '--selector') options.selector = value();
    else if (arg === '--viewport') options.viewports.push(parseViewport(value()));
    else if (arg === '--project') options.project = value();
    else throw new UsageError(`Unknown argument ${arg}.`, USAGE);
  }
  if (!options.url === !options.serve) throw new UsageError('Give exactly one of --url or --serve.', USAGE);
  if (!MODES.includes(options.server)) throw new UsageError(`--server must be one of ${MODES.join(', ')}.`, USAGE);
  if (!options.viewports.length) options.viewports = DEFAULT_VIEWPORTS;
  return options;
}

/** True when a clip moves on its own for longer than the limit: any loop, or a one-shot longer than it. */
export function needsPause({ loop, duration }, limit = LIMITS.pauseAfterSeconds) {
  return Boolean(loop) || (Number.isFinite(duration) && duration > limit);
}

/** The codec family a source names, from its type attribute or, failing that, its file name. */
export function sourceKind({ type, url }) {
  const value = `${type ?? ''} ${url ?? ''}`.toLowerCase();
  if (/av01|\bav1\b|\.av1\./.test(value)) return 'av1';
  if (/hvc1|hev1|hevc|\.mov\b/.test(value)) return 'hevc';
  if (/vp09|vp9|webm/.test(value)) return 'vp9';
  if (/avc1|avc3|h264|mp4|m4v/.test(value)) return 'h264';
  return 'unknown';
}

function readVideos(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((video, index) => {
    const rect = video.getBoundingClientRect();
    const sources = [...video.querySelectorAll('source')];
    const attributeSources = [video.getAttribute('src'), ...sources.map((source) => source.getAttribute('src'))].filter(Boolean);
    const intersect = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    return {
      index,
      top: rect.top,
      width: rect.width,
      viewport: innerHeight,
      ratio: rect.width * rect.height ? intersect / (rect.width * rect.height) : 0,
      autoplay: video.hasAttribute('autoplay'),
      preload: video.getAttribute('preload'),
      attributeSources: attributeSources.map((value) => new URL(value, location.href).href),
      sources: sources.map((source) => ({ url: new URL(source.dataset.src || source.getAttribute('src') || '', location.href).href, type: source.getAttribute('type') })),
      currentSrc: video.currentSrc,
      paused: video.paused,
      loop: video.loop,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
    };
  }), selector);
}

async function newRun(browser, viewport, { reducedMotion = 'no-preference', saveData = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion });
  if (saveData) await context.addInitScript(() => Object.defineProperty(window, '__lvSaveData', { value: true }));
  await context.addInitScript(INSTRUMENT);
  const page = await context.newPage();
  const media = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'media' || VIDEO_URL.test(request.url())) media.push(request.url().split('#')[0]);
  });
  return { context, page, media };
}

async function open(run, url) {
  await run.page.goto(url, { waitUntil: 'load' });
  await run.page.waitForTimeout(LIMITS.settleMs);
}

async function visit(page, selector, index) {
  await page.evaluate(({ sel, at }) => document.querySelectorAll(sel)[at]?.scrollIntoView({ block: 'center', behavior: 'instant' }), { sel: selector, at: index });
  await page.waitForFunction(({ sel, at }) => {
    const video = document.querySelectorAll(sel)[at];
    return !video || video.readyState >= 2;
  }, { sel: selector, at: index }, { timeout: LIMITS.loadMs }).catch(() => {});
  await page.waitForTimeout(600);
}

const accessibleName = (page, selector, index) => page.evaluate(({ sel, at }) => {
  const video = document.querySelectorAll(sel)[at];
  const container = video.closest('[data-demo], figure') ?? video.parentElement;
  const named = (element) => {
    const labelled = element.getAttribute('aria-labelledby');
    const text = labelled ? labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
    return (element.getAttribute('aria-label') || text || element.textContent || element.getAttribute('title') || '').trim();
  };
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const control = [...container.querySelectorAll('button, [role="button"]')].find((element) => visible(element) && named(element));
  if (!control) return null;
  control.setAttribute('data-lv-probe-control', String(at));
  return named(control);
}, { sel: selector, at: index });

async function checkNormal(report, label, browser, url, viewport, selector) {
  const run = await newRun(browser, viewport);
  try {
    await open(run, url);
    const atLoad = await readVideos(run.page, selector);
    if (!atLoad.length) throw new UsageError(`No element matches ${selector} on ${url}.`);
    const beforeScroll = new Set(run.media);
    let mostPlaying = 0;
    for (const first of atLoad) {
      const where = `clip ${first.index + 1} at ${label}`;
      const below = first.top >= first.viewport;
      await visit(run.page, selector, first.index);
      const clips = await readVideos(run.page, selector);
      const clip = clips[first.index];
      mostPlaying = Math.max(mostPlaying, clips.filter((entry) => !entry.paused).length);
      const urls = [...new Set([...clip.sources.map((source) => source.url), ...(clip.currentSrc ? [clip.currentSrc] : [])])];
      if (below) {
        report.check('LV-EMBED-01', !first.autoplay, `${where}: autoplay attribute`, first.autoplay ? 'present' : 'absent', 'no autoplay attribute (it overrides preload)');
        report.check('LV-EMBED-01', first.preload === 'none', `${where}: preload`, first.preload ?? 'not set (the browser default)', 'preload="none"');
        if (first.top - first.viewport >= LIMITS.nearMarginPx) {
          report.check('LV-EMBED-01', !first.attributeSources.length && !first.currentSrc, `${where}: source at load`, first.attributeSources.length ? first.attributeSources.map((value) => path.basename(new URL(value).pathname)).join(', ') : first.currentSrc || 'none', 'no src until the clip is near');
          const early = urls.filter((value) => beforeScroll.has(value));
          report.check('LV-EMBED-01', !early.length, `${where}: bytes before scroll`, early.length ? `requested ${early.map((value) => path.basename(new URL(value).pathname)).join(', ')}` : 'none', '0 video bytes before the reader scrolls');
        } else {
          report.skip('LV-EMBED-01', `${where}: source at load`, `within ${LIMITS.nearMarginPx}px of the fold, inside a lazy loader's margin`);
        }
        report.check('LV-EMBED-01', Boolean(clip.currentSrc), `${where}: source when near`, clip.currentSrc ? path.basename(new URL(clip.currentSrc).pathname) : `none (readyState ${clip.readyState})`, 'a source once the clip is near');
      } else {
        report.skip('LV-EMBED-01', where, 'in the first viewport at load, so it may load at once');
      }
      if (clip.ratio >= LIMITS.playRatio) report.check('LV-EMBED-01', !clip.paused, `${where}: playback`, `${clip.paused ? 'paused' : 'playing'} at ${Math.round(clip.ratio * 100)} % visible`, `plays while at least ${LIMITS.playRatio * 100} % visible`, 'warn');
      if (clip.videoWidth && clip.width) {
        const density = clip.videoWidth / clip.width;
        report.check('LV-WARN-DENSITY', density >= LIMITS.densityMin - 0.005 && density <= LIMITS.densityMax + 0.005, `${where}: density`, `${density.toFixed(2)} video px per CSS px (${clip.videoWidth} in ${Math.round(clip.width)})`, `${LIMITS.densityMin}-${LIMITS.densityMax}`, 'warn');
      }
      const kinds = clip.sources.map(sourceKind);
      if (kinds.length) {
        report.check('LV-WARN-AV1', kinds.includes('h264'), `${where}: H.264 source`, kinds.join(', '), 'an H.264 source, listed last', 'warn');
        if (kinds.includes('av1')) report.check('LV-WARN-AV1', kinds[0] === 'av1' || kinds[0] === 'hevc', `${where}: AV1 order`, kinds.join(', '), 'AV1 first (after an HEVC-with-alpha file), H.264 last', 'warn');
      }
      if (!needsPause(clip)) {
        report.pass('LV-EMBED-02', `${where}: pause control`, `a ${clip.duration?.toFixed(1) ?? '?'} s one-shot`, `a labelled pause control when a clip moves for more than ${LIMITS.pauseAfterSeconds} s`);
        continue;
      }
      const name = await accessibleName(run.page, selector, first.index);
      if (!name) {
        report.error('LV-EMBED-02', `${where}: pause control`, `none for a ${clip.loop ? 'looping' : `${clip.duration.toFixed(1)} s`} clip`, 'a visible button with an accessible name that pauses the clip');
        continue;
      }
      if ((await readVideos(run.page, selector))[first.index].paused) {
        report.warn('LV-EMBED-02', `${where}: pause control "${name}"`, 'the clip was not playing, so the control could not be tried', 'a labelled control that pauses the clip');
        continue;
      }
      await run.page.click(`[data-lv-probe-control="${first.index}"]`);
      await run.page.waitForTimeout(400);
      const after = (await readVideos(run.page, selector))[first.index];
      report.check('LV-EMBED-02', after.paused, `${where}: pause control "${name}"`, after.paused ? 'pauses the clip' : 'the clip kept playing after the click', 'a labelled control that pauses the clip');
    }
    report.check('LV-EMBED-01', mostPlaying <= 1, `${label}: active clips`, `${mostPlaying} playing at once`, 'one active clip at a time', 'warn');
  } finally {
    await run.context.close();
  }
}

async function scrollThrough(run, selector, count) {
  for (let index = 0; index < count; index += 1) await visit(run.page, selector, index);
  await run.page.waitForTimeout(1000);
}

async function checkReducedMotion(report, label, browser, url, viewport, selector) {
  const run = await newRun(browser, viewport, { reducedMotion: 'reduce' });
  try {
    await open(run, url);
    const count = (await readVideos(run.page, selector)).length;
    await scrollThrough(run, selector, count);
    const clips = await readVideos(run.page, selector);
    const log = await run.page.evaluate(() => window.__lvEmbed);
    const loaded = clips.filter((clip) => clip.readyState >= 2).length;
    const playing = clips.filter((clip) => !clip.paused).length;
    const measured = log.playing.length ? `${log.playing.length} clip start(s): ${[...new Set(log.playing.map((value) => path.basename(value.split('?')[0])))].join(', ')}; ${loaded} of ${clips.length} loaded` : `nothing played; ${loaded} of ${clips.length} loaded`;
    report.check('LV-EMBED-02', !log.playing.length && !playing, `${label}, reduced motion`, measured, 'nothing autoplays under reduced motion, also after a clip has loaded');
  } finally {
    await run.context.close();
  }
}

async function checkSaveData(report, label, browser, url, viewport, selector) {
  const run = await newRun(browser, viewport, { saveData: true });
  try {
    await open(run, url);
    const count = (await readVideos(run.page, selector)).length;
    await scrollThrough(run, selector, count);
    const files = [...new Set(run.media.map((value) => path.basename(new URL(value).pathname)))];
    report.check('LV-EMBED-01', !files.length, `${label}, Save-Data`, files.length ? `loaded ${files.join(', ')}` : 'no video requested', 'no video loads until the reader asks under Save-Data (Chromium only)', 'warn');
  } finally {
    await run.context.close();
  }
}

export async function checkEmbed(options, report) {
  const playwright = await loadPlaywright(options.project);
  const served = options.serve ? await startServer({ root: options.serve, mode: options.server }) : null;
  const url = served ? new URL(options.page, served.url).href : options.url;
  const browser = await launchChromium(playwright);
  try {
    for (const viewport of options.viewports) {
      const label = `${viewport.width}x${viewport.height}`;
      await checkNormal(report, label, browser, url, viewport, options.selector);
      await checkReducedMotion(report, label, browser, url, viewport, options.selector);
      await checkSaveData(report, label, browser, url, viewport, options.selector);
    }
  } finally {
    await browser.close();
    await served?.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.serve && !fs.existsSync(options.serve)) throw new UsageError(`${options.serve} does not exist.`);
  const report = createReport({ tool: 'check-embed', boundary: BOUNDARY });
  await checkEmbed(options, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
