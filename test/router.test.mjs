import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR, VENDOR_DIR, frontmatterProblems, loadSources, parseFrontmatter, walk } from '../scripts/lib/vendor.mjs';
import { ROOT } from './helpers.mjs';

const manifest = loadSources(ROOT);
const router = fs.readFileSync(path.join(ROOT, SKILL_DIR, 'SKILL.md'), 'utf8');
const fields = parseFrontmatter(router);
const body = router.slice(router.indexOf('\n---', 3) + 4);

const section = (heading) => {
  const start = router.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `${heading} exists`);
  const next = router.indexOf('\n## ', start + heading.length + 2);
  return router.slice(start, next < 0 ? undefined : next);
};

test('the router is the apple skill with a description inside the limits', () => {
  assert.deepEqual(frontmatterProblems(router), []);
  assert.equal(fields.name, 'apple');
  assert.ok(fields.description.length <= 1024, `${fields.description.length} characters`);
  assert.ok(!/[<>]/.test(fields.description), 'no angle brackets in the description');
});

test('the description opens with a referential phrase', () => {
  assert.ok(fields.description.startsWith('For Apple app code ('), fields.description.slice(0, 40));
});

test('the first 68 characters of the description carry the job', () => {
  const firstSentence = fields.description.indexOf('. ') + 1;
  assert.ok(firstSentence > 0 && firstSentence <= 68, `first sentence ends at ${firstSentence}`);
  const head = fields.description.slice(0, 68);
  for (const word of ['Apple', 'SwiftUI', 'Xcode']) assert.ok(head.includes(word), word);
});

test('the router body stays under 300 lines and an estimated 5,000 tokens', () => {
  assert.ok(body.split('\n').length <= 300, `${body.split('\n').length} lines`);
  assert.ok(Math.ceil(body.length / 3) <= 5000, `${body.length} characters`);
});

test('the router contains no host substitution variables', () => {
  for (const literal of ['$' + '{CLAUDE_SKILL_DIR}', '$' + 'ARGUMENTS', '$' + '0']) assert.ok(!router.includes(literal), literal);
});

test('every path the router references exists', () => {
  const references = [...router.matchAll(/`(\.vendor\/[^`\s]+)`/g)].map((match) => match[1]);
  assert.ok(references.length >= 38, `${references.length} references`);
  for (const reference of references) assert.ok(fs.existsSync(path.join(ROOT, SKILL_DIR, reference)), reference);
});

test('every active part is routed and every inactive part shows its activation check', () => {
  const routing = section('## Routing');
  for (const part of manifest.parts) {
    assert.ok(router.includes(`.vendor/${part.id}/SKILL.md`), `${part.id} is routed`);
    if (part.active) assert.ok(routing.includes(`.vendor/${part.id}/SKILL.md`), `${part.id} is in the routing table`);
    else assert.ok(router.includes(part.activation), `${part.id} shows its activation`);
  }
});

test('the parts index names every part', () => {
  const index = section('## Parts index');
  for (const part of manifest.parts) assert.ok(index.includes(`\`${part.id.split('/').at(-1)}\``), part.id);
});

test('the router keeps the standing rules the parts depend on', () => {
  const rules = section('## Standing rules');
  for (const phrase of ['in full', 'the folder of the file that mentions it', 'absolute path', 'activation check', 'explicit yes', 'ASC_TELEMETRY_DISABLED=1', 'asc install-skills', 'write-swift', 'apple-design', 'xcode-disk-cleanup']) {
    assert.ok(rules.includes(phrase), phrase);
  }
});

const LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const PART_PATH = /`((?:references|scripts|schemas|templates|\.\.)\/[^`\s]+)`/g;
const PLACEHOLDER = /[*<>{}$]|\.\.\.|\u{2026}/u;

/**
 * Where standing rule 5 sends a relative path found in a part file: the folder of that file first, then the part's own
 * folder, then, for a script name, the part's scripts/ folder. Returns null when none of them has it.
 */
function resolveLikeRuleFive(target, fileFolder, partFolder) {
  for (const base of [fileFolder, partFolder, path.join(partFolder, 'scripts')]) {
    const candidate = path.resolve(base, target);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

test('every relative link and part path in a vendored file resolves under rule 5', () => {
  const vendor = path.join(ROOT, ...VENDOR_DIR.split('/'));
  const misses = [];
  let checked = 0;
  for (const part of manifest.parts) {
    const partFolder = path.join(vendor, ...part.id.split('/'));
    for (const entry of walk(partFolder)) {
      if (entry.kind !== 'file' || !entry.path.endsWith('.md')) continue;
      const file = path.join(partFolder, ...entry.path.split('/'));
      let fenced = false;
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        if (/^\s*(?:```|~~~)/.test(line)) {
          fenced = !fenced;
          return;
        }
        if (fenced) return;
        for (const raw of [...[...line.matchAll(LINK)].map((match) => match[1]), ...[...line.matchAll(PART_PATH)].map((match) => match[1])]) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('#') || raw.startsWith('/') || PLACEHOLDER.test(raw)) continue;
          const target = raw.split('#')[0];
          if (!target) continue;
          checked += 1;
          const resolved = resolveLikeRuleFive(decodeURIComponent(target), path.dirname(file), partFolder);
          if (!resolved || !resolved.startsWith(`${vendor}${path.sep}`)) misses.push(`${part.id}/${entry.path}:${index + 1}: ${raw}`);
        }
      });
    }
  }
  assert.ok(checked >= 250, `${checked} paths checked`);
  assert.deepEqual(misses, []);
});

test('rule 5 is needed: many part paths resolve only from the file that mentions them', () => {
  const index = path.join(ROOT, ...VENDOR_DIR.split('/'), 'core-data-expert', 'references', '_index.md');
  const mentioned = [...fs.readFileSync(index, 'utf8').matchAll(/`([\w-]+\.md)`/g)].map((match) => match[1]);
  assert.ok(mentioned.length >= 10, `${mentioned.length} files named in _index.md`);
  for (const name of mentioned) {
    assert.ok(fs.existsSync(path.join(path.dirname(index), name)), `${name} sits next to _index.md`);
    assert.ok(!fs.existsSync(path.join(ROOT, ...VENDOR_DIR.split('/'), 'core-data-expert', name)), `${name} is not at the part root`);
  }
});

test('the router states that the project is independent of Apple', () => {
  assert.ok(body.includes('\nIndependent project, not affiliated with Apple Inc.; see NOTICE.md.\n'));
  assert.ok(fs.existsSync(path.join(ROOT, SKILL_DIR, 'NOTICE.md')));
});
