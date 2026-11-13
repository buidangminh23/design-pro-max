import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { TAILWIND_CSS, TOKENS_CSS, buildTailwindTheme, buildTokensCss, contrast, fluidSize, gridUp, ladderSize, loadTokens, restrainedStyles, validateTokens } from '../scripts/lib/tokens.mjs';
import { LIMIT, buildHashes, candidateKeys, collectSets, lintCss, loadHashes, typeKey } from '../scripts/lint-tokens.mjs';
import { expectedProblems } from '../scripts/verify.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const PART = path.join(ROOT, SKILL_DIR, 'launch-page');
const part = (...file) => import(pathToFileURL(path.join(PART, ...file)).href);
const read = (file) => fs.readFileSync(path.join(ROOT, ...file.split('/')), 'utf8');
const tokens = loadTokens(ROOT);

test('the token source keeps its own rules: contrast pairs, the 4px leading grid and the heading floor', () => {
  assert.deepEqual(validateTokens(tokens), []);
  for (const style of restrainedStyles(tokens)) {
    for (const rung of Object.values(style.rungs)) {
      assert.ok(Number.isInteger(rung.leading) && rung.leading % 4 === 0, `${style.name} ${rung.size}/${rung.leading}`);
      assert.ok(Number.isInteger(rung.size), `${style.name} ${rung.size}`);
    }
  }
  assert.deepEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7].map((step) => ladderSize(tokens.typeScale, step)), [13, 16, 20, 25, 31, 39, 49, 61, 76]);
  assert.equal(gridUp(27.5, 4), 28);
  assert.equal(gridUp(24, 4), 24);
  const broken = structuredClone(tokens);
  broken.colors.light.muted = '#9a9a9a';
  assert.ok(validateTokens(broken).some((problem) => problem.startsWith('light muted on bg')));
  assert.throws(() => buildTokensCss(broken), /breaks its own rules/);
  assert.ok(contrast('#15171a', '#ffffff') > 17);
});

