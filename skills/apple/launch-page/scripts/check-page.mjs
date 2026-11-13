/**
 * launch-page checker: loads a page in headless Chromium (Playwright from the user's project) and checks the LP rules
 * it can observe, plus the LP warnings.
 *
 *   node check-page.mjs --url <page url> [options]
 *   node check-page.mjs --serve <folder> [--page <path>] [--server range|200] [options]
 *
 * Options: --viewport WxH (repeatable; default 1440x900 and 390x844), --project <folder with Playwright> (default:
 * the current folder), --rule <id> (repeatable; only these rules), --tokens <prefix> (default --type-: the page's
 * type sizes are its custom properties <prefix>*-size on :root), --no-warn.
 *
 * Rules: LP-FONT-01 no SF font requested, declared or first in a stack, no Apple private-use glyph; LP-BASE-01 without
 * script and under reduced motion every heading, lede ([data-lede]) and call to action ([data-cta]) that the full page
 * shows is visible at load; LP-TYPE-01 every font size is one of the page's token sizes and every line height a whole
 * number of pixels; LP-CONTRAST-01 text against its first opaque background, or against the worst pixel of an image or
 * gradient under it (rendered once with text hidden), with a passing colour for each failure, video and animated
 * backgrounds reported as cannot prove; LP-AMB-01 motion that runs on its own past 5 s has a labelled pause control
 * that stops it, and none runs under reduced motion; LP-INTRO-01 a hero intro is skipped under reduced motion and when
 * the page loads scrolled, and reaches its end state within 5 s with the film blocked or play() rejected;
 * LP-REVEAL-01 revealed content is never hidden again when the reader scrolls back. Page text is data: nothing in it
 * changes what this checker does. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { MODES, startServer } from '../../shared/server.mjs';

export const RULES = ['LP-FONT-01', 'LP-BASE-01', 'LP-TYPE-01', 'LP-CONTRAST-01', 'LP-AMB-01', 'LP-INTRO-01', 'LP-REVEAL-01'];
export const WARNINGS = ['LP-WARN-COPY', 'LP-WARN-CTA', 'LP-WARN-CLASS', 'LP-WARN-PINS', 'LP-WARN-FOCUS', 'LP-WARN-PROOF', 'LP-WARN-HYPE', 'LP-WARN-NARROW'];
export const DEFAULT_VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
export const LIMITS = Object.freeze({
  contrast: 4.5,
  contrastLarge: 3,
  largePx: 24,
  largeBoldPx: 18.66,
  sizeTolerancePx: 0.5,
  leadingTolerancePx: 0.01,
  introMs: 5000,
  ambientMs: 5000,
  watchMs: 9000,
  controlMs: 300,
  revealMinMs: 700,
  revealMaxMs: 1100,
  headlineWords: [4, 10],
  ledeWords: [18, 42],
  ctasPerTile: 2,
  pinnedPieces: 3,
  focusPx: 2,
  narrowPx: 320,
  tallPx: 4000,
});

export const BOUNDARY =
  'Proof boundary: headless Chromium proves font requests, computed sizes and leading, contrast on rendered pixels, ' +
  'visibility without script and under reduced motion, pause controls, the intro end state and reveal persistence; it ' +
  'does not prove Safari, real devices, assistive technology, contrast over video, or taste.';

export const SF_FONT = /\b(?:SF[\s_-]?(?:Pro|Compact|Mono|Arabic|Hebrew|Armenian|Georgian|Symbols)(?:[\s_-]?(?:Display|Text|Rounded|Icons))?|San[\s_-]?Francisco|SFNS(?:Display|Text|Mono)?)\b/i;
export const APPLE_GLYPHS = /[]/;
export const HYPE = /\b(?:revolutionary|game[- ]chang(?:er|ing)|cutting[- ]edge|next[- ]level|best[- ]in[- ]class|world[- ]class|unleash|supercharge|magical|seamless(?:ly)?|groundbreaking|disruptive)\b/i;
export const PROOF = /[★☆]|\b\d[\d,.]*\s?(?:k|K|M|million|thousand)?\+?\s+(?:happy\s+)?(?:users|customers|downloads|teams|companies|reviews|installs)\b|\b(?:award[- ]winning|rated\s+\d|#1\b|number one|best[- ]selling)/i;
const VIDEO_URL = /\.(?:mp4|m4v|mov|webm)(?:[?#]|$)/i;
const NON_LATIN = /^(?:ja|ko|th|zh)\b/i;

export function parseColor(value) {
  const text = String(value ?? '').trim();
  let match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(text);
  if (match) {
    const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number(match[4]);
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
  }
  match = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(text);
  if (match) {
    const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number(match[4]);
    return { r: Number(match[1]) * 255, g: Number(match[2]) * 255, b: Number(match[3]) * 255, a: alpha };
  }
  match = /^#([0-9a-f]{6})$/i.exec(text);
  if (match) {
    const n = Number.parseInt(match[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}

export function composite(top, bottom) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (key) => (top[key] * top.a + bottom[key] * bottom.a * (1 - top.a)) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a };
}

export function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg, bg) {
  const [high, low] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export const isLargeText = (sizePx, weight) => sizePx >= LIMITS.largePx || (sizePx >= LIMITS.largeBoldPx && weight >= 700);

export const toHex = ({ r, g, b }) => `#${[r, g, b].map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;

export function suggestColor(fg, bg, minimum) {
  const options = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }].map((target) => {
    for (let step = 1; step <= 100; step += 1) {
      const t = step / 100;
      const candidate = { r: fg.r + (target.r - fg.r) * t, g: fg.g + (target.g - fg.g) * t, b: fg.b + (target.b - fg.b) * t, a: 1 };
      const rounded = parseColor(toHex(candidate));
      if (contrastRatio(rounded, bg) >= minimum) return { step, color: toHex(candidate) };
    }
    return null;
  }).filter(Boolean);
  options.sort((a, b) => a.step - b.step);
  return options[0]?.color ?? null;
}

export function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function firstFamily(stack) {
  return String(stack ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? '';
}

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(value));
  if (!match) throw new UsageError(`--viewport needs WIDTHxHEIGHT, got ${value}.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const USAGE = 'Usage: node check-page.mjs (--url <url> | --serve <folder> [--page <path>] [--server range|200]) [--viewport WxH] [--project <folder>] [--rule <id>] [--tokens <prefix>] [--no-warn]';

export function parseArgs(argv) {
  const options = { url: null, serve: null, page: 'index.html', server: 'range', viewports: [], project: process.cwd(), rules: [], tokens: '--type-', warn: true };
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
    else if (arg === '--viewport') options.viewports.push(parseViewport(value()));
    else if (arg === '--project') options.project = value();
    else if (arg === '--rule') options.rules.push(value());
    else if (arg === '--tokens') options.tokens = value();
    else if (arg === '--no-warn') options.warn = false;
    else throw new UsageError(`Unknown argument ${arg}.`, USAGE);
  }
  if (!options.url === !options.serve) throw new UsageError('Give exactly one of --url or --serve.', USAGE);
  if (!MODES.includes(options.server)) throw new UsageError(`--server must be one of ${MODES.join(', ')}.`);
  for (const rule of options.rules) if (![...RULES, ...WARNINGS].includes(rule)) throw new UsageError(`Unknown rule ${rule}. Rules: ${[...RULES, ...WARNINGS].join(', ')}.`);
  if (!options.viewports.length) options.viewports = DEFAULT_VIEWPORTS;
  return options;
}

const HELPERS = String.raw`
const __lp = (() => {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'HEAD', 'TITLE']);
  const TARGETS = 'h1, h2, h3, h4, h5, h6, [data-lede], [data-cta]';
  const ownText = (element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
  const textOf = (element) => (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const describe = (element) => {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? '#' + element.id : '';
    const classes = [...element.classList].slice(0, 2).map((name) => '.' + name).join('');
    const text = textOf(element).slice(0, 40);
    return tag + id + classes + (text ? ' "' + text + (textOf(element).length > 40 ? '...' : '') + '"' : '');
  };
  const effectiveOpacity = (element) => {
    let value = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  const shown = (element) => {
    if (!element.isConnected) return false;
    if (element.checkVisibility && !element.checkVisibility({ checkVisibilityCSS: true })) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const visible = (element) => shown(element) && effectiveOpacity(element) >= 0.99;
  const structurallyHidden = (element) => Boolean(element.closest('[hidden], [inert], details:not([open]) > :not(summary)')) || !shown(element);
  const textElements = () => [...document.querySelectorAll('body *')].filter((element) => !SKIP.has(element.tagName) && !element.closest('svg') && ownText(element) && shown(element));
  const targets = () => [...document.querySelectorAll(TARGETS)].filter((element) => textOf(element) || element.getAttribute('aria-label'));
  const keys = (elements) => {
    const seen = new Map();
    return elements.map((element) => {
      const base = element.tagName + '|' + (element.id || textOf(element).slice(0, 60) || element.getAttribute('aria-label') || '');
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return base + '|' + count;
    });
  };
  return { ownText, textOf, describe, effectiveOpacity, shown, visible, structurallyHidden, textElements, targets, keys };
})();`;

function inPage(page, fn, arg = null) {
  return page.evaluate(`(async () => { ${HELPERS}; return (${fn.toString()})(__lp, ${JSON.stringify(arg)}); })()`);
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function newRun(browser, viewport, { reducedMotion = 'no-preference', javaScriptEnabled = true, blockFilm = false, rejectPlay = false, clock = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion, javaScriptEnabled });
  const requests = [];
  if (rejectPlay) {
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = function play() {
        return Promise.reject(new DOMException('play() rejected by the checker', 'NotAllowedError'));
      };
    });
  }
  await context.route(/^https?:\/\/[^/]*\.invalid(?::\d+)?\//, (route) => route.abort('namenotresolved'));
  if (blockFilm) await context.route((url) => VIDEO_URL.test(url.href), () => {});
  const page = await context.newPage();
  if (clock) await page.clock.install();
  page.on('request', (request) => requests.push({ url: request.url(), type: request.resourceType() }));
  return { context, page, requests, close: () => context.close() };
}

async function settle(page, ms = 300) {
  await page.waitForLoadState('load').catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await pause(ms);
}

async function scrollThrough(page, viewport, { down = true, up = false, wait = 120, onStep = null } = {}) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(200, Math.round(viewport.height / 2));
  const positions = [];
  for (let y = 0; y <= height; y += step) positions.push(y);
  const passes = [...(down ? [positions] : []), ...(up ? [[...positions].reverse()] : [])];
  for (const list of passes) {
    for (const y of list) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await pause(wait);
      if (onStep) await onStep(y);
    }
  }
}

const wanted = (options, rule) => !options.rules.length || options.rules.includes(rule);
const warningsWanted = (options) => options.warn && (!options.rules.length || options.rules.some((rule) => rule.startsWith('LP-WARN-')));

async function checkFonts(report, where, run) {
  const found = await inPage(run.page, (lp, source) => {
    const sf = new RegExp(source, 'i');
    const issues = [];
    for (const face of document.fonts ?? []) if (sf.test(face.family)) issues.push(`@font-face "${face.family.replace(/["']/g, '')}"`);
    const visit = (rules) => {
      for (const rule of rules ?? []) {
        if (rule.type === 5 && (sf.test(rule.style.getPropertyValue('font-family')) || sf.test(rule.style.getPropertyValue('src')))) issues.push(`@font-face ${rule.style.getPropertyValue('font-family')}`);
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.href && sf.test(decodeURIComponent(sheet.href))) issues.push(`stylesheet ${sheet.href}`);
      try {
        visit(sheet.cssRules);
      } catch {
        continue;
      }
    }
    const stacks = new Map();
    for (const element of [document.body, ...lp.textElements()]) {
      const stack = getComputedStyle(element).fontFamily;
      if (!stacks.has(stack)) stacks.set(stack, lp.describe(element));
    }
    for (const [stack, element] of stacks) if (sf.test(stack)) issues.push(`font-family ${stack} on ${element}`);
    const glyphs = lp.textElements().filter((element) => /[]/.test(element.textContent)).map(lp.describe);
    return { issues: [...new Set(issues)], glyphs, stacks: [...stacks.keys()] };
  }, SF_FONT.source);
  const requested = [...new Set(run.requests.filter((request) => SF_FONT.test(decodeURIComponent(request.url))).map((request) => request.url))];
  const problems = [...requested.map((url) => `requested ${url}`), ...found.issues, ...found.glyphs.map((element) => `Apple private-use glyph in ${element}`)];
  if (problems.length) {
    for (const problem of problems) report.error('LP-FONT-01', `${where}: ${problem}`, 'an SF font or symbol on the page', 'system-ui or a licensed font first; no SF Pro, SF Pro Icons, SF Symbols or their glyphs');
  } else {
    report.pass('LP-FONT-01', where, `no SF font requested or declared; first families: ${[...new Set(found.stacks.map(firstFamily))].join(', ')}`, 'system-ui or a licensed font first');
  }
}

async function checkType(report, where, run, prefix) {
  const result = await inPage(run.page, (lp, tokenPrefix) => {
    const names = new Set();
    const visit = (rules) => {
      for (const rule of rules ?? []) {
        if (rule.style) for (const name of rule.style) if (name.startsWith(tokenPrefix) && name.endsWith('-size')) names.add(name);
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {
        continue;
      }
    }
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.append(probe);
    const tokens = {};
    for (const name of names) {
      probe.style.fontSize = `var(${name})`;
      const value = Number.parseFloat(getComputedStyle(probe).fontSize);
      if (Number.isFinite(value) && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) tokens[name] = value;
    }
    probe.remove();
    const elements = lp.textElements().map((element) => {
      const style = getComputedStyle(element);
      return { where: lp.describe(element), size: Number.parseFloat(style.fontSize), leading: style.lineHeight };
    });
    return { tokens, elements };
  }, prefix);
  const sizes = Object.values(result.tokens);
  if (!sizes.length) {
    report.error('LP-TYPE-01', `${where}: token set`, `no ${prefix}*-size custom properties on :root`, 'a chosen token set (tokens.css) whose sizes the page uses');
    return;
  }
  const offSize = new Map();
  const offLeading = new Map();
  for (const element of result.elements) {
    if (!sizes.some((size) => Math.abs(size - element.size) <= LIMITS.sizeTolerancePx)) {
      const key = `${element.size}`;
      offSize.set(key, [...(offSize.get(key) ?? []), element.where]);
    }
    const leading = Number.parseFloat(element.leading);
    if (!Number.isFinite(leading) || Math.abs(leading - Math.round(leading)) > LIMITS.leadingTolerancePx) {
      const key = element.leading;
      offLeading.set(key, [...(offLeading.get(key) ?? []), element.where]);
    }
  }
  const tokenList = [...new Set(sizes.map((size) => `${Number(size.toFixed(2))}px`))].join(', ');
  for (const [size, elements] of offSize) report.error('LP-TYPE-01', `${where}: ${elements[0]}${elements.length > 1 ? ` and ${elements.length - 1} more` : ''}`, `font-size ${size}px`, `one of the token sizes ${tokenList}`);
  for (const [leading, elements] of offLeading) report.error('LP-TYPE-01', `${where}: ${elements[0]}${elements.length > 1 ? ` and ${elements.length - 1} more` : ''}`, `line-height ${leading}`, 'a whole number of pixels');
  if (!offSize.size && !offLeading.size) report.pass('LP-TYPE-01', where, `${result.elements.length} text boxes on ${sizes.length} token sizes with whole-pixel leading`, 'token sizes, integer leading');
}

async function targetState(page) {
  return inPage(page, (lp) => {
    const elements = lp.targets();
    const keys = lp.keys(elements);
    return elements.map((element, index) => ({
      key: keys[index],
      where: lp.describe(element),
      visible: lp.visible(element),
      hidden: lp.structurallyHidden(element),
      opacity: Number(lp.effectiveOpacity(element).toFixed(3)),
    }));
  });
}

async function checkBaseline(report, where, run, reference, label) {
  const state = await targetState(run.page);
  const byKey = new Map(state.map((entry) => [entry.key, entry]));
  const missing = [];
  let checked = 0;
  for (const entry of reference) {
    if (!entry.visible) continue;
    checked += 1;
    const now = byKey.get(entry.key);
    if (!now || !now.visible) missing.push(`${entry.where} (${now ? `opacity ${now.opacity}${now.hidden ? ', hidden' : ''}` : 'absent'})`);
  }
  if (missing.length) {
    for (const item of missing) report.error('LP-BASE-01', `${where}, ${label}: ${item}`, 'not visible at load', 'every heading, lede and call to action visible in normal flow');
  } else {
    report.pass('LP-BASE-01', `${where}, ${label}`, `${checked} headings, ledes and calls to action visible at load`, 'all visible without script or motion');
  }
}

async function waitIntro(page, ms = 6500) {
  await page.waitForFunction(() => document.documentElement.dataset.intro !== 'play', null, { timeout: ms }).catch(() => {});
}

async function checkReveal(report, where, run, viewport) {
  const seen = new Map();
  const hiddenAgain = new Map();
  const sample = async () => {
    const state = await inPage(run.page, (lp) => {
      const elements = [...new Set([...lp.textElements(), ...document.querySelectorAll('[data-reveal]')])]
        .filter((element) => !element.closest('[aria-roledescription="carousel"], [data-gallery], [data-marquee]'));
      const keys = lp.keys(elements);
      return elements.map((element, index) => ({
        key: keys[index],
        where: lp.describe(element),
        visible: lp.visible(element),
        structural: lp.structurallyHidden(element),
        opacity: Number(lp.effectiveOpacity(element).toFixed(3)),
        visibility: getComputedStyle(element).visibility,
      }));
    });
    for (const entry of state) {
      if (entry.visible) seen.set(entry.key, entry.where);
      else if (seen.has(entry.key) && !entry.structural && (entry.opacity < 0.5 || entry.visibility === 'hidden') && !hiddenAgain.has(entry.key)) hiddenAgain.set(entry.key, `${entry.where} (opacity ${entry.opacity})`);
    }
  };
  await scrollThrough(run.page, viewport, { down: true, wait: 150, onStep: sample });
  await pause(1200);
  await sample();
  await scrollThrough(run.page, viewport, { down: false, up: true, wait: 150, onStep: sample });
  await pause(400);
  await sample();
  if (hiddenAgain.size) {
    for (const item of hiddenAgain.values()) report.error('LP-REVEAL-01', `${where}: ${item}`, 'hidden again after it was revealed', 'revealed once, never hidden on scroll back');
  } else {
    report.pass('LP-REVEAL-01', where, `${seen.size} elements stayed visible after a full scroll down and back`, 'revealed once, never hidden again');
  }
}

async function checkContrast(report, where, run) {
  await inPage(run.page, () => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming?.();
      if (timing && Number.isFinite(timing.endTime)) animation.finish();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await pause(150);
  const data = await inPage(run.page, (lp) => {
    const parse = (value) => {
      const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i.exec(value ?? '');
      if (!match) return null;
      const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number(match[4]);
      return { r: +match[1], g: +match[2], b: +match[3], a: alpha };
    };
    const running = (element) => element.getAnimations?.().some((animation) => animation.playState === 'running' && !Number.isFinite(animation.effect?.getComputedTiming?.().endTime));
    const MEDIA = 'img, picture, svg, canvas, video, iframe';
    const items = [];
    const visuals = [...document.querySelectorAll('body *')].filter((element) => {
      const own = getComputedStyle(element);
      if (['fixed', 'sticky'].includes(own.position) || !lp.shown(element)) return false;
      return element.matches(MEDIA) || own.backgroundImage !== 'none' || (parse(own.backgroundColor)?.a ?? 0) > 0;
    }).map((element) => ({ element, rect: element.getBoundingClientRect(), tag: element.tagName.toLowerCase(), unknown: element.matches('video, canvas, iframe') || Boolean(element.querySelector('video, canvas')) || running(element) }));
    for (const element of lp.textElements()) {
      const style = getComputedStyle(element);
      if (lp.effectiveOpacity(element) < 0.1) continue;
      const range = document.createRange();
      const rects = [];
      for (const node of element.childNodes) {
        if (node.nodeType !== 3 || !node.textContent.trim()) continue;
        range.selectNodeContents(node);
        rects.push(...range.getClientRects());
      }
      if (!rects.length) continue;
      const box = rects.reduce((acc, rect) => ({ left: Math.min(acc.left, rect.left), top: Math.min(acc.top, rect.top), right: Math.max(acc.right, rect.right), bottom: Math.max(acc.bottom, rect.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      const fill = style.webkitTextFillColor && style.webkitTextFillColor !== style.color ? style.webkitTextFillColor : style.color;
      const item = { where: lp.describe(element), size: Number.parseFloat(style.fontSize), weight: Number(style.fontWeight) || 400, fg: parse(fill), layers: [], mode: 'flat', reason: null, box: { x: box.left + scrollX, y: box.top + scrollY, w: box.right - box.left, h: box.bottom - box.top } };
      if (style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text') {
        item.mode = 'unknown';
        item.reason = 'text filled with a background';
      }
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        const own = getComputedStyle(node);
        if (own.backgroundImage !== 'none') {
          item.mode = item.mode === 'unknown' ? 'unknown' : 'pixels';
          if (running(node)) {
            item.mode = 'unknown';
            item.reason = 'animated background';
          }
          break;
        }
        const bg = parse(own.backgroundColor);
        if (bg && bg.a > 0) item.layers.push(bg);
        if (bg && bg.a >= 1) break;
        opacity *= Number(own.opacity);
        if (node === document.documentElement && !(bg && bg.a >= 1)) item.layers.push({ r: 255, g: 255, b: 255, a: 1 });
      }
      item.opacity = Number(opacity.toFixed(3)) * Number(style.opacity);
      const rect = element.getBoundingClientRect();
      for (const other of visuals) {
        if (other.element === element || other.element.contains(element) || element.contains(other.element)) continue;
        const r = other.rect;
        if (r.right <= rect.left || r.left >= rect.right || r.bottom <= rect.top || r.top >= rect.bottom) continue;
        if (other.unknown) {
          item.mode = 'unknown';
          item.reason = `${other.tag} or animation under the text`;
        } else if (item.mode !== 'unknown') item.mode = 'pixels';
      }
      items.push(item);
    }
    return items;
  });
  const pixelItems = data.filter((item) => item.mode === 'pixels');
  if (pixelItems.length) {
    const style = await run.page.addStyleTag({ content: '*, *::before, *::after, ::placeholder, ::marker { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; caret-color: transparent !important; text-decoration-color: transparent !important; }' });
    const shot = await run.page.screenshot({ fullPage: true, animations: 'disabled' });
    await style.evaluate((node) => node.remove());
    const worst = await run.page.evaluate(async ({ png, boxes }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      const lum = (r, g, b) => [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      return boxes.map(({ box, fg }) => {
        const x = Math.max(0, Math.floor(box.x) + 1);
        const y = Math.max(0, Math.floor(box.y) + 1);
        const w = Math.max(1, Math.min(bitmap.width - x, Math.floor(box.w) - 2));
        const h = Math.max(1, Math.min(bitmap.height - y, Math.floor(box.h) - 2));
        if (w < 1 || h < 1 || x >= bitmap.width || y >= bitmap.height) return null;
        const pixels = ctx.getImageData(x, y, w, h).data;
        let min = Infinity;
        let at = null;
        for (let i = 0; i < pixels.length; i += 4) {
          const bg = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
          const a = fg.a;
          const shown = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
          const l1 = lum(shown.r, shown.g, shown.b);
          const l2 = lum(bg.r, bg.g, bg.b);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < min) {
            min = ratio;
            at = bg;
          }
        }
        return { ratio: min, bg: at };
      });
    }, { png: shot.toString('base64'), boxes: pixelItems.map((item) => ({ box: item.box, fg: { ...item.fg, a: (item.fg?.a ?? 1) * item.opacity } })) });
    pixelItems.forEach((item, index) => {
      item.pixel = worst[index];
    });
  }
  let passed = 0;
  let lowest = null;
  for (const item of data) {
    if (!item.fg) continue;
    const minimum = isLargeText(item.size, item.weight) ? LIMITS.contrastLarge : LIMITS.contrast;
    if (item.mode === 'unknown') {
      report.skip('LP-CONTRAST-01', `${where}: ${item.where}`, `cannot prove: ${item.reason}`);
      continue;
    }
    let bg;
    let ratio;
    if (item.mode === 'pixels') {
      if (!item.pixel) {
        report.skip('LP-CONTRAST-01', `${where}: ${item.where}`, 'cannot prove: the text box is outside the rendered page');
        continue;
      }
      bg = { ...item.pixel.bg, a: 1 };
      ratio = item.pixel.ratio;
    } else {
      bg = item.layers.reduceRight((below, layer) => composite(layer, below), { r: 255, g: 255, b: 255, a: 1 });
      const fg = composite({ ...item.fg, a: item.fg.a * item.opacity }, bg);
      ratio = contrastRatio(fg, bg);
    }
    if (ratio + 1e-6 < minimum) {
      const suggestion = suggestColor(item.fg, bg, minimum);
      report.error('LP-CONTRAST-01', `${where}: ${item.where}`, `${ratio.toFixed(2)}:1 for ${toHex(item.fg)} on ${toHex(bg)}${item.mode === 'pixels' ? ' (worst pixel)' : ''}`, `at least ${minimum}:1${suggestion ? `; ${suggestion} passes` : ''}`);
    } else {
      passed += 1;
      if (!lowest || ratio < lowest.ratio) lowest = { ratio, where: item.where };
    }
  }
  if (passed) report.pass('LP-CONTRAST-01', where, `${passed} text boxes pass; lowest ${lowest.ratio.toFixed(2)}:1 at ${lowest.where}`, `at least ${LIMITS.contrast}:1 (${LIMITS.contrastLarge}:1 large)`);
}

const AMBIENT_SCOPE = ['[data-ambient], [data-gallery], [data-marquee], [aria-roledescription]', 'section, article, aside, figure, header, footer, main'];

async function findAmbient(page) {
  return inPage(page, (lp, { limit, scope }) => {
    const groups = new Map();
    const add = (element, kind) => {
      const root = element.closest(scope[0]) ?? element.closest(scope[1]) ?? document.body;
      if (!groups.has(root)) {
        const index = groups.size;
        root.setAttribute('data-lp-ambient', String(index));
        groups.set(root, { index, where: lp.describe(root), kinds: new Set() });
      }
      groups.get(root).kinds.add(kind);
    };
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      const timing = animation.effect?.getComputedTiming?.();
      if (!target || animation.playState !== 'running' || !timing) continue;
      const element = target.nodeType === 1 ? target : target.parentElement;
      if (!element || !lp.shown(element)) continue;
      if (timing.endTime > limit || !Number.isFinite(timing.endTime)) add(element, 'animation');
    }
    for (const [element, count] of window.__lpMutations?.late ?? []) if (count && element.isConnected) add(element, 'script');
    return [...groups.values()].map((group) => ({ ...group, kinds: [...group.kinds] }));
  }, { limit: LIMITS.ambientMs, scope: AMBIENT_SCOPE });
}

async function watchMutations(page, ms) {
  await inPage(page, (lp, scope) => {
    const start = performance.now();
    const late = new Map();
    window.__lpMutations = { late, start };
    window.__lpObserver?.disconnect();
    window.__lpObserver = new MutationObserver((records) => {
      const now = performance.now();
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!target || target.closest('button, [role="button"]') || record.attributeName === 'data-lp-ambient' || record.attributeName === 'data-revealed') continue;
        const root = target.closest(scope[0]) ?? target.closest(scope[1]) ?? document.body;
        if (now - start >= 5000) late.set(root, (late.get(root) ?? 0) + 1);
      }
    });
    window.__lpObserver.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
  }, AMBIENT_SCOPE);
  await page.clock.runFor(ms);
}

async function pauseControl(page, index) {
  return inPage(page, (lp, at) => {
    const root = document.querySelector(`[data-lp-ambient="${at}"]`);
    if (!root) return null;
    const name = (element) => (element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') || element.textContent || element.title || '').trim();
    const controls = [...document.querySelectorAll('button, [role="button"], input[type="checkbox"], input[type="button"]')].filter((element) => {
      const controlled = (element.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id));
      return root.contains(element) || controlled.some((target) => target && (root.contains(target) || target.contains(root)));
    });
    const labelled = controls.find((element) => /\b(?:pause|stop|play|resume)\b/i.test(name(element)));
    if (!labelled) return { found: false, controls: controls.length };
    labelled.setAttribute('data-lp-pause', String(at));
    return { found: true, label: name(labelled), where: lp.describe(labelled) };
  }, index);
}

async function stillMoving(page, index) {
  await page.evaluate((at) => document.querySelector(`[data-lp-pause="${at}"]`)?.click(), index);
  await page.clock.runFor(200);
  await watchMutations(page, LIMITS.watchMs);
  return inPage(page, (lp, { at, limit }) => {
    const root = document.querySelector(`[data-lp-ambient="${at}"]`);
    if (!root) return { animations: 0, mutations: 0 };
    const animations = document.getAnimations().filter((animation) => {
      const target = animation.effect?.target;
      const element = target?.nodeType === 1 ? target : target?.parentElement;
      const timing = animation.effect?.getComputedTiming?.();
      return element && root.contains(element) && animation.playState === 'running' && timing && (!Number.isFinite(timing.endTime) || timing.endTime > limit);
    }).length;
    const mutations = window.__lpMutations?.late?.get(root) ?? 0;
    return { animations, mutations };
  }, { at: index, limit: LIMITS.ambientMs });
}

async function openTall(run, url, viewport) {
  await run.page.goto(url, { waitUntil: 'load' });
  const height = await run.page.evaluate(() => document.documentElement.scrollHeight);
  await run.page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, Math.min(height, LIMITS.tallPx)) });
  await settle(run.page);
}

async function checkAmbient(report, where, browser, url, viewport) {
  const run = await newRun(browser, viewport, { clock: true });
  try {
    await openTall(run, url, viewport);
    await watchMutations(run.page, LIMITS.watchMs);
    const groups = await findAmbient(run.page);
    if (!groups.length) {
      report.pass('LP-AMB-01', where, 'nothing moves on its own past 5 s', 'a labelled pause control for motion past 5 s');
    }
    for (const group of groups) {
      const control = await pauseControl(run.page, group.index);
      if (!control?.found) {
        report.error('LP-AMB-01', `${where}: ${group.where}`, `${group.kinds.join(' and ')} running past 5 s with no labelled pause control (${control?.controls ?? 0} controls nearby)`, 'a labelled pause control that stops it');
        continue;
      }
      const after = await stillMoving(run.page, group.index);
      report.check('LP-AMB-01', !after.animations && !after.mutations, `${where}: ${group.where}`, after.animations || after.mutations ? `still moving after "${control.label}" (${after.animations} animation(s), ${after.mutations} change(s))` : `"${control.label}" stops it`, 'the pause control stops the motion');
    }
  } finally {
    await run.close();
  }
  const reduced = await newRun(browser, viewport, { clock: true, reducedMotion: 'reduce' });
  try {
    await openTall(reduced, url, viewport);
    await watchMutations(reduced.page, LIMITS.watchMs);
    const groups = await findAmbient(reduced.page);
    if (groups.length) for (const group of groups) report.error('LP-AMB-01', `${where}, reduced motion: ${group.where}`, `${group.kinds.join(' and ')} still running`, 'nothing moves on its own under reduced motion');
    else report.pass('LP-AMB-01', `${where}, reduced motion`, 'nothing moves on its own', 'still under reduced motion');
  } finally {
    await reduced.close();
  }
}

async function hasIntro(page) {
  return page.evaluate(() => Boolean(document.querySelector('[data-intro-root], [data-intro-end], video[data-intro-film]')) || Boolean(document.documentElement.dataset.intro));
}

async function introTargets(page) {
  return inPage(page, (lp) => {
    let elements = [...document.querySelectorAll('[data-intro-end]')];
    if (!elements.length) elements = lp.targets().filter((element) => element.getBoundingClientRect().top < innerHeight + scrollY);
    return elements.map((element) => ({ where: lp.describe(element), visible: lp.visible(element), opacity: Number(lp.effectiveOpacity(element).toFixed(3)) }));
  });
}

async function introEndTime(page, limitMs) {
  const deadline = Date.now() + limitMs + 2000;
  while (Date.now() < deadline) {
    const state = await inPage(page, (lp) => {
      let elements = [...document.querySelectorAll('[data-intro-end]')];
      if (!elements.length) elements = lp.targets().slice(0, 3);
      return { done: elements.length > 0 && elements.every((element) => lp.visible(element)), at: performance.now() };
    });
    if (state.done) return state.at;
    await pause(100);
  }
  return null;
}

async function checkIntro(report, where, browser, url, viewport) {
  const probe = await newRun(browser, viewport, { javaScriptEnabled: true, reducedMotion: 'reduce' });
  let present = false;
  try {
    await probe.page.goto(url, { waitUntil: 'load' });
    present = await hasIntro(probe.page);
    if (!present) {
      report.skip('LP-INTRO-01', where, 'no hero intro on this page');
      return;
    }
    await pause(300);
    const targets = await introTargets(probe.page);
    const hidden = targets.filter((target) => !target.visible);
    const films = probe.requests.filter((request) => request.type === 'media' || VIDEO_URL.test(request.url));
    report.check('LP-INTRO-01', !hidden.length && !films.length, `${where}, reduced motion`, hidden.length ? `end state not shown: ${hidden.map((target) => `${target.where} (opacity ${target.opacity})`).join('; ')}` : films.length ? `intro film requested: ${films[0].url}` : 'skipped: end state at load, no film requested', 'skipped under reduced motion');
  } finally {
    await probe.close();
  }
  let scrolled = await newRun(browser, viewport);
  try {
    await scrolled.page.goto(url, { waitUntil: 'load' });
    const height = await scrolled.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (height < 80) {
      report.skip('LP-INTRO-01', `${where}, loaded scrolled`, 'the page does not scroll');
    } else {
      const y = Math.min(height, Math.round(viewport.height / 2));
      await scrolled.page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await pause(200);
      await scrolled.page.evaluate(() => sessionStorage.clear());
      scrolled.requests.length = 0;
      await scrolled.page.reload({ waitUntil: 'domcontentloaded' });
      await pause(1200);
      let state = await scrolled.page.evaluate(() => ({ y: scrollY, intro: document.documentElement.dataset.intro ?? null }));
      if (state.y < 1) {
        const anchor = await scrolled.page.evaluate((min) => [...document.querySelectorAll('[id]')].find((element) => element.getBoundingClientRect().top + scrollY > min)?.id ?? null, viewport.height / 2);
        if (anchor) {
          const target = new URL(url);
          target.hash = anchor;
          await scrolled.close();
          scrolled = await newRun(browser, viewport);
          await scrolled.page.goto(target.href, { waitUntil: 'domcontentloaded' });
          await pause(1200);
          state = await scrolled.page.evaluate(() => ({ y: scrollY, intro: document.documentElement.dataset.intro ?? null }));
        }
      }
      if (state.y < 1) {
        report.skip('LP-INTRO-01', `${where}, loaded scrolled`, 'the browser did not restore the scroll position on reload');
      } else {
        const targets = await introTargets(scrolled.page);
        const hidden = targets.filter((target) => !target.visible);
        const films = scrolled.requests.filter((request) => request.type === 'media' || VIDEO_URL.test(request.url));
        report.check('LP-INTRO-01', !hidden.length && !films.length, `${where}, loaded at ${Math.round(state.y)}px`, hidden.length ? `end state not shown after 1.2 s: ${hidden.map((target) => target.where).join('; ')}` : films.length ? `intro film requested: ${films[0].url}` : `skipped (${state.intro ?? 'no intro state'})`, 'skipped when the page loads scrolled');
      }
    }
  } finally {
    await scrolled.close();
  }
  for (const [label, condition] of [['film blocked', { blockFilm: true }], ['play() rejected', { rejectPlay: true }]]) {
    const run = await newRun(browser, viewport, condition);
    try {
      await run.page.goto(url, { waitUntil: 'domcontentloaded' });
      const at = await introEndTime(run.page, LIMITS.introMs);
      report.check('LP-INTRO-01', at !== null && at <= LIMITS.introMs, `${where}, ${label}`, at === null ? `no end state within ${(LIMITS.introMs + 2000) / 1000} s` : `end state at ${(at / 1000).toFixed(2)} s`, `end state within ${LIMITS.introMs / 1000} s`);
    } finally {
      await run.close();
    }
  }
}

async function checkWarnings(report, where, run) {
  const data = await inPage(run.page, (lp) => {
    const lang = document.documentElement.lang || '';
    const headlines = [...document.querySelectorAll('h1, h2')].filter(lp.shown).map((element) => ({ where: lp.describe(element), text: lp.textOf(element) }));
    const ledes = [...document.querySelectorAll('[data-lede]')].filter(lp.shown).map((element) => ({ where: lp.describe(element), text: lp.textOf(element) }));
    const tiles = [...document.querySelectorAll('[data-tile]')].map((tile) => ({ where: lp.describe(tile), ctas: tile.querySelectorAll('[data-cta]').length }));
    const ms = (value) => Math.max(0, ...String(value).split(',').map((part) => (part.trim().endsWith('ms') ? Number.parseFloat(part) : Number.parseFloat(part) * 1000)).filter(Number.isFinite));
    const controls = [...document.querySelectorAll('button, a[href], [role="button"], summary, input, select')].filter(lp.shown).map((element) => ({ where: lp.describe(element), ms: ms(getComputedStyle(element).transitionDuration) })).filter((entry) => entry.ms > 0);
    const reveals = [...document.querySelectorAll('[data-reveal]')].map((element) => ({ where: lp.describe(element), ms: ms(getComputedStyle(element).transitionDuration) }));
    const pinned = [...document.querySelectorAll('body *')].filter((element) => getComputedStyle(element).position === 'sticky' && !element.matches('header, nav, [role="banner"], [role="navigation"]') && element.parentElement && element.parentElement !== document.body && element.parentElement.getBoundingClientRect().height > innerHeight * 1.5).length;
    return { lang, headlines, ledes, tiles, controls, reveals, pinned, text: document.body.innerText };
  });
  if (!NON_LATIN.test(data.lang)) {
    for (const entry of data.headlines) {
      const words = wordCount(entry.text);
      report.check('LP-WARN-COPY', words >= LIMITS.headlineWords[0] && words <= LIMITS.headlineWords[1], `${where}: ${entry.where}`, `${words} words`, `${LIMITS.headlineWords.join('-')} words`, 'warn');
    }
    for (const entry of data.ledes) {
      const words = wordCount(entry.text);
      report.check('LP-WARN-COPY', words >= LIMITS.ledeWords[0] && words <= LIMITS.ledeWords[1], `${where}: ${entry.where}`, `${words} words`, `${LIMITS.ledeWords.join('-')} words`, 'warn');
    }
  }
  for (const tile of data.tiles) report.check('LP-WARN-CTA', tile.ctas <= LIMITS.ctasPerTile, `${where}: ${tile.where}`, `${tile.ctas} calls to action`, `at most ${LIMITS.ctasPerTile}`, 'warn');
  const slow = data.controls.filter((entry) => entry.ms > LIMITS.controlMs);
  report.check('LP-WARN-CLASS', !slow.length, `${where}: controls`, slow.length ? `${slow[0].where} transitions for ${slow[0].ms} ms${slow.length > 1 ? ` (and ${slow.length - 1} more)` : ''}` : `${data.controls.length} controls at most ${LIMITS.controlMs} ms`, `controls at most ${LIMITS.controlMs} ms`, 'warn');
  const offReveal = data.reveals.filter((entry) => entry.ms > 0 && (entry.ms < LIMITS.revealMinMs || entry.ms > LIMITS.revealMaxMs));
  if (data.reveals.length) report.check('LP-WARN-CLASS', !offReveal.length, `${where}: reveals`, offReveal.length ? `${offReveal[0].where} runs ${offReveal[0].ms} ms` : `${data.reveals.length} reveals within band`, `reveals ${LIMITS.revealMinMs}-${LIMITS.revealMaxMs} ms`, 'warn');
  report.check('LP-WARN-PINS', data.pinned <= LIMITS.pinnedPieces, where, `${data.pinned} pinned set piece(s)`, `at most ${LIMITS.pinnedPieces}`, 'warn');
  const proof = PROOF.exec(data.text);
  report.check('LP-WARN-PROOF', !proof, where, proof ? `"${proof[0]}" reads as proof; is it supplied by the user?` : 'no unsupported proof found', 'no invented awards, ratings, counts or quotes; placeholders marked', 'warn');
  const hype = HYPE.exec(data.text);
  report.check('LP-WARN-HYPE', !hype, where, hype ? `"${hype[0]}"` : 'no hype words found', 'concrete claims instead of hype words', 'warn');
  const focus = [];
  await run.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  for (let step = 0; step < 8; step += 1) {
    await run.page.keyboard.press('Tab');
    const ring = await inPage(run.page, (lp) => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
      return { where: lp.describe(element), width, shadow: style.boxShadow !== 'none' };
    });
    if (ring) focus.push(ring);
  }
  const weak = focus.filter((ring) => ring.width < LIMITS.focusPx && !ring.shadow);
  if (focus.length) report.check('LP-WARN-FOCUS', !weak.length, `${where}: focus`, weak.length ? `${weak[0].where} shows a ${weak[0].width}px ring` : `${focus.length} focus stops with a visible ring`, `a ring of at least ${LIMITS.focusPx}px`, 'warn');
}

async function checkNarrow(report, browser, url) {
  const run = await newRun(browser, { width: LIMITS.narrowPx, height: 640 });
  try {
    await run.page.goto(url, { waitUntil: 'load' });
    await settle(run.page);
    const state = await inPage(run.page, (lp) => {
      const heading = document.querySelector('h1');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        heading: heading ? { where: lp.describe(heading), clipped: heading.scrollWidth > heading.clientWidth + 1 } : null,
      };
    });
    const bad = state.overflow || state.heading?.clipped;
    report.check('LP-WARN-NARROW', !bad, `${LIMITS.narrowPx}px`, bad ? `${state.heading?.clipped ? `${state.heading.where} overflows its box` : 'the page scrolls sideways'}` : 'the hero headline fits', 'the hero headline legible at the narrowest width', 'warn');
  } finally {
    await run.close();
  }
}

export async function checkPage(options, report) {
  const playwright = await loadPlaywright(options.project);
  const served = options.serve ? await startServer({ root: options.serve, mode: options.server }) : null;
  const url = served ? new URL(options.page, served.url).href : options.url;
  const browser = await launchChromium(playwright);
  try {
    for (const [index, viewport] of options.viewports.entries()) {
      const where = `${viewport.width}x${viewport.height}`;
      const first = index === 0;
      const run = await newRun(browser, viewport);
      let reference = [];
      try {
        const response = await run.page.goto(url, { waitUntil: 'load' });
        if (response && response.status() >= 400) throw new UsageError(`${url} answered ${response.status()}.`);
        await settle(run.page);
        if (first && wanted(options, 'LP-FONT-01')) await checkFonts(report, where, run);
        if (wanted(options, 'LP-TYPE-01')) await checkType(report, where, run, options.tokens);
        await waitIntro(run.page);
        if (first && wanted(options, 'LP-REVEAL-01')) await checkReveal(report, where, run, viewport);
        else await scrollThrough(run.page, viewport, { down: true, wait: 60 });
        await pause(1200);
        reference = await targetState(run.page);
        if (wanted(options, 'LP-CONTRAST-01')) await checkContrast(report, where, run);
        if (first && warningsWanted(options)) await checkWarnings(report, where, run);
      } finally {
        await run.close();
      }
      if (wanted(options, 'LP-BASE-01')) {
        for (const [label, condition] of [['no script', { javaScriptEnabled: false }], ['reduced motion', { reducedMotion: 'reduce' }]]) {
          const base = await newRun(browser, viewport, condition);
          try {
            await base.page.goto(url, { waitUntil: 'load' });
            await settle(base.page, 400);
            await checkBaseline(report, where, base, reference, label);
          } finally {
            await base.close();
          }
        }
      }
      if (first && wanted(options, 'LP-AMB-01')) await checkAmbient(report, where, browser, url, viewport);
      if (first && wanted(options, 'LP-INTRO-01')) await checkIntro(report, where, browser, url, viewport);
    }
    if (warningsWanted(options)) await checkNarrow(report, browser, url);
  } finally {
    await browser.close();
    await served?.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.serve && !fs.existsSync(options.serve)) throw new UsageError(`${options.serve} does not exist.`);
  const report = createReport({ tool: 'check-page', boundary: BOUNDARY });
  await checkPage(options, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
