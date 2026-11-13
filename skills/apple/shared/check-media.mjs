/**
 * Reads media files with ffprobe and the MP4 box walker and checks them against a profile. Profile `scrub` holds the
 * scroll-scrub rules: LS-VID-01 per file (box order, audio, pixel format, keyframe spacing, closed GOP) and LS-VID-02
 * per set of sources for one film (an H.264 file is always present). Profile `demo` holds the launch-video encode
 * rules for the sources of one demo clip: LV-ENC-01 (an H.264 High, yuv420p, moov-first file; every file 4:2:0 in
 * limited range), LV-ENC-02 (no audio stream), LV-ENC-03 (the three colour tags) and, with --poster, LV-POSTER-01 (the
 * start image is frame 0). It invokes ffprobe and ffmpeg and never bundles them.
 *
 *   node check-media.mjs [--profile scrub] <file> [<file> ...]
 *   node check-media.mjs --profile demo [--poster <image>] [--slot <type>] [--loop] <file> [<file> ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectMp4, maxKeyframeDistance } from './mp4.mjs';
import { createReport, isMain, runMain, UsageError } from './report.mjs';

export const FFMPEG_HINT = 'Install ffmpeg, which provides ffprobe (macOS: brew install ffmpeg; Windows: winget install Gyan.FFmpeg; Debian or Ubuntu: apt install ffmpeg).';
export const PROFILES = ['scrub', 'demo'];
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
      colorRange: video.color_range ?? null,
      alpha: String(video.tags?.alpha_mode ?? video.tags?.ALPHA_MODE ?? '') === '1',
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

export const DEMO = Object.freeze({ ssim: 0.99, maxFps: 30, transfers: ['bt709', 'iec61966-2-1'] });

export const SLOT_BUDGETS = Object.freeze({
  tile: 120 * 1024,
  'tile-5s': 250 * 1024,
  'tile-5s@2x': 600 * 1024,
  card: 400 * 1024,
  device: 700 * 1024,
  hero: 300 * 1024,
  'hero@2x': 1024 * 1024,
});

export function slotBudget(slot) {
  if (!Object.hasOwn(SLOT_BUDGETS, slot)) throw new UsageError(`Unknown slot ${slot}; slots: ${Object.keys(SLOT_BUDGETS).join(', ')}.`);
  return SLOT_BUDGETS[slot];
}

export const isLimitedRange = (video) => video.colorRange !== 'pc' && !String(video.pixFmt ?? '').startsWith('yuvj');

/** True for the file every demo set needs: H.264 High, yuv420p in limited range, moov before mdat. */
export function isBaselineH264(info) {
  const video = info.video;
  return Boolean(video && video.codec === 'h264' && video.profile === 'High' && video.pixFmt === 'yuv420p' && isLimitedRange(video) && info.mp4?.moovFirst);
}

