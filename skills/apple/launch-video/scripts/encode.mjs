/**
 * launch-video encoder for demo clips. Calls ffmpeg (never bundled) and then checks its own output with the shared
 * check-media demo profile.
 *
 *   node encode.mjs <master> --out <folder> [--name clip] [--profiles h264,vp9,av1] [--width <px>] [--fps 30]
 *                   [--crf 23] [--threads <n>] [--start jpg|png] [--force]
 *   node encode.mjs <master with alpha> --out <folder> --alpha [--background #ffffff] [--skip-hevc-alpha] [...]
 *
 * The master is a video file or a folder of frames written by render-frames.mjs (its render.json gives the frame
 * rate). Profiles: h264 writes <name>.mp4 (H.264 High, yuv420p, moov first), vp9 writes <name>.webm, av1 writes
 * <name>.av1.webm; every file has no audio and the three colour tags written with setparams (bt709 primaries and
 * matrix, the sRGB transfer). --alpha writes the alpha pair, <name>.alpha.mov (HEVC with alpha, VideoToolbox only, so
 * macOS outside the agent sandbox) and <name>.alpha.webm (VP9 with alpha), plus <name>.mp4 flattened over the
 * background colour. It always writes the start image <name>.start.jpg (or .png with --start png, for fine detail),
 * frame 0 of <name>.mp4 through the colour conversion browsers use (with alpha also <name>.start-alpha.png), and
 * <name>.encode.json with its settings and version. It lists every path first and stops when one exists that it did
 * not write; a file counts as its own only when <name>.encode.json lists it. Source order for the markup: alpha.mov,
 * alpha.webm, av1.webm, webm, then mp4 last.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkDemoFile, checkDemoSet, MEDIA_BOUNDARY, probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, dropProject, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand, sandboxReason } from '../../shared/sandbox.mjs';

export const GENERATOR = 'design-pro-max launch-video encode';
export const VERSION = '0.2.0';
export const PROFILE_NAMES = ['h264', 'vp9', 'av1'];
export const DEFAULTS = Object.freeze({ name: 'clip', profiles: ['h264'], crf: 23, background: '#ffffff' });

const COLOUR = 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709';
const COLOUR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709'];
const TO_DISPLAY_RGB = 'scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24';
const USAGE = 'Usage: node encode.mjs <master> --out <folder> [--name clip] [--profiles h264,vp9,av1] [--alpha] [--background #ffffff] [--skip-hevc-alpha] [--width <px>] [--fps <n>] [--crf <n>] [--threads <n>] [--start jpg|png] [--force]';

export function parseArgs(argv) {
  const options = { master: null, out: null, name: DEFAULTS.name, profiles: null, alpha: false, background: DEFAULTS.background, hevcAlpha: true, start: 'jpg', width: null, fps: null, crf: DEFAULTS.crf, threads: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--name') options.name = value();
    else if (arg === '--profiles') options.profiles = value().split(',').map((item) => item.trim()).filter(Boolean);
    else if (arg === '--alpha') options.alpha = true;
    else if (arg === '--background') options.background = value();
    else if (arg === '--skip-hevc-alpha') options.hevcAlpha = false;
    else if (arg === '--width') options.width = Number(value());
    else if (arg === '--fps') options.fps = Number(value());
    else if (arg === '--crf') options.crf = Number(value());
    else if (arg === '--threads') options.threads = Number(value());
    else if (arg === '--start') options.start = value();
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`, USAGE);
    else if (!options.master) options.master = arg;
    else throw new UsageError(`Unexpected argument ${arg}.`, USAGE);
  }
  if (!options.master || !options.out) throw new UsageError(USAGE);
  if (!/^[A-Za-z0-9._-]+$/.test(options.name)) throw new UsageError('--name may hold letters, digits, dots, dashes and underscores only.');
  if (options.alpha && options.profiles) throw new UsageError('--alpha writes its own set (the alpha pair and a flattened H.264 file); leave out --profiles.');
  options.profiles ??= DEFAULTS.profiles;
  for (const profile of options.profiles) if (!PROFILE_NAMES.includes(profile)) throw new UsageError(`Unknown profile ${profile}; profiles: ${PROFILE_NAMES.join(', ')}.`);
  if (!options.profiles.includes('h264')) throw new UsageError('Every set needs the h264 profile: an H.264 file is the source every browser can play.');
  for (const key of ['width', 'fps', 'threads']) if (options[key] !== null && (!Number.isFinite(options[key]) || options[key] <= 0)) throw new UsageError(`--${key} must be a positive number.`);
  if (!Number.isFinite(options.crf) || options.crf < 0) throw new UsageError('--crf must be a number of 0 or more.');
  if (options.width !== null && options.width % 2) throw new UsageError('--width must be even (yuv420p needs even dimensions).');
  if (!/^#[0-9a-fA-F]{6}$/.test(options.background)) throw new UsageError('--background must be a colour like #ffffff.');
  if (!['jpg', 'png'].includes(options.start)) throw new UsageError('--start must be jpg or png.');
  return options;
}

/** Every file the run writes, keyed by role, in the order the markup lists the sources. */
export function plan(options) {
  const out = path.resolve(options.out);
  const file = (suffix) => path.join(out, `${options.name}${suffix}`);
  const outputs = {};
  if (options.alpha && options.hevcAlpha) outputs.hevcAlpha = file('.alpha.mov');
  if (options.alpha) outputs.vp9Alpha = file('.alpha.webm');
  if (!options.alpha && options.profiles.includes('av1')) outputs.av1 = file('.av1.webm');
  if (!options.alpha && options.profiles.includes('vp9')) outputs.vp9 = file('.webm');
  outputs.h264 = file('.mp4');
  outputs.start = file(`.start.${options.start}`);
  if (options.alpha) outputs.startAlpha = file('.start-alpha.png');
  outputs.manifest = file('.encode.json');
  return outputs;
}

