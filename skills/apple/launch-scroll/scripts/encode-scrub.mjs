/**
 * launch-scroll reference encode for a scroll-scrubbed film. Calls ffmpeg (never bundled) and then checks its own
 * output with the shared check-media.
 *
 *   node encode-scrub.mjs <master> --out <folder> [--name film] [--width 1280] [--fps 30] [--crf 21]
 *                         [--webm] [--hevc] [--force]
 *
 * Writes <name>.mp4 (H.264 High, yuv420p, closed GOP of 6 frames, 5 above 30 fps, no audio, moov first, bt709 with
 * the sRGB transfer tag), optionally <name>.webm (VP9, same GOP) and <name>.hevc.mp4 (closed-GOP HEVC tagged hvc1),
 * startframe.jpg (frame 0) and still.jpg (the last frame, for the static layout), plus <name>.encode.json recording
 * the settings and this script's version. It lists every path first and stops when one exists that it did not write.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkScrubFile, checkSourceSet, probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const GENERATOR = 'design-pro-max launch-scroll encode-scrub';
export const VERSION = '0.1.0';

const COLOUR_FILTER = 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709';
const COLOUR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709'];
const TO_DISPLAY_RGB = 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24';

export function gopFor(fps) {
  return fps > 30 ? 5 : 6;
}

export function parseArgs(argv) {
  const options = { master: null, out: null, name: 'film', width: 1280, fps: 30, crf: 21, webm: false, hevc: false, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      return argv[++index];
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--name') options.name = value();
    else if (arg === '--width') options.width = Number(value());
    else if (arg === '--fps') options.fps = Number(value());
    else if (arg === '--crf') options.crf = Number(value());
    else if (arg === '--webm') options.webm = true;
    else if (arg === '--hevc') options.hevc = true;
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`);
    else if (!options.master) options.master = arg;
    else throw new UsageError(`Unexpected argument ${arg}.`);
  }
  if (!options.master || !options.out) throw new UsageError('Usage: node encode-scrub.mjs <master> --out <folder> [--name film] [--width 1280] [--fps 30] [--crf 21] [--webm] [--hevc] [--force]');
  if (!/^[A-Za-z0-9._-]+$/.test(options.name)) throw new UsageError('--name may hold letters, digits, dots, dashes and underscores only.');
  for (const key of ['width', 'fps', 'crf']) if (!Number.isFinite(options[key]) || options[key] <= 0) throw new UsageError(`--${key} must be a positive number.`);
  if (options.width % 2) throw new UsageError('--width must be even (yuv420p needs even dimensions).');
  return options;
}

export function plan(options) {
  const out = path.resolve(options.out);
  const file = (name) => path.join(out, name);
  const outputs = { mp4: file(`${options.name}.mp4`), startframe: file('startframe.jpg'), still: file('still.jpg'), manifest: file(`${options.name}.encode.json`) };
  if (options.webm) outputs.webm = file(`${options.name}.webm`);
  if (options.hevc) outputs.hevc = file(`${options.name}.hevc.mp4`);
  return outputs;
}

/** True when an earlier run of this script wrote the existing outputs, so they may be replaced. */
function ownedByUs(outputs) {
  try {
    const manifest = JSON.parse(fs.readFileSync(outputs.manifest, 'utf8'));
    return manifest.generator === GENERATOR;
  } catch {
    return false;
  }
}

function ffmpeg(args) {
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...args]);
  if (result.status !== 0) throw new UsageError(`ffmpeg failed: ${result.stderr.trim().split(/\r?\n/).slice(-3).join(' ')}`);
}

export function encodeArgs(options, outputs) {
  const gop = gopFor(options.fps);
  const video = `fps=${options.fps},scale=${options.width}:-2:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p,${COLOUR_FILTER}`;
  const keyframes = ['-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0'];
  const common = ['-i', options.master, '-an', '-vf', video, '-map_metadata', '-1'];
  const jobs = [[...common, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(options.crf), '-pix_fmt', 'yuv420p', ...keyframes, '-x264-params', 'open-gop=0', ...COLOUR_FLAGS, '-movflags', '+faststart', outputs.mp4]];
  if (outputs.webm) jobs.push([...common, '-c:v', 'libvpx-vp9', '-crf', String(options.crf + 13), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', ...keyframes, ...COLOUR_FLAGS, outputs.webm]);
  if (outputs.hevc) jobs.push([...common, '-c:v', 'libx265', '-crf', String(options.crf + 3), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-x265-params', `keyint=${gop}:min-keyint=${gop}:scenecut=0:open-gop=0:log-level=error`, ...COLOUR_FLAGS, '-movflags', '+faststart', outputs.hevc]);
  jobs.push(['-i', outputs.mp4, '-frames:v', '1', '-vf', TO_DISPLAY_RGB, '-q:v', '2', outputs.startframe]);
  jobs.push(['-sseof', '-1', '-i', outputs.mp4, '-vf', TO_DISPLAY_RGB, '-update', '1', '-q:v', '2', outputs.still]);
  return jobs;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.master)) throw new UsageError(`${options.master} does not exist.`);
  const outputs = plan(options);
  process.stderr.write(`encode-scrub ${VERSION} will write:\n${Object.values(outputs).map((file) => `  ${file}`).join('\n')}\n`);
  const existing = Object.values(outputs).filter((file) => fs.existsSync(file));
  if (existing.length && !options.force && !ownedByUs(outputs)) {
    throw new UsageError(`Stopped: ${existing.join(', ')} already exist and were not written by encode-scrub.`, 'Choose another --out or --name, or pass --force to replace them.');
  }
  fs.mkdirSync(path.resolve(options.out), { recursive: true });
  for (const args of encodeArgs(options, outputs)) ffmpeg(args);
  fs.writeFileSync(outputs.manifest, `${JSON.stringify({ generator: GENERATOR, version: VERSION, master: path.basename(options.master), gop: gopFor(options.fps), ...options, master_path: undefined, out: undefined, files: Object.values(outputs).map((file) => path.basename(file)) }, null, 2)}\n`);
  const report = createReport({ tool: 'encode-scrub' });
  const films = [outputs.mp4, outputs.webm, outputs.hevc].filter(Boolean).map((file) => probeMedia(file));
  for (const info of films) checkScrubFile(info, report);
  checkSourceSet(films, report, 'encoded sources');
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
