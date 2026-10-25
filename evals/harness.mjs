#!/usr/bin/env node
/**
 * Runs the apple skill's evals in throwaway projects and extracts what each run did. Never touches the user's config:
 * Claude runs in a temp project with the skill at .claude/skills/apple; its baseline turns apple off with skillOverrides
 * in that project's .claude/settings.local.json and also leaves the skill folder out, because an agent that explores
 * the project finds and reads the folder even when the host does not list the skill. Codex runs `codex exec --json`
 * (no -s) in a temp git repo with the skill at .agents/skills/apple; its baseline has no skill folder.
 *
 * With --install user, Claude instead finds the skill where an installer puts it, outside the project: the run gets a
 * temporary CLAUDE_CONFIG_DIR holding copies of the user's skills, links to the user's CLAUDE.md and rules, and apple
 * only in the with condition, so exploring the project cannot reach the skill. The user's model and effort are kept.
 *
 *   node evals/harness.mjs run --suite routing|launch-scroll --host claude|codex --condition with|without --out <dir>
 *        [--ids a,b] [--listing] [--install project|user]
 *                                  --listing keeps the session so the host's skill listing can be read back
 *   node evals/harness.mjs trace --out <dir>                re-extract every trace from the raw output
 *   node evals/harness.mjs score --out <dir>                score the routing traces against the bars
 *
 * A run that ends on the host's session or usage limit did no work, so it is not a result: run stops the lane at the
 * first one, and score leaves such runs out of every bar, lists them under invalid and exits 1.
 *
 * Raw output, traces and diffs go to <dir>, which belongs outside the repository: it holds the host's full context.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'apple');
const SUITES = {
  routing: { file: path.join(ROOT, 'evals', 'routing', 'cases.json'), list: (doc) => doc.cases, maxTurns: 10, timeout: 480 },
  'launch-scroll': { file: path.join(ROOT, 'evals', 'apple', 'launch-scroll', 'evals.json'), list: (doc) => doc.evals, maxTurns: 60, timeout: 1500 },
};
const SKILL_ROOT = { claude: '.claude/skills/apple', codex: '.agents/skills/apple' };
const USER_CLAUDE = process.env.DPM_EVAL_CLAUDE_HOME ?? path.join(os.homedir(), '.claude');
const SKIPPED_USER_SKILLS = new Set(['apple', 'synced']);
const NESTED_ENV = ['CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_TMPDIR', 'CLAUDE_CODE_EXECPATH'];

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i].replace(/^--/, '');
    if (key === 'listing') options.listing = true;
    else options[key] = rest[(i += 1)];
  }
  return options;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const HOST_LIMIT = /\byou['’]ve (?:hit|reached) your (?:session|usage|weekly|daily|rate) limit\b|\busage limit (?:reached|exceeded)\b/i;

/** Whether a run ended on the host's session or usage limit instead of doing the task. */
export function hitHostLimit(trace) {
  return HOST_LIMIT.test(`${trace.finalText ?? ''}\n${trace.error ?? ''}`);
}

const runId = (host, condition, id) => `${host}-${condition}-${id}`;

