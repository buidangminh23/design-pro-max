/**
 * A small ISO base media (MP4, MOV) box walker: top-level box order, the video track's codec and sync samples, and
 * the NAL unit type of every sync sample, which tells an IDR frame (a closed GOP starts there) from an open-GOP
 * recovery point. It reads the file into memory, which suits scrub films of a few megabytes.
 */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex']);
const H264_TYPES = new Set(['avc1', 'avc3']);
const HEVC_TYPES = new Set(['hvc1', 'hev1']);
const VISUAL_ENTRY_HEADER = 78;

export function readBoxes(buffer, start = 0, end = buffer.length) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) {
      boxes.push({ type, start: offset, size, header, truncated: true });
      break;
    }
    boxes.push({ type, start: offset, size, header, body: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function child(buffer, box, type) {
  return readBoxes(buffer, box.body, box.end).find((entry) => entry.type === type) ?? null;
}

function path(buffer, box, types) {
  return types.reduce((current, type) => (current ? child(buffer, current, type) : null), box);
}

function handlerType(buffer, trak) {
  const hdlr = path(buffer, trak, ['mdia', 'hdlr']);
  return hdlr ? buffer.toString('latin1', hdlr.body + 8, hdlr.body + 12) : null;
}

function sampleEntry(buffer, stbl) {
  const stsd = child(buffer, stbl, 'stsd');
  if (!stsd) return null;
  const entries = readBoxes(buffer, stsd.body + 8, stsd.end);
  const entry = entries[0];
  if (!entry) return null;
  const configs = readBoxes(buffer, entry.body + VISUAL_ENTRY_HEADER, entry.end);
  const config = configs.find((box) => box.type === 'avcC' || box.type === 'hvcC');
  let lengthSize = 4;
  if (config?.type === 'avcC') lengthSize = (buffer[config.body + 4] & 3) + 1;
  if (config?.type === 'hvcC') lengthSize = (buffer[config.body + 21] & 3) + 1;
  return {
    format: entry.type,
    width: buffer.readUInt16BE(entry.body + 24),
    height: buffer.readUInt16BE(entry.body + 26),
    config: config?.type ?? null,
    lengthSize,
    boxes: configs.map((box) => box.type),
  };
}

function u32Table(buffer, box, skip, width) {
  if (!box) return null;
  const count = buffer.readUInt32BE(box.body + skip);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const at = box.body + skip + 4 + index * width;
    if (at + width > box.end) break;
    values.push(width === 8 ? Number(buffer.readBigUInt64BE(at)) : buffer.readUInt32BE(at));
  }
  return values;
}

function sampleSizes(buffer, stbl) {
  const stsz = child(buffer, stbl, 'stsz');
  if (!stsz) return null;
  const fixed = buffer.readUInt32BE(stsz.body + 4);
  const count = buffer.readUInt32BE(stsz.body + 8);
  if (fixed) return Array.from({ length: count }, () => fixed);
  const sizes = [];
  for (let index = 0; index < count; index += 1) sizes.push(buffer.readUInt32BE(stsz.body + 12 + index * 4));
  return sizes;
}

function sampleToChunk(buffer, stbl) {
  const stsc = child(buffer, stbl, 'stsc');
  if (!stsc) return [];
  const count = buffer.readUInt32BE(stsc.body + 4);
  const runs = [];
  for (let index = 0; index < count; index += 1) {
    const at = stsc.body + 8 + index * 12;
    runs.push({ firstChunk: buffer.readUInt32BE(at), samplesPerChunk: buffer.readUInt32BE(at + 4) });
  }
  return runs;
}

/** Byte offset of every sample, from the chunk offsets, the sample-to-chunk runs and the sample sizes. */
export function sampleOffsets(chunkOffsets, runs, sizes) {
  const offsets = [];
  let sample = 0;
  for (let chunk = 1; chunk <= chunkOffsets.length && sample < sizes.length; chunk += 1) {
    const run = [...runs].reverse().find((entry) => entry.firstChunk <= chunk);
    let offset = chunkOffsets[chunk - 1];
    for (let index = 0; index < (run?.samplesPerChunk ?? 0) && sample < sizes.length; index += 1) {
      offsets.push(offset);
      offset += sizes[sample];
      sample += 1;
    }
  }
  return offsets;
}

const H264_VCL = (type) => type >= 1 && type <= 5;
const HEVC_VCL = (type) => type >= 0 && type <= 31;

/** NAL unit types of one length-prefixed sample, in order. */
export function nalTypes(buffer, offset, size, lengthSize, hevc) {
  const types = [];
  let at = offset;
  const end = offset + size;
  while (at + lengthSize < end) {
    let length = 0;
    for (let index = 0; index < lengthSize; index += 1) length = length * 256 + buffer[at + index];
    const header = buffer[at + lengthSize];
    if (header === undefined || length === 0) break;
    types.push(hevc ? (header >> 1) & 0x3f : header & 0x1f);
    at += lengthSize + length;
  }
  return types;
}

/** Classifies a sync sample: idr starts a closed GOP, recovery and cra are open-GOP keyframes. */
export function keyframeKind(types, hevc) {
  const vcl = types.find(hevc ? HEVC_VCL : H264_VCL);
  if (vcl === undefined) return 'unknown';
  if (hevc) {
    if (vcl === 19 || vcl === 20) return 'idr';
    if (vcl === 21) return 'cra';
    if (vcl >= 16 && vcl <= 18) return 'bla';
    return 'non-irap';
  }
  return vcl === 5 ? 'idr' : 'recovery';
}

export function inspectMp4(buffer) {
  const top = readBoxes(buffer);
  const order = top.map((box) => box.type);
  const moovIndex = order.indexOf('moov');
  const mdatIndex = order.indexOf('mdat');
  const result = {
    order,
    moovFirst: moovIndex >= 0 && (mdatIndex < 0 || moovIndex < mdatIndex),
    fragmented: order.includes('moof'),
    tracks: [],
    video: null,
  };
  const moov = top[moovIndex];
  if (!moov || moov.truncated) return result;
  for (const trak of readBoxes(buffer, moov.body, moov.end).filter((box) => box.type === 'trak')) {
    const handler = handlerType(buffer, trak);
    result.tracks.push(handler);
    if (handler !== 'vide' || result.video) continue;
    const stbl = path(buffer, trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;
    const entry = sampleEntry(buffer, stbl);
    const sizes = sampleSizes(buffer, stbl) ?? [];
    const stss = u32Table(buffer, child(buffer, stbl, 'stss'), 4, 4);
    const chunkOffsets = u32Table(buffer, child(buffer, stbl, 'stco'), 4, 4) ?? u32Table(buffer, child(buffer, stbl, 'co64'), 4, 8) ?? [];
    const syncSamples = stss ?? sizes.map((_, index) => index + 1);
    const hevc = HEVC_TYPES.has(entry?.format);
    const nal = H264_TYPES.has(entry?.format) || hevc;
    const offsets = nal ? sampleOffsets(chunkOffsets, sampleToChunk(buffer, stbl), sizes) : [];
    const keyframes = syncSamples.map((number) => {
      const offset = offsets[number - 1];
      const size = sizes[number - 1];
      if (!nal || offset === undefined || offset + size > buffer.length) return { sample: number, kind: 'unknown' };
      return { sample: number, kind: keyframeKind(nalTypes(buffer, offset, size, entry.lengthSize, hevc), hevc) };
    });
    result.video = { ...entry, codec: H264_TYPES.has(entry?.format) ? 'h264' : hevc ? 'hevc' : entry?.format ?? null, samples: sizes.length, allSync: !stss, keyframes };
  }
  return result;
}

/** Longest run of frames from one keyframe to the next, counting the run after the last keyframe. */
export function maxKeyframeDistance(syncSamples, totalSamples) {
  if (!totalSamples) return 0;
  if (!syncSamples.length) return totalSamples;
  const points = [...syncSamples].sort((a, b) => a - b);
  let longest = points[0] - 1;
  for (let index = 1; index < points.length; index += 1) longest = Math.max(longest, points[index] - points[index - 1]);
  return Math.max(longest, totalSamples - points[points.length - 1] + 1);
}
