/**
 * launch-video record mode. Plans a screen capture of the real app and, with --run, runs it. It refuses to plan or run
 * anything until a completed recording pre-flight is given (LV-CAP-01), then probes whether a screen is visible to this
 * process and exits 3 when an agent sandbox, an SSH session or a missing permission hides it. Calls ffmpeg or the
 * macOS screencapture tool (never bundled).
 *
 *   node capture-plan.mjs --preflight <file> --slot <WxH> --region <x,y,w,h> --duration <seconds>
 *                         [--platform darwin|win32|linux] [--scale <n>] [--fps 30] [--display 0]
 *                         [--tool screencapture|ffmpeg] [--grabber ddagrab|gdigrab] [--out <file>]
 *                         [--devices <recorded probe output>] [--run] [--force]
 *
 * --slot is the clip's CSS size; --region is the capture rectangle in points (logical pixels) on the display, and
 * --scale its backing scale (2 on a Retina Mac, the Windows display scale, 1 by default elsewhere). The capture goes to
 * the operating system's temporary folder unless --out names a file. The pre-flight is the template
 * assets/reference/capture-preflight.md with its fields filled and every item ticked. --devices reads a recorded probe
 * (an avfoundation device listing on macOS, the probe's error output elsewhere) instead of probing, for fixtures and
 * for a probe run by the user outside the sandbox. Without --run it records nothing and writes nothing.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_BOUNDARY, probeMedia, runTool } from '../../shared/check-media.mjs';
import { createReport, dropProject, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand, sandboxReason } from '../../shared/sandbox.mjs';

export const VERSION = '1.0.0';
export const PLATFORMS = ['darwin', 'win32', 'linux'];
export const PREFLIGHT_FIELDS = ['Recording', 'Approved by', 'Date'];
export const PREFLIGHT_ITEMS = ['consent', 'demo-data', 'notifications', 'private-windows', 'secrets', 'other-people', 'status-bar', 'region'];
export const MEASURED = Object.freeze({
  win32: 'test captures through ddagrab and gdigrab were measured for this part',
  darwin: null,
  linux: null,
});
const USAGE = 'Usage: node capture-plan.mjs --preflight <file> --slot <WxH> --region <x,y,w,h> --duration <seconds> [--platform darwin|win32|linux] [--scale <n>] [--fps 30] [--display 0] [--tool screencapture|ffmpeg] [--grabber ddagrab|gdigrab] [--out <file>] [--devices <file>] [--run] [--force]';
const BOUNDARY = `${MEDIA_BOUNDARY} A capture plan proves that the pre-flight was completed and a screen was visible to this process; it does not prove what the screen showed.`;

const numbers = (value, count, name) => {
  const parts = String(value ?? '').split(/[x,]/).map(Number);
  if (parts.length !== count || parts.some((part) => !Number.isFinite(part) || part < 0)) throw new UsageError(`${name} needs ${count} numbers, got ${value}.`, USAGE);
  return parts;
};

export function parseArgs(argv, platform = process.platform) {
  const options = { preflight: null, slot: null, region: null, duration: null, platform, scale: null, fps: 30, display: 0, tool: null, grabber: 'ddagrab', out: null, devices: null, run: false, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--preflight') options.preflight = value();
    else if (arg === '--slot') options.slot = value();
    else if (arg === '--region') options.region = value();
    else if (arg === '--duration') options.duration = Number(value());
    else if (arg === '--platform') options.platform = value();
    else if (arg === '--scale') options.scale = Number(value());
    else if (arg === '--fps') options.fps = Number(value());
    else if (arg === '--display') options.display = Number(value());
    else if (arg === '--tool') options.tool = value();
    else if (arg === '--grabber') options.grabber = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--devices') options.devices = value();
    else if (arg === '--run') options.run = true;
    else if (arg === '--force') options.force = true;
    else throw new UsageError(`Unknown option ${arg}.`, USAGE);
  }
  if (!PLATFORMS.includes(options.platform)) throw new UsageError(`--platform is one of ${PLATFORMS.join(', ')}; got ${options.platform}.`, USAGE);
  if (!options.slot || !options.region || options.duration === null) throw new UsageError(USAGE);
  const [slotWidth, slotHeight] = numbers(options.slot, 2, '--slot');
  const [x, y, width, height] = numbers(options.region, 4, '--region');
  if (!(slotWidth > 0 && slotHeight > 0 && width > 0 && height > 0)) throw new UsageError('--slot and --region need a positive width and height.', USAGE);
  if (!(options.duration > 0)) throw new UsageError('--duration is a positive number of seconds.', USAGE);
  if (!(options.fps > 0 && options.fps <= 60)) throw new UsageError('--fps is above 0 and at most 60.', USAGE);
  if (!Number.isInteger(options.display) || options.display < 0) throw new UsageError('--display is a display index, 0 or more.', USAGE);
  options.scale ??= options.platform === 'darwin' ? 2 : 1;
  if (!(options.scale > 0)) throw new UsageError('--scale is a positive number.', USAGE);
  options.tool ??= options.platform === 'darwin' ? 'screencapture' : 'ffmpeg';
  if (!['screencapture', 'ffmpeg'].includes(options.tool)) throw new UsageError('--tool is screencapture or ffmpeg.', USAGE);
  if (options.tool === 'screencapture' && options.platform !== 'darwin') throw new UsageError('screencapture exists only on macOS; use --tool ffmpeg.', USAGE);
  if (!['ddagrab', 'gdigrab'].includes(options.grabber)) throw new UsageError('--grabber is ddagrab or gdigrab.', USAGE);
  options.slotSize = { width: slotWidth, height: slotHeight };
  options.rect = { x, y, width, height };
  options.out ??= path.join(os.tmpdir(), 'launch-video-capture', options.tool === 'screencapture' ? 'capture.mov' : 'capture.mp4');
  return options;
}

const filled = (value) => typeof value === 'string' && value.trim() !== '' && !/^<.*>$/.test(value.trim());

/** Reads a pre-flight file: its fields and the ticked state of each item. */
export function readPreflight(text) {
  const fields = {};
  const items = {};
  for (const line of String(text).split(/\r?\n/)) {
    const item = /^\s*[-*]\s*\[( |x|X)\]\s*([a-z][a-z-]*)\s*:/.exec(line);
    if (item) {
      items[item[2]] = item[1] !== ' ';
      continue;
    }
    const field = /^([A-Z][A-Za-z ]*?):\s*(.*)$/.exec(line);
    if (field && PREFLIGHT_FIELDS.includes(field[1])) fields[field[1]] = field[2];
  }
  return { fields, items };
}

