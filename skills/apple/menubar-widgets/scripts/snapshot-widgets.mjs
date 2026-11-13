/**
 * menubar-widgets snapshot runner: builds assets/SnapshotRenderer.swift with the project's view sources and a
 * SnapshotCatalog, renders every entry offscreen with ImageRenderer at its own size, writes one PNG per entry and,
 * with a baseline, compares the bytes with the previous build's PNGs. macOS only; elsewhere it reports its rules as
 * skipped and exits 0.
 *
 *   node snapshot-widgets.mjs --out <folder> [--baseline <folder> [--update]] [--batch <n>] [--scale <n>] [--fonts <folder>] <swift file or folder> [...]
 *
 * The sources must declare `enum SnapshotCatalog { @MainActor static func entries() -> [SnapshotEntry] }` and every
 * view the catalog uses; they are compiled as a command-line tool, so they may import SwiftUI and WidgetKit but not the
 * app's other modules. Errors: MW-SNAP-01 an entry that needs more height than its size, renders no image or whose
 * batch aborts; MW-SNAP-02 a PNG whose bytes differ from the baseline. --update writes the baseline instead of
 * comparing. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReport, isMain, runMain, SandboxError, UsageError } from '../../shared/report.mjs';
import { currentCommand } from '../../shared/sandbox.mjs';
import { listFiles } from './scan-swift.mjs';

export const BOUNDARY = 'Proof boundary: offscreen ImageRenderer output of the views at the given sizes, built as a command-line tool; it does not prove the widget extension, its timeline, the placed widget on the desktop, Link or AppKit-backed controls (they draw as placeholders) or how WidgetKit tints and removes backgrounds. Look at the placed widget for those.';
export const RENDERER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'SnapshotRenderer.swift');
export const DEFAULT_BATCH = 40;
export const MAX_BATCH = 60;
const SANDBOX_COMPILE = /Operation not permitted|sandbox|ModuleCache[^\n]*denied|xcrun: error: cannot be used within an App Sandbox/i;

function parseArgs(argv) {
  const options = { sources: [], update: false, batch: DEFAULT_BATCH, scale: 2 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      if (index + 1 >= argv.length) throw new UsageError(`${arg} needs a value.`);
      index += 1;
      return argv[index];
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--baseline') options.baseline = value();
    else if (arg === '--update') options.update = true;
    else if (arg === '--batch') options.batch = Number(value());
    else if (arg === '--scale') options.scale = Number(value());
    else if (arg === '--fonts') options.fonts = value();
    else if (arg.startsWith('--')) throw new UsageError(`Unknown option ${arg}.`);
    else options.sources.push(arg);
  }
  if (!options.out || !options.sources.length) throw new UsageError('Usage: node snapshot-widgets.mjs --out <folder> [--baseline <folder> [--update]] [--batch <n>] [--scale <n>] [--fonts <folder>] <swift file or folder> [...]');
  if (options.update && !options.baseline) throw new UsageError('--update needs --baseline.');
  if (!Number.isInteger(options.batch) || options.batch < 1 || options.batch > MAX_BATCH) throw new UsageError(`--batch takes 1 to ${MAX_BATCH}.`);
  if (!(options.scale > 0)) throw new UsageError('--scale takes a positive number.');
  return options;
}

export function batches(count, size) {
  const ranges = [];
  for (let from = 0; from < count; from += size) ranges.push([from, Math.min(count, from + size)]);
  return ranges;
}

export function parseResults(text) {
  return String(text).split(/\r?\n/).filter((line) => line.startsWith('{')).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

export function compareWithBaseline(file, baselineFile) {
  if (!fs.existsSync(baselineFile)) return 'missing';
  return fs.readFileSync(file).equals(fs.readFileSync(baselineFile)) ? 'same' : 'changed';
}

function build(sources, folder) {
  const binary = path.join(folder, 'snapshot-renderer');
  const target = `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14`;
  const args = ['-parse-as-library', '-swift-version', '5', '-target', target, '-module-cache-path', path.join(folder, 'module-cache'), RENDERER, ...sources, '-o', binary];
  const result = spawnSync('swiftc', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new UsageError('swiftc is not on PATH.', 'Install Xcode or the Command Line Tools: xcode-select --install');
  if (result.status !== 0) {
    const output = `${result.stderr ?? ''}${result.stdout ?? ''}`;
    if (SANDBOX_COMPILE.test(output)) throw new SandboxError('Blocked: swiftc could not write its caches or outputs.', currentCommand());
    throw new UsageError(`The sources did not compile with the renderer:\n${output.trim().split('\n').slice(-30).join('\n')}`, 'Declare SnapshotCatalog.entries() and include every file the views need; app-only modules cannot be imported.');
  }
  return binary;
}

function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 5 * 60 * 1000 });
  if (['EPERM', 'EACCES'].includes(result.error?.code)) throw new SandboxError('Blocked: the renderer could not start.', currentCommand());
  return result;
}

export function judgeResult(result, scale) {
  if (result.problem) return { ok: false, measured: result.problem };
  const expected = [Math.round(result.width * scale), Math.round(result.height * scale)];
  if (result.pixels?.[0] !== expected[0] || result.pixels?.[1] !== expected[1]) return { ok: false, measured: `rendered ${result.pixels?.join('x')} px, expected ${expected.join('x')} px` };
  return { ok: true, measured: `${result.pixels.join('x')} px; content needs ${Math.ceil(result.neededHeight)} of ${result.height} pt` };
}

export function snapshot(options, report) {
  const sources = listFiles(options.sources);
  if (!sources.length) throw new UsageError('No .swift file found.');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-snapshot-'));
  try {
    const binary = build(sources, scratch);
    const fontArgs = options.fonts ? ['--fonts', path.resolve(options.fonts)] : [];
    const counted = run(binary, ['--count', ...fontArgs]);
    const count = Number.parseInt(counted.stdout, 10);
    if (counted.status !== 0 || !Number.isInteger(count)) throw new UsageError(`The renderer could not list the catalog: ${(counted.stderr ?? '').trim().split('\n').slice(-5).join(' ')}`);
    const out = path.resolve(options.out);
    fs.mkdirSync(out, { recursive: true });
    const rendered = [];
    for (const [from, to] of batches(count, options.batch)) {
      const result = run(binary, ['--out', out, '--from', String(from), '--to', String(to), '--scale', String(options.scale), ...fontArgs]);
      const lines = parseResults(result.stdout);
      rendered.push(...lines);
      if (result.status !== 0 || lines.length !== to - from) {
        report.error('MW-SNAP-01', `entries ${from}-${to - 1}`, `the renderer stopped after ${lines.length} of ${to - from} entries (${result.signal ?? `exit ${result.status}`})`, `fix the entry after the last one rendered, or lower --batch below ${options.batch}`);
      }
    }
    for (const result of rendered) {
      const verdict = judgeResult(result, options.scale);
      report.check('MW-SNAP-01', verdict.ok, result.name, verdict.measured, `fits ${result.width}x${result.height} pt and renders at ${options.scale}x`);
      if (!verdict.ok || !options.baseline || !result.file) continue;
      const file = path.join(out, result.file);
      const baselineFile = path.join(path.resolve(options.baseline), result.file);
      if (options.update) {
        fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
        fs.copyFileSync(file, baselineFile);
        report.skip('MW-SNAP-02', result.name, 'baseline written; compare on the next build');
        continue;
      }
      const state = compareWithBaseline(file, baselineFile);
      if (state === 'missing') report.warn('MW-SNAP-02', result.name, 'no baseline PNG for this entry', 'run once with --update on the previous build');
      else report.check('MW-SNAP-02', state === 'same', result.name, state === 'same' ? 'byte-equal to the baseline' : 'bytes differ from the baseline', 'byte-equal to the previous build, or an intended change confirmed by looking at both PNGs and rerunning with --update');
    }
    return report;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'snapshot-widgets', boundary: BOUNDARY });
  if (process.platform !== 'darwin') {
    report.skip('MW-SNAP-01', options.sources.join(' '), `ImageRenderer and swiftc need macOS; this is ${process.platform}`);
    if (options.baseline) report.skip('MW-SNAP-02', options.baseline, `ImageRenderer and swiftc need macOS; this is ${process.platform}`);
    return report.summary();
  }
  snapshot(options, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
