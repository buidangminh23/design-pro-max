# Sign-in and cookies

## Contents

- Why HTTP Basic Auth fails here
- A login page and a session cookie
- Cookie attributes
- Iframes on another site
- In-app browsers and separate storage
- Sources

## Why HTTP Basic Auth fails here

A server answers HTTP Basic or Digest Auth with 401 and a `WWW-Authenticate` header, and a browser is expected to prompt for a user name and password and retry. A web app opened from the Home Screen, an in-app browser, a WKWebView shell and an iframe on iOS cannot show that prompt: the 401 body renders instead, usually an empty page, and a `fetch` to the protected URL resolves with 401 and never asks (IL-27). Nothing the user does on the device gets past it.

So every page, frame and request such an app makes must answer without a challenge [WS-AUTH-01]. The same applies to Basic Auth on a reverse proxy or a hosting provider's password protection in front of a staging site: move it behind the app's own login, or keep that staging site out of anything a device opens.

## A login page and a session cookie

`../assets/login/app.mjs` is the reference, built on Node's standard library:

1. A protected path without a valid session redirects (303) to `/login?next=<path>`.
2. `/login` is an ordinary HTML form with `autocomplete="username"` and `autocomplete="current-password"`, so password managers and passkey prompts work inside web apps and shells.
3. A POST to `/login` checks the credentials with the project's own `verify(user, password)`, stores a random session id on the server, sets it in a cookie, and redirects to `next` (only a same-site path).
4. `/logout` deletes the server-side session and expires the cookie.

```js
import https from 'node:https';
import { createLoginApp } from './app.mjs';

const handle = createLoginApp({ verify: (user, password) => users.check(user, password) });
https.createServer({ key, cert }, handle).listen(8443);
```

Token-based apps work too, provided the token is not sent through an HTTP challenge. Identity providers that sign in through a redirect work in a home-screen web app and in a shell that lets the provider's pages load in its WebView; providers that refuse embedded WebViews need the system authentication session in a native shell.

## Cookie attributes

| Attribute | Use | Why |
|---|---|---|
| `HttpOnly` | always for a session | scripts cannot read it |
| `Secure` | always | sent only over HTTPS; in WebKit a Secure cookie set over plain http is stored but never sent, localhost included, unlike the localhost exception other engines make (IL-27) |
| `SameSite=Lax` | the default choice | sent on top-level navigation and same-site requests, including a same-site iframe |
| `Path=/` | usually | one session for the whole app |
| `Max-Age` | a bounded lifetime | long-lived web apps need a renewal path, not a session that never ends |

The consequence for tests: an app with Secure session cookies must be served over HTTPS in development and in tests, with a self-signed certificate if needed [WS-COOKIE-01]. A test that passes in Chromium over plain http on localhost proves nothing for WebKit.

## Iframes on another site

Safari blocks cookies for cross-site resources by default, so an app signed in inside an iframe on another site sees no session, whatever its SameSite value (IL-27) [WS-WARN-THIRDPARTY]. Options, in order:

1. Open the app first-party (a link or a new window) instead of framing it.
2. Embed it from a page on the same site (the same registrable domain).
3. Inside the iframe, call `document.requestStorageAccess()` from a tap, after the user has used the app first-party; this needs the cookie to be `SameSite=None; Secure`.

## In-app browsers and separate storage

Links opened inside other apps often load in that app's own WebView or browser view, with its own cookie storage and no access to the user's Safari session; a home-screen web app keeps its own storage too. Expect users to sign in again there, keep the login page reachable from every protected URL, and never rely on a credential prompt [WS-AUTH-01].

## Sources

- MDN, WWW-Authenticate: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/WWW-Authenticate
- MDN, Set-Cookie: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- WebKit, full third-party cookie blocking: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
