// launch-page reveal.js (design-pro-max). Copy into the project with gate.js.
//
// One-shot narrative reveals. Content marked [data-reveal] is visible in the markup; the entrance state applies only
// under html[data-motion="ok"] (set by gate.js markMotion) and until the element gets data-revealed. Each element is
// revealed once and is never hidden again: when any part of it enters the viewport above the bottom margin, when it is
// already in or above the viewport at load, when the reader jumps past it, and when the page is scrolled to its end,
// so a panel taller than the viewport and a line at the very end of the page are revealed too. Group items share a
// [data-reveal-group] parent and are staggered by --reveal-index. Without IntersectionObserver, on print and when
// reduced motion turns on, everything is revealed at once. destroy(), or aborting the signal option, removes every
// observer and listener, for single-page apps that remount.
//
// CSS it expects (also in assets/reference/launch-page.html):
//   html[data-motion="ok"] [data-reveal]:not([data-revealed]) { opacity: 0; translate: 0 var(--reveal-rise); }
//   [data-reveal] { transition: opacity var(--duration-reveal) var(--ease-out), translate var(--duration-reveal) var(--ease-out);
//                   transition-delay: calc(var(--reveal-index, 0) * var(--reveal-stagger)); }

export const DEFAULTS = Object.freeze({ selector: '[data-reveal]', rootMargin: '0px 0px -15% 0px', threshold: 0, maxStagger: 6, endSlackPx: 2 });

export function staggerIndex(index, maxStagger = DEFAULTS.maxStagger) {
  return Math.max(0, Math.min(index, maxStagger));
}

export function shouldReveal(rect, { atLoad = false, viewportHeight, scrollBottom, scrollHeight, endSlackPx = DEFAULTS.endSlackPx }) {
  if (rect.top < (atLoad ? viewportHeight : 0)) return true;
  return scrollBottom >= scrollHeight - endSlackPx;
}

function markRevealed(element) {
  element.setAttribute('data-revealed', '');
}

export function createReveals(root = document, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const elements = [...root.querySelectorAll(settings.selector)];
  const groups = new Map();
  for (const element of elements) {
    const group = element.closest('[data-reveal-group]');
    if (!group) continue;
    const index = groups.get(group) ?? 0;
    element.style.setProperty('--reveal-index', String(staggerIndex(index, settings.maxStagger)));
    groups.set(group, index + 1);
  }
  const win = root.defaultView ?? globalThis.window;
  const html = root.documentElement ?? root.ownerDocument?.documentElement;
  const controller = new AbortController();
  const signal = controller.signal;
  settings.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  let observer = null;
  let frame = 0;
  const pending = new Set(elements.filter((element) => !element.hasAttribute('data-revealed')));
  const destroy = () => {
    observer?.disconnect();
    observer = null;
    if (frame) win?.cancelAnimationFrame?.(frame);
    frame = 0;
    controller.abort();
  };
  const reveal = (element) => {
    markRevealed(element);
    pending.delete(element);
    observer?.unobserve(element);
    if (!pending.size) destroy();
  };
  const revealAll = () => {
    for (const element of [...pending]) reveal(element);
    destroy();
  };
  if (!win?.IntersectionObserver || html?.dataset.motion !== 'ok' || settings.signal?.aborted) {
    revealAll();
    return { revealAll, destroy, observer: null };
  }
  const sweep = (atLoad = false) => {
    frame = 0;
    const state = { atLoad, viewportHeight: win.innerHeight, scrollBottom: win.scrollY + win.innerHeight, scrollHeight: html.scrollHeight, endSlackPx: settings.endSlackPx };
    for (const element of [...pending]) if (shouldReveal(element.getBoundingClientRect(), state)) reveal(element);
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(() => sweep(false));
  };
  observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
  }, { rootMargin: settings.rootMargin, threshold: settings.threshold });
  for (const element of pending) observer.observe(element);
  sweep(true);
  if (!pending.size) return { revealAll, destroy, observer: null };
  win.addEventListener('scroll', schedule, { passive: true, signal });
  win.addEventListener('resize', schedule, { passive: true, signal });
  win.addEventListener('beforeprint', revealAll, { signal });
  win.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (event) => {
    if (event.matches) revealAll();
  }, { signal });
  return { revealAll, destroy, observer };
}