test('the generated token files match the source and carry both modes, reduced motion and the language overrides', () => {
  const css = read(TOKENS_CSS);
  assert.equal(css, buildTokensCss(tokens));
  assert.equal(read(TAILWIND_CSS), buildTailwindTheme(tokens));
  assert.match(css, /^:root \{\n  color-scheme: light dark;/m);
  assert.match(css, /:root\[data-launch-mode="expressive"\] \{\n  --type-lede-size: clamp\(/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  :root, :root\[data-launch-mode="expressive"\] \{\n    --duration-control: 0ms;/);
  assert.match(css, /:root\.reduced-motion, :root\[data-launch-mode="expressive"\]\.reduced-motion \{[^}]*--scene-progress: 1;/);
  assert.match(css, /:lang\(ja\), :root\[data-launch-mode="expressive"\]:lang\(ja\) \{[^}]*--type-hero-tracking: 0em;/);
  assert.match(css, /--section-accent: var\(--color-accent\);/);
  assert.doesNotMatch(css, /SF Pro|San Francisco|-apple-system/);
  assert.match(fluidSize(tokens.expressive, [44, 96]), /^clamp\(2\.75rem, .*vw, 6rem\)$/);
  const theme = read(TAILWIND_CSS);
  assert.match(theme, /^@theme \{$/m);
  assert.match(theme, /--text-hero-xl: 76px;/);
  assert.match(theme, /--text-hero-xl--line-height: 84px;/);
});

test('lint-tokens passes the shipped sets and fails a set that copies 3 measured values', () => {
  const hashes = loadHashes(ROOT);
  assert.match(hashes.salt, /^[0-9a-f]{32}$/);
  for (const file of [TOKENS_CSS, TAILWIND_CSS]) {
    for (const result of lintCss(read(file), hashes)) assert.ok(result.ok, `${file} [${result.set}]: ${JSON.stringify(result.matches)}`);
  }
  const copied = lintCss(read('fixtures/launch-page/tokens/copied-values.css'), hashes);
  assert.equal(copied[0].ok, false);
  assert.equal(copied[0].matches.length, LIMIT);
  const shipped = runScript(path.join(ROOT, 'scripts', 'lint-tokens.mjs'), []);
  assert.equal(shipped.status, 0, shipped.stdout + shipped.stderr);
  const failing = runScript(path.join(ROOT, 'scripts', 'lint-tokens.mjs'), [path.join(ROOT, 'fixtures', 'launch-page', 'tokens', 'copied-values.css')]);
  assert.equal(failing.status, 1);
  assert.match(failing.stdout, /FAIL .*copied-values\.css \[base\]: 3 measured value/);
  assert.equal(runScript(path.join(ROOT, 'scripts', 'lint-tokens.mjs'), ['--nope']).status, 2);
});

test('lint-tokens matches within 1 px and 0.001 em, pairs size with tracking and reads modes and media queries', () => {
  const salt = '00000000000000000000000000000000';
  const hashes = buildHashes({ type: [[30, -0.01]], width: [900], nav: [60], radius: [30], breakpoint: [700] }, salt);
  assert.equal(typeKey(30, -0.01), 'type:30:-0.01');
  assert.ok(candidateKeys('type', 29.2, -0.0105).includes('type:30:-0.01'));
  assert.ok(!candidateKeys('type', 28.9, -0.01).includes('type:30:-0.01'));
  assert.ok(!candidateKeys('width', 901.5).includes('width:900'));
  const twoMatches = ':root { --type-x-size: 30px; --type-x-tracking: -0.01em; --nav-height: 60px; --type-y-size: 30px; --type-y-tracking: 0.02em; }';
  assert.equal(lintCss(twoMatches, hashes)[0].ok, true);
  const sizeOnly = ':root { --type-x-size: 30px; --radius-card: 30px; --content-max: 900px; }';
  assert.equal(lintCss(sizeOnly, hashes)[0].matches.length, 2, 'a size without its tracking is not a type match');
  const modes = ':root { --type-h-size: 20px; --type-h-tracking: -0.01em; } :root[data-launch-mode="expressive"] { --type-h-size: clamp(1rem, 2vw, 1.875rem); } @media (min-width: 700px) { :root { --nav-height: 60px; } }';
  const results = lintCss(modes, hashes);
  assert.deepEqual(results.map((result) => result.set), ['base', 'expressive']);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false, 'the expressive clamp ends at 30px with the inherited tracking, plus the breakpoint and the nav height');
  assert.ok(collectSets(modes).breakpoints.includes(700));
});

test('check-page colour maths, copy counts and font patterns', async () => {
  const { parseColor, composite, contrastRatio, suggestColor, isLargeText, wordCount, firstFamily, SF_FONT, APPLE_GLYPHS, toHex } = await part('scripts', 'check-page.mjs');
  assert.deepEqual(parseColor('rgb(135, 135, 135)'), { r: 135, g: 135, b: 135, a: 1 });
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.equal(parseColor('color(srgb 1 0 0 / 50%)').a, 0.5);
  assert.equal(parseColor('nonsense'), null);
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const grey = parseColor('#878787');
  assert.equal(Number(contrastRatio(grey, white).toFixed(2)), 3.59);
  assert.equal(toHex(composite({ r: 0, g: 0, b: 0, a: 0.5 }, white)), '#808080');
  const fix = suggestColor(grey, white, 4.5);
  assert.ok(contrastRatio(parseColor(fix), white) >= 4.5, fix);
  assert.equal(isLargeText(24, 400), true);
  assert.equal(isLargeText(19, 700), true);
  assert.equal(isLargeText(19, 600), false);
  assert.equal(wordCount('  Know where your afternoon went  '), 5);
  assert.equal(wordCount('Plan — ship'), 2);
  assert.equal(firstFamily('"SF Pro Display", system-ui'), 'SF Pro Display');
  for (const name of ['SF Pro Display', 'SF-Pro-Text-Regular.woff2', 'sf-pro-icons', 'SF Symbols', 'San Francisco', 'SFNSText']) assert.match(name, SF_FONT, name);
  for (const name of ['system-ui', 'Inter', 'Noto Sans', 'SFX Sans', 'Roboto Mono']) assert.doesNotMatch(name, SF_FONT, name);
  assert.match('', APPLE_GLYPHS);
});

test('check-page rejects bad usage and exits 2 without Playwright from a copy outside the repository', (t) => {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'launch-page']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const project = path.join(outside, 'project');
  fs.mkdirSync(project);
  const script = path.join(outside, 'apple', 'launch-page', 'scripts', 'check-page.mjs');
  const missing = runScript(script, ['--serve', project, '--project', project]);
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /Playwright is not installed/);
  const both = runScript(script, ['--url', 'http://127.0.0.1:9/', '--serve', project]);
  assert.equal(both.status, 2);
  assert.match(both.stderr, /exactly one of --url or --serve/);
  const rule = runScript(script, ['--serve', project, '--rule', 'LP-NOPE-01']);
  assert.equal(rule.status, 2);
  assert.match(rule.stderr, /Unknown rule LP-NOPE-01/);
  const lint = path.join(outside, 'apple', 'launch-page', 'scripts', 'lint-css.mjs');
  assert.equal(runScript(lint, []).status, 2);
  const bad = path.join(outside, 'bad.css');
  fs.writeFileSync(bad, '@font-face { font-family: "SF Pro Text"; src: url(sf.woff2); }\nbody { font-family: "SF Pro Text", system-ui; }\n.icon::before { content: "\\f8ff"; }\n');
  const failing = runScript(lint, [bad]);
  assert.equal(failing.status, 1, failing.stdout);
  assert.equal(failing.stdout.split('\n').filter((line) => line.includes('"LP-FONT-01","level":"error"')).length, 3);
  const clean = runScript(lint, [path.join(outside, 'apple', 'launch-page', 'assets')]);
  assert.equal(clean.status, 0, clean.stdout);
});

test('lint-css warns on unguarded hidden content, literal sizes, slow controls and removed focus rings', async () => {
  const { lintText } = await part('scripts', 'lint-css.mjs');
  const { createReport } = await import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', 'report.mjs')).href);
  const report = createReport({ tool: 't', write: () => {} });
  lintText('h1 { opacity: 0; } html[data-motion="ok"] [data-reveal]:not([data-revealed]) { opacity: 0; } p { font-size: 15px; line-height: 1.4; } .button:hover { transition: color 500ms; } a:focus { outline: none; } .m { animation: x 9s infinite; }', 'a.css', report);
  const rules = report.findings.filter((finding) => finding.level === 'warn').map((finding) => finding.rule);
  assert.deepEqual(rules.sort(), ['LP-AMB-01', 'LP-BASE-01', 'LP-TYPE-01', 'LP-TYPE-01', 'LP-WARN-CLASS', 'LP-WARN-FOCUS']);
});

test('the libraries decide the intro, stagger reveals and step galleries without a browser', async () => {
  const { decideIntro, lowMemory, prefersReducedMotion, DEFAULTS } = await part('assets', 'lib', 'gate.js');
  assert.ok(DEFAULTS.timeoutMs < 5000, 'the intro timeout stays under the 5 s ceiling with room for the fade');
  assert.deepEqual(decideIntro({ reducedMotion: false }), { play: true, reason: 'first-visit' });
  assert.equal(decideIntro({ reducedMotion: true }).reason, 'reduced-motion');
  assert.equal(decideIntro({ reducedMotion: false, scrollY: 300 }).reason, 'loaded-scrolled');
  assert.equal(decideIntro({ reducedMotion: false, hash: '#pricing' }).reason, 'loaded-at-anchor');
  assert.equal(decideIntro({ reducedMotion: false, hash: '#' }).play, true);
  assert.equal(decideIntro({ reducedMotion: false, seen: true }).reason, 'seen-this-session');
  assert.equal(decideIntro({ reducedMotion: false, hasIntro: false }).play, false);
  assert.equal(lowMemory({ deviceMemory: 2 }), true);
  assert.equal(lowMemory({ deviceMemory: 8, connection: { saveData: true } }), true);
  assert.equal(lowMemory({ deviceMemory: 8 }), false);
  assert.equal(prefersReducedMotion(undefined), true);
  const { staggerIndex } = await part('assets', 'lib', 'reveal.js');
  assert.deepEqual([0, 3, 12, -1].map((index) => staggerIndex(index)), [0, 3, 6, 0]);
  const { nextIndex, slideDuration } = await part('assets', 'lib', 'gallery.js');
  assert.deepEqual([nextIndex(2, 3), nextIndex(0, 3, -1), nextIndex(0, 0)], [0, 2, 0]);
  assert.equal(slideDuration({ dataset: { duration: '7000' } }), 7000);
  assert.equal(slideDuration({ dataset: {} }), 6000);
});

test('the planted-defect page lists 12 defects whose rules exist or belong to a part built elsewhere', () => {
  const expected = JSON.parse(read('fixtures/launch-page/pages/broken-launch.expected.json'));
  assert.equal(expected.defects.length, 12);
  const rules = new Set(JSON.parse(read('rules.json')).rules.map((rule) => rule.id));
  for (const defect of expected.defects) assert.ok(rules.has(defect.rule) || defect.part === 'launch-video', defect.rule);
  const page = read('fixtures/launch-page/pages/broken-launch.html');
  assert.match(page, /https:\/\/fonts\.invalid\//);
  assert.doesNotMatch(page, /https?:\/\/(?!fonts\.invalid)[^\s"')]+/, 'no request leaves the test machine except to the unresolvable fonts.invalid');
  const cases = JSON.parse(read('fixtures/launch-page/cases.json')).cases.filter((entry) => entry.expected);
  for (const checker of ['check-page', 'probe-scene']) {
    const covered = cases.find((entry) => entry.checker === checker);
    const listed = expected.defects.filter((defect) => defect.checker === checker && !defect.part).map((defect) => defect.rule).sort();
    assert.deepEqual([...covered.rule].sort(), listed, checker);
  }
});

test('verify compares a planted page with its committed findings', () => {
  const entry = { part: 'launch-page', checker: 'check-page', rule: ['LP-FONT-01', 'LP-AMB-01', 'LP-INTRO-01', 'LP-CONTRAST-01'], expected: 'pages/broken-launch.expected.json' };
  const error = (rule, where, measured = '') => ({ rule, level: 'error', where, measured });
  const all = [
    error('LP-FONT-01', 'requested https://fonts.invalid/fonts/sf-pro-text.css'),
    error('LP-AMB-01', 'section "Names that never stop"'),
    error('LP-INTRO-01', '1280x800, film blocked'),
    error('LP-CONTRAST-01', 'p.fine-print', '3.59:1 for #878787 on #ffffff'),
  ];
  assert.deepEqual(expectedProblems(entry, all).problems, []);
  assert.match(expectedProblems(entry, all.slice(1)).problems[0], /planted defect not found: LP-FONT-01/);
  assert.match(expectedProblems(entry, [...all, error('LP-TYPE-01', 'p')]).problems[0], /unplanned error: LP-TYPE-01/);
});

test('verify runs the planted defects of a shipped part with that part\'s checker, and only those of the case\'s rules', (t) => {
  const error = (rule, where, measured = '') => ({ rule, level: 'error', where, measured });
  const embed = { part: 'launch-page', checker: 'check-embed', rule: ['LV-EMBED-01'], expected: 'pages/broken-launch.expected.json' };
  const embedFindings = [error('LV-EMBED-01', 'clip 4: autoplay attribute', 'present'), error('LV-EMBED-01', 'clip 5: poster attribute', 'poster.jpg'), error('LV-EMBED-02', 'clip 4: pause control', 'none for a looping clip')];
  const result = expectedProblems(embed, embedFindings);
  assert.deepEqual(result, { problems: [], notRun: [] });
  assert.match(expectedProblems(embed, embedFindings.slice(0, 2)).problems[0], /consequence not found: LV-EMBED-02/);
  assert.match(expectedProblems(embed, embedFindings.slice(1)).problems[0], /planted defect not found: LV-EMBED-01 \(an autoplay attribute/);
  assert.match(expectedProblems(embed, [...embedFindings, error('LV-ENC-03', 'x')]).problems[0], /unplanned error: LV-ENC-03/);

  const aac = { part: 'launch-page', checker: 'check-media', rule: ['LV-ENC-02'], expected: 'pages/broken-launch.expected.json' };
  assert.deepEqual(expectedProblems(aac, [error('LV-ENC-02', 'clip-aac.mp4: audio', '1 audio stream(s)')]).problems, []);
  assert.match(expectedProblems(aac, [error('LV-ENC-02', 'clip-hevc.mp4: audio')]).problems[0], /planted defect not found: LV-ENC-02/);
  assert.match(expectedProblems(aac, [error('LV-ENC-02', 'clip-aac.mp4: audio'), error('LV-ENC-01', 'sources')]).problems[0], /unplanned error: LV-ENC-01/);

  const root = tempDir();
  t.after(() => removeTree(root));
  fs.mkdirSync(path.join(root, 'fixtures', 'launch-page', 'pages'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'fixtures', 'launch-page', 'pages', 'broken-launch.expected.json'), path.join(root, 'fixtures', 'launch-page', 'pages', 'broken-launch.expected.json'));
  const absent = expectedProblems(embed, [], root);
  assert.deepEqual(absent.problems, []);
  assert.deepEqual(absent.notRun, ['LV-EMBED-01 (check-embed)', 'LV-EMBED-01 (check-embed)', 'LV-ENC-02 (check-media)', 'LV-ENC-01 (check-media)']);
});
