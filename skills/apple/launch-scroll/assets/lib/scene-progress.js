// launch-scroll scene-progress.js (design-pro-max). Copy into the project; no dependencies.
//
// One pinned scene: a tall box ([data-scene]) holding a sticky child ([data-scene-sticky]) that holds the stage
// ([data-scene-stage]). The static layout is the baseline. The scene pins only when every gate passes: no reduced
// motion, a viewport tall enough for the stage plus the sticky offset, and any extra gate the caller supplies (for a
// scrub film, the muted play() probe). While pinned it writes one clamped progress value to --scene-progress.

export const DEFAULTS = Object.freeze({ smoothingMs: 0, nearMargin: '100% 0px 100% 0px' });

export function clampProgress(value) {
  return Math.min(1, Math.max(0, value));
}

/** Progress of a scene box: 0 when its top meets the viewport top, 1 when its bottom meets the viewport bottom. */
export function sceneProgress(rect, viewportHeight) {
  const travel = rect.height - viewportHeight;
  if (travel <= 0) return rect.top <= 0 ? 1 : 0;
  return clampProgress(-rect.top / travel);
}

export function prefersReducedMotion() {
  const query = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Boolean(query || document.documentElement.classList.contains('reduced-motion'));
}

function px(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

/** The stage fits when the viewport shows its whole content below the sticky offset (the page's sticky chrome). */
export function stageFits(scene, viewportHeight = innerHeight) {
  const sticky = scene.querySelector('[data-scene-sticky]');
  const stage = scene.querySelector('[data-scene-stage]') ?? sticky?.firstElementChild;
  if (!sticky || !stage) return false;
  const offset = px(getComputedStyle(sticky).top);
  return stage.getBoundingClientRect().height + offset <= viewportHeight;
}

export function createScene(scene, options = {}) {
  const { smoothingMs, nearMargin } = { ...DEFAULTS, ...options };
  const onProgress = options.onProgress ?? (() => {});
  const onState = options.onState ?? (() => {});
  const blocked = new Set();
  let state = 'static';
  let target = 1;
  let current = 1;
  let near = false;
  let frame = 0;
  let last = 0;
  let pending = Boolean(options.gate);

  const write = (value) => {
    scene.style.setProperty('--scene-progress', value.toFixed(4));
    onProgress(value, state);
  };

  const tick = (now) => {
    frame = 0;
    if (state !== 'pinned') return;
    const elapsed = Math.min(64, now - (last || now));
    last = now;
    current = smoothingMs > 0 ? current + (target - current) * (1 - Math.exp(-elapsed / smoothingMs)) : target;
    if (Math.abs(target - current) < 1e-4) current = target;
    write(current);
    if (current !== target) frame = requestAnimationFrame(tick);
  };

  const measure = () => {
    if (state !== 'pinned') return;
    target = sceneProgress(scene.getBoundingClientRect(), innerHeight);
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };

  const reasons = () => {
    const list = [...blocked];
    if (pending) list.push('gate-pending');
    if (prefersReducedMotion()) list.push('reduced-motion');
    if (!stageFits(scene)) list.push('short-viewport');
    return list;
  };

  const evaluate = () => {
    const why = reasons();
    const next = why.length ? 'static' : 'pinned';
    scene.dataset.sceneReason = why.join(' ');
    if (next === state && next === 'pinned') return measure();
    state = next;
    scene.dataset.sceneState = state;
    if (state === 'static') {
      cancelAnimationFrame(frame);
      frame = 0;
      target = current = 1;
      write(1);
    } else {
      current = target = sceneProgress(scene.getBoundingClientRect(), innerHeight);
      write(current);
    }
    onState(state, why);
  };

  const onScroll = () => {
    if (near) measure();
  };
  const observer = new IntersectionObserver((entries) => {
    near = entries.some((entry) => entry.isIntersecting);
    if (near) measure();
  }, { rootMargin: nearMargin });
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', evaluate);
  motionQuery?.addEventListener?.('change', evaluate);
  observer.observe(scene);
  evaluate();

  if (options.gate) {
    Promise.resolve(options.gate).then((reason) => {
      pending = false;
      if (reason) blocked.add(reason);
      evaluate();
    }, () => {
      pending = false;
      blocked.add('gate-failed');
      evaluate();
    });
  }

  return {
    get state() {
      return state;
    },
    get progress() {
      return current;
    },
    block(reason) {
      blocked.add(reason);
      evaluate();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', evaluate);
      motionQuery?.removeEventListener?.('change', evaluate);
    },
  };
}
