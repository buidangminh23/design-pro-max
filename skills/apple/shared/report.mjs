/**
 * The checker contract shared by every own part: findings go to stdout as JSON lines
 * {rule, level, where, measured, expected}, the last line is a summary carrying the proof boundary, and the exit code
 * says what happened: 0 pass, 1 an error rule failed, 2 a missing tool or bad usage, 3 blocked by a sandbox.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EXIT = Object.freeze({ pass: 0, fail: 1, usage: 2, sandbox: 3 });

export const LEVELS = Object.freeze(['error', 'warn', 'pass', 'skip']);

export const DEFAULT_BOUNDARY =
  'Proof boundary: headless Chromium and synthetic media prove structure, gating, load order and encode parameters; ' +
  'they do not prove iOS Safari, Low Power Mode, real device frame rates or taste.';

/** A failure that is not a finding: a missing tool, a bad argument or a file that cannot be read. */
export class UsageError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'UsageError';
    this.code = EXIT.usage;
    this.hint = hint;
  }
}

/** A step the agent sandbox blocked; the user has to approve a rerun outside it. */
export class SandboxError extends Error {
  constructor(message, command) {
    super(message);
    this.name = 'SandboxError';
    this.code = EXIT.sandbox;
    this.command = command;
  }
}

const clean = (value) => (value === undefined ? null : value);

export function createReport({ tool, boundary = DEFAULT_BOUNDARY, write = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const findings = [];
  const add = (rule, level, where, measured, expected) => {
    if (!LEVELS.includes(level)) throw new Error(`unknown level ${level}`);
    const finding = { rule, level, where: clean(where), measured: clean(measured), expected: clean(expected) };
    findings.push(finding);
    write(JSON.stringify(finding));
    return finding;
  };
  return {
    findings,
    error: (rule, where, measured, expected) => add(rule, 'error', where, measured, expected),
    warn: (rule, where, measured, expected) => add(rule, 'warn', where, measured, expected),
    pass: (rule, where, measured, expected) => add(rule, 'pass', where, measured, expected),
    skip: (rule, where, reason) => add(rule, 'skip', where, reason, null),
    check(rule, ok, where, measured, expected, level = 'error') {
      return ok ? add(rule, 'pass', where, measured, expected) : add(rule, level, where, measured, expected);
    },
    summary() {
      const count = (level) => findings.filter((finding) => finding.level === level).length;
      const errors = count('error');
      write(JSON.stringify({ tool, errors, warnings: count('warn'), passed: count('pass'), skipped: count('skip'), boundary }));
      return errors ? EXIT.fail : EXIT.pass;
    },
  };
}

/** Parses checker output back into findings and the summary, for the red-first harness and for tests. */
export function parseReport(text) {
  const findings = [];
  let summary = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof value.rule === 'string' && LEVELS.includes(value.level)) findings.push(value);
    else if (typeof value.boundary === 'string') summary = value;
  }
  return { findings, summary };
}

export const SANDBOX_MESSAGE = (command) =>
  `This step must run outside the agent sandbox. Ask the user to approve a rerun outside it, or to run: ${command}`;

/**
 * Runs a checker's main function and turns thrown usage and sandbox errors into the contract's exit codes and
 * messages on stderr. The main function returns the exit code of a finished check.
 */
export async function runMain(main, { command } = {}) {
  try {
    process.exitCode = await main();
  } catch (error) {
    if (error instanceof SandboxError) {
      process.stderr.write(`${error.message}\n${SANDBOX_MESSAGE(error.command ?? command ?? 'the same command')}\n`);
      process.exitCode = EXIT.sandbox;
    } else if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n${error.hint ? `${error.hint}\n` : ''}`);
      process.exitCode = EXIT.usage;
    } else {
      process.stderr.write(`${error?.stack ?? error}\n`);
      process.exitCode = EXIT.usage;
    }
  }
}

/** True when the module at `url` is the script node was started with; compares real paths, so 8.3 names match. */
export function isMain(url) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(url));
  } catch {
    return false;
  }
}