/** LV-ENC-01, LV-ENC-02, LV-ENC-03 and the frame-rate warning for one file of a demo clip. */
export function checkDemoFile(info, report) {
  const where = name(info);
  const { video } = info;
  if (!video) {
    report.error('LV-ENC-01', where, 'no video stream', 'one video stream');
    return;
  }
  const range = `${video.pixFmt}, ${video.colorRange ?? 'unknown'} range`;
  if (video.codec === 'h264') {
    report.check('LV-ENC-01', video.profile === 'High', `${where}: profile`, video.profile ?? 'unknown', 'H.264 High');
    report.check('LV-ENC-01', video.pixFmt === 'yuv420p' && isLimitedRange(video), `${where}: pixel format`, range, 'yuv420p in limited (tv) range, never yuvj420p or 4:4:4');
    report.check('LV-ENC-01', Boolean(info.mp4?.moovFirst), `${where}: box order`, info.mp4 ? info.mp4.order.join(',') : info.format, 'moov before mdat (+faststart)');
  } else {
    const formats = video.codec === 'vp9' ? ['yuv420p', 'yuva420p'] : ['yuv420p'];
    report.check('LV-ENC-01', formats.includes(video.pixFmt) && isLimitedRange(video), `${where}: pixel format`, `${video.codec} ${range}`, '4:2:0 in limited (tv) range');
    if (info.mp4) report.check('LV-ENC-01', info.mp4.moovFirst, `${where}: box order`, info.mp4.order.join(','), 'moov before mdat (+faststart)');
  }
  report.check('LV-ENC-02', info.audioStreams === 0, `${where}: audio`, `${info.audioStreams} audio stream(s)`, 'no audio stream in a muted or decorative clip');
  const tags = `${video.colorPrimaries ?? 'unset'}/${video.colorTransfer ?? 'unset'}/${video.colorSpace ?? 'unset'}`;
  const tagged = video.colorPrimaries === 'bt709' && video.colorSpace === 'bt709' && DEMO.transfers.includes(video.colorTransfer);
  report.check('LV-ENC-03', tagged, `${where}: colour tags (primaries/transfer/matrix)`, tags, 'bt709/bt709 or iec61966-2-1/bt709, written with setparams');
  if (video.fps) report.check('LV-WARN-FPS', video.fps <= DEMO.maxFps + 0.01, `${where}: frame rate`, `${Math.round(video.fps * 100) / 100} fps`, `${DEMO.maxFps} fps unless the motion is fast`, 'warn');
}

const lastSsim = (text) => {
  const all = [...String(text).matchAll(/All:([0-9.]+)/g)];
  return all.length ? Number(all.at(-1)[1]) : null;
};

/** SSIM between frame 0 of a film as a browser shows it (bt709, limited range, to RGB) and a decoded image. */
export function frameSsim(film, image, width, height) {
  const display = `scale=${width}:${height}:flags=accurate_rnd+full_chroma_int`;
  const filter = `[0:v]select=eq(n\\,0),scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24,${display},format=yuv444p[a];[1:v]${display},format=rgb24,format=yuv444p[b];[a][b]ssim`;
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-i', film, '-i', image, '-filter_complex', filter, '-frames:v', '1', '-f', 'null', '-']);
  return lastSsim(result.stderr);
}

/** The median SSIM of consecutive frames, and the SSIM of the last frame against frame 0 (the loop seam). */
export function loopSeam(film) {
  const pairs = runTool('ffmpeg', ['-hide_banner', '-nostats', '-i', film, '-i', film, '-filter_complex', '[0:v]trim=start_frame=1,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]ssim=stats_file=-', '-f', 'null', '-']);
  const scores = [...pairs.stdout.matchAll(/All:([0-9.]+)/g)].map((match) => Number(match[1])).sort((a, b) => a - b);
  if (!scores.length) return null;
  const seam = runTool('ffmpeg', ['-hide_banner', '-nostats', '-sseof', '-0.5', '-i', film, '-i', film, '-filter_complex', '[0:v]reverse,trim=end_frame=1,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=1,setpts=PTS-STARTPTS[b];[a][b]ssim', '-f', 'null', '-']);
  return { median: scores[Math.floor(scores.length / 2)], seam: lastSsim(seam.stderr) };
}

