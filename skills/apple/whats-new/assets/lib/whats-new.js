// whats-new whats-new.js (design-pro-max). Copy into the project with whats-new.css; it has no dependencies.
//
// An in-app "What's New" popup: one card for one feature, a pager with previous/next buttons and page dots for
// several. It opens only on the first launch after an update: with no stored version (a first install) it stores the
// current version silently and shows nothing; with an older stored version it opens once the page has loaded and no
// other modal is open; it stores the current version when the popup is dismissed (close button, Escape, last primary
// button), so a crash before dismissal shows it again. Pass force: true from a "What's New…" menu item to reopen it.
//
// showWhatsNew(options) returns a Promise that resolves on close with { shown: true, reason, page }, or at once with
// { shown: false, reason } when nothing opens; a second call while one is waiting or open gets that call's result, so
// the popup never shows twice. Media per feature: { type: 'image', src, alt }, { type: 'video', src, poster } or
// { type: 'element', element }. Only the current page's video plays; under reduced motion no video starts on its own
// and pages change without movement; a looping video longer than 5 s gets a pause control.

export const DEFAULTS = Object.freeze({
  storageKey: 'whats-new:last-seen',
  aspectRatio: '16 / 9',
  maxPages: 5,
  pauseAfterSeconds: 5,
});

export const LABELS = Object.freeze({
  close: 'Close',
  previous: 'Previous feature',
  next: 'Next feature',
  nextButton: 'Next',
  done: 'Got it',
  pageOf: '{n} of {m}',
  dot: 'Feature {n} of {m}',
  region: "What's new",
  pause: 'Pause video',
  play: 'Play video',
  releaseNotes: 'All release notes',
  stopAdvance: 'Stop advancing pages',
  startAdvance: 'Advance pages automatically',
});

const REDUCED = '(prefers-reduced-motion: reduce)';
const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
let instances = 0;
let pending = null;

export function format(template, n, m) {
  return String(template).replaceAll('{n}', String(n)).replaceAll('{m}', String(m));
}

export function whatsNewDecision(stored, version) {
  if (stored === null || stored === undefined || stored === '') return 'first-install';
  return stored === version ? 'seen' : 'update';
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function shouldShowWhatsNew({ version, storageKey = DEFAULTS.storageKey, storage = defaultStorage() } = {}) {
  if (!version) throw new TypeError('shouldShowWhatsNew needs the current app version');
  const decision = whatsNewDecision(readStored(storage, storageKey), String(version));
  if (decision === 'first-install') writeStored(storage, storageKey, String(version));
  return decision === 'update';
}

export function markWhatsNewSeen({ version, storageKey = DEFAULTS.storageKey, storage = defaultStorage() } = {}) {
  if (!version) return false;
  return writeStored(storage, storageKey, String(version));
}

function element(doc, tag, attributes = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function waitForLoad(win) {
  if (win.document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => win.addEventListener('load', () => resolve(), { once: true }));
}

function nextFrame(win) {
  return new Promise((resolve) => {
    const timer = win.setTimeout(resolve, 120);
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
      win.clearTimeout(timer);
      resolve();
    }));
  });
}

function rendered(node) {
  if (typeof node.checkVisibility === 'function') return node.checkVisibility({ visibilityProperty: true });
  return node.getClientRects().length > 0;
}

function nativeModal(doc) {
  try {
    return doc.querySelector('dialog:modal');
  } catch {
    return null;
  }
}

function openModal(doc) {
  return nativeModal(doc) ?? [...doc.querySelectorAll('[role="dialog"][aria-modal="true"]:not([hidden])')].find(rendered) ?? null;
}

async function waitForOtherModals(win) {
  for (let other = openModal(win.document); other; other = openModal(win.document)) {
    if (other.localName === 'dialog') {
      await new Promise((resolve) => other.addEventListener('close', () => resolve(), { once: true }));
    } else {
      await new Promise((resolve) => win.setTimeout(resolve, 250));
    }
  }
}

function buildMedia(doc, media, labels) {
  const frame = element(doc, 'div', { class: 'wn-media' });
  if (!media || media.type === 'none') {
    frame.classList.add('wn-media-empty');
    return { frame, video: null, toggle: null };
  }
  if (media.type === 'image') {
    frame.append(element(doc, 'img', { src: media.src, alt: media.alt ?? '', decoding: 'async', draggable: 'false' }));
    return { frame, video: null, toggle: null };
  }
  if (media.type === 'element' || media.type === 'art') {
    const node = media.element ?? (typeof media.render === 'function' ? media.render(doc) : null);
    if (node) frame.append(node);
    return { frame, video: null, toggle: null };
  }
  if (media.type === 'video') {
    const video = element(doc, 'video', {
      src: media.src,
      poster: media.poster,
      muted: true,
      playsinline: true,
      loop: true,
      preload: 'metadata',
      disablepictureinpicture: true,
      'aria-hidden': media.alt ? undefined : 'true',
      'aria-label': media.alt || undefined,
    });
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    const toggle = element(doc, 'button', { type: 'button', class: 'wn-pause', 'aria-label': labels.play, hidden: true });
    toggle.append(element(doc, 'span', { class: 'wn-pause-icon', 'aria-hidden': 'true' }));
    frame.append(video, toggle);
    return { frame, video, toggle };
  }
  throw new TypeError(`Unknown media type: ${media.type}`);
}

