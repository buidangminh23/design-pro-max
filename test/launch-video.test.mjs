import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadRules } from '../scripts/lib/evidence.mjs';
import { SKILL_DIR } from '../scripts/lib/vendor.mjs';
import { ROOT, removeTree, runScript, tempDir } from './helpers.mjs';

const part = (...file) => import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'launch-video', ...file)).href);
const shared = (file) => import(pathToFileURL(path.join(ROOT, SKILL_DIR, 'shared', file)).href);

const collect = async () => {
  const { createReport } = await shared('report.mjs');
  const lines = [];
  return { report: createReport({ tool: 't', write: (line) => lines.push(line) }), lines };
};
const levels = (report, rule) => report.findings.filter((finding) => finding.rule === rule).map((finding) => finding.level);

test('launch-video has the nine error rules of the plan, each with fixtures, and the warnings', () => {
  const own = loadRules(ROOT).filter((rule) => rule.part === 'launch-video');
  assert.deepEqual(own.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['LV-ENC-01', 'LV-ENC-02', 'LV-ENC-03', 'LV-POSTER-01', 'LV-EMBED-01', 'LV-EMBED-02', 'LV-RENDER-01', 'LV-APP-01', 'LV-CAP-01']);
  assert.deepEqual(own.filter((rule) => rule.level === 'warn').map((rule) => rule.id), ['LV-WARN-DIRECTION', 'LV-WARN-BUDGET', 'LV-WARN-DENSITY', 'LV-WARN-FPS', 'LV-WARN-AV1', 'LV-WARN-SEAM', 'LV-WARN-ALPHA', 'LV-WARN-PLAYBACK', 'LV-WARN-BITRATE', 'LV-WARN-FOOTAGE', 'LV-WARN-REGION', 'LV-WARN-CAPTURE']);
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'launch-video', 'cases.json'), 'utf8')).cases;
  for (const recipe of ['lv-yuvj', 'lv-444', 'lv-aac', 'lv-untagged', 'lv-moov-end']) {
    assert.ok(cases.some((entry) => entry.expect === 'fail' && entry.files?.includes(recipe)), `bad recipe ${recipe} is a fail case`);
  }
});

const video = (overrides = {}) => ({ codec: 'h264', profile: 'High', pixFmt: 'yuv420p', colorRange: 'tv', colorPrimaries: 'bt709', colorTransfer: 'iec61966-2-1', colorSpace: 'bt709', fps: 30, width: 640, height: 360, alpha: false, ...overrides });
const info = (overrides = {}, videoOverrides = {}) => ({ file: 'clip.mp4', audioStreams: 0, mp4: { moovFirst: true, order: ['ftyp', 'moov', 'mdat'] }, ...overrides, video: video(videoOverrides) });

test('the demo profile fails each bad encode recipe on its own rule only', async () => {
  const { checkDemoFile, checkDemoSet, isBaselineH264 } = await shared('check-media.mjs');
  const cases = [
    ['good', info(), null],
    ['yuvj420p', info({}, { pixFmt: 'yuvj420p', colorRange: 'pc' }), 'LV-ENC-01'],
    ['4:4:4', info({}, { pixFmt: 'yuv444p', profile: 'High 4:4:4 Predictive' }), 'LV-ENC-01'],
    ['moov at the end', info({ mp4: { moovFirst: false, order: ['ftyp', 'mdat', 'moov'] } }), 'LV-ENC-01'],
    ['AAC in a muted clip', info({ audioStreams: 1 }), 'LV-ENC-02'],
    ['untagged', info({}, { colorPrimaries: null, colorTransfer: null, colorSpace: null }), 'LV-ENC-03'],
  ];
  for (const [label, file, failing] of cases) {
    const { report } = await collect();
    checkDemoFile(file, report);
    checkDemoSet([file], report);
    for (const rule of ['LV-ENC-01', 'LV-ENC-02', 'LV-ENC-03']) {
      const expected = rule === failing ? 'error' : 'pass';
      assert.ok(levels(report, rule).includes(expected), `${label}: ${rule} ${expected}`);
      if (rule !== failing) assert.ok(!levels(report, rule).includes('error'), `${label}: ${rule} has no error`);
    }
  }
  assert.equal(isBaselineH264(info()), true);
  const vp9 = info({ file: 'clip.webm', mp4: null }, { codec: 'vp9', profile: 'Profile 0' });
  const { report } = await collect();
  checkDemoSet([vp9], report);
  assert.deepEqual(levels(report, 'LV-ENC-01'), ['error'], 'a set without H.264 fails');
});

