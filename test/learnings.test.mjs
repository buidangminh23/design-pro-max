import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { OWN_PARTS } from '../scripts/lib/evidence.mjs';
import { ROOT, fakeGithubToken, removeTree, tempDir } from './helpers.mjs';

const SCRIPT = path.join(ROOT, SKILL_DIR, 'shared', 'learnings.mjs');
const learnings = await import(pathToFileURL(SCRIPT).href);

const run = (args) => {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const line = result.stdout.trim().split('\n').at(-1);
  return { code: result.status, out: line ? JSON.parse(line) : null, stderr: result.stderr };
};

const entryArgs = (project, extra = []) => [
  'append',
  '--project',
  project,
  '--part',
  'launch-scroll',
  '--verdict',
  'gap',
  '--read',
  'one pinned hero, video scrub',
  '--change',
  'preload set to metadata, pin length 250vh to 200vh',
  '--lesson',
  'a short viewport needs the static layout first',
  '--evidence',
  'probe-scene: 0 errors',
  '--date',
  '2026-11-26',
  ...extra,
];

test('learnings are off until a journal exists, and append refuses without --create', () => {
  const project = tempDir('learn-off-');
  try {
    assert.deepEqual(run(['status', '--project', project]).out, { learnings: 'off', journal: 'APPLE-LEARNINGS.md', entries: 0 });
    const refused = run(entryArgs(project));
    assert.equal(refused.code, 1);
    assert.equal(refused.out.written, false);
    assert.equal(fs.existsSync(path.join(project, 'APPLE-LEARNINGS.md')), false);
    assert.deepEqual(fs.readdirSync(project), []);
  } finally {
    removeTree(project);
  }
});

test('--create starts a journal, later entries append in the documented format, and check accepts them', () => {
  const project = tempDir('learn-on-');
  try {
    assert.equal(run(entryArgs(project, ['--create'])).code, 0);
    const second = run(entryArgs(project).map((arg) => (arg === 'gap' ? 'covered' : arg)));
    assert.equal(second.code, 0, JSON.stringify(second.out));
    const text = fs.readFileSync(path.join(project, 'APPLE-LEARNINGS.md'), 'utf8');
    assert.ok(text.startsWith(`${learnings.HEADER}\n\n## 2026-11-26 · launch-scroll · gap\n\n- Read: one pinned hero`));
    assert.match(text, /\n\n## 2026-11-26 · launch-scroll · covered\n\n- Read: /);
    assert.match(text, /- Evidence: probe-scene: 0 errors\n$/);
    const { entries, problems } = learnings.parseJournal(text);
    assert.deepEqual(problems, []);
    assert.equal(entries.length, 2);
    assert.deepEqual(run(['check', '--project', project]).out, { learnings: 'on', journal: 'APPLE-LEARNINGS.md', entries: 2, problems: [] });
    assert.equal(run(['status', '--project', project]).out.entries, 2);
  } finally {
    removeTree(project);
  }
});

test('a file with the journal name but another first line is not a journal and stays untouched', () => {
  const project = tempDir('learn-foreign-');
  try {
    const file = path.join(project, 'APPLE-LEARNINGS.md');
    fs.writeFileSync(file, '# Notes\n');
    const result = run(entryArgs(project, ['--create']));
    assert.equal(result.code, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), '# Notes\n');
  } finally {
    removeTree(project);
  }
});

test('entries that carry secrets, emails, absolute paths, addresses or this machine are refused', () => {
  const terms = ['buildhost'];
  const base = { date: '2026-11-26', part: 'hig', verdict: 'refinement', read: 'a settings screen', change: 'row height to the system value', lesson: 'use semantic sizes' };
  const leak = (lesson) => learnings.entryProblems({ ...base, lesson }, { parts: ['hig'], terms });
  assert.deepEqual(leak('use semantic sizes'), []);
  for (const [text, pattern] of [
    [`token ${fakeGithubToken()}`, /API token/],
    ['password=hunter22', /secret assignment/],
    ['ask owner@example.com', /email/],
    ['built in /Users/someone/app', /absolute path/],
    ['built in C:\\work\\app', /absolute path/],
    ['the Mac at 192.168.1.20', /IP address/],
    ['ssh to studio.local', /local host name/],
    ['ran on buildhost overnight', /this machine/],
    ['-----BEGIN OPENSSH PRIVATE KEY-----', /private key/],
  ]) {
    const problems = leak(text);
    assert.ok(problems.some((problem) => pattern.test(problem)), `${text}: ${problems.join('; ')}`);
  }
  assert.deepEqual(leak('served on 127.0.0.1 during the check'), []);
});