export function showWhatsNew({
  version,
  features = [],
  storageKey = DEFAULTS.storageKey,
  storage = defaultStorage(),
  labels: customLabels = {},
  aspectRatio = DEFAULTS.aspectRatio,
  releaseNotesUrl,
  force = false,
  autoAdvanceMs = 0,
  onClose,
  win = globalThis.window,
  parent,
} = {}) {
  const labels = { ...LABELS, ...customLabels };
  const doc = win.document;
  const finish = (result) => {
    try {
      onClose?.(result);
    } catch (error) {
      win.console?.error?.(error);
    }
    return result;
  };
  if (pending) return pending.then((result) => finish(result));
  if (!force) {
    if (!version) throw new TypeError('showWhatsNew needs the current app version unless force is true');
    const decision = whatsNewDecision(readStored(storage, storageKey), String(version));
    if (decision === 'first-install') {
      writeStored(storage, storageKey, String(version));
      return Promise.resolve(finish({ shown: false, reason: 'first-install' }));
    }
    if (decision === 'seen') return Promise.resolve(finish({ shown: false, reason: 'seen' }));
  }
  if (!features.length) {
    markWhatsNewSeen({ version, storageKey, storage });
    return Promise.resolve(finish({ shown: false, reason: 'no-features' }));
  }
  if (features.length > DEFAULTS.maxPages) {
    win.console?.warn?.(`whats-new: ${features.length} pages; keep it to ${DEFAULTS.maxPages} or fewer.`);
  }
  const run = (async () => {
    await waitForLoad(win);
    await nextFrame(win);
    await waitForOtherModals(win);
    if (!force) {
      const decision = whatsNewDecision(readStored(storage, storageKey), String(version));
      if (decision !== 'update') return finish({ shown: false, reason: decision });
    }
    return open();
  })();
  pending = run;
  const release = () => {
    if (pending === run) pending = null;
  };
  run.then(release, release);
  return run;

  function open() {
    const uid = ++instances;
    const count = features.length;
    const pager = count > 1;
    const motion = win.matchMedia?.(REDUCED);
    const reduced = () => Boolean(motion?.matches);
    const opener = doc.activeElement instanceof win.HTMLElement ? doc.activeElement : null;
    const controller = new AbortController();
    const { signal } = controller;
    let index = 0;
    let reason = 'close';
    let advanceTimer = 0;
    let advancing = pager && autoAdvanceMs > 0;
    let hovered = false;
    let settled = false;

    const dialog = element(doc, 'dialog', { class: 'wn', 'data-count': count, 'aria-labelledby': `wn-${uid}-title-0` });
    dialog.style.setProperty('--wn-aspect', aspectRatio);
    const card = element(doc, 'div', { class: 'wn-card' });
    const close = element(doc, 'button', { type: 'button', class: 'wn-close', 'aria-label': labels.close });
    close.append(element(doc, 'span', { class: 'wn-close-icon', 'aria-hidden': 'true' }));

    const pages = features.map((feature, at) => {
      const media = buildMedia(doc, feature.media, labels);
      const titleId = `wn-${uid}-title-${at}`;
      const body = element(doc, 'div', { class: 'wn-body' }, [
        feature.badge ? element(doc, 'p', { class: 'wn-badge', text: feature.badge }) : null,
        element(doc, 'h2', { class: 'wn-title', id: titleId, text: feature.title ?? '' }),
        feature.body ? element(doc, 'p', { class: 'wn-desc', text: feature.body }) : null,
      ]);
      const page = element(doc, 'section', { class: 'wn-page' }, [media.frame, body]);
      if (pager) {
        page.setAttribute('role', 'group');
        page.setAttribute('aria-roledescription', 'slide');
        page.setAttribute('aria-label', format(labels.pageOf, at + 1, count));
      }
      return { page, titleId, ...media, userPaused: false, userStarted: false, rejected: false, long: false, rewind: false };
    });

    const track = element(doc, 'div', { class: 'wn-track' }, pages.map((entry) => entry.page));
    const region = element(doc, 'div', { class: 'wn-pages' }, [track]);
    const primaryNext = element(doc, 'span', { class: 'wn-primary-label', 'data-label': 'next', text: labels.nextButton });
    const primaryDone = element(doc, 'span', { class: 'wn-primary-label', 'data-label': 'done', text: labels.done });
    const primary = element(doc, 'button', { type: 'button', class: 'wn-primary', autofocus: true }, [
      pager ? primaryNext : null,
      primaryDone,
    ]);
    let prev = null;
    let next = null;
    let dots = [];
    let rotate = null;
    if (pager) {
      region.setAttribute('aria-roledescription', 'carousel');
      region.setAttribute('aria-label', labels.region);
      track.setAttribute('aria-live', advancing ? 'off' : 'polite');
      prev = element(doc, 'button', { type: 'button', class: 'wn-prev', 'aria-label': labels.previous });
      next = element(doc, 'button', { type: 'button', class: 'wn-next', 'aria-label': labels.next });
      prev.append(element(doc, 'span', { class: 'wn-arrow-icon', 'aria-hidden': 'true' }));
      next.append(element(doc, 'span', { class: 'wn-arrow-icon', 'aria-hidden': 'true' }));
      dots = pages.map((_, at) => element(doc, 'button', {
        type: 'button',
        class: 'wn-dot',
        'aria-label': format(labels.dot, at + 1, count),
      }));
      const dotRow = element(doc, 'div', { class: 'wn-dots' }, dots);
      region.append(element(doc, 'div', { class: 'wn-nav' }, [prev, dotRow, next]));
      if (advancing) {
        rotate = element(doc, 'button', { type: 'button', class: 'wn-rotate', 'aria-label': labels.stopAdvance });
        rotate.append(element(doc, 'span', { class: 'wn-pause-icon', 'aria-hidden': 'true' }));
        region.prepend(rotate);
      }
    } else {
      dialog.classList.add('wn-single');
    }
    region.append(primary);
    if (releaseNotesUrl) {
      region.append(element(doc, 'a', { class: 'wn-notes', href: releaseNotesUrl, text: labels.releaseNotes }));
    }
    card.append(close, region);
    dialog.append(card);

    const playVideo = (entry) => {
      const { video } = entry;
      let started;
      try {
        started = video.play();
      } catch {
        started = Promise.reject(new Error('play failed'));
      }
      Promise.resolve(started).then(() => {
        entry.rejected = false;
        updateToggle(entry);
      }, () => {
        if (pages[index] !== entry) return;
        entry.rejected = true;
        video.pause();
        updateToggle(entry);
      });
    };

    const updateToggle = (entry) => {
      const { video, toggle } = entry;
      if (!video) return;
      const playing = !video.paused && !video.ended;
      const needed = entry.long || entry.rejected || reduced() || entry.userPaused || entry.userStarted;
      toggle.hidden = !needed;
      toggle.setAttribute('aria-label', playing ? labels.pause : labels.play);
      toggle.dataset.state = playing ? 'playing' : 'paused';
    };

    const syncMedia = () => {
      pages.forEach((entry, at) => {
        const { video } = entry;
        if (!video) return;
        const current = at === index && dialog.open;
        const allowed = current && !entry.userPaused && (entry.userStarted || !reduced());
        if (allowed) {
          if (video.paused) playVideo(entry);
        } else {
          video.pause();
          if (!current) {
            entry.userStarted = false;
            entry.rejected = false;
            if (video.readyState > 0 && video.currentTime !== 0) {
              try {
                video.currentTime = 0;
              } catch {
                entry.rewind = true;
              }
            }
          }
        }
        updateToggle(entry);
      });
    };

    pages.forEach((entry) => {
      const { video, toggle } = entry;
      if (!video) return;
      video.addEventListener('loadedmetadata', () => {
        entry.long = video.loop && Number.isFinite(video.duration) && video.duration > DEFAULTS.pauseAfterSeconds;
        if (entry.rewind && pages[index] !== entry) video.currentTime = 0;
        entry.rewind = false;
        updateToggle(entry);
      }, { signal });
      video.addEventListener('play', () => updateToggle(entry), { signal });
      video.addEventListener('pause', () => updateToggle(entry), { signal });
      toggle.addEventListener('click', () => {
        if (video.paused) {
          entry.userPaused = false;
          entry.userStarted = true;
          playVideo(entry);
        } else {
          entry.userPaused = true;
          video.pause();
        }
        updateToggle(entry);
      }, { signal });
    });

    const setAria = (button, disabled) => {
      if (disabled) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    };

    const show = (target) => {
      index = Math.max(0, Math.min(count - 1, target));
      pages.forEach((entry, at) => {
        const current = at === index;
        entry.page.toggleAttribute('data-current', current);
        entry.page.dataset.side = current ? 'current' : at < index ? 'before' : 'after';
        entry.page.toggleAttribute('inert', !current);
        if (current) entry.page.removeAttribute('aria-hidden');
        else entry.page.setAttribute('aria-hidden', 'true');
      });
      dialog.setAttribute('aria-labelledby', pages[index].titleId);
      dots.forEach((dot, at) => {
        if (at === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (prev) setAria(prev, index === 0);
      if (next) setAria(next, index === count - 1);
      const last = index === count - 1;
      primary.dataset.label = last ? 'done' : 'next';
      primaryDone.toggleAttribute('data-active', last);
      primaryNext.toggleAttribute('data-active', !last);
      const active = doc.activeElement;
      if (active && pages.some((entry) => entry.page.hasAttribute('inert') && entry.page.contains(active))) primary.focus();
      dialog.dataset.page = String(index + 1);
      syncMedia();
      scheduleAdvance();
    };

    const dismiss = (why) => {
      reason = why;
      if (dialog.open) dialog.close(why);
    };

    const go = (step) => {
      const target = index + step;
      if (target < 0 || target >= count) return;
      show(target);
    };

    const stopAdvance = () => {
      advancing = false;
      win.clearTimeout(advanceTimer);
      advanceTimer = 0;
      if (rotate) {
        rotate.setAttribute('aria-label', labels.startAdvance);
        rotate.dataset.state = 'paused';
        track.setAttribute('aria-live', 'polite');
      }
    };

    function scheduleAdvance() {
      win.clearTimeout(advanceTimer);
      advanceTimer = 0;
      if (!advancing || hovered || reduced() || !dialog.open || index >= count - 1) return;
      advanceTimer = win.setTimeout(() => {
        advanceTimer = 0;
        show(index + 1);
      }, autoAdvanceMs);
    }

    close.addEventListener('click', () => dismiss('close'), { signal });
    primary.addEventListener('click', () => {
      if (index < count - 1) go(1);
      else dismiss('done');
    }, { signal });
    prev?.addEventListener('click', () => {
      if (prev.getAttribute('aria-disabled') !== 'true') go(-1);
    }, { signal });
    next?.addEventListener('click', () => {
      if (next.getAttribute('aria-disabled') !== 'true') go(1);
    }, { signal });
    dots.forEach((dot, at) => dot.addEventListener('click', () => show(at), { signal }));
    rotate?.addEventListener('click', () => {
      if (advancing) {
        stopAdvance();
      } else {
        advancing = true;
        rotate.setAttribute('aria-label', labels.stopAdvance);
        rotate.dataset.state = 'playing';
        track.setAttribute('aria-live', 'off');
        scheduleAdvance();
      }
    }, { signal });
    card.addEventListener('pointerenter', () => {
      hovered = true;
      scheduleAdvance();
    }, { signal });
    card.addEventListener('pointerleave', () => {
      hovered = false;
      scheduleAdvance();
    }, { signal });

    let opening = true;
    dialog.addEventListener('focusin', (event) => {
      if (!opening && advancing && event.target !== rotate) stopAdvance();
    }, { signal });

    dialog.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof win.Element ? event.target : null;
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button, a[href], input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])')]
          .filter((node) => !node.hidden && !node.closest('[inert]') && node.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && doc.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (target?.closest(TEXT_FIELD)) return;
      if (pager && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const rtl = win.getComputedStyle(dialog).direction === 'rtl';
        const forward = (event.key === 'ArrowRight') !== rtl;
        go(forward ? 1 : -1);
        return;
      }
      if (event.key === 'Enter' && !target?.closest('button, a[href], summary')) {
        event.preventDefault();
        primary.click();
      }
    }, { signal });

    dialog.addEventListener('cancel', () => {
      reason = 'cancel';
    }, { signal });

    motion?.addEventListener?.('change', () => {
      dialog.toggleAttribute('data-reduced-motion', reduced());
      syncMedia();
      scheduleAdvance();
    }, { signal });

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => {
        if (settled) return;
        settled = true;
        stopAdvance();
        pages.forEach(({ video }) => video?.pause());
        markWhatsNewSeen({ version, storageKey, storage });
        controller.abort();
        dialog.remove();
        if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
        resolve(finish({ shown: true, reason, page: index + 1 }));
      });
      dialog.toggleAttribute('data-reduced-motion', reduced());
      (parent ?? doc.body).append(dialog);
      show(0);
      dialog.showModal();
      primary.focus();
      opening = false;
      syncMedia();
      scheduleAdvance();
    });
  }
}
