# Status items and menu bar apps

## Contents

- Pick the API
- What sits in the menu bar
- Template images and appearance
- The appearance loop and how to find it
- Menus, popovers and windows
- Agent apps and the Dock

## Pick the API

- A SwiftUI app: `MenuBarExtra` in the app's scenes. `.menuBarExtraStyle(.menu)` gives a plain menu; `.window` gives a popover-like panel for one compact task. The SwiftUI row of the router covers the scene APIs.
- An AppKit app, or a status item whose icon changes at run time: `NSStatusBar.system.statusItem(withLength:)`, with `variableLength` for a value that changes width and `squareLength` for an icon. Keep a strong reference to the item for as long as it should show.
- One status item per app. A second one is almost always a menu entry in disguise.

## What sits in the menu bar

The menu bar is 24 pt tall (HG-112) on a display without a camera housing, and shared with every other app. On a display with a camera housing it is taller and the room for status items is narrower: items that do not fit are hidden, and an item can end up behind the housing. Put one icon, one short value or both there, never a sentence. Long values belong in the menu or the popover. Give the button an accessibility label that says what the value is (`setAccessibilityLabel`), since VoiceOver reads the icon otherwise as an unnamed image.

## Template images and appearance

- A monochrome icon: set `isTemplate = true` on the image (or use a template asset). The menu bar tints it for light, dark, the highlighted state and a tinted desktop, and the app needs no appearance code at all. This is the default.
- Colour that carries meaning (a red badge, an orange bar near a limit): draw the image yourself for the current appearance, using `effectiveAppearance.bestMatch(from: [.darkAqua, .aqua])` to choose the light or dark variant.
- Text values: an attributed title with the system font and monospaced digits keeps the width steady as the value changes.

## The appearance loop and how to find it

Observing the button's `effectiveAppearance` and marking it for display on every callback can loop: the menu bar draws a snapshot of the item, which sets the appearance again, which fires the observer again. An idle app then holds one core at 90-97 % CPU (IL-13). Setting the image or the title on every callback does the same.

The fix [MW-APPEAR-01]: compute the light or dark match in the handler, compare it with the last one and return when it has not changed; redraw only on a real change. `assets/StatusItemController.swift` does exactly this, and also redraws when its own value changes, not when the appearance callback fires.

To diagnose a running app, sample it for a few seconds and look for the observer and display calls at the top of the main thread's stack (IL-13):

```
sample <pid> 3
```

`scripts/scan-swift.mjs` finds the pattern in source: an observation through `observe(\.effectiveAppearance)`, a Combine `publisher(for: \.effectiveAppearance)` chain or `observeValue(forKeyPath:)`, whose handler, or a function it calls in the same file, redraws before any guard that compares a value with a stored last one. `removeDuplicates()` before the `sink` counts as that comparison.

## Menus, popovers and windows

- A menu is the default: it is fast, keyboard-driven and familiar. Use it for commands, a status line, recent items and a Settings entry.
- A popover (or a `.window` style `MenuBarExtra`) suits one compact task that needs live controls, such as a small chart or a toggle group. Size it to its content, keep it under a screen's height without scrolling, and close it when the person clicks away.
- Settings, onboarding, long lists and editing go in a window: a SwiftUI `Settings` scene or an `NSWindow`, opened from the menu and brought to the front with the app activated.

## Agent apps and the Dock

A menu bar only app sets `LSUIElement` to true in its Info.plist, so it has no Dock icon and no main menu. Activate the app before opening a window from the menu, or the window opens behind the frontmost app. Starting at login (`SMAppService`) is outside this part.
