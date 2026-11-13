/**
 * web-shells WebKit probe: loads an app in Playwright's WebKit the way a home-screen web app, an in-app browser or a
 * WebView shell would, with no way to answer a credential prompt, and reports how it authenticates.
 *
 *   node probe-webkit.mjs --url <https url> [--page <path>] [--login <path> --field name=value ...] [--embed-cross-site] --project <folder>
 *   node probe-webkit.mjs --app <handler module> [--http] [--page <path>] [--login <path> --field name=value ...] [--embed-cross-site] --project <folder>
 *
 * --app serves a module whose default export is a Node request handler, over HTTPS with a certificate made at run
 * time in the temp folder (--http serves it over plain http instead). --login opens that path, fills the named fields,
 * submits the form and then reloads the page. --embed-cross-site then loads the page inside an iframe of a page on
 * another site. Playwright and its WebKit come from --project.
 *
 * Errors: WS-AUTH-01, a document or request answered 401 with an HTTP Basic or Digest challenge; WS-COOKIE-01, a login
 * whose session cookie does not come back with the next request (named when it is a Secure cookie over plain http).
 * Warning: WS-WARN-THIRDPARTY, the session cookie is not sent inside a cross-site iframe. Output follows the shared
 * checker contract.
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
  'it does not prove iOS Safari, a home-screen web app, WKWebView inside a shell, in-app browsers, or real devices.';

export const WEBKIT_HINT = INSTALL_HINT.replace('chromium-headless-shell', 'webkit');
const USAGE = 'Usage: node probe-webkit.mjs (--url <url> | --app <module>) [--http] [--page <path>] [--login <path> --field name=value ...] [--embed-cross-site] --project <folder>';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function parseArgs(argv) {
  const options = { url: null, app: null, http: false, page: null, login: null, fields: [], crossSite: false, project: process.cwd(), timeout: 15000 };
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
    } else if (arg === '--embed-cross-site') options.crossSite = true;
    else if (arg === '--project') options.project = path.resolve(value());
    else if (arg === '--timeout') options.timeout = Number(value());
    else throw new UsageError(`Unknown argument ${arg}.\n${USAGE}`);
  }
  if (Boolean(options.url) === Boolean(options.app)) throw new UsageError(`Pass exactly one of --url or --app.\n${USAGE}`);
  if (options.url && options.http) throw new UsageError('--http applies to --app only; pass an http:// URL to --url instead.');
  if (options.app && !fs.existsSync(options.app)) throw new UsageError(`${options.app} does not exist.`);
  if (options.url && !/^https?:\/\//.test(options.url)) throw new UsageError('--url takes an http or https URL.');
  if (options.fields.length && !options.login) throw new UsageError('--field needs --login.');
  if (options.crossSite && !options.login) throw new UsageError('--embed-cross-site needs --login, to have a session to embed.');
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new UsageError('--timeout takes milliseconds.');
  return options;
}

/** The challenge scheme of a WWW-Authenticate header that makes a browser prompt for credentials, or null. */
export function promptingScheme(header) {
  const match = /^\s*(basic|digest)\b/i.exec(String(header ?? '')) ?? /,\s*(basic|digest)\b/i.exec(String(header ?? ''));
  return match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : null;
}

/** Names and Secure flags of the cookies a Set-Cookie header (one per line in Playwright's headers) sets. */
export function cookiesSet(header) {
  return String(header ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pair, ...attributes] = line.split(';');
      const name = pair.slice(0, pair.indexOf('=')).trim();
      const lower = attributes.map((attribute) => attribute.trim().toLowerCase());
      return { name, secure: lower.includes('secure'), expired: lower.some((attribute) => /^max-age=0$/.test(attribute)) };
    })
    .filter((cookie) => cookie.name && !cookie.expired);
}

export function cookieNames(header) {
  return Object.keys(Object.fromEntries(String(header ?? '').split(';').map((part) => part.trim().split('=')).filter(([name]) => name)));
}

