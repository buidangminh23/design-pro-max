# Platforms and design principles

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Design principles
- Designing for iOS
- Designing for iPadOS
- Designing for macOS
- Designing for tvOS
- Designing for visionOS
- Designing for watchOS
- Designing for games
- Designing for iPhone Duo

## Design principles

Source: [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles). Applies to: all platforms.

Eight high-level values that frame every other guideline. Use them to settle trade-offs when two reasonable designs compete.

- Purpose: state what the product is for, put the most useful features first, and polish those before adding extras. Check new ideas against that purpose.
- Purpose: study existing solutions to the same problem and decide what makes yours different, instead of copying them.
- Agency: take people straight to their task or content. Keep chrome light and visible only when it is needed.
- Agency: avoid locking people into a fixed flow or mode. Any guided flow must offer an obvious way to skip or leave it.
- Agency: make actions reversible and let people return to an earlier state, so a mistake never costs them time or work.
- Responsibility: explain what the app does and why from the first launch. Give a clear reason whenever you request a permission.
- Responsibility: collect only the data the product needs, protect it, and think through how it could be abused.
- Familiarity: reuse real-world and platform concepts people already know, and use system patterns for alerts and choices.
- Familiarity: once an element has a look or behavior, keep it identical everywhere in the app.
- Familiarity: always signal what is happening: show when a control is usable, and show when content changes.
- Flexibility: treat accessibility as a day-one requirement and design for a wide range of people and abilities.
- Flexibility: keep content and controls in predictable positions across platforms and configurations, and use natural animation for transitions.
- Flexibility: support many input methods (touch, keyboard, voice and others) and give every supported platform equal care.
- Simplicity: include only what is necessary, keep important items close, and let the rest recede. Simple does not mean bare.
- Simplicity: use the fewest words that label a control or explain a concept, and keep a clear hierarchy so people always see their location and the likely next step.
- Craft: sweat visuals, animation, wording, and audio. Prototype early, test in real conditions, and throw away what fails.
- Craft: keep updating the product to match new platform capabilities and patterns after release.
- Delight: choose the feeling the product should create (energy, calm, thrill) and let it guide decisions.
- Delight: use small moments of character, such as a button press or an error message, but never let decoration get in the way of the task.

## Designing for iOS

Source: [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios). Applies to: iOS.

Describes how iPhone is held and used, and what an app should do to feel native. Read it before making any iPhone layout decision.

- iOS: expect a medium-size display viewed from a foot or two away, held in one or both hands, in portrait or landscape. (HG-1)
- iOS: limit the number of controls on screen so people focus on the main task, and make secondary actions discoverable with little effort.
- iOS: adapt to orientation, Dark Mode, and Dynamic Type so people can pick the setup they prefer.
- iOS: place frequently used controls in the middle or lower part of the screen, which is easiest to reach. Support swipe-to-go-back and swipe actions on list rows.
- iOS: with permission, use device data (payments, biometric authentication, location) so people do not retype information.
- iOS: plan for short visits of a minute or two as well as long sessions, and for frequent switching among apps.
- iOS: integrate with the system features people expect: widgets, Home Screen quick actions, Spotlight, Shortcuts, and activity views.

## Designing for iPadOS

Source: [Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados). Applies to: iPadOS.

Overview of iPad use and the habits an iPad app should support. Read it when adapting an iPhone design or building for the large display.

- iPadOS: assume a large display used within about 3 feet, held, on a surface, or on a stand; let the distance and input mode set content size and density. (HG-2)
- iPadOS: use the extra space to elevate content, and reduce modal interfaces and full-screen transitions.
- iPadOS: position controls where they are easy to reach but do not cover content.
- iPadOS: support Multi-Touch, a physical keyboard, a trackpad or mouse, Apple Pencil, and voice, and consider interactions that combine several of them.
- iPadOS: adapt to orientation changes, multitasking modes, Dark Mode, and Dynamic Type; the app should also transition well when it runs on a Mac.
- iPadOS: expect several apps on screen together, and support drag and drop, multitasking, and widgets.

## Designing for macOS

Source: [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos). Applies to: macOS.

Describes Mac usage (stationary, keyboard and pointer first, many windows) and the behaviors a Mac app must offer.