test('the demo profile warns about VP9 alpha without HEVC alpha, frame rate and unknown slots', async () => {
  const { checkDemoFile, checkDemoSet, slotBudget, SLOT_BUDGETS } = await shared('check-media.mjs');
  const { UsageError } = await shared('report.mjs');
  const alphaWebm = info({ file: 'clip.alpha.webm', mp4: null }, { codec: 'vp9', alpha: true });
  let run = await collect();
  checkDemoSet([alphaWebm, info()], run.report);
  assert.deepEqual(levels(run.report, 'LV-WARN-ALPHA'), ['warn']);
  run = await collect();
  checkDemoSet([info({ file: 'clip.alpha.mov' }, { codec: 'hevc' }), alphaWebm, info()], run.report);
  assert.deepEqual(levels(run.report, 'LV-WARN-ALPHA'), ['pass']);
  run = await collect();
  checkDemoFile(info({}, { fps: 60 }), run.report);
  assert.deepEqual(levels(run.report, 'LV-WARN-FPS'), ['warn']);
  assert.equal(slotBudget('tile'), 120 * 1024);
  assert.equal(slotBudget('hero@2x'), 1024 * 1024);
  assert.ok(Object.values(SLOT_BUDGETS).every((bytes) => bytes > 0));
  assert.throws(() => slotBudget('banner'), UsageError);
});

test('the encoder writes H.264 High, yuv420p, faststart, no audio and setparams colour tags, and the alpha pair', async () => {
  const { parseArgs, plan, encodeJobs, ffmpegFailure, SOURCE_ROLES } = await part('scripts', 'encode.mjs');
  const { SandboxError, UsageError } = await shared('report.mjs');
  const master = { input: ['-i', 'master.mov'], fps: 30, alpha: false, width: 640, height: 360 };
  const options = parseArgs(['master.mov', '--out', 'out', '--profiles', 'h264,vp9,av1', '--threads', '2']);
  const outputs = plan(options);
  assert.deepEqual(SOURCE_ROLES.filter((role) => outputs[role]).map((role) => path.basename(outputs[role])), ['clip.av1.webm', 'clip.webm', 'clip.mp4']);
  const jobs = encodeJobs(options, outputs, master);
  const h264 = jobs.find((job) => job.role === 'h264').args.join(' ');
  for (const part of ['-an', '-c:v libx264', '-profile:v high', '-pix_fmt yuv420p', '-movflags +faststart', 'setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709', 'out_range=tv', '-threads 2']) assert.ok(h264.includes(part), part);
  assert.ok(jobs.every((job) => !job.args.includes('-c:a')), 'no job encodes audio');
  const alpha = parseArgs(['frames', '--out', 'out', '--alpha']);
  const alphaJobs = encodeJobs(alpha, plan(alpha), { ...master, alpha: true });
  const hevc = alphaJobs.find((job) => job.role === 'hevcAlpha').args.join(' ');
  assert.ok(hevc.includes('hevc_videotoolbox') && hevc.includes('-tag:v hvc1') && hevc.includes('format=bgra'));
  assert.ok(alphaJobs.find((job) => job.role === 'vp9Alpha').args.join(' ').includes('yuva420p'));
  assert.ok(alphaJobs.find((job) => job.role === 'h264').args.join(' ').includes('overlay'), 'the H.264 file is flattened');
  assert.deepEqual(SOURCE_ROLES.filter((role) => plan(alpha)[role]), ['hevcAlpha', 'vp9Alpha', 'h264']);
  assert.ok(ffmpegFailure('Cannot create compression session: -12908', 'cmd') instanceof SandboxError);
  assert.ok(ffmpegFailure('Unknown encoder', 'cmd') instanceof UsageError);
  assert.throws(() => parseArgs(['m', '--out', 'o', '--profiles', 'vp9']), /h264 profile/);
  assert.throws(() => parseArgs(['m', '--out', 'o', '--alpha', '--profiles', 'h264']), /--alpha/);
  assert.throws(() => parseArgs(['m', '--out', 'o', '--width', '641']), /even/);
});

