import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'still';
const out = path.resolve(process.argv[3] || path.join(root, 'output'));
const width = Number(process.env.W || (mode === 'still' ? 5120 : 3840));
const fps = Number(process.env.FPS || 30);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
page.on('pageerror', (error) => console.error('pageerror', error.message));
await page.route('http://scene.local/**', async (route) => {
  const file = path.join(root, decodeURIComponent(new URL(route.request().url()).pathname));
  if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
});
await page.goto(`http://scene.local/scene.html?w=${width}`);
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 120000 });

async function grab(t, file) {
  const data = await page.evaluate((time) => { window.renderAt(time); return document.querySelector('canvas').toDataURL('image/png'); }, t);
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`ffmpeg failed: ${result.error?.message ?? `exit ${result.status}`}`);
}

if (mode === 'still') {
  const frame = path.join(out, 'still-raw.png');
  await grab(Number(process.env.T || 4), frame);
  ffmpeg(['-i', frame, '-vf', 'scale=3840:-2:flags=lanczos', path.join(out, 'devices-4k.png')]);
  fs.rmSync(frame);
} else if (mode === 'video') {
  const frames = fs.mkdtempSync(path.join(out, 'frames-'));
  const count = Math.round((await page.evaluate(() => window.sceneDuration)) * fps);
  for (let i = 0; i < count; i += 1) await grab(i / fps, path.join(frames, `f${String(i).padStart(4, '0')}.png`));
  ffmpeg(['-framerate', String(fps), '-i', path.join(frames, 'f%04d.png'), '-vf', 'scale=2560:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '15', '-preset', 'slow', '-movflags', '+faststart', path.join(out, 'devices-8s.mp4')]);
  fs.rmSync(frames, { recursive: true, force: true });
} else {
  console.error('usage: node render.mjs [still|video] [output dir]');
  process.exitCode = 2;
}
await browser.close();
