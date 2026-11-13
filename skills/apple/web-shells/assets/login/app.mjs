/**
 * web-shells login reference (design-pro-max): a login page and a session cookie instead of HTTP Basic Auth, so the
 * app signs in inside a home-screen web app, an in-app browser, a WebView shell and a same-site iframe, none of which
 * can show a Basic Auth prompt. Node's standard library only.
 *
 *   import https from 'node:https';
 *   import { createLoginApp } from './app.mjs';
 *   const handle = createLoginApp({ verify: async (user, password) => checkAgainstYourStore(user, password) });
 *   https.createServer({ key, cert }, handle).listen(8443);
 *
 * Serve it over HTTPS, in development too: the cookie is Secure, and WebKit never sends a Secure cookie over plain
 * http, not even to localhost. Put your own pages behind isSignedIn() or the protected prefix. The default export is
 * a demo that accepts the user "demo" with the password "demo"; it exists for probe-webkit.mjs and must never ship.
 */
import crypto from 'node:crypto';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const page = (title, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<meta name="color-scheme" content="light dark"><title>${escapeHtml(title)}</title>` +
  `<style>body{font:1rem/1.5 system-ui,sans-serif;margin:0;padding:2rem 1rem;display:grid;place-items:start center}` +
  `form,main{width:min(100%,24rem);display:grid;gap:.75rem}input,button{font:inherit;padding:.75rem;border-radius:.5rem;border:1px solid #8a8a8f}` +
  `button{background:#0b57d0;color:#fff;border-color:#0b57d0}p[role=alert]{color:#b3261e}</style></head><body>${body}</body></html>`;

function loginPage(next, failed) {
  return page('Sign in', `<form method="post" action="/login" autocomplete="on">
<h1>Sign in</h1>
${failed ? '<p role="alert">That user name and password do not match.</p>' : ''}
<input type="hidden" name="next" value="${escapeHtml(next)}">
<label>User name <input name="user" autocomplete="username" autocapitalize="none" required></label>
<label>Password <input name="password" type="password" autocomplete="current-password" required></label>
<button type="submit">Sign in</button>
</form>`);
}

const defaultHome = (user) => page('Dashboard', `<main><h1>Dashboard</h1><p>Signed in as ${escapeHtml(user)}.</p><form method="post" action="/logout"><button type="submit">Sign out</button></form></main>`);

function readForm(request, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('form too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(new URLSearchParams(body)));
    request.on('error', reject);
  });
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies;
}

const SAME_ORIGIN = 'https://app.invalid';

export function safeNext(value, fallback) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  let resolved;
  try {
    resolved = new URL(value, SAME_ORIGIN);
  } catch {
    return fallback;
  }
  return resolved.origin === SAME_ORIGIN && !resolved.pathname.startsWith('//') ? resolved.pathname + resolved.search : fallback;
}

export function createLoginApp({ verify, home = '/app/', protect = '/app', cookieName = 'session', maxAgeSeconds = 8 * 60 * 60, sameSite = 'Lax', render = defaultHome } = {}) {
  if (typeof verify !== 'function') throw new TypeError('createLoginApp needs a verify(user, password) function');
  if (!['Lax', 'Strict', 'None'].includes(sameSite)) throw new TypeError('sameSite must be Lax, Strict or None');
  const sessions = new Map();
  const sessionCookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
  const userOf = (request) => {
    const id = parseCookies(request.headers.cookie)[cookieName];
    const session = id && sessions.get(id);
    if (!session || session.expires < Date.now()) return null;
    return session.user;
  };
  const send = (response, status, headers, body = '') => {
    response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8', ...headers });
    response.end(body);
  };
  const handler = async (request, response) => {
    const url = new URL(request.url ?? '/', SAME_ORIGIN);
    try {
      if (url.pathname === '/login' && request.method === 'POST') {
        const form = await readForm(request);
        const next = safeNext(form.get('next'), home);
        const user = String(form.get('user') ?? '');
        if (!(await verify(user, String(form.get('password') ?? '')))) return send(response, 401, {}, loginPage(next, true));
        const id = crypto.randomBytes(32).toString('base64url');
        sessions.set(id, { user, expires: Date.now() + maxAgeSeconds * 1000 });
        return send(response, 303, { 'Set-Cookie': sessionCookie(id, maxAgeSeconds), Location: next });
      }
      if (url.pathname === '/login') return send(response, 200, {}, loginPage(safeNext(url.searchParams.get('next'), home), false));
      if (url.pathname === '/logout' && request.method === 'POST') {
        sessions.delete(parseCookies(request.headers.cookie)[cookieName]);
        return send(response, 303, { 'Set-Cookie': sessionCookie('', 0), Location: '/login' });
      }
      if (url.pathname === '/' || url.pathname.startsWith(protect)) {
        const user = userOf(request);
        if (!user) return send(response, 303, { Location: `/login?next=${encodeURIComponent(url.pathname === '/' ? home : url.pathname + url.search)}` });
        if (url.pathname === '/') return send(response, 303, { Location: home });
        return send(response, 200, {}, render(user, url));
      }
      return send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'not found');
    } catch {
      return send(response, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'bad request');
    }
  };
  handler.isSignedIn = (request) => userOf(request) !== null;
  return handler;
}

export default createLoginApp({ verify: (user, password) => user === 'demo' && password === 'demo' });