const png = (width, height) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};

test('the frame check wants duration x fps frames at twice the slot', async (t) => {
  const { checkFrameFolder, expectedFrames, frameName, pngSize, insideTmp } = await part('scripts', 'render-frames.mjs');
  assert.equal(expectedFrames(2, 30), 60);
  assert.equal(expectedFrames(6, 30), 180);
  assert.deepEqual(pngSize(png(800, 450)), { width: 800, height: 450 });
  assert.equal(pngSize(Buffer.from('not a png at all, really not')), null);
  const folder = tempDir('launch-video-frames-');
  t.after(() => removeTree(folder));
  const write = (count, width, height) => {
    for (const name of fs.readdirSync(folder)) fs.rmSync(path.join(folder, name));
    for (let index = 0; index < count; index += 1) fs.writeFileSync(path.join(folder, frameName(index)), png(width, height));
  };
  const judge = async () => {
    const { report } = await collect();
    checkFrameFolder(folder, { slot: { width: 400, height: 225 }, fps: 30, duration: 2 }, report);
    return levels(report, 'LV-RENDER-01');
  };
  write(60, 800, 450);
  assert.ok(!(await judge()).includes('error'), 'a true 2x render passes');
  write(50, 800, 450);
  assert.ok((await judge()).includes('error'), 'a recording at 25 fps has too few frames');
  write(60, 400, 225);
  assert.ok((await judge()).includes('error'), 'CSS-pixel frames fail');
  assert.equal(insideTmp(path.join(folder, 'nested', 'frames')), true);
  assert.equal(insideTmp(ROOT), false);
});

test('the embed component asks for a pause control on loops and long clips and plays the most visible clip', async () => {
  const { needsPauseControl, pickActive, prefersReducedMotion, saveData } = await part('assets', 'lib', 'demo-embed.js');
  assert.equal(needsPauseControl({ loop: true, duration: 2 }), true);
  assert.equal(needsPauseControl({ loop: false, duration: 4.9 }), false);
  assert.equal(needsPauseControl({ loop: false, duration: 6 }), true);
  assert.deepEqual(pickActive([{ id: 0, ratio: 0.6 }, { id: 1, ratio: 0.9 }, { id: 2, ratio: 0.4 }]), [1]);
  assert.deepEqual(pickActive([{ id: 0, ratio: 1, held: true }, { id: 1, ratio: 0.5 }]), [1]);
  assert.deepEqual(pickActive([{ id: 0, ratio: 0.8 }, { id: 1, ratio: 0.7 }], { maxActive: 2 }), [0, 1]);
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(saveData({ connection: { saveData: true } }), true);
  assert.equal(saveData({}), false);
  const { needsPause, sourceKind } = await part('scripts', 'check-embed.mjs');
  assert.equal(needsPause({ loop: true, duration: 2 }), true);
  assert.equal(needsPause({ loop: false, duration: 2 }), false);
  assert.deepEqual(['clip.av1.webm', 'clip.webm', 'clip.alpha.mov', 'clip.mp4'].map((url) => sourceKind({ url })), ['av1', 'vp9', 'hevc', 'h264']);
  assert.equal(sourceKind({ type: 'video/mp4; codecs="av01.0.05M.08"', url: 'x.mp4' }), 'av1');
});

