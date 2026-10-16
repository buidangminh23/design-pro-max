#!/usr/bin/env node
/**
 * Local stand-in for CI when GitHub Actions cannot run (for example when the account's Actions budget is spent).
 * Runs every step of the test job in .github/workflows/ci.yml (L0), then scripts/verify.mjs (L1 media and L3 browser)
 * when ffmpeg, ffprobe and Playwright are available, and lists what this run did not cover.
 *
 *   node scripts/ci-local.mjs [--skip-verify] [--json]
 *
 * Exit codes: 0 every step that ran passed, 1 a step failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, isMainModule } from './lib/vendor.mjs';

export const CI_FILE = '.github/workflows/ci.yml';
export const VERIFY_COMMAND = 'node scripts/verify.mjs';
const STEP_TIMEOUT = 20 * 60_000;

/** The single-line `run:` commands of the test job in ci.yml, in order. */
export function ciSteps(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^ {2}test:\s*$/.test(line));
  if (start < 0) throw new Error(`${CI_FILE}: has no test job`);
  const steps = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line)) break;
    const run = /^ +run: (?!\|)(.+)$/.exec(line);
    if (run) steps.push(run[1].trim());
  }
  return steps;
}

/** The tools verify.mjs needs that this machine lacks. */
export function verifyMissing(root = ROOT) {
  const missing = [];
  for (const tool of ['ffmpeg', 'ffprobe']) if (spawnSync(tool, ['-version'], { windowsHide: true }).error) missing.push(tool);
  if (!fs.existsSync(path.join(root, 'node_modules', 'playwright', 'package.json'))) missing.push('playwright');
  return missing;
}

/** What a local run never covers, plus what this run skipped. */
export function notCovered({ verifySkipped }) {
  const gaps = [
    `the CI matrix: only ${process.platform} with Node ${process.versions.node} ran here, not ubuntu, macos and windows with Node 22 and 24`,
    'L2 full media (verify.yml from v0.2)',
    'the GitHub-side steps of release.yml and vendor-sync.yml',
  ];
  if (verifySkipped) gaps.push(`L1 media and L3 browser (${verifySkipped})`);
  return gaps;
}

function runStep(command, root) {
  const started = Date.now();
  const result = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', timeout: STEP_TIMEOUT, windowsHide: true });
  return { command, status: result.status ?? 1, seconds: Math.round((Date.now() - started) / 100) / 10, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function ciLocal(root = ROOT, { skipVerify = false, run = runStep } = {}) {
  const commands = ciSteps(fs.readFileSync(path.join(root, ...CI_FILE.split('/')), 'utf8'));
  let verifySkipped = skipVerify ? 'skipped with --skip-verify' : null;
  if (!verifySkipped) {
    const missing = verifyMissing(root);
    if (missing.length) verifySkipped = `missing ${missing.join(', ')}`;
    else commands.push(VERIFY_COMMAND);
  }
  const results = commands.map((command) => run(command, root));
  return { passed: results.every((item) => item.status === 0), results, notCovered: notCovered({ verifySkipped }) };
}

function main(argv) {
  const report = ciLocal(ROOT, { skipVerify: argv.includes('--skip-verify') });
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...report, results: report.results.map(({ output, ...rest }) => rest) }, null, 2));
  } else {
    for (const item of report.results) {
      console.log(`${item.status === 0 ? 'pass' : 'FAIL'}  ${item.command}  (${item.seconds} s)`);
      if (item.status !== 0) console.log(item.output.trimEnd().split('\n').slice(-20).map((line) => `      ${line}`).join('\n'));
    }
    console.log('Not covered by this run:');
    for (const gap of report.notCovered) console.log(`- ${gap}`);
  }
  return report.passed ? 0 : 1;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