- macOS: design for a stationary device with a large display, possibly several displays, driven mainly by keyboard and pointing device.
- macOS: take advantage of large displays by flattening navigation and cutting modal interruptions, without making content dense enough to strain the eyes.
- macOS: let people resize, hide, show, and move windows, and support full-screen mode as a distraction-free option.
- macOS: expose every command through the menu bar.
- macOS: handle keyboard shortcuts and make keyboard-only work possible.
- macOS: support high-precision input for exact selections and edits.
- macOS: support standard trackpad gestures and touch displays. For touch, enlarge hit areas and let controls grow when touched, yet leave the baseline sizing and density tuned for keyboard and pointer.
- macOS: allow personalization, such as customizing toolbars, configuring window views, and choosing colors and fonts.
- macOS: handle smooth active and inactive transitions as people move between apps, and integrate with file management, Dock menus, and full screen.

## Designing for tvOS

Source: [Designing for tvOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos). Applies to: tvOS.

Overview of living-room use: a very large display, a remote, and viewers far away. Read it before designing any Apple TV screen.

- tvOS: design for viewers often 8 feet or more from the screen who sometimes move around the room. (HG-3)
- tvOS: support the Siri Remote, game controllers, voice, and companion apps on other devices.
- tvOS: build on the focus system, which highlights and enlarges the item the viewer is on so they always know where they are.
- tvOS: use edge-to-edge artwork, subtle fluid animation, and good audio, and keep everything legible from across the room.
- tvOS: support long immersive sessions and picture-in-picture viewing.
- tvOS: make sign-in easy and rare, handle shared sign-in, and switch profiles automatically when the viewer changes.
- tvOS: integrate with the TV app, SharePlay, Top Shelf, and TV provider accounts.

## Designing for visionOS

Source: [Designing for visionOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos). Applies to: visionOS.

Explains the spatial platform: unlimited space, adjustable immersion, passthrough, and eye-and-hand input. Read it before placing any content in space.

- visionOS: use space, Spatial Audio, immersion, passthrough, and eye and hand input rather than porting a flat design.
- visionOS: choose the lowest level of immersion that suits each moment. An experience can be windowed, fully immersive, or in between; do not make everything fully immersive.
- visionOS: launch in the Shared Space, where other apps run side by side, and offer a Full Space only when the app should be alone.
- visionOS: use standard windows with familiar controls for contained, UI-focused tasks. Windows are movable, and system scaling keeps them legible at any distance.
- visionOS: support the Digital Crown for adjusting how much passthrough people see.
- visionOS: support indirect gestures (look, then tap) as the default, and direct touch as an option.
- visionOS: keep content inside the field of view, placed relative to the head. Never require turning the head or changing position to reach it.
- visionOS: avoid motion that is overwhelming, jarring, too fast, or lacks a stationary reference frame.
- visionOS: allow interaction with hands resting in the lap or at the sides.
- visionOS: when supporting direct gestures, keep targets within comfortable reach and avoid long direct-interaction sessions.
- visionOS: avoid prompting a lot of body movement in fully immersive experiences.
- visionOS: support shared activities so participants appear as spatial Personas in the same space.
- visionOS: rely on system components for built-in accessibility (VoiceOver, Switch Control, Dwell Control, Head Pointer) and enhance it with system frameworks.
- visionOS: consider safety. Do not assume use while driving, operating machinery, or moving near hazards such as stairs, balconies, or streets.
- visionOS: the device is for people aged 13 or older.

## Designing for watchOS

Source: [Designing for watchOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos). Applies to: watchOS.

Describes glanceable, wrist-based use and the related surfaces (complications, notifications, Always On). Read it before designing any Apple Watch feature.

- watchOS: expect a small display roughly a foot from the eyes, used with the other hand and glanced at many times a day: a foot (HG-4)
- watchOS: keep interactions short, glanceable, and single-screen, with critical information up front and one or two gestures per action.
- watchOS: keep navigation shallow and use the Digital Crown for vertical scrolling and for switching screens.
- watchOS: support standard gestures (tap, swipe, drag), the Action button, and shortcuts, and use device data such as GPS, sensors, and motion when useful.
- watchOS: anticipate needs and use on-device data to show content relevant now or soon.
- watchOS: provide complications that show relevant, possibly dynamic data on the watch face and open the app when tapped.
- watchOS: use notifications for timely, high-value information and let people act without opening the app.
- watchOS: use background color for supporting information and materials to show hierarchy and place.
- watchOS: make the app work on its own, adding detail and functionality beyond what notifications and complications show.
- watchOS: design for the Always On display so information stays useful when the wrist is lowered.

