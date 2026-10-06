/**
 * Images, fonts, media and archives: how to recognise them by name or by content, and the reviewed files that may
 * ship anyway. The history check and the release check share this list, so a reviewed file passes only with the
 * exact bytes that were reviewed, and a file whose name hides what it holds is caught by its first bytes.
 */
import path from 'node:path';
import { MEDIA_EXTENSIONS, sha256 } from './vendor.mjs';

/**
 * Reviewed media files by repository path, with the SHA-256 of the reviewed bytes. skills/apple/assets/apple.svg is
 * the Apple logo that the owner chose as the apple skill's icon; README.md and skills/apple/NOTICE.md explain it.
 */
export const REVIEWED_MEDIA = new Map([
  ['skills/apple/assets/apple.svg', '70941d8953cda19267f7be707c8b39c2293d76de8d2bcd484211bb925983ed0b'],
]);

/**
 * Licences of reviewed media drawn by others: the project, its source, the shipped files and the licence text, which
 * THIRD_PARTY_NOTICES.md and the NOTICE.md of the skill that ships the files both carry. A licence covers the drawing,
 * never a trademark the drawing shows.
 */
export const MEDIA_NOTICES = [
  {
    project: 'devicon',
    source: 'https://github.com/devicons/devicon',
    files: ['skills/apple/assets/apple.svg'],
    licence: `The MIT License (MIT)

Copyright (c) 2015 konpa

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`,
  },
];

const SVG_START = /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>/]/i;

const at = (bytes, offset, text) => bytes.length >= offset + text.length && bytes.subarray(offset, offset + text.length).toString('latin1') === text;
const starts = (bytes, ...prefixes) => prefixes.some((prefix) => bytes.length >= prefix.length && bytes.subarray(0, prefix.length).equals(Buffer.from(prefix)));

/**
 * Content signatures, each strict enough that ordinary text cannot match it: either the magic bytes are binary or a
 * second field has to agree with them.
 */
const SIGNATURES = [
  ['PNG image', (bytes) => starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['JPEG image', (bytes) => starts(bytes, [0xff, 0xd8, 0xff])],
  ['GIF image', (bytes) => at(bytes, 0, 'GIF87a') || at(bytes, 0, 'GIF89a')],
  ['WebP image', (bytes) => at(bytes, 0, 'RIFF') && at(bytes, 8, 'WEBP')],
  ['WAV audio', (bytes) => at(bytes, 0, 'RIFF') && at(bytes, 8, 'WAVE')],
  ['AVI video', (bytes) => at(bytes, 0, 'RIFF') && at(bytes, 8, 'AVI ')],
  ['BMP image', (bytes) => at(bytes, 0, 'BM') && bytes.length >= 14 && bytes.readUInt32LE(2) === bytes.length],
  ['ICO image', (bytes) => starts(bytes, [0x00, 0x00, 0x01, 0x00])],
  ['ICNS image', (bytes) => at(bytes, 0, 'icns') && bytes.length >= 8 && bytes.readUInt32BE(4) === bytes.length],
  ['TIFF image', (bytes) => starts(bytes, [0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a])],
  ['ISO media file (MP4, MOV, HEIC or AVIF)', (bytes) => bytes.length >= 8 && bytes[0] === 0x00 && (at(bytes, 4, 'ftyp') || at(bytes, 4, 'moov') || at(bytes, 4, 'mdat'))],
  ['Matroska or WebM video', (bytes) => starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])],
  ['MP3 audio', (bytes) => at(bytes, 0, 'ID3') && bytes.length > 3 && bytes[3] <= 0x05],
  ['Ogg media', (bytes) => at(bytes, 0, 'OggS') && bytes.length > 4 && bytes[4] === 0x00],
  ['FLAC audio', (bytes) => at(bytes, 0, 'fLaC') && bytes.length > 4 && bytes[4] <= 0x86],
  ['PDF document', (bytes) => at(bytes, 0, '%PDF-')],
  ['WOFF font', (bytes) => at(bytes, 0, 'wOFF')],
  ['WOFF2 font', (bytes) => at(bytes, 0, 'wOF2')],
  ['TrueType font', (bytes) => starts(bytes, [0x00, 0x01, 0x00, 0x00]) || (at(bytes, 0, 'true') && bytes.length > 4 && bytes[4] === 0x00)],
  ['OpenType font', (bytes) => at(bytes, 0, 'OTTO') && bytes.length > 4 && bytes[4] === 0x00],
  ['ZIP archive', (bytes) => starts(bytes, [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06])],
  ['gzip archive', (bytes) => starts(bytes, [0x1f, 0x8b])],
  ['7z archive', (bytes) => starts(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
  ['RAR archive', (bytes) => starts(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
  ['xz archive', (bytes) => starts(bytes, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])],
  ['bzip2 archive', (bytes) => at(bytes, 0, 'BZh') && at(bytes, 4, '1AY&SY')],
  ['tar archive', (bytes) => at(bytes, 257, 'ustar')],
  ['disk image', (bytes) => bytes.length >= 512 && at(bytes, bytes.length - 512, 'koly')],
  ['SVG image', (bytes) => SVG_START.test(bytes.subarray(0, 4096).toString('utf8').replace(/^\u{FEFF}/u, ''))],
];

/**
 * What kind of image, font, media file or archive a file is, from its extension or its first bytes, or null when it
 * is none of them.
 */
export function mediaKind(file, bytes = null) {
  const extension = path.posix.extname(file).toLowerCase();
  if (MEDIA_EXTENSIONS.has(extension)) return `${extension} file`;
  if (bytes) for (const [label, test] of SIGNATURES) if (test(bytes)) return label;
  return null;
}

/**
 * True when `file` is on the reviewed list and `bytes` are exactly the reviewed bytes.
 */
export function isReviewedMedia(file, bytes) {
  return Boolean(bytes) && REVIEWED_MEDIA.get(file) === sha256(bytes);
}
