/**
 * web-shells WebKit probe: loads an app in Playwright's WebKit with no credentials to give, the way a home-screen web
 * app, an in-app browser or a WebView shell has no prompt to answer, and reports how the app authenticates.
 *
 *   node probe-webkit.mjs --url <https url> [--page <path>] [--login <path> --field name=value ... [--session-cookie <name>]] [--embed-cross-site] --project <folder>
 *   node probe-webkit.mjs --app <handler module> [--http] [--page <path>] [--login <path> --field name=value ...] [--embed-cross-site] --project <folder>
 *
 * --app serves a module whose default export is a Node request handler, over HTTPS with a certificate made at run
 * time in the temp folder (--http serves it over plain http instead). --login opens that path, fills the named fields,
 * submits the form and then reloads the page. --embed-cross-site then loads the page inside an iframe of a page on
 * another site, which the probe serves itself through Playwright's routing, on the target's scheme. Playwright and
 * its WebKit come from --project.
 *
 * Errors: WS-AUTH-01, a page, frame or request answered 401 with an HTTP Basic or Digest challenge; WS-COOKIE-01, a
 * login whose session cookie does not come back with the next request (named when it is a Secure cookie over plain
 * http). The session cookie is the one --session-cookie names, else any cookie the login set from the app's own
 * origin that is host-only, not deleted and has a path covering the page. Warning: WS-WARN-THIRDPARTY, the session
 * cookie is not sent inside a cross-site iframe. Output follows the shared checker contract.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReport, isMain, runMain, UsageError } from '../../shared/report.mjs';
import { INSTALL_HINT, loadPlaywright } from '../../shared/resolve-playwright.mjs';
import { currentCommand, rethrowSandbox } from '../../shared/sandbox.mjs';
import { createSelfSignedCert, startServer } from '../../shared/server.mjs';

export const BOUNDARY =
  "Proof boundary: Playwright's WebKit build proves HTTP challenges, cookie storage and which requests carry cookies; " +
  'it does not prove iOS Safari, a home-screen web app, WKWebView inside a shell, in-app browsers, or real devices. ' +
  'Playwright never shows an HTTP credential prompt, so the probe observes the 401 and what rendered, not a prompt.';

export const WEBKIT_HINT = INSTALL_HINT.replace('chromium-headless-shell', 'webkit');
export const EMBEDDER_HOST = 'embedder.example';
const USAGE = 'Usage: node probe-webkit.mjs (--url <url> | --app <module>) [--http] [--page <path>] [--login <path> --field name=value ... [--session-cookie <name>]] [--embed-cross-site] --project <folder>';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function parseArgs(argv) {
  const options = { url: null, app: null, http: false, page: null, login: null, fields: [], sessionCookie: null, crossSite: false, project: process.cwd(), timeout: 15000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[(index += 1)];
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${arg} needs a value.\n${USAGE}`);
      return next;
    };
    if (arg === '--url') options.url = value();
    else if (arg === '--app') options.app = path.resolve(value());
    else if (arg === '--http') options.http = true;
    else if (arg === '--page') options.page = value();
    else if (arg === '--login') options.login = value();
    else if (arg === '--field') {
      const field = value();
      const split = field.indexOf('=');
      if (split < 1) throw new UsageError(`--field takes name=value, got ${field}.`);
      options.fields.push([field.slice(0, split), field.slice(split + 1)]);
    } else if (arg === '--session-cookie') options.sessionCookie = value();
    else if (arg === '--embed-cross-site') options.crossSite = true;
    else if (arg === '--project') options.project = path.resolve(value());
    else if (arg === '--timeout') options.timeout = Number(value());
    else throw new UsageError(`Unknown argument ${arg}.\n${USAGE}`);
  }
  if (Boolean(options.url) === Boolean(options.app)) throw new UsageError(`Pass exactly one of --url or --app.\n${USAGE}`);
  if (options.url && options.http) throw new UsageError('--http applies to --app only; pass an http:// URL to --url instead.');
  if (options.app && !fs.existsSync(options.app)) throw new UsageError(`${options.app} does not exist.`);
  if (options.url && !/^https?:\/\//.test(options.url)) throw new UsageError('--url takes an http or https URL.');
  if (options.fields.length && !options.login) throw new UsageError('--field needs --login.');
  if (options.sessionCookie && !options.login) throw new UsageError('--session-cookie needs --login.');
  if (options.crossSite && !options.login) throw new UsageError('--embed-cross-site needs --login, to have a session to embed.');
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new UsageError('--timeout takes milliseconds.');
  return options;
}

export function promptingScheme(header) {
  const match = /^\s*(basic|digest)\b/i.exec(String(header ?? '')) ?? /,\s*(basic|digest)\b/i.exec(String(header ?? ''));
  return match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : null;
}

export function defaultPath(url) {
  const pathname = new URL(url).pathname;
  const slash = pathname.lastIndexOf('/');
  return slash <= 0 ? '/' : pathname.slice(0, slash);
}

export function setCookieLines(header) {
  const lines = [];
  for (const raw of String(header ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (lines.length && /expires=[a-z]{3}$/i.test(lines.at(-1)) && !/^[^=;\s]+=/.test(line)) lines[lines.length - 1] += `, ${line}`;
    else lines.push(line);
  }
  return lines;
}

export function cookiesSet(header, url = 'https://app.invalid/', now = Date.now()) {
  const origin = new URL(url).origin;
  return setCookieLines(header)
    .map((line) => {
      const [pair, ...attributes] = line.split(';');
      const name = pair.slice(0, pair.indexOf('=')).trim();
      const attribute = (key) => {
        const found = attributes.map((part) => part.trim()).find((part) => part.toLowerCase().split('=')[0].trim() === key);
        if (found === undefined) return undefined;
        const equals = found.indexOf('=');
        return equals < 0 ? '' : found.slice(equals + 1).trim();
      };
      const maxAge = attribute('max-age');
      const expires = attribute('expires');
      const deleted = (maxAge !== undefined && /^-?\d+$/.test(maxAge) && Number(maxAge) <= 0) || (maxAge === undefined && expires !== undefined && Date.parse(expires) <= now);
      const declaredPath = attribute('path');
      return {
        name,
        origin,
        secure: attribute('secure') !== undefined,
        hostOnly: !attribute('domain'),
        path: declaredPath?.startsWith('/') ? declaredPath : defaultPath(url),
        sameSite: (attribute('samesite') ?? '').toLowerCase() || null,
        deleted,
      };
    })
    .filter((cookie) => cookie.name);
}

export function cookieNames(header) {
  return Object.keys(Object.fromEntries(String(header ?? '').split(';').map((part) => part.trim().split('=')).filter(([name]) => name)));
}

export function pathCovers(cookiePath, pagePath) {
  if (cookiePath === pagePath) return true;
  return pagePath.startsWith(cookiePath) && (cookiePath.endsWith('/') || pagePath[cookiePath.length] === '/');
}

export function sessionCandidates(cookies, { origin, pagePath, sessionCookie = null }) {
  const latest = new Map();
  for (const cookie of cookies) latest.set(`${cookie.origin} ${cookie.name}`, cookie);
  const candidates = [];
  const ignored = [];
  for (const cookie of latest.values()) {
    const why = cookie.origin !== origin
      ? `set by ${cookie.origin}, another origin`
      : cookie.deleted
        ? 'deleted by its Max-Age or Expires'
        : sessionCookie
          ? cookie.name === sessionCookie ? null : 'not the cookie --session-cookie names'
          : !cookie.hostOnly
            ? 'carries a Domain attribute'
            : !pathCovers(cookie.path, pagePath)
              ? `Path=${cookie.path} does not cover ${pagePath}`
              : null;
    if (why) ignored.push({ name: cookie.name, why });
    else candidates.push(cookie);
  }
  return { candidates, ignored };
}

async function loadHandler(file) {
  const module = await import(pathToFileURL(file).href);
  const handler = module.default ?? module.handler;
  if (typeof handler !== 'function') throw new UsageError(`${file} has no default export that is a request handler.`);
  return handler;
}

async function launchWebKit(playwright) {
  try {
    return await playwright.webkit.launch({ headless: true });
  } catch (error) {
    if (/Executable doesn't exist|please run.*playwright install|browserType\.launch: .*not found/i.test(String(error?.message))) {
      throw new UsageError("Playwright is installed but its WebKit browser is not.", WEBKIT_HINT);
    }
    return rethrowSandbox(error, currentCommand());
  }
}

const LOAD_HINT = 'Check that the server is running and, for a remote https URL, that its certificate is valid.';

async function visit(page, url, timeout) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout });
  } catch (error) {
    throw new UsageError(`WebKit could not load ${url}: ${String(error?.message ?? error).split('\n')[0]}`, LOAD_HINT);
  }
  if (!response) throw new UsageError(`WebKit got no response from ${url}.`, LOAD_HINT);
  return response;
}

async function record(response, log, mainFrame) {
  const request = response.request();
  let frame = null;
  try {
    frame = request.frame();
  } catch {
    frame = null;
  }
  const type = request.resourceType();
  const kind = type === 'document' ? (frame && frame !== mainFrame() ? 'iframe' : 'page') : type;
  const entry = { url: response.url(), status: response.status(), type, kind, cookie: '', authorization: false, challenge: null, setCookie: [] };
  log.push(entry);
  try {
    const headers = await response.allHeaders();
    const sent = await request.allHeaders();
    entry.cookie = sent.cookie ?? '';
    entry.authorization = Boolean(sent.authorization);
    entry.challenge = response.status() === 401 || response.status() === 407 ? promptingScheme(headers['www-authenticate'] ?? headers['proxy-authenticate']) : null;
    entry.setCookie = cookiesSet(headers['set-cookie'], response.url());
  } catch {
    entry.unread = true;
  }
}

async function drain(pending) {
  while (pending.length) await Promise.all(pending.splice(0));
}

const settle = (page, timeout) => page.waitForLoadState('load', { timeout }).catch(() => {});

async function submitLogin(page, options, base) {
  await visit(page, new URL(options.login, base).href, options.timeout);
  if (!options.fields.length) throw new UsageError('--login needs at least one --field name=value to fill.');
  for (const [name, value] of options.fields) {
    const field = page.locator(`[name="${name.replace(/"/g, '\\"')}"]`).first();
    if (!(await field.count())) throw new UsageError(`The login page at ${options.login} has no field named ${name}.`);
    await field.fill(value);
  }
  const first = page.locator(`[name="${options.fields[0][0].replace(/"/g, '\\"')}"]`).first();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: options.timeout }).catch(() => {}),
    first.evaluate((input) => (input.form ? input.form.requestSubmit() : input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))),
  ]);
  await settle(page, options.timeout);
}

function storedAsSet(stored, target) {
  return stored.map((cookie) => ({
    name: cookie.name,
    origin: cookie.domain.replace(/^\./, '') === target.hostname ? target.origin : `cookie domain ${cookie.domain}`,
    secure: cookie.secure,
    hostOnly: !cookie.domain.startsWith('.'),
    path: cookie.path,
    sameSite: String(cookie.sameSite ?? '').toLowerCase() || null,
    deleted: false,
  }));
}

async function frameText(page, url) {
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url() === url);
  return frame ? (await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '')).trim() : null;
}

async function reportChallenges(report, log, page, entry, firstText) {
  const challenges = log.filter((item) => item.challenge);
  for (const item of challenges) {
    const url = new URL(item.url);
    const retried = log.some((other) => other.url === item.url && other.authorization);
    const credentials = retried ? 'a retry carried an Authorization header' : 'no request to it carried an Authorization header';
    let shown;
    if (item.kind === 'page') shown = item.url === entry && firstText !== null ? `the page rendered the 401 body (${firstText ? `${firstText.length} characters of text` : 'blank'})` : 'the page rendered the 401 body';
    else if (item.kind === 'iframe') {
      const text = await frameText(page, item.url);
      shown = `the frame rendered the 401 body (${text === null ? 'frame not found' : text ? `${text.length} characters of text` : 'blank'})`;
    } else shown = `the ${item.kind} received the 401`;
    report.error('WS-AUTH-01', `${item.kind} ${url.pathname}${url.search}`, `401 with a ${item.challenge} challenge; ${shown}; ${credentials}`, 'a login page and a session cookie; home-screen web apps, in-app browsers, WebView shells and iframes cannot answer this challenge');
  }
  return { count: challenges.length, seen: log.length };
}

function reportCookie(report, options, login, target, pagePath) {
  if (!login) {
    report.skip('WS-COOKIE-01', pagePath, 'pass --login with --field to test that the session cookie comes back');
    return [];
  }
  const { candidates, ignored } = sessionCandidates(login.set, { origin: target.origin, pagePath, sessionCookie: options.sessionCookie });
  const ignoredText = ignored.length ? `; not counted: ${ignored.map((cookie) => `${cookie.name} (${cookie.why})`).join(', ')}` : '';
  if (!login.set.length) {
    report.error('WS-COOKIE-01', options.login, 'the login set no cookie', 'a session cookie set by the login response; check the fields with --field');
    return [];
  }
  if (!candidates.length) {
    const expected = options.sessionCookie ? `${options.sessionCookie} set by ${target.origin}` : `a host-only cookie from ${target.origin} whose path covers ${pagePath}; name it with --session-cookie if it is another`;
    report.error('WS-COOKIE-01', options.login, `no session cookie among the cookies the login set${ignoredText}`, expected);
    return [];
  }
  const sent = candidates.filter((cookie) => login.sent.includes(cookie.name));
  if (sent.length) {
    report.pass('WS-COOKIE-01', pagePath, `${sent.map((cookie) => cookie.name).join(', ')} sent with the next request${ignoredText}`, 'the session cookie on the next request');
    return sent;
  }
  const storedNames = login.stored.map((cookie) => cookie.name);
  const secureOverHttp = target.protocol === 'http:' ? candidates.filter((cookie) => cookie.secure).map((cookie) => cookie.name) : [];
  const names = candidates.map((cookie) => cookie.name);
  const why = secureOverHttp.length
    ? `${secureOverHttp.join(', ')} is Secure and the page is plain http: WebKit ${secureOverHttp.every((name) => storedNames.includes(name)) ? 'stored it but never sends it' : 'never sends it'}, not even to localhost`
    : `${names.join(', ')} ${names.every((name) => storedNames.includes(name)) ? 'was stored but' : 'was not stored and'} not sent; check its Domain, Path, SameSite and expiry`;
  report.error('WS-COOKIE-01', pagePath, `${why}; the reload landed on ${new URL(login.landed).pathname}${ignoredText}`, secureOverHttp.length ? 'serve the app over HTTPS in tests too (a self-signed certificate is enough)' : 'the session cookie on the next request');
  return [];
}

function reportThirdParty(report, embedded, session) {
  if (!embedded || !session.length) return;
  const where = `iframe on ${embedded.parent}`;
  const missing = session.filter((cookie) => !embedded.sent.includes(cookie.name));
  if (!missing.length) {
    report.pass('WS-WARN-THIRDPARTY', where, `${session.map((cookie) => cookie.name).join(', ')} sent inside a cross-site iframe`, null);
    return;
  }
  const reasons = missing.map((cookie) => (cookie.sameSite === 'none' && cookie.secure
    ? `${cookie.name} is SameSite=None; Secure, so WebKit's third-party cookie blocking withheld it`
    : `${cookie.name} is SameSite=${cookie.sameSite ? cookie.sameSite[0].toUpperCase() + cookie.sameSite.slice(1) : 'Lax by default'}, which every browser withholds from a cross-site iframe; set SameSite=None; Secure to see WebKit's own blocking`));
  report.warn('WS-WARN-THIRDPARTY', where, `${reasons.join('; ')}; the frame showed ${embedded.frameUrl ? new URL(embedded.frameUrl).pathname : 'nothing'}`, 'open the app first-party, embed it from the same site, or ask for the Storage Access API from a tap');
}

async function embedCrossSite(page, entry, target, options, log, pending) {
  const parentUrl = `${target.protocol}//${EMBEDDER_HOST}/`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Embedding page</title></head><body><h1>Embedding page on another site</h1><iframe src="${entry.replace(/"/g, '&quot;')}" width="800" height="600" title="Embedded app"></iframe></body></html>`;
  await page.route(parentUrl, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'Cache-Control': 'no-store' }, body: html }));
  const at = log.length;
  await visit(page, parentUrl, options.timeout);
  await page.waitForTimeout(800);
  await drain(pending);
  await page.unroute(parentUrl);
  const framed = log.slice(at).find((item) => item.kind === 'iframe' && new URL(item.url).origin === target.origin);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  return { parent: EMBEDDER_HOST, sent: cookieNames(framed?.cookie), frameUrl: frame?.url() ?? null };
}

async function signIn(page, context, options, entry, target, log, pending) {
  await drain(pending);
  const before = log.length;
  const known = new Set((await context.cookies()).map((cookie) => `${cookie.name}@${cookie.domain}`));
  await submitLogin(page, options, entry);
  await drain(pending);
  const stored = await context.cookies();
  const fresh = storedAsSet(stored.filter((cookie) => !known.has(`${cookie.name}@${cookie.domain}`)), target);
  const headerSet = log.slice(before).flatMap((item) => item.setCookie);
  const seen = new Set(headerSet.map((cookie) => `${cookie.origin} ${cookie.name}`));
  const set = [...fresh.filter((cookie) => !seen.has(`${cookie.origin} ${cookie.name}`)), ...headerSet];
  const reloadAt = log.length;
  await visit(page, entry, options.timeout);
  await page.waitForTimeout(300);
  await drain(pending);
  const documentRequest = log.slice(reloadAt).find((item) => item.kind === 'page' && new URL(item.url).origin === target.origin);
  return { set, stored, sent: cookieNames(documentRequest?.cookie), landed: page.url() };
}

export async function probe(options, report, { playwright }) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dpm-webkit-'));
  const servers = [];
  let browser;
  try {
    let base = options.url;
    if (options.app) {
      const tls = options.http ? null : createSelfSignedCert(scratch);
      const served = await startServer({ handler: await loadHandler(options.app), tls });
      servers.push(served);
      base = `${options.http ? 'http' : 'https'}://localhost:${served.port}/`;
    }
    const entry = new URL(options.page ?? new URL(base).pathname ?? '/', base).href;
    const target = new URL(entry);
    browser = await launchWebKit(playwright);
    const context = await browser.newContext({ ignoreHTTPSErrors: LOOPBACK.has(target.hostname) });
    const log = [];
    const pending = [];
    const page = await context.newPage();
    context.on('response', (response) => pending.push(record(response, log, () => page.mainFrame())));

    await visit(page, entry, options.timeout);
    await page.waitForTimeout(300);
    await drain(pending);
    const firstText = (await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')).trim();
    const challenged = await reportChallenges(report, log, page, entry, firstText);
    const login = options.login ? await signIn(page, context, options, entry, target, log, pending) : null;
    const later = await reportChallenges(report, log.slice(challenged.seen), page, entry, null);
    if (!challenged.count && !later.count) report.pass('WS-AUTH-01', target.pathname, `${log.length} responses, none with an HTTP Basic or Digest challenge`, 'no challenge anywhere');

    const session = reportCookie(report, options, login, target, target.pathname);
    const embedded = options.crossSite && session.length ? await embedCrossSite(page, entry, target, options, log, pending) : null;
    reportThirdParty(report, embedded, session);
    return report;
  } finally {
    await browser?.close().catch(() => {});
    for (const served of servers) await served.close().catch(() => {});
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const playwright = await loadPlaywright(options.project);
  if (!playwright.webkit) throw new UsageError('This Playwright build has no WebKit.', WEBKIT_HINT);
  const report = createReport({ tool: 'probe-webkit', boundary: BOUNDARY });
  await probe(options, report, { playwright });
  return report.summary();
}

if (isMain(import.meta.url)) await runMain(main, { command: currentCommand() });
