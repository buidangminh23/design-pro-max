import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { loadCases, loadRules } from '../scripts/lib/evidence.mjs';
import { PARTS } from '../scripts/verify.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'whats-new');
const checker = () => import(pathToFileURL(path.join(PART, 'scripts', 'check-whats-new.mjs')).href);
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'token-budget.json'), 'utf8'));
const rulesOf = (entry) => [entry.rule].flat();

test('whats-new has seven error rules, each with fixtures and a verify case, and five warnings', async () => {
  const own = loadRules(ROOT).filter((rule) => rule.part === 'whats-new');
  const { ERROR_RULES, WARN_RULES } = await checker();
  assert.deepEqual(own.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['WN-DIALOG-01', 'WN-NAV-01', 'WN-LAYOUT-01', 'WN-MEDIA-01', 'WN-MOTION-01', 'WN-TARGET-01', 'WN-ONCE-01']);
  assert.deepEqual(own.filter((rule) => rule.level === 'warn').map((rule) => rule.id).sort(), ['WN-WARN-AUTOADVANCE', 'WN-WARN-CONTRAST', 'WN-WARN-COUNT', 'WN-WARN-TARGET44', 'WN-WARN-TEXT']);
  assert.deepEqual([...ERROR_RULES], own.filter((rule) => rule.level === 'error').map((rule) => rule.id));
  assert.deepEqual([...WARN_RULES].sort(), own.filter((rule) => rule.level === 'warn').map((rule) => rule.id).sort());
  const cases = loadCases(ROOT, 'whats-new');
  for (const rule of own) {
    assert.equal(rule.check, 'whats-new/scripts/check-whats-new.mjs', rule.id);
    if (rule.level === 'warn') assert.ok(cases.some((entry) => entry.expect === 'warn' && rulesOf(entry).includes(rule.id)), `${rule.id} has a warn case`);
  }
  for (const entry of cases.filter((item) => item.expect !== 'pass')) {
    const only = entry.args[entry.args.indexOf('--only') + 1];
    assert.deepEqual(only.split(','), rulesOf(entry), `${entry.id} runs only its own rule`);
  }
  assert.ok(PARTS.includes('whats-new'));
});

test('the fixture media builder makes every clip and poster the cases name, and the pages ask for them', async () => {
  const { buildWhatsNewMedia } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'fixture-media.mjs')).href);
  const recipes = buildWhatsNewMedia.toString().match(/'(wn-[a-z0-9-]+)':/g).map((key) => key.slice(1, -2));
  for (const entry of loadCases(ROOT, 'whats-new')) {
    for (const [name, recipe] of Object.entries(entry.media ?? {})) {
      assert.ok(recipes.includes(recipe), `${entry.id}: ${recipe}`);
      assert.equal(path.extname(name), recipe.endsWith('-poster') ? '.jpg' : '.mp4', `${entry.id}: ${name}`);
    }
  }
  const helper = fs.readFileSync(path.join(ROOT, 'fixtures', 'whats-new', 'pages', 'fixture.js'), 'utf8');
  for (const name of ['wn-loop.mp4', 'wn-loop.jpg', 'wn-short.mp4', 'wn-short.jpg']) assert.ok(helper.includes(`'${name}'`), name);
});

test('the argument parser serves a lone --page from its folder and rejects bad usage', async () => {
  const { parseArgs, DEFAULT_SELECTORS } = await checker();
  const lone = parseArgs(['--page', path.join('some', 'dir', 'popup.html')]);
  assert.equal(lone.serve, path.resolve('some', 'dir'));
  assert.equal(lone.page, 'popup.html');
  const served = parseArgs(['--serve', 'site', '--viewport', '390x844', '--open', '#show', '--dialog', '.popup', '--only', 'WN-NAV-01,WN-ONCE-01', '--version', '2.4.0']);
  assert.deepEqual(served.viewports, [{ width: 390, height: 844 }]);
  assert.equal(served.page, 'index.html');
  assert.equal(served.selectors.dialog, '.popup');
  assert.equal(served.selectors.next, DEFAULT_SELECTORS.next);
  assert.deepEqual(served.custom, { dialog: true });
  assert.deepEqual(served.only, ['WN-NAV-01', 'WN-ONCE-01']);
  assert.deepEqual(parseArgs(['--url', 'http://127.0.0.1:9/']).viewports, [{ width: 1280, height: 900 }]);
  assert.throws(() => parseArgs([]), /exactly one of --url, --serve or --page/);
  assert.throws(() => parseArgs(['--url', 'http://a/', '--serve', 'site']), /exactly one/);
  assert.throws(() => parseArgs(['--url', 'http://a/', '--page', 'x.html']), /--page goes with --serve/);
  assert.throws(() => parseArgs(['--serve', 'site', '--frobnicate']), /Unknown argument --frobnicate/);
  assert.throws(() => parseArgs(['--serve', 'site', '--open']), /--open needs a value/);
  assert.throws(() => parseArgs(['--serve', 'site', '--viewport', 'wide']), /WIDTHxHEIGHT/);
  assert.throws(() => parseArgs(['--serve', 'site', '--browser', 'firefox']), /chromium or webkit/);
  assert.throws(() => parseArgs(['--serve', 'site', '--only', 'WN-NOPE-01']), /unknown rules: WN-NOPE-01/);
  assert.throws(() => parseArgs(['--serve', 'site', '--server', 'ftp']), /--server must be one of/);
});

