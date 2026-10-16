/**
 * An installed skill has no node_modules and ES modules ignore NODE_PATH, so the checkers load Playwright from the
 * user's project: createRequire anchored in the project folder walks its node_modules chain upwards. Without it the
 * checker exits 2 with an install hint and installs nothing itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { UsageError } from './report.mjs';
import { rethrowSandbox } from './sandbox.mjs';

export const INSTALL_HINT =
  'Install Playwright in the project that holds the page (npm install --save-dev playwright), then its browser ' +
  '(npx playwright install chromium-headless-shell), and run the checker again with --project <that folder>.';

export function findPlaywright(project = process.cwd()) {
  const anchor = path.join(path.resolve(project), 'package.json');
  const require = createRequire(anchor);
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return { name, entry: require.resolve(name) };
    } catch {
      continue;
    }
  }
  return null;
}

export async function loadPlaywright(project = process.cwd()) {
  if (!fs.existsSync(path.resolve(project))) throw new UsageError(`Project folder ${project} does not exist.`, INSTALL_HINT);
  const found = findPlaywright(project);
  if (!found) throw new UsageError(`Playwright is not installed in ${path.resolve(project)} or any folder above it.`, INSTALL_HINT);
  const module = await import(pathToFileURL(found.entry).href);
  return module.default?.chromium ? module.default : module;
}

/** Launches headless Chromium; a missing browser binary is a usage error, a sandbox refusal exits 3. */
export async function launchChromium(playwright, options = {}) {
  try {
    return await playwright.chromium.launch({ headless: true, ...options });
  } catch (error) {
    if (/Executable doesn't exist|browserType\.launch: .*not found|please run.*playwright install/i.test(String(error?.message))) {
      throw new UsageError('Playwright is installed but its Chromium browser is not.', INSTALL_HINT);
    }
    return rethrowSandbox(error, 'the same checker command');
  }
}
