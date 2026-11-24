const VERSION = '5.2.0';
const pages = [
  { title: 'Offline maps', body: 'Download a region and use it without a connection.', video: 'clips/offline.mp4' },
  { title: 'Shared lists', body: 'Plan a trip together and see changes as they happen.', video: 'clips/lists.mp4' },
  { title: 'Night mode', body: 'Maps dim automatically after sunset.', video: 'clips/night.mp4' },
];

function build() {
  const box = document.createElement('div');
  box.className = 'wn-box';
  box.innerHTML = `
    <span class="wn-x" onclick="this.closest('.wn-box').remove()">x</span>
    <div class="wn-track">${pages.map((page, i) => `
      <div class="wn-slide" data-i="${i}">
        <video src="${page.video}" autoplay loop></video>
        <h2>${page.title}</h2>
        <p>${page.body}</p>
      </div>`).join('')}
    </div>
    <div class="wn-nav">
      <button class="wn-prev">&lt;</button>
      ${pages.map((_, i) => `<button class="wn-dot" data-i="${i}"></button>`).join('')}
      <button class="wn-next">&gt;</button>
    </div>
    <button class="wn-ok">Next</button>`;
  document.body.append(box);
  let index = 0;
  const show = (i) => {
    index = Math.max(0, Math.min(pages.length - 1, i));
    box.querySelector('.wn-track').style.transform = `translateX(-${index * 100}%)`;
    box.querySelector('.wn-prev').style.display = index === 0 ? 'none' : '';
    box.querySelector('.wn-next').style.display = index === pages.length - 1 ? 'none' : '';
  };
  box.querySelector('.wn-prev').onclick = () => show(index - 1);
  box.querySelector('.wn-next').onclick = () => show(index + 1);
  box.querySelectorAll('.wn-dot').forEach((dot) => { dot.onclick = () => show(Number(dot.dataset.i)); });
  box.querySelector('.wn-ok').onclick = () => (index === pages.length - 1 ? box.remove() : show(index + 1));
  show(0);
}

if (localStorage.getItem('atlas:whats-new') !== VERSION) {
  localStorage.setItem('atlas:whats-new', VERSION);
  build();
}
