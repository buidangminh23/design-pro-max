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

test('launch-video has the seven error rules of the plan, each with fixtures, and the warnings', () => {
  const own = loadRules(ROOT).filter((rule) => rule.part === 'launch-video');
  assert.deepEqual(own.filter((rule) => rule.level === 'error').map((rule) => rule.id), ['LV-ENC-01', 'LV-ENC-02', 'LV-ENC-03', 'LV-POSTER-01', 'LV-EMBED-01', 'LV-EMBED-02', 'LV-RENDER-01']);
  assert.deepEqual(own.filter((rule) => rule.level === 'warn').map((rule) => rule.id), ['LV-WARN-DIRECTION', 'LV-WARN-BUDGET', 'LV-WARN-DENSITY', 'LV-WARN-FPS', 'LV-WARN-AV1', 'LV-WARN-SEAM', 'LV-WARN-ALPHA']);
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
