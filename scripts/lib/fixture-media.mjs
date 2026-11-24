/**
 * Media for the own parts' fixtures, generated with ffmpeg from synthetic sources so no media file is ever committed.
 *
 *   buildFixtureMedia(folder, { encodeScrub, makeSequence })  launch-scroll and launch-page cases
 *   buildLaunchVideoMedia(folder, { encode })                 launch-video cases
 *
 * Good media go through the parts' own encode-scrub.mjs, make-sequence.mjs and encode.mjs, which the fixtures therefore
 * exercise too; each bad recipe breaks one rule.
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

const LV_TAGS = 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709';
const H264 = ['-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart'];

/** Builds every recipe into `folder` once and returns a map from recipe name to file. */
export function buildFixtureMedia(folder, { encodeScrub, makeSequence }) {
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
    'clip-aac': file('clip-aac.mp4'),
    'clip-hevc': file('clip-hevc.mp4'),
    sequence: path.join(folder, 'sequence'),
  };
  const build = (name, ...args) => {
    if (!fs.existsSync(media[name])) ffmpeg(...args, media[name]);
  };
  build('startframe-wrong', '-ss', '1.5', '-i', media.film, '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2');
  build('film-long-gop', '-i', master, ...H264, '-crf', '23');
  build('startframe-long-gop', '-i', media['film-long-gop'], '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2');
  build('film-open-gop', '-i', master, '-vf', 'scale=640:-2', ...H264, '-crf', '23', '-x264-params', 'keyint=6:min-keyint=6:scenecut=0:open-gop=1');
  build('film-vp9', '-i', master, '-an', '-vf', 'scale=640:-2', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-g', '6', '-keyint_min', '6', '-pix_fmt', 'yuv420p', '-deadline', 'realtime', '-cpu-used', '8');
  build('clip-aac', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '2', '-threads', '2', '-vf', `format=yuv420p,${LV_TAGS}`, '-c:v', 'libx264', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart');
  build('clip-hevc', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-t', '2', '-threads', '2', '-an', '-vf', `format=yuv420p,${LV_TAGS}`, '-c:v', 'libx265', '-x265-params', 'log-level=error:pools=2', '-tag:v', 'hvc1', '-movflags', '+faststart');
  if (makeSequence && !fs.existsSync(path.join(media.sequence, 'sequence.json'))) {
    run(process.execPath, [makeSequence, master, '--out', media.sequence, '--width', '640', '--format', 'jpg']);
  }
  return media;
}

const LV_SOURCE = (seconds, size = '640x360', rate = 30) => ['-f', 'lavfi', '-i', `cellauto=size=${size}:rate=${rate}:rule=110`, '-t', String(seconds)];
const LV_THREADS = ['-threads', '2'];

/**
 * Media for the launch-video fixtures, from the same synthetic source at 640x360 or smaller. The good clips go through
 * the part's own encode.mjs; each bad recipe breaks exactly one encode rule.
 */
export function buildLaunchVideoMedia(folder, { encode }) {
  fs.mkdirSync(folder, { recursive: true });
  const file = (name) => path.join(folder, name);
  const masters = { clip: [file('lv-master.mkv'), 2], loop: [file('lv-loop-master.mkv'), 6] };
  for (const [name, [master, seconds]] of Object.entries(masters)) {
    if (!fs.existsSync(master)) ffmpeg(...LV_SOURCE(seconds), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '12', ...LV_THREADS, master);
    const out = path.join(folder, name);
    if (!fs.existsSync(path.join(out, `${name}.mp4`))) run(process.execPath, [encode, master, '--out', out, '--name', name, '--profiles', 'h264,vp9', '--threads', '2']);
  }
  const media = {
    'lv-clip': path.join(folder, 'clip', 'clip.mp4'),
    'lv-clip-webm': path.join(folder, 'clip', 'clip.webm'),
    'lv-clip-start': path.join(folder, 'clip', 'clip.start.jpg'),
    'lv-loop': path.join(folder, 'loop', 'loop.mp4'),
    'lv-loop-webm': path.join(folder, 'loop', 'loop.webm'),
    'lv-loop-start': path.join(folder, 'loop', 'loop.start.jpg'),
    'lv-yuvj': file('lv-yuvj.mp4'),
    'lv-444': file('lv-444.mp4'),
    'lv-moov-end': file('lv-moov-end.mp4'),
    'lv-aac': file('lv-aac.mp4'),
    'lv-untagged': file('lv-untagged.mp4'),
    'lv-start-wrong': file('lv-start-wrong.jpg'),
    'lv-recorded': file('lv-recorded.webm'),
  };
  const master = masters.clip[0];
  const build = (name, ...args) => {
    if (!fs.existsSync(media[name])) ffmpeg(...args, ...LV_THREADS, media[name]);
  };
  build('lv-yuvj', '-i', master, '-an', '-vf', `format=yuvj420p,${LV_TAGS}`, '-c:v', 'libx264', '-profile:v', 'high', '-movflags', '+faststart');
  build('lv-444', '-i', master, '-an', '-vf', `format=yuv444p,${LV_TAGS}`, '-c:v', 'libx264', '-movflags', '+faststart');
  build('lv-moov-end', '-i', master, '-an', '-vf', `format=yuv420p,${LV_TAGS}`, '-c:v', 'libx264', '-profile:v', 'high');
  build('lv-aac', '-i', master, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-vf', `format=yuv420p,${LV_TAGS}`, '-c:v', 'libx264', '-profile:v', 'high', '-c:a', 'aac', '-movflags', '+faststart');
  build('lv-untagged', '-i', master, '-an', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-movflags', '+faststart');
  build('lv-start-wrong', '-ss', '1.5', '-i', media['lv-clip'], '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2');
  build('lv-recorded', ...LV_SOURCE(2.2, '400x225', 25), '-an', '-c:v', 'libvpx', '-b:v', '1M', '-deadline', 'realtime', '-cpu-used', '8');
  return media;
}
