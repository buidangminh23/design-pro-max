import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const files = fs.readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml')).sort();
const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');
const indentOf = (line) => line.length - line.trimStart().length;

/**
 * The jobs of a workflow file as { name, lines }, split at the two-space keys under `jobs:`.
 */
function jobs(text) {
  const lines = text.split('\n');
  const start = lines.indexOf('jobs:');
  const found = [];
  for (const line of lines.slice(start + 1)) {
    const key = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (key) found.push({ name: key[1], lines: [] });
    else if (found.length) found.at(-1).lines.push(line);
  }
  return found;
}

/**
 * The steps of a job as arrays of lines, split at the six-space list items.
 */
function steps(job) {
  const found = [];
  for (const line of job.lines) {
    if (/^ {6}- /.test(line)) found.push([line]);
    else if (found.length && (indentOf(line) > 6 || !line.trim())) found.at(-1).push(line);
  }
  return found;
}

/**
 * The shell text of every run: key, inline or as a block scalar.
 */
function runScripts(text) {
  const lines = text.split('\n');
  const scripts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[index]);
    if (!match) continue;
    if (!/^[|>][+-]?$/.test(match[2])) {
      scripts.push(match[2]);
      continue;
    }
    const base = match[1].length;
    const body = [];
    while (index + 1 < lines.length && (!lines[index + 1].trim() || indentOf(lines[index + 1]) > base)) body.push(lines[(index += 1)]);
    scripts.push(body.join('\n'));
  }
  return scripts;
}

test('the three workflows exist', () => {
  assert.deepEqual(files, ['ci.yml', 'release.yml', 'vendor-sync.yml']);
});

test('every action is pinned to a full commit SHA with a version comment, the same pin everywhere', () => {
  const pins = new Map();
  for (const name of files) {
    for (const line of read(name).split('\n').filter((item) => /^\s*(?:- )?uses:/.test(item))) {
      const match = /uses: ([\w.-]+\/[\w.-]+)@([0-9a-f]{40}) # v\d+(?:\.\d+)*$/.exec(line);
      assert.ok(match, `${name}: ${line.trim()}`);
      if (pins.has(match[1])) assert.equal(pins.get(match[1]), match[2], `${name}: ${match[1]} uses another pin`);
      pins.set(match[1], match[2]);
    }
  }
  assert.deepEqual([...pins.keys()].sort(), ['actions/checkout', 'actions/download-artifact', 'actions/setup-node', 'actions/upload-artifact']);
});

test('no expression is interpolated into a shell script', () => {
  for (const name of files) {
    for (const script of runScripts(read(name))) assert.ok(!script.includes('${{'), `${name}: pass values through env instead:\n${script}`);
  }
});

test('the default token is read-only and every job states its own permissions', () => {
  for (const name of files) {
    const text = read(name);
    assert.match(text, /^permissions:\n {2}contents: read\n/m, name);
    for (const job of jobs(text)) assert.ok(job.lines.some((line) => /^ {4}permissions:/.test(line)), `${name}: job ${job.name} states no permissions`);
  }
});

test('checkouts in jobs that push nothing keep no credentials', () => {
  for (const name of files) {
    for (const job of jobs(read(name))) {
      const writes = job.lines.some((line) => /^ {6}contents: write$/.test(line));
      const pushes = job.lines.some((line) => /\bgit push\b/.test(line));
      for (const step of steps(job).filter((lines) => /uses: actions\/checkout@/.test(lines[0]))) {
        const keeps = !step.some((line) => /persist-credentials: false/.test(line));
        if (keeps) assert.ok(writes && pushes, `${name}: job ${job.name} keeps checkout credentials without pushing`);
        else assert.ok(!pushes, `${name}: job ${job.name} pushes without credentials`);
      }
    }
  }
});

test('CI runs every check on three systems and two Node versions', () => {
  const ci = read('ci.yml');
  assert.match(ci, /os: \[ubuntu-latest, macos-latest, windows-latest\]/);
  assert.match(ci, /node: \[22, 24\]/);
  assert.match(ci, /fetch-depth: 0/);
  for (const command of ['npm test', 'node scripts/vendor-sync.mjs check', 'node scripts/vendor-guard.mjs', 'node scripts/vendor-sync.mjs notices --check', 'node scripts/gen.mjs --check', 'node scripts/check-history.mjs', 'node scripts/release.mjs check', 'node scripts/release.mjs pack']) {
    assert.ok(runScripts(ci).includes(command), command);
  }
});

test('the release workflow re-checks, drafts, verifies the download and publishes as Latest', () => {
  const release = read('release.yml');
  assert.match(release, /tags: \["v\*"\]/);
  for (const command of ['npm test', 'node scripts/check-history.mjs', 'node scripts/gen.mjs --check', 'node scripts/vendor-guard.mjs']) assert.ok(release.includes(command), command);
  assert.match(release, /gh release create "\$TAG" --verify-tag --draft /);
  assert.match(release, /gh release download "\$TAG"/);
  assert.match(release, /node scripts\/release\.mjs verify "\$downloaded"/);
  assert.match(release, /gh release edit "\$TAG" --draft=false --prerelease=false --latest/);
  assert.doesNotMatch(release, /--prerelease(?!=false)/);
  const [verify, publish] = jobs(release);
  assert.ok(verify.lines.some((line) => /^ {6}contents: read$/.test(line)));
  assert.ok(publish.lines.some((line) => /^ {6}contents: write$/.test(line)));
});

test('the vendor sync runs weekly, stages read-only and merges only safe updates', () => {
  const sync = read('vendor-sync.yml');
  assert.match(sync, /cron: "41 2 \* \* 1"/);
  assert.match(sync, /workflow_dispatch:/);
  const [fetch, propose, heartbeat] = jobs(sync);
  assert.deepEqual([fetch.name, propose.name, heartbeat.name], ['fetch', 'propose', 'heartbeat']);
  assert.ok(fetch.lines.some((line) => /^ {6}contents: read$/.test(line)));
  assert.ok(!fetch.lines.some((line) => /: write$/.test(line)));
  assert.ok(propose.lines.some((line) => /^ {6}pull-requests: write$/.test(line)));
  assert.match(sync, /include-hidden-files: true/);
  assert.match(sync, /node scripts\/vendor-sync\.mjs stage --out/);
  assert.match(sync, /node scripts\/vendor-sync\.mjs apply --from/);
  const merge = steps(propose).find((lines) => /gh pr merge/.test(lines.join('\n')));
  assert.ok(merge[0].includes('Merge a safe update'));
  assert.ok(merge.some((line) => line.includes("if: steps.classify.outputs.verdict == 'safe'")));
  assert.ok(merge.some((line) => line.includes('--match-head-commit "$SHA"')));
  const proposeText = propose.lines.join('\n');
  const order = ['classify --from', 'apply --from', 'npm test', 'node scripts/vendor-guard.mjs', 'node scripts/check-history.mjs', 'git push', 'gh pr create', 'gh pr merge'].map((text) => proposeText.indexOf(text));
  assert.ok(order.every((index) => index >= 0), 'the propose job runs every step');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'classify, apply, check, push, propose, merge, in that order');
  assert.match(sync, /if \[ "\$days" -lt 45 \]/);
});
