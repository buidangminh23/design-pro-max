#!/usr/bin/env node
/**
 * Drift check for the ledger values that come from public data sets (evidence/freshness.json). It fetches only data
 * files: mdn/browser-compat-data and Fyrd/caniuse JSON from raw.githubusercontent.com and package metadata from the
 * npm registry. It never fetches a web page, never re-measures and never edits the ledger.
 *
 *   node scripts/freshness.mjs [--out <file>] [--root <dir>]
 *
 * Prints one line per watch and exits 0 when every value matches its snapshot, 1 when at least one drifted (with
 * --out it also writes a Markdown issue body listing the drifted values), and 2 on bad usage or a fetch that failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, isMainModule, readJson } from './lib/vendor.mjs';

export const FRESHNESS_FILE = 'evidence/freshness.json';
const BCD_BASE = 'https://raw.githubusercontent.com/mdn/browser-compat-data/main';
const CANIUSE_BASE = 'https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json';
const NPM_BASE = 'https://registry.npmjs.org';
const USER_AGENT = 'design-pro-max-freshness';
const USAGE = 'Usage: node scripts/freshness.mjs [--out <file>] [--root <dir>]';

/** The version a browser first supports a BCD feature in, "preview" for preview-only, "none" when it does not. */
export function bcdVersion(support) {
  const first = Array.isArray(support) ? support[0] : support;
  if (!first) return 'none';
  const added = first.version_added;
  if (added === 'preview') return 'preview';
  if (added === false || added === null || added === undefined) return first.flags ? 'preview' : 'none';
  if (first.flags) return 'preview';
  return String(added).replace(/^≤/, '');
}

export function bcdValues(data, feature, browsers) {
  const node = feature.split('.').reduce((value, key) => value?.[key], data)?.__compat;
  if (!node) throw new Error(`${feature} is not in the data file`);
  return Object.fromEntries(browsers.map((browser) => [browser, bcdVersion(node.support?.[browser])]));
}

/** The first version caniuse marks supported or partial for each browser, as "<version>" or "<version> partial". */
export function caniuseValues(data, browsers) {
  const versionKey = (key) => key.split('-')[0].split('.').map(Number);
  const compare = (a, b) => {
    const [left, right] = [versionKey(a), versionKey(b)];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0);
      if (difference) return difference;
    }
    return 0;
  };
  return Object.fromEntries(browsers.map((browser) => {
    const stats = data.stats?.[browser] ?? {};
    const first = Object.keys(stats).filter((key) => /^[ya]/.test(stats[key])).sort(compare)[0];
    if (!first) return [browser, 'none'];
    return [browser, stats[first].startsWith('a') ? `${first} partial` : first];
  }));
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

export async function currentValues(watch, fetchImpl = fetch) {
  const browsers = Object.keys(watch.snapshot);
  if (watch.kind === 'bcd') return bcdValues(await fetchJson(`${BCD_BASE}/${watch.path}`, fetchImpl), watch.feature, browsers);
  if (watch.kind === 'caniuse') return caniuseValues(await fetchJson(`${CANIUSE_BASE}/${watch.feature}.json`, fetchImpl), browsers);
  if (watch.kind === 'npm-license') {
    const data = await fetchJson(`${NPM_BASE}/${encodeURIComponent(watch.package).replace('%40', '@')}/latest`, fetchImpl);
    const license = typeof data.license === 'string' ? data.license : data.license?.type ?? 'none';
    return { license, version: data.version };
  }
  throw new Error(`unknown kind ${watch.kind}`);
}

export function drift(watch, current) {
  return Object.entries(watch.snapshot).filter(([key, expected]) => current[key] !== expected).map(([key, expected]) => ({ key, expected, current: current[key] }));
}

const label = (watch) => `${watch.id} ${watch.kind} ${watch.feature ?? watch.package}`;

export function issueBody(results) {
  const lines = [
    'The monthly freshness check found ledger values that no longer match their public data sets. Re-read each source, then update the ledger entry, its snapshot in `evidence/freshness.json` and anything that cites it, by hand. Nothing was re-measured or edited automatically.',
    '',
    '| Ledger id | Data | Key | Ledger snapshot | Current |',
    '|---|---|---|---|---|',
  ];
  for (const { watch, changes } of results) for (const change of changes) lines.push(`| ${watch.id} | ${watch.kind} ${watch.feature ?? watch.package} | ${change.key} | ${change.expected} | ${change.current ?? 'missing'} |`);
  return `${lines.join('\n')}\n`;
}

export async function runFreshness(root = ROOT, fetchImpl = fetch) {
  const { watches } = readJson(root, FRESHNESS_FILE);
  const ledger = readJson(root, 'evidence/ledger.json').entries;
  const results = [];
  for (const watch of watches) {
    if (!ledger[watch.id]) throw new Error(`${FRESHNESS_FILE}: ${watch.id} is not a ledger id`);
    results.push({ watch, changes: drift(watch, await currentValues(watch, fetchImpl)) });
  }
  return results;
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const [, value] = args.splice(at, 2);
    if (!value) throw new Error(USAGE);
    return value;
  };
  const root = path.resolve(take('--root') ?? ROOT);
  const out = take('--out');
  if (args.length) throw new Error(USAGE);
  const results = await runFreshness(root);
  for (const { watch, changes } of results) {
    console.log(changes.length ? `DRIFT ${label(watch)}: ${changes.map((change) => `${change.key} ${change.expected} -> ${change.current ?? 'missing'}`).join(', ')}` : `ok ${label(watch)}`);
  }
  const drifted = results.filter((result) => result.changes.length);
  if (out) fs.writeFileSync(out, drifted.length ? issueBody(drifted) : '');
  process.exitCode = drifted.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