## Designing for games

Source: [Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games). Applies to: all platforms.

Covers how games should onboard, scale, accept input, and stay accessible across Apple devices. Read it for any game or game-like UI.

- Let people play right after install: put as much playable content as possible in the initial download, keep that download to about 30 minutes or less, and fetch the rest in the background. (HG-5)
- Pick strong defaults from device information (resolution, paired controllers, accessibility settings) so players need not open settings first.
- Teach through play with an interactive tutorial. Offer any written tutorial as optional reference, not a prerequisite.
- Delay permission requests until the moment the feature is needed, and explain the reason in context. Ask for a rating or review only after players have spent real time in the game.
- Keep game text legible: contrast it with the background and stay at or above the platform minimum.
- iOS, iPadOS: text defaults to 17 pt and should never go below 11 pt. (HG-6)
- macOS: text defaults to 13 pt and should never go below 10 pt. (HG-7)
- tvOS: text defaults to 29 pt and should never go below 23 pt. (HG-8)
- visionOS: text defaults to 17 pt and should never go below 12 pt. (HG-9)
- watchOS: text defaults to 16 pt and should never go below 12 pt. (HG-10)
- Keep buttons easy to hit and well separated. Each platform has a recommended minimum size based on its main input method.
- iOS, iPadOS: buttons default to 44x44 pt with a floor of 28x28 pt. (HG-11)
- macOS: buttons default to 28x28 pt with a floor of 20x20 pt. (HG-12)
- tvOS: buttons default to 66x66 pt with a floor of 56x56 pt. (HG-13)
- visionOS: buttons default to 60x60 pt with a floor of 28x28 pt. (HG-14)
- watchOS: buttons default to 44x44 pt with a floor of 28x28 pt. (HG-15)
- Prefer resolution-independent graphics; otherwise match render resolution to the device. In visionOS, prefer vector art because the system rescales it by viewing distance and angle.
- Account for rounded corners and camera housings by using platform safe areas.
- Make menus inside the game cope with varied aspect ratios (for example 16:10, 19.5:9, 4:3) and with both orientations where supported, using relative constraints. Avoid fixed layouts; build a device-specific layout only when necessary.
- Support full-screen play on macOS, iOS, and iPadOS, and Full Space in visionOS.
- Support each platform's default input: touch on iPhone, iPad, visionOS (eyes and hands) and watchOS; keyboard, mouse, or trackpad on Mac; the remote on Apple TV. Pay attention to control size and menus when moving a game from pointer to touch.
- Support physical game controllers on every platform except watchOS, but always provide an alternative for players without one.
- iOS, iPadOS: offer on-screen touch controls that let players act directly on game elements or use virtual controls over the content.
- Make content perceivable through sight, hearing, and touch: never rely on color alone, and give cutscenes subtitles or another readable alternative.
- Let players customize type size, control mapping, motion intensity, and sound balance, using Apple accessibility technologies.
- Offer avatar and naming options that reflect a wide range of identities, and remove stereotypes from characters and stories, keeping any cultural or language references respectful.
- Adopt Game Center for progress, achievements, leaderboards, challenges, and multiplayer; support game saves across devices; use Core Haptics for custom haptics (iOS, iPadOS, tvOS, visionOS, and many controllers); use multichannel audio for Spatial Audio; and consider AR, machine learning, HealthKit, location, camera, and microphone for new mechanics.

## Designing for iPhone Duo

Source: [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo). Applies to: iOS (iPhone Duo).

Describes the two-display, hinged iPhone and how layouts, toolbars, and tab bars adapt to its poses and reserved regions. The page is new and covers overview, layout, and vertical controls. Read it when an iOS app must run on this device.