/** Reports LV-CAP-01: an error for each missing field or unticked item, a pass when the pre-flight is complete. */
export function checkPreflight(file, report) {
  if (!file) {
    report.error('LV-CAP-01', 'arguments', 'no --preflight', 'a completed recording pre-flight');
    return false;
  }
  if (!fs.existsSync(file)) {
    report.error('LV-CAP-01', file, 'the file does not exist', 'a completed recording pre-flight');
    return false;
  }
  const { fields, items } = readPreflight(fs.readFileSync(file, 'utf8'));
  let complete = true;
  for (const name of PREFLIGHT_FIELDS) {
    if (filled(fields[name])) continue;
    complete = false;
    report.error('LV-CAP-01', `${file}: ${name}`, fields[name] === undefined ? 'missing' : 'not filled in', 'filled in');
  }
  if (filled(fields.Date) && !/^\d{4}-\d{2}-\d{2}$/.test(fields.Date.trim())) {
    complete = false;
    report.error('LV-CAP-01', `${file}: Date`, fields.Date.trim(), 'YYYY-MM-DD');
  }
  for (const id of PREFLIGHT_ITEMS) {
    if (items[id]) continue;
    complete = false;
    report.error('LV-CAP-01', `${file}: ${id}`, items[id] === undefined ? 'missing' : 'not ticked', 'ticked after checking the screen');
  }
  if (complete) report.pass('LV-CAP-01', file, `${PREFLIGHT_FIELDS.length} fields filled, ${PREFLIGHT_ITEMS.length} items ticked`, 'a completed recording pre-flight');
  return complete;
}

