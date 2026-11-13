/**
 * launch-scroll image sequence maker. Calls ffmpeg and ffprobe (never bundled) to cut a master clip into frames for
 * a canvas scene (assets/lib/frame-window.js), and prints what the sequence costs before and after it writes anything.
 *
 *   node make-sequence.mjs <master> --out <folder> [--width 960] [--fps 30] [--format jpg|png|webp|avif]
 *                          [--quality 80] [--radius 8] [--budget-mb 512] [--dry-run] [--force]
 *
 * Writes <out>/frames/f0000.<ext> onwards, startframe.jpg (frame 0), still.jpg (the last frame, for the static
 * layout) and sequence.json (count, size, format and the frame template that frame-window.js reads). It lists every
 * path first and stops when one exists that it did not write. Decoded memory is frames x width x height x 4 bytes;
 * above --budget-mb it refuses (exit 2) unless --force. --dry-run prints the decoded totals and writes nothing.
 * webp needs an ffmpeg built with libwebp and avif one with libsvtav1 or libaom-av1; jpg and png always work.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runTool } from '../../shared/check-media.mjs';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const GENERATOR = 'design-pro-max launch-scroll make-sequence';
export const VERSION = '0.2.0';
export const FORMATS = Object.freeze(['jpg', 'png', 'webp', 'avif']);
export const DEFAULTS = Object.freeze({ width: 960, fps: 30, format: 'jpg', quality: 80, radius: 8, budgetMb: 512 });

const MB = 1024 * 1024;
const FROM_FILM = 'in_color_matrix=bt709:in_range=tv:flags=lanczos+accurate_rnd+full_chroma_int';
const AVIF_COLOUR = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709:range=tv';

export const decodedBytes = (frames, width, height) => frames * width * height * 4;
export const megabytes = (bytes) => {
  const value = bytes / MB;
  return value < 10 ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10;
};

export function parseArgs(argv) {
  const options = { master: null, out: null, ...DEFAULTS, dryRun: false, force: false };
  const numbers = { '--width': 'width', '--fps': 'fps', '--quality': 'quality', '--radius': 'radius', '--budget-mb': 'budgetMb' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      return argv[++index];
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--format') options.format = value();
    else if (numbers[arg]) options[numbers[arg]] = Number(value());
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`);
    else if (!options.master) options.master = arg;
    else throw new UsageError(`Unexpected argument ${arg}.`);
  }
  if (!options.master || (!options.out && !options.dryRun)) {
    throw new UsageError('Usage: node make-sequence.mjs <master> --out <folder> [--width 960] [--fps 30] [--format jpg|png|webp|avif] [--quality 80] [--radius 8] [--budget-mb 512] [--dry-run] [--force]');
  }
  if (!FORMATS.includes(options.format)) throw new UsageError(`--format must be one of ${FORMATS.join(', ')}.`);
  for (const key of ['width', 'fps', 'budgetMb']) if (!Number.isFinite(options[key]) || options[key] <= 0) throw new UsageError(`--${key === 'budgetMb' ? 'budget-mb' : key} must be a positive number.`);
  if (!Number.isInteger(options.radius) || options.radius < 0) throw new UsageError('--radius must be a whole number of frames, 0 or more.');
  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) throw new UsageError('--quality must be 1 to 100.');
  if (options.width % 2) throw new UsageError('--width must be even.');
  return options;
}

export function outputSize(source, width) {
  const height = Math.round((source.height * width) / source.width / 2) * 2;
  return { width, height: Math.max(2, height) };
}

export function estimateFrames(durationSeconds, fps) {
  return Math.max(1, Math.round(durationSeconds * fps));
}

export function budgetFor({ frames, width, height, radius, budgetMb }) {
  const total = decodedBytes(frames, width, height);
  const window = decodedBytes(Math.min(frames, 2 * radius + 1), width, height);
  return { frames, width, height, total, window, budget: budgetMb * MB, over: total > budgetMb * MB };
}

export function costLines(cost, downloadBytes = null) {
  const lines = [
    `decoded, every frame: ${cost.frames} x ${cost.width} x ${cost.height} x 4 bytes = ${megabytes(cost.total)} MB (budget ${megabytes(cost.budget)} MB)`,
    `decoded, frame-window.js at this radius: ${megabytes(cost.window)} MB`,
  ];
  if (downloadBytes !== null) {
    lines.push(`download, every frame: ${megabytes(downloadBytes)} MB`);
    lines.push(`a closed GOP-6 film of the same clip would be about ${megabytes(downloadBytes / 5.3)}-${megabytes(downloadBytes / 1.95)} MB, depending on content`);
  }
  return lines;
}

export function plan(options, count) {
  const out = path.resolve(options.out);
  const last = String(Math.max(0, count - 1)).padStart(4, '0');
  return {
    out,
    framesDir: path.join(out, 'frames'),
    template: `frames/f%04d.${options.format}`,
    manifest: path.join(out, 'sequence.json'),
    startframe: path.join(out, 'startframe.jpg'),
    still: path.join(out, 'still.jpg'),
    listing: [`frames/f0000.${options.format} to frames/f${last}.${options.format}`, 'startframe.jpg', 'still.jpg', 'sequence.json'].map((name) => path.join(out, name)),
  };
}

export function probeClip(file) {
  const result = runTool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration:format=duration', '-of', 'json', file]);
  if (result.status !== 0) throw new UsageError(`ffprobe cannot read ${file}: ${result.stderr.trim()}`);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.[0];
  if (!stream?.width || !stream?.height) throw new UsageError(`${file} has no video stream.`);
  const duration = Number(stream.duration) || Number(data.format?.duration) || 0;
  if (!(duration > 0)) throw new UsageError(`${file} has no readable duration.`);
  return { width: stream.width, height: stream.height, duration };
}

function ownedByUs(outputs) {
  try {
    return JSON.parse(fs.readFileSync(outputs.manifest, 'utf8')).generator === GENERATOR;
  } catch {
    return false;
  }
}

function existingOutputs(outputs) {
  const found = [outputs.manifest, outputs.startframe, outputs.still].filter((file) => fs.existsSync(file));
  if (fs.existsSync(outputs.framesDir) && fs.readdirSync(outputs.framesDir).length) found.push(outputs.framesDir);
  return found;
}

function ffmpeg(args) {
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', '-threads', '2', ...args]);
  if (result.status !== 0) throw new UsageError(`ffmpeg failed: ${result.stderr.trim().split(/\r?\n/).slice(-3).join(' ')}`);
}

export function encoderFor(format, encoders) {
  if (format === 'jpg') return 'mjpeg';
  if (format === 'png') return 'png';
  if (format === 'webp') return encoders.includes('libwebp') ? 'libwebp' : null;
  return ['libsvtav1', 'libaom-av1'].find((name) => encoders.includes(name)) ?? null;
}

function listEncoders() {
  const result = runTool('ffmpeg', ['-hide_banner', '-encoders']);
  return result.stdout.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[1]).filter(Boolean);
}

const jpegQscale = (quality) => String(Math.round(2 + ((100 - quality) / 99) * 29));

export function frameArgs(format, encoder, quality) {
  if (format === 'jpg') return ['-c:v', 'mjpeg', '-q:v', jpegQscale(quality)];
  if (format === 'png') return ['-c:v', 'png', '-compression_level', '9'];
  if (format === 'webp') return ['-c:v', 'libwebp', '-quality', String(quality)];
  const crf = String(Math.round(63 - (quality / 100) * 45));
  return encoder === 'libsvtav1'
    ? ['-vf', AVIF_COLOUR, '-c:v', 'libsvtav1', '-svtav1-params', 'lp=2', '-crf', crf, '-frames:v', '1', '-f', 'avif']
    : ['-vf', AVIF_COLOUR, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', crf, '-frames:v', '1', '-f', 'avif'];
}

function writeFrames(options, outputs, encoder, scratch) {
  const video = `fps=${options.fps},scale=${options.width}:-2:${FROM_FILM},format=rgb24`;
  ffmpeg(['-i', options.master, '-an', '-vf', video, '-start_number', '0', path.join(scratch, 'p%04d.png')]);
  const pngs = fs.readdirSync(scratch).filter((name) => /^p\d{4}\.png$/.test(name)).sort();
  if (!pngs.length) throw new UsageError(`ffmpeg wrote no frames from ${options.master}.`);
  fs.mkdirSync(outputs.framesDir, { recursive: true });
  for (const name of fs.readdirSync(outputs.framesDir)) if (/^f\d{4}\.(?:jpg|png|webp|avif)$/.test(name)) fs.rmSync(path.join(outputs.framesDir, name));
  if (options.format === 'avif') {
    pngs.forEach((name, index) => ffmpeg(['-i', path.join(scratch, name), ...frameArgs('avif', encoder, options.quality), path.join(outputs.framesDir, `f${String(index).padStart(4, '0')}.avif`)]));
  } else {
    ffmpeg(['-start_number', '0', '-i', path.join(scratch, 'p%04d.png'), ...frameArgs(options.format, encoder, options.quality), '-start_number', '0', path.join(outputs.out, outputs.template)]);
  }
  ffmpeg(['-i', path.join(scratch, pngs[0]), '-q:v', '2', outputs.startframe]);
  ffmpeg(['-i', path.join(scratch, pngs.at(-1)), '-q:v', '2', outputs.still]);
  return pngs.length;
}

function measure(outputs, count, format) {
  let bytes = 0;
  const missing = [];
  for (let index = 0; index < count; index += 1) {
    const file = path.join(outputs.framesDir, `f${String(index).padStart(4, '0')}.${format}`);
    if (fs.existsSync(file)) bytes += fs.statSync(file).size;
    else missing.push(path.basename(file));
  }
  return { bytes, missing };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.master)) throw new UsageError(`${options.master} does not exist.`);
  const clip = probeClip(options.master);
  const size = outputSize(clip, Math.min(options.width, clip.width - (clip.width % 2)));
  const estimate = estimateFrames(clip.duration, options.fps);
  const cost = budgetFor({ frames: estimate, ...size, radius: options.radius, budgetMb: options.budgetMb });
  const report = createReport({ tool: 'make-sequence' });
  process.stderr.write(`make-sequence ${VERSION}: ${estimate} frames at ${size.width}x${size.height}, ${options.format}\n${costLines(cost).map((line) => `  ${line}`).join('\n')}\n`);
  if (options.dryRun) {
    report.check('LS-WARN-SEQ', !cost.over, 'decoded memory (estimate)', `${megabytes(cost.total)} MB for ${estimate} frames; ${megabytes(cost.window)} MB in the decode window`, `at most ${megabytes(cost.budget)} MB, or a scrubbed film`, 'warn');
    return report.summary();
  }
  if (cost.over && !options.force) {
    throw new UsageError(
      `Stopped: ${estimate} decoded frames need ${megabytes(cost.total)} MB, over the ${megabytes(cost.budget)} MB budget.`,
      'Scrub a film instead (encode-scrub.mjs), or make the sequence shorter (a trimmed master), smaller (--width) or sparser (--fps). Pass --force to write it anyway.',
    );
  }
  const encoder = encoderFor(options.format, listEncoders());
  if (!encoder) throw new UsageError(`This ffmpeg has no ${options.format} encoder.`, 'Use --format jpg or png, or an ffmpeg built with libwebp (webp) or libsvtav1 (avif).');
  const outputs = plan(options, estimate);
  process.stderr.write(`will write:\n${outputs.listing.map((file) => `  ${file}`).join('\n')}\n`);
  const existing = existingOutputs(outputs);
  if (existing.length && !options.force && !ownedByUs(outputs)) {
    throw new UsageError(`Stopped: ${existing.join(', ')} already exist and were not written by make-sequence.`, 'Choose another --out, or pass --force to replace them.');
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'make-sequence-'));
  let count;
  try {
    count = writeFrames(options, outputs, encoder, scratch);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const { bytes, missing } = measure(outputs, count, options.format);
  if (missing.length) throw new UsageError(`ffmpeg did not write ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}.`);
  const final = budgetFor({ frames: count, ...size, radius: options.radius, budgetMb: options.budgetMb });
  const manifest = {
    generator: GENERATOR,
    version: VERSION,
    master: path.basename(options.master),
    count,
    width: size.width,
    height: size.height,
    fps: options.fps,
    format: options.format,
    frames: outputs.template,
    startframe: 'startframe.jpg',
    still: 'still.jpg',
    radius: options.radius,
    decodedBytes: final.total,
    windowBytes: final.window,
    downloadBytes: bytes,
  };
  fs.writeFileSync(outputs.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stderr.write(`wrote ${count} frames\n${costLines(final, bytes).map((line) => `  ${line}`).join('\n')}\n`);
  report.pass('LS-WARN-SEQ', 'download', `${count} frames, ${megabytes(bytes)} MB`, 'shown to the user with the decoded memory');
  report.check('LS-WARN-SEQ', !final.over, 'decoded memory', `${megabytes(final.total)} MB for every frame; ${megabytes(final.window)} MB in the decode window`, `at most ${megabytes(final.budget)} MB, or a scrubbed film`, 'warn');
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