test('the launch-video scripts run from a copy outside the repository and exit 2 for a missing tool or bad usage', (t) => {
  const outside = tempDir();
  t.after(() => removeTree(outside));
  for (const folder of ['shared', 'launch-video']) fs.cpSync(path.join(ROOT, SKILL_DIR, folder), path.join(outside, 'apple', folder), { recursive: true });
  const project = path.join(outside, 'project');
  fs.mkdirSync(project);
  const script = (name) => path.join(outside, 'apple', 'launch-video', 'scripts', name);
  for (const [name, args] of [['render-frames.mjs', ['--serve', project, '--slot', '320x180', '--duration', '1', '--project', project]], ['check-embed.mjs', ['--serve', project, '--project', project]]]) {
    const result = runScript(script(name), args);
    assert.equal(result.status, 2, `${name}: ${result.stderr}`);
    assert.match(result.stderr, /Playwright is not installed/);
  }
  const encode = runScript(script('encode.mjs'), ['missing.mov', '--out', path.join(outside, 'out')]);
  assert.equal(encode.status, 2);
  assert.match(encode.stderr, /missing\.mov does not exist/);
  const out = runScript(script('render-frames.mjs'), ['--serve', project, '--slot', '320x180', '--duration', '1', '--out', ROOT, '--project', project]);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /outside \$TMPDIR/);
  const usage = runScript(script('render-frames.mjs'), ['--serve', project]);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--slot and --duration/);
  const media = runScript(path.join(outside, 'apple', 'shared', 'check-media.mjs'), ['--poster', 'a.jpg', 'clip.mp4']);
  assert.equal(media.status, 2);
  assert.match(media.stderr, /need --profile demo/);
});

test('the alpha pair warning reads the source order, not only the codecs present', async () => {
  const { checkDemoSet } = await shared('check-media.mjs');
  const hevc = info({ file: 'clip.alpha.mov' }, { codec: 'hevc' });
  const alphaWebm = info({ file: 'clip.alpha.webm', mp4: null }, { codec: 'vp9', alpha: true });
  const run = await collect();
  checkDemoSet([alphaWebm, hevc, info()], run.report);
  assert.deepEqual(levels(run.report, 'LV-WARN-ALPHA'), ['warn'], 'HEVC listed after VP9 alpha');
});

test('check-embed tries the toggle and pause-named controls first, and wants H.264 last', async () => {
  const { orderControls, sourceOrder, DEMO_SELECTOR, FALLBACK_SELECTOR } = await part('scripts', 'check-embed.mjs');
  const order = orderControls([{ id: 'a', name: 'Share' }, { id: 'b', name: 'Stop the demo' }, { id: 'c', name: 'Pause', toggle: true }]);
  assert.deepEqual(order.map((control) => control.id), ['c', 'b', 'a']);
  assert.deepEqual(sourceOrder(['av1', 'vp9', 'h264']), { h264Last: true, av1First: true });
  assert.equal(sourceOrder(['h264', 'vp9']).h264Last, false, 'H.264 present but not last');
  assert.equal(sourceOrder(['vp9', 'av1', 'h264']).av1First, false);
  assert.equal(sourceOrder(['hevc', 'av1', 'h264']).av1First, true);
  assert.equal(DEMO_SELECTOR, '[data-demo] video');
  assert.match(FALLBACK_SELECTOR, /data-scrub/);
  assert.match(FALLBACK_SELECTOR, /data-scene/);
});

