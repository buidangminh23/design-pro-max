#!/usr/bin/env node
/**
 * Media and browser verification (L1 and L3) for the own parts' error rules. It copies the shipped part and shared
 * folders outside the repository, so the checkers run with no repository files and no node_modules of their own,
 * builds the fixture media with ffmpeg, then runs every case of fixtures/<part>/cases.json and judges it red-first:
 * a fail case must exit 1 with an error for its rule, a pass case must check its rule and pass it.
 *
 *   node scripts/verify.mjs [--only <case id or rule id>] [--keep] [--json]
 *
 * Needs ffmpeg and ffprobe on PATH and Playwright with Chromium installed in this repository (npm install --no-save
 * playwright, then npx playwright install chromium-headless-shell). Exit codes: 0 every case judged right, 1 a case
 * judged wrong, 2 a missing tool.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, SKILL_DIR, isMainModule } from './lib/vendor.mjs';
import { buildFixtureMedia } from './lib/fixture-media.mjs';

export const PARTS = ['launch-scroll'];
const SHIPPED = ['shared', ...PARTS];

export function loadCases(root = ROOT) {
  return PARTS.flatMap((part) => {
    const file = path.join(root, 'fixtures', part, 'cases.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).cases.map((entry) => ({ ...entry, part }));
  });
}

const rulesOf = (entry) => (Array.isArray(entry.rule) ? entry.rule : [entry.rule]);

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}

function toolMissing() {
  const missing = [];
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(tool, ['-version'], { windowsHide: true });
    if (result.error) missing.push(tool);
  }
  try {
    import.meta.resolve('playwright');
  } catch {
    missing.push('playwright (npm install --no-save playwright)');
  }
  return missing;
}

function buildSite(entry, skill, media, folder) {
  const part = path.join(skill, entry.part);
  copyTree(path.join(part, 'assets', 'lib'), path.join(folder, 'lib'));
  copyTree(path.join(part, 'assets', 'reference'), path.join(folder, 'reference'));
  copyTree(path.join(ROOT, 'fixtures', entry.part, 'pages'), path.join(folder, 'pages'));
  const pageFolder = path.dirname(path.join(folder, entry.page));
  for (const [name, recipe] of Object.entries(entry.media ?? {})) {
    if (!media[recipe]) throw new Error(`${entry.id}: unknown media recipe ${recipe}`);
    fs.copyFileSync(media[recipe], path.join(pageFolder, name));
  }
}

function runCase(entry, skill, media, scratch) {
  let args;
  if (entry.checker === 'check-media') {
    args = [path.join(skill, 'shared', 'check-media.mjs'), ...entry.files.map((recipe) => media[recipe])];
  } else if (entry.checker === 'probe-scene') {
    const site = path.join(scratch, 'sites', entry.id);
    buildSite(entry, skill, media, site);
    args = [path.join(skill, entry.part, 'scripts', 'probe-scene.mjs'), '--serve', site, '--page', entry.page, '--server', entry.server, '--project', ROOT, ...(entry.args ?? [])];
  } else {
    throw new Error(`${entry.id}: unknown checker ${entry.checker}`);
  }
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', seconds: (Date.now() - started) / 1000 };
}

async function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const keep = argv.includes('--keep');
  const json = argv.includes('--json');
  const missing = toolMissing();
  if (missing.length) {
    process.stderr.write(`verify needs: ${missing.join(', ')}\n`);
    return 2;
  }
  const { evaluateRun } = await import(new URL(`../${SKILL_DIR}/shared/harness.mjs`, import.meta.url));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dpm-verify-'));
  const skill = path.join(scratch, 'skill');
  for (const folder of SHIPPED) copyTree(path.join(ROOT, SKILL_DIR, folder), path.join(skill, folder));
  const cases = loadCases().filter((entry) => !only || entry.id === only || rulesOf(entry).includes(only));
  if (!cases.length) {
    process.stderr.write(`no case matches ${only}\n`);
    return 2;
  }
  const media = buildFixtureMedia(path.join(scratch, 'media'), { encodeScrub: path.join(skill, 'launch-scroll', 'scripts', 'encode-scrub.mjs') });
  const results = [];
  for (const entry of cases) {
    const run = runCase(entry, skill, media, scratch);
    const verdict = evaluateRun(entry, run);
    results.push({ id: entry.id, expect: entry.expect, rules: rulesOf(entry), ok: verdict.ok, problems: verdict.problems, seconds: run.seconds });
    if (!json) {
      process.stdout.write(`${verdict.ok ? 'ok  ' : 'FAIL'} ${entry.expect.padEnd(4)} ${entry.id} (${rulesOf(entry).join(', ')}) ${run.seconds.toFixed(1)} s\n`);
      if (!verdict.ok) process.stdout.write(`     ${verdict.problems.join('\n     ')}\n${run.stderr ? `     stderr: ${run.stderr.trim().split('\n').slice(-5).join('\n     ')}\n` : ''}`);
    }
  }
  if (json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  const wrong = results.filter((result) => !result.ok);
  if (!json) process.stdout.write(`${results.length - wrong.length}/${results.length} cases judged right${keep ? `; kept ${scratch}` : ''}\n`);
  if (!keep) fs.rmSync(scratch, { recursive: true, force: true });
  return wrong.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
