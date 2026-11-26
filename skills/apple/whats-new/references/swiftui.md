# What's New in SwiftUI

## Contents

- The pieces in the reference
- Presenting it
- The sheet's size
- A pager on macOS
- Looping video
- VoiceOver
- Keyboard
- Type-checking

## The pieces in the reference

`assets/swift/WhatsNew.swift` and `assets/swift/WhatsNewVideo.swift` need only SwiftUI and AVFoundation and build for macOS 13 and iOS 16 or later:

| Type | Job |
|---|---|
| `WhatsNewFeature` | one page: badge, title, body, media (`.image(name)`, `.video(url, poster:)`, `.none`) and an optional media label for VoiceOver |
| `WhatsNewLabels` | every string the sheet shows or reads, English by default, `.vietnamese` as an example |
| `WhatsNewStore` | the once-per-version decision on `CFBundleShortVersionString` in `UserDefaults`: `decision`, `presentIfUpdated()`, `present()`, `markSeen()` [WN-ONCE-01] |
| `WhatsNewSheet` | the card for one feature, the pager for several |
| `.whatsNew(store:features:labels:)` | the presenter: decides after the root view appears, shows the sheet, marks the version seen on dismissal |
| `WhatsNewCommands` | the "What's New…" menu item after the app info item |
| `LoopingPlayer`, `WhatsNewVideo` | a muted looping clip that plays only on the current page |

## Presenting it

```swift
@main
struct NotesApp: App {
    @StateObject private var whatsNew = WhatsNewStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .whatsNew(store: whatsNew, features: WhatsNewContent.current)
        }
        .commands { WhatsNewCommands(store: whatsNew) }
    }
}
```

- Attach the presenter to the main window's root view only, so the sheet lands on that window and never on a settings window. In a `WindowGroup` every window runs the presenter, so the store hands the sheet to the first window still open and the others show nothing; the menu item reopens it there too. To show it in the window the person is using, open a dedicated `Window` scene with `openWindow` instead.
- The presenter waits a moment after the view appears before it decides, so the sheet slides over a drawn screen, not over launch. An empty feature list stores the version and shows nothing.
- `markSeen()` runs in the sheet's `onDismiss`, so the close button, Escape, the last "Got it" and a swipe down on iOS all count, and a crash before dismissal does not [WN-ONCE-01].
- iOS has no menu bar: add a row in settings or the about screen that calls `whatsNew.present()`.
- If the app already shows another sheet at launch (sign-in, a permission explanation), present What's New after it closes, not on top of it: only one sheet at a time.
- A menu-bar-only app has no window for a sheet: open a small `Window` scene with `WhatsNewSheet` inside when `decision == .update`, call `markSeen()` when that window closes, and put the menu item in the status item's menu.

## The sheet's size

- macOS: a sheet is a card over a dimmed parent window and should open at a sensible size, not cover the window. The reference fixes the content width on macOS and lets the height follow the tallest page; on macOS 15 and later you can add `.presentationSizing(.fitted)` so the sheet takes the content's ideal size. Below that, keep the explicit `.frame`.
- iOS: the card sits in a sheet with the system's swipe-to-dismiss. On iPhone the full content width applies; on iPad the width caps at the card's width. Leave detents out: the popup is short and should not be resizable.
- Keep `interactiveDismissDisabled` off. Dismissing is always allowed, and it is how the version gets marked seen.

## A pager on macOS

`TabView` with the page style and the page index style exist on iOS but not on macOS, so the reference does not use them on either:

- One `@State` index drives the page. Every page is built inside one `ZStack`, the inactive ones at zero opacity and hidden from accessibility, so the card is as tall as its tallest page and keeps that size on every page [WN-LAYOUT-01].
- The arrows are round buttons with labels; the unusable one is disabled and dimmed, never removed [WN-NAV-01]. The hit areas are Apple's recommended size [WN-WARN-TARGET44].
- The dots are drawn small inside taller hit areas and tap to jump [WN-TARGET-01].
- The primary button stacks both labels and shows one, so it keeps its width.
- The page change animates with a short move and fade; with Reduce Motion on it changes at once, with no movement [WN-MOTION-01].

On iOS 17 and macOS 14 and later, a horizontal `ScrollView` with `.scrollTargetBehavior(.paging)` and `scrollPosition(id:)` is another way to page; keep the custom dots and arrows on macOS either way.

## Looping video

`LoopingPlayer` wraps an `AVQueuePlayer` and an `AVPlayerLooper` around one item, muted [WN-MEDIA-01]:

- `WhatsNewVideo` plays only while its page is current; leaving the page pauses it and seeks to the start.
- With Reduce Motion on, nothing starts by itself: the poster shows with a play button, and playback starts only when the person asks [WN-MOTION-01].
- A clip longer than 5 s, or any clip under Reduce Motion, shows a pause and play button with a label [WN-MEDIA-01] (PV-21, WH-9); the duration is loaded asynchronously before the button appears.
- The player layer is hidden from VoiceOver; give the feature a `mediaLabel` when the clip shows something the title does not say.
- Bundle the clip in the app (an asset catalog data set or a resource file) and pass its file URL; never stream it at launch.

## VoiceOver

- The sheet's label is the current page's title; the title also carries the header trait.
- The dots are one adjustable element labelled with the region name, valued "Feature N of M" through `WhatsNewLabels.pageOf`; swiping up or down moves a page. Each arrow and the close button have their own labels.
- The primary button reads "Next" or "Got it", never both.
- Inactive pages are hidden from accessibility so VoiceOver never reads a page that is not showing.

## Keyboard

- Return activates the primary button (`.keyboardShortcut(.defaultAction)`), Escape closes (`.cancelAction`) [WN-DIALOG-01].
- Left and Right arrows change the page through `onKeyPress`, which needs macOS 14 or iOS 17; the reference guards it with `if #available`, so macOS 13 and iOS 16 page with the buttons only.
- With Full Keyboard Access, Tab reaches the close button, the arrows and the primary button; the dots are reached as one adjustable element.

## Type-checking

Check the copied files before building, with Swift 6 language mode:

```
swiftc -typecheck -swift-version 6 -target arm64-apple-macos14.0 WhatsNew.swift WhatsNewVideo.swift
swiftc -typecheck -swift-version 6 -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -target arm64-apple-ios17.0-simulator WhatsNew.swift WhatsNewVideo.swift
```

Run them outside the agent sandbox if the SwiftUI macro plugin fails to start inside it. A clean type-check proves the code compiles, not how the sheet looks, sizes or reads; open it in the app with VoiceOver and Reduce Motion on.
