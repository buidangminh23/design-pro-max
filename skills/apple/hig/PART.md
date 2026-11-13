# hig

Apple's Human Interface Guidelines, applied to native app interfaces: SwiftUI, UIKit, AppKit and the watchOS, tvOS and visionOS frameworks. The references are an own-words digest of every guideline page, read on 2026-11-13 (HG-0); each section links its page, and the page wins wherever the two differ. Paths below are relative to this file's folder.

Use this part whenever an agent builds, changes or reviews a screen, a component or a flow of an app on an Apple platform, next to the code part that writes the code (usually `../.vendor/swiftui-expert-skill/SKILL.md`). It is not for web pages: the guidelines cover native apps, and a web page must never imitate Apple's interfaces.

## 1. Read the design before building

1. Name every platform the app ships on. Read that platform's section of `references/platforms.md`, and its Design principles section once per task.
2. List what the screen uses: each component (tab bar, sheet, search field, toggle...), each pattern (onboarding, loading, settings, undo...), each input (gestures, keyboard, pointer, Apple Pencil, Digital Crown...) and each technology (Apple Pay, widgets, Live Activities, Sign in with Apple...).
3. For each item, open the matching reference from section 4, find its `##` section through the file's Contents list, and read that whole section, platform bullets included. Read only the sections in play: the files are large.
4. Read the always-on Foundations sections for every interface: Accessibility, Color, Dark Mode, Layout, Typography, Writing, Motion, Right to left and Inclusion. Add Privacy when the screen asks for data or a permission, and Materials, Icons, Images, SF Symbols or App icons when the screen uses them.

## 2. Build to the guidelines

- Prefer the system component for every job it can do: it brings states, accessibility, Dark Mode, Dynamic Type, right-to-left layout and platform behaviour for free. Customise only what the component's section allows, and keep the states it has (pressed, disabled, focused, selected).
- Respect safe areas and layout margins, and adapt to every size class, orientation and window size the platform has; never hard-code one device's dimensions.
- Use the semantic system colors and text styles; support Dynamic Type through the largest accessibility sizes, and test both appearances.
- Size every control to at least the platform minimum, as default and floor: iOS and iPadOS: 44x44 pt and 28x28 pt (HG-24); macOS: 28x28 pt and 20x20 pt (HG-25); tvOS: 66x66 pt and 56x56 pt (HG-26); visionOS: 60x60 pt and 28x28 pt (HG-27); watchOS: 44x44 pt and 28x28 pt (HG-28).
- Keep text at or above the platform minimum: iOS and iPadOS: 11 pt (HG-65); macOS: 10 pt (HG-67); tvOS: 23 pt (HG-69); visionOS: 12 pt (HG-71); watchOS: 12 pt (HG-73).
- Give text a contrast ratio of at least 4.5:1, and more for small or custom-colored text (HG-22, HG-37, HG-38).
- Give every control and image an accessibility label, keep the reading order logical, and never rely on color alone to carry meaning.
- Honor Reduce Motion, Reduce Transparency, Increase Contrast, Bold Text and Smart Invert; motion explains a change and is never decoration.
- Write labels in the platform's voice: short, specific, title-style or sentence-style as the component's section says, and never blame the user in an error.
- Put Apple-provided marks and buttons (Apple Pay, Sign in with Apple, Wallet, App Store badges) on screen only through Apple's APIs and artwork, under the rules of their sections; never redraw them.

## 3. Review against the guidelines

When asked to review, or after building, produce one table:

| Topic | Guideline, in own words | Status | Evidence | Source |
|---|---|---|---|---|
| e.g. Tab bars | Use it for top-level sections, not for actions | meets / fails / not checked | file:line or a screenshot | the section's HIG link |

- Cover every item listed in step 2 of section 1 and every always-on Foundations section.
- Mark a row "fails" only with evidence, and "not checked" when the code cannot prove it.
- End with the proof boundary: reading code shows which components, modifiers and labels are used; it does not prove contrast in both appearances, the largest Dynamic Type sizes, VoiceOver order, focus behaviour, hit areas as rendered or motion with accessibility settings on. Check those in the Simulator with the Accessibility Inspector and the environment overrides, or on a device, and say which were not checked.

## 4. References

| Need | Read the section in |
|---|---|
| A platform's traits, the design principles, games, iPhone Duo | `references/platforms.md` |
| Accessibility, app icons, branding, color, Dark Mode, icons, images, immersive experiences, inclusion, layout, materials, motion, privacy, right to left, SF Symbols, spatial layout, typography, writing | `references/foundations.md` |
| Charting data, sharing, drag and drop, entering data, feedback, files, full screen, launching, loading, accounts, notifications, modality, multitasking, help, onboarding, audio, haptics, video, printing, ratings, search, settings, undo, workouts | `references/patterns.md` |
| Charts, image, text and web views, boxes, collections, columns, disclosure, labels, lists and tables, lockups, outlines, split views, tab views, path controls, search fields, sidebars, tab bars, token fields, activity rings, gauges, progress and rating indicators | `references/components-views.md` |
| Activity views, buttons, context, Dock and edit menus, quick actions, menus, ornaments, pop-up and pull-down buttons, the menu bar, toolbars, action sheets, alerts, page controls, panels, popovers, scroll views, sheets, windows, color and image wells, combo boxes, digit entry, pickers, segmented controls, sliders, steppers, text fields, toggles, virtual keyboards | `references/components-controls.md` |
| App Shortcuts, complications, controls, Live Activities, notifications, snippets, status bars, Top Shelf, watch faces, widgets | `references/system-experiences.md` |
| Action button, Apple Pencil and Scribble, Camera Control, Digital Crown, eyes, focus and selection, game controls, gestures, motion sensors, keyboards, nearby interactions, pointing devices, remotes | `references/inputs.md` |
| AirPlay, Always On, App Clips, In-App Purchase, Apple Pay, augmented reality, CareKit, CarPlay, Game Center, generative AI, HealthKit, HomeKit, iCloud, ID Verifier, iMessage apps | `references/technologies-a-i.md` |
| Live Photos, Mac Catalyst, machine learning, Maps, NFC, photo editing, ResearchKit, SharePlay, ShazamKit, Sign in with Apple, Siri, Tap to Pay, VoiceOver, Wallet | `references/technologies-l-w.md` |
| Every numbered claim and its source | `references/evidence.md` |

## 5. Never ship

- Apple's guideline text, screenshots, templates or design resources copied into the user's project or into this skill.
- SF Pro, SF Symbols or Apple product images outside an app for Apple platforms, and never on a web page.
- A custom control that drops a state, an accessibility trait or a platform behaviour that the system control has.
- A redrawn, recolored or animated Apple mark or button.
- Fixed point sizes, colors or device dimensions copied from one screenshot instead of the system's semantic values.