- iOS: remember this is still iPhone; all iOS patterns and best practices apply.
- iOS: use standard system components and a resizable layout so the app adapts to every pose with little work.
- iOS: do not design a custom layout per pose. Use size classes: compact width for the outer display, regular width for the inner display, and expand the existing layout into extra space.
- iOS: build layouts from size classes, margins, and safe-area insets. Do not hard-code widths or depend on one particular display.
- iOS: keep functionality and element state identical on both displays. Keep the information hierarchy, and add one more level on the larger inner display only if the content suits it (for example, list and detail side by side).
- iOS: give access to the same controls and content in every pose, even when controls overflow or content moves or resizes.
- iOS: follow the system's vertical layout. Toolbars, tab bars, and navigation controls move to the side on the outer display and stay there in landscape on the inner display; the inner display in portrait keeps normal horizontal bars.
- iOS: games must be playable in every pose. Lock to portrait or landscape if needed, but fill the screen as the pose changes, keep text and control sizes steady, and prefer changing the aspect ratio over letterboxing. If letterboxing is unavoidable, fill the padding with artwork.
- iOS: respect the reserved regions: the outer front camera (always present, expands into the Dynamic Island), the inner camera (present only while active), and the fold (which splits the inner display when partly open).
- iOS: system alerts, context menus, and sheets move around the fold automatically, and split views adjust column width and margins. For custom components, use `ReservedRegion` (SwiftUI) or `UIView.ReservedRegion` (UIKit).
- iOS: when the device folds, prefer containers that adapt on their own, use an even number of columns in grids, and use `ReservedRegion` to keep key elements off the center.
- iOS: avoid dramatic layout changes while folding. Move only what is needed to stay visible and tappable, and prefer small shifts over rearrangement.
- iOS: split views show multiple panes on the inner display and collapse to one pane on the outer display; use `NavigationSplitView` or `UISplitViewController`.
- iOS: an arrangement view (`ArrangementView`, `UIArrangementViewController`) holds a primary and a secondary view. A split arrangement divides the area horizontally when wider than tall and vertically when taller than wide; an overlay arrangement stacks the views, and puts one on each side when partly folded.
- iOS: limit split arrangements to chosen axes if needed, and collapse the secondary view of an overlay when it should not show.
- iOS: map an `HStack` or `VStack` style layout to a split arrangement and a `ZStack` style layout to an overlay arrangement.
- iOS: keep navigation containers (navigation split views, tab views) outside arrangement views, because arrangement views only lay out content.
- iOS: account for asymmetric space, since controls sit on one edge. Use safe areas so controls, including those on the opposite edge when two apps share the inner display, never cover content. In Split View, each app places controls on its own outer edge.
- iOS: keep controls in similar relative positions across poses so people do not relearn where actions live.
- iOS: order vertical toolbar items with primary navigation (Back, Close) at the top, then prominent actions such as Done. Keep other items in their original groups; the system adds a gap between top-bar and bottom-bar items.
- iOS: items overflow from bottom to top. Assign visibility priorities (`ToolbarItemVisibilityPriority`, `UIBarButtonItemVisibilityPriority`), first to groups and then to items, so frequent actions (such as Compose or New Note) and status items with badges stay visible longest.
- iOS: do not override default bar placement; familiar positions are a core pattern of the device.
- iOS: consider using the full display width for visual, non-scrolling interfaces without bars, avoiding the Dynamic Island and status bar. A header or background image can span the width while scrolling content stays inset.
- iOS: group related items with `ToolbarItemGroup` or `UIBarButtonItemGroup` instead of adding manual spacing.
- iOS: place controls beside the content they affect when that content is not on the trailing edge, as in Mail where list controls stay above the list pane.
- iOS: give each non-text toolbar item both a title and a symbol (via `Label` or `UIBarButtonItem`); the title is used in overflow menus and expanded forms.
- iOS: minimize text-only buttons, since text keeps a button in a horizontal bar. Prefer symbols where they work.
- iOS: when space is short, keep the toolbar or the tab bar depending on the experience. Navigation-focused views push toolbar items into overflow (default). Task-focused views minimize the tab bar to keep toolbar actions (`ToolbarVerticalCompressionBehavior`, `UIVerticalBarCompressionBehavior`).
- iOS: use the system overflow menu (`ToolbarOverflowMenu`, `additionalOverflowItems`) instead of a custom one. Use the ellipsis symbol only for overflow; other menus need their own distinct symbol.
- iOS: preview poses with Device Hub in Xcode.
