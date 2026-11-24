// launch-page gallery.js (design-pro-max). Copy into the project with gate.js.
//
// Self-moving content with a labelled pause control, for galleries and marquees. Anything that moves on its own for
// more than 5 s needs a way to pause it, and nothing moves on its own under reduced motion.
//
// createGallery(element): [data-gallery] holding [data-slide] items, one [data-gallery-dot] button per slide and one
// [data-gallery-toggle] button. A slide's data-duration (ms; the clip length for a video slide) sets how long it stays
// and how long its dot fills. Autoplay starts only when motion is allowed, pauses off screen and in a hidden tab, and the
// toggle switches its label between "Pause" and "Play". The gallery carries data-playing (the reader's choice) and
// data-running (the timer is counting); the dot's fill animation runs only while data-running is true and restarts only
// when a slide is shown, so the dot and the timer stay in step through pauses. A video in a slide plays only while its
// slide is shown and the gallery is running, never under reduced motion. Under reduced motion the first slide shows and
// the dots work.
//
// createMarquee(element): [data-marquee] whose [data-marquee-track] scrolls with a CSS animation, and a
// [data-marquee-toggle] button. The toggle sets data-paused, which the CSS turns into animation-play-state: paused; it
// also pauses when reduced motion turns on.
//
// Both return destroy() and accept a signal option; either removes every observer and listener.

import { prefersReducedMotion } from './gate.js';

export const DEFAULTS = Object.freeze({ durationMs: 6000 });

const REDUCED = '(prefers-reduced-motion: reduce)';

export function nextIndex(current, count, step = 1) {
  if (count <= 0) return 0;
  return (((current + step) % count) + count) % count;
}

export function slideDuration(slide, fallback = DEFAULTS.durationMs) {
  const value = Number(slide?.dataset?.duration);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function toggleLabel(playing, name) {
  return { label: `${playing ? 'Pause' : 'Play'} ${name}`, text: playing ? 'Pause' : 'Play' };
}

function label(button, playing, name) {
  const { label: text, text: visibleText } = toggleLabel(playing, name);
  button.setAttribute('aria-label', text);
  button.removeAttribute('aria-pressed');
  const visible = button.querySelector('[data-toggle-text]');
  if (visible) visible.textContent = visibleText;
}

function lifetime(signal) {
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', () => controller.abort(), { once: true });
  return controller;
}

export function createGallery(element, { win = window, signal: outer, ...options } = {}) {
  const settings = { ...DEFAULTS, ...options };
  const controller = lifetime(outer);
  const { signal } = controller;
  const slides = [...element.querySelectorAll('[data-slide]')];
  const dots = [...element.querySelectorAll('[data-gallery-dot]')];
  const toggle = element.querySelector('[data-gallery-toggle]');
  const name = element.getAttribute('aria-label') ?? 'gallery';
  let index = 0;
  let timer = 0;
  let playing = false;
  let visible = true;
  let startedAt = 0;
  let remaining = 0;
  let observer = null;
  const running = () => Boolean(timer);
  const syncMedia = () => {
    const allowed = running() && !prefersReducedMotion(win);
    slides.forEach((slide, at) => {
      for (const video of slide.querySelectorAll('video')) {
        if (allowed && at === index) {
          const started = video.play?.();
          if (started?.catch) started.catch(() => {});
        } else {
          video.pause?.();
        }
      }
    });
  };
  const markRunning = () => {
    element.dataset.running = String(running());
    syncMedia();
  };
  const show = (target) => {
    index = target;
    slides.forEach((slide, at) => {
      slide.hidden = at !== index;
      slide.setAttribute('aria-hidden', String(at !== index));
    });
    dots.forEach((dot, at) => {
      dot.style.setProperty('--slide-duration', `${slideDuration(slides[at], settings.durationMs)}ms`);
      dot.removeAttribute('aria-current');
    });
    if (dots[index]) {
      void dots[index].offsetWidth;
      dots[index].setAttribute('aria-current', 'true');
    }
    remaining = slideDuration(slides[index], settings.durationMs);
    markRunning();
  };
  const halt = () => {
    if (timer) remaining = Math.max(0, remaining - (win.performance.now() - startedAt));
    win.clearTimeout(timer);
    timer = 0;
    markRunning();
  };
  const schedule = () => {
    win.clearTimeout(timer);
    timer = 0;
    if (playing && visible && !win.document.hidden && !signal.aborted) {
      startedAt = win.performance.now();
      timer = win.setTimeout(() => {
        timer = 0;
        show(nextIndex(index, slides.length));
        schedule();
      }, remaining);
    }
    markRunning();
  };
  const setPlaying = (value) => {
    playing = Boolean(value) && slides.length > 1;
    element.dataset.playing = String(playing);
    if (toggle) label(toggle, playing, name);
    if (playing) schedule();
    else halt();
  };
  const destroy = () => {
    halt();
    observer?.disconnect();
    observer = null;
    controller.abort();
  };
  dots.forEach((dot, at) => dot.addEventListener('click', () => {
    halt();
    show(at);
    schedule();
  }, { signal }));
  toggle?.addEventListener('click', () => setPlaying(!playing), { signal });
  if (win.IntersectionObserver) {
    observer = new win.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else halt();
    });
    observer.observe(element);
  }
  win.document.addEventListener('visibilitychange', () => (win.document.hidden ? halt() : schedule()), { signal });
  win.matchMedia?.(REDUCED).addEventListener?.('change', (event) => {
    if (event.matches) setPlaying(false);
  }, { signal });
  signal.addEventListener('abort', () => {
    observer?.disconnect();
    win.clearTimeout(timer);
    timer = 0;
  }, { once: true });
  show(0);
  setPlaying(!prefersReducedMotion(win));
  return { show, setPlaying, destroy, get playing() { return playing; }, get running() { return running(); }, get index() { return index; } };
}

export function createMarquee(element, { win = window, signal: outer } = {}) {
  const controller = lifetime(outer);
  const { signal } = controller;
  const toggle = element.querySelector('[data-marquee-toggle]');
  const name = element.getAttribute('aria-label') ?? 'marquee';
  const set = (playing) => {
    if (playing) delete element.dataset.paused;
    else element.dataset.paused = '';
    if (toggle) label(toggle, playing, name);
  };
  toggle?.addEventListener('click', () => set('paused' in element.dataset), { signal });
  win.matchMedia?.(REDUCED).addEventListener?.('change', (event) => {
    if (event.matches) set(false);
  }, { signal });
  set(!prefersReducedMotion(win));
  return { set, destroy: () => controller.abort() };
}
