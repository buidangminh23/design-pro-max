/**
 * launch-video encoder for App Store app previews. It encodes footage the user supplies, a screen capture of the app
 * itself, into the published specification for one display class, then checks its own output with the shared
 * check-media app-preview profile. It records nothing and never writes footage of its own. Calls ffmpeg (never
 * bundled).
 *
 *   node app-preview.mjs <footage> --device <class> --out <file> [--orientation portrait|landscape]
 *                        [--start <seconds>] [--duration <seconds>] [--fit pad|crop] [--background #000000]
 *                        [--threads <n>] [--force]
 *
 * H.264 High at level 4.0 in .mp4, .m4v or .mov for every class except vision-pro, whose 3840x2160 frame exceeds
 * level 4.0 and is written as ProRes 422 HQ in .mov. Video is progressive, at most 30 fps, at the exact size of the
 * class and orientation; the frame is scaled to fit and padded (or cropped with --fit crop), never stretched. Audio is
 * one stereo track at 48 kHz: the footage's own sound as 256 kbps AAC (24-bit PCM for ProRes), or silence when the
 * footage has none. The clip must last 15 to 30 seconds after --start and --duration; the script refuses anything
 * else rather than speeding up or looping footage. It lists the output first and stops when the file exists, unless
 * --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import { APP_PREVIEW, appPreviewDevice, checkAppPreviewFile, MEDIA_BOUNDARY, probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';
import { ffmpegFailure } from './encode.mjs';

export const VERSION = '1.0.0';
export const PRORES_DEVICES = new Set(['vision-pro']);
const USAGE = 'Usage: node app-preview.mjs <footage> --device <class> --out <file> [--orientation portrait|landscape] [--start <seconds>] [--duration <seconds>] [--fit pad|crop] [--background #000000] [--threads <n>] [--force]';
const COLOUR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];

export function parseArgs(argv) {
  const options = { footage: null, device: null, out: null, orientation: null, start: 0, duration: null, fit: 'pad', background: '#000000', threads: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--device') options.device = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--orientation') options.orientation = value();
    else if (arg === '--start') options.start = Number(value());
    else if (arg === '--duration') options.duration = Number(value());
    else if (arg === '--fit') options.fit = value();
    else if (arg === '--background') options.background = value();
    else if (arg === '--threads') options.threads = Number(value());
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`, USAGE);
    else if (!options.footage) options.footage = arg;
    else throw new UsageError(`Unexpected argument ${arg}.`, USAGE);
  }
  if (!options.footage || !options.device || !options.out) throw new UsageError(USAGE);
  appPreviewDevice(options.device);
  if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) throw new UsageError('--orientation is portrait or landscape.', USAGE);
  if (!['pad', 'crop'].includes(options.fit)) throw new UsageError('--fit is pad or crop.', USAGE);
  if (!Number.isFinite(options.start) || options.start < 0) throw new UsageError('--start is a number of seconds, 0 or more.', USAGE);
  if (options.duration !== null && !(options.duration > 0)) throw new UsageError('--duration is a positive number of seconds.', USAGE);
  if (!/^#[0-9a-fA-F]{6}$/.test(options.background)) throw new UsageError('--background is a colour like #000000.', USAGE);
  const extension = path.extname(options.out).toLowerCase();
  const allowed = PRORES_DEVICES.has(options.device) ? APP_PREVIEW.proresContainers : APP_PREVIEW.h264Containers;
  if (!allowed.includes(extension)) throw new UsageError(`${options.device} previews are written as ${allowed.join(', ')}; got ${extension || 'no extension'}.`, USAGE);
  return options;
}

/** The target frame for a class: the size whose orientation matches --orientation, or the footage's own. */
export function targetSize(device, orientation, footage) {
  const sizes = appPreviewDevice(device);
  const wanted = orientation ?? (footage.height > footage.width ? 'portrait' : 'landscape');
  const match = sizes.find(([width, height]) => (wanted === 'portrait' ? height > width : width >= height));
  if (!match) throw new UsageError(`${device} previews are landscape only.`, `Supported: ${sizes.map(([width, height]) => `${width}x${height}`).join(', ')}.`);
  return { width: match[0], height: match[1] };
}

/** The clip length after --start and --duration, refused unless it lands inside 15 to 30 seconds. */
export function clipSeconds(options, footageSeconds) {
  if (!footageSeconds) throw new UsageError(`${options.footage}: its duration cannot be read.`);
  if (options.start >= footageSeconds) throw new UsageError(`--start ${options.start} is past the end of the footage (${footageSeconds.toFixed(2)} s).`);
  const seconds = Math.min(options.duration ?? footageSeconds - options.start, footageSeconds - options.start);
  if (seconds < APP_PREVIEW.minSeconds || seconds > APP_PREVIEW.maxSeconds) {
    throw new UsageError(`The preview would last ${seconds.toFixed(2)} s; previews last 15 to 30 seconds.`, 'Choose a part of the footage with --start and --duration, or capture more of the app. The script never loops or speeds up footage.');
  }
  return seconds;
}

/** The ffmpeg argument list for the options, the probed footage and the target; pure, so tests can read it. */
export function previewArgs(options, footage, target, seconds) {
  const fps = Math.min(footage.video.fps ?? APP_PREVIEW.maxFps, APP_PREVIEW.maxFps);
  const { width, height } = target;
  const fit = options.fit === 'crop'
    ? `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`
    : `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${options.background}`;
  const prores = PRORES_DEVICES.has(options.device);
  const pixel = prores ? 'yuv422p10le' : 'yuv420p';
  const video = `fps=${fps},${fit},setsar=1,scale=out_color_matrix=bt709:out_range=tv,format=${pixel}`;
  const input = ['-ss', String(options.start), '-t', String(seconds), '-i', options.footage];
  const silence = footage.audioStreams === 0 ? ['-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'] : [];
  const maps = ['-map', '0:v:0', '-map', footage.audioStreams === 0 ? '1:a:0' : '0:a:0'];
  const threads = options.threads ? ['-threads', String(options.threads)] : [];
  const audio = ['-ac', '2', '-ar', '48000', ...(prores ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'aac', '-b:a', '256k'])];
  const codec = prores
    ? ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0']
    : ['-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-preset', 'slow', '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M', '-x264-params', 'interlaced=0', '-tag:v', 'avc1'];
  const container = prores ? [] : ['-movflags', '+faststart'];
  return [...input, ...silence, ...maps, '-vf', video, ...codec, ...COLOUR_FLAGS, ...audio, ...threads, '-sn', '-dn', '-map_metadata', '-1', '-shortest', ...container, options.out];
}

async function main() {
  const options = parseArgs(dropProject(process.argv.slice(2)));
  const command = currentCommand();
  if (!fs.existsSync(options.footage)) throw new UsageError(`${options.footage} does not exist.`);
  const footage = probeMedia(options.footage);
  if (!footage.video) throw new UsageError(`${options.footage} has no video stream.`);
  const target = targetSize(options.device, options.orientation, footage.video);
  const seconds = clipSeconds(options, footage.duration);
  process.stderr.write(`app-preview ${VERSION} will write:\n  ${options.out}\n`);
  if (fs.existsSync(options.out) && !options.force) throw new UsageError(`Stopped: ${options.out} already exists.`, 'Choose another --out, or pass --force to replace it.');
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...previewArgs(options, footage, target, seconds)]);
  if (result.status !== 0) throw ffmpegFailure(result.stderr, command);
  const report = createReport({ tool: 'app-preview', boundary: MEDIA_BOUNDARY });
  checkAppPreviewFile(probeMedia(options.out), report, options.device);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
