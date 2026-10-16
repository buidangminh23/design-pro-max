/**
 * Media for the launch-scroll fixtures, generated with ffmpeg from synthetic sources so no media file is ever
 * committed. The good film goes through the part's own encode-scrub.mjs, which the fixtures therefore exercise too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TO_DISPLAY_RGB = 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24';
const SOURCE = 'cellauto=size=1280x720:rate=30:rule=110';

function run(tool, args) {
  const result = spawnSync(tool, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new Error(`${tool} was not found on PATH`);
  if (result.status !== 0) throw new Error(`${tool} ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result;
}

const ffmpeg = (...args) => run('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...args]);

const H264 = ['-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart'];

/** Builds every recipe into `folder` once and returns a map from recipe name to file. */
export function buildFixtureMedia(folder, { encodeScrub }) {
  fs.mkdirSync(folder, { recursive: true });
  const file = (name) => path.join(folder, name);
  const master = file('master.mkv');
  if (!fs.existsSync(master)) ffmpeg('-f', 'lavfi', '-i', SOURCE, '-t', '3', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '12', master);
  const encoded = path.join(folder, 'encoded');
  if (!fs.existsSync(path.join(encoded, 'film.mp4'))) run(process.execPath, [encodeScrub, master, '--out', encoded, '--width', '640', '--webm']);
  const media = {
    film: path.join(encoded, 'film.mp4'),
    'film-webm': path.join(encoded, 'film.webm'),
    startframe: path.join(encoded, 'startframe.jpg'),
    still: path.join(encoded, 'still.jpg'),
    'startframe-wrong': file('startframe-wrong.jpg'),
    'film-long-gop': file('film-long-gop.mp4'),
    'startframe-long-gop': file('startframe-long-gop.jpg'),
    'film-open-gop': file('film-open-gop.mp4'),
    'film-vp9': file('film-vp9.webm'),
  };
  const build = (name, ...args) => {
    if (!fs.existsSync(media[name])) ffmpeg(...args, media[name]);
  };
  build('startframe-wrong', '-ss', '1.5', '-i', media.film, '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2');
  build('film-long-gop', '-i', master, ...H264, '-crf', '23');
  build('startframe-long-gop', '-i', media['film-long-gop'], '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2');
  build('film-open-gop', '-i', master, '-vf', 'scale=640:-2', ...H264, '-crf', '23', '-x264-params', 'keyint=6:min-keyint=6:scenecut=0:open-gop=1');
  build('film-vp9', '-i', master, '-an', '-vf', 'scale=640:-2', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-g', '6', '-keyint_min', '6', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '8');
  return media;
}
