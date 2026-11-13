// launch-video demo-embed.js 0.2.0 (design-pro-max). Copy into the project; it has no dependencies.
//
// Lazy, accessible demo clips. Order of work for each [data-demo]:
//   1. Nothing loads at first: the <video> has preload="none", no autoplay attribute and its sources in data-src; the
//      start image (an <img loading="lazy">, frame 0 of the clip) is what the reader sees.
//   2. When the clip comes within the load margin (600px by default, both axes, so carousels work), the sources get
//      their src and the clip loads.
//   3. It plays while at least half of it is visible and pauses otherwise; with maxActive 1 only the most visible
//      clip plays. Every play() call checks reduced motion and the reader's own pause at that moment, including the
//      one that follows loading.
//   4. The video is revealed over the start image only after it has presented a frame.
//   5. A clip that moves for more than 5 s (any loop, or a longer one-shot) gets a labelled pause button if the
//      markup has none; the reader's choice sticks.
//   6. Under reduced motion, or with Save-Data on, nothing loads or plays until the reader presses Play.
// Markup:
//   <figure data-demo>
//     <div data-demo-frame>
//       <img data-demo-start src="clip.start.jpg" width="1280" height="720" alt="" loading="lazy" decoding="async">
//       <video muted playsinline loop preload="none" aria-hidden="true" width="1280" height="720">
//         <source data-src="clip.av1.webm" type='video/webm; codecs="av01.0.05M.08"'>
//         <source data-src="clip.mp4" type='video/mp4; codecs="avc1.640028"'>
//       </video>
//     </div>
//     <button type="button" data-demo-toggle>Pause</button>
//     <figcaption>What the clip shows, in words.</figcaption>
//   </figure>

export const DEFAULTS = Object.freeze({ loadMargin: '600px', playRatio: 0.5, maxActive: 1, pauseAfterSeconds: 5, labels: { pause: 'Pause', play: 'Play' } });

/** True when a clip moves on its own for longer than the limit: any loop, or a one-shot longer than it. */
export function needsPauseControl({ loop, duration }, limit = DEFAULTS.pauseAfterSeconds) {
  return Boolean(loop) || (Number.isFinite(duration) && duration > limit);
}

/** The clips allowed to play: at least playRatio visible, most visible first, at most maxActive. */
export function pickActive(entries, { playRatio = DEFAULTS.playRatio, maxActive = DEFAULTS.maxActive } = {}) {
  return entries
    .filter((entry) => entry.ratio >= playRatio && !entry.held)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, Math.max(0, maxActive))
    .map((entry) => entry.id);
}

export function prefersReducedMotion(win = globalThis) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || Boolean(win.document?.documentElement.classList.contains('reduced-motion'));
}

export function saveData(nav = globalThis.navigator) {
  return Boolean(nav?.connection?.saveData);
}

function attachSources(video) {
  if (video.dataset.demoLoaded) return;
  video.dataset.demoLoaded = '1';
  for (const source of video.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
  if (video.dataset.src) video.src = video.dataset.src;
  video.load();
}

function revealAfterFirstFrame(root, video) {
  const reveal = () => root.setAttribute('data-demo-ready', '');
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(reveal);
  else video.addEventListener('playing', reveal, { once: true });
}

function ensureToggle(root, labels) {
  let button = root.querySelector('[data-demo-toggle]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-demo-toggle', '');
    const frame = root.querySelector('[data-demo-frame]');
    if (frame) frame.after(button);
    else root.append(button);
  }
  if (!button.textContent.trim() && !button.getAttribute('aria-label')) button.textContent = labels.pause;
  return button;
}

/** Mounts every [data-demo] under root and returns a function that stops them all. */
export function mountDemos(root = document, options = {}) {
  const settings = { ...DEFAULTS, ...options, labels: { ...DEFAULTS.labels, ...options.labels } };
  const demos = [...root.querySelectorAll('[data-demo]')].map((element, id) => ({ id, element, video: element.querySelector('video'), ratio: 0, held: false, chosen: false, toggle: null }));
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const blocked = () => prefersReducedMotion() || saveData();

  const label = (demo) => {
    if (!demo.toggle) return;
    const playing = !demo.video.paused;
    demo.toggle.textContent = playing ? settings.labels.pause : settings.labels.play;
  };

  const play = (demo) => {
    if (demo.held || (blocked() && !demo.chosen)) return;
    attachSources(demo.video);
    const started = demo.video.play();
    started?.catch?.(() => label(demo));
  };

  const update = () => {
    const active = new Set(pickActive(demos, settings));
    for (const demo of demos) {
      if (active.has(demo.id)) play(demo);
      else if (!demo.video.paused) demo.video.pause();
    }
  };

  const addToggle = (demo) => {
    if (demo.toggle) return;
    demo.toggle = ensureToggle(demo.element, settings.labels);
    demo.toggle.addEventListener('click', () => {
      if (demo.video.paused) {
        demo.held = false;
        demo.chosen = true;
        attachSources(demo.video);
        demo.video.play()?.catch?.(() => label(demo));
      } else {
        demo.held = true;
        demo.video.pause();
      }
      label(demo);
    });
    label(demo);
  };

  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const demo = demos.find((candidate) => candidate.element === entry.target);
      if (demo && !blocked()) attachSources(demo.video);
    }
  }, { rootMargin: settings.loadMargin });

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const demo = demos.find((candidate) => candidate.element === entry.target);
      if (demo) demo.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
    }
    update();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  const cleanups = [];
  for (const demo of demos) {
    if (!demo.video) continue;
    demo.video.muted = true;
    demo.video.playsInline = true;
    demo.video.removeAttribute('autoplay');
    demo.video.preload = 'none';
    revealAfterFirstFrame(demo.element, demo.video);
    if (demo.element.querySelector('[data-demo-toggle]') || demo.video.loop || blocked()) addToggle(demo);
    const onMeta = () => {
      if (needsPauseControl({ loop: demo.video.loop, duration: demo.video.duration }, settings.pauseAfterSeconds)) addToggle(demo);
      update();
    };
    const onState = () => label(demo);
    demo.video.addEventListener('loadedmetadata', onMeta);
    demo.video.addEventListener('play', onState);
    demo.video.addEventListener('pause', onState);
    cleanups.push(() => {
      demo.video.removeEventListener('loadedmetadata', onMeta);
      demo.video.removeEventListener('play', onState);
      demo.video.removeEventListener('pause', onState);
    });
    near.observe(demo.element);
    seen.observe(demo.element);
  }

  const onMotion = () => {
    if (!blocked()) return update();
    for (const demo of demos) {
      if (!demo.chosen && !demo.video.paused) demo.video.pause();
      addToggle(demo);
    }
  };
  const onVisibility = () => {
    if (document.hidden) for (const demo of demos) demo.video.pause();
    else update();
  };
  motion?.addEventListener?.('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    near.disconnect();
    seen.disconnect();
    motion?.removeEventListener?.('change', onMotion);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const cleanup of cleanups) cleanup();
  };
}