export const SOURCE_ROLES = ['hevcAlpha', 'vp9Alpha', 'av1', 'vp9', 'h264'];

/** Reads what the encoder needs about the master: a frames folder from render-frames.mjs or a video file. */
export function readMaster(master) {
  if (!fs.existsSync(master)) throw new UsageError(`${master} does not exist.`);
  if (fs.statSync(master).isDirectory()) {
    const first = path.join(master, 'frame-00000.png');
    if (!fs.existsSync(first)) throw new UsageError(`${master} holds no frame-00000.png; render it with render-frames.mjs.`);
    const manifestFile = path.join(master, 'render.json');
    const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
    const header = fs.readFileSync(first).subarray(0, 26);
    const alpha = manifest.alpha ?? [4, 6].includes(header[25]);
    return { input: ['-framerate', String(manifest.fps ?? 30), '-i', path.join(master, 'frame-%05d.png')], fps: manifest.fps ?? 30, alpha, width: header.readUInt32BE(16), height: header.readUInt32BE(20), frames: true };
  }
  const info = probeMedia(master);
  if (!info.video) throw new UsageError(`${master} has no video stream.`);
  const alpha = /^(?:yuva|rgba|bgra|argb|abgr|gbrap|ya)/.test(info.video.pixFmt ?? '') || info.video.alpha;
  return { input: ['-i', master], fps: info.video.fps ?? 30, alpha, width: info.video.width, height: info.video.height, frames: false };
}

const scale = (options) => `scale=${options.width ?? 'trunc(iw/2)*2'}:-2:flags=lanczos`;