function sh(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

/**
 * A temporary Claude config folder for --install user: the user's skills except apple, links to the user's CLAUDE.md
 * and rules, and apple itself only when the condition is with. The folder is named .claude so traces resolve skill
 * paths the same way as with a project install.
 */
export function makeClaudeHome(condition, userHome = USER_CLAUDE) {
  const home = path.join(fs.mkdtempSync(path.join(os.tmpdir(), `apple-eval-home-${condition}-`)), '.claude');
  const skills = path.join(home, 'skills');
  fs.mkdirSync(skills, { recursive: true });
  const userSkills = path.join(userHome, 'skills');
  if (fs.existsSync(userSkills)) {
    for (const entry of fs.readdirSync(userSkills, { withFileTypes: true })) {
      if (SKIPPED_USER_SKILLS.has(entry.name) || entry.name.startsWith('.')) continue;
      fs.cpSync(path.join(userSkills, entry.name), path.join(skills, entry.name), { recursive: true, dereference: true });
    }
  }
  for (const name of ['CLAUDE.md', 'rules']) if (fs.existsSync(path.join(userHome, name))) fs.symlinkSync(path.join(userHome, name), path.join(home, name));
  if (condition === 'with') fs.cpSync(SKILL, path.join(skills, 'apple'), { recursive: true });
  return home;
}

/** The settings a --install user run passes: hooks off, and the user's own model and effort. */
export function userRunSettings(userHome = USER_CLAUDE) {
  const settings = { disableAllHooks: true };
  try {
    const own = readJson(path.join(userHome, 'settings.json'));
    for (const key of ['model', 'effortLevel']) if (own[key] !== undefined) settings[key] = own[key];
  } catch {}
  return settings;
}

function makeProject(host, condition, testCase, suiteDir, install = 'project') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `apple-eval-${host}-${condition}-`));
  const userInstall = host === 'claude' && install === 'user';
  if (condition === 'with' && !userInstall) fs.cpSync(SKILL, path.join(dir, ...SKILL_ROOT[host].split('/')), { recursive: true });
  if (host === 'claude' && condition === 'without' && !userInstall) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.local.json'), `${JSON.stringify({ skillOverrides: { apple: 'off' } }, null, 2)}\n`);
  }
  for (const file of testCase.files ?? []) {
    const source = path.join(suiteDir, ...file.split('/'));
    const target = path.join(dir, ...file.split('/').slice(2));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  sh('git', ['init', '-q'], dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['-c', 'user.name=eval', '-c', 'user.email=eval', 'commit', '-qm', 'fixture', '--allow-empty'], dir);
  return dir;
}

function hostCommand(host, prompt, suite, listing, settings = { disableAllHooks: true }) {
  if (host === 'claude') {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions', '--settings', JSON.stringify(settings), '--max-turns', String(suite.maxTurns)];
    if (!listing) args.push('--no-session-persistence');
    return ['claude', args];
  }
  const args = ['exec', '--json', '--skip-git-repo-check'];
  if (!listing) args.push('--ephemeral');
  args.push(prompt);
  return ['codex', args];
}

/**
 * Everything the run changed since the fixture commit `base`, including what the agent committed itself, plus the
 * agent's own commits.
 */
export function diffOf(dir, base) {
  sh('git', ['add', '-A'], dir);
  const commits = sh('git', ['log', '--oneline', `${base}..HEAD`], dir);
  const names = sh('git', ['diff', '--cached', '--name-status', base, '--', '.', ':(exclude).claude', ':(exclude).agents'], dir);
  const text = sh('git', ['diff', '--cached', '--no-color', '--stat=200', '-p', base, '--', '.', ':(exclude).claude', ':(exclude).agents', ':(exclude)node_modules', ':(exclude)package-lock.json'], dir);
  return `${commits ? `agent commits:\n${commits}\n` : ''}${names}\n${text}`.slice(0, 400000);
}

