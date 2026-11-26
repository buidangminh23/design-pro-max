# When it shows, and what it stores

## Contents

- Once per version
- First install
- Marking it seen
- Skipped versions and downgrades
- When to present it
- The reopen item
- Menu-bar-only Mac apps
- Web, React and Tauri wiring
- Storage that fails

## Once per version

The app keeps one value: the version whose What's New the person last dismissed. On launch it compares that value with its own version [WN-ONCE-01]:

| Stored value | Meaning | Do |
|---|---|---|
| none | a first install | store the current version silently, show nothing |
| the current version | already seen | show nothing |
| anything else | an update | show the popup once the first screen has loaded |

Use the version people see, not the build number: `CFBundleShortVersionString` on Apple platforms (not `CFBundleVersion`), the app version in Tauri (`getVersion()`), or the version the web app is built with. A build-number bump with no visible change must not show the popup again.

Ship one feature list per version, inside the app. A patch release with nothing new to show ships an empty list: the app then stores the version and shows nothing, so the next minor release still counts as an update.

## First install

A fresh install has no stored value. It is not an update: a new user has nothing to compare with, and a list of "new" features they never saw before reads as noise. Store the current version and show nothing; the first-run flow, if the app has one, is onboarding, which this part does not cover [WN-ONCE-01].

If the app adds this popup to a version that is already installed widely, people updating from a version without it also have no stored value, and the rule above hides the popup from them. When that matters, read a value the old version already left behind (a settings file, a database, a key that every past version wrote) and treat its presence as "updated from an earlier version". Never show it to every user without a stored value.

## Marking it seen

Store the current version when the popup is dismissed, by the close button, Escape, the last page's primary button or a swipe down on iOS; never when it opens [WN-ONCE-01]. A crash or a force quit before dismissal then shows it again on the next launch, which is the point. The lib does this on the dialog's `close` event; the Swift reference does it in the sheet's `onDismiss`.

Reopening from the menu (`force: true`, `store.present()`) stores the version again on dismissal, which is harmless.

## Skipped versions and downgrades

- Someone who updates from 2.1 straight to 2.4 sees the 2.4 pages only, not every version they missed. Add an "All release notes" link (`releaseNotesUrl` in the lib) for the rest.
- Version strings are compared for equality, not order. A downgrade (a stored newer version) therefore counts as a change and shows the older version's popup once; if that is wrong for the app, compare versions numerically before calling the decision.
- Several windows or tabs open after an update: show it in one. On the web the lib reads storage when it opens; a second tab opened before the first is dismissed may show it too. Apps that care write a "showing" marker or use a `BroadcastChannel`.

## When to present it

- After the first screen has drawn, never during launch or over a splash screen. The lib waits for the page's `load` event and one frame; the Swift reference waits briefly after the root view appears.
- Never over another modal: a sign-in sheet, a permission prompt, an alert, an onboarding flow. The lib waits until no other modal dialog is open; in SwiftUI, present it only from the main window's root view, after other sheets close.
- Not while the person is in the middle of something the update restored (an open document, a call, a recording): defer it to the next quiet moment or the next launch.

## The reopen item

People who closed it too fast must be able to find it again:

- macOS: "What's New…" in the app menu after "About", or in the Help menu (`WhatsNewCommands` adds it after the app info item).
- iOS and iPadOS: a row in the app's settings or about screen that calls `store.present()`.
- Web and Tauri: an item in the help or settings menu that calls `showWhatsNew({ version, features, force: true })`. In Tauri, a native menu item can emit an event the web UI listens for.

Reopening ignores the stored version and shows the current version's pages.

## Menu-bar-only Mac apps

An app with no main window (`LSUIElement`, a `MenuBarExtra` only) has nowhere to attach a sheet. Open the popup in a small titled window of its own after the update, activate the app so the window comes to the front, and close the window when the popup is dismissed. Put "What's New…" in the status item's menu. Never pop it open from the menu bar extra's popover by surprise.

## Web, React and Tauri wiring

```js
import { showWhatsNew } from './whats-new/whats-new.js';
import { features } from './whats-new/features-2.4.js';

const result = await showWhatsNew({ version: '2.4.0', features, releaseNotesUrl: '/release-notes' });
```

- Import `whats-new.css` once, next to the module.
- React: call `showWhatsNew` from a `useEffect` with an empty dependency list on the root component, and guard it with a ref so development double-invocation does not open it twice. Keep `features` in a module: it is static data, not state.
- Tauri: read the version with `getVersion()` from `@tauri-apps/api/app` before calling it. Bundle the media in the frontend's assets so it loads from the app, not the network.
- Capacitor: read the version with the App plugin's `getInfo()`, and keep media in the web build.
- A plain web app has no install: the first visit counts as a first install and shows nothing, which is usually right.

`showWhatsNew` resolves `{ shown: false, reason }` at once when nothing opens (`first-install`, `seen`, `no-features`) and `{ shown: true, reason, page }` when the popup closes (`close`, `cancel`, `done`), so analytics can record whether people read to the end.

## Storage that fails

`localStorage` can be blocked (private modes, a WebView with storage off) or cleared by the system. The lib treats a failed read as no stored value and a failed write as harmless, so the worst case is that nothing shows, never a popup on every launch. Pass another `storage` (an object with `getItem` and `setItem`, for example backed by the Tauri store plugin) when the app already keeps settings elsewhere. On Apple platforms the Swift reference uses `UserDefaults`; pass a suite when an app group shares settings with an extension.
