import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CI_FILE, VERIFY_COMMAND, ciLocal, ciSteps, notCovered } from '../scripts/ci-local.mjs';
import { ROOT } from './helpers.mjs';

const ciText = fs.readFileSync(path.join(ROOT, ...CI_FILE.split('/')), 'utf8');

test('ci-local runs exactly the commands of the CI test job, in order', () => {
  const steps = ciSteps(ciText);
  assert.equal(steps[0], 'npm test');
  assert.ok(steps.includes('node scripts/release.mjs pack'));
  assert.equal(steps.length, (ciText.match(/^ {8}run: /gm) ?? []).length);
  assert.throws(() => ciSteps('jobs:\n  lint:\n    steps: []\n'), /has no test job/);
});

test('ci-local adds verify only when it can run, and reports every gap', () => {
  const seen = [];
  const run = (command) => {
    seen.push(command);
    return { command, status: command === 'node scripts/gen.mjs --check' ? 1 : 0, seconds: 0, output: '' };
  };
  const report = ciLocal(ROOT, { skipVerify: true, run });
  assert.deepEqual(seen, ciSteps(ciText));
  assert.ok(!seen.includes(VERIFY_COMMAND));
  assert.equal(report.passed, false);
  assert.match(report.notCovered.join('\n'), /L1 media and L3 browser \(skipped with --skip-verify\)/);
  assert.match(notCovered({ verifySkipped: null }).join('\n'), /the CI matrix: only .+ with Node/);
  assert.doesNotMatch(notCovered({ verifySkipped: null }).join('\n'), /L1 media/);
});