function runSuite(options) {
  const suite = SUITES[options.suite];
  if (!suite || !SKILL_ROOT[options.host] || !['with', 'without'].includes(options.condition) || !options.out) throw new Error('run needs --suite, --host, --condition and --out');
  const install = options.install ?? 'project';
  if (!['project', 'user'].includes(install)) throw new Error('--install is project or user');
  const userInstall = options.host === 'claude' && install === 'user';
  const doc = readJson(suite.file);
  const wanted = options.ids ? new Set(options.ids.split(',')) : null;
  const cases = suite.list(doc).filter((item) => !wanted || wanted.has(String(item.id)));
  const out = path.resolve(options.out);
  for (const sub of ['raw', 'traces']) fs.mkdirSync(path.join(out, sub), { recursive: true });
  const env = { ...process.env };
  for (const key of NESTED_ENV) delete env[key];
  for (const testCase of cases) {
    const id = runId(options.host, options.condition, testCase.id) + (options.listing ? '-listing' : '');
    const dir = makeProject(options.host, options.condition, testCase, path.dirname(suite.file), install);
    const base = sh('git', ['rev-parse', 'HEAD'], dir).trim();
    const home = userInstall ? makeClaudeHome(options.condition) : null;
    const [cmd, args] = hostCommand(options.host, testCase.prompt, suite, options.listing, userInstall ? userRunSettings() : undefined);
    const started = new Date().toISOString();
    const result = spawnSync(cmd, args, { cwd: dir, env: home ? { ...env, CLAUDE_CONFIG_DIR: home } : env, encoding: 'utf8', input: '', timeout: suite.timeout * 1000, killSignal: 'SIGTERM', maxBuffer: 512 * 1024 * 1024 });
    const meta = { id, suite: options.suite, host: options.host, condition: options.condition, case: testCase.id, started, finished: new Date().toISOString(), status: result.status, signal: result.signal, timedOut: result.error?.code === 'ETIMEDOUT', projectDir: dir, listing: Boolean(options.listing), install: userInstall ? 'user' : 'project' };
    fs.writeFileSync(path.join(out, 'raw', `${id}.jsonl`), result.stdout ?? '');
    fs.writeFileSync(path.join(out, 'raw', `${id}.err`), result.stderr ?? '');
    if (options.suite !== 'routing') fs.writeFileSync(path.join(out, 'raw', `${id}.diff`), diffOf(dir, base));
    fs.writeFileSync(path.join(out, 'raw', `${id}.meta.json`), `${JSON.stringify(meta, null, 2)}\n`);
    const trace = extract(meta, result.stdout ?? '');
    fs.writeFileSync(path.join(out, 'traces', `${id}.json`), `${JSON.stringify(trace, null, 2)}\n`);
    fs.rmSync(dir, { recursive: true, force: true });
    if (home) fs.rmSync(path.dirname(home), { recursive: true, force: true });
    process.stdout.write(`${id} status=${result.status} timedOut=${meta.timedOut} trigger=${trace.triggered} firstPart=${trace.firstPart ?? '-'}\n`);
    if (trace.hostLimit) {
      process.stderr.write(`${id} ended on the ${options.host} session or usage limit; the remaining cases were not run\n`);
      process.exitCode = 1;
      return;
    }
  }
}

const lineCount = (rel) => {
  const file = path.join(SKILL, ...rel.split('/'));
  return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8').split('\n').length : null;
};

/** The part folder of a path relative to skills/apple, or null when the path is not inside a part. */
export function partOf(rel) {
  const parts = rel.split('/');
  if (parts[0] === 'launch-scroll') return 'launch-scroll';
  if (parts[0] !== '.vendor' || parts.length < 3) return null;
  if (['xcode-build', 'app-store-connect'].includes(parts[1])) return parts.length >= 4 ? parts.slice(0, 3).join('/') : null;
  return parts.slice(0, 2).join('/');
}

const SKILL_MARKER = /(?:\.claude|\.agents)\/skills\/apple(?=\/|$)/;

function relFromPath(p) {
  const marker = SKILL_MARKER.exec(p);
  if (!marker) return null;
  const tail = p.slice(marker.index + marker[0].length).replace(/^\//, '');
  return path.posix.normalize(tail || '.').replace(/\/$/, '');
}

let skillFiles = null;
function allSkillFiles() {
  if (skillFiles) return skillFiles;
  skillFiles = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), next);
      else skillFiles.push(next);
    }
  };
  walk(SKILL, '');
  return skillFiles;
}

function globMatches(rel) {
  const pattern = new RegExp(`^${rel.split('').map((ch) => (ch === '*' ? '[^/]*' : ch === '?' ? '[^/]' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('')}$`);
  return allSkillFiles().filter((file) => pattern.test(file));
}

