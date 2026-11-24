import { showWhatsNew } from '../lib/whats-new.js';

export const VERSION = '3.1.0';

const COPY = [
  ['Redesigned', 'Pill mode, redrawn', 'The pill follows the height of the live activity area, so it lines up with the camera housing.'],
  ['New', 'Widgets on the desktop', 'Pin the timer and the clipboard widgets to the desktop; they refresh on their own.'],
  ['Improved', 'Shortcuts for everything', 'Every action in the pill now has a keyboard shortcut you can change in Settings.'],
  ['New', 'Quiet hours', 'Silence alerts on a schedule and let urgent ones through.'],
  ['Improved', 'Faster search', 'Results appear as you type, even in large libraries.'],
  ['New', 'Themes', 'Pick an accent colour for the pill and the widgets.'],
];

export function art(at = 0) {
  const node = document.createElement('div');
  node.className = 'fx-art';
  node.style.cssText = `width:100%;height:100%;background:linear-gradient(135deg, hsl(${(at * 70) % 360} 70% 80%), hsl(${(at * 70 + 40) % 360} 70% 65%));`;
  return node;
}

export function feature(at, media, body) {
  const [badge, title, text] = COPY[at % COPY.length];
  return { badge, title, body: body ?? text, media: media ?? { type: 'element', element: art(at) } };
}

export function artFeatures(count) {
  return Array.from({ length: count }, (_, at) => feature(at));
}

export function videoFeatures() {
  return [
    feature(0, { type: 'video', src: 'wn-loop.mp4', poster: 'wn-loop.jpg' }),
    feature(1, { type: 'video', src: 'wn-short.mp4', poster: 'wn-short.jpg' }),
    feature(2),
  ];
}

export function run(features, options = {}) {
  const trigger = document.getElementById('show');
  trigger?.addEventListener('click', () => showWhatsNew({ version: VERSION, features: features(), force: true, ...options }));
  return showWhatsNew({ version: VERSION, features: features(), ...options });
}

export function whenOpen(callback) {
  const timer = setInterval(() => {
    const dialog = document.querySelector('dialog.wn[open]');
    if (dialog && !dialog.dataset.fixture) {
      dialog.dataset.fixture = 'seen';
      callback(dialog);
    }
  }, 50);
  return timer;
}