test('the size, ratio, position and pause helpers judge the thresholds the rules state', async () => {
  const { sameSize, sameRatio, spread, exposesPosition, showsCounter, rewound, needsPause, targetLevel, LIMITS } = await checker();
  assert.equal(spread([3, 1, 2]), 2);
  assert.ok(sameSize([{ width: 620, height: 658.8 }, { width: 620, height: 659.6 }]));
  assert.ok(!sameSize([{ width: 620, height: 555 }, { width: 620, height: 703 }]));
  assert.ok(!sameSize([]));
  assert.ok(sameRatio([{ width: 556, height: 312.75 }, { width: 1600, height: 900 }]));
  assert.ok(!sameRatio([{ width: 16, height: 9 }, { width: 4, height: 3 }]));
  assert.ok(exposesPosition('1 of 3', 1, 3));
  assert.ok(exposesPosition('Tính năng 2 trên 3', 2, 3));
  assert.ok(exposesPosition('slide | Feature 3 of 12', 3, 12));
  assert.ok(!exposesPosition('13 of 3', 1, 3));
  assert.ok(!exposesPosition("What's new", 1, 3));
  assert.ok(showsCounter('2 / 3', 2, 3));
  assert.ok(showsCounter('Feature 2 of 3', 2, 3));
  assert.ok(!showsCounter('Version 1.1 lets you move 1 file at a time.', 1, 1));
  assert.ok(!showsCounter('1 tap, then 3 steps', 1, 3));
  assert.ok(!showsCounter('2 of 30', 2, 3));
  assert.ok(rewound({ readyState: 4, currentTime: 0 }));
  assert.ok(rewound({ readyState: 0, currentTime: 2 }));
  assert.ok(!rewound({ readyState: 2, currentTime: 1.9 }));
  assert.ok(needsPause({ loop: true, duration: 6 }));
  assert.ok(!needsPause({ loop: true, duration: LIMITS.pauseAfterSeconds }));
  assert.ok(!needsPause({ loop: false, duration: 30 }));
  assert.ok(!needsPause({ loop: true, duration: Number.NaN }));
  assert.equal(targetLevel({ width: 44, height: 44 }), 'ok');
  assert.equal(targetLevel({ width: 24, height: 44 }), 'below44');
  assert.equal(targetLevel({ width: 32, height: 32 }), 'below44');
  assert.equal(targetLevel({ width: 16, height: 16 }), 'small');
  assert.equal(targetLevel({ width: 23.9, height: 44 }), 'small');
  assert.equal(targetLevel(null), 'missing');
});

test('the contrast helpers parse computed colours, composite alpha and measure WCAG ratios', async () => {
  const { parseColor, composite, contrastRatio, largeText } = await checker();
  assert.deepEqual(parseColor('rgb(92, 95, 102)'), { r: 92, g: 95, b: 102, a: 1 });
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseColor('rgb(0 0 0 / 50%)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseColor('color(srgb 1 0 0)'), { r: 255, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('oklch(0.5 0.1 200)'), null);
  const white = { r: 255, g: 255, b: 255, a: 1 };
  assert.equal(Number(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, white).toFixed(1)), 21);
  assert.equal(Number(contrastRatio(parseColor('rgb(92, 95, 102)'), white).toFixed(2)), 6.4);
  assert.ok(contrastRatio(parseColor('rgb(180, 180, 180)'), white) < 4.5);
  const half = composite({ r: 0, g: 0, b: 0, a: 0.5 }, white);
  assert.deepEqual([Math.round(half.r), half.a], [128, 1]);
  assert.ok(largeText(24, 400));
  assert.ok(largeText(19, 700));
  assert.ok(!largeText(19, 600));
  assert.ok(!largeText(15, 700));
});

test('the whats-new checker runs from a copy outside the repository and exits 2 for a missing tool or bad usage', (t) => {
  const outside = tempDir('whats-new-');
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'whats-new']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const script = path.join(outside, 'apple', 'whats-new', 'scripts', 'check-whats-new.mjs');
  const project = path.join(outside, 'project');
  fs.mkdirSync(project);
  const none = runScript(script, []);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage: node check-whats-new\.mjs/);
  const unknown = runScript(script, ['--serve', project, '--nope']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown argument --nope/);
  const missing = runScript(script, ['--serve', path.join(outside, 'missing'), '--project', project]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /does not exist/);
  const noPlaywright = runScript(script, ['--serve', path.join(outside, 'apple', 'whats-new', 'assets'), '--page', 'reference/whats-new-single.html', '--project', project]);
  assert.equal(noPlaywright.status, 2, noPlaywright.stderr);
  assert.match(noPlaywright.stderr, /Playwright is not installed/);
  assert.match(noPlaywright.stderr, /chromium-headless-shell/);
  const webkit = runScript(script, ['--url', 'http://127.0.0.1:9/', '--browser', 'webkit', '--project', project]);
  assert.equal(webkit.status, 2, webkit.stderr);
  assert.match(webkit.stderr, /npx playwright install webkit/);
  assert.doesNotMatch(`${none.stdout}${unknown.stdout}${noPlaywright.stdout}`, /"tool":"check-whats-new"/);
});

test('the whats-new part stays inside its caps and names no local path', () => {
  const cap = Math.floor(5000 * budget.charsPerToken);
  const text = fs.readFileSync(path.join(PART, 'PART.md'), 'utf8');
  assert.ok(text.length <= cap, `${text.length} characters, cap ${cap}`);
  assert.ok(text.split('\n').length <= 300);
  for (const folder of [path.join(PART, 'scripts'), path.join(ROOT, 'fixtures', 'whats-new')]) {
    for (const entry of fs.readdirSync(folder, { recursive: true })) {
      const file = path.join(folder, entry);
      if (!fs.statSync(file).isFile()) continue;
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\/Users\/|\/Volumes\/|research\//, entry);
      assert.ok(!/\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i.test(entry), `no committed media: ${entry}`);
    }
  }
});
