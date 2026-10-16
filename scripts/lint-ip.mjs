#!/usr/bin/env node
/**
 * Intellectual-property and privacy lint over the project's own files. Vendored parts are outside its scope.
 *
 *   node scripts/lint-ip.mjs [--json]          run every check; exit 1 on a finding
 *   node scripts/lint-ip.mjs --build <terms>   hash a private terms file into evidence/ip-hashes.json
 *
 * Checks:
 *   identifiers   class names, custom properties, module ids and media file names from the private research, matched as
 *                 salted hashes, in the skill's own files, evidence, rules.json, the card and the README
 *   apple-text    8-word shingles that match the hashed Apple text corpus, outside quotes of at most 20 words
 *   phrases       endorsement and imitation phrases, in English and Vietnamese, in the card, package.json, the plugin
 *                 manifests, the README and the router description
 *   substitution  host substitution syntax in the router, NOTICE.md and every PART.md
 *   privacy       private machine names, paths and repository names, matched as salted hashes, in every own file
 *   versions      an OS or SDK version past designs/apple.json's newestReleasedOS in errata, risks, prerequisites,
 *                 activation checks and the project's own text
 *
 * The terms file is private and never committed: {"identifiers": [...], "private": [...], "corpus": [<text files>]}.
 * The corpus also takes every appleText passage that vendor/sources.json records.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, SKILL_DIR, VENDOR_DIR, formatJson, isMainModule, loadSources, parseFrontmatter, partDir, sha256 } from './lib/vendor.mjs';

export const DESIGN_FILE = 'designs/apple.json';
export const HASHES_FILE = 'evidence/ip-hashes.json';
export const CHECKS = ['identifiers', 'apple-text', 'phrases', 'substitution', 'privacy', 'versions'];
export const OS_VERSION = /\b(?:iOS|iPadOS|macOS|watchOS|tvOS|visionOS|SDKs?)\s+(\d+(?:\.\d+)?)\+?(?:\s*(?:to|through|and|-|–)\s*(\d+(?:\.\d+)?))?/g;
export const SUBSTITUTIONS = [
  ['a positional argument', /\$\d/],
  ['$ARGUMENTS', /\$ARGUMENTS\b/],
  ['a ${CLAUDE_ variable', /\$\{CLAUDE_/],
  ['a bang-backtick command', /!`/],
  ['an @-mention of a path', /(?<![\w`])@(?:\.{1,2}\/|~\/|[\w-]+\/)[\w./-]*|(?<![\w`])@[\w-]+\.(?:md|json|mjs|js|txt|yaml|yml)\b/],
];
const TOKEN = /[\p{L}\p{N}_][\p{L}\p{N}_.-]*/gu;
const WORD = /[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu;
const QUOTE = /["“]([^"”\n]*)["”]/g;
const TEXT_EXTENSIONS = /\.(?:md|json|mjs|js|css|html|txt|yml|yaml|svg)$/;

export const hashTerm = (salt, term) => sha256(Buffer.from(`${salt}\0${term.toLowerCase()}`));

/** The design record of the apple skill. */
export function loadDesign(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, ...DESIGN_FILE.split('/')), 'utf8'));
}

export function loadHashes(root = ROOT) {
  const file = path.join(root, ...HASHES_FILE.split('/'));
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Identifier-like tokens of one line, lower-cased, with each dotted piece as its own candidate. */
export function lineTokens(line) {
  const found = new Set();
  for (const match of line.matchAll(TOKEN)) {
    const token = match[0].replace(/[.-]+$/, '').toLowerCase();
    if (token.length < 3) continue;
    found.add(token);
    for (const piece of token.split('.')) if (piece.length >= 3) found.add(piece);
  }
  return found;
}

/** Tokens of a text whose salted hash is in the set, with their line numbers. */
export function hashedTermFindings(text, salt, hashes) {
  const set = new Set(hashes);
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const token of lineTokens(line)) if (set.has(hashTerm(salt, token))) found.push({ line: index + 1, token });
  });
  return found;
}

/** Words of a text in order, each with its line, after quotes of at most `quoteWords` words are blanked. */
export function shingleWords(text, quoteWords = 20) {
  const blanked = text.replace(QUOTE, (whole, inner) => ((inner.match(WORD) ?? []).length <= quoteWords ? whole.replace(/[^\n]/g, ' ') : whole));
  const words = [];
  blanked.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(WORD)) words.push({ word: match[0].toLowerCase(), line: index + 1 });
  });
  return words;
}

