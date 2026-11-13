// launch-page gallery.js (design-pro-max). Copy into the project with gate.js.
//
// Self-moving content with a labelled pause control, for galleries and marquees. Anything that moves on its own for
// more than 5 s needs a way to pause it, and nothing moves on its own under reduced motion.
//
// createGallery(element): [data-gallery] holding [data-slide] items, one [data-gallery-dot] button per slide and one
// [data-gallery-toggle] button. A slide's data-duration (ms; the clip length for a video slide) sets how long it stays
// and how long its dot fills. Autoplay starts only when motion is allowed, pauses off screen and in a hidden tab, and the
// toggle switches its label between "Pause" and "Play". Under reduced motion the first slide shows and the dots work.
//
// createMarquee(element): [data-marquee] whose [data-marquee-track] scrolls with a CSS animation, and a
// [data-marquee-toggle] button. The toggle sets data-paused, which the CSS turns into animation-play-state: paused.

import { prefersReducedMotion } from './gate.js';

export const DEFAULTS = Object.freeze({ durationMs: 6000 });

export function nextIndex(current, count, step = 1) {
  if (count <= 0) return 0;
  return (((current + step) % count) + count) % count;
}

export function slideDuration(slide, fallback = DEFAULTS.durationMs) {
  const value = Number(slide?.dataset?.duration);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function label(button, playing, name) {
  const text = `${playing ? 'Pause' : 'Play'} ${name}`;
  button.setAttribute('aria-label', text);
  button.setAttribute('aria-pressed', String(!playing));
  const visible = button.querySelector('[data-toggle-text]');
  if (visible) visible.textContent = playing ? 'Pause' : 'Play';
}

export function createGallery(element, { win = window, ...options } = {}) {
  const settings = { ...DEFAULTS, ...options };
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
  const show = (target) => {
    index = target;
    slides.forEach((slide, at) => {
      slide.hidden = at !== index;
      slide.setAttribute('aria-hidden', String(at !== index));
    });
    dots.forEach((dot, at) => {
      if (at === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
      dot.style.setProperty('--slide-duration', `${slideDuration(slides[at], settings.durationMs)}ms`);
    });
    remaining = slideDuration(slides[index], settings.durationMs);
  };
  const schedule = () => {
    win.clearTimeout(timer);
    if (!playing || !visible || win.document.hidden) return;
    startedAt = win.performance.now();
    timer = win.setTimeout(() => {
      show(nextIndex(index, slides.length));
      schedule();
    }, remaining);
  };
  const halt = () => {
    if (timer) remaining = Math.max(0, remaining - (win.performance.now() - startedAt));
    win.clearTimeout(timer);
    timer = 0;
  };
  const setPlaying = (value) => {
    playing = value && slides.length > 1;
    element.dataset.playing = String(playing);
    if (toggle) label(toggle, playing, name);
    if (playing) schedule();
    else halt();
  };
  dots.forEach((dot, at) => dot.addEventListener('click', () => {
    halt();
    show(at);
    schedule();
  }));
  toggle?.addEventListener('click', () => setPlaying(!playing));
  if (win.IntersectionObserver) {
    new win.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else halt();
    }).observe(element);
  }
  win.document.addEventListener('visibilitychange', () => (win.document.hidden ? halt() : schedule()));
  win.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (event) => {
    if (event.matches) setPlaying(false);
  });
  show(0);
  setPlaying(!prefersReducedMotion(win));
  return { show, setPlaying, get playing() { return playing; }, get index() { return index; } };
}

export function createMarquee(element, { win = window } = {}) {
  const toggle = element.querySelector('[data-marquee-toggle]');
  const name = element.getAttribute('aria-label') ?? 'marquee';
  const set = (playing) => {
    if (playing) delete element.dataset.paused;
    else element.dataset.paused = '';
    if (toggle) label(toggle, playing, name);
  };
  toggle?.addEventListener('click', () => set('paused' in element.dataset));
  set(!prefersReducedMotion(win));
  return { set };
}
