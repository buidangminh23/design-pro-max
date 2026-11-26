/**
 * desktop-distribution static check of a self-update feed before it is published: a JSON feed with a platforms map
 * (the static file Tauri's updater reads) or a Sparkle appcast. It reads the file and fetches nothing.
 *
 *   node check-feed.mjs [--platforms <os-arch>[,<os-arch>]] <latest.json or appcast.xml> [more feeds]
 *
 * Error: DD-FEED-01, a JSON feed with no entry for a platform the release ships (darwin-aarch64 and darwin-x86_64
 * unless --platforms names others), an entry without an https url or a signature, or a feed with no version; a Sparkle
 * appcast whose newest item has no https enclosure, no EdDSA signature or no version. An entry counts for a platform
 * when its key is the platform or the platform with an installer suffix (darwin-aarch64-app). Output follows the
 * shared checker contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createReport, dropProject, isMain, runMain, UsageError } from '../../shared/report.mjs';

export const BOUNDARY =
  'Proof boundary: a static read of the feed file; it does not download the archives, verify their signatures against the public key, ' +
  'or prove which key an installed app falls back to when its own platform is missing.';

export const DEFAULT_PLATFORMS = ['darwin-aarch64', 'darwin-x86_64'];
const PLATFORM = /^[a-z]+-[a-z0-9_]+$/;

export function entryFor(platforms, platform) {
  const keys = Object.keys(platforms ?? {});
  const key = keys.find((name) => name === platform) ?? keys.find((name) => name.startsWith(`${platform}-`));
  return key ? { key, entry: platforms[key] } : null;
}

export function checkJsonFeed(feed, file, wanted, report) {
  const version = typeof feed.version === 'string' && feed.version.trim();
  report.check('DD-FEED-01', Boolean(version), `${file} version`, version ? `version ${version}` : 'no version', 'the version this release ships');
  if (!feed.platforms || typeof feed.platforms !== 'object') {
    report.error('DD-FEED-01', file, 'no platforms map', `an entry for each of ${wanted.join(', ')}`);
    return;
  }
  for (const platform of wanted) {
    const found = entryFor(feed.platforms, platform);
    if (!found) {
      report.error('DD-FEED-01', `${file} ${platform}`, `no entry; present: ${Object.keys(feed.platforms).join(', ') || 'none'}`, `an entry for ${platform} from the first release on, so those installs are not left on their first build`);
      continue;
    }
    const { key, entry } = found;
    const url = typeof entry?.url === 'string' ? entry.url : '';
    const signature = typeof entry?.signature === 'string' ? entry.signature.trim() : '';
    const problems = [];
    if (!/^https:\/\//.test(url)) problems.push(url ? `url ${url} is not https` : 'no url');
    if (!signature) problems.push('no signature');
    if (problems.length) report.error('DD-FEED-01', `${file} ${key}`, problems.join('; '), 'an https url and the signature of that archive');
    else report.pass('DD-FEED-01', `${file} ${key}`, `${url} with a signature`, 'an https url and a signature');
  }
}

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`))?.[1] ?? null;

export function checkAppcast(text, file, report) {
  const items = [...text.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((match) => match[0]);
  if (!items.length) {
    report.error('DD-FEED-01', file, 'the appcast has no item', 'an item for the release');
    return;
  }
  const item = items[0];
  const enclosure = item.match(/<enclosure\b[^>]*>/)?.[0] ?? '';
  const url = attribute(enclosure, 'url') ?? '';
  const signature = attribute(enclosure, 'sparkle:edSignature');
  const version = item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/)?.[1] ?? attribute(enclosure, 'sparkle:version');
  const problems = [];
  if (!enclosure) problems.push('no enclosure');
  else if (!/^https:\/\//.test(url)) problems.push(url ? `enclosure url ${url} is not https` : 'no enclosure url');
  if (!signature) problems.push(attribute(enclosure, 'sparkle:dsaSignature') ? 'only a DSA signature' : 'no sparkle:edSignature');
  if (!version) problems.push('no sparkle:version');
  if (problems.length) report.error('DD-FEED-01', `${file} newest item`, problems.join('; '), 'an https enclosure with sparkle:edSignature and sparkle:version');
  else report.pass('DD-FEED-01', `${file} newest item`, `${url}, version ${version}, signed`, 'an https enclosure, an EdDSA signature and a version');
}

export function checkFeed(text, file, wanted, report) {
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) return checkAppcast(trimmed, file, report);
  let feed;
  try {
    feed = JSON.parse(trimmed);
  } catch (error) {
    throw new UsageError(`${file} is neither JSON nor an appcast: ${error.message}`);
  }
  return checkJsonFeed(feed, file, wanted, report);
}

export function parseArgs(argv) {
  const args = dropProject(argv);
  let platforms = DEFAULT_PLATFORMS;
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--platforms') {
      const value = args[(index += 1)];
      if (!value) throw new UsageError('--platforms needs a value such as darwin-aarch64,darwin-x86_64.');
      platforms = value.split(',').map((item) => item.trim()).filter(Boolean);
      const bad = platforms.find((item) => !PLATFORM.test(item));
      if (bad) throw new UsageError(`${bad} is not an os-arch platform such as darwin-aarch64.`);
    } else if (args[index].startsWith('--')) throw new UsageError(`Unknown argument ${args[index]}.`);
    else files.push(args[index]);
  }
  if (!files.length) throw new UsageError('Usage: node check-feed.mjs [--platforms <os-arch>[,<os-arch>]] <latest.json or appcast.xml>');
  for (const file of files) if (!fs.existsSync(file)) throw new UsageError(`Not found: ${file}`);
  return { platforms, files };
}

async function main() {
  const { platforms, files } = parseArgs(process.argv.slice(2));
  const report = createReport({ tool: 'check-feed', boundary: BOUNDARY });
  for (const file of files) checkFeed(fs.readFileSync(file, 'utf8'), path.basename(file), platforms, report);
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: `node ${process.argv.slice(1).join(' ')}` });
