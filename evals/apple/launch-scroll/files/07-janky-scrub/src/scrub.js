const video = document.querySelector('video.film');
const section = document.querySelector('.film-section');
let target = 0;
let current = 0;

window.addEventListener('scroll', () => {
  const rect = section.getBoundingClientRect();
  const travel = section.offsetHeight - window.innerHeight;
  target = Math.min(Math.max(-rect.top / travel, 0), 1) * video.duration;
  video.currentTime = target;
});

function tick() {
  current += (target - current) * 0.1;
  if (video.fastSeek) video.fastSeek(current);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
