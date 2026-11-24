# Shells and origins

## Contents

- Home-screen web apps
- Capacitor: bundled or remote
- Syncing, rebuilding and reading the built config
- Tauri on the Mac
- Push
- Sources

## Home-screen web apps

On iOS and iPadOS 26 and later, any site added to the Home Screen opens as a web app by default; the user can switch that off to save a bookmark instead, and no manifest is required. Earlier versions open it as a web app only when it links a manifest whose `display` is `standalone` or `fullscreen`. Either way the manifest sets the name, icon, start URL, scope and display, so ship one, and serve the site over HTTPS. `../assets/config/manifest.webmanifest` is a starting point: set `name`, `short_name`, `start_url`, `scope`, the colours and the user's own icons (a square PNG set, one marked maskable).

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#ffffff">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
```

What it gives: an icon, a window without browser chrome, and on iPhone and iPad the only route to Web Push, once the user taps to allow it [WS-WARN-PUSH]. What it does not give: an App Store listing, native plugins, or background work. A home-screen web app keeps its own storage, so a user who signed in to the site in the browser may have to sign in again inside it; a login page handles that, HTTP Basic Auth does not [WS-AUTH-01].

Third-party browsers on iOS can offer Add to Home Screen too.

## Capacitor: bundled or remote

Capacitor runs the web app in a WKWebView on iOS. Two modes:

| | Bundled | Remote |
|---|---|---|
| What the app loads | the build copied from `webDir` | the origin in `server.url` |
| A web change reaches users | after a rebuild and App Review | at the next deploy |
| Works offline | yes, for what the build holds | only the `server.errorPath` page |
| What Capacitor documents for production | this | not this: its docs say `server.url` is meant for live-reload servers |

In remote mode keep one origin, the production one, in the config that ships [WS-ORIGIN-01], and never a development host [WS-ORIGIN-02]. Point `webDir` at a folder that holds only an offline page (`../assets/config/offline.html`), so the app never carries a frozen copy of the site it would open if the URL were dropped [WS-WARN-BUNDLED]:

```json
{
  "appId": "com.example.app",
  "appName": "Example",
  "webDir": "shell",
  "server": { "url": "https://app.example.com", "errorPath": "offline.html" }
}
```

Live reload belongs in a separate, uncommitted config or an environment switch read at sync time; `server.cleartext` and `server.allowNavigation` are also documented as not for production, and `check-shell.mjs` warns when a shipping config sets them [WS-ORIGIN-02]. Keep one config file: the Capacitor CLI reads `capacitor.config.ts`, then `.js`, then `.json`, and ignores the rest, so the check warns when it finds more than one. A server URL that `capacitor.config.ts` computes (a ternary, a variable, an environment read) is resolved at sync time: the check skips it with its reason rather than guess, so judge the built app instead [WS-BUNDLE-01].

Before building a remote shell, tell the user that App Review guideline 4.2 asks an app to be more than a repackaged website: plan the native features that justify the listing, or choose a home-screen web app.

## Syncing, rebuilding and reading the built config

`npx cap copy` copies the web build and the config into the native project; `npx cap sync` runs copy and then updates native plugins. Neither changes an app that was already built: it keeps the config it was built with until Xcode builds it again, and a stale server URL then shows as a WebView that cannot connect (error -1004) (IL-26).

After every change to `server.url`: run `npx cap sync ios`, build again in Xcode, then read the config the app actually carries:

```
node <part folder>/scripts/check-shell.mjs --project . --bundle ios/build --expect-origin https://app.example.com
unzip -o App.ipa -d app-unzipped && node <part folder>/scripts/check-shell.mjs --project . --bundle app-unzipped --expect-origin https://app.example.com
```

The built `.app` usually sits under Xcode's DerivedData, in `Build/Products/<configuration>-iphonesimulator` or `-iphoneos`; pass that folder. The check compares the project's config, the native project's copy (`ios/App/App/capacitor.config.json`) and the built bundle, and names the one that differs.

If `xcodebuild` reports a simulator runtime as not installed although the Simulator app shows it, the runtime is newer than the installed Xcode's SDK: pick a simulator whose runtime the SDK covers, or update Xcode (IL-26).

## Tauri on the Mac

Tauri runs the web app in WKWebView on macOS. In `tauri.conf.json`:

- `build.devUrl` is for development only and may point at localhost.
- `build.frontendDist` is a folder whose files are embedded in the app, or a URL, in which case no assets are embedded.
- `app.windows[].url` takes an app path or an external `https` URL.

A remote Tauri app sets the window URL to the production origin and keeps `frontendDist` on the offline page (`../assets/config/tauri.conf.json`) [WS-ORIGIN-01]. Platform files such as `tauri.macos.conf.json` and `tauri.ios.conf.json` are merged over the base config as JSON merge patches, so a development URL in one of them ships on that platform; `check-shell.mjs` merges and judges each one, and skips `tauri.conf.json5` and `Tauri.toml` files with a reason because it does not parse them [WS-ORIGIN-02]. Tauri warns that granting a remote origin access to its commands (a capability with `remote` URLs) gives a website local system access: grant only the commands the app needs, to the one production origin. The built Tauri binary embeds its config, so `check-shell.mjs` reads the project's config only.

## Push

WKWebView, in a Capacitor or Tauri shell or in another app, has no Web Push. On iPhone and iPad, Safari gives Web Push only to web apps added to the Home Screen; on the Mac, Safari gives it to sites in the browser too. A shell uses a native remote-push plugin and the platform's notification service (a local-notifications plugin cannot receive a push); a home-screen web app asks for permission from a tap and uses Web Push. `check-shell.mjs` warns when web code subscribes to Web Push in a project with a shell and no remote-push plugin [WS-WARN-PUSH].

## Sources

- Capacitor config: https://capacitorjs.com/docs/config
- Capacitor copy and sync: https://capacitorjs.com/docs/cli/commands/copy, https://capacitorjs.com/docs/cli/commands/sync
- Tauri configuration: https://v2.tauri.app/reference/config/
- Tauri platform-specific configuration: https://v2.tauri.app/develop/configuration-files/
- Sites open as web apps from the Home Screen by default (iOS and iPadOS 26): https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Web Push in Safari on the Mac: https://webkit.org/blog/12945/meet-web-push/
- Web Push for Home Screen web apps: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- App Review Guidelines, 4.2: https://developer.apple.com/app-store/review/guidelines/
