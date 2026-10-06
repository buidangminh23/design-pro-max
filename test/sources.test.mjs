import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PART_KEYS, SKILL_DIR, loadSources, validateSources } from '../scripts/lib/vendor.mjs';
import { ROOT } from './helpers.mjs';

const manifest = loadSources(ROOT);
const NEWEST_RELEASED_OS = 27.0;
const OS_VERSION = /\b(?:iOS|iPadOS|macOS|watchOS|tvOS|visionOS|SDKs?)\s+(\d+(?:\.\d+)?)\+?(?:\s*(?:to|through|and|-|\u2013)\s*(\d+(?:\.\d+)?))?/g;
const ACTIVE = ['swiftui-expert-skill', 'swift-concurrency', 'swift-testing-pro', 'swiftdata-pro', 'core-data-expert', 'xcode-disk-cleanup'];

test('the manifest lists 38 parts with unique ids and the documented key set', () => {
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.parts.length, 38);
  assert.equal(new Set(manifest.parts.map((part) => part.id)).size, 38);
  for (const part of manifest.parts) assert.deepEqual(Object.keys(part), PART_KEYS, part.id);
  assert.deepEqual(validateSources(manifest), []);
});

test('six parts are active and 32 wait for their prerequisites', () => {
  assert.deepEqual(manifest.parts.filter((part) => part.active).map((part) => part.id), ACTIVE);
  const inactive = manifest.parts.filter((part) => !part.active);
  assert.equal(inactive.length, 32);
  assert.equal(inactive.filter((part) => part.id.startsWith('xcode-build/')).length, 6);
  assert.equal(inactive.filter((part) => part.id.startsWith('app-store-connect/asc-')).length, 25);
  assert.ok(inactive.some((part) => part.id === 'macos-menubar-tuist-app'));
  for (const part of inactive) assert.ok(part.prerequisites.length > 0, `${part.id} states its prerequisites`);
});

test('every App Store Connect part asks the user to confirm a paid Apple Developer Program account', () => {
  const asc = manifest.parts.filter((part) => part.id.startsWith('app-store-connect/'));
  assert.equal(asc.length, 25);
  for (const part of asc) assert.match(part.activation, /the user confirms a paid Apple Developer Program account/, part.id);
});

test('every repository is pinned to one full commit', () => {
  const pins = new Map();
  for (const part of manifest.parts) {
    assert.match(part.commit, /^[0-9a-f]{40}$/);
    if (pins.has(part.repo)) assert.equal(pins.get(part.repo), part.commit, part.id);
    pins.set(part.repo, part.commit);
  }
  assert.equal(pins.size, 9);
});

test('validateSources reports malformed entries', () => {
  const good = structuredClone(manifest.parts[0]);
  const check = (mutate) => {
    const part = structuredClone(good);
    mutate(part);
    return validateSources({ schema: 1, parts: [part] }).join('\n');
  };
  assert.match(check((part) => { part.commit = '204dba7'; }), /full 40-character SHA/);
  assert.match(check((part) => { part.path = '../escape'; }), /relative folder/);
  assert.match(check((part) => { part.repo = 'not a repo'; }), /GitHub owner\/name/);
  assert.match(check((part) => { part.exclude = ['/abs/**']; }), /relative globs/);
  assert.match(check((part) => { part.activation = ' '; }), /activation/);
  assert.match(check((part) => { part.errata = 'none'; }), /errata must be a list/);
  assert.match(check((part) => { part.extra = true; }), /unknown keys extra/);
  assert.match(check((part) => { delete part.risks; }), /missing risks/);
  assert.match(check((part) => { part.id = 'Bad_ID'; }), /id must be/);
  assert.match(check((part) => { delete part.appleText; }), /missing appleText/);
  assert.match(validateSources({ schema: 1, parts: [good, good] }).join('\n'), /duplicate id/);
  assert.match(validateSources({ schema: 1, parts: [good, { ...good, id: 'other', commit: 'f'.repeat(40) }] }).join('\n'), /same commit/);
  assert.match(validateSources({ schema: 1, parts: [{ ...good, id: 'group' }, { ...good, id: 'group/child' }] }).join('\n'), /group folder group is also a part/);
  assert.match(validateSources({ schema: 2, parts: [good] }).join('\n'), /schema must be 1/);
  assert.match(validateSources([]).join('\n'), /JSON object/);
});

test('validateSources checks every appleText entry', () => {
  const good = structuredClone(manifest.parts[0]);
  const check = (appleText) => validateSources({ schema: 1, parts: [{ ...good, appleText }] }).join('\n');
  const quote = { file: 'SKILL.md', lines: '3', source: 'A source.', reason: 'A reason.' };
  assert.equal(check([quote, { ...quote, lines: '12-14, 30' }]), '');
  assert.match(check('none'), /appleText must be a list/);
  assert.match(check([{ file: 'SKILL.md', lines: '3' }]), /appleText\[0\] needs exactly the keys file, lines, source, reason/);
  assert.match(check([{ ...quote, file: '../outside.md' }]), /appleText\[0\]\.file must be a path inside the part/);
  assert.match(check([{ ...quote, lines: '3 to 4' }]), /appleText\[0\]\.lines must look like/);
  assert.match(check([{ ...quote, lines: '9-3' }]), /ends before it starts/);
  assert.match(check([{ ...quote, reason: ' ' }]), /needs a source and a reason/);
});

test('the manifest records the Apple text that ships in three parts', () => {
  const quoted = manifest.parts.filter((part) => part.appleText.length).map((part) => part.id);
  assert.deepEqual(quoted, ['swiftui-expert-skill', 'core-data-expert', 'app-store-connect/asc-app-create-ui']);
  const createUi = manifest.parts.find((part) => part.id === 'app-store-connect/asc-app-create-ui');
  assert.deepEqual(createUi.appleText.map((quote) => `${quote.file}:${quote.lines}`), ['SKILL.md:131']);
  for (const quote of manifest.parts.flatMap((part) => part.appleText)) assert.match(quote.source, /^https:\/\/developer\.apple\.com\/|Apple/);
});

test('errata and the project\'s own text name only released OS and SDK versions', () => {
  const own = ['README.md', 'CHANGELOG.md', `${SKILL_DIR}/SKILL.md`, `${SKILL_DIR}/NOTICE.md`].map((file) => [file, fs.readFileSync(path.join(ROOT, ...file.split('/')), 'utf8')]);
  const texts = [...manifest.parts.flatMap((part) => [part.activation, ...part.prerequisites, ...part.risks, ...part.errata].map((text) => [part.id, text])), ...own];
  for (const [where, text] of texts) {
    for (const match of text.matchAll(OS_VERSION)) {
      for (const version of match.slice(1).filter(Boolean)) {
        assert.ok(Number(version) <= NEWEST_RELEASED_OS, `${where} names ${match[0]}, past the newest released ${NEWEST_RELEASED_OS}; name only released versions, or raise NEWEST_RELEASED_OS once Apple ships it`);
      }
    }
  }
});
