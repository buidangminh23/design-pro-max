// launch-scroll frame-window.js (design-pro-max). Copy into the project with scene-progress.js, scrub-loader.js and
// seek-queue.js (scrub-loader.js imports it).
//
// A scroll-scrubbed image sequence drawn to a canvas. The encoded frames are fetched once the scene is near, nearest
// to the current frame first, and stay in memory as the download (the sequence's total encoded bytes); only a window of
// decoded frames around the current one (expensive: width x height x 4 bytes each) is kept, and every ImageBitmap that
// leaves the window is closed. Decoded memory is therefore at most (2 x radius + 1) x width x height x 4 bytes, plus
// the decodes in flight, whatever the length of the sequence; when the scene stops pinning the window is emptied and
// fetching pauses. A frame that keeps failing is skipped after a few tries, and losing the current frame fails the scene.
// Markup: [data-scene-film] holding the still, the start image (frame 0) and <canvas data-sequence
// data-src="sequence.json">, where sequence.json is written by scripts/make-sequence.mjs. Nothing is requested
// before the gates pass: reduced motion, a short viewport and a rejected muted play() keep the static layout.

import { clampProgress, createScene } from './scene-progress.js';
import { probeAutoplay } from './scrub-loader.js';

export const DEFAULTS = Object.freeze({
  radius: 8,
  decodeConcurrency: 2,
  fetchConcurrency: 4,
  maxPixelRatio: 2,
  timeoutMs: 10000,
  retries: 2,
  loadMargin: '200% 0px 200% 0px',
  probeTimeoutMs: 2000,
});

export function decodedBytes(frames, width, height) {
  return frames * width * height * 4;
}

export function windowFrames(radius, count) {
  return Math.max(0, Math.min(count, 2 * radius + 1));
}

export function radiusForBudget(budgetBytes, width, height) {
  const frames = Math.floor(budgetBytes / decodedBytes(1, width, height));
  return frames < 1 ? -1 : Math.floor((frames - 1) / 2);
}

export function frameAt(progress, count) {
  if (count <= 1) return 0;
  return Math.round(clampProgress(progress) * (count - 1));
}

export function windowRange(center, radius, count) {
  if (count <= 0) return { start: 0, end: -1 };
  const size = windowFrames(radius, count);
  const start = Math.min(Math.max(0, center - radius), count - size);
  return { start, end: start + size - 1 };
}

export function decodeOrder(center, radius, count, direction = 1) {
  const { start, end } = windowRange(center, radius, count);
  const ahead = direction < 0 ? -1 : 1;
  const order = [];
  for (let index = start; index <= end; index += 1) order.push(index);
  return order.sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || (b - a) * ahead);
}

export function* fetchOrder(center, radius, count, direction = 1) {
  const ahead = direction < 0 ? -1 : 1;
  const { start, end } = windowRange(center, radius, count);
  yield* decodeOrder(center, radius, count, direction);
  for (let distance = 1; distance < count; distance += 1) {
    for (const index of [center + distance * ahead, center - distance * ahead]) {
      if (index >= 0 && index < count && (index < start || index > end)) yield index;
    }
  }
}

export function nearestIndex(index, available) {
  let best = -1;
  for (const candidate of available) {
    const distance = Math.abs(candidate - index);
    if (best < 0 || distance < Math.abs(best - index) || (distance === Math.abs(best - index) && candidate < best)) best = candidate;
  }
  return best;
}

export const FRAME_PLACEHOLDER = /%(?:0(\d+))?d/;

export function frameUrl(template, index) {
  return template.replace(FRAME_PLACEHOLDER, (_, width) => String(index).padStart(Number(width) || 0, '0'));
}

export function coverRect(sourceWidth, sourceHeight, width, height) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight };
}

export function validateManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['the manifest is not an object'];
  if (!Number.isInteger(manifest.count) || manifest.count < 1) problems.push('count must be a positive integer');
  for (const key of ['width', 'height']) if (!Number.isInteger(manifest[key]) || manifest[key] < 1) problems.push(`${key} must be a positive integer`);
  if (typeof manifest.frames !== 'string' || (manifest.frames.match(/%/g) ?? []).length !== 1 || !FRAME_PLACEHOLDER.test(manifest.frames)) problems.push('frames must be a template with one %0Nd or %d, such as frames/f%04d.jpg');
  return problems;
}

