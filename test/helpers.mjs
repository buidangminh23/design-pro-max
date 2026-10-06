/**
 * Test helpers: materialize a guard fixture into a temporary checkout, run the repository's scripts the way a user
 * would, and serve fake upstream repositories to the sync tool without touching the network.
 *
 * A fixture is the `base` tree plus one rule folder laid over it. Files ending in `.fixture` lose that suffix, so the
 * repository itself never carries a stray SKILL.md or a misnamed binary. `{{U+XXXX}}` and `{{SECRET:github}}`
 * placeholders become the characters and the token they stand for, and `fixture.json` can remove files, generate large
 * ones, or create symlinks and FIFOs that git could not store.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GUARD_FIXTURES = path.join(ROOT, 'test', 'fixtures', 'guard');
export const FIXTURE_TERMS = ['fixture-host'];

export const fakeGithubToken = () => ['gh', 'p_'].join('') + 'AbCd1234'.repeat(5);

function copyTree(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'fixture.json') continue;
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name.endsWith('.fixture') ? entry.name.slice(0, -'.fixture'.length) : entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      copyTree(source, target);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}

function expandPlaceholders(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      expandPlaceholders(file);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const expanded = text
      .replace(/\{\{U\+([0-9A-F]{4,6})\}\}/g, (match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replaceAll('{{SECRET:github}}', fakeGithubToken());
    if (expanded !== text) fs.writeFileSync(file, expanded);
  }
}

export function readFixtureSpec(name) {
  const file = path.join(GUARD_FIXTURES, name, 'fixture.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

export function ruleFixtures() {
  return fs
    .readdirSync(GUARD_FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'base')
    .map((entry) => entry.name)
    .sort();
}

export function tempDir(prefix = 'design-pro-max-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Build a temporary checkout from the base fixture and, optionally, one rule folder. Returns its root.
 */
export function materialize(name = null) {
  const root = tempDir();
  copyTree(path.join(GUARD_FIXTURES, 'base'), root);
  if (name) copyTree(path.join(GUARD_FIXTURES, name), root);
  expandPlaceholders(root);
  const spec = name ? readFixtureSpec(name) : {};
  for (const relative of spec.remove ?? []) fs.rmSync(path.join(root, relative), { force: true });
  for (const item of spec.generate ?? []) {
    const target = path.join(root, item.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${'x'.repeat(79)}\n`.repeat(Math.ceil(item.bytes / 80)).slice(0, item.bytes));
  }
  for (const link of spec.symlinks ?? []) fs.symlinkSync(link.target, path.join(root, link.path));
  for (const relative of spec.fifos ?? []) execFileSync('mkfifo', [path.join(root, relative)]);
  return root;
}

export function removeTree(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

export function canCreate(kind) {
  if (process.platform === 'win32') return false;
  if (kind !== 'fifo') return true;
  try {
    execFileSync('mkfifo', ['--help'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return error.code !== 'ENOENT';
  }
}

/**
 * A temporary copy of the files git would ship from this checkout: tracked files and untracked files that are not
 * ignored, with their modes. With `commit` set the copy is also a git repository holding those files in one commit.
 */
export function copyCheckout({ commit = false } = {}) {
  const root = tempDir('design-pro-max-copy-');
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  const listing = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { env, encoding: 'utf8' });
  for (const file of listing.split('\0').filter(Boolean)) {
    const source = path.join(ROOT, ...file.split('/'));
    if (!fs.existsSync(source)) continue;
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  if (commit) commitTree(root);
  return root;
}

/**
 * Make `root` a git repository whose only commit holds every file in it, with git's global and system configuration
 * ignored. Returns the commit SHA.
 */
export function commitTree(root, message = 'fixture') {
  const home = tempDir('design-pro-max-git-');
  try {
    const env = isolatedGitEnv(home);
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8' }).trim();
    if (!fs.existsSync(path.join(root, '.git'))) git('init', '--quiet');
    git('add', '--all');
    git('-c', 'user.name=Fixture', '-c', `user.email=${['fixture', 'users.noreply.github.com'].join('@')}`, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  } finally {
    removeTree(home);
  }
}

/**
 * Run one of the repository's scripts with Node and return its exit status, signal and output.
 */
export function runScript(script, args = [], { env = process.env, timeout = 60_000 } = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, timeout });
}

/**
 * An environment for git that ignores the user's global and system configuration, plus `extra`.
 */
export function isolatedGitEnv(home, extra = {}) {
  const config = path.join(home, 'gitconfig');
  if (!fs.existsSync(config)) fs.writeFileSync(config, '');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', ...extra };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_CONFIG_PARAMETERS']) delete env[key];
  return env;
}

/**
 * The environment under which https://github.com/<repo>.git resolves to a repository made by commitUpstream.
 */
export function upstreamEnv(home) {
  const base = pathToFileURL(path.join(home, 'upstream')).href;
  return isolatedGitEnv(home, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.${base}/.insteadOf`, GIT_CONFIG_VALUE_0: 'https://github.com/' });
}

/**
 * The working folder of the fake upstream repository named `repo`.
 */
export function upstreamDir(home, repo) {
  return path.join(home, 'upstream', ...`${repo}.git`.split('/'));
}

/**
 * Commit `files` (path to text, or to `{ text, executable }`) to a fake upstream repository named `repo`, after
 * deleting the paths in `remove`, and return the commit SHA. The first call creates the repository.
 */
export function commitUpstream(home, repo, files, { remove = [] } = {}) {
  const dir = upstreamDir(home, repo);
  fs.mkdirSync(dir, { recursive: true });
  const env = isolatedGitEnv(home);
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { env, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  for (const relative of remove) fs.rmSync(path.join(dir, ...relative.split('/')), { force: true });
  for (const [relative, spec] of Object.entries(files)) {
    const file = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof spec === 'string' ? spec : spec.text);
    fs.chmodSync(file, typeof spec === 'object' && spec.executable ? 0o755 : 0o644);
  }
  git('add', '--all');
  for (const [relative, spec] of Object.entries(files)) {
    git('update-index', `--chmod=${typeof spec === 'object' && spec.executable ? '+' : '-'}x`, '--', relative);
  }
  git('-c', 'user.name=Fixture', '-c', `user.email=${['fixture', 'users.noreply.github.com'].join('@')}`, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture');
  return git('rev-parse', 'HEAD');
}