export function shingles(words, size) {
  const list = [];
  for (let index = 0; index + size <= words.length; index += 1) list.push({ text: words.slice(index, index + size).map((item) => item.word).join(' '), line: words[index].line });
  return list;
}

/** Lines of a text that start an 8-word shingle found in the hashed corpus. */
export function appleTextFindings(text, salt, corpus, { size = 8, quoteWords = 20 } = {}) {
  const set = new Set(corpus);
  const lines = new Set();
  for (const shingle of shingles(shingleWords(text, quoteWords), size)) if (set.has(hashTerm(salt, shingle.text))) lines.add(shingle.line);
  return [...lines].map((line) => ({ line }));
}

/** Imitation and endorsement phrases; an endorsement word next to an Apple mark counts unless the sentence negates it. */
export function phraseFindings(text, gates, marks) {
  const found = [];
  const markPattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${marks.map((mark) => mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}_])`, 'u');
  const endorsement = new RegExp(gates.endorsement, 'i');
  const negation = new RegExp(gates.negation, 'i');
  text.split('\n').forEach((line, index) => {
    for (const source of gates.en) if (new RegExp(source, 'i').test(line)) found.push({ line: index + 1, phrase: source });
    for (const phrase of gates.vi) if (line.toLowerCase().includes(phrase.toLowerCase())) found.push({ line: index + 1, phrase });
    for (const sentence of line.split(/(?<=[.!?;])\s+/)) {
      const words = sentence.split(/\s+/);
      words.forEach((word, position) => {
        if (!endorsement.test(word)) return;
        const near = words.slice(Math.max(0, position - 4), position + 5).join(' ');
        if (markPattern.test(near) && !negation.test(sentence)) found.push({ line: index + 1, phrase: word.replace(/[^\p{L}]/gu, '') });
      });
    }
  });
  return found;
}

export function substitutionFindings(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const [label, pattern] of SUBSTITUTIONS) if (pattern.test(line)) found.push({ line: index + 1, label });
  });
  return found;
}

/** OS and SDK versions past the newest release. */
export function versionFindings(text, newest) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(OS_VERSION)) {
      for (const version of match.slice(1).filter(Boolean)) if (Number(version) > newest) found.push({ line: index + 1, version: match[0] });
    }
  });
  return found;
}

function trackedOwnFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return output.split('\0').filter((file) => file && !file.startsWith(`${VENDOR_DIR}/`) && file !== HASHES_FILE && TEXT_EXTENSIONS.test(file) && fs.existsSync(path.join(root, file)));
}

const read = (root, file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');

/** The files each check reads, from the tracked own files. */
export function scopes(files) {
  const skill = files.filter((file) => file.startsWith(`${SKILL_DIR}/`));
  const has = (file) => files.includes(file);
  const plugin = files.filter((file) => /^\.(?:claude|codex)-plugin\//.test(file));
  return {
    identifiers: [...skill, ...files.filter((file) => file.startsWith('evidence/')), ...['rules.json', 'web-card.json', 'README.md'].filter(has)],
    appleText: [...skill, ...['README.md', 'CHANGELOG.md'].filter(has)],
    phrases: [...['web-card.json', 'package.json', 'README.md'].filter(has), ...plugin],
    substitution: [`${SKILL_DIR}/SKILL.md`, `${SKILL_DIR}/NOTICE.md`, ...skill.filter((file) => file.endsWith('/PART.md'))].filter(has),
    privacy: files,
    versions: [...['README.md', 'CHANGELOG.md'].filter(has), ...skill.filter((file) => file.endsWith('.md'))],
  };
}

/** Every finding of every check over a checkout, as {check, file, line, detail}. */
export function lintIp(root = ROOT, { files = trackedOwnFiles(root), design = loadDesign(root), hashes = loadHashes(root) } = {}) {
  const findings = [];
  const add = (check, file, items, detail) => items.forEach((item) => findings.push({ check, file, line: item.line, detail: detail(item) }));
  const scope = scopes(files);
  if (!hashes) findings.push({ check: 'identifiers', file: HASHES_FILE, line: 0, detail: 'missing; run --build with the private terms file' });
  else {
    for (const file of scope.identifiers) add('identifiers', file, hashedTermFindings(read(root, file), hashes.salt, hashes.identifiers), (item) => `names the denylisted identifier "${item.token}"`);
    for (const file of scope.privacy) add('privacy', file, hashedTermFindings(read(root, file), hashes.salt, hashes.private), (item) => `names the private term "${item.token}"`);
    for (const file of scope.appleText) add('apple-text', file, appleTextFindings(read(root, file), hashes.salt, hashes.corpus, { size: design.appleText.shingleWords, quoteWords: design.appleText.quoteWords }), () => `matches Apple text over ${design.appleText.shingleWords} words`);
  }
  for (const file of scope.phrases) {
    const text = file === 'package.json' ? JSON.parse(read(root, file)).description ?? '' : read(root, file);
    add('phrases', file, phraseFindings(text, design.phraseGates, design.marks), (item) => `uses "${item.phrase}"`);
  }
  const description = parseFrontmatter(read(root, `${SKILL_DIR}/SKILL.md`)).description ?? '';
  add('phrases', `${SKILL_DIR}/SKILL.md (description)`, phraseFindings(description, design.phraseGates, design.marks), (item) => `uses "${item.phrase}"`);
  for (const file of scope.substitution) add('substitution', file, substitutionFindings(read(root, file)), (item) => `has ${item.label}, which a host may substitute`);
  for (const file of scope.versions) add('versions', file, versionFindings(read(root, file), design.newestReleasedOS), (item) => `names ${item.version}, past the newest release ${design.newestReleasedOS}`);
  const manifest = loadSources(root);
  for (const part of manifest.parts) {
    const texts = [part.activation, ...part.prerequisites, ...part.risks, ...part.errata].join('\n');
    add('versions', `vendor/sources.json (${part.id})`, versionFindings(texts, design.newestReleasedOS), (item) => `names ${item.version}, past the newest release ${design.newestReleasedOS}`);
  }
  return findings;
}

/** Apple text that vendor/sources.json records, read from the vendored files. */
export function recordedAppleText(root = ROOT) {
  const passages = [];
  for (const part of loadSources(root).parts) {
    for (const quote of part.appleText) {
      const lines = fs.readFileSync(path.join(partDir(root, part.id), ...quote.file.split('/')), 'utf8').split('\n');
      for (const range of quote.lines.split(', ')) {
        const [start, end = start] = range.split('-').map(Number);
        passages.push(lines.slice(start - 1, end).join('\n'));
      }
    }
  }
  return passages;
}

/** Salted hashes of a private terms file and the recorded Apple text, in the shape of evidence/ip-hashes.json. */
export function buildHashes(termsFile, { root = ROOT, salt = crypto.randomBytes(16).toString('hex') } = {}) {
  const terms = JSON.parse(fs.readFileSync(termsFile, 'utf8'));
  const design = loadDesign(root);
  const hash = (list) => [...new Set(list.map((term) => hashTerm(salt, term)))].sort();
  const corpusTexts = [...recordedAppleText(root), ...(terms.corpus ?? []).map((file) => fs.readFileSync(path.resolve(path.dirname(termsFile), file), 'utf8'))];
  const corpus = corpusTexts.flatMap((text) => shingles(shingleWords(text, 0), design.appleText.shingleWords).map((item) => item.text));
  return {
    description: 'Salted SHA-256 hashes for scripts/lint-ip.mjs. The term lists and the corpus they come from are private and never committed.',
    salt,
    identifiers: hash(terms.identifiers ?? []),
    private: hash(terms.private ?? []),
    corpus: hash(corpus),
  };
}

function main(argv) {
  if (argv[0] === '--build') {
    if (!argv[1]) throw new Error('Usage: node scripts/lint-ip.mjs --build <private terms file>');
    const hashes = buildHashes(argv[1]);
    fs.writeFileSync(path.join(ROOT, ...HASHES_FILE.split('/')), formatJson(hashes));
    console.log(`Wrote ${HASHES_FILE}: ${hashes.identifiers.length} identifiers, ${hashes.private.length} private terms, ${hashes.corpus.length} corpus shingles.`);
    return 0;
  }
  const findings = lintIp();
  if (argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
  else for (const item of findings) console.log(`${item.check}: ${item.file}${item.line ? `:${item.line}` : ''} ${item.detail}`);
  if (!findings.length && !argv.includes('--json')) console.log(`lint-ip passed (${CHECKS.length} checks).`);
  return findings.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
