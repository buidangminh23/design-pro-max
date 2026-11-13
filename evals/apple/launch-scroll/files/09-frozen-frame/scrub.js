const video = document.querySelector('[data-film]');
const scene = document.querySelector('[data-scene]');
video.src = '/media/film.mp4';
video.load();

let seeking = false;
let pending = null;
video.addEventListener('seeked', () => {
  seeking = false;
  if (pending !== null) { const t = pending; pending = null; seek(t); }
});
function seek(time) {
  if (seeking) { pending = time; return; }
  seeking = true;
  video.currentTime = time;
}
window.addEventListener('scroll', () => {
  const rect = scene.getBoundingClientRect();
  const progress = Math.min(Math.max(-rect.top / (scene.offsetHeight - innerHeight), 0), 1);
  if (video.duration) seek(progress * video.duration);
}, { passive: true });
