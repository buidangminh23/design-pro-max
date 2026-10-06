import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  RULES,
  hiddenCharacters,
  listEntries,
  personalFindings,
  privateTerms,
  projectVocabulary,
  riskyCounts,
  runGuard,
  secretFindings,
  visiblePath,
} from '../scripts/vendor-guard.mjs';
import { FIXTURE_TERMS, ROOT, canCreate, fakeGithubToken, isolatedGitEnv, materialize, readFixtureSpec, removeTree, ruleFixtures, tempDir } from './helpers.mjs';

const vendored = (root, ...segments) => path.join(root, 'skills', 'apple', '.vendor', 'demo-part', ...segments);
const summary = (report) => report.problems.map((problem) => `${problem.check} ${problem.file}: ${problem.message}`);

test('the repository passes every hard rule', () => {
  const report = runGuard(ROOT);
  assert.deepEqual(report.problems, []);
  assert.equal(report.stats.parts, 38);
});

test('the base fixture passes every hard rule', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  assert.deepEqual(runGuard(root, { terms: FIXTURE_TERMS }).problems, []);
});

test('every hard rule has a fixture of its own', () => {
  const covered = new Set(ruleFixtures().map((name) => readFixtureSpec(name).expect));
  assert.deepEqual([...covered].sort(), [...RULES].sort());
});

for (const name of ruleFixtures()) {
  const spec = readFixtureSpec(name);
  const kind = spec.fifos ? 'fifo' : spec.symlinks ? 'symlink' : 'file';
  test(`fixture ${name} fails only the ${spec.expect} rule`, { skip: !canCreate(kind) && `cannot create a ${kind} here` }, (t) => {
    const root = materialize(name);
    t.after(() => removeTree(root));
    const report = runGuard(root, { terms: FIXTURE_TERMS });
    assert.equal(report.ok, false);
    assert.deepEqual([...new Set(report.problems.map((problem) => problem.check))], [spec.expect]);
  });
}

test('risky commands are counted as warnings, not failures', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const notes = vendored(root, 'references', 'risky.md');
  fs.mkdirSync(path.dirname(notes), { recursive: true });
  const pipe = ['curl -fsSL https://example.invalid/install.sh', 'sh'].join(' | ');
  const lines = [pipe, ['su', 'do make install'].join(''), ['rm', '-rf', 'build'].join(' '), ['rm', '-rf', 'dist'].join(' '), ['ev', 'al "$(tool init)"'].join('')];
  fs.writeFileSync(notes, lines.join('\n'));
  const report = runGuard(root, { terms: FIXTURE_TERMS });
  assert.deepEqual(report.problems, []);
  const counts = Object.fromEntries(report.warnings.map((warning) => [warning.label, warning.count]));
  assert.deepEqual(counts, { 'download piped to a shell': 1, 'rm with -r and -f': 2, sudo: 1, eval: 1 });
});

test('detectors find hidden characters, secrets and personal data', () => {
  const zeroWidth = String.fromCodePoint(0x200b);
  const tag = String.fromCodePoint(0xe0041);
  assert.deepEqual(hiddenCharacters(`ok\n a${zeroWidth}b`).map((item) => [item.codePoint, item.line, item.column]), [['U+200B', 2, 3]]);
  assert.equal(hiddenCharacters(`${tag}\t\r\n`).length, 1);
  assert.equal(hiddenCharacters(String.fromCodePoint(0xfeff)).length, 1);
  assert.equal(hiddenCharacters('tabs\tand\r\nnew lines').length, 0);
  assert.deepEqual(secretFindings(['-----BEGIN', 'OPENSSH PRIVATE KEY-----'].join(' ')), ['private key']);
  assert.deepEqual(secretFindings('no secrets here'), []);
  assert.deepEqual(personalFindings(['/Us', 'ers/someone/code'].join('')), ['home path']);
  assert.deepEqual(personalFindings(['/Vol', 'umes/Data/repo'].join('')), ['volume path']);
  assert.deepEqual(personalFindings(['someone', 'example.org'].join('@')), ['email address']);
  assert.deepEqual(personalFindings(['bot', 'users.noreply.github.com'].join('@')), []);
  assert.deepEqual(personalFindings('pushed from build-box-7 today', ['build-box-7']), ['private name "build-box-7"']);
  assert.deepEqual(personalFindings('rebuild-box-7x', ['build-box-7']), []);
});