/** Shell words and control operators of a command line, with quotes removed and heredoc bodies skipped. */
export function tokenize(text) {
  const tokens = [];
  let word = null;
  let i = 0;
  const flush = () => {
    if (word !== null) tokens.push(word);
    word = null;
  };
  const heredocs = [];
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      word = (word ?? '') + text.slice(i + 1, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 1;
    } else if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < text.length) {
          value += text[j + 1];
          j += 2;
        } else value += text[j++];
      }
      word = (word ?? '') + value;
      i = j + 1;
    } else if (ch === '\\' && i + 1 < text.length) {
      if (text[i + 1] !== '\n') word = (word ?? '') + text[i + 1];
      i += 2;
    } else if (ch === '\n') {
      flush();
      tokens.push({ op: '\n' });
      i += 1;
      for (const delimiter of heredocs.splice(0)) {
        const lines = text.slice(i).split('\n');
        let skip = 0;
        let k = 0;
        for (; k < lines.length && lines[k].trim() !== delimiter; k += 1) skip += lines[k].length + 1;
        i += skip + (k < lines.length ? lines[k].length + 1 : 0);
      }
    } else if (/\s/.test(ch)) {
      flush();
      i += 1;
    } else if (text.startsWith('<<', i)) {
      flush();
      const match = /^<<-?\s*(['"]?)([\w.-]+)\1/.exec(text.slice(i));
      if (match) {
        heredocs.push(match[2]);
        i += match[0].length;
      } else i += 2;
    } else if (/^(?:&&|\|\||;|\|)/.test(text.slice(i))) {
      flush();
      const op = /^(?:&&|\|\||;|\|)/.exec(text.slice(i))[0];
      tokens.push({ op });
      i += op.length;
    } else if (/^\d*(?:>>?|<)&?/.test(text.slice(i)) && (word === null || /^\d+$/.test(word))) {
      word = null;
      const match = /^\d*(?:>>?|<)&?\s*/.exec(text.slice(i));
      i += match[0].length;
      while (i < text.length && !/[\s;&|]/.test(text[i])) i += 1;
    } else if (ch === '(' || ch === ')') {
      flush();
      tokens.push({ op: ';' });
      i += 1;
    } else {
      word = (word ?? '') + ch;
      i += 1;
    }
  }
  flush();
  return tokens;
}

const FULL_VERBS = new Set(['cat', 'bat', 'less', 'more', 'nl', 'type', 'Get-Content']);
const READ_VERBS = new Set([...FULL_VERBS, 'sed', 'head', 'tail', 'awk', 'python3', 'python', 'node', 'perl']);
const LIST_VERBS = new Set(['ls', 'find', 'tree', 'grep', 'rg', 'wc', 'test', 'stat', 'file', 'du', 'fd', '[']);
const CWD_VERBS = new Set([...FULL_VERBS, 'sed', 'head', 'tail', 'ls', 'test', 'stat', 'wc', 'file', 'tree', 'du', '[']);
const PREFIXES = new Set(['sudo', 'command', 'env', 'time', 'nohup']);

function stageWords(stage) {
  let words = stage.slice();
  while (words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]) || PREFIXES.has(words[0]))) words = words.slice(1);
  return words;
}

/** The line range a reading stage keeps: sed -n 'a,bp', head -n N, or tail; null for the whole stream. */
function stageRange(verb, words) {
  const script = words.slice(1).join(' ');
  if (verb === 'sed') {
    const sed = /(?:^|\s)(\d+)\s*,\s*(\d+)p\b/.exec(script);
    const single = /(?:^|\s)(\d+)p\b/.exec(script);
    if (sed) return [Number(sed[1]), Number(sed[2])];
    if (single) return [Number(single[1]), Number(single[1])];
    return /-n\b/.test(script) ? [0, 0] : null;
  }
  if (verb === 'head') {
    const bytes = /-c\s*(\d+)/.exec(script);
    if (bytes) return { bytes: Number(bytes[1]) };
    const count = /(?:-n\s*|-)(\d+)/.exec(script);
    return [1, count ? Number(count[1]) : 10];
  }
  if (verb === 'tail') return [-1, -1];
  return null;
}

/**
 * Reads and lists of skill files in one shell command, each with its verb, line range and whether it covers the
 * whole file. `state.cwd` is the shell's folder relative to skills/apple (null outside it); Claude's shell keeps it
 * between calls, a Codex command starts fresh.
 */