const defaultFetch = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.blob();
};

const defaultDecode = (blob) => createImageBitmap(blob);

export function withTimeout(signal, timeoutMs) {
  if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('The frame request timed out', 'TimeoutError')), timeoutMs);
  const forward = () => controller.abort(signal.reason);
  if (signal.aborted) forward();
  else signal.addEventListener('abort', forward, { once: true });
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

export function createFrameWindow({ urls, radius = DEFAULTS.radius, decodeConcurrency = DEFAULTS.decodeConcurrency, fetchConcurrency = DEFAULTS.fetchConcurrency, timeoutMs = DEFAULTS.timeoutMs, retries = DEFAULTS.retries, fetchFrame = defaultFetch, decode = defaultDecode, onDecoded = () => {}, onError = () => {}, onLost = () => {} }) {
  const count = urls.length;
  const encoded = new Map();
  const fetching = new Set();
  const decoded = new Map();
  const decoding = new Set();
  const failures = new Map();
  const controller = new AbortController();
  let center = 0;
  let direction = 1;
  let destroyed = false;
  let paused = false;
  let lost = false;

  const inWindow = (index) => {
    const { start, end } = windowRange(center, radius, count);
    return index >= start && index <= end;
  };
  const gaveUp = (index) => (failures.get(index) ?? 0) >= retries;

  const checkLost = () => {
    if (!lost && gaveUp(center)) {
      lost = true;
      onLost(center);
    }
  };

  const fail = (index, error) => {
    failures.set(index, (failures.get(index) ?? 0) + 1);
    onError(error);
    checkLost();
  };

  const closeAll = () => {
    for (const bitmap of decoded.values()) bitmap.close?.();
    decoded.clear();
  };

  const evict = () => {
    for (const [index, bitmap] of decoded) {
      if (!inWindow(index)) {
        bitmap.close?.();
        decoded.delete(index);
      }
    }
  };

  const startFetch = (index) => {
    fetching.add(index);
    Promise.resolve()
      .then(() => fetchFrame(urls[index], withTimeout(controller.signal, timeoutMs)))
      .then((blob) => {
        fetching.delete(index);
        if (destroyed) return;
        encoded.set(index, blob);
        pump();
      }, (error) => {
        fetching.delete(index);
        if (destroyed) return;
        fail(index, error);
        pump();
      });
  };

  const startDecode = (index) => {
    decoding.add(index);
    Promise.resolve()
      .then(() => decode(encoded.get(index)))
      .then((bitmap) => {
        decoding.delete(index);
        if (destroyed || paused || !inWindow(index)) bitmap.close?.();
        else {
          decoded.set(index, bitmap);
          onDecoded(index);
        }
        pump();
      }, (error) => {
        decoding.delete(index);
        if (destroyed) return;
        encoded.delete(index);
        fail(index, error);
        pump();
      });
  };

  const pump = () => {
    if (destroyed || paused) return;
    for (const index of decodeOrder(center, radius, count, direction)) {
      if (decoding.size >= decodeConcurrency) break;
      if (decoded.has(index) || decoding.has(index) || !encoded.has(index) || gaveUp(index)) continue;
      startDecode(index);
    }
    if (fetching.size >= fetchConcurrency || encoded.size + fetching.size >= count) return;
    for (const index of fetchOrder(center, radius, count, direction)) {
      if (fetching.size >= fetchConcurrency) break;
      if (encoded.has(index) || fetching.has(index) || gaveUp(index)) continue;
      startFetch(index);
    }
  };

  return {
    count,
    get center() {
      return center;
    },
    get live() {
      return decoded.size;
    },
    get fetched() {
      return encoded.size;
    },
    get lost() {
      return lost;
    },
    failed(index) {
      return gaveUp(index);
    },
    setCenter(index) {
      if (destroyed) return;
      const next = Math.min(count - 1, Math.max(0, index));
      if (next !== center) direction = next > center ? 1 : -1;
      center = next;
      paused = false;
      evict();
      checkLost();
      pump();
    },
    pause() {
      paused = true;
      closeAll();
    },
    nearest(index) {
      const at = nearestIndex(index, decoded.keys());
      return at < 0 ? null : { index: at, bitmap: decoded.get(at) };
    },
    destroy() {
      destroyed = true;
      controller.abort();
      closeAll();
      encoded.clear();
    },
  };
}

