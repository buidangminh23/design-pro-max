import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { loadCases, loadRules } from '../scripts/lib/evidence.mjs';
import { PARTS } from '../scripts/verify.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'web-shells');
const part = (...file) => import(pathToFileURL(path.join(PART, ...file)).href);
const fixture = (...file) => path.join(ROOT, 'fixtures', 'web-shells', ...file);
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'token-budget.json'), 'utf8'));

function collect() {
  const findings = [];
  const add = (level) => (rule, where, measured, expected) => findings.push({ rule, level, where, measured, expected });
  return {
    findings,
    error: add('error'),
    warn: add('warn'),
    pass: add('pass'),
    skip: (rule, where, reason) => findings.push({ rule, level: 'skip', where, measured: reason }),
    check(rule, ok, where, measured, expected, level = 'error') {
      findings.push({ rule, level: ok ? 'pass' : level, where, measured, expected });
    },
  };
}

const levels = (findings, rule) => findings.filter((finding) => finding.rule === rule).map((finding) => finding.level);

test('web-shells has five error rules, each with fixtures and a verify case, and four warnings', () => {
  const own = loadRules(ROOT).filter((rule) => rule.part === 'web-shells');
  assert.deepEqual(own.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['WS-ORIGIN-01', 'WS-ORIGIN-02', 'WS-BUNDLE-01', 'WS-AUTH-01', 'WS-COOKIE-01']);
  assert.deepEqual(own.filter((rule) => rule.level === 'warn').map((rule) => rule.id).sort(), ['WS-WARN-BUNDLED', 'WS-WARN-PUSH', 'WS-WARN-STAGING', 'WS-WARN-THIRDPARTY']);
  const cases = loadCases(ROOT, 'web-shells');
  for (const rule of own.filter((entry) => entry.level === 'warn')) assert.ok(cases.some((entry) => entry.expect === 'warn' && [entry.rule].flat().includes(rule.id)), `${rule.id} has a warn case`);
  assert.ok(PARTS.includes('web-shells'));
});

test('the Capacitor reader takes literal URLs from JSON and TypeScript and flags computed ones', async () => {
  const { capacitorServerUrl } = await part('scripts', 'check-shell.mjs');
  assert.deepEqual(capacitorServerUrl('{"webDir":"dist","server":{"url":" https://app.example.com "}}', 'c.json'), { url: 'https://app.example.com', webDir: 'dist' });
  assert.equal(capacitorServerUrl('{"webDir":"dist"}', 'c.json').url, null);
  assert.equal(capacitorServerUrl(fs.readFileSync(fixture('projects', 'localhost-ts', 'capacitor.config.ts'), 'utf8'), 'c.ts').url, 'http://localhost:5173');
  assert.equal(capacitorServerUrl("const c = { webDir: 'dist', server: { url: process.env.SERVER_URL, cleartext: true } };", 'c.ts').computed, true);
  assert.equal(capacitorServerUrl("const c = { webDir: 'dist', plugins: { Foo: { url: 'x' } } };", 'c.ts').url, null);
  assert.throws(() => capacitorServerUrl('{', 'c.json'), /not valid JSON/);
});

test('the Tauri reader prefers an external window URL, then a URL frontendDist, and ignores devUrl', async () => {
  const { tauriRelease } = await part('scripts', 'check-shell.mjs');
  assert.equal(tauriRelease({ build: { devUrl: 'http://localhost:1420', frontendDist: '../dist' } }).url, null);
  assert.equal(tauriRelease({ build: { frontendDist: 'https://app.example.com/' } }).url, 'https://app.example.com/');
  assert.equal(tauriRelease({ build: { frontendDist: '../dist' }, app: { windows: [{ url: 'index.html' }, { url: 'https://app.example.com' }] } }).url, 'https://app.example.com');
  assert.equal(tauriRelease({ build: { distDir: 'http://10.0.0.5:1420' } }).url, 'http://10.0.0.5:1420');
});