export function shellAccesses(command, state = { cwd: null }) {
  let tokens = tokenize(command);
  const first = tokens.filter((token) => typeof token === 'string');
  if (tokens.length === 3 && /\/(?:ba|z)?sh$/.test(first[0] ?? '') && /^-l?c$/.test(first[1] ?? '')) tokens = tokenize(first[2]);
  const accesses = [];
  const pipelines = [[]];
  for (const token of tokens) {
    if (typeof token === 'string') pipelines.at(-1).push(token);
    else if (token.op === '|') pipelines.at(-1).push(token);
    else pipelines.push([]);
  }
  const vars = {};
  const VAR = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/;
  const expand = (word) => {
    const match = VAR.exec(word);
    if (!match || vars[match[1]] === undefined) return [word];
    return [].concat(vars[match[1]]).flatMap((value) => expand(word.replace(match[0], value)));
  };
  for (const pipeline of pipelines) {
    const stages = [[]];
    for (const token of pipeline) (typeof token === 'string' ? stages.at(-1).push(...expand(token)) : stages.push([]));
    if (stages[0][0] === 'for' && stages[0][2] === 'in') {
      vars[stages[0][1]] = stages[0].slice(3).filter((word) => word !== 'do');
      continue;
    }
    if (['do', 'then', 'else'].includes(stages[0][0])) stages[0] = stages[0].slice(1);
    if (stages[0].length && stages[0].every((word) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word))) {
      for (const word of stages[0]) vars[word.slice(0, word.indexOf('='))] = word.slice(word.indexOf('=') + 1);
      continue;
    }
    const words = stageWords(stages[0]);
    if (!words.length) continue;
    const verb = words[0].replace(/^.*\//, '');
    if (verb === 'cd') {
      const target = words[1] ?? '';
      const rel = relFromPath(target);
      if (rel !== null) state.cwd = rel === '.' ? '' : rel;
      else if (state.cwd !== null && target && !target.startsWith('/') && !target.startsWith('~') && !target.startsWith('$')) {
        const joined = path.posix.normalize(path.posix.join(state.cwd || '.', target));
        state.cwd = joined.startsWith('..') ? null : joined === '.' ? '' : joined;
      } else state.cwd = null;
      continue;
    }
    const args = words.slice(1).filter((word) => !word.startsWith('-') && !/^\d+(?:,\d+)?p$/.test(word) && !/^-?\d+$/.test(word));
    const rels = [];
    const pieces = args.flatMap((arg) => (/[\s'"()[\],]/.test(arg) ? (arg.match(/[^\s'"()[\],]*(?:\.claude|\.agents)\/skills\/apple[^\s'"()[\],]*/g) ?? []) : [arg]));
    for (const arg of pieces) {
      const rel = relFromPath(arg);
      if (rel !== null) rels.push(rel);
      else if (state.cwd !== null && CWD_VERBS.has(verb) && !arg.startsWith('/') && !arg.startsWith('~') && !arg.includes('$') && /[\w*?]/.test(arg) && !/\s/.test(arg)) {
        const joined = path.posix.normalize(path.posix.join(state.cwd || '.', arg));
        if (!joined.startsWith('..')) rels.push(joined);
      }
    }
    if (!rels.length) continue;
    const kind = READ_VERBS.has(verb) ? 'read' : LIST_VERBS.has(verb) ? 'list' : 'other';
    let range = kind === 'read' ? stageRange(verb, words) : null;
    for (const stage of stages.slice(1)) {
      const later = stageWords(stage);
      const laterVerb = (later[0] ?? '').replace(/^.*\//, '');
      const cut = ['head', 'sed', 'tail'].includes(laterVerb) ? stageRange(laterVerb, later) : null;
      if (cut) range = cut;
    }
    for (const rel of rels.flatMap((item) => (/[*?]/.test(item) ? globMatches(item) : [item]))) {
      const file = path.join(SKILL, ...rel.split('/'));
      const exists = fs.existsSync(file);
      const lines = lineCount(rel);
      let full = null;
      if (kind === 'read' && lines !== null) {
        if (range && range.bytes !== undefined) full = range.bytes >= fs.statSync(file).size;
        else if (range) full = range[0] >= 0 && range[0] <= 1 && range[1] >= lines - 1;
        else full = FULL_VERBS.has(verb) || verb === 'awk' || verb === 'sed' ? true : null;
      }
      accesses.push({ tool: 'shell', verb, rel, kind, range, full, exists, lines });
    }
  }
  return accesses;
}