export async function loadManifest(url, { timeoutMs = DEFAULTS.timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const manifest = await response.json();
    const problems = validateManifest(manifest);
    if (problems.length) throw new Error(`${url}: ${problems.join('; ')}`);
    const base = new URL(url, location.href);
    return { ...manifest, urls: Array.from({ length: manifest.count }, (_, index) => new URL(frameUrl(manifest.frames, index), base).href) };
  } finally {
    clearTimeout(timer);
  }
}

function sizeCanvas(canvas, maxPixelRatio) {
  const ratio = Math.min(maxPixelRatio, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

export function mountSequenceScene(sceneElement, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const canvas = sceneElement.querySelector('canvas[data-sequence]');
  const context = canvas?.getContext('2d');
  let frames = null;
  let loading = false;
  let destroyed = false;
  let failed = false;
  let observer = null;
  let resizer = null;
  let drawn = -1;
  let target = 0;
  let frame = 0;

  const fail = (error) => {
    if (failed || destroyed) return;
    failed = true;
    sceneElement.dataset.scrubState = 'failed';
    frames?.destroy();
    settings.onError?.(error);
  };

  const draw = () => {
    frame = 0;
    if (!frames || !context || failed || destroyed) return;
    const index = frameAt(target, frames.count);
    const resized = sizeCanvas(canvas, settings.maxPixelRatio);
    const best = frames.nearest(index);
    if (!best || (best.index === drawn && !resized)) return;
    const rect = coverRect(best.bitmap.width, best.bitmap.height, canvas.width, canvas.height);
    context.drawImage(best.bitmap, rect.x, rect.y, rect.width, rect.height);
    drawn = best.index;
    sceneElement.dataset.sequenceFrame = String(drawn);
    if (sceneElement.dataset.scrubState !== 'ready') sceneElement.dataset.scrubState = 'ready';
  };
  const schedule = () => {
    if (!frame && !destroyed) frame = requestAnimationFrame(draw);
  };

  const scene = createScene(sceneElement, {
    ...options,
    gate: canvas ? probeAutoplay({ timeoutMs: settings.probeTimeoutMs }) : null,
    onProgress(progress, state) {
      target = progress;
      if (state === 'pinned' && frames && !failed) {
        frames.setCenter(frameAt(progress, frames.count));
        schedule();
      }
      options.onProgress?.(progress, state);
    },
    onState(state, reasons) {
      if (state === 'pinned') startWatching();
      else frames?.pause();
      options.onState?.(state, reasons);
    },
  });

  async function load() {
    if (loading || !canvas || destroyed) return;
    loading = true;
    observer?.disconnect();
    try {
      const manifest = await loadManifest(canvas.dataset.src, settings);
      if (destroyed) return;
      frames = createFrameWindow({
        ...settings,
        urls: manifest.urls,
        onDecoded: schedule,
        onError: (error) => settings.onError?.(error),
        onLost: (index) => fail(new Error(`frame ${index} could not be loaded`)),
      });
      if (scene.state === 'pinned') frames.setCenter(frameAt(scene.progress, frames.count));
      resizer = new ResizeObserver(schedule);
      resizer.observe(canvas);
      schedule();
    } catch (error) {
      fail(error);
    }
  }

  function startWatching() {
    if (!canvas || loading || observer || destroyed) return;
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && scene.state === 'pinned') load();
    }, { rootMargin: settings.loadMargin });
    observer.observe(sceneElement);
  }

  return {
    scene,
    get frames() {
      return frames;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      resizer?.disconnect();
      frames?.destroy();
      scene.destroy();
    },
  };
}