/** The avfoundation index of each screen in a device listing, by its screen number. */
export function screenDevices(listing) {
  const screens = new Map();
  for (const match of String(listing).matchAll(/\[(\d+)\]\s+Capture screen (\d+)/g)) screens.set(Number(match[2]), Number(match[1]));
  return screens;
}

function probeArgs(options) {
  if (options.platform === 'darwin') return ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''];
  if (options.platform === 'win32' && options.grabber === 'ddagrab') return ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `ddagrab=output_idx=${options.display}:framerate=1,hwdownload,format=bgra`, '-frames:v', '1', '-f', 'null', '-'];
  if (options.platform === 'win32') return ['-hide_banner', '-loglevel', 'error', '-f', 'gdigrab', '-framerate', '1', '-i', 'desktop', '-frames:v', '1', '-f', 'null', '-'];
  return ['-hide_banner', '-loglevel', 'error', '-f', 'x11grab', '-i', process.env.DISPLAY ?? ':0', '-frames:v', '1', '-f', 'null', '-'];
}

/**
 * Whether a screen is visible: the recorded or live probe output, with the avfoundation screen index on macOS. A probe
 * on Windows and Linux reads one frame into the null muxer, so nothing is kept.
 */
export function probeScreen(options, command = currentCommand()) {
  if (options.platform !== process.platform && !options.devices) throw new UsageError(`Probing ${options.platform} needs that system, or --devices with a probe recorded there.`, USAGE);
  if (options.platform === 'linux' && !options.devices && !process.env.DISPLAY && process.env.WAYLAND_DISPLAY) {
    throw new UsageError('This is a Wayland session without an X display; x11grab cannot see its windows.', 'Record with the desktop\'s own screen recorder or OBS through PipeWire, then encode that file with encode.mjs.');
  }
  const text = options.devices ? fs.readFileSync(options.devices, 'utf8') : (() => {
    const result = runTool('ffmpeg', probeArgs(options));
    return `${result.stderr ?? ''}${options.platform === 'darwin' || result.status === 0 ? '' : `\nexit ${result.status}`}`;
  })();
  const reason = sandboxReason(text);
  if (reason) throw new SandboxError(`Blocked: ${reason}.`, command);
  if (options.platform === 'darwin') {
    const screens = screenDevices(text);
    if (!screens.size) throw new SandboxError('Blocked: no screen capture device is visible.', command);
    if (!screens.has(options.display)) throw new UsageError(`Display ${options.display} is not in the device listing; screens: ${[...screens.keys()].join(', ')}.`);
    return { device: screens.get(options.display) };
  }
  if (/\nexit \d+/.test(text)) throw new UsageError(`The capture probe failed: ${text.trim().split(/\r?\n/).slice(-3).join(' ')}`);
  return { device: null };
}

const even = (value) => Math.max(2, Math.round(value / 2) * 2);

