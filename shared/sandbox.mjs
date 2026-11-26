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
  { tool: 'server', pattern: /listen (?:EPERM|EACCES)/, reason: 'the local file server may not listen on a port' },
  {
    tool: 'avfoundation',
    pattern: /AVFoundation video devices:(?:(?!Capture screen)[\s\S])*?AVFoundation audio devices:/,
    reason: 'no screen capture device is visible: an agent sandbox, an SSH session or a missing Screen Recording permission hides it',
  },
  { tool: 'ddagrab', pattern: /DuplicateOutput|Desktop Duplication[^\n]*(?:failed|not available|denied)|E_ACCESSDENIED/i, reason: 'Desktop Duplication refused the capture session' },
  { tool: 'gdigrab', pattern: /Failed to capture image/, reason: 'the GDI screen grabber cannot read this session' },
  { tool: 'x11grab', pattern: /Cannot open display/, reason: 'no X display is visible from this process' },
];

const quote = (value) => (/^[\w./:=@%+,-]+$/.test(value) ? value : `'${String(value).replace(/'/g, "'\\''")}'`);

export function currentCommand(argv = process.argv) {
  return ['node', ...argv.slice(1)].map(quote).join(' ');
}

export function sandboxReason(text) {
  const value = String(text ?? '');
  return SANDBOX_SIGNATURES.find((signature) => signature.pattern.test(value))?.reason ?? null;
}

/** Rethrows an error from a tool as a SandboxError when its message or output carries a sandbox signature. */
export function rethrowSandbox(error, command = currentCommand()) {
  const text = [error?.message, error?.stderr, error?.stdout].filter(Boolean).map(String).join('\n');
  const reason = sandboxReason(text);
  if (reason) throw new SandboxError(`Blocked: ${reason}.`, command);
  throw error;
}
