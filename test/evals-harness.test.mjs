import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extract, hitHostLimit, scoreRouting } from '../evals/harness.mjs';
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