/** The capture command for the options and the probed device; pure, so tests can read it. */
export function captureCommand(options, probe) {
  const { x, y, width, height } = options.rect;
  const pixels = { x: Math.round(x * options.scale), y: Math.round(y * options.scale), width: even(width * options.scale), height: even(height * options.scale) };
  const seconds = String(options.duration);
  const master = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', '-an', options.out];
  if (options.tool === 'screencapture') {
    return ['screencapture', '-v', '-x', '-V', seconds, `-R${x},${y},${width},${height}`, `-D${options.display + 1}`, options.out];
  }
  if (options.platform === 'darwin') {
    return ['ffmpeg', '-hide_banner', '-y', '-f', 'avfoundation', '-capture_cursor', '1', '-framerate', String(options.fps), '-i', `${probe.device}:none`, '-t', seconds, '-vf', `crop=${pixels.width}:${pixels.height}:${pixels.x}:${pixels.y}`, ...master];
  }
  if (options.platform === 'win32' && options.grabber === 'ddagrab') {
    return ['ffmpeg', '-hide_banner', '-y', '-f', 'lavfi', '-i', `ddagrab=output_idx=${options.display}:framerate=${options.fps}:draw_mouse=1:offset_x=${pixels.x}:offset_y=${pixels.y}:video_size=${pixels.width}x${pixels.height},hwdownload,format=bgra`, '-t', seconds, ...master];
  }
  if (options.platform === 'win32') {
    return ['ffmpeg', '-hide_banner', '-y', '-f', 'gdigrab', '-framerate', String(options.fps), '-draw_mouse', '1', '-offset_x', String(pixels.x), '-offset_y', String(pixels.y), '-video_size', `${pixels.width}x${pixels.height}`, '-t', seconds, '-i', 'desktop', ...master];
  }
  return ['ffmpeg', '-hide_banner', '-y', '-f', 'x11grab', '-framerate', String(options.fps), '-draw_mouse', '1', '-video_size', `${pixels.width}x${pixels.height}`, '-t', seconds, '-i', `${process.env.DISPLAY ?? ':0'}+${pixels.x},${pixels.y}`, ...master];
}

export const displayCommand = (args, platform = process.platform) =>
  args.map((arg) => (/^[\w./:=@%+,-]+$/.test(arg) ? arg : platform === 'win32' ? `"${arg.replace(/"/g, '\\"')}"` : `'${arg.replace(/'/g, "'\\''")}'`)).join(' ');

/** LV-WARN-REGION and LV-WARN-CAPTURE for a plan. */
export function checkPlan(options, report) {
  const { width } = options.rect;
  report.check('LV-WARN-REGION', width >= options.slotSize.width, 'region', `${width} points wide for a ${options.slotSize.width} CSS px slot`, 'at least as wide in points as the slot, so the clip is never upscaled', 'warn');
  const measured = MEASURED[options.platform];
  const slowGrabber = options.platform === 'win32' && options.grabber === 'gdigrab' && options.fps > 30;
  if (slowGrabber) report.warn('LV-WARN-CAPTURE', 'gdigrab', `${options.fps} fps requested`, 'ddagrab above 30 fps: gdigrab fell short of 60 fps in the test capture');
  else report.check('LV-WARN-CAPTURE', Boolean(measured), options.platform, measured ?? 'no test capture on this system has been measured for this part', 'a measured capture path', 'warn');
}

async function main() {
  const options = parseArgs(dropProject(process.argv.slice(2)));
  const command = currentCommand();
  const report = createReport({ tool: 'capture-plan', boundary: BOUNDARY });
  if (!checkPreflight(options.preflight, report)) {
    process.stderr.write('Stopped: no capture is planned or run without a completed recording pre-flight. Fill in assets/reference/capture-preflight.md with the user.\n');
    return report.summary();
  }
  const probe = probeScreen(options, command);
  checkPlan(options, report);
  const args = captureCommand(options, probe);
  process.stderr.write(`capture-plan ${VERSION} will run:\n  ${displayCommand(args)}\nand write:\n  ${options.out}\nThen review the frames with contact-sheet.mjs before encoding.\n`);
  if (!options.run) return report.summary();
  if (fs.existsSync(options.out) && !options.force) throw new UsageError(`Stopped: ${options.out} already exists.`, 'Choose another --out, or pass --force to replace it.');
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new UsageError(`${args[0]} was not found on PATH.`);
  const reason = sandboxReason(`${result.stderr ?? ''}${result.stdout ?? ''}`);
  if (reason) throw new SandboxError(`Blocked: ${reason}.`, command);
  if (result.status !== 0 || !fs.existsSync(options.out)) throw new UsageError(`The capture failed: ${String(result.stderr ?? '').trim().split(/\r?\n/).slice(-3).join(' ')}`);
  const captured = probeMedia(options.out);
  report.check('LV-WARN-REGION', (captured.video?.width ?? 0) >= options.slotSize.width, options.out, `${captured.video?.width ?? 0} px wide`, `at least ${options.slotSize.width} px`, 'warn');
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main);
