import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { diffOf, extract, hitHostLimit, makeClaudeHome, scoreRouting, userRunSettings } from '../evals/harness.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const HARNESS = path.join(ROOT, 'evals', 'harness.mjs');

const claudeRun = (result, { isError = false, skill = null } = {}) => {
  const events = [{ type: 'system', subtype: 'init', skills: ['apple'], model: 'model', session_id: 's' }];
  if (skill) events.push({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Skill', input: { skill } }] } });
  events.push({ type: 'result', subtype: 'success', is_error: isError, result, num_turns: 1 });
  return events.map((event) => JSON.stringify(event)).join('\n');
};

const meta = (host, id) => ({ id: `${host}-with-${id}`, suite: 'routing', host, condition: 'with', case: id, listing: false });

test('a run that ends on the session or usage limit is recognised, and a normal answer is not', () => {
  assert.equal(extract(meta('claude', 'r01'), claudeRun("You've hit your session limit · resets 7pm (Asia/Saigon)", { isError: true })).hostLimit, true);
  assert.equal(hitHostLimit({ finalText: '', error: "You've reached your usage limit. Try again later." }), true);
  assert.equal(hitHostLimit({ finalText: 'Usage limit reached for this plan.' }), true);
  assert.equal(extract(meta('claude', 'r01'), claudeRun('Use NavigationStack and @Observable.', { skill: 'apple' })).hostLimit, false);
  assert.equal(hitHostLimit({ finalText: 'Raise the rate limit of the API client to 10 requests per second.' }), false);
});

test('score leaves limit runs out of every bar, lists them as invalid and exits 1', (t) => {
  const out = tempDir();
  t.after(() => removeTree(out));
  fs.mkdirSync(path.join(out, 'traces'));
  const write = (trace) => fs.writeFileSync(path.join(out, 'traces', `${trace.id}.json`), JSON.stringify(trace));
  write(extract(meta('claude', 'r01'), claudeRun('Use NavigationStack and @Observable.', { skill: 'apple' })));
  write(extract(meta('claude', 'n01'), claudeRun('Use [weak self] in the closure.')));
  write(extract(meta('claude', 'r02'), claudeRun("You've hit your session limit · resets 7pm", { isError: true })));
  write(extract(meta('claude', 'n02'), claudeRun("You've hit your session limit · resets 7pm", { isError: true })));

  const { claude } = scoreRouting(out);
  assert.deepEqual(claude.invalid.sort(), ['claude-with-n02', 'claude-with-r02']);
  assert.equal(claude.runs, 2);
  assert.equal(claude.recall.n, '1/1');
  assert.equal(claude.falseTriggers.n, '0/1');
  assert.ok(claude.failures.every((failure) => !failure.run.endsWith('r02') && !failure.run.endsWith('n02')));

  const result = runScript(HARNESS, ['score', '--out', out]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).claude.invalid.sort(), ['claude-with-n02', 'claude-with-r02']);

  fs.rmSync(path.join(out, 'traces', 'claude-with-r02.json'));
  fs.rmSync(path.join(out, 'traces', 'claude-with-n02.json'));
  assert.equal(runScript(HARNESS, ['score', '--out', out]).status, 0);
});

const codexRun = (...commands) => commands.map((command) => JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command, exit_code: 0 } })).join('\n');

test('a Codex near miss counts as a false trigger only when it reads a part', (t) => {
  const out = tempDir();
  t.after(() => removeTree(out));
  fs.mkdirSync(path.join(out, 'traces'));
  const write = (trace) => fs.writeFileSync(path.join(out, 'traces', `${trace.id}.json`), JSON.stringify(trace));
  write(extract(meta('codex', 'n01'), codexRun('cat .agents/skills/apple/SKILL.md')));
  write(extract(meta('codex', 'n02'), codexRun('cat .agents/skills/apple/SKILL.md', 'cat .agents/skills/apple/launch-scroll/PART.md')));
  write(extract(meta('codex', 'n03'), codexRun('ls')));

  const { codex } = scoreRouting(out);
  assert.equal(codex.falseTriggers.n, '1/3');
  assert.deepEqual(codex.falseTriggers.routerOnly, ['codex-with-n01']);
  assert.deepEqual(codex.failures.filter((failure) => failure.bar === 'falseTriggers').map((failure) => failure.run), ['codex-with-n02']);
  assert.equal(codex.anyAppleRead.nearMisses, '2/3');
});

test('a Claude near miss still counts as a false trigger when it calls apple without reading a part', (t) => {
  const out = tempDir();
  t.after(() => removeTree(out));
  fs.mkdirSync(path.join(out, 'traces'));
  fs.writeFileSync(path.join(out, 'traces', 'claude-with-n01.json'), JSON.stringify(extract(meta('claude', 'n01'), claudeRun('Use the animate skill.', { skill: 'apple' }))));
  assert.equal(scoreRouting(out).claude.falseTriggers.n, '1/1');
});

test('a user install gives Claude a config folder with the user skills, and apple only in the with condition', (t) => {
  const user = tempDir();
  t.after(() => removeTree(user));
  fs.mkdirSync(path.join(user, 'skills', 'animate'), { recursive: true });
  fs.writeFileSync(path.join(user, 'skills', 'animate', 'SKILL.md'), '---\nname: animate\n---\n');
  fs.mkdirSync(path.join(user, 'skills', 'apple'));
  fs.writeFileSync(path.join(user, 'skills', 'apple', 'SKILL.md'), 'an older install\n');
  fs.mkdirSync(path.join(user, 'skills', 'synced'));
  fs.mkdirSync(path.join(user, 'rules'));
  fs.writeFileSync(path.join(user, 'CLAUDE.md'), '# rules\n');
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'opus[1m]', effortLevel: 'xhigh', hooks: { Stop: [] }, permissions: { allow: ['Bash'] } }));

  const withHome = makeClaudeHome('with', user);
  const withoutHome = makeClaudeHome('without', user);
  t.after(() => [withHome, withoutHome].forEach((home) => removeTree(path.dirname(home))));
  assert.equal(path.basename(withHome), '.claude');
  assert.deepEqual(fs.readdirSync(path.join(withHome, 'skills')).sort(), ['animate', 'apple']);
  assert.equal(fs.readFileSync(path.join(withHome, 'skills', 'apple', 'SKILL.md'), 'utf8'), fs.readFileSync(path.join(ROOT, 'skills', 'apple', 'SKILL.md'), 'utf8'));
  assert.deepEqual(fs.readdirSync(path.join(withoutHome, 'skills')), ['animate']);
  assert.ok(fs.lstatSync(path.join(withHome, 'CLAUDE.md')).isSymbolicLink());
  assert.ok(fs.lstatSync(path.join(withHome, 'rules')).isSymbolicLink());
  assert.deepEqual(userRunSettings(user), { disableAllHooks: true, model: 'opus[1m]', effortLevel: 'xhigh' });
  assert.deepEqual(userRunSettings(path.join(user, 'missing')), { disableAllHooks: true });
});

test('the diff of a run includes what the agent committed itself', (t) => {
  const dir = tempDir();
  t.after(() => removeTree(dir));
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t', ...args], { cwd: dir, encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>before</p>\n');
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'fixture');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>after</p>\n');
  git('commit', '-qam', 'feat: agent change');
  fs.writeFileSync(path.join(dir, 'new.css'), 'p {}\n');
  const diff = diffOf(dir, base);
  assert.match(diff, /agent commits:\n\w+ feat: agent change/);
  assert.match(diff, /\+<p>after<\/p>/);
  assert.match(diff, /^A\tnew\.css$/m);
});