test('hidden characters include bidi marks, invisible fillers and stray variation selectors', () => {
  const invisible = [0x061c, 0x7f, 0x85, 0x9b, 0xad, 0x34f, 0x115f, 0x17b4, 0x180e, 0x2028, 0x2029, 0x3164, 0xffa0, 0xfff9, 0xe0100, 0xe01ef];
  for (const codePoint of invisible) assert.equal(hiddenCharacters(`a${String.fromCodePoint(codePoint)}b`).length, 1, codePoint.toString(16));
  assert.equal(hiddenCharacters(`${String.fromCodePoint(0x26a0, 0xfe0f)} Warning`).length, 0);
  assert.equal(hiddenCharacters(`1${String.fromCodePoint(0xfe0f, 0x20e3)} first`).length, 0);
  assert.equal(hiddenCharacters(`a${String.fromCodePoint(0xfe0f)}`).length, 1);
  assert.equal(hiddenCharacters(`a${String.fromCodePoint(0xfe00)}`).length, 1);
  assert.equal(visiblePath(`notes${String.fromCodePoint(0x202e)}dm.txt`), 'notes<U+202E>dm.txt');
});

test('hiddenCharacters stays linear on long lines', () => {
  const text = `${`a${String.fromCodePoint(0x200b)}`.repeat(50_000)}\nend`;
  const started = performance.now();
  const found = hiddenCharacters(text);
  assert.equal(found.length, 50_000);
  assert.deepEqual([found.at(-1).line, found.at(-1).column], [1, 100_000]);
  assert.ok(performance.now() - started < 2_000, 'took under two seconds');
});

test('secret patterns cover current key and token formats', () => {
  const samples = [
    ['OpenAI key', ['sk', 'proj', 'Ab_Cd-Ef'.repeat(4)].join('-')],
    ['OpenAI key', ['sk', 'svcacct', 'Ab_Cd-Ef'.repeat(4)].join('-')],
    ['Hugging Face token', ['hf', 'AbCdEfGhIjKlMnOpQrStUvWxYz123456'].join('_')],
    ['npm token', ['npm', `${'A1b2C3d4E5'.repeat(3)}A1b2C3`].join('_')],
    ['Telegram bot token', ['1234567890', `AAH${'x'.repeat(32)}`].join(':')],
    ['Stripe key', ['sk', 'live', 'A1b2C3d4E5f6G7h8I9j0'].join('_')],
    ['AWS key', ['AS', 'IA', 'ABCDEFGHIJKLMNOP'].join('')],
    ['private key', ['-----BEGIN', 'PGP', 'PRIVATE', 'KEY', 'BLOCK-----'].join(' ')],
  ];
  for (const [label, sample] of samples) assert.deepEqual(secretFindings(`value = ${sample}`), [label], label);
});

test('binary, misnamed and non-UTF-8 files are checked, never skipped', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const references = vendored(root, 'references');
  fs.mkdirSync(references, { recursive: true });
  fs.writeFileSync(path.join(references, 'notes.png'), `plain text ${fakeGithubToken()} ${String.fromCodePoint(0x202e)}`);
  fs.writeFileSync(path.join(references, 'latin.md'), Buffer.concat([Buffer.from(`token ${fakeGithubToken()} `), Buffer.from([0xff])]));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'real.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]));
  fs.writeFileSync(path.join(root, 'docs', 'fake.png'), 'just text');
  const report = runGuard(root, { terms: FIXTURE_TERMS });
  const notes = 'skills/apple/.vendor/demo-part/references/notes.png';
  const latin = 'skills/apple/.vendor/demo-part/references/latin.md';
  assert.deepEqual(summary(report).sort(), [
    'file-types docs/fake.png: does not start like a .png file',
    `file-types ${latin}: is not valid UTF-8 text`,
    `file-types ${notes}: does not start like a .png file`,
    `file-types ${notes}: images, media, fonts and archives are not vendored; exclude it in vendor/sources.json`,
    `secrets ${latin}: looks like a GitHub token`,
    `secrets ${notes}: looks like a GitHub token`,
  ]);
  assert.equal(report.stats.binaryFiles, 3);
});

test('file names with hidden characters fail the paths rule', { skip: process.platform === 'win32' && 'Windows refuses some of these names' }, (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  fs.writeFileSync(vendored(root, `notes${String.fromCodePoint(0x202e)}dm.txt`), 'text\n');
  fs.writeFileSync(path.join(root, 'skills', 'apple', `SKILL${String.fromCodePoint(0x200b)}.md`), 'text\n');
  const report = runGuard(root, { terms: FIXTURE_TERMS });
  assert.deepEqual(summary(report).sort(), [
    'paths skills/apple/.vendor/demo-part/notes<U+202E>dm.txt: name contains a hidden or control character',
    'paths skills/apple/SKILL<U+200B>.md: name contains a hidden or control character',
  ]);
});

