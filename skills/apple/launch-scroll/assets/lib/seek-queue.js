// launch-scroll seek-queue.js (design-pro-max). Copy into the project; no dependencies.
//
// Latest-wins seeking for a scrubbed <video>: a new target is applied only when the element is not already seeking;
// otherwise it replaces the pending one and is applied on 'seeked'. A 'seeked' event can arrive after a newer seek has
// already started, so the handler waits while the element is still seeking and a direct write drops any older pending
// target. Targets are frame centres, (i + 0.5) / fps, so a
// rounding error never lands on the neighbouring frame. fastSeek() is never used: it snaps to keyframes.

export function frameTime(index, fps) {
  return (index + 0.5) / fps;
}

export function frameIndex(progress, frameCount) {
  if (frameCount <= 1) return 0;
  return Math.min(frameCount - 1, Math.max(0, Math.round(progress * (frameCount - 1))));
}

export function createSeekQueue(video, { fps = 30 } = {}) {
  let pending = null;
  let lastFrame = -1;

  const apply = (time) => {
    if (video.seeking) {
      pending = time;
      return;
    }
    pending = null;
    video.currentTime = time;
  };

  const onSeeked = () => {
    if (pending === null || video.seeking) return;
    const time = pending;
    pending = null;
    video.currentTime = time;
  };
  video.addEventListener('seeked', onSeeked);

  return {
    get frame() {
      return lastFrame;
    },
    frameCount() {
      return Number.isFinite(video.duration) ? Math.max(1, Math.round(video.duration * fps)) : 0;
    },
    seekToFrame(index) {
      if (index === lastFrame) return;
      lastFrame = index;
      apply(frameTime(index, fps));
    },
    seekToProgress(progress) {
      const count = this.frameCount();
      if (count) this.seekToFrame(frameIndex(progress, count));
    },
    destroy() {
      video.removeEventListener('seeked', onSeeked);
      pending = null;
    },
  };
}
