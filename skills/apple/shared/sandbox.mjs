/**
 * Recognises failures that come from an agent sandbox rather than from the user's files, so a checker can exit 3 and
 * ask for a rerun outside the sandbox instead of reporting a false finding. No part tells an agent to leave the
 * sandbox by itself.
 */
import { SandboxError } from './report.mjs';

export const SANDBOX_SIGNATURES = [
  { tool: 'chromium', pattern: /bootstrap_check_in[^\n]*\(1100\)/, reason: 'Chromium could not register with launchd (bootstrap_check_in 1100)' },
  { tool: 'videotoolbox', pattern: /-12908\b/, reason: 'VideoToolbox refused the encoder session (-12908)' },
  { tool: 'chromium', pattern: /sandbox_init|Operation not permitted[^\n]*(?:mach|launchd)/i, reason: 'the browser sandbox could not start' },
];

export function sandboxReason(text) {
  const value = String(text ?? '');
  return SANDBOX_SIGNATURES.find((signature) => signature.pattern.test(value))?.reason ?? null;
}

/** Rethrows an error from a tool as a SandboxError when its message or output carries a sandbox signature. */
export function rethrowSandbox(error, command) {
  const text = [error?.message, error?.stderr, error?.stdout].filter(Boolean).map(String).join('\n');
  const reason = sandboxReason(text);
  if (reason) throw new SandboxError(`Blocked: ${reason}.`, command);
  throw error;
}
