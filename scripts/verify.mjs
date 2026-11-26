#!/usr/bin/env node
/**
 * Media and browser verification (L1 and L3) for the own parts' error rules. It copies the shipped part and shared
 * folders outside the repository, so the checkers run with no repository files and no node_modules of their own,
 * builds the fixture media with ffmpeg, then runs every case of fixtures/<part>/cases.json and judges it red-first:
 * a fail case must exit 1 with an error for its rule, a pass case must check its rule and pass it.
 * A case with checkerPart runs that part's checker against the case part's own pages; a case with an expected file
 * must also report exactly the planted errors of its rules for its checker.
 *
 *   node scripts/verify.mjs [--only <case id or rule id>[,<more>]] [--keep] [--json]
 *
 * A case with platform runs only on that platform (menubar-widgets snapshots need macOS) and is listed as skipped elsewhere.
 *
 * Needs ffmpeg and ffprobe on PATH and Playwright with Chromium installed in this repository (npm install --no-save
 * playwright, then npx playwright install chromium-headless-shell); the web-shells cases also need its WebKit (npx
 * playwright install webkit) and openssl. Exit codes: 0 every case judged right, 1 a case
 * judged wrong, 2 a missing tool.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, SKILL_DIR, isMainModule } from './lib/vendor.mjs';
import { buildFixtureMedia, buildLaunchVideoMedia } from './lib/fixture-media.mjs';

export const PARTS = ['launch-scroll', 'launch-video', 'launch-page', 'menubar-widgets', 'web-shells', 'host-ops'];
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
  fs.mkdirSync(folder, { recursive: true });
  for (const item of fs.readdirSync(path.join(part, 'assets'), { withFileTypes: true })) {
    if (item.isFile()) fs.copyFileSync(path.join(part, 'assets', item.name), path.join(folder, item.name));
  }
  copyTree(path.join(part, 'assets', 'lib'), path.join(folder, 'lib'));
  copyTree(path.join(part, 'assets', 'reference'), path.join(folder, 'reference'));
  copyTree(path.join(ROOT, 'fixtures', entry.part, 'pages'), path.join(folder, 'pages'));
  const pageFolder = entry.page ? path.dirname(path.join(folder, entry.page)) : folder;
  for (const [name, recipe] of Object.entries(entry.media ?? {})) {
    if (!media[recipe]) throw new Error(`${entry.id}: unknown media recipe ${recipe}`);
    if (fs.statSync(media[recipe]).isDirectory()) copyTree(media[recipe], path.join(pageFolder, name));
    else fs.copyFileSync(media[recipe], path.join(pageFolder, name));
  }
}

const MENUBAR_CHECKERS = ['scan-swift', 'probe-extension', 'snapshot-widgets'];

/** Arguments for a menubar-widgets case: Swift sources, a recorded process table, or a snapshot run with a baseline. */
export function menubarWidgetsArgs(entry, skill, scratch, root = ROOT) {
  const script = (name) => path.join(skill, entry.part, 'scripts', `${name}.mjs`);
  const fixture = (file) => path.join(root, 'fixtures', entry.part, ...file.split('/'));
  const sources = (list) => list.map((file) => (file.startsWith('assets/') ? path.join(skill, entry.part, ...file.split('/')) : fixture(file)));
  if (entry.checker === 'scan-swift') return [script('scan-swift'), ...(entry.args ?? []), ...sources(entry.sources)];
  if (entry.checker === 'probe-extension') {
    const folder = path.join(scratch, 'probe', entry.id);
    const app = path.join(folder, path.basename(entry.app));
    copyTree(fixture(entry.app), app);
    for (const copy of entry.copies ?? []) copyTree(fixture(copy), path.join(folder, ...copy.split('/').slice(1)));
    const recording = (file) => {
      const target = path.join(folder, path.basename(file));
      fs.writeFileSync(target, fs.readFileSync(fixture(file), 'utf8').replaceAll('@APP@', app).replaceAll('@DIR@', folder));
      return target;
    };
    return [script('probe-extension'), '--app', app, '--installed', entry.installed, ...(entry.tz ? ['--tz', entry.tz] : []), '--ps', recording(entry.ps), '--lsof', recording(entry.lsof)];
  }
  const folder = path.join(scratch, 'snapshots', entry.id);
  const args = [script('snapshot-widgets'), '--out', path.join(folder, 'png'), ...(entry.args ?? [])];
  if (entry.baselineSources) {
    const baseline = path.join(folder, 'baseline');
    const written = spawnSync(process.execPath, [script('snapshot-widgets'), '--out', path.join(folder, 'baseline-png'), '--baseline', baseline, '--update', ...sources(entry.baselineSources)], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
    if (written.status !== 0) {
      const output = `the baseline run exited ${written.status ?? written.signal}:\n${written.stdout ?? ''}${written.stderr ?? ''}`;
      return ['-e', `process.stderr.write(${JSON.stringify(output)}); process.exit(4)`];
    }
    args.push('--baseline', baseline);
  }
  return [...args, ...sources(entry.sources)];
}

const HOST_OPS_CHECKERS = ['scan-host', 'check-plist', 'probe-launchd'];

/** Arguments for a host-ops case: text files to scan or lint, or a recorded launchctl print beside a copied plist. */
export function hostOpsArgs(entry, skill, scratch, root = ROOT) {
  const script = (name) => path.join(skill, entry.part, 'scripts', `${name}.mjs`);
  const fixture = (file) => path.join(root, 'fixtures', entry.part, ...file.split('/'));
  const source = (file) => (file.startsWith('assets/') ? path.join(skill, entry.part, ...file.split('/')) : fixture(file));
  if (entry.checker !== 'probe-launchd') return [script(entry.checker), ...(entry.args ?? []), ...entry.sources.map(source)];
  const folder = path.join(scratch, 'launchd', entry.id);
  fs.mkdirSync(folder, { recursive: true });
  const plist = path.join(folder, path.basename(entry.plist));
  fs.copyFileSync(fixture(entry.plist), plist);
  const print = path.join(folder, path.basename(entry.print));
  fs.writeFileSync(print, fs.readFileSync(fixture(entry.print), 'utf8').replaceAll('@DIR@', folder));
  return [script('probe-launchd'), '--label', entry.label, '--domain', entry.domain, '--plist', plist, '--print', print, '--exit', String(entry.exit ?? 0)];
}

export const runsHere = (entry, platform = process.platform) => !entry.platform || entry.platform === platform;

function runCase(entry, skill, media, scratch) {
  let args;
  if (MENUBAR_CHECKERS.includes(entry.checker)) {
    args = menubarWidgetsArgs(entry, skill, scratch);
  } else if (HOST_OPS_CHECKERS.includes(entry.checker)) {
    args = hostOpsArgs(entry, skill, scratch);
  } else if (entry.checker === 'check-media') {
    const demo = [...(entry.profile ? ['--profile', entry.profile] : []), ...(entry.poster ? ['--poster', media[entry.poster]] : [])];
    args = [path.join(skill, 'shared', 'check-media.mjs'), ...demo, ...(entry.args ?? []), ...entry.files.map((recipe) => media[recipe])];
  } else if (entry.checker === 'check-embed') {
    const site = path.join(scratch, 'sites', entry.id);
    buildSite(entry, skill, media, site);
    args = [path.join(skill, entry.checkerPart ?? entry.part, 'scripts', 'check-embed.mjs'), '--serve', site, '--page', entry.page, '--server', entry.server ?? 'range', '--project', ROOT, ...(entry.args ?? [])];
  } else if (entry.checker === 'render-frames') {
    const script = path.join(skill, entry.checkerPart ?? entry.part, 'scripts', 'render-frames.mjs');
    if (entry.files) {
      args = [script, '--check', media[entry.files[0]], ...(entry.args ?? [])];
    } else {
      const site = path.join(scratch, 'sites', entry.id);
      buildSite(entry, skill, media, site);
      args = [script, '--serve', site, '--page', entry.page, '--out', path.join(scratch, 'frames', entry.id), '--project', ROOT, ...(entry.args ?? [])];
    }
  } else if (entry.checker === 'probe-scene') {
    const site = path.join(scratch, 'sites', entry.id);
    buildSite(entry, skill, media, site);
    args = [path.join(skill, 'launch-scroll', 'scripts', 'probe-scene.mjs'), '--serve', site, '--page', entry.page, '--server', entry.server, '--project', ROOT, ...(entry.args ?? [])];
  } else if (entry.checker === 'check-page') {
    const site = path.join(scratch, 'sites', entry.id);
    buildSite(entry, skill, media, site);
    args = [path.join(skill, entry.checkerPart ?? entry.part, 'scripts', 'check-page.mjs'), '--serve', site, '--page', entry.page, '--server', entry.server, '--project', ROOT, ...(entry.args ?? [])];
  } else if (entry.checker === 'lint-css') {
    const site = path.join(scratch, 'sites', entry.id);
    buildSite(entry, skill, media, site);
    args = [path.join(skill, entry.checkerPart ?? entry.part, 'scripts', 'lint-css.mjs'), ...entry.sources.map((file) => path.join(site, file))];
  } else if (entry.checker === 'check-shell') {
    const fixture = (folder) => path.join(ROOT, 'fixtures', entry.part, ...folder.split('/'));
    args = [path.join(skill, entry.part, 'scripts', 'check-shell.mjs'), ...(entry.project ? ['--project', fixture(entry.project)] : []), ...(entry.bundle ? ['--bundle', fixture(entry.bundle)] : []), ...(entry.args ?? [])];
  } else if (entry.checker === 'probe-webkit') {
    const app = entry.app.startsWith('assets/') ? path.join(skill, entry.part, ...entry.app.split('/')) : path.join(ROOT, 'fixtures', entry.part, ...entry.app.split('/'));
    args = [path.join(skill, entry.part, 'scripts', 'probe-webkit.mjs'), '--app', app, '--project', ROOT, ...(entry.args ?? [])];
  } else {
    throw new Error(`${entry.id}: unknown checker ${entry.checker}`);
  }
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', seconds: (Date.now() - started) / 1000 };
}

const PART_PREFIX = { 'check-page': 'LP-', 'probe-scene': 'LS-', 'lint-css': 'LP-', 'check-media': 'LV-', 'check-embed': 'LV-', 'check-shell': 'WS-', 'probe-webkit': 'WS-', 'scan-host': 'HO-', 'check-plist': 'HO-', 'probe-launchd': 'HO-' };

export function expectedProblems(entry, findings, root = ROOT) {
  const file = JSON.parse(fs.readFileSync(path.join(root, 'fixtures', entry.part, entry.expected), 'utf8'));
  const shipped = (defect) => !defect.part || fs.existsSync(path.join(root, SKILL_DIR, defect.part));
  const mine = file.defects.filter((defect) => defect.checker === entry.checker && shipped(defect) && rulesOf(entry).includes(defect.rule));
  const notRun = file.defects.filter((defect) => !shipped(defect)).map((defect) => `${defect.rule} (${defect.checker})`);
  const errors = findings.filter((finding) => finding.level === 'error');
  const problems = [];
  const found = (rule, match) => errors.some((finding) => finding.rule === rule && (!match || `${finding.where} ${finding.measured}`.includes(match)));
  for (const defect of mine) {
    if (!found(defect.rule, defect.match)) problems.push(`planted defect not found: ${defect.rule} (${defect.defect})`);
    for (const effect of defect.alsoRaises ?? []) {
      if (!found(effect.rule, effect.match)) problems.push(`consequence not found: ${effect.rule} (${effect.reason})`);
    }
  }
  const prefix = PART_PREFIX[entry.checker] ?? '';
  const allowed = new Set(mine.flatMap((defect) => [defect.rule, ...(defect.alsoRaises ?? []).map((effect) => effect.rule)]));
  for (const rule of new Set(errors.map((finding) => finding.rule))) {
    if (rule.startsWith(prefix) && !allowed.has(rule)) problems.push(`unplanned error: ${rule}`);
  }
  return { problems, notRun };
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
  const wanted = only ? only.split(',') : [];
  const selected = loadCases().filter((entry) => !only || wanted.some((name) => entry.id === name || rulesOf(entry).includes(name)));
  if (!selected.length) {
    process.stderr.write(`no case matches ${only}\n`);
    return 2;
  }
  const cases = selected.filter((entry) => runsHere(entry));
  for (const entry of selected.filter((item) => !runsHere(item))) {
    if (!json) process.stdout.write(`skip ${entry.expect.padEnd(4)} ${entry.id} (${rulesOf(entry).join(', ')}) needs ${entry.platform}\n`);
  }
  const needed = new Set(cases.map((entry) => entry.part));
  const media = {
    ...(needed.has('launch-scroll') || needed.has('launch-page') ? buildFixtureMedia(path.join(scratch, 'media'), { encodeScrub: path.join(skill, 'launch-scroll', 'scripts', 'encode-scrub.mjs'), makeSequence: path.join(skill, 'launch-scroll', 'scripts', 'make-sequence.mjs') }) : {}),
    ...(needed.has('launch-video') ? buildLaunchVideoMedia(path.join(scratch, 'media-video'), { encode: path.join(skill, 'launch-video', 'scripts', 'encode.mjs') }) : {}),
  };
  const results = [];
  for (const entry of cases) {
    const run = runCase(entry, skill, media, scratch);
    const verdict = evaluateRun(entry, run);
    if (entry.expected) {
      const expected = expectedProblems(entry, verdict.findings);
      verdict.problems.push(...expected.problems);
      verdict.ok = verdict.ok && !expected.problems.length;
      if (expected.notRun.length && !json) process.stdout.write(`     not run here (their part is not in this tree): ${expected.notRun.join(', ')}\n`);
    }
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