test('hosts a shipping shell must not load, and staging labels', async () => {
  const { unshippableReason, stagingLabel } = await part('scripts', 'check-shell.mjs');
  for (const url of ['http://localhost:5173', 'https://127.0.0.1', 'https://[::1]:8443', 'https://192.168.1.20', 'https://10.1.2.3', 'https://172.20.0.1', 'https://169.254.1.1', 'https://mac.local', 'http://app.example.com']) {
    assert.ok(unshippableReason(url), url);
  }
  for (const url of ['https://app.example.com', 'https://172.32.0.1', 'https://example.com:8443/app']) assert.equal(unshippableReason(url), null, url);
  assert.equal(stagingLabel('https://staging.example.com'), 'staging');
  assert.equal(stagingLabel('https://app-preview.example.com'), 'app-preview');
  assert.equal(stagingLabel('https://app.example.com'), null);
  assert.equal(stagingLabel('https://testimonials.example.com'), null);
});

test('check-shell judges the fixture shells red-first', async () => {
  const { checkShells } = await part('scripts', 'check-shell.mjs');
  const run = (options) => {
    const report = collect();
    checkShells(options, report);
    return report.findings;
  };
  const good = run({ project: fixture('projects', 'remote'), bundle: fixture('bundles', 'current'), expectOrigin: 'https://app.example.com' });
  assert.ok(!good.some((finding) => finding.level === 'error' || finding.level === 'warn'), JSON.stringify(good));
  const stale = run({ project: fixture('projects', 'remote'), bundle: fixture('bundles', 'stale'), expectOrigin: 'https://app.example.com' });
  assert.ok(levels(stale, 'WS-BUNDLE-01').includes('error'));
  assert.ok(levels(stale, 'WS-WARN-STAGING').includes('warn'));
  assert.ok(levels(stale, 'WS-WARN-BUNDLED').includes('warn'));
  assert.ok(levels(run({ project: fixture('projects', 'stale-native') }), 'WS-BUNDLE-01').includes('error'));
  assert.ok(levels(run({ bundle: fixture('bundles', 'bundled-only'), expectOrigin: 'https://app.example.com' }), 'WS-ORIGIN-01').includes('error'));
  assert.deepEqual(levels(run({ bundle: fixture('bundles', 'bundled-only'), expectOrigin: 'bundled' }), 'WS-ORIGIN-01'), ['pass']);
  const localhost = run({ project: fixture('projects', 'localhost-ts') });
  assert.match(localhost.find((finding) => finding.rule === 'WS-ORIGIN-02').measured, /localhost is the device itself/);
  assert.ok(levels(run({ project: fixture('projects', 'tauri-lan') }), 'WS-ORIGIN-02').includes('error'));
  assert.deepEqual(levels(run({ project: fixture('projects', 'tauri-remote'), expectOrigin: 'https://app.example.com' }), 'WS-ORIGIN-01'), ['pass']);
  assert.ok(levels(run({ project: fixture('projects', 'web-push') }), 'WS-WARN-PUSH').includes('warn'));
  assert.deepEqual(levels(run({ project: fixture('projects', 'remote') }), 'WS-WARN-PUSH'), []);
});

test('the probe helpers read challenges, Set-Cookie lines and the other loopback site', async () => {
  const { promptingScheme, cookiesSet, cookieNames, otherSite, parseArgs } = await part('scripts', 'probe-webkit.mjs');
  assert.equal(promptingScheme('Basic realm="x", charset="UTF-8"'), 'Basic');
  assert.equal(promptingScheme('Bearer realm="api", Digest realm="x"'), 'Digest');
  assert.equal(promptingScheme('Bearer error="invalid_token"'), null);
  assert.equal(promptingScheme(undefined), null);
  assert.deepEqual(cookiesSet('session=abc; Path=/; HttpOnly; Secure; SameSite=Lax\ntheme=dark; Path=/\nold=; Max-Age=0'), [{ name: 'session', secure: true, expired: false }, { name: 'theme', secure: false, expired: false }]);
  assert.deepEqual(cookieNames('session=abc; theme=dark'), ['session', 'theme']);
  assert.deepEqual(cookieNames(''), []);
  assert.equal(otherSite('localhost'), '127.0.0.1');
  assert.equal(otherSite('app.example.com'), 'localhost');
  assert.throws(() => parseArgs(['--url', 'https://a.example', '--app', 'x.mjs']), /exactly one of --url or --app/);
  assert.throws(() => parseArgs(['--url', 'https://a.example', '--field', 'user=x']), /--field needs --login/);
  assert.throws(() => parseArgs(['--url', 'https://a.example', '--embed-cross-site']), /needs --login/);
  assert.throws(() => parseArgs(['--url', 'https://a.example', '--login', '/login', '--field', 'novalue']), /name=value/);
  assert.deepEqual(parseArgs(['--url', 'https://a.example/app/', '--login', '/login', '--field', 'password=a=b']).fields, [['password', 'a=b']]);
});