test('the demo toggle keeps an icon and switches its aria-label', async () => {
  const { setLabel } = await part('assets', 'lib', 'demo-embed.js');
  const button = (attributes, childNodes = []) => ({
    attributes: { ...attributes },
    children: childNodes.filter((node) => node.nodeType === 1),
    childNodes,
    set textContent(value) { this.childNodes = [{ nodeType: 3, data: value }]; },
    get textContent() { return this.childNodes.map((node) => node.data ?? '').join(''); },
    hasAttribute(name) { return name in this.attributes; },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const icon = { nodeType: 1 };
  const iconOnly = button({ 'aria-label': 'Pause' }, [icon]);
  setLabel(iconOnly, 'Play');
  assert.equal(iconOnly.attributes['aria-label'], 'Play');
  assert.deepEqual(iconOnly.childNodes, [icon]);
  const text = { nodeType: 3, data: 'Pause' };
  const mixed = button({}, [icon, text]);
  setLabel(mixed, 'Play');
  assert.equal(text.data, 'Play');
  assert.deepEqual(mixed.childNodes, [icon, text]);
  const plain = button({}, [{ nodeType: 3, data: 'Pause' }]);
  setLabel(plain, 'Play');
  assert.equal(plain.textContent, 'Play');
});

test('encode replaces only the files its manifest lists', async () => {
  const { foreignFiles, GENERATOR } = await part('scripts', 'encode.mjs');
  const manifest = { generator: GENERATOR, files: ['clip.mp4', 'clip.start.jpg', 'clip.encode.json'] };
  const existing = ['/out/clip.mp4', '/out/clip.webm', '/out/clip.encode.json'];
  assert.deepEqual(foreignFiles(existing, manifest, '/out/clip.encode.json'), ['/out/clip.webm']);
  assert.deepEqual(foreignFiles(existing, null, '/out/clip.encode.json'), existing);
  assert.deepEqual(foreignFiles(existing, { generator: 'other', files: ['clip.webm'] }, '/out/clip.encode.json'), existing);
});

test('render.json marks an unfinished render', async () => {
  const { renderManifest, GENERATOR: RENDERER } = await part('scripts', 'render-frames.mjs');
  const options = { serve: 'site', page: 'ui-mock.html', slot: { width: 400, height: 225 }, fps: 30, duration: 2, alpha: false, selector: null };
  assert.deepEqual([renderManifest(options, false).complete, renderManifest(options, true).complete], [false, true]);
  assert.equal(renderManifest(options, false).generator, RENDERER);
  assert.equal(renderManifest(options, false).frames, 60);
});

test('a server that may not listen is a sandbox block, and the rerun command is the real one', async () => {
  const { sandboxReason, currentCommand, rethrowSandbox } = await shared('sandbox.mjs');
  const { SandboxError } = await shared('report.mjs');
  assert.match(sandboxReason('listen EPERM: operation not permitted 127.0.0.1'), /may not listen/);
  assert.match(sandboxReason('listen EACCES: permission denied 127.0.0.1:80'), /may not listen/);
  assert.equal(sandboxReason('listen EADDRINUSE: address already in use'), null);
  assert.equal(currentCommand(['node', '/a b/check-embed.mjs', '--selector', '#clips video', '--viewport', '1280x800']), "node '/a b/check-embed.mjs' --selector '#clips video' --viewport 1280x800");
  assert.throws(() => rethrowSandbox(new Error('listen EPERM: operation not permitted 127.0.0.1'), 'node x.mjs'), (error) => error instanceof SandboxError && error.command === 'node x.mjs');
});

test('the playback guidance cites LV-WARN-PLAYBACK, and the Save-Data hold is a component choice that cites only PV-24', () => {
  const doc = (...file) => fs.readFileSync(path.join(ROOT, SKILL_DIR, 'launch-video', ...file), 'utf8').split('\n');
  const guidance = [...doc('PART.md'), ...doc('references', 'embed-component.md')];
  const saveData = guidance.filter((line) => line.includes('Save-Data') && !line.includes('check-embed'));
  assert.ok(saveData.length >= 3, 'found the Save-Data guidance');
  for (const line of saveData) {
    assert.match(line, /\(PV-24\)/, line);
    assert.doesNotMatch(line, /\[LV-WARN-PLAYBACK\]|\[LV-EMBED-02\]/, line);
  }
  const halfVisible = guidance.filter((line) => /half (?:of it )?(?:is )?visib/.test(line));
  assert.ok(halfVisible.length >= 3, 'found the half-visible guidance in PART.md, the component item and the checker description');
  for (const line of halfVisible) assert.match(line, /\[LV-WARN-PLAYBACK\]/, line);
});
