// launch-page reveal.js (design-pro-max). Copy into the project with gate.js.
//
// One-shot narrative reveals. Content marked [data-reveal] is visible in the markup; the entrance state applies only
// under html[data-motion="ok"] (set by gate.js markMotion) and until the element gets data-revealed. Each element is
// revealed once, when it first enters the viewport, and is never hidden again: the observer stops watching it.
// Group items share a [data-reveal-group] parent and are staggered by --reveal-index. Without IntersectionObserver,
// on print and when reduced motion turns on, everything is revealed at once.
//
// CSS it expects (also in assets/reference/launch-page.html):
//   html[data-motion="ok"] [data-reveal]:not([data-revealed]) { opacity: 0; translate: 0 var(--reveal-rise); }
//   [data-reveal] { transition: opacity var(--duration-reveal) var(--ease-out), translate var(--duration-reveal) var(--ease-out);
//                   transition-delay: calc(var(--reveal-index, 0) * var(--reveal-stagger)); }

export const DEFAULTS = Object.freeze({ selector: '[data-reveal]', rootMargin: '0px 0px -15% 0px', threshold: 0.1, maxStagger: 6 });

export function staggerIndex(index, maxStagger = DEFAULTS.maxStagger) {
  return Math.max(0, Math.min(index, maxStagger));
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
  let observer = null;
  const revealAll = () => {
    for (const element of elements) markRevealed(element);
    observer?.disconnect();
  };
  const html = (root.documentElement ?? root.ownerDocument?.documentElement);
  if (!win?.IntersectionObserver || html?.dataset.motion !== 'ok') {
    revealAll();
    return { revealAll, observer: null };
  }
  observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      markRevealed(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: settings.rootMargin, threshold: settings.threshold });
  for (const element of elements) if (!element.hasAttribute('data-revealed')) observer.observe(element);
  win.addEventListener('beforeprint', revealAll);
  win.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (event) => {
    if (event.matches) revealAll();
  });
  return { revealAll, observer };
}
