# Testing in WebKit

## Contents

- What each check proves
- Running the probe
- Reading the output
- HTTPS for tests
- On a simulator or a device

## What each check proves

| Check | Proves | Does not prove |
|---|---|---|
| `check-shell.mjs` | which origin each Capacitor or Tauri config, native copy and built bundle names; dev hosts and stale bundles [WS-ORIGIN-01] [WS-ORIGIN-02] [WS-BUNDLE-01] | what a device loads at run time, a URL computed at build time, a Tauri binary's embedded config |
| `probe-webkit.mjs` | HTTP challenges, whether a session cookie comes back, cookies in a cross-site iframe, in Playwright's WebKit [WS-AUTH-01] [WS-COOKIE-01] | iOS Safari, a home-screen web app, WKWebView inside the shell, in-app browsers, devices |

Playwright's WebKit is close to Safari's engine and treats Secure cookies, challenges and cross-site frames the way the device does (IL-27), which Chromium does not, so test sign-in there before blaming the shell.

## Running the probe

Install Playwright and its WebKit in the project once: `npm install --save-dev playwright`, then `npx playwright install webkit` (on Linux CI add `--with-deps`). Then, from the project folder:

```
node <part folder>/scripts/probe-webkit.mjs --url https://localhost:8443/app/ --project .
node <part folder>/scripts/probe-webkit.mjs --url https://localhost:8443/app/ --login /login --field user=<name> --field password=<password> --project .
node <part folder>/scripts/probe-webkit.mjs --app server/handler.mjs --page /app/ --login /login --field user=<name> --field password=<password> --embed-cross-site --project .
```

- `--url` probes a server that is already running; a loopback HTTPS server may use a self-signed certificate.
- `--app` imports a module whose default export is a Node request handler and serves it over HTTPS with a certificate made at run time (`--http` serves plain http, to show what WebKit does then).
- `--login` opens that path, fills each `--field` by its `name`, submits the form and reloads the page; the probe then checks the session cookie came back [WS-COOKIE-01].
- `--embed-cross-site` loads the page inside an iframe on another site after the login [WS-WARN-THIRDPARTY].

Use test credentials the user provides for this, never real ones, and leave them out of the report.

## Reading the output

| Finding | Meaning | Fix |
|---|---|---|
| WS-AUTH-01 error, 401 with a Basic challenge | the page or a request needs a credential prompt no web app or shell can show | a login page and a session cookie (`auth-and-cookies.md`) |
| WS-COOKIE-01 error, Secure over plain http | the cookie was stored but never sent, so the app looks signed out | serve over HTTPS, a self-signed certificate is enough |
| WS-COOKIE-01 error, not stored | Domain, Path, SameSite or expiry stops the cookie | set it host-only with `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax` |
| WS-COOKIE-01 error, no cookie set | the login failed or the field names are wrong | check `--field` names against the form |
| WS-WARN-THIRDPARTY | the session is missing inside an iframe on another site | open first-party, embed same-site, or request storage access from a tap |

## HTTPS for tests

For a Node or Vite dev server, generate a throwaway certificate in a temporary folder and never commit the key:

```
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -keyout "$TMPDIR/dev-key.pem" -out "$TMPDIR/dev-cert.pem"
```

In Playwright tests, allow that certificate with `ignoreHTTPSErrors: true` for the loopback host only, and use `webkit` as one of the projects so sign-in runs in WebKit as well as Chromium.

## On a simulator or a device

The probe stops at Playwright's WebKit. To close the gap, after the checks pass:

1. Build the shell again (`npx cap sync ios`, then build in Xcode) and run `check-shell.mjs --bundle` on the built app [WS-BUNDLE-01].
2. Open it on a simulator whose runtime the installed Xcode covers (IL-26), sign in, quit and reopen it.
3. For a home-screen web app, add the site to the Home Screen on a device, open it from the icon and sign in there.
4. To inspect the WebView, use Safari's Develop menu; a release WKWebView must opt in to inspection, so use a debug build.

Report which of these the user still has to do by hand.