function readToolAccess(input, result) {
  const rel = relFromPath(input.file_path ?? '');
  if (rel === null) return null;
  const lines = lineCount(rel);
  const ranged = input.offset !== undefined || input.limit !== undefined;
  const range = ranged ? [input.offset ?? 1, (input.offset ?? 1) + (input.limit ?? 2000) - 1] : null;
  return { tool: 'Read', rel, kind: 'read', offset: input.offset ?? null, limit: input.limit ?? null, range, full: lines === null ? null : !ranged || (range[0] <= 1 && range[1] >= lines - 1), exists: fs.existsSync(path.join(SKILL, ...rel.split('/'))), lines, error: Boolean(result?.is_error) };
}

function extractClaude(lines) {
  const trace = { listedSkills: null, model: null, skillCalls: [], accesses: [], tools: [], finalText: '', numTurns: null, costUsd: null, sessionId: null, error: null };
  const results = new Map();
  const shell = { cwd: null };
  for (const event of lines) if (event.type === 'user' && Array.isArray(event.message?.content)) for (const item of event.message.content) if (item.type === 'tool_result') results.set(item.tool_use_id, item);
  for (const event of lines) {
    if (event.type === 'system' && event.subtype === 'init') Object.assign(trace, { listedSkills: event.skills ?? null, model: event.model, sessionId: event.session_id, version: event.claude_code_version });
    if (event.type === 'assistant') {
      for (const item of event.message?.content ?? []) {
        if (item.type !== 'tool_use') continue;
        trace.tools.push(item.name);
        const result = results.get(item.id);
        if (item.name === 'Skill') trace.skillCalls.push({ skill: item.input?.skill, args: item.input?.args ?? null });
        else if (item.name === 'Read') {
          const access = readToolAccess(item.input ?? {}, result);
          if (access) trace.accesses.push(access);
        } else if (item.name === 'Bash') trace.accesses.push(...shellAccesses(item.input?.command ?? '', shell));
        else if (['Grep', 'Glob'].includes(item.name)) {
          const rel = relFromPath(item.input?.path ?? '');
          if (rel !== null) trace.accesses.push({ tool: item.name, rel, kind: 'list', exists: fs.existsSync(path.join(SKILL, ...rel.split('/'))) });
        }
      }
    }
    if (event.type === 'result') Object.assign(trace, { finalText: event.result ?? '', numTurns: event.num_turns, costUsd: event.total_cost_usd, error: event.is_error ? event.subtype : null });
  }
  return trace;
}

function extractCodex(lines) {
  const trace = { listedSkills: null, model: null, skillCalls: [], accesses: [], tools: [], finalText: '', threadId: null, error: null, usage: null };
  for (const event of lines) {
    if (event.type === 'thread.started') trace.threadId = event.thread_id;
    if (event.type === 'turn.completed') trace.usage = event.usage;
    if (event.type === 'turn.failed' || event.type === 'error') trace.error = event.error?.message ?? event.message ?? 'error';
    if (event.type !== 'item.completed') continue;
    const item = event.item ?? {};
    trace.tools.push(item.type);
    if (item.type === 'agent_message') trace.finalText = item.text ?? '';
    if (item.type === 'command_execution') trace.accesses.push(...shellAccesses(item.command ?? '').map((access) => ({ ...access, exitCode: item.exit_code })));
  }
  return trace;
}

