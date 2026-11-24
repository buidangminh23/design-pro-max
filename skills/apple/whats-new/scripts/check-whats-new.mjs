/**
 * whats-new popup check: opens a page in headless Chromium (or WebKit) with Playwright from the user's project and
 * checks its "What's New" popup: modality and focus, page controls, card size, media, reduced motion, targets,
 * contrast and the once-per-version rule.
 *
 *   node check-whats-new.mjs --url <page url> [options]
 *   node check-whats-new.mjs --serve <folder> [--page <path>] [--server range|200] [options]
 *   node check-whats-new.mjs --page <file> [options]
 *
 * Options: --open <css> (click this trigger first; otherwise the popup must open on load after an update),
 * --version <app version>, --storage-key <localStorage key> (default whats-new:last-seen), --viewport WxH
 * (repeatable; default 1280x900), --browser chromium|webkit, --only <rule>[,<rule>], selector overrides --dialog,
 * --card, --close, --prev, --next, --primary, --dot, --pages, --media, --pause, --desc, and --project <folder with
 * Playwright> (default: the current folder). Output follows the shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { INSTALL_HINT, launchChromium, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { currentCommand, rethrowSandbox } from '../../shared/sandbox.mjs';
import { MODES, startServer } from '../../shared/server.mjs';

export const ERROR_RULES = Object.freeze(['WN-DIALOG-01', 'WN-NAV-01', 'WN-LAYOUT-01', 'WN-MEDIA-01', 'WN-MOTION-01', 'WN-TARGET-01', 'WN-ONCE-01']);
export const WARN_RULES = Object.freeze(['WN-WARN-COUNT', 'WN-WARN-AUTOADVANCE', 'WN-WARN-TARGET44', 'WN-WARN-CONTRAST', 'WN-WARN-TEXT']);
export const RULES = Object.freeze([...ERROR_RULES, ...WARN_RULES]);

export const LIMITS = Object.freeze({
  minTargetPx: 24,
  appleTargetPx: 44,
  sizeTolerancePx: 1,
  ratioTolerance: 0.01,
  maxPages: 5,
  pauseAfterSeconds: 5,
  maxLines: 3,
  textContrast: 4.5,
  largeTextContrast: 3,
  openMs: 6000,
  settleMs: 1500,
  stepMs: 450,
  playMs: 900,
  metadataMs: 3000,
  watchAdvanceMs: 8000,
  watchPollMs: 200,
  onceOpenMs: 3000,
  rewoundSeconds: 0.05,
  watchMotionMs: 400,
});

export const OLDER_VERSION = '0.0.0-wn-check';
export const DEFAULT_VIEWPORTS = Object.freeze([{ width: 1280, height: 900 }]);
export const DEFAULT_SELECTORS = Object.freeze({
  dialog: 'dialog:modal, [role="dialog"][aria-modal="true"]',
  card: '.wn-card',
  close: '.wn-close',
  prev: '.wn-prev',
  next: '.wn-next',
  primary: '.wn-primary',
  dot: '.wn-dot',
  pages: '.wn-page, [aria-roledescription="slide"]',
  media: '.wn-media',
  pause: '.wn-pause',
  desc: '.wn-desc',
});

export const BOUNDARY =
  "Proof boundary: Playwright's headless Chromium or WebKit at the given viewports proves the popup's DOM, focus, " +
  'page controls, measured sizes, contrast of solid colours, video playback state under normal and reduced motion and ' +
  'what localStorage holds; it does not prove VoiceOver output, a device, WKWebView inside a Tauri or Capacitor shell, ' +
  'SwiftUI code, hit areas grown by pseudo-elements, text over images, or taste.';

const SELECTOR_FLAGS = Object.keys(DEFAULT_SELECTORS);
const USAGE =
  'Usage: node check-whats-new.mjs (--url <url> | --serve <folder> [--page <path>] [--server range|200] | --page <file>) ' +
  '[--open <css>] [--version <v>] [--storage-key <key>] [--viewport WxH] [--browser chromium|webkit] [--only <rules>] ' +
  `[${SELECTOR_FLAGS.map((flag) => `--${flag} <css>`).join('] [')}] [--project <folder>]`;
const WEBKIT_HINT = INSTALL_HINT.replace('chromium-headless-shell', 'webkit');

function parseViewport(value) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(value));
  if (!match) throw new UsageError(`--viewport needs WIDTHxHEIGHT, got ${value}.`, USAGE);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseArgs(argv) {
  const options = {
    url: null,
    serve: null,
    page: null,
    server: 'range',
    open: null,
    version: null,
    storageKey: 'whats-new:last-seen',
    viewports: [],
    browser: 'chromium',
    only: null,
    selectors: { ...DEFAULT_SELECTORS },
    custom: {},
    project: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    const flag = arg.startsWith('--') ? arg.slice(2) : null;
    if (arg === '--url') options.url = value();
    else if (arg === '--serve') options.serve = value();
    else if (arg === '--page') options.page = value();
    else if (arg === '--server') options.server = value();
    else if (arg === '--open') options.open = value();
    else if (arg === '--version') options.version = value();
    else if (arg === '--storage-key') options.storageKey = value();
    else if (arg === '--viewport') options.viewports.push(parseViewport(value()));
    else if (arg === '--browser') options.browser = value();
    else if (arg === '--only') options.only = value().split(',').map((rule) => rule.trim()).filter(Boolean);
    else if (arg === '--project') options.project = value();
    else if (flag && SELECTOR_FLAGS.includes(flag)) {
      options.selectors[flag] = value();
      options.custom[flag] = true;
    } else throw new UsageError(`Unknown argument ${arg}.`, USAGE);
  }
  if (!options.url && !options.serve && options.page) {
    options.serve = path.dirname(path.resolve(options.page));
    options.page = path.basename(options.page);
  }
  if (!options.url === !options.serve) throw new UsageError('Give exactly one of --url, --serve or --page.', USAGE);
  if (options.url && options.page) throw new UsageError('--page goes with --serve, not with --url.', USAGE);
  if (!options.page) options.page = 'index.html';
  if (!MODES.includes(options.server)) throw new UsageError(`--server must be one of ${MODES.join(', ')}.`, USAGE);
  if (!['chromium', 'webkit'].includes(options.browser)) throw new UsageError('--browser must be chromium or webkit.', USAGE);
  const unknown = (options.only ?? []).filter((rule) => !RULES.includes(rule));
  if (unknown.length) throw new UsageError(`--only names unknown rules: ${unknown.join(', ')}.`, `Rules: ${RULES.join(', ')}`);
  if (!options.viewports.length) options.viewports = DEFAULT_VIEWPORTS.map((viewport) => ({ ...viewport }));
  return options;
}

export function spread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

export function sameSize(boxes, tolerance = LIMITS.sizeTolerancePx) {
  const valid = boxes.filter(Boolean);
  return valid.length > 0 && spread(valid.map((box) => box.width)) <= tolerance && spread(valid.map((box) => box.height)) <= tolerance;
}

export function sameRatio(boxes, tolerance = LIMITS.ratioTolerance) {
  const ratios = boxes.filter((box) => box && box.height > 0).map((box) => box.width / box.height);
  if (!ratios.length) return true;
  return spread(ratios) / Math.min(...ratios) <= tolerance;
}

export function exposesPosition(text, n, m) {
  return new RegExp(`(?:^|\\D)${n}\\D+${m}(?:\\D|$)`).test(String(text ?? ''));
}

export function showsCounter(text, n, m) {
  return new RegExp(`(?:^|[^\\d.,])${n}(?:\\s*/\\s*|\\s+\\p{L}{1,5}\\s+)${m}(?!\\d|[.,]\\d)`, 'u').test(String(text ?? ''));
}

export function rewound(video, limit = LIMITS.rewoundSeconds) {
  return !(video.readyState >= 1) || !Number.isFinite(video.currentTime) || video.currentTime <= limit;
}

export function needsPause({ loop, duration }, limit = LIMITS.pauseAfterSeconds) {
  return Boolean(loop) && Number.isFinite(duration) && duration > limit;
}

export function targetLevel(box, min = LIMITS.minTargetPx, apple = LIMITS.appleTargetPx) {
  if (!box) return 'missing';
  if (box.width < min || box.height < min) return 'small';
  if (box.width < apple || box.height < apple) return 'below44';
  return 'ok';
}

export function parseColor(value) {
  const text = String(value ?? '').trim();
  let match = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map((part) => (part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part)));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  match = /^color\(srgb\s+([^)]+)\)$/i.exec(text);
  if (match) {
    const parts = match[1].split(/[\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0] * 255, g: parts[1] * 255, b: parts[2] * 255, a: parts.length > 3 ? parts[3] : 1 };
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

export function contrastRatio(foreground, background) {
  const [high, low] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export function largeText(fontSizePx, fontWeight) {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && Number(fontWeight) >= 700);
}

const round = (value, digits = 1) => Number(value.toFixed(digits));
const size = (box) => (box ? `${round(box.width)}x${round(box.height)} px` : 'not found');

export function installProbe() {
  if (window.__wnCheck) return;
  const playing = [];
  document.addEventListener('playing', (event) => playing.push(event.target), true);
  const focused = [];
  document.addEventListener('focusin', (event) => focused.push(event.target), true);
  const writes = [];
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItemWatched(key, value) {
    if (this === window.localStorage) writes.push({ key: String(key), value: String(value), at: performance.now() });
    return setItem.call(this, key, value);
  };
  const NAMES = {
    close: /^(?:close|dismiss|đóng)\b/i,
    prev: /\b(?:previous|prev|back)\b|trước/i,
    next: /\bnext (?:feature|page|slide|item)\b|\bforward\b|tính năng sau|trang sau/i,
    primary: /^(?:got it|done|continue|next|ok|hiểu rồi|tiếp|xong)$/i,
    pause: /\b(?:pause|play|stop|start)\b|tạm dừng|phát|dừng/i,
    halt: /\b(?:stop|pause)\b.*\b(?:advanc\w*|rotat\w*|slides?|pages?|carousel|auto\w*)\b|dừng tự chuyển|dừng chuyển trang/i,
  };
  const all = (root, selector) => {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      return [];
    }
  };
  const shown = (element) => {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    if (typeof element.checkVisibility === 'function') return element.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const textOf = (element) => String(element?.innerText ?? element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (element) => {
    if (!element) return '';
    const labelledby = element.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby.split(/\s+/).map((id) => textOf(document.getElementById(id))).filter(Boolean).join(' ');
      if (text) return text;
    }
    const label = element.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    if (element.localName === 'img') return element.getAttribute('alt') ?? '';
    return textOf(element) || (element.getAttribute('title') ?? '').trim();
  };
  const box = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const describe = (element) => {
    if (!element) return null;
    const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    return `${element.localName}${element.id ? `#${element.id}` : ''}${classes.map((name) => `.${name}`).join('')}`;
  };
  const findDialog = (selectors) => all(document, selectors.dialog).find(shown) ?? null;
  const pagesOf = (dialog, selectors) => (dialog ? all(dialog, selectors.pages).filter((page) => !page.parentElement?.closest(selectors.pages)) : []);
  const currentIndex = (pages) => {
    if (!pages.length) return 0;
    const live = pages.map((page, index) => ({ page, index })).filter(({ page }) => shown(page) && !page.closest('[inert]') && page.getAttribute('aria-hidden') !== 'true');
    if (live.length === 1) return live[0].index;
    const marked = pages.findIndex((page) => page.hasAttribute('data-current') || page.getAttribute('aria-current') === 'true');
    return marked >= 0 ? marked : live.length ? live[0].index : -1;
  };
  const control = (dialog, selector, pattern, custom, useText) => {
    let found = all(dialog, selector);
    if (!found.length && !custom) found = all(dialog, 'button, [role="button"]').filter((button) => pattern.test(useText ? textOf(button) : button.getAttribute('aria-label') ?? textOf(button)));
    return found.find(shown) ?? found[0] ?? null;
  };
  const controlState = (element) => element ? {
    present: true,
    visible: shown(element),
    name: nameOf(element),
    box: box(element),
    disabled: element.disabled === true || element.getAttribute('aria-disabled') === 'true',
    tag: describe(element),
  } : { present: false, visible: false, name: '', box: null, disabled: false, tag: null };
  const mark = (element, role) => {
    for (const old of all(document, `[data-wn-check="${role}"]`)) old.removeAttribute('data-wn-check');
    element?.setAttribute('data-wn-check', role);
  };
  const resolve = (selectors, custom = {}) => {
    const dialog = findDialog(selectors);
    const pages = pagesOf(dialog, selectors);
    const index = currentIndex(pages);
    const current = pages[index] ?? dialog;
    const controls = {
      close: control(dialog, selectors.close, NAMES.close, custom.close, false),
      prev: control(dialog, selectors.prev, NAMES.prev, custom.prev, false),
      next: control(dialog, selectors.next, NAMES.next, custom.next, false),
      primary: control(dialog, selectors.primary, NAMES.primary, custom.primary, true),
    };
    if (dialog) {
      mark(dialog, 'dialog');
      for (const [role, element] of Object.entries(controls)) mark(element, role);
    }
    const dots = dialog ? all(dialog, selectors.dot) : [];
    dots.forEach((dot, at) => dot.setAttribute('data-wn-dot', String(at)));
    return { dialog, pages, index, current, controls, dots };
  };
  const mediaFrame = (current, selectors) => {
    if (!current) return null;
    const frame = all(current, selectors.media).find(shown);
    if (frame) return frame;
    return all(current, 'video, img, picture, canvas, [role="img"]').find(shown) ?? null;
  };
  const videoState = (video, pages) => ({
    page: pages.findIndex((page) => page.contains(video)),
    src: String(video.currentSrc || video.getAttribute('src') || '').split('/').pop(),
    muted: video.muted === true,
    mutedAttribute: video.hasAttribute('muted'),
    playsInline: video.playsInline === true || video.hasAttribute('playsinline') || video.hasAttribute('webkit-playsinline'),
    poster: Boolean(video.getAttribute('poster')),
    paused: video.paused,
    ended: video.ended,
    loop: video.loop,
    duration: video.duration,
    readyState: video.readyState,
    currentTime: video.currentTime,
  });
  const pauseControl = (video, page, selectors) => {
    const scope = page ?? video.parentElement;
    const candidates = [...all(scope, selectors.pause), ...all(scope, 'button, [role="button"]').filter((button) => NAMES.pause.test(nameOf(button)))];
    const visible = candidates.filter((button) => shown(button) && nameOf(button));
    return visible.length ? { name: nameOf(visible[0]), tag: describe(visible[0]) } : null;
  };
  const backgroundOf = (element) => {
    const layers = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none') return null;
      layers.push(style.backgroundColor);
      if (/^rgb\(/.test(style.backgroundColor)) break;
    }
    return layers;
  };
  const textElements = (root) => {
    if (!root) return [];
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !node.textContent.trim() || found.includes(element)) continue;
      if (element.closest('[inert]') || !shown(element)) continue;
      found.push(element);
    }
    return found;
  };
  const textSamples = (dialog, current) => {
    const roots = [current, ...all(dialog, 'button, a[href]').filter((node) => !current?.contains(node))];
    const samples = [];
    for (const root of roots) {
      for (const element of textElements(root)) {
        if (samples.some((sample) => sample.element === element)) continue;
        const style = getComputedStyle(element);
        samples.push({
          element,
          tag: describe(element),
          text: textOf(element).slice(0, 40),
          color: style.color,
          layers: backgroundOf(element),
          fontSize: parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
        });
      }
    }
    return samples.map(({ element, ...rest }) => rest);
  };
  const descLines = (current, selectors) => {
    if (!current) return null;
    let element = all(current, selectors.desc).find(shown);
    if (!element) element = all(current, 'p').filter(shown).sort((a, b) => textOf(b).length - textOf(a).length)[0];
    if (!element) return null;
    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = style.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(style.lineHeight);
    const height = element.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    return { tag: describe(element), lines: lineHeight > 0 ? height / lineHeight : 0 };
  };
  const counterText = (dialog, current) => {
    const labels = [];
    if (current && current !== dialog) labels.push(current.getAttribute('aria-label') ?? '');
    for (const dot of all(dialog, '[aria-current="true"], [aria-selected="true"]')) labels.push(nameOf(dot));
    for (const counter of all(dialog, '[class*="counter" i], [class*="page-count" i], [class*="pagecount" i]').filter(shown)) labels.push(textOf(counter));
    return labels.join(' | ');
  };
  const insidePopup = (element, selectors) => {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return true;
    try {
      return Boolean(element.closest(selectors.dialog));
    } catch {
      return false;
    }
  };
  const outsideBefore = (selectors) => [...focused].reverse().find((element) => !insidePopup(element, selectors)) ?? null;
  window.__wnCheck = {
    playing,
    state(selectors, custom) {
      const { dialog, pages, index, current, controls, dots } = resolve(selectors, custom);
      if (!dialog) return { open: false };
      let modal = false;
      try {
        modal = dialog.matches(':modal');
      } catch {
        modal = false;
      }
      const active = document.activeElement;
      const card = all(dialog, selectors.card).find(shown) ?? dialog;
      const videos = all(dialog, 'video');
      return {
        open: true,
        tag: describe(dialog),
        modal,
        role: dialog.getAttribute('role') ?? (dialog.localName === 'dialog' ? 'dialog' : null),
        ariaModal: dialog.getAttribute('aria-modal'),
        nativeDialog: dialog.localName === 'dialog',
        name: nameOf(dialog),
        activeInside: Boolean(active && active !== document.body && dialog.contains(active)),
        active: describe(active),
        count: pages.length || 1,
        index,
        pageLabels: pages.map((page) => page.getAttribute('aria-label') ?? ''),
        counter: counterText(dialog, current),
        visibleText: textOf(dialog),
        close: controlState(controls.close),
        prev: controlState(controls.prev),
        next: controlState(controls.next),
        primary: controlState(controls.primary),
        dots: dots.map((dot) => ({ ...controlState(dot), current: dot.getAttribute('aria-current') === 'true' })),
        card: box(card),
        media: box(mediaFrame(current, selectors)),
        videos: videos.map((video) => ({ ...videoState(video, pages), pause: pauseControl(video, pages.find((page) => page.contains(video)), selectors) })),
        playedOnOwn: playing.filter((video) => dialog.contains(video)).length,
        text: textSamples(dialog, current),
        desc: descLines(current, selectors),
        page: current && current !== dialog ? describe(current) : null,
      };
    },
    closedState(selectors) {
      const active = document.activeElement;
      const onBody = !active || active === document.body || active === document.documentElement;
      const before = outsideBefore(selectors);
      return {
        open: Boolean(findDialog(selectors)),
        active: describe(active),
        before: before && before !== document.body ? describe(before) : null,
        onOpener: Boolean(active && active.hasAttribute('data-wn-opener')),
        onBody,
        onBefore: before && before !== document.body && before.isConnected ? active === before : onBody,
      };
    },
    halt(selectors, custom) {
      const { dialog, pages } = resolve(selectors, custom);
      if (!dialog) return { halted: null };
      const control = all(dialog, 'button, [role="button"]').find((button) => shown(button) && !pages.some((page) => page.contains(button)) && NAMES.halt.test(nameOf(button)));
      if (control) {
        const name = nameOf(control);
        control.click();
        return { halted: `pressed "${name}"` };
      }
      const target = ['primary', 'next'].map((role) => all(dialog, `[data-wn-check="${role}"]`).find(shown)).find(Boolean);
      target?.focus();
      return { halted: target ? 'moved focus into the popup' : null };
    },
    writes(key, reset) {
      const found = writes.filter((write) => write.key === key);
      if (reset) writes.length = 0;
      return found;
    },
    async watchMotion(selectors, custom, ms) {
      const { dialog, pages, controls } = resolve(selectors, custom);
      const button = controls.next ?? controls.primary;
      if (!dialog || pages.length < 2 || !button) return { watched: false };
      const moving = new Set();
      const values = new Map();
      const transformish = /^(?:transform|translate|rotate|scale|all)$/;
      const ancestors = [];
      for (let node = pages[0].parentElement; node && node !== dialog && dialog.contains(node); node = node.parentElement) ancestors.push(node);
      const watched = [...ancestors.map((node) => ({ node, label: describe(node) })), ...pages.flatMap((page, at) => [page, ...page.querySelectorAll('*')].map((node) => ({ node, label: `page ${at + 1}${node === page ? '' : ` ${describe(node)}`}` })))];
      const origin = () => dialog.getBoundingClientRect();
      const note = (key, value) => {
        if (!values.has(key)) values.set(key, new Set());
        values.get(key).add(value);
      };
      const sample = () => {
        const base = origin();
        for (const { node, label } of watched) {
          const style = getComputedStyle(node);
          note(`${label}: transform`, `${style.transform}|${style.translate}|${style.rotate}|${style.scale}`);
        }
        for (const [at, page] of pages.entries()) {
          const rect = page.getBoundingClientRect();
          note(`page ${at + 1}: position`, `${Math.round((rect.x - base.x) * 2) / 2},${Math.round((rect.y - base.y) * 2) / 2}`);
        }
        const roots = ancestors.length ? [ancestors[0]] : pages;
        const animations = [...roots.flatMap((root) => root.getAnimations?.({ subtree: true }) ?? []), ...ancestors.slice(1).flatMap((node) => node.getAnimations?.() ?? [])];
        for (const animation of animations) {
          const timing = animation.effect?.getComputedTiming?.() ?? {};
          if (!(Number(timing.duration) > 0) || animation.playState !== 'running') continue;
          const target = animation.effect?.target;
          const label = target ? describe(target) : 'an element';
          if (animation.transitionProperty && transformish.test(animation.transitionProperty)) moving.add(`${label}: ${animation.transitionProperty} transition of ${Math.round(timing.duration)} ms`);
          const frames = animation.effect?.getKeyframes?.() ?? [];
          if (!animation.transitionProperty && frames.some((frame) => 'transform' in frame || 'translate' in frame)) moving.add(`${label}: transform animation of ${Math.round(timing.duration)} ms`);
        }
      };
      sample();
      button.click();
      const started = performance.now();
      while (performance.now() - started < ms) {
        await new Promise((done) => requestAnimationFrame(done));
        sample();
      }
      for (const [key, seen] of values) if (seen.size > 1) moving.add(`${key} took ${seen.size} values, ${[...seen][0]} to ${[...seen].at(-1)}`);
      return { watched: true, moving: [...moving] };
    },
    storage(key, value) {
      if (value !== undefined) localStorage.setItem(key, value);
      return localStorage.getItem(key);
    },
  };
}

function textFindings(state) {
  const low = [];
  for (const sample of state.text) {
    if (!sample.layers) continue;
    const layers = sample.layers.map(parseColor);
    const foreground = parseColor(sample.color);
    if (!foreground || layers.some((layer) => !layer)) continue;
    let background = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of [...layers].reverse()) background = composite(layer, background);
    const text = composite(foreground, background);
    const ratio = contrastRatio(text, background);
    const needed = largeText(sample.fontSize, sample.fontWeight) ? LIMITS.largeTextContrast : LIMITS.textContrast;
    if (ratio < needed) low.push(`${sample.tag} "${sample.text}" ${ratio.toFixed(2)}:1 (needs ${needed}:1)`);
  }
  return low;
}

async function launch(playwright, options) {
  if (options.browser === 'chromium') return launchChromium(playwright);
  try {
    return await playwright.webkit.launch({ headless: true });
  } catch (error) {
    if (/Executable doesn't exist|please run.*playwright install|browserType\.launch: .*not found/i.test(String(error?.message))) {
      throw new UsageError('Playwright is installed but its WebKit browser is not.', WEBKIT_HINT);
    }
    return rethrowSandbox(error, currentCommand());
  }
}

async function visit(page, url) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  } catch (error) {
    throw new UsageError(`Could not load ${url}: ${String(error?.message ?? error).split('\n')[0]}`, 'Check that the page exists and the server is running.');
  }
}

async function newRun(browser, viewport, options, { reducedMotion = 'no-preference', colorScheme = 'light', seed } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion, colorScheme });
  await context.addInitScript(installProbe);
  if (seed !== undefined) {
    await context.addInitScript(({ key, value }) => {
      try {
        if (!sessionStorage.getItem('wn-check-seeded')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('wn-check-seeded', '1');
        }
      } catch {
        return undefined;
      }
      return undefined;
    }, { key: options.storageKey, value: seed });
  }
  const page = await context.newPage();
  return { context, page };
}

const state = (page, options) => page.evaluate(({ selectors, custom }) => window.__wnCheck.state(selectors, custom), { selectors: options.selectors, custom: options.custom });
const closedState = (page, options) => page.evaluate((selectors) => window.__wnCheck.closedState(selectors), options.selectors);

async function waitOpen(page, options, timeout = LIMITS.openMs) {
  try {
    await page.waitForFunction(({ selectors, custom }) => window.__wnCheck?.state(selectors, custom).open, { selectors: options.selectors, custom: options.custom }, { timeout, polling: 100 });
    await page.waitForTimeout(LIMITS.stepMs);
    return true;
  } catch {
    return false;
  }
}

async function waitClosed(page, options, timeout = 1500) {
  try {
    await page.waitForFunction((selectors) => !window.__wnCheck.closedState(selectors).open, options.selectors, { timeout, polling: 100 });
    return true;
  } catch {
    return false;
  }
}

async function openPopup(page, url, options) {
  await visit(page, url);
  if (options.open) {
    const trigger = page.locator(options.open).first();
    try {
      await trigger.waitFor({ state: 'visible', timeout: LIMITS.openMs });
    } catch {
      throw new UsageError(`--open ${options.open} matched no visible element on ${url}.`, USAGE);
    }
    await trigger.evaluate((element) => element.setAttribute('data-wn-opener', ''));
    await trigger.focus();
    await trigger.click();
  }
  return waitOpen(page, options);
}

async function click(page, role, { force = false } = {}) {
  const locator = page.locator(role.startsWith('dot:') ? `[data-wn-dot="${role.slice(4)}"]` : `[data-wn-check="${role}"]`).first();
  try {
    await locator.click({ force, timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function settle(page) {
  await page.waitForTimeout(LIMITS.stepMs);
}

async function waitMetadata(page, options) {
  try {
    await page.waitForFunction((selectors) => [...(document.querySelector('[data-wn-check="dialog"]')?.querySelectorAll('video') ?? [])].every((video) => video.readyState >= 1 || video.error), options.selectors, { timeout: LIMITS.metadataMs, polling: 100 });
  } catch {
    return undefined;
  }
  return undefined;
}

function controlWhere(label, name, control) {
  return `${label}: ${name}${control?.tag ? ` (${control.tag})` : ''}`;
}

function checkDialogStatic(report, label, snapshot) {
  const modal = snapshot.modal || (snapshot.role === 'dialog' && snapshot.ariaModal === 'true');
  report.check('WN-DIALOG-01', modal, `${label}: ${snapshot.tag}`, modal ? (snapshot.modal ? 'a dialog opened with showModal (:modal)' : 'role dialog with aria-modal true') : `role ${snapshot.role ?? 'none'}, aria-modal ${snapshot.ariaModal ?? 'absent'}, not :modal`, 'a <dialog> opened with showModal() or role dialog with aria-modal true');
  report.check('WN-DIALOG-01', Boolean(snapshot.name), `${label}: dialog name`, snapshot.name ? `"${snapshot.name}"` : 'no accessible name', 'an accessible name from aria-labelledby or aria-label');
  const close = snapshot.close;
  const closeOk = close.present && close.visible && Boolean(close.name);
  report.check('WN-DIALOG-01', closeOk, controlWhere(label, 'close control', close), close.present ? `${close.visible ? 'visible' : 'not visible'}, name ${close.name ? `"${close.name}"` : 'empty'}` : 'no close control found', 'a visible close control with an accessible name');
  report.check('WN-DIALOG-01', snapshot.activeInside, `${label}: focus on open`, `focus on ${snapshot.active ?? 'nothing'}`, 'focus inside the popup when it opens');
}

function checkTargets(report, label, snapshot, page) {
  for (const name of ['close', 'prev', 'next', 'primary']) {
    const control = snapshot[name];
    if (!control.present || !control.visible) continue;
    const level = targetLevel(control.box);
    report.check('WN-TARGET-01', level !== 'small', controlWhere(label, name, control), size(control.box), `at least ${LIMITS.minTargetPx}x${LIMITS.minTargetPx} CSS px`);
    report.check('WN-WARN-TARGET44', level === 'ok', controlWhere(label, name, control), size(control.box), `${LIMITS.appleTargetPx}x${LIMITS.appleTargetPx} or larger`, 'warn');
  }
  if (page === 0) {
    snapshot.dots.forEach((dot, at) => {
      const ok = targetLevel(dot.box) !== 'small';
      report.check('WN-TARGET-01', ok, controlWhere(label, `dot ${at + 1}`, dot), size(dot.box), `a hit area of at least ${LIMITS.minTargetPx}x${LIMITS.minTargetPx} CSS px`);
    });
  }
}

function checkVideos(report, label, snapshot, seen) {
  for (const [at, video] of snapshot.videos.entries()) {
    const where = `${label}: video ${at + 1}${video.src ? ` ${video.src}` : ''} (page ${video.page + 1})`;
    if (!seen.has(at)) {
      seen.add(at);
      const problems = [!video.muted && 'not muted', !video.playsInline && 'no playsinline', !video.poster && 'no poster'].filter(Boolean);
      report.check('WN-MEDIA-01', !problems.length, where, problems.length ? problems.join(', ') : 'muted, playsinline, poster', 'muted, inline (playsinline) and a poster');
    }
    const playing = !video.paused && !video.ended;
    if (video.page !== snapshot.index && video.page >= 0) {
      report.check('WN-MEDIA-01', !playing, `${where}, page ${snapshot.index + 1} shown`, playing ? 'plays while its page is hidden' : 'paused while its page is hidden', 'only the current page plays its video');
      if (!playing) report.check('WN-MEDIA-01', rewound(video), `${where}, page ${snapshot.index + 1} shown: position`, `at ${round(Number(video.currentTime) || 0, 2)} s`, `rewound to the start (at most ${LIMITS.rewoundSeconds} s) while its page is hidden`);
    } else if (needsPause(video)) {
      report.check('WN-MEDIA-01', Boolean(video.pause), `${where}, pause control`, video.pause ? `"${video.pause.name}" (${video.pause.tag})` : `a ${round(video.duration)} s loop with no visible labelled pause control`, `a pause control with an accessible name for a loop over ${LIMITS.pauseAfterSeconds} s`);
    }
  }
}

function checkPage(report, label, snapshot, context) {
  const where = `${label}, page ${snapshot.index + 1} of ${snapshot.count}`;
  context.cards.push(snapshot.card);
  context.media.push(snapshot.media);
  checkTargets(report, where, snapshot, snapshot.index);
  checkVideos(report, where, snapshot, context.videosSeen);
  const low = textFindings(snapshot);
  report.check('WN-WARN-CONTRAST', !low.length, `${where}, ${context.scheme}`, low.length ? low.join('; ') : `${snapshot.text.length} text element(s) at ${LIMITS.textContrast}:1 or more`, `${LIMITS.textContrast}:1 for text, ${LIMITS.largeTextContrast}:1 for large text`, 'warn');
  if (snapshot.desc) {
    const lines = Math.round(snapshot.desc.lines * 10) / 10;
    report.check('WN-WARN-TEXT', lines <= LIMITS.maxLines + 0.4, `${where}: ${snapshot.desc.tag}`, `${lines} lines`, `${LIMITS.maxLines} lines or fewer`, 'warn');
  }
}

async function watchAdvance(report, label, page, options, snapshot) {
  if (snapshot.count < 2) {
    report.pass('WN-WARN-AUTOADVANCE', label, 'one page', 'pages change only when asked');
    return;
  }
  const before = snapshot.index;
  await page.mouse.move(0, 0);
  const started = Date.now();
  let after = snapshot;
  while (Date.now() - started < LIMITS.watchAdvanceMs && after.index === before) {
    await page.waitForTimeout(LIMITS.watchPollMs);
    after = await state(page, options);
  }
  const seconds = round((Date.now() - started) / 1000);
  report.check('WN-WARN-AUTOADVANCE', after.index === before, label, after.index === before ? `stayed on page ${before + 1} for ${LIMITS.watchAdvanceMs / 1000} s` : `moved from page ${before + 1} to page ${after.index + 1} on its own after ${seconds} s`, 'no auto-advance; if pages advance on a timer, a pause control first in the tab order', 'warn');
}

async function haltAdvance(page, options) {
  await page.evaluate(({ selectors, custom }) => window.__wnCheck.halt(selectors, custom), { selectors: options.selectors, custom: options.custom });
  await settle(page);
}

async function walkPages(report, label, page, options, first, context) {
  let snapshot = first;
  const count = snapshot.count;
  if (count > 1 && snapshot.index !== 0) {
    if (snapshot.dots.length) await click(page, 'dot:0');
    for (let guard = 0; guard < count && (await state(page, options)).index > 0; guard += 1) await click(page, 'prev', { force: true });
    await settle(page);
    snapshot = await state(page, options);
  }
  await page.waitForTimeout(LIMITS.playMs);
  await waitMetadata(page, options);
  snapshot = await state(page, options);
  checkPage(report, label, snapshot, context);
  const visited = [snapshot.index];
  for (let step = 1; step < count; step += 1) {
    const moved = await click(page, 'next');
    await settle(page);
    await page.waitForTimeout(LIMITS.playMs - LIMITS.stepMs);
    snapshot = await state(page, options);
    if (!moved && context.nav) context.nav.push(`next could not be pressed on page ${step}`);
    visited.push(snapshot.index);
    checkPage(report, label, snapshot, context);
  }
  return { snapshot, visited };
}

async function checkNavigation(report, label, page, options, first, walk) {
  const count = first.count;
  const named = (control) => control.present && control.visible && Boolean(control.name);
  if (count < 2) {
    const extra = ['prev', 'next'].filter((name) => first[name].present && first[name].visible).concat(first.dots.some((dot) => dot.visible) ? ['dots'] : []);
    const counter = exposesPosition(first.counter, 1, 1) || showsCounter(first.visibleText, 1, 1);
    report.check('WN-NAV-01', !extra.length && !counter, `${label}: one feature`, extra.length || counter ? `shows ${[...extra, counter ? 'a 1 of 1 counter' : null].filter(Boolean).join(', ')}` : 'no arrows, dots or counter', 'one feature shows no arrows, dots or page counter');
  } else {
    report.check('WN-NAV-01', named(first.prev) && named(first.next), `${label}: arrows`, `previous ${first.prev.present ? `"${first.prev.name}"` : 'missing'}, next ${first.next.present ? `"${first.next.name}"` : 'missing'}`, 'visible previous and next buttons with accessible names');
    const indicator = exposesPosition(first.counter, first.index + 1, count) || showsCounter(first.visibleText, first.index + 1, count);
    report.check('WN-NAV-01', indicator, `${label}: page indicator`, indicator ? `exposes ${first.index + 1} of ${count}` : `no "${first.index + 1} of ${count}" in the slide label, the current dot or the text`, 'a page indicator that exposes N of M');
    const expected = Array.from({ length: count }, (_, at) => at);
    report.check('WN-NAV-01', walk.visited.join(',') === expected.join(','), `${label}: next`, `pages ${walk.visited.map((at) => at + 1).join(', ')}`, `next steps through pages ${expected.map((at) => at + 1).join(', ')}`);
  }
  if (count > 1) {
    const atStart = first;
    const startOk = atStart.prev.present && atStart.prev.visible && atStart.prev.disabled && !atStart.next.disabled;
    report.check('WN-NAV-01', startOk, `${label}: first page`, `previous ${!atStart.prev.present ? 'missing' : !atStart.prev.visible ? 'hidden' : atStart.prev.disabled ? 'disabled' : 'enabled'}, next ${atStart.next.disabled ? 'disabled' : 'enabled'}`, 'previous shown and disabled, next enabled');
    const end = walk.snapshot;
    const endOk = end.next.present && end.next.visible && end.next.disabled && !end.prev.disabled;
    report.check('WN-NAV-01', endOk, `${label}: last page`, `next ${!end.next.present ? 'missing' : !end.next.visible ? 'hidden' : end.next.disabled ? 'disabled' : 'enabled'}, previous ${end.prev.disabled ? 'disabled' : 'enabled'}`, 'next shown and disabled, previous enabled');
    await click(page, 'next', { force: true });
    await settle(page);
    const stayed = (await state(page, options)).index;
    report.check('WN-NAV-01', stayed === count - 1, `${label}: next on the last page`, stayed === count - 1 ? 'stays on the last page' : `moved to page ${stayed + 1}`, 'a disabled next does nothing');
    await click(page, 'prev');
    await settle(page);
    const back = (await state(page, options)).index;
    report.check('WN-NAV-01', back === count - 2, `${label}: previous`, `page ${back + 1}`, `previous goes back to page ${count - 1}`);
    if (first.dots.length === count) {
      await click(page, `dot:${count - 1}`);
      await settle(page);
      const jumped = (await state(page, options)).index;
      report.check('WN-NAV-01', jumped === count - 1, `${label}: dot ${count}`, `page ${jumped + 1}`, `the last dot jumps to page ${count}`);
    } else {
      await click(page, 'next');
      await settle(page);
    }
  }
  const last = await state(page, options);
  if (!last.primary.present) {
    report.error('WN-NAV-01', `${label}: primary button`, 'no primary button found', 'a primary button that dismisses on the last page');
    return false;
  }
  await click(page, 'primary');
  const closed = await waitClosed(page, options);
  report.check('WN-NAV-01', closed, controlWhere(`${label}: primary on the last page`, 'primary', last.primary), closed ? `"${last.primary.name}" closed the popup` : `"${last.primary.name}" left it open`, 'the last primary button dismisses the popup');
  return closed;
}

function checkLayout(report, label, context, count) {
  const cards = context.cards;
  const missing = cards.some((card) => !card);
  report.check('WN-LAYOUT-01', !missing && sameSize(cards), `${label}: card`, missing ? 'card not found on a page' : `${[...new Set(cards.map(size))].join(', ')} over ${cards.length} page(s); spread ${round(spread(cards.map((card) => card.width)))} x ${round(spread(cards.map((card) => card.height)))} px`, `the same size on every page within ${LIMITS.sizeTolerancePx} CSS px`);
  const frames = context.media.filter(Boolean);
  if (!frames.length) {
    report.pass('WN-LAYOUT-01', `${label}: media frame`, 'no media frame', 'one aspect ratio');
    return;
  }
  const ratios = frames.map((frame) => round(frame.width / frame.height, 3));
  report.check('WN-LAYOUT-01', sameRatio(frames) && frames.length === Math.min(count, context.media.length), `${label}: media frame`, `ratio ${[...new Set(ratios)].join(', ')}${frames.length < context.media.length ? `; ${context.media.length - frames.length} page(s) without a frame` : ''}`, 'one aspect ratio on every page');
}

async function checkEscape(report, label, browser, url, viewport, options) {
  const run = await newRun(browser, viewport, options, { seed: options.open ? options.version ?? undefined : OLDER_VERSION });
  try {
    if (!(await openPopup(run.page, url, options))) {
      report.error('WN-DIALOG-01', `${label}: reopen`, 'the popup did not open a second time', 'the popup opens');
      return;
    }
    await run.page.keyboard.press('Escape');
    const closed = await waitClosed(run.page, options);
    report.check('WN-DIALOG-01', closed, `${label}: Escape`, closed ? 'Escape closed the popup' : 'still open after Escape', 'Escape closes the popup');
    if (!closed) return;
    const after = await closedState(run.page, options);
    const returned = options.open ? after.onOpener : after.onBefore;
    report.check('WN-DIALOG-01', returned, `${label}: focus after close`, `focus on ${after.active ?? 'nothing'}`, options.open ? `focus back on ${options.open}` : `focus back where it was before the popup opened (${after.before ?? 'the page body'})`);
  } finally {
    await run.context.close();
  }
}

async function checkMain(report, label, browser, url, viewport, options, want) {
  const run = await newRun(browser, viewport, options, { seed: options.open ? options.version ?? undefined : OLDER_VERSION });
  try {
    if (!(await openPopup(run.page, url, options))) {
      const where = `${label}: open`;
      const measured = options.open ? `nothing matching ${options.selectors.dialog} after clicking ${options.open}` : `nothing matching ${options.selectors.dialog} after load with ${OLDER_VERSION} stored`;
      for (const rule of ['WN-DIALOG-01', 'WN-NAV-01', 'WN-LAYOUT-01', 'WN-MEDIA-01', 'WN-TARGET-01'].filter(want)) report.error(rule, where, measured, 'a visible modal popup');
      return;
    }
    const first = await state(run.page, options);
    if (want('WN-DIALOG-01')) checkDialogStatic(report, label, first);
    if (want('WN-WARN-COUNT')) report.check('WN-WARN-COUNT', first.count <= LIMITS.maxPages, label, `${first.count} page(s)`, `${LIMITS.maxPages} pages or fewer`, 'warn');
    if (want('WN-WARN-AUTOADVANCE')) await watchAdvance(report, label, run.page, options, first);
    if (first.count > 1) await haltAdvance(run.page, options);
    const context = { cards: [], media: [], videosSeen: new Set(), scheme: 'light' };
    const quiet = { ...report, check: (rule, ...rest) => (want(rule) ? report.check(rule, ...rest) : undefined), pass: (rule, ...rest) => (want(rule) ? report.pass(rule, ...rest) : undefined), error: (rule, ...rest) => (want(rule) ? report.error(rule, ...rest) : undefined) };
    const walk = await walkPages(quiet, label, run.page, options, await state(run.page, options), context);
    if (want('WN-LAYOUT-01')) checkLayout(report, label, context, first.count);
    if (want('WN-MEDIA-01') && !context.videosSeen.size) report.pass('WN-MEDIA-01', label, 'no feature video', 'muted, inline videos with posters, only the current one playing');
    if (want('WN-NAV-01')) await checkNavigation(report, label, run.page, options, first, walk);
  } finally {
    await run.context.close();
  }
  if (want('WN-DIALOG-01')) await checkEscape(report, label, browser, url, viewport, options);
}

async function checkReduced(report, label, browser, url, viewport, options, want) {
  const run = await newRun(browser, viewport, options, { reducedMotion: 'reduce', colorScheme: 'dark', seed: options.open ? options.version ?? undefined : OLDER_VERSION });
  const where = `${label}, reduced motion, dark`;
  try {
    if (!(await openPopup(run.page, url, options))) {
      if (want('WN-MOTION-01')) report.error('WN-MOTION-01', where, 'the popup did not open', 'a visible modal popup');
      return;
    }
    await run.page.waitForTimeout(LIMITS.settleMs);
    const opened = await state(run.page, options);
    if (want('WN-MOTION-01')) {
      const playing = opened.videos.filter((video) => !video.paused && !video.ended).length;
      const started = opened.playedOnOwn;
      report.check('WN-MOTION-01', !playing && !started, `${where}: videos`, opened.videos.length ? `${started} video start(s), ${playing} of ${opened.videos.length} playing` : 'no feature video', 'no video starts on its own under reduced motion');
      if (opened.count > 1) {
        const watched = await run.page.evaluate(({ selectors, custom, ms }) => window.__wnCheck.watchMotion(selectors, custom, ms), { selectors: options.selectors, custom: options.custom, ms: LIMITS.watchMotionMs });
        if (!watched.watched) report.error('WN-MOTION-01', `${where}: page change`, 'no next or primary button to change pages', 'a page change without transform movement');
        else report.check('WN-MOTION-01', !watched.moving.length, `${where}: page change`, watched.moving.length ? watched.moving.join('; ') : 'no transform transition or animation', 'no transform, or a transition of 0 ms');
      } else {
        report.pass('WN-MOTION-01', `${where}: page change`, 'one page', 'no page change');
      }
    }
    if (want('WN-WARN-CONTRAST')) {
      await settle(run.page);
      let snapshot = await state(run.page, options);
      for (let step = 0; step < snapshot.count; step += 1) {
        if (step > 0 || snapshot.index !== 0) {
          if (snapshot.dots.length > step) await click(run.page, `dot:${step}`);
          else if (step > 0) await click(run.page, 'next');
          await settle(run.page);
          snapshot = await state(run.page, options);
        }
        const low = textFindings(snapshot);
        report.check('WN-WARN-CONTRAST', !low.length, `${where}, page ${snapshot.index + 1} of ${snapshot.count}`, low.length ? low.join('; ') : `${snapshot.text.length} text element(s) at ${LIMITS.textContrast}:1 or more`, `${LIMITS.textContrast}:1 for text, ${LIMITS.largeTextContrast}:1 for large text`, 'warn');
      }
    }
  } finally {
    await run.context.close();
  }
}

async function checkOnce(report, label, browser, url, viewport, options) {
  const run = await newRun(browser, viewport, options);
  const where = `${label}, once per version`;
  const stored = () => run.page.evaluate((key) => window.__wnCheck.storage(key), options.storageKey);
  const isOpen = async () => (await closedState(run.page, options)).open;
  try {
    await visit(run.page, url);
    await run.page.waitForTimeout(LIMITS.settleMs);
    const firstOpen = await isOpen();
    const firstStored = await stored();
    const version = options.version ?? firstStored;
    report.check('WN-ONCE-01', !firstOpen, `${where}: first install`, firstOpen ? 'the popup opened with nothing stored' : 'nothing opened', 'nothing opens on a first install');
    report.check('WN-ONCE-01', Boolean(version) && firstStored === version, `${where}: first install`, firstStored ? `stored ${firstStored}` : `nothing stored under ${options.storageKey}`, version ? `stores ${version}` : `stores the current version under ${options.storageKey}`);
    if (firstOpen) {
      await run.page.keyboard.press('Escape');
      await waitClosed(run.page, options);
    }
    await run.page.evaluate(({ key, value }) => window.__wnCheck.storage(key, value), { key: options.storageKey, value: OLDER_VERSION });
    await visit(run.page, url);
    const opened = await waitOpen(run.page, options);
    report.check('WN-ONCE-01', opened, `${where}: update`, opened ? `opened with ${OLDER_VERSION} stored` : `nothing opened with ${OLDER_VERSION} stored`, 'the popup opens after an update');
    if (!opened) return;
    const writes = (reset) => run.page.evaluate(({ key, clear }) => window.__wnCheck.writes(key, clear), { key: options.storageKey, clear: reset });
    const atOpen = await stored();
    await writes(true);
    await run.page.waitForTimeout(LIMITS.onceOpenMs);
    const whileOpen = await stored();
    const marked = (await writes(false)).filter((write) => write.value !== OLDER_VERSION);
    const early = atOpen !== OLDER_VERSION || whileOpen !== OLDER_VERSION || marked.length > 0;
    const measured = marked.length ? `wrote ${marked.map((write) => write.value).join(', ')} while open` : `stored ${atOpen ?? 'nothing'} on open, ${whileOpen ?? 'nothing'} ${LIMITS.onceOpenMs / 1000} s later`;
    report.check('WN-ONCE-01', !early, `${where}: while open`, measured, `still ${OLDER_VERSION}: marked seen on dismissal, not on open or while open`);
    await run.page.keyboard.press('Escape');
    if (!(await waitClosed(run.page, options))) {
      await run.page.evaluate((selectors) => (document.querySelector('[data-wn-check="close"]') ?? document.querySelector('[data-wn-check="primary"]'))?.click(), options.selectors);
      await waitClosed(run.page, options);
    }
    const afterDismiss = await stored();
    report.check('WN-ONCE-01', Boolean(version) && afterDismiss === version, `${where}: after dismissal`, `stored ${afterDismiss ?? 'nothing'}`, `stores ${version ?? 'the current version'}`);
    await visit(run.page, url);
    await run.page.waitForTimeout(LIMITS.settleMs);
    const again = await isOpen();
    report.check('WN-ONCE-01', !again, `${where}: reload after dismissal`, again ? 'opened again' : 'nothing opened', 'nothing opens once the version is seen');
  } finally {
    await run.context.close();
  }
}

export async function checkWhatsNew(options, report) {
  const playwright = await loadPlaywright(options.project, options.browser === 'webkit' ? WEBKIT_HINT : INSTALL_HINT);
  const served = options.serve ? await startServer({ root: options.serve, mode: options.server }) : null;
  const url = served ? new URL(options.page, served.url).href : options.url;
  const want = (rule) => !options.only || options.only.includes(rule);
  let browser;
  try {
    browser = await launch(playwright, options);
    for (const viewport of options.viewports) {
      const label = `${options.browser} ${viewport.width}x${viewport.height}`;
      if (['WN-DIALOG-01', 'WN-NAV-01', 'WN-LAYOUT-01', 'WN-MEDIA-01', 'WN-TARGET-01', 'WN-WARN-COUNT', 'WN-WARN-AUTOADVANCE', 'WN-WARN-TARGET44', 'WN-WARN-CONTRAST', 'WN-WARN-TEXT'].some(want)) {
        await checkMain(report, label, browser, url, viewport, options, want);
      }
      if (want('WN-MOTION-01') || want('WN-WARN-CONTRAST')) await checkReduced(report, label, browser, url, viewport, options, want);
      if (want('WN-ONCE-01')) await checkOnce(report, label, browser, url, viewport, options);
    }
  } finally {
    await browser?.close();
    await served?.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.serve && !fs.existsSync(options.serve)) throw new UsageError(`${options.serve} does not exist.`, USAGE);
  const report = createReport({ tool: 'check-whats-new', boundary: BOUNDARY });
  await checkWhatsNew(options, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
