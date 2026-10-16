/**
 * Red-first evaluation of a checker run against a fixture. A fail fixture proves its check can fail: the checker must
 * exit 1 and report an error for the fixture's rule. A pass fixture proves the reference passes: no error for the
 * rule and at least one pass for it, so a rule the checker silently skipped does not count as green.
 */
import { EXIT, parseReport } from './report.mjs';

export function evaluateRun({ rule, expect }, { code, stdout }) {
  const rules = Array.isArray(rule) ? rule : [rule];
  const { findings, summary } = parseReport(stdout);
  const problems = [];
  if (!summary) problems.push('no summary line (the checker did not finish)');
  if (code === EXIT.usage || code === EXIT.sandbox) problems.push(`checker exited ${code} (missing tool, bad usage or sandbox)`);
  for (const id of rules) {
    const errors = findings.filter((finding) => finding.rule === id && finding.level === 'error');
    const passes = findings.filter((finding) => finding.rule === id && finding.level === 'pass');
    if (expect === 'fail') {
      if (code !== EXIT.fail) problems.push(`expected exit ${EXIT.fail}, got ${code}`);
      if (!errors.length) problems.push(`${id} reported no error`);
    } else {
      if (errors.length) problems.push(`${id} failed: ${errors.map((finding) => `${finding.where}: ${finding.measured}`).join('; ')}`);
      if (!passes.length) problems.push(`${id} was never checked`);
    }
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], findings };
}