/** What one run did: whether apple started, its first part, every access to a skill file and the read checks. */
export function extract(meta, stdout) {
  const lines = stdout.split('\n').filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const trace = meta.host === 'claude' ? extractClaude(lines) : extractCodex(lines);
  const routerRead = trace.accesses.some((access) => access.kind === 'read' && access.rel === 'SKILL.md');
  trace.skillCalled = trace.skillCalls.some((call) => call.skill === 'apple');
  trace.readApple = routerRead || trace.accesses.some((access) => access.kind === 'read' && partOf(access.rel));
  trace.triggered = meta.host === 'claude' ? trace.skillCalled : routerRead;
  trace.firstSkillCall = trace.skillCalls[0]?.skill ?? null;
  const partReads = trace.accesses.filter((access) => access.kind === 'read' && partOf(access.rel));
  trace.firstPart = partReads[0] ? partOf(partReads[0].rel) : null;
  const fully = new Set(trace.accesses.filter((access) => access.kind === 'read' && access.full === true).map((access) => access.rel));
  const readFiles = [...new Set(trace.accesses.filter((access) => access.kind === 'read' && access.exists && access.lines !== null).map((access) => access.rel))];
  const guides = readFiles.filter((rel) => /(?:^|\/)(?:SKILL|PART)\.md$/.test(rel));
  trace.guideReads = guides.length;
  trace.partialGuideReads = guides.filter((rel) => !fully.has(rel) && trace.accesses.some((access) => access.rel === rel && access.full === false));
  trace.partialReads = readFiles.filter((rel) => !fully.has(rel) && trace.accesses.some((access) => access.rel === rel && access.full === false));
  trace.wrongPathReads = [...new Set(trace.accesses.filter((access) => access.kind === 'read' && (!access.exists || access.error)).map((access) => access.rel))];
  trace.wrongPathLists = [...new Set(trace.accesses.filter((access) => access.kind === 'list' && !access.exists).map((access) => access.rel))];
  trace.contaminated = meta.condition === 'without' && (trace.triggered || trace.accesses.some((access) => access.kind === 'read'));
  trace.listedApple = Array.isArray(trace.listedSkills) ? trace.listedSkills.includes('apple') : null;
  trace.hostLimit = hitHostLimit(trace);
  return { ...meta, ...trace };
}

function retrace(options) {
  const out = path.resolve(options.out);
  for (const name of fs.readdirSync(path.join(out, 'raw')).filter((file) => file.endsWith('.meta.json'))) {
    const meta = readJson(path.join(out, 'raw', name));
    const trace = extract(meta, fs.readFileSync(path.join(out, 'raw', `${meta.id}.jsonl`), 'utf8'));
    fs.writeFileSync(path.join(out, 'traces', `${meta.id}.json`), `${JSON.stringify(trace, null, 2)}\n`);
  }
}

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

/**
 * Whether a near-miss run counts as a false trigger. Claude starts apple through its Skill tool. Codex has no such
 * tool and reads the router to check its not-for clause, so for Codex only a part read counts; a near miss that read
 * the router and stopped is reported as routerOnly instead.
 */
export function isFalseTrigger(trace) {
  return trace.host === 'codex' ? trace.firstPart !== null : trace.triggered;
}