test('entries need a known part and verdict, one-line fields and the three required fields', () => {
  const problems = learnings.entryProblems({ date: '26/11', part: 'nope', verdict: 'maybe', read: 'a\nb', change: '', lesson: 'x'.repeat(learnings.MAX_FIELD + 1) }, { parts: ['hig'], terms: [] });
  for (const pattern of [/date/, /part must be/, /verdict must be/, /Read must be one line/, /Changed is required/, /Learned is .* characters/]) assert.ok(problems.some((problem) => pattern.test(problem)), String(pattern));
  assert.deepEqual(learnings.ownParts(), [...OWN_PARTS].sort());
});

test('a refused entry writes nothing and reports the reason', () => {
  const project = tempDir('learn-leak-');
  try {
    const result = run(entryArgs(project, ['--create']).map((arg) => (arg === 'a short viewport needs the static layout first' ? 'mail owner@example.com' : arg)));
    assert.equal(result.code, 1);
    assert.ok(result.out.problems.some((problem) => problem.includes('email')));
    assert.deepEqual(fs.readdirSync(project), []);
  } finally {
    removeTree(project);
  }
});

test('the journal stays inside the user project and never in the installed skill', () => {
  const project = tempDir('learn-path-');
  const outside = tempDir('learn-outside-');
  try {
    for (const journal of ['../escape.md', path.join(outside, 'x.md'), 'notes.txt']) {
      const result = run([...entryArgs(project, ['--create']), '--journal', journal]);
      assert.equal(result.code, 2, journal);
    }
    assert.equal(run(['status', '--project', path.join(ROOT, SKILL_DIR)]).code, 2);
    assert.equal(run(['status', '--project', ROOT]).code, 2);
    let linked = true;
    try {
      fs.symlinkSync(outside, path.join(project, 'docs'), 'junction');
    } catch {
      linked = false;
    }
    if (linked) assert.equal(run([...entryArgs(project, ['--create']), '--journal', 'docs/learn.md']).code, 2);
    assert.deepEqual(fs.readdirSync(outside), []);
    const nested = run([...entryArgs(project, ['--create']), '--journal', 'notes/apple.md']);
    assert.equal(nested.code, 0, JSON.stringify(nested.out));
    assert.equal(nested.out.journal, 'notes/apple.md');
  } finally {
    removeTree(project);
    removeTree(outside);
  }
});

test('check reports malformed headings and unknown fields in a hand-edited journal', () => {
  const project = tempDir('learn-check-');
  try {
    fs.writeFileSync(path.join(project, 'APPLE-LEARNINGS.md'), `${learnings.HEADER}\n\n## yesterday\n\n## 2026-11-26 · hig · gap\n\n- Read: a\n- Mood: b\n`);
    const result = run(['check', '--project', project]);
    assert.equal(result.code, 1);
    for (const pattern of [/entry heading/, /unknown field/, /Changed is required/]) assert.ok(result.out.problems.some((problem) => pattern.test(problem)), String(pattern));
  } finally {
    removeTree(project);
  }
});

test('bad usage exits 2 and every part report points to the opt-in contract', () => {
  assert.equal(run(['delete', '--project', '.']).code, 2);
  assert.equal(run(['status']).code, 2);
  assert.equal(run(['status', '--project', '.', '--create']).code, 2);
  const contract = fs.readFileSync(path.join(ROOT, SKILL_DIR, 'shared', 'learnings.md'), 'utf8');
  for (const phrase of ['off by default', '--create', learnings.HEADER, 'never over a hard rule']) assert.ok(contract.includes(phrase), phrase);
  const router = fs.readFileSync(path.join(ROOT, SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.ok(router.includes('`shared/learnings.md`'));
  for (const part of OWN_PARTS.filter((name) => name !== 'launch-video')) {
    assert.ok(fs.readFileSync(path.join(ROOT, SKILL_DIR, part, 'PART.md'), 'utf8').includes('`../shared/learnings.md`'), part);
  }
});
