const scene = document.querySelector('.feature-scene');
function update() {
  const rect = scene.getBoundingClientRect();
  const p = Math.min(Math.max(-rect.top / (scene.offsetHeight - innerHeight), 0), 1);
  scene.style.setProperty('--p', p);
}
addEventListener('scroll', update, { passive: true });
update();