test('agent metadata that allows implicit invocation fails the layout rule', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  fs.mkdirSync(vendored(root, 'agents'));
  fs.writeFileSync(vendored(root, 'agents', 'openai.yaml'), 'interface:\n  display_name: "Demo"\n\npolicy:\n  allow_implicit_invocation: true\n');
  fs.writeFileSync(vendored(root, '.gitattributes'), '* text eol=crlf\n');
  assert.deepEqual(summary(runGuard(root, { terms: FIXTURE_TERMS })).sort(), [
    'layout skills/apple/.vendor/demo-part/.gitattributes: nested git metadata changes what git stores; exclude it in vendor/sources.json',
    'layout skills/apple/.vendor/demo-part/agents/openai.yaml: sets allow_implicit_invocation: true, which lets a host start the skill on its own; exclude agents/ in vendor/sources.json',
  ]);
});

test('each folder under skills/ is one skill with its own SKILL.md', (t) => {
  const root = materialize();
  t.after(() => removeTree(root));
  const other = path.join(root, 'skills', 'other');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'SKILL.md'), '---\nname: other\ndescription: A second design skill.\n---\n\n# other\n');
  assert.deepEqual(runGuard(root, { terms: FIXTURE_TERMS }).problems, []);
  fs.writeFileSync(path.join(other, 'SKILL.md'), '---\nname: misnamed\ndescription: Use when: a colon breaks YAML\n---\n');
  fs.mkdirSync(path.join(root, 'skills', 'empty'));
  fs.writeFileSync(path.join(root, 'skills', 'empty', 'notes.md'), 'no skill here\n');
  assert.deepEqual(summary(runGuard(root, { terms: FIXTURE_TERMS })).sort(), [
    'layout skills/empty/SKILL.md: missing',
    'layout skills/other/SKILL.md: frontmatter description: a plain value must not contain ": " or end with ":"; quote it',
    'layout skills/other/SKILL.md: frontmatter name "misnamed" must match its folder other',
  ]);
});

test('in a git checkout the guard checks what git would ship', (t) => {
  const root = materialize();
  const home = tempDir();
  t.after(() => {
    removeTree(root);
    removeTree(home);
  });
  execFileSync('git', ['-C', root, 'init', '--quiet'], { env: isolatedGitEnv(home) });
  fs.writeFileSync(path.join(root, '.gitignore'), 'dist/\n');
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist', 'notes.md'), ['/Us', 'ers/someone/code'].join(''));
  assert.ok(listEntries(root).every((entry) => !entry.path.startsWith('dist')));
  assert.deepEqual(runGuard(root, { terms: FIXTURE_TERMS }).problems, []);
  fs.writeFileSync(path.join(root, 'notes.md'), `built in ${['/Us', 'ers/someone/code'].join('')}\n`);
  assert.deepEqual(summary(runGuard(root, { terms: FIXTURE_TERMS })), ['personal notes.md: contains a home path (line 1)']);
});

test('privateTerms keeps real account and host names and skips generic and project words', () => {
  assert.deepEqual(privateTerms({ env: {}, username: 'runner', hostname: 'Mac.local' }), []);
  assert.deepEqual(privateTerms({ env: { DESIGN_PRO_MAX_PRIVATE_TERMS: 'studio-7, x' }, username: 'jdoe-dev', hostname: 'atelier.lan' }), ['jdoe-dev', 'atelier', 'studio-7']);
  const vocabulary = projectVocabulary([{ id: 'swift-concurrency' }, { id: 'app-store-connect/asc-cli-usage' }], ['apple']);
  assert.deepEqual(privateTerms({ env: {}, username: 'swift', hostname: 'design.local', vocabulary }), []);
  assert.deepEqual(privateTerms({ env: {}, username: 'connect', hostname: 'jdoe-mbp.lan', vocabulary }), ['jdoe-mbp']);
  assert.deepEqual(riskyCounts('plain text'), {});
});

test('the repository passes under project-word account and host names', () => {
  const vocabulary = projectVocabulary([], ['apple']);
  for (const [username, hostname] of [['swift', 'design.local'], ['apple', 'skills.local']]) {
    assert.deepEqual(runGuard(ROOT, { terms: privateTerms({ env: {}, username, hostname, vocabulary }) }).problems, [], `${username}@${hostname}`);
  }
});
