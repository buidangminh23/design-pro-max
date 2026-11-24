# Testing the popup

## Contents

- What the checker proves
- Running it
- Flags
- A popup that does not use the lib
- Reading the output
- What to check by hand

## What the checker proves

| Rule | The checker | Does not prove |
|---|---|---|
| [WN-DIALOG-01] | a modal dialog is open (`dialog:modal` or `role="dialog"` with `aria-modal`), it has an accessible name and a named close button, focus is inside, Escape closes it, focus goes back to where it was | what VoiceOver or another screen reader announces |
| [WN-NAV-01] | one page has no arrows, dots or counter; several have named previous and next buttons and an "N of M" label; next and previous change the page; the ends are disabled and still visible; the last primary button closes | swipe gestures on a touch screen |
| [WN-LAYOUT-01] | the card's box and the media frame's ratio on every page, at each viewport | how it looks in a real Tauri or Capacitor WebView |
| [WN-MEDIA-01] | every video is muted, inline and has a poster; only the current one plays; a long loop has a named pause control | the clip's content, or playback on a device |
| [WN-MOTION-01] | in a reduced-motion context, no video plays by itself and a page change has no transform or a zero-length transition | the system setting itself, or a SwiftUI sheet |
| [WN-TARGET-01] | the close, arrow and primary buttons and each dot's hit area are at least 24x24 CSS px | touch accuracy on a device |
| [WN-ONCE-01] | three loads in one context: empty storage opens nothing and stores the version, an older version opens it and is not stored until dismissal, a reload after dismissal opens nothing | storage on a device, or a Swift `UserDefaults` store |

The warnings [WN-WARN-COUNT], [WN-WARN-AUTOADVANCE], [WN-WARN-TARGET44], [WN-WARN-CONTRAST] and [WN-WARN-TEXT] are reported at the `warn` level and never fail the run.

All of it runs in Playwright's Chromium, or its WebKit with `--browser webkit`, at the viewports it used. It does not check SwiftUI code: read that against PART.md section 3 and type-check it (`references/swiftui.md`).

## Running it

Install Playwright in the project once: `npm install --save-dev playwright`, then `npx playwright install chromium-headless-shell` (and `npx playwright install webkit` for `--browser webkit`). Then, from the project folder:

```
node <part folder>/scripts/check-whats-new.mjs --url http://localhost:5173/ --project .
node <part folder>/scripts/check-whats-new.mjs --serve dist --page index.html --project .
node <part folder>/scripts/check-whats-new.mjs --url http://localhost:5173/settings --open "#whats-new-item" --project .
node <part folder>/scripts/check-whats-new.mjs --url http://localhost:5173/ --project . --only WN-ONCE-01,WN-NAV-01
```

For a Tauri or Capacitor app, check the web UI from its dev server or its built frontend folder; the shell itself is out of reach, see `../../web-shells/PART.md` for testing in WebKit.

## Flags

| Flag | Meaning |
|---|---|
| `--url <url>` | a page that is already being served |
| `--serve <folder>` with `--page <path>` | serve a built folder locally and open that page; `--server range` or `200` picks how it serves (default `range`) |
| `--page <file>` alone | serve one local HTML file from its folder |
| `--project <folder>` | where Playwright is installed (default: the current folder) |
| `--browser chromium` or `webkit` | the engine (default: Chromium) |
| `--viewport WxH` | the viewport, repeatable (default `1280x900`) |
| `--open <selector>` | click this element to open the popup; without it the page must open the popup on load after an update |
| `--storage-key <key>` | the storage key the app uses (default: the lib's `whats-new:last-seen`) |
| `--version <version>` | the app's current version, the value the popup should store on dismissal |
| `--only <rule,...>` | run only these rules |
| `--dialog`, `--card`, `--close`, `--prev`, `--next`, `--dot`, `--primary`, `--pages`, `--media`, `--pause`, `--desc` | CSS selectors for a custom popup |

The reduced-motion checks run in a second browser context with reduced motion on; there is no flag for it. For the once-per-version check the checker seeds storage with an older version (`0.0.0-wn-check`) so an update is what it sees; a page that never reads storage, or reads another key than `--storage-key`, fails [WN-ONCE-01].

## A popup that does not use the lib

The checker finds the dialog by its role (`dialog:modal` or `role="dialog"` with `aria-modal="true"`) and the buttons by their accessible names or by the lib's classes. A popup built another way usually needs only the selectors that differ:

```
node <part folder>/scripts/check-whats-new.mjs --url http://localhost:3000/ --project . \
  --dialog "[data-testid=whats-new]" --next "[data-testid=wn-next]" --prev "[data-testid=wn-prev]" \
  --dot "[data-testid=wn-dot]" --primary "[data-testid=wn-done]" --close "[data-testid=wn-close]"
```

A failure on a custom popup can mean the popup is wrong or that a selector points at the wrong element: read `where` and `measured` before changing the popup.

## Reading the output

Each finding is a JSON line `{rule, level, where, measured, expected}`, then a summary with the counts and the proof boundary. Exit 0 passes, 1 means an error rule failed, 2 a missing tool or bad usage (the install command is printed), 3 a sandbox block: ask the user to approve a rerun outside the sandbox or to run the printed command. Quote the proof boundary in the report.

## What to check by hand

- Install the new version over the previous one on a Mac or a device and open the app: the popup appears once, after the first screen, and not again after it is closed.
- Delete the app's stored settings and launch: nothing appears.
- Reopen it from the menu or the settings row.
- Turn on VoiceOver: the title is read, the page count is announced, the dots adjust, nothing on a hidden page is read.
- Turn on Reduce Motion: pages change without sliding, clips wait for a tap.
- In the shipped WebView (Tauri, Capacitor), play a page with video: muted autoplay works, the poster shows if it is blocked.
