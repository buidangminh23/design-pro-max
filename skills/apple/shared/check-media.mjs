/**
 * Reads media files with ffprobe and the MP4 box walker and checks them against a profile. Profile `scrub` holds the
 * scroll-scrub rules: LS-VID-01 per file (box order, audio, pixel format, keyframe spacing, closed GOP) and LS-VID-02
 * per set of sources for one film (an H.264 file is always present). It invokes ffprobe and never bundles it.
 *
 *   node check-media.mjs [--profile scrub] <file> [<file> ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectMp4, maxKeyframeDistance } from './mp4.mjs';
import { createReport, isMain, runMain, UsageError } from './report.mjs';

export const FFMPEG_HINT = 'Install ffmpeg, which provides ffprobe (macOS: brew install ffmpeg; Windows: winget install Gyan.FFmpeg; Debian or Ubuntu: apt install ffmpeg).';
export const PROFILES = ['scrub'];
export const SCRUB = Object.freeze({ maxKeyframeDistance: 8, preferredDistance: 6, preferredDistanceAbove30: 5 });

const MP4_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);

export function runTool(tool, args) {
  const result = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error?.code === 'ENOENT') throw new UsageError(`${tool} was not found on PATH.`, FFMPEG_HINT);
  if (result.error) throw result.error;
  return result;
}

const rate = (value) => {
  const [numerator, denominator] = String(value ?? '').split('/').map(Number);
  return denominator ? numerator / denominator : Number(numerator) || null;
};

function packetKeyframes(file) {
  const result = runTool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=flags', '-of', 'csv=p=0', file]);
  if (result.status !== 0) return null;
  const flags = result.stdout.split(/\r?\n/).filter(Boolean);
  return { total: flags.length, sync: flags.flatMap((flag, index) => (flag.includes('K') ? [index + 1] : [])) };
}

/** Everything the profiles need about one file. */
export function probeMedia(file) {
  if (!fs.existsSync(file)) throw new UsageError(`${file} does not exist.`);
  const result = runTool('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  if (result.status !== 0) throw new UsageError(`ffprobe cannot read ${file}: ${result.stderr.trim()}`);
  const data = JSON.parse(result.stdout);
  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video') ?? null;
  const mp4 = MP4_EXTENSIONS.has(path.extname(file).toLowerCase()) ? inspectMp4(fs.readFileSync(file)) : null;
  const keyframes = mp4?.video
    ? { total: mp4.video.samples, sync: mp4.video.keyframes.map((entry) => entry.sample), kinds: mp4.video.keyframes.map((entry) => entry.kind) }
    : packetKeyframes(file);
  return {
    file,
    format: data.format?.format_name ?? null,
    audioStreams: streams.filter((stream) => stream.codec_type === 'audio').length,
    video: video && {
      codec: video.codec_name,
      tag: video.codec_tag_string,
      profile: video.profile ?? null,
      pixFmt: video.pix_fmt,
      width: video.width,
      height: video.height,
      fps: rate(video.avg_frame_rate) ?? rate(video.r_frame_rate),
      colorPrimaries: video.color_primaries ?? null,
      colorTransfer: video.color_transfer ?? null,
      colorSpace: video.color_space ?? null,
    },
    mp4,
    keyframes,
  };
}

const name = (info) => path.basename(info.file);

/** LS-VID-01 and the scrub warnings for one file. */
export function checkScrubFile(info, report) {
  const where = name(info);
  const { video, mp4, keyframes } = info;
  if (!video) {
    report.error('LS-VID-01', where, 'no video stream', 'one video stream');
    return;
  }
  if (mp4) report.check('LS-VID-01', mp4.moovFirst, `${where}: box order`, mp4.order.join(','), 'moov before mdat (+faststart)');
  report.check('LS-VID-01', info.audioStreams === 0, `${where}: audio`, `${info.audioStreams} audio stream(s)`, 'no audio stream');
  const alphaOk = video.pixFmt === 'yuva420p' && video.codec === 'vp9';
  report.check('LS-VID-01', video.pixFmt === 'yuv420p' || alphaOk, `${where}: pixel format`, video.pixFmt, 'yuv420p');
  if (!keyframes?.total) {
    report.error('LS-VID-01', `${where}: keyframes`, 'no frames could be read', 'a keyframe at least every 8 frames');
  } else {
    const distance = maxKeyframeDistance(keyframes.sync, keyframes.total);
    report.check('LS-VID-01', distance <= SCRUB.maxKeyframeDistance, `${where}: keyframe spacing`, `${distance} frames`, `at most ${SCRUB.maxKeyframeDistance} frames`);
    const preferred = (video.fps ?? 30) > 30 ? SCRUB.preferredDistanceAbove30 : SCRUB.preferredDistance;
    if (keyframes.sync.length === keyframes.total && keyframes.total > 1) {
      report.warn('LS-WARN-GOP', `${where}: all-intra`, 'every frame is a keyframe', `a closed GOP of ${preferred} costs about a third of the bytes`);
    } else {
      report.check('LS-WARN-GOP', distance <= preferred, `${where}: keyframe spacing`, `${distance} frames at ${video.fps ?? '?'} fps`, `${preferred} frames`, 'warn');
    }
  }
  if (keyframes?.kinds) {
    const open = keyframes.kinds.filter((kind) => kind !== 'idr' && kind !== 'unknown').length;
    const unknown = keyframes.kinds.filter((kind) => kind === 'unknown').length;
    if (open) report.error('LS-VID-01', `${where}: GOP`, `${open} of ${keyframes.kinds.length} keyframes are open-GOP recovery points`, 'closed GOP: every keyframe an IDR frame');
    else if (unknown) report.warn('LS-VID-01', `${where}: GOP`, `${unknown} keyframe(s) could not be classified`, 'closed GOP: every keyframe an IDR frame');
    else report.pass('LS-VID-01', `${where}: GOP`, 'every keyframe is an IDR frame', 'closed GOP');
  } else if (video.codec === 'vp9' || video.codec === 'av1') {
    report.pass('LS-VID-01', `${where}: GOP`, `${video.codec} keyframes reset all references`, 'closed GOP');
  } else {
    report.warn('LS-VID-01', `${where}: GOP`, `cannot prove a closed GOP for ${video.codec} in this container`, 'closed GOP');
  }
  if (video.codec === 'hevc') report.check('LS-WARN-HEVC', video.tag === 'hvc1', `${where}: sample entry`, video.tag, 'hvc1, which Safari requires', 'warn');
  const tagged = video.colorPrimaries && video.colorTransfer && video.colorSpace;
  report.check('LS-WARN-COLOR', Boolean(tagged), `${where}: colour tags`, `${video.colorPrimaries ?? 'unset'}/${video.colorTransfer ?? 'unset'}/${video.colorSpace ?? 'unset'}`, 'bt709 primaries and matrix with a transfer tag', 'warn');
}

/** LS-VID-02 and the VP9 warning for the sources of one film. */
export function checkSourceSet(infos, report, where = 'sources') {
  const codecs = infos.map((info) => info.video?.codec ?? 'none');
  report.check('LS-VID-02', codecs.includes('h264'), where, codecs.join(', ') || 'no sources', 'an H.264 source in every set');
  if (codecs[0] === 'vp9') report.warn('LS-WARN-VP9', where, 'VP9 is the first source', 'H.264 first; VP9 seeks slowest');
}

export function checkFiles(files, report, { profile = 'scrub' } = {}) {
  if (!PROFILES.includes(profile)) throw new UsageError(`Unknown profile ${profile}; profiles: ${PROFILES.join(', ')}.`);
  const infos = files.map((file) => probeMedia(file));
  for (const info of infos) checkScrubFile(info, report);
  checkSourceSet(infos, report);
  return infos;
}

async function main() {
  const args = process.argv.slice(2);
  let profile = 'scrub';
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--profile') profile = args[++index];
    else if (args[index] === '--help' || args[index] === '-h') throw new UsageError('Usage: node check-media.mjs [--profile scrub] <file> [<file> ...]');
    else if (args[index].startsWith('--')) throw new UsageError(`Unknown option ${args[index]}.`);
    else files.push(args[index]);
  }
  if (!files.length) throw new UsageError('Usage: node check-media.mjs [--profile scrub] <file> [<file> ...]');
  const report = createReport({ tool: 'check-media' });
  checkFiles(files, report, { profile });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
