/**
 * launch-video contact sheet: one PNG of evenly spaced frames from a capture, for the user to review before anything is
 * encoded or shared. It looks for nothing by itself; the user checks every tile for notifications, private windows,
 * secrets and other people's data. Calls ffmpeg (never bundled).
 *
 *   node contact-sheet.mjs <capture> [--out <png>] [--columns 4] [--rows 3] [--width 320] [--force]
 *
 * The sheet goes next to the capture's temporary folder unless --out names a file. Output is one JSON line with the
 * sheet path, the grid and the time of each tile.
 */
import fs from 'node:fs';
import path from 'node:path';
import { probeMedia, runTool } from '../../shared/check-media.mjs';
import { dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';
import { ffmpegFailure } from './encode.mjs';

const USAGE = 'Usage: node contact-sheet.mjs <capture> [--out <png>] [--columns 4] [--rows 3] [--width 320] [--force]';

export function parseArgs(argv) {
  const options = { capture: null, out: null, columns: 4, rows: 3, width: 320, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`, USAGE);
      return argv[++index];
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--columns') options.columns = Number(value());
    else if (arg === '--rows') options.rows = Number(value());
    else if (arg === '--width') options.width = Number(value());
    else if (arg === '--force') options.force = true;
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`, USAGE);
    else if (!options.capture) options.capture = arg;
    else throw new UsageError(`Unexpected argument ${arg}.`, USAGE);
  }
  if (!options.capture) throw new UsageError(USAGE);
  for (const name of ['columns', 'rows', 'width']) if (!Number.isInteger(options[name]) || options[name] < 1) throw new UsageError(`--${name} is a positive whole number.`, USAGE);
  options.out ??= path.join(path.dirname(path.resolve(options.capture)), `${path.parse(options.capture).name}.contact.png`);
  return options;
}

/** The time of each tile: the middle of each of the equal parts of the clip. */
export function tileTimes(seconds, count) {
  return Array.from({ length: count }, (_, index) => Number((((index + 0.5) * seconds) / count).toFixed(3)));
}

export function sheetArgs(options, seconds) {
  const count = options.columns * options.rows;
  const rate = `${count}/${seconds}`;
  return ['-i', options.capture, '-vf', `fps=${rate}:start_time=0:round=down,scale=${options.width}:-2:flags=lanczos,tile=${options.columns}x${options.rows}:padding=4:margin=4`, '-frames:v', '1', '-update', '1', options.out];
}

async function main() {
  const options = parseArgs(dropProject(process.argv.slice(2)));
  const info = probeMedia(options.capture);
  if (!info.video || !info.duration) throw new UsageError(`${options.capture} has no video stream with a readable duration.`);
  if (fs.existsSync(options.out) && !options.force) throw new UsageError(`Stopped: ${options.out} already exists.`, 'Choose another --out, or pass --force to replace it.');
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  const result = runTool('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...sheetArgs(options, info.duration)]);
  if (result.status !== 0) throw ffmpegFailure(result.stderr, currentCommand());
  const count = options.columns * options.rows;
  process.stdout.write(`${JSON.stringify({ tool: 'contact-sheet', sheet: options.out, columns: options.columns, rows: options.rows, seconds: tileTimes(info.duration, count), review: 'check every tile for notifications, private windows, secrets and other people before encoding' })}\n`);
  return 0;
}

if (isMain(import.meta.url)) await runMain(main);