/** The ffmpeg argument lists, in order, for the master and options; pure, so tests can read them. */
export function encodeJobs(options, outputs, master) {
  const fps = options.fps ?? master.fps;
  const threads = options.threads ? ['-threads', String(options.threads)] : [];
  const base = [...master.input, '-an', '-sn', '-dn', '-map_metadata', '-1', ...threads];
  const opaque = `fps=${fps},${scale(options)}:out_color_matrix=bt709:out_range=tv,format=yuv420p,${COLOUR}`;
  const flatten = `color=c=${options.background}:s=${master.width}x${master.height}:r=${fps}[bg];[bg][0:v]overlay=shortest=1:format=auto,${opaque}[v]`;
  const video = master.alpha ? ['-filter_complex', flatten, '-map', '[v]'] : ['-vf', opaque];
  const jobs = [];
  if (outputs.hevcAlpha) {
    jobs.push({ role: 'hevcAlpha', args: [...base, '-vf', `fps=${fps},${scale(options)},format=bgra,${COLOUR}`, '-c:v', 'hevc_videotoolbox', '-alpha_quality', '0.75', '-q:v', '65', '-tag:v', 'hvc1', ...COLOUR_FLAGS, '-movflags', '+faststart', outputs.hevcAlpha] });
  }
  if (outputs.vp9Alpha) {
    jobs.push({ role: 'vp9Alpha', args: [...base, '-vf', `fps=${fps},${scale(options)}:out_color_matrix=bt709:out_range=tv,format=yuva420p,${COLOUR}`, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-crf', String(options.crf + 8), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', ...COLOUR_FLAGS, outputs.vp9Alpha] });
  }
  if (outputs.av1) jobs.push({ role: 'av1', args: [...base, ...video, '-c:v', 'libsvtav1', '-crf', String(options.crf + 12), '-preset', '6', '-pix_fmt', 'yuv420p', ...COLOUR_FLAGS, outputs.av1] });
  if (outputs.vp9) jobs.push({ role: 'vp9', args: [...base, ...video, '-c:v', 'libvpx-vp9', '-crf', String(options.crf + 10), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', ...COLOUR_FLAGS, outputs.vp9] });
  jobs.push({ role: 'h264', args: [...base, ...video, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(options.crf), '-pix_fmt', 'yuv420p', '-tag:v', 'avc1', ...COLOUR_FLAGS, '-movflags', '+faststart', outputs.h264] });
  jobs.push({ role: 'start', args: ['-i', outputs.h264, '-frames:v', '1', '-vf', TO_DISPLAY_RGB, ...(options.start === 'jpg' ? ['-q:v', '2'] : []), outputs.start] });
  if (outputs.startAlpha) jobs.push({ role: 'startAlpha', args: [...master.input, '-frames:v', '1', '-vf', `${scale(options)},format=rgba`, outputs.startAlpha] });
  return jobs;
}

/** Turns a failed ffmpeg run into the contract's error: a sandbox refusal exits 3, anything else exits 2. */
export function ffmpegFailure(stderr, command) {
  const reason = sandboxReason(stderr);
  if (reason) return new SandboxError(`Blocked: ${reason}.`, command);
  return new UsageError(`ffmpeg failed: ${String(stderr).trim().split(/\r?\n/).slice(-3).join(' ')}`);
}

function ffmpeg(args, command) {
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...args]);
  if (result.status !== 0) throw ffmpegFailure(result.stderr, command);
}

function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function foreignFiles(existing, manifest, manifestFile) {
  const ours = manifest?.generator === GENERATOR ? new Set([...(manifest.files ?? []), path.basename(manifestFile)]) : new Set();
  return existing.filter((file) => !ours.has(path.basename(file)));
}

function writeManifest(options, outputs, master, complete) {
  const manifest = {
    generator: GENERATOR,
    version: VERSION,
    complete,
    master: path.basename(path.resolve(options.master)),
    fps: options.fps ?? master.fps,
    width: options.width,
    crf: options.crf,
    profiles: options.alpha ? ['hevc-alpha', 'vp9-alpha', 'h264'] : options.profiles,
    background: master.alpha ? options.background : null,
    sources: SOURCE_ROLES.filter((role) => outputs[role]).map((role) => path.basename(outputs[role])),
    files: Object.values(outputs).map((file) => path.basename(file)),
  };
  fs.writeFileSync(outputs.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(dropProject(process.argv.slice(2)));
  const command = currentCommand();
  const master = readMaster(options.master);
  if (options.alpha && !master.alpha) throw new UsageError(`${options.master} has no alpha channel; render it with render-frames.mjs --alpha or export a master with alpha.`);
  if (options.alpha && options.hevcAlpha && process.platform !== 'darwin') {
    throw new UsageError('HEVC with alpha encodes only through VideoToolbox, which exists on macOS only.', 'Encode the alpha pair on a Mac, or pass --skip-hevc-alpha: WebKit then shows the flattened H.264 file instead of a transparent clip.');
  }
  const outputs = plan(options);
  process.stderr.write(`encode ${VERSION} will write:\n${Object.values(outputs).map((file) => `  ${file}`).join('\n')}\n`);
  const existing = Object.values(outputs).filter((file) => fs.existsSync(file));
  const foreign = foreignFiles(existing, readManifest(outputs.manifest), outputs.manifest);
  if (foreign.length && !options.force) {
    throw new UsageError(`Stopped: ${foreign.join(', ')} already exist and were not written by encode.mjs.`, 'Choose another --out or --name, or pass --force to replace them.');
  }
  fs.mkdirSync(path.resolve(options.out), { recursive: true });
  writeManifest(options, outputs, master, false);
  for (const job of encodeJobs(options, outputs, master)) ffmpeg(job.args, command);
  writeManifest(options, outputs, master, true);
  const report = createReport({ tool: 'encode', boundary: MEDIA_BOUNDARY });
  const infos = SOURCE_ROLES.filter((role) => outputs[role]).map((role) => probeMedia(outputs[role]));
  for (const info of infos) checkDemoFile(info, report);
  checkDemoSet(infos, report, { poster: outputs.start, where: 'encoded sources' });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
