const scene = document.querySelector('.scene');
const film = document.querySelector('.film');
const title = document.querySelector('.title');
film.pause();
addEventListener('scroll', () => {
  const rect = scene.getBoundingClientRect();
  const p = Math.min(Math.max(-rect.top / (scene.offsetHeight - innerHeight), 0), 1);
  if (film.duration && !film.seeking) film.currentTime = p * film.duration;
  title.style.opacity = p > 0.8 ? 1 : 0;
}, { passive: true });