test('the login reference redirects, signs in with a Secure HttpOnly cookie and rejects bad credentials', async (t) => {
  const { createLoginApp, parseCookies } = await part('assets', 'login', 'app.mjs');
  assert.throws(() => createLoginApp({}), /verify/);
  const handle = createLoginApp({ verify: (user, password) => user === 'u' && password === 'p' });
  const server = http.createServer(handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const go = (pathname, init = {}) => fetch(base + pathname, { redirect: 'manual', ...init });
  const first = await go('/app/reports?x=1');
  assert.equal(first.status, 303);
  assert.equal(first.headers.get('location'), `/login?next=${encodeURIComponent('/app/reports?x=1')}`);
  const form = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const wrong = await go('/login', form({ user: 'u', password: 'x', next: '/app/' }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('www-authenticate'), null);
  assert.match(await wrong.text(), /do not match/);
  const right = await go('/login', form({ user: 'u', password: 'p', next: '//evil.example/' }));
  assert.equal(right.status, 303);
  assert.equal(right.headers.get('location'), '/app/');
  const cookie = right.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(attribute), attribute);
  const session = parseCookies(cookie.split(';')[0]).session;
  const signedIn = await go('/app/', { headers: { cookie: `session=${session}` } });
  assert.equal(signedIn.status, 200);
  assert.match(await signedIn.text(), /Signed in as u/);
  const out = await go('/logout', { method: 'POST', headers: { cookie: `session=${session}` } });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await go('/app/', { headers: { cookie: `session=${session}` } })).status, 303);
});

test('the web-shells scripts run from a copy outside the repository and exit 2 for a missing tool or bad usage', (t) => {
  const outside = tempDir('web-shells-');
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'web-shells']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const script = (name) => path.join(outside, 'apple', 'web-shells', 'scripts', name);
  const project = path.join(outside, 'project');
  fs.mkdirSync(project);
  const none = runScript(script('check-shell.mjs'), []);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage: node check-shell\.mjs/);
  const empty = runScript(script('check-shell.mjs'), ['--project', project]);
  assert.equal(empty.status, 2);
  assert.match(empty.stderr, /No Capacitor or Tauri config found/);
  const origin = runScript(script('check-shell.mjs'), ['--project', project, '--expect-origin', 'app.example.com']);
  assert.equal(origin.status, 2);
  const pass = runScript(script('check-shell.mjs'), ['--project', fixture('projects', 'remote'), '--bundle', fixture('bundles', 'current'), '--expect-origin', 'https://app.example.com']);
  assert.equal(pass.status, 0, pass.stdout);
  assert.match(pass.stdout.trim().split('\n').at(-1), /"tool":"check-shell","errors":0/);
  const fail = runScript(script('check-shell.mjs'), ['--project', fixture('projects', 'localhost-ts')]);
  assert.equal(fail.status, 1);
  const noPlaywright = runScript(script('probe-webkit.mjs'), ['--url', 'https://127.0.0.1:9/', '--project', project]);
  assert.equal(noPlaywright.status, 2, noPlaywright.stderr);
  assert.match(noPlaywright.stderr, /Playwright is not installed/);
  const both = runScript(script('probe-webkit.mjs'), ['--url', 'https://127.0.0.1:9/', '--app', script('check-shell.mjs')]);
  assert.equal(both.status, 2);
  assert.match(both.stderr, /exactly one of --url or --app/);
});

test('the web-shells part stays inside its caps', () => {
  const cap = Math.floor(5000 * budget.charsPerToken);
  const text = fs.readFileSync(path.join(PART, 'PART.md'), 'utf8');
  assert.ok(text.length <= cap, `${text.length} characters, cap ${cap}`);
  assert.ok(text.split('\n').length <= 300);
  for (const file of fs.readdirSync(path.join(PART, 'scripts'))) {
    const source = fs.readFileSync(path.join(PART, 'scripts', file), 'utf8');
    assert.ok(!/BEGIN (?:RSA |EC )?PRIVATE KEY/.test(source), `${file} holds no key`);
  }
  for (const entry of fs.readdirSync(PART, { recursive: true })) assert.ok(!/\.(?:pem|key|crt|p12)$/.test(entry), `no key or certificate file: ${entry}`);
});