/** The other loopback name, so a parent page is a different site from the app; any loopback name for a remote app. */
export function otherSite(hostname) {
  return hostname === 'localhost' ? '127.0.0.1' : 'localhost';
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

function watch(context, log, pending) {
  context.on('response', (response) => pending.push(record(response, log)));
}

async function record(response, log) {
  const request = response.request();
  const entry = { url: response.url(), status: response.status(), type: request.resourceType(), cookie: '', challenge: null, setCookie: [] };
  log.push(entry);
  try {
    const headers = await response.allHeaders();
    const sent = await request.allHeaders();
    entry.cookie = sent.cookie ?? '';
    entry.challenge = response.status() === 401 || response.status() === 407 ? promptingScheme(headers['www-authenticate'] ?? headers['proxy-authenticate']) : null;
    entry.setCookie = cookiesSet(headers['set-cookie']);
  } catch {
    entry.unread = true;
  }
}

async function drain(pending) {
  while (pending.length) await Promise.all(pending.splice(0));
}

const settle = (page, timeout) => page.waitForLoadState('load', { timeout }).catch(() => {});

async function submitLogin(page, options, base) {
  await page.goto(new URL(options.login, base).href, { waitUntil: 'load', timeout: options.timeout });
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

export async function probe(options, report, { playwright }) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dpm-webkit-'));
  const servers = [];
  let browser;
  try {
    let base = options.url;
    let tls = null;
    if (options.app) {
      tls = options.http ? null : createSelfSignedCert(scratch);
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
    watch(context, log, pending);
    let prompts = 0;
    const page = await context.newPage();
    page.on('dialog', (dialog) => {
      prompts += 1;
      dialog.dismiss().catch(() => {});
    });

    await page.goto(entry, { waitUntil: 'load', timeout: options.timeout }).catch((error) => {
      throw new UsageError(`WebKit could not load ${entry}: ${error.message.split('\n')[0]}`);
    });
    await page.waitForTimeout(300);
    const firstText = (await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')).trim();

    let login = null;
    if (options.login) {
      await drain(pending);
      const before = log.length;
      const known = new Set((await context.cookies()).map((cookie) => `${cookie.name}@${cookie.domain}`));
      await submitLogin(page, options, entry);
      await drain(pending);
      const stored = await context.cookies();
      const fresh = stored.filter((cookie) => !known.has(`${cookie.name}@${cookie.domain}`)).map((cookie) => ({ name: cookie.name, secure: cookie.secure }));
      const setDuringLogin = [...log.slice(before).flatMap((item) => item.setCookie), ...fresh];
      const reloadAt = log.length;
      await page.goto(entry, { waitUntil: 'load', timeout: options.timeout });
      await page.waitForTimeout(300);
      await drain(pending);
      const documentRequest = log.slice(reloadAt).find((item) => item.type === 'document' && new URL(item.url).origin === target.origin);
      login = { set: setDuringLogin, stored, sent: cookieNames(documentRequest?.cookie), landed: page.url() };
    }

    let embedded = null;
    if (options.crossSite && login) {
      const parentTls = tls ?? createSelfSignedCert(scratch);
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Embedding page</title></head><body><h1>Embedding page on another site</h1><iframe src="${entry.replace(/"/g, '&quot;')}" width="800" height="600" title="Embedded app"></iframe></body></html>`;
      const parent = await startServer({ tls: parentTls, handler: (request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(html);
      } });
      servers.push(parent);
      const parentUrl = `https://${otherSite(target.hostname)}:${parent.port}/`;
      const at = log.length;
      await page.goto(parentUrl, { waitUntil: 'load', timeout: options.timeout });
      await page.waitForTimeout(800);
      await drain(pending);
      const framed = log.slice(at).find((item) => item.type === 'document' && new URL(item.url).origin === target.origin);
      const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
      embedded = { parent: new URL(parentUrl).host, sent: cookieNames(framed?.cookie), frameUrl: frame?.url() ?? null };
    }

    await drain(pending);
    const challenges = log.filter((item) => item.challenge);
    for (const item of challenges) {
      const where = new URL(item.url).pathname + new URL(item.url).search;
      report.error('WS-AUTH-01', `${item.type} ${where}`, `${item.status} with a ${item.challenge} challenge; WebKit showed ${prompts ? 'a' : 'no'} prompt and rendered ${item.type === 'document' && !firstText ? 'a blank page' : 'the error body'}`, 'a login page and a session cookie; home-screen web apps, in-app browsers, WebView shells and iframes cannot answer this prompt');
    }
    if (!challenges.length) report.pass('WS-AUTH-01', new URL(entry).pathname, `${log.length} responses, none with an HTTP Basic or Digest challenge`, 'no credential prompt anywhere');

    if (!login) report.skip('WS-COOKIE-01', new URL(entry).pathname, 'pass --login with --field to test that the session cookie comes back');
    else {
      const names = [...new Set(login.set.map((cookie) => cookie.name))];
      const missing = names.filter((name) => !login.sent.includes(name));
      const secureOverHttp = target.protocol === 'http:' ? login.set.filter((cookie) => cookie.secure && missing.includes(cookie.name)).map((cookie) => cookie.name) : [];
      const storedNames = login.stored.map((cookie) => cookie.name);
      if (!names.length) report.error('WS-COOKIE-01', options.login, 'the login set no cookie', 'a session cookie set by the login response; check the fields with --field');
      else if (missing.length) {
        const why = secureOverHttp.length
          ? `${secureOverHttp.join(', ')} is Secure and the page is plain http: WebKit ${secureOverHttp.every((name) => storedNames.includes(name)) ? 'stored it but never sends it' : 'never sends it'}, not even to localhost`
          : `${missing.join(', ')} ${missing.every((name) => storedNames.includes(name)) ? 'was stored but' : 'was not stored and'} not sent; check its Domain, Path, SameSite and expiry`;
        report.error('WS-COOKIE-01', new URL(entry).pathname, `${why}; the reload landed on ${new URL(login.landed).pathname}`, secureOverHttp.length ? 'serve the app over HTTPS in tests too (a self-signed certificate is enough)' : 'the session cookie on the next request');
      } else report.pass('WS-COOKIE-01', new URL(entry).pathname, `${names.join(', ')} sent with the next request`, 'the session cookie on the next request');
    }

    if (options.crossSite && embedded) {
      const names = [...new Set((login?.set ?? []).map((cookie) => cookie.name))];
      const sent = names.filter((name) => embedded.sent.includes(name));
      if (names.length && sent.length < names.length) report.warn('WS-WARN-THIRDPARTY', `iframe on ${embedded.parent}`, `${names.filter((name) => !sent.includes(name)).join(', ')} not sent inside a cross-site iframe; the frame showed ${embedded.frameUrl ? new URL(embedded.frameUrl).pathname : 'nothing'}`, 'open the app first-party, embed it from the same site, or ask for the Storage Access API from a tap');
      else if (names.length) report.pass('WS-WARN-THIRDPARTY', `iframe on ${embedded.parent}`, `${sent.join(', ')} sent inside a cross-site iframe`, null);
    }
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
