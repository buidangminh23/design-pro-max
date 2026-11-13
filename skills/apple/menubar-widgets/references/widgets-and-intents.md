# Widgets and App Intents

## Contents

- Design for a glance
- The kind string
- Configurable widgets
- Timelines and reloads
- Stale extensions after an update
- Building without Xcode
- Extension sandboxing and signing

## Design for a glance

- One job per widget: a value, its trend and when it was last true. Anything longer goes in the app, reached by tapping the widget.
- Margins of 16 points for most content (HG-157); 11 points suit grouped graphics, buttons or background shapes (HG-158). Text stays at 11 points or larger (HG-159).
- Update animations, such as `.contentTransition(.numericText())` on a changing number, last up to 2 seconds (HG-156).
- Content fits its family at the family's size with no scrolling and no clipped text [MW-SNAP-01]. When it does not fit, shorten it, cap it with `lineLimit`, or offer it only in a larger family.
- Give the widget a `containerBackground(for: .widget)` so the system can remove or tint it, and test the light and dark schemes.
- `../../hig/PART.md` has the full widget guidelines, including sizes per device.

## The kind string

The kind identifies the widget to the system. Placed widgets are stored against it, and `WidgetCenter.reloadTimelines(ofKind:)` targets it. Write it once, as a constant shared by the widget and every reload call, and never rename it after release [MW-WARN-KIND]: a new kind drops the widgets people placed, and a literal copied into a reload call drifts.

## Configurable widgets

`StaticConfiguration` describes a widget with no user-configurable options, and `AppIntentConfiguration` one whose custom intent provides them ([StaticConfiguration](https://developer.apple.com/documentation/widgetkit/staticconfiguration), [AppIntentConfiguration](https://developer.apple.com/documentation/widgetkit/appintentconfiguration)), so a static widget shows nothing in Edit Widget (IL-15). For options [MW-CONFIG-01]:

1. Declare a `WidgetConfigurationIntent` with one `@Parameter` per option [MW-WARN-PARAMS].
2. Model a list of choices (cities, projects, lists) as an `AppEntity` with an `EntityQuery` that returns the entities for identifiers, the suggested entities and, optionally, a default.
3. Use `AppIntentConfiguration(kind:intent:provider:)` with an `AppIntentTimelineProvider`, whose snapshot and timeline methods receive the configured intent.
4. Keep the kind string from the static version, so placed widgets survive the change (IL-15).

`assets/ConfigurableWidget.swift` is the whole pattern in one file, type-checked with Swift 6.

## Timelines and reloads

- Return entries for the times the content changes, with a reload policy that matches how often the data really changes. The system budgets reloads, so a widget that asks every minute gets fewer reloads than it asked for.
- When the app changes the data, call `WidgetCenter.shared.reloadTimelines(ofKind:)` with the kind constant, or `reloadAllTimelines()` after a change that affects every widget.
- Share data through an app group container, never through the extension reading the app's private folder.

## Stale extensions after an update

When an app replaces itself during an update, the old extension process can keep running from the removed copy, and placed widgets show placeholders until it stops (IL-14). Signs: the extension process started before the installed bundle was written, or its executable path lies outside the installed app.

- Find it: `scripts/probe-extension.mjs --app <installed app>` reads `ps` and `lsof`, reports [MW-STALE-01] and prints the commands to fix it. It stops nothing itself.
- Fix it at every launch: `assets/StaleExtensionCleanup.swift` stops extension processes whose executable is outside the installed bundle or that started before it, runs `pluginkit -a` on the installed extension and reloads every timeline. Call it early in `applicationDidFinishLaunching`. It finds the processes by their first argument (the executable path they were launched with, which survives the deletion of the old copy) and stops only those under this app's name whose bundle has the extension's identifier or no longer exists, so another app's extension with the same executable name and a debug copy under its own identifier keep running. It takes the install time from the change and birth times, never the modification time, which updaters keep. A sandboxed host app cannot list or signal other processes; there the updater, which runs outside the sandbox, does the cleanup after replacing the app.
- Reloading timelines alone is not enough: it asks the running process, which is the stale one.

## Building without Xcode

A build made with swiftc or SwiftPM and a script must do what Xcode does for widgets:

- Run the App Intents metadata extraction for the extension, and list the protocols it gathers constants for, including `EntityQuery`, `TransientEntity`, `AppIntentsPackage` and `DynamicOptionsProvider`; otherwise the extracted metadata is incomplete and options stay empty (IL-15) [MW-WARN-INTENTS].
- Keep the extension's `Info.plist` with its extension point, and the `WidgetBundle` marked `@main` (`assets/WidgetBundle.swift`) as its entry point, as Xcode's widget template does; do not write a custom `main` for the extension.

## Extension sandboxing and signing

[MW-WARN-EXTSIGN] The extension and its containing app are both code signed, the same way ([App Extension Programming Guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html)), and Xcode's macOS extension templates turn on the App Sandbox for the extension (same page). A script build should therefore:

- sign the extension first, with its own entitlements including the App Sandbox, then sign the app without `--deep`, so the app's signature and entitlements do not replace the extension's;
- add a secure timestamp (`codesign --timestamp`) to every signature of a build that will be notarized ([Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution));
- probe sandboxed entitlements from inside an app bundle: a bare executable that carries the App Sandbox entitlement exits at launch without any output (IL-18).

Notarization itself is the router's notarization row.
