// launch-scroll scrub-loader.js (design-pro-max). Copy into the project with scene-progress.js and seek-queue.js.
//
// Scroll-scrubbed film for one scene. Order of work:
//   1. A muted play() probe on a tiny clip. A rejection (blocked autoplay, iOS Low Power Mode) keeps the scene static
//      and requests no film.
//   2. When the scene is within the load window (200vh ahead by default), the film is fetched whole into a Blob URL,
//      so seeking works even when the server ignores Range requests. mode: 'src' uses plain src and needs 206 Range.
//   3. Decoding is primed with play().then(pause); the video is revealed only after its first presented frame, over a
//      start image that is frame 0 of the film.
// Markup: <video data-scrub muted playsinline aria-hidden="true"> with <source data-src="film.mp4" type="..."> children,
// H.264 first. The data-src attribute keeps the browser from fetching before the gates pass.

import { createScene } from './scene-progress.js';
import { createSeekQueue } from './seek-queue.js';

export const PROBE_CLIP =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAALpbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAABAAAAAQAAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjh0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAEAAAAAAAAABAAAAAAGwbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABW21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAARtzdGJsAAAAt3N0c2QAAAAAAAAAAQAAAKdhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAK/+EAFWdCwArd7ARAAAADAEAAAAMAg8SJ4AEABWjODyyAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAE4gAAAB4AAAAGHN0dHMAAAAAAAAAAQAAAAEAAEAAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAA8AAAABAAAAFHN0Y28AAAAAAAAAAQAAAxkAAAA9dWR0YQAAADVtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAAhpbHN0AAAACGZyZWUAAAAXbWRhdAAAAAtliIQEvJigADijgA==';

export const DEFAULTS = Object.freeze({ fps: 30, mode: 'blob', timeoutMs: 10000, loadMargin: '200% 0px 200% 0px', probeTimeoutMs: 2000 });

/** Resolves null when muted inline playback is allowed, or a reason string when it is not. */
export async function probeAutoplay({ timeoutMs = DEFAULTS.probeTimeoutMs } = {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.src = PROBE_CLIP;
  let timer = 0;
  try {
    await Promise.race([
      video.play(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DOMException('probe timed out', 'TimeoutError')), timeoutMs);
      }),
    ]);
    return null;
  } catch (error) {
    return error?.name === 'NotAllowedError' || error?.name === 'TimeoutError' ? 'autoplay-blocked' : null;
  } finally {
    clearTimeout(timer);
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

export function readSources(video) {
  return [...video.querySelectorAll('source[data-src]')].map((source) => ({ src: source.dataset.src, type: source.type || '' }));
}

export function pickSource(video, sources) {
  return sources.find((source) => !source.type || video.canPlayType(source.type) !== '') ?? null;
}

function waitFor(target, event, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error(`${event} timed out`)), timeoutMs);
    const onEvent = () => done(null);
    const onError = () => done(new Error(`media error while waiting for ${event}`));
    function done(error) {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve();
    }
    const onAbort = () => done(new Error('aborted'));
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Fetches the chosen source, attaches it and waits for the first decoded data. Returns a release function. */
export async function loadFilm(video, { sources, mode = DEFAULTS.mode, timeoutMs = DEFAULTS.timeoutMs } = {}) {
  const source = pickSource(video, sources ?? readSources(video));
  if (!source) throw new Error('no playable source; ship an H.264 MP4');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let url = source.src;
  try {
    if (mode === 'blob') {
      const response = await fetch(source.src, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${source.src}`);
      url = URL.createObjectURL(await response.blob());
    }
    video.src = url;
    await waitFor(video, 'loadeddata', timeoutMs, controller.signal);
  } catch (error) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return { source, url, release: () => url.startsWith('blob:') && URL.revokeObjectURL(url) };
}

export async function primeFrames(video) {
  try {
    await video.play();
  } catch {
    return false;
  } finally {
    video.pause();
  }
  return true;
}

/** Calls onFrame once the video has presented a frame; falls back to 'seeked' plus a frame where rVFC is missing. */
export function onFirstFrame(video, onFrame) {
  if ('requestVideoFrameCallback' in video) {
    video.requestVideoFrameCallback(() => onFrame());
    return;
  }
  const fallback = () => requestAnimationFrame(() => onFrame());
  video.addEventListener('seeked', fallback, { once: true });
}

export function mountScrubScene(sceneElement, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const video = sceneElement.querySelector('video[data-scrub]');
  let queue = null;
  let film = null;
  let loading = false;
  let observer = null;

  const scene = createScene(sceneElement, {
    ...options,
    gate: video ? probeAutoplay({ timeoutMs: settings.probeTimeoutMs }) : null,
    onProgress(progress, state) {
      if (state === 'pinned') queue?.seekToProgress(progress);
      options.onProgress?.(progress, state);
    },
    onState(state, reasons) {
      if (state === 'pinned') startWatching();
      options.onState?.(state, reasons);
    },
  });

  async function load() {
    if (loading || !video) return;
    loading = true;
    observer?.disconnect();
    try {
      onFirstFrame(video, () => {
        sceneElement.dataset.scrubState = 'ready';
      });
      film = await loadFilm(video, settings);
      queue = createSeekQueue(video, { fps: settings.fps });
      await primeFrames(video);
      queue.seekToProgress(scene.progress);
    } catch (error) {
      sceneElement.dataset.scrubState = 'failed';
      settings.onError?.(error);
    }
  }

  function startWatching() {
    if (!video || loading || observer) return;
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && scene.state === 'pinned') load();
    }, { rootMargin: settings.loadMargin });
    observer.observe(sceneElement);
  }

  return {
    scene,
    destroy() {
      observer?.disconnect();
      queue?.destroy();
      film?.release();
      scene.destroy();
    },
  };
}
