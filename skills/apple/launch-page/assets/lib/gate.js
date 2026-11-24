// launch-page gate.js (design-pro-max). Copy into the project with reveal.js and gallery.js; they have no dependencies.
//
// Motion gate and hero intro. markMotion() sets html[data-motion="ok"] only when motion is allowed (no reduced-motion
// preference, no html.reduced-motion class), so every entrance state hides content only behind that capability: without
// script, or under reduced motion, the page is its end state. runIntro() plays a hero intro once per session and always
// ends it: on the film's end, an error, a rejected play(), a scroll, a key press or a timeout well under 5 s. Ending it
// pauses the film, drops its source and reloads the element, which aborts a download still in flight.
// Pair it with the inline head snippet in assets/reference/intro-handoff.html, which decides before first paint.
// For single-page apps that remount: markMotion(win, { signal }) and runIntro(root, { signal }) stop listening when the
// signal aborts, and runIntro also returns destroy(), which ends the intro.

export const DEFAULTS = Object.freeze({ timeoutMs: 3500, storageKey: 'launch-intro-seen', scrolledPx: 1, memoryGb: 2 });

const REDUCED = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(win = globalThis.window) {
  if (!win) return true;
  const root = win.document?.documentElement;
  return Boolean(win.matchMedia?.(REDUCED).matches) || Boolean(root?.classList.contains('reduced-motion'));
}

export function lowMemory(nav = globalThis.navigator, { memoryGb = DEFAULTS.memoryGb } = {}) {
  if (!nav) return false;
  return (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= memoryGb) || Boolean(nav.connection?.saveData);
}

export function decideIntro({ reducedMotion, scrollY = 0, hash = '', seen = false, hasIntro = true, scrolledPx = DEFAULTS.scrolledPx }) {
  if (!hasIntro) return { play: false, reason: 'no-intro' };
  if (reducedMotion) return { play: false, reason: 'reduced-motion' };
  if (scrollY >= scrolledPx) return { play: false, reason: 'loaded-scrolled' };
  if (hash && hash !== '#') return { play: false, reason: 'loaded-at-anchor' };
  if (seen) return { play: false, reason: 'seen-this-session' };
  return { play: true, reason: 'first-visit' };
}

export function markMotion(win = window, { signal } = {}) {
  const root = win.document.documentElement;
  const apply = () => {
    if (prefersReducedMotion(win)) delete root.dataset.motion;
    else root.dataset.motion = 'ok';
  };
  apply();
  if (!signal?.aborted) win.matchMedia?.(REDUCED).addEventListener?.('change', apply, signal ? { signal } : undefined);
  return !prefersReducedMotion(win);
}

function readSeen(win, key) {
  try {
    return win.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSeen(win, key) {
  try {
    win.sessionStorage.setItem(key, '1');
  } catch {
    return;
  }
}

export function runIntro(root, { film = root?.querySelector('video[data-intro-film]') ?? null, win = window, ...options } = {}) {
  const settings = { ...DEFAULTS, ...options };
  const html = win.document.documentElement;
  const state = { decision: null, finished: false };
  let timer = 0;
  const onScroll = () => {
    if (win.scrollY >= settings.scrolledPx) finish('scrolled');
  };
  const onKey = () => finish('key');
  function finish(reason) {
    if (state.finished) return;
    state.finished = true;
    win.clearTimeout(timer);
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('keydown', onKey);
    html.dataset.intro = html.dataset.intro === 'skipped' ? 'skipped' : 'done';
    html.dataset.introReason = reason;
    if (film) {
      film.pause?.();
      film.removeAttribute('src');
      film.querySelectorAll?.('source').forEach((source) => source.removeAttribute('src'));
      film.load?.();
    }
    writeSeen(win, settings.storageKey);
    settings.onDone?.(reason);
  }
  const start = () => {
    if (state.finished) return;
    state.decision = decideIntro({
      reducedMotion: prefersReducedMotion(win),
      scrollY: win.scrollY,
      hash: win.location.hash,
      seen: readSeen(win, settings.storageKey),
      hasIntro: Boolean(root),
      scrolledPx: settings.scrolledPx,
    });
    if (!state.decision.play || html.dataset.intro === 'skipped' || html.dataset.intro === 'done') {
      if (html.dataset.intro !== 'done') html.dataset.intro = 'skipped';
      finish(html.dataset.introReason ?? state.decision.reason);
      return;
    }
    html.dataset.intro = 'play';
    root.querySelector('[data-intro-skip]')?.addEventListener('click', () => finish('skipped-by-user'));
    if (film) {
      for (const source of film.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
      if (film.dataset.src) film.src = film.dataset.src;
      film.addEventListener('ended', () => finish('ended'), { once: true });
      film.addEventListener('error', () => finish('error'), { once: true });
      film.load();
      const playing = film.play();
      if (playing?.catch) playing.catch(() => finish('rejected'));
    } else {
      const last = root.querySelector('[data-intro-last]');
      if (last) last.addEventListener('animationend', () => finish('ended'), { once: true });
      else finish('no-film');
    }
  };
  if (html.dataset.intro === 'play' || html.dataset.intro === undefined) {
    timer = win.setTimeout(() => finish('timeout'), settings.timeoutMs);
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('keydown', onKey);
  }
  let frame = 0;
  const onLoad = () => {
    frame = win.requestAnimationFrame(start);
  };
  if (win.document.readyState === 'complete') frame = win.requestAnimationFrame(start);
  else win.addEventListener('load', onLoad, { once: true });
  const destroy = () => {
    win.removeEventListener('load', onLoad);
    if (frame) win.cancelAnimationFrame?.(frame);
    finish('destroyed');
  };
  settings.signal?.addEventListener('abort', destroy, { once: true });
  return { finish, destroy, get decision() { return state.decision; } };
}