/** The set rules of one demo clip: LV-ENC-01 (a baseline H.264 file), LV-POSTER-01, and the alpha, size and seam warnings. */
export function checkDemoSet(infos, report, { poster = null, slot = null, loop = false, where = 'sources' } = {}) {
  const baseline = infos.find(isBaselineH264);
  const listed = infos.map((info) => `${name(info)} (${info.video?.codec ?? 'none'})`).join(', ');
  report.check('LV-ENC-01', Boolean(baseline), `${where}: H.264 source`, baseline ? name(baseline) : listed, 'an H.264 High, yuv420p, moov-first file in every set');
  const vp9Alpha = infos.findIndex((info) => info.video?.codec === 'vp9' && info.video.alpha);
  if (vp9Alpha >= 0) {
    const hevc = infos.findIndex((info) => info.video?.codec === 'hevc');
    report.check('LV-WARN-ALPHA', hevc >= 0 && hevc < vp9Alpha, `${where}: alpha`, listed, 'VP9 with alpha turns opaque in WebKit: pair it with HEVC with alpha, listed before it', 'warn');
  }
  if (slot) {
    const budget = slotBudget(slot);
    for (const info of infos) {
      const bytes = fs.statSync(info.file).size;
      report.check('LV-WARN-BUDGET', bytes <= budget, `${name(info)}: size for a ${slot} slot`, `${Math.round(bytes / 1024)} KB`, `at most ${Math.round(budget / 1024)} KB`, 'warn');
    }
  }
  const film = baseline ?? infos.find((info) => info.video);
  if (poster) {
    if (!fs.existsSync(poster)) throw new UsageError(`${poster} does not exist.`);
    const score = film ? frameSsim(film.file, poster, film.video.width, film.video.height) : null;
    const measured = !film ? 'no film to compare with' : score === null ? 'SSIM could not be measured' : `SSIM ${score.toFixed(4)} against frame 0 of ${name(film)}`;
    report.check('LV-POSTER-01', score !== null && score >= DEMO.ssim, `${path.basename(poster)}: start image`, measured, `SSIM at least ${DEMO.ssim}`);
  }
  if (loop && film) {
    const seam = loopSeam(film.file);
    if (!seam || seam.seam === null) report.warn('LV-WARN-SEAM', `${name(film)}: loop seam`, 'could not be measured', 'seam SSIM at least the median of consecutive frames');
    else report.check('LV-WARN-SEAM', seam.seam >= seam.median - 0.001, `${name(film)}: loop seam`, `last to first frame SSIM ${seam.seam.toFixed(4)}, consecutive median ${seam.median.toFixed(4)}`, 'seam SSIM at least the consecutive-frame median', 'warn');
  }
}

export function checkFiles(files, report, { profile = 'scrub', ...demo } = {}) {
  if (!PROFILES.includes(profile)) throw new UsageError(`Unknown profile ${profile}; profiles: ${PROFILES.join(', ')}.`);
  const infos = files.map((file) => probeMedia(file));
  if (profile === 'demo') {
    for (const info of infos) checkDemoFile(info, report);
    checkDemoSet(infos, report, demo);
    return infos;
  }
  for (const info of infos) checkScrubFile(info, report);
  checkSourceSet(infos, report);
  return infos;
}

async function main() {
  const args = process.argv.slice(2);
  const usage = 'Usage: node check-media.mjs [--profile scrub] <file> [<file> ...]\n       node check-media.mjs --profile demo [--poster <image>] [--slot <type>] [--loop] <file> [<file> ...]';
  let profile = 'scrub';
  const demo = {};
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = () => {
      if (index + 1 >= args.length) throw new UsageError(`${args[index]} needs a value.`, usage);
      return args[++index];
    };
    if (args[index] === '--profile') profile = value();
    else if (args[index] === '--poster') demo.poster = value();
    else if (args[index] === '--slot') demo.slot = value();
    else if (args[index] === '--loop') demo.loop = true;
    else if (args[index] === '--help' || args[index] === '-h') throw new UsageError(usage);
    else if (args[index].startsWith('--')) throw new UsageError(`Unknown option ${args[index]}.`, usage);
    else files.push(args[index]);
  }
  if (!files.length) throw new UsageError(usage);
  if (profile !== 'demo' && Object.keys(demo).length) throw new UsageError('--poster, --slot and --loop need --profile demo.', usage);
  if (demo.slot) slotBudget(demo.slot);
  const report = createReport({ tool: 'check-media' });
  checkFiles(files, report, { profile, ...demo });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