/** Routing scores per host against the bars of evals/routing/cases.json. */
export function scoreRouting(out) {
  const doc = readJson(SUITES.routing.file);
  const byId = new Map(doc.cases.map((item) => [item.id, item]));
  const traces = fs.readdirSync(path.join(out, 'traces')).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(out, 'traces', name))).filter((trace) => trace.suite === 'routing' && trace.condition === 'with' && !trace.listing);
  const hosts = {};
  for (const host of ['claude', 'codex']) {
    const all = traces.filter((trace) => trace.host === host);
    if (!all.length) continue;
    const invalid = all.filter(hitHostLimit);
    const runs = all.filter((trace) => !hitHostLimit(trace));
    const rows = runs.filter((trace) => byId.get(trace.case)?.kind === 'row');
    const near = runs.filter((trace) => byId.get(trace.case)?.kind === 'near-miss');
    const triggered = rows.filter((trace) => trace.triggered);
    const rightPart = triggered.filter((trace) => trace.firstPart === byId.get(trace.case).expect.part);
    const scored = runs.filter((trace) => byId.get(trace.case)?.kind !== 'recorded');
    const guideReads = scored.reduce((sum, trace) => sum + trace.guideReads, 0);
    const partialGuideReads = scored.reduce((sum, trace) => sum + trace.partialGuideReads.length, 0);
    const wrong = scored.reduce((sum, trace) => sum + trace.wrongPathReads.length, 0);
    const falseTriggers = near.filter(isFalseTrigger);
    const routerOnly = near.filter((trace) => trace.triggered && !isFalseTrigger(trace));
    const readRows = rows.filter((trace) => trace.readApple || trace.triggered);
    const readNear = near.filter((trace) => trace.readApple || trace.triggered);
    const failures = [
      ...rows.filter((trace) => !trace.triggered).map((trace) => ({ run: trace.id, bar: 'recall', detail: 'apple did not start' })),
      ...triggered.filter((trace) => trace.firstPart !== byId.get(trace.case).expect.part).map((trace) => ({ run: trace.id, bar: 'firstPart', detail: `first part ${trace.firstPart ?? 'none'}, expected ${byId.get(trace.case).expect.part}` })),
      ...falseTriggers.map((trace) => ({ run: trace.id, bar: 'falseTriggers', detail: `apple started${trace.firstPart ? `, read ${trace.firstPart}` : ''} (belongs to ${byId.get(trace.case).expect.instead})` })),
      ...scored.filter((trace) => trace.partialGuideReads.length).map((trace) => ({ run: trace.id, bar: 'fullReads', detail: `partial read of ${trace.partialGuideReads.join(', ')}` })),
      ...scored.filter((trace) => trace.wrongPathReads.length).map((trace) => ({ run: trace.id, bar: 'wrongPathReads', detail: trace.wrongPathReads.join(', ') })),
    ];
    hosts[host] = {
      runs: runs.length,
      invalid: invalid.map((trace) => trace.id),
      recall: { value: pct(triggered.length, rows.length), n: `${triggered.length}/${rows.length}`, met: triggered.length / rows.length >= doc.bars.recall },
      falseTriggers: { value: pct(falseTriggers.length, near.length), n: `${falseTriggers.length}/${near.length}`, met: falseTriggers.length / near.length <= doc.bars.falseTriggers, routerOnly: routerOnly.map((trace) => trace.id) },
      firstPart: { value: pct(rightPart.length, triggered.length), n: `${rightPart.length}/${triggered.length}`, met: triggered.length > 0 && rightPart.length / triggered.length >= doc.bars.firstPart },
      fullReads: { value: pct(guideReads - partialGuideReads, guideReads), n: `${guideReads - partialGuideReads}/${guideReads}`, met: partialGuideReads === 0 },
      wrongPathReads: { value: wrong, met: wrong <= doc.bars.wrongPathReads },
      anyAppleRead: { rows: `${readRows.length}/${rows.length}`, nearMisses: `${readNear.length}/${near.length}`, readWithoutTrigger: runs.filter((trace) => trace.readApple && !trace.triggered).map((trace) => trace.id) },
      failures,
      recorded: runs.filter((trace) => byId.get(trace.case)?.kind === 'recorded').map((trace) => ({ run: trace.id, triggered: trace.triggered, firstPart: trace.firstPart, firstSkillCall: trace.firstSkillCall })),
    };
  }
  return hosts;
}

const options = parseArgs(process.argv.slice(2));
if (options.command === 'run') runSuite(options);
else if (options.command === 'trace') retrace(options);
else if (options.command === 'score') {
  const hosts = scoreRouting(path.resolve(options.out));
  process.stdout.write(`${JSON.stringify(hosts, null, 2)}\n`);
  if (Object.values(hosts).some((host) => host.invalid.length)) process.exitCode = 1;
}
else if (options.command) {
  process.stderr.write('Usage: node evals/harness.mjs <run|trace|score> ...\n');
  process.exit(2);
}
