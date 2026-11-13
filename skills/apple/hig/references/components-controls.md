# Components: menus, actions, presentation and input controls

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Activity views
- Buttons
- Context menus
- Dock menus
- Edit menus
- Home Screen quick actions
- Menus
- Ornaments
- Pop-up buttons
- Pull-down buttons
- The menu bar
- Toolbars
- Action sheets
- Alerts
- Page controls
- Panels
- Popovers
- Scroll views
- Sheets
- Windows
- Color wells
- Combo boxes
- Digit entry views
- Image wells
- Pickers
- Segmented controls
- Sliders
- Steppers
- Text fields
- Toggles
- Virtual keyboards

## Activity views

Source: [Activity views](https://developer.apple.com/design/human-interface-guidelines/activity-views). Applies to: iOS, iPadOS, visionOS (not macOS, tvOS, watchOS).

The share sheet lists sharing targets and actions for the current content. Use this page when you add custom activities or share and action extensions.

- Open the activity view from the standard Share button. Do not add a second, different way to reach the same list.
- Do not rebuild actions the system already offers (Copy, Print, Add to Files, AirPlay). If your behavior differs, give it a distinct title, such as "Print Transaction".
- Omit system activities that make no sense in your app. You cannot reorder system activities, but you can exclude some and choose which custom ones appear in each context.
- Prefer an SF Symbol for a custom activity icon. For a hand-drawn icon, center it in an area of about 70x70 pixels. (HG-105)
- Title each custom action with a single verb or a short verb phrase. Long titles wrap and may truncate.
- Keep your company or product name out of action titles. A share activity is the exception: the sheet shows its provider name under the icon.
- Share extensions: reuse the system composition view so sharing feels familiar.
- Action extensions: include your app name, and add elements of your app UI if you present your own interface, so people see the link to your app.
- Keep extensions to a few steps. A share extension may post immediately on one tap or click.
- Do not stack another modal view on an extension. An alert is the only acceptable exception.
- Give an action extension a symbol or interface icon that names the task. A share extension automatically shows your app icon.
- The sheet dismisses as soon as the extension task finishes. Run slow work in the background and show its status in the main app.
- Notify only about problems, not about ordinary completion.
- macOS has no activity view. People reach share extensions through a toolbar Share button or a context menu Share item, and action extensions through hover controls on embedded content, a toolbar button, or Finder quick actions.

## Buttons

Source: [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (tvOS: no extra rules).

A button triggers an instant action. Its function comes from style, content (symbol, text, or both) and role. Use this page for any custom or system button.

- Size the hit region to at least 44x44 pt, and 60x60 pt in visionOS, with enough surrounding space to tell the button apart from neighbors. (HG-106)
- Give every custom button a visible press state so it never feels unresponsive.
- Give the most likely action in a view a prominent style, and allow only one or two such buttons on any screen.
- Separate the preferred choice by style, not by size. Buttons that offer a set of options should share one size.
- Do not tint button labels with a color close to the content layer background. Over colorful content, keep the default monochrome label.
- Pick content the user can read at a glance: a familiar symbol for a familiar action (for example `square.and.arrow.up` for share), or a short text label when text is clearer.
- Write text labels in title-style capitalization and start with a verb, such as "Add to Cart".
- macOS, visionOS: expect a hover tooltip. Make sure each button has a brief description for it.
- Roles are normal, primary, cancel and destructive. Primary uses the accent color and destructive uses system red.
- Mark the button people most likely choose as primary. It then responds to Return and can close a sheet, editable view or alert automatically.
- Never make a destructive button primary, even when it is the likeliest choice, because people tap prominent buttons without reading.
- iOS, iPadOS: show an activity indicator inside the button for slow actions, and optionally swap the label, for example "Checkout" to "Checking out...".
- macOS: use the standard push button. Use a flexible-height push button only for two-line text or tall icons (`NSButton.BezelStyle.flexiblePush`).
- macOS: end a push button title with an ellipsis when it opens another window, view or app.
- macOS: consider spring loading, where force clicking a button with dragged items activates it.
- macOS: place square (gradient) buttons beside the view they affect, such as add/remove rows. Use symbols, not text or intro labels, and never put them in a toolbar or status bar.
- macOS: use the system help button (circular, question mark) inside a view, not in the window frame, and only one per window. Do not add intro text next to it.
- macOS: open the help topic for the current context, or the help top level when none applies.
- macOS: put the help button in the lower corner opposite the dismissal buttons and aligned with them. With no dismissal buttons, or in a settings pane, use the lower-left or lower-right corner.
- macOS: for image buttons, keep about 10 pixels of padding between image and button edge, avoid the system border, and put any label below the image. Do not place them in a toolbar or status bar. (HG-107)
- visionOS: the standard shapes are circle for icon-only, rounded rectangle or capsule for text-only, and capsule for icon plus text.
- visionOS: heights step through mini 28 pt, small 32 pt, then 44 pt (regular), 52 pt (large) and 64 pt (extra large). (HG-108)
- visionOS: do not use custom hover effects, and do not style a custom button white with black content, since that look means the toggled state.
- visionOS: prefer a visible background shape and fill. Exceptions are toolbars, context menus, alerts and ornaments, where the container already keeps the button visible.
- visionOS: use the thin material behind buttons on glass, and the glass material for buttons floating in space.
- visionOS: prefer circular or capsule shapes, since eyes drift toward corners. Use a capsule for a lone button, rounded rectangles in vertical stacks and capsules in horizontal rows.
- visionOS: keep button centers at least 60 pt apart, and add 4 pt of padding around buttons that are 60 pt or larger. Avoid vertical stacks or rows of small or mini buttons. (HG-109)
- visionOS: use standard controls to get the system audio feedback, because there are no haptics.
- watchOS: inline buttons render as capsules with a material background.
- watchOS: put corner buttons in a toolbar, and use toolbar buttons only for navigation to related areas or contextual actions.
- watchOS: prefer full-width buttons for primary actions. When two buttons share a row, give them equal height and use images or short titles.
- watchOS: keep one- and two-line text buttons in a vertical stack at the same height.
- visionOS: circular buttons come in all five heights (28 pt mini, 32 pt small, 44 pt regular, 52 pt large and 64 pt extra large); text-only capsules and rounded rectangles come only in small, regular and large, and capsules with an icon and text only in regular and large. (HG-110)

## Context menus

Source: [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus). Applies to: iOS, iPadOS, macOS, visionOS (not watchOS; tvOS has no extra rules).

A hidden menu of commands tied to one item or selection, opened by touch-and-hold, pinch-and-hold, Control-click or secondary click. Use it for quick, relevant commands.

- Include only commands likely to be needed for that item right now. Leave advanced or rare commands out.
- Keep the item count small so the menu is easy to scan and scroll.
- Offer context menus consistently across the app so people know where they exist.
- Every context menu command must also exist in the main interface (toolbar, or menu bar menus on macOS).
- Limit submenus to one level, and title each so its contents are predictable.
- Hide commands that do not apply instead of dimming them. macOS exception: Cut, Copy and Paste may appear disabled.
- Put the most used items where the eye lands first, which is nearest the touch or pointer. Reverse the order when the menu opens upward.
- Show keyboard shortcuts in the main menus, not in context menus.
- Use separators to group items, with at most about three groups.
- iOS, iPadOS, visionOS: place destructive items (Delete, Remove) last and mark them as destructive so they render red.
- Skip a menu title unless it clarifies scope, for example a count of selected messages. Give every item a short descriptive label.
- Reuse the system icons for standard actions such as Copy, Share and Delete.
- iOS, iPadOS: offer a context menu or an edit menu on an item, never both.
- iPadOS: consider a context menu on empty space to create a new object, as Files does for folders.
- iOS, iPadOS: prefer a preview that shows the real target content, and match its clipping path to the preview shape so rounded corners stay stable during the reveal animation (`UIContextMenuInteractionDelegate`).
- macOS: this component is also called a contextual menu.
- visionOS: consider replacing a panel or inspector window with a context menu for frequently used functions.
- visionOS: keep the menu shorter than the window so it does not cover the system controls above and below. Allow longer menus only for specialist apps.

## Dock menus

Source: [Dock menus](https://developer.apple.com/design/human-interface-guidelines/dock-menus). Applies to: macOS only.

The menu shown when someone secondary clicks an app icon in the Dock, mixing system and custom items.

- Label items briefly and group them logically, as in any menu.
- Offer every custom Dock item elsewhere too, such as the menu bar or the main interface (`applicationDockMenu(_:)`).
- Favor high-value custom items, such as a list of open or recent windows.
- Add a few actions useful when the app is not frontmost or has no windows, as Mail does with get new mail and compose.
- iOS and iPadOS use Home Screen quick actions instead.

## Edit menus

Source: [Edit menus](https://developer.apple.com/design/human-interface-guidelines/edit-menus). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

The menu for acting on selected content: Cut, Copy, Paste, Select, Translate, Look Up and detected-data actions.

- Use the system edit menu rather than building a lookalike (`UIEditMenuInteraction`).
- Let people open it with the standard gesture for the platform: touch and hold, pinch and hold, or secondary click. Add no custom trigger.
- Show only commands that apply. Remove or dim ones that need a selection when nothing is selected, and hide Paste when there is nothing to paste.
- Place custom commands next to the related system ones, for example formatting commands after the system format section. Keep their number low.
- Let people select and copy static content text such as captions, though never control labels.
- Support undo and redo, since edit actions run without confirmation.
- Do not add other controls that duplicate edit menu functions.
- Tell deletion commands apart where needed: Delete matches the Delete key, while Cut also copies to the pasteboard.
- Name custom commands with a verb or short verb phrase.
- iOS: the compact horizontal menu has a trailing chevron that expands it into a context menu.
- iPadOS: touch gives the compact horizontal style; keyboard or pointer gives the vertical context menu style. Make your menu work in both.
- iOS, iPadOS: you may move the menu to avoid covering key content, but you cannot change its shape or pointer. The default position is above or below the selection.
- visionOS: pinch gesture opens a horizontal bar, or a context menu.
- macOS: editing commands live in a context menu and in the Edit menu of the menu bar.

## Home Screen quick actions

Source: [Home Screen quick actions](https://developer.apple.com/design/human-interface-guidelines/home-screen-quick-actions). Applies to: iOS, iPadOS.

A menu of app-specific shortcuts shown when someone touches and holds an app icon.

- Provide quick actions for valuable tasks; at least one is expected, and four is the maximum.
- If quick actions change dynamically (location, recent activity, time, settings), make the changes predictable.
- Write a short title that states the outcome, such as "New Message". Add a subtitle only when more context helps, for example unread counts.
- Leave the app name and filler out of titles and subtitles, keep them short, and allow for localization.
- Use a familiar SF Symbol or standard interface icon. A custom icon should come from the Quick Action Icon Template.
- Never use an emoji as the icon. Quick action icons are monochrome and adapt in Dark Mode.
- The system appends its own remove-app and edit-Home-Screen items, and flips the icon side based on where the app sits.

## Menus

Source: [Menus](https://developer.apple.com/design/human-interface-guidelines/menus). Applies to: all platforms (extra layout rules for iOS, iPadOS, visionOS).

Rules for labeling and organizing menu items, shared by every menu type: pop-up, pull-down, context and menu bar menus.

- Label an action item with a verb or verb phrase (View, Close, Select). Add an app-appropriate tone if the app has a style guide.
- Use title-style capitalization: capitalize each word, leaving out articles, coordinating conjunctions and short prepositions, but always capitalize the final word.
- Drop articles (a, an, the) from labels. "View Settings" beats "View the Settings".
- Show unavailable items dimmed and inert. If every item is unavailable, keep the menu itself openable so people can still read it.
- End the label with an ellipsis character when the command needs more input in another view before it can finish.
- In apps, show the keyboard shortcut next to an item that has one. Games rarely do.
- Use the standard icons for common actions (Share, Print, Search). Add icons sparingly and only when a clear one exists, for key actions, locations, devices, visual concepts and user content.
- Within one group, give every item an icon or none of them.
- List important and frequent items first, since people scan from the top.
- Group related items and divide groups with a separator (a line or a gap). Keep related commands together even if their importance differs, such as Paste and Match Style next to Paste.
- Watch menu length. Split long menus or move items into a submenu. A long menu is fine when it lists user-made or generated content, like history or bookmarks, and may scroll.
- Use submenus sparingly, signaled by a chevron after the label. Consider one when a term repeats in more than two items of a group, and reuse that term in the submenu item label ("Sort by").
- Keep submenus to one level and about five items or fewer. Otherwise make a separate menu.
- Keep a submenu item available even when its nested items are all unavailable.
- Use a submenu, not indentation, to show hierarchy.
- For on/off attributes, consider one item with a changing label (Show Map / Hide Map). Add a verb when a label could read as a state ("Turn HDR On").
- Show both items instead when seeing both options helps, and leave only the inapplicable one dimmed.
- Use a checkmark to mark attributes currently in effect, and consider a "Plain"-style item that clears several toggled attributes.
- In-game menus: use the platform default navigation (touch on iOS and iPadOS, gestures on visionOS), and enlarge tap targets and text if scaling the game to a small screen makes the menu hard to use.
- iOS, iPadOS: three layouts exist via `preferredElementSize`. Small shows a top row of four symbol-only items. Medium shows three items with symbol and short label. Large, the default, is a plain list.
- iOS, iPadOS: use medium for three important actions (Notes uses it for Scan, Lock, Pin). Use small only for tightly related groups such as Bold, Italic, Underline and Strikethrough, with recognizable symbols.
- visionOS: small and large layouts are available, and a menu may extend outside its window.
- visionOS: show the menu near the content it controls, so the effect is visible when looking at the item.
- visionOS: prefer the subtle breakthrough effect, which `automatic` picks for menus overlapping 3D content. Use prominent only when the menu must show over the whole scene, and none only if occlusion is intended, knowing it can hide the menu.

## Ornaments

Source: [Ornaments](https://developer.apple.com/design/human-interface-guidelines/ornaments). Applies to: visionOS only.

A control strip floating just in front of a window, on any edge, that follows the window and does not scroll with its content.

- Use an ornament for frequently needed controls or info that should sit in a fixed, predictable place, like Now Playing controls.
- Keep it visible in most cases. Hiding is reasonable only while people are immersed in content such as a video or photo.
- With several ornaments, protect the window's visual balance and cap their number. If you drop one, move its elements into the window.
- Make an ornament no wider than its window so it does not collide with a side tab bar or other vertical content.
- Consider borderless buttons on the glass background. They get the hover effect automatically.
- Use the system toolbar and tab bar, which already appear as ornaments, unless you need a custom component.

## Pop-up buttons

Source: [Pop-up buttons](https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

A button that opens a menu of mutually exclusive options and shows the current choice.

- Use it for a flat list of exclusive options or states. Switch to a pull-down button for actions, multi-select or a submenu.
- Always provide a sensible default selection, ideally what most people want.
- Make the options predictable without opening: add an introductory label or a label describing the effect.
- Choose it when space is tight and not every option must be visible.
- Add a "Custom" option for occasional extra choices, with explanatory text under the list if needed.
- iPadOS: inside a popover or modal, consider a pop-up button on a list row instead of a disclosure indicator when the option set is small and well defined.
- Developer pointers: `NSPopUpButton`, `changesSelectionAsPrimaryAction`, menu picker style.

## Pull-down buttons

Source: [Pull-down buttons](https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

A button whose menu holds items or commands directly related to the button's purpose; the action runs and the menu closes.

- Use it for commands tied to the button (Add choosing what to add, Sort choosing a key, Back choosing a destination).
- Use a pop-up button for exclusive choices that are not commands.
- Never hide all of a view's primary actions inside one pull-down button.
- Aim for at least three items. For one or two, use buttons, toggles or switches. Avoid very long menus.
- Add a menu title only if it adds meaning.
- Mark destructive items so they render red. Choosing one shows an action sheet (iOS) or popover (iPadOS) to confirm.
- Add an icon (preferably an SF Symbol) after a label only when it clarifies the meaning.
- iOS, iPadOS: a touch-and-hold on a button may also open the menu, as with Safari's Tabs button.
- iOS, iPadOS: a More (ellipsis) button suits low-priority items when space is tight, but it hurts discoverability, so use it with care.

## The menu bar

Source: [The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar). Applies to: macOS, iPadOS (not iOS, tvOS, visionOS, watchOS).

The top-of-screen strip with an app's top-level menus. Below are the rules and the standard menus agents most often get wrong. See the source for the full item tables.

- Order menus as: app-name menu, File, Edit, Format, View, app-specific menus, Window, Help. macOS adds the Apple menu at the leading side and menu bar extras at the trailing side.
- Keep the standard menus and ordering. The system supplies many items, such as Edit > Copy for a standard text field.
- Always list the same items. Disable an item that does not apply; do not hide it.
- Use standard icons for common actions, and keep the standard shortcuts for standard items (Copy, Cut, Paste, Save, Print). Add custom shortcuts only when needed.
- Prefer short one-word menu titles, in title-style capitalization if more than one word.
- App menu: bold app name. Items in order: About, Settings..., optional app-level items, Services (macOS), Hide app, Hide Others, Show All (macOS), Quit.
- About comes first, alone in its group after a separator. Use a short app name of 16 characters or fewer, no version number, and reuse that same name for Hide and Quit. (HG-111)
- Use Settings only for app-wide settings. Put document-specific settings in File. Pressing Option turns Quit into Quit and Keep Windows.
- File menu: omit or rename it if the app has no files. Items run New, Open (with ellipsis if it asks for a file), Open Recent (names, not paths, newest first, with Clear Menu), Close, Close Tab, Close File, Save, Save All, Duplicate, Rename..., Move To..., Export As..., Revert To, Page Setup..., Print....
- File: Close becomes Close Tab in tabbed windows, and Option changes Close to Close All. Consider a Close Window item for tabbed windows.
- File: autosave periodically. For a new document ask for name and location. For multiple formats, put a format pop-up in the Save sheet.
- File: prefer Duplicate over Save As, Export, Copy To or Save To, which hide how the copy relates to the original. Reserve Export As for formats the app does not usually handle.
- File: put document-level print parameters in Page Setup; global or frequently changed ones (printer, copies) belong in the Print panel.
- Edit menu: Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Delete, Select All, Find, Spelling and Grammar, Substitutions, Transformations, Speech, then system-added Start Dictation and Emoji & Symbols at the bottom.
- Edit: name the target in Undo and Redo ("Undo Typing", "Undo Paste and Match Style").
- Edit: use "Delete", not Erase or Clear, since it equals the Delete key.
- Edit: if the app searches for files or objects, Find may fit better in File.
- Format menu (omit if no rich text): Font and Text submenus holding items such as Show Fonts, Bold, Italic, Underline, alignment, writing direction and ruler commands.
- View menu: affects all window appearance, not window navigation. Items: Show/Hide Tab Bar, Show All Tabs/Exit Tab Overview, Show/Hide Toolbar, Customize Toolbar, Show/Hide Sidebar, Enter/Exit Full Screen.
- View: provide it even with a subset of functions (for example only Full Screen). Make show/hide titles match the current state.
- App-specific menus go between View and Window, ordered from most to least general, mirroring the app's hierarchy (Mail: Mailbox, Message, Format).
- Put every custom command in the menu bar, even rare ones, so they are findable, can take shortcuts and work with Full Keyboard Access.
- Window menu: provide it even with one window, always with Minimize and Zoom. Items: Minimize, Zoom, Show Previous Tab, Show Next Tab, Move Tab to New Window, Merge All Windows, Bring All to Front, then open windows alphabetically (no panels or modals).
- Window: do not use Zoom for full screen. Put full screen in the Window menu only when the app has no View menu.
- Window: Option turns Minimize into Minimize All, Zoom into Zoom All and Bring All to Front into Arrange in Front. Consider show/hide items for panels, but not for font or color panels (Format covers them).
- Window menu does not customize or close windows; View customizes and File closes.
- Help menu (trailing end): Send Feedback to Apple, app Help, then optional extras after a separator. Keep the count small, or link extras from the help content. Help Book content gets an automatic search field.
- Dynamic items (changing with Control, Option, Shift or Command): rare. Never make one the only route to a task, use them mainly in menu bar menus, and require one modifier only (`isAlternate`).
- iPadOS: the bar is hidden until the pointer reaches the top edge or the user swipes down, is centered, has no extras or Apple menu, and shows window controls when full screen.
- iPadOS: make all functions reachable in the UI, since the bar is often hidden and dynamic items need a hardware keyboard. Do not treat the bar as a dumping ground.
- iPadOS: Settings opens the app's page in iPadOS Settings. Link in-app preferences from a separate item beneath it in the same group, along with other app-wide options.
- iPadOS: for tab navigation, consider listing each tab in the View menu with key bindings. Group items into submenus more often than on Mac, because rows are taller.
- macOS: the Apple menu cannot be changed. When space is tight the system shrinks title spacing, truncates titles and hides extras. Full-screen mode hides the bar until the pointer reaches the top.
- macOS menu bar extra: use a symbol or interface icon in black and clear, so the system can recolor it. The bar height is 24 pt. (HG-112)
- macOS menu bar extra: open a menu, not a popover, unless the content is too complex. Let people choose whether it appears, perhaps offering it during setup, and never depend on its presence.
- Offer the same function elsewhere as well, such as a Dock menu.

## Toolbars

Source: [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (tvOS: no extra rules).

A horizontal bar on the top or bottom edge holding a view title, navigation controls and search, and action items. Tab bars are for switching app areas; toolbars are not.

- Pick items deliberately so each stays distinguishable and tappable. Decide which items move to overflow as the width shrinks.
- macOS, iPadOS: the system adds the overflow menu. Never add your own, and avoid layouts that overflow by default.
- Add a More menu only when needed, with the least important actions inside. Put everything in the bar if it fits.
- macOS, iPadOS: consider letting people customize the toolbar, especially in apps with many or advanced items.
- Reduce custom bar backgrounds and tinted controls. Let the content layer set the color, and use a scroll edge effect (`ScrollEdgeEffectStyle`) to separate bar from content.
- Do not give toolbar labels a color close to colorful content behind them. Keep the default monochrome look.
- Use standard components, whose corner radii are concentric with the bar. A custom component needs a concentric radius too.
- Consider hiding toolbars temporarily for a distraction-free mode, only in suitable contexts, with a dependable way to bring them back.
- Give each window a useful title that tells windows apart, or leave it empty when redundant (Notes, one window). Never use the app name as the title.
- Keep titles to a word or short phrase, under 15 characters, to leave room for controls. (HG-113)
- Use the standard Back and Close buttons with their standard symbols, never text labels reading "Back" or "Close". A custom version must look and behave identically, used consistently.
- Offer actions that support the main tasks, most likely first, or the highest-level objects first when that fits better.
- Make each item's meaning obvious. Prefer simple recognizable symbols over text, except for actions like Edit that symbols convey poorly.
- Prefer system symbols without borders. The section already forms a container and the system draws hover and selection states.
- Use the `.prominent` style for one key action such as Done or Submit, placed on the trailing side.
- Three zones: leading edge (back, sidebar toggle, title, optional document menu; not customizable), center (common controls; customizable; collapses into overflow), trailing edge (key items, inspector buttons, search, More menu, primary action; always visible).
- Group items by function and frequency, like Keynote's presentation, playback and insertion sections.
- Keep navigation and critical actions (Done, Close, Save) in their own visually distinct sections.
- Keep groupings and placement consistent across platforms.
- Use as few groups as possible, about three at most.
- Separate text-labeled actions from symbol actions, and separate neighboring text buttons with fixed space (`UIBarButtonItem.SystemItem.fixedSpace`), so labels do not merge.
- iOS: keep only the most important items in the main bar and put the rest in a More menu.
- iOS: use a large title that shrinks to standard on scroll and returns at the top (`prefersLargeTitles`).
- iPadOS: a toolbar and a tab bar can share the top row, which keeps the full window width for content.
- macOS: the toolbar sits in the window frame, titles can sit inline, and items have no bezel.
- macOS: every toolbar item must also be a menu bar command, but not every menu command needs a toolbar item.
- visionOS: prefer the system toolbar, which sits at the window's bottom edge, slightly forward, above the window controls, with a variable blur background.
- visionOS: an item can have a symbol or text. Looking at a symbol reveals its label.
- visionOS: never build a vertical toolbar (tab bars are vertical). Keep windows from resizing narrower than the toolbar, since there is no menu bar.
- visionOS: in a modal state, show contextually relevant controls and restore the standard ones on exit.
- visionOS: avoid pull-down menus in the toolbar, since they are hard to find and may cover the window controls beneath.
- watchOS: toolbar buttons can sit at the top corners or the bottom edge (`topBarLeading`, `topBarTrailing`, `bottomBar`). They stay visible above scrolling content.
- watchOS: a scrolling toolbar button (`primaryAction`) stays hidden until the user scrolls to the top. Use it for an important action that is not the view's main purpose, like New Message in the Inbox.

## Action sheets

Source: [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets). Applies to: iOS, iPadOS, macOS, tvOS, watchOS (not visionOS).

A modal list of choices tied to an action the user just started. In SwiftUI use a confirmation dialog (`.confirmationDialog`); in UIKit use `UIAlertController.Style.actionSheet`.

- Use an action sheet, not an alert, for choices linked to an intentional action, such as save or delete a draft. Alerts report unexpected problems.
- Use sparingly, because each one interrupts the task.
- Keep the title to one line, and add a message only when needed.
- Add a Cancel button when the action can destroy data. It goes at the bottom (upper-left on watchOS). SwiftUI confirmation dialogs include it by default.
- Mark destructive choices with the destructive style and put them at the top (`UIAlertAction.Style.destructive`).
- iOS, iPadOS: use an action sheet instead of a menu for choices that follow an action, since people expect menus only when they open one.
- iOS, iPadOS: avoid a scrolling action sheet, since scrolling risks accidental taps.
- watchOS: the sheet has a title, optional message, Cancel and other buttons, using Default, Destructive and Cancel styles.
- watchOS: show at most four buttons including Cancel, so at most three other choices.

## Alerts

Source: [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

A modal for critical, immediate information: problems, data-loss warnings, confirmations.

- Use alerts sparingly and only with essential info and useful actions.
- Do not alert for information alone. Show it in context, such as an indicator the user can open.
- Skip alerts for common destructive actions that can be undone. Alert for rare, irreversible ones.
- Do not show an alert at launch. Surface new info discoverably, and for problems like no network show cached data and a quiet label.
- An alert has a title, optional text, and up to three buttons. iOS, iPadOS, macOS and visionOS may add a text field. macOS and visionOS may add an icon and accessory view. macOS may add a suppression checkbox and a help button.
- Be direct and neutral, never oblique or accusatory, and do not hide severity.
- Write a specific title saying what happened, where and why. Avoid "Error" or code-only titles, and keep it within two lines.
- A full-sentence title uses sentence-style capitalization and ending punctuation. A fragment uses title-style capitalization and no ending punctuation.
- Add informative text only if useful: short, full sentences, sentence-style capitalization.
- Do not explain what buttons do. If you must, say "choose" and use the exact button title without quotes.
- Include a text field only when input is required, for instance a secure field for a password.
- Button titles: one or two words, preferably verbs tied to the alert text ("View All", "Reply", "Ignore"), sentence-style capitalization, no ending punctuation.
- Use "OK" only in purely informational alerts, never "Yes" or "No". Prefer specific titles such as Erase, Convert, Clear or Delete. Always title a canceling button "Cancel".
- Place the likeliest button trailing in a horizontal row, or first in a vertical stack; the default button always takes that spot. Cancel is leading or at the bottom.
- Apply the destructive style only when the destructive action was not what the user deliberately chose. For example, Empty Trash after choosing Empty Trash is not styled destructive.
- Pair any destructive action with a Cancel button, never make Cancel the default, and consider having no default so people read it. A lone default button should be Done, not Cancel.
- Support extra ways to cancel: Home Screen exit (iOS, iPadOS), Escape or Command-Period with a keyboard (iOS, iPadOS, macOS, visionOS), Menu on the tvOS remote.
- iOS, iPadOS: use an action sheet for choices tied to an action. Keep titles short and messages brief so the alert does not scroll.
- macOS: the app icon appears by default and can be replaced. Use repeat-suppression, an accessory view (`accessoryView`) and a help button as needed.
- macOS: use the caution symbol (`exclamationmark.triangle`) sparingly, for real risk of unexpected data loss, not for save or empty-trash style overwrites.
- visionOS: in the Shared Space the alert floats slightly in front of the window and stays anchored if the window moves. In a Full Space it is centered in the field of view.
- visionOS: cap an accessory view at 154 pt tall and give it 16 pt rounded corners. (HG-114)

## Page controls

Source: [Page controls](https://developer.apple.com/design/human-interface-guidelines/page-controls). Applies to: iOS, iPadOS, tvOS, visionOS, watchOS (not macOS).

A row of indicator dots for moving through a flat, ordered list of pages. The filled dot marks the current page and dots are evenly spaced.

- Use it for sequential pages only, not hierarchies or unordered relations. For those, use a sidebar or split view.
- Center it horizontally near the bottom of the view or window.
- Keep it to about 10 pages or fewer. For more peers, switch to something like a grid that allows any-order navigation.
- Custom indicator images are optional (`preferredIndicatorImage`, `setIndicatorImage(_:forPage:)`). Use them only when they add meaning, such as `location.fill` for the current-location page in Weather.
- Keep custom indicator images simple: no negative space, text or inner lines, which turn muddy at small sizes.
- Use at most two different indicator images in one control.
- Do not color indicators. Let the system color them so the current page keeps its contrast.
- iOS, iPadOS: the current dot is highlighted, and when dots overflow, the outer ones shrink to hint at more pages.
- iOS, iPadOS: interactions are tap (next or previous page, or a specific dot with a pointer on iPadOS) and scrub (drag along the control; dragging past an end jumps to the first or last page).
- iOS, iPadOS: do not animate page transitions while scrubbing, to avoid lag and flashes. Animate scrolling only for taps.
- iOS, iPadOS: background styles are automatic (shown while interacting, for secondary controls), prominent (always shown, only for the primary navigation) and minimal (never shown, position display only) (`backgroundStyle`).
- iOS, iPadOS: do not support scrubbing with the minimal style, since it gives no scrub feedback.
- tvOS: use it for full-screen, content-rich peer pages without extra controls that would disturb focus.
- visionOS: the control only shows pages and the current page; people cannot interact with it.
- watchOS: shown at the bottom for horizontal paging, or beside the Digital Crown for a vertical tab view, where it tracks position within the page and the page set.
- watchOS: prefer vertical pagination with the Digital Crown over horizontal paging or deep hierarchies. Give each page a distinct purpose, and aim to fit one screen height, placing variable-height pages after fixed-height ones.

## Panels

Source: [Panels](https://developer.apple.com/design/human-interface-guidelines/panels). Applies to: macOS only.

A floating supplementary window with controls or info about the active window or selection. Other platforms should use a modal view.

- Use a panel for quick access to controls tied to the working content.
- A panel suits an inspector, which updates as the selection changes. An Info window keeps fixed contents, so use a regular window for that. A split view pane is another option.
- Prefer simple adjustment controls such as sliders and steppers. Avoid text entry and pick-then-act controls that take several steps.
- Give the panel a title bar and a short noun title in title-style capitalization, like "Fonts", "Colors" or "Inspector".
- When the app becomes active, bring all its panels to the front. When it goes inactive, hide them.
- Do not list panels in the Window menu's document list. Show/hide commands are fine.
- Normally leave out the minimize button.
- In menus, name panels by title without the word "panel" ("Show Fonts"). In help, use the title, or the title plus "window" when clearer.
- Use a HUD only in media-oriented apps, when a standard panel would hide essential content, and when it needs no controls other than a disclosure triangle, since other system controls clash with HUD styling (`hudWindow`).
- Keep one panel style across modes; if the HUD appears in full screen, keep it outside full screen.
- Use color sparingly in a HUD: small amounts of high-contrast color.
- Keep HUDs small so they do not hide or compete with the content they adjust.

## Popovers

Source: [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

A transient view anchored to a control or area, for a small amount of info or a few related tasks.

- Limit content to a few related tasks, since it disappears after use.
- Use a popover when a sidebar or panel would take too much space for temporary content.
- Aim the arrow directly at the triggering element and avoid covering it or other needed content.
- Add a Close, Cancel or Done button only when it clarifies the outcome, such as saving versus discarding. Otherwise it closes on outside click or tap, or on selection.
- With multi-select content, keep it open until explicit dismissal or an outside click or tap.
- Save work when a nonmodal popover auto-closes. Discard only after an explicit Cancel.
- Show one popover at a time and never cascade popovers. Close the current one before opening another.
- Show nothing above a popover except an alert.
- Let people switch from one popover to another with a single click or tap, especially across bar buttons.
- Size it only as large as the content and arrow need.
- Animate size changes between condensed and expanded states so it does not look like a replacement.
- In help text, refer to the task or selection, not to a "popover".
- Do not use a popover for warnings, which are easy to miss or dismiss. Use an alert.
- iOS, iPadOS: avoid popovers in compact size classes. Present a full-screen sheet there instead, and keep popovers for wide views.
- macOS: consider making a popover detachable into a panel (`NSPopover`), with minimal appearance change after detaching.

## Scroll views

Source: [Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

Lets content larger than its frame move vertically or horizontally. The view itself is invisible; the translucent indicator shows position.

- Support the default scroll gestures and keyboard shortcuts. A custom scroller still needs elastic (rubber-band) indicator behavior.
- Hint that content continues, for instance by showing a partial item at the edge, since indicators are not always visible.
- Never nest scroll views of the same orientation. Mixed orientations (horizontal inside vertical) are fine.
- Consider page-by-page scrolling when it suits the content (`PagingScrollTargetBehavior`). Subtract an overlap unit, such as a line of text, from the page size to keep context.
- Scroll automatically only to restore context: revealing a new selection or search hit, returning to the insertion point when typing starts, following the pointer past the edge during selection, and bringing a selection into view before acting on it.
- Scroll no more than needed, and do not bring a whole selection into view if part of it is visible.
- If you support zoom, set sensible minimum and maximum scale.
- Scroll edge effects (iOS, iPadOS, macOS) separate floating bars from scrolling content. Add one manually for custom bars if needed, or switch style between automatic, hard and soft (`ScrollEdgeEffectStyle`).
- Prefer the automatic style, which is more opaque for busy toolbars, text outside glass controls and pinned table headers. Test legibility thoroughly if you pick soft.
- Use a scroll edge effect only where a scroll view sits behind floating elements. It is not decoration or an overlay.
- Use one effect per view. In split layouts each pane may have its own; keep their heights consistent.
- iOS, iPadOS: with a page control on a paged scroll view, hide the scroll indicator on the same axis.
- macOS: the indicator is called a scroll bar. In a space-tight panel, use small or mini scroll bars and give all controls in that panel the same size.
- tvOS: no separate scroll indicators. The system scrolls to keep the focused item visible.
- visionOS: the indicator is small and fixed in position (vertically centered at the trailing edge, or horizontally centered at the bottom edge), and gives a jog-bar speed control when dragged.
- visionOS: the indicator is slightly thicker than on iOS, so widen tight margins to keep it from overlapping content.
- visionOS Look to Scroll (`look`, `ScrollInputKind`) is opt-in per scroll view. Add it to reading and browsing views, not to dense or precise-control views such as a notes list, and use it consistently across similar views.
- visionOS: make Look to Scroll views full window width or height with clear edges, or give inset views clear boundaries. Remove custom scroll-driven effects such as parallax first.
- watchOS: prefer vertical content for Digital Crown scrolling. Use tab views as vertical pages with a page indicator that grows into a scroll indicator for long pages.
- watchOS: keep each page to one screen height where possible, and put variable-height pages after fixed-height ones.

## Sheets

Source: [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (tvOS: no extra rules).

A scoped task presented over the parent view, such as attaching a file or picking a save location. Modal everywhere except iOS and iPadOS, where it can be nonmodal.

- Cancel (or Close) dismisses without saving. Done dismisses after completing or saving. Back goes to a previous step or parent and never dismisses the sheet.
- For long or complex flows, use alternatives: a full-screen modal (`UIModalPresentationStyle.fullScreen`) on iOS and iPadOS, a new window or full screen on macOS, or a Full Space on visionOS.
- Show one sheet at a time. If a sheet's action needs another, close the first, then show the second, and reopen the first afterward if needed.
- For supplementary items that affect the parent task, use a nonmodal view: nonmodal sheet (iOS, iPadOS), panel (macOS) or split view (visionOS).
- Pair Done with Cancel or Back. Do not show Cancel, Done and Back together.
- iOS, iPadOS: for a one-view sheet, Cancel sits at the leading end of the top toolbar and Done at the trailing end. In multi-step flows, placement can change by step.
- iOS, iPadOS: resizable sheets rest at detents (`detents`): large (fully expanded, default) and medium (about half). Medium alone blocks expansion to full height.
- iPhone: offer medium for progressive disclosure, like the share sheet. Skip it for content that needs full height, such as compose sheets.
- iOS, iPadOS: add a grabber to resizable sheets (`prefersGrabberVisible`). Tapping cycles detents and it works with VoiceOver.
- iOS, iPadOS: support swipe-down to dismiss. With unsaved changes, confirm through an action sheet.
- iPadOS: prefer page or form sheet presentation styles (`UIModalPresentationStyle`), centered on a dimmed background.
- macOS: the sheet is a rounded card floating on the dimmed parent window. Open at a sensible default size, and support resizing when helpful.
- macOS: let people bring other app windows forward without dismissing the sheet. Opening a sheet brings its parent (and a document's modeless panels) forward.
- macOS: for repeated input with observable results, such as find and replace, use a panel instead.
- visionOS: do not slide a sheet up from the window bottom. Prefer centering it in the field of view.
- visionOS: use a default size that keeps context, not covering most of the window, and optionally allow resizing.
- watchOS: a sheet is a full-screen, semitransparent, blurred overlay. Use it only when a modal task needs custom title or content; otherwise use an alert or action sheet.
- watchOS: keep sheet use brief and occasional, never for navigation.
- watchOS: if you change the default dismiss label, prefer an SF Symbol. Avoid text that looks like a page title or implies hierarchy, since people then cannot tell how to dismiss.

## Windows

Source: [Windows](https://developer.apple.com/design/human-interface-guidelines/windows). Applies to: iPadOS, macOS, visionOS (not iOS, tvOS, watchOS).

Windows hold an app's views and set its visual boundaries. A primary window carries main navigation and content. An auxiliary window serves one task, has no navigation to other areas, and usually has a close button.

- Make windows adapt fluidly to any size for multitasking and multiwindow use.
- Open a new window only when it helps, like Mail's compose window next to the open message. Avoid it as a default, since it adds clutter.
- Offer "open in new window" as an option through a context menu or File menu item (`OpenWindowAction`).
- Use system window frames and controls. Custom imitations that are not perfect make the app feel broken.
- Call them "window" in user-facing text, never "scene".
- iPadOS: windows are either full screen (switch via the app switcher) or windowed (freely resizable, multiple at once, size and position remembered).
- iPadOS: windowed mode puts window controls at the toolbar's leading edge. Move leading toolbar buttons inward when the controls appear so they are not hidden.
- iPadOS: consider a gesture that spawns a separate window for an item, such as pinching a Notes entry. To view just a file, present a preview scene while still supporting multiple windows.
- macOS: a window is a frame (title/toolbar, window controls, rarely a bottom bar) plus a body. Dragging the frame moves it; dragging edges resizes.
- macOS states: main (one per app, frontmost), key (accepts input, one onscreen), inactive. Colors in the title bar controls show up only for key windows, and inactive windows lose materials and look farther away.
- macOS: custom windows must follow the system appearances for each state. System components do it automatically; custom ones must be updated by you.
- macOS: some panels (Fonts, Colors) become key only when the title bar or a text field is clicked.
- macOS: keep critical info and actions out of a bottom bar, since windows are often moved so that the bottom edge is hidden. If used, show only a little related info, like Finder's item count and free space. Use an inspector for more.
- visionOS styles: default window, volumetric window (volume) and plain window (no glass background, `PlainWindowStyle`). Both the default window and the volume can hold 2D and 3D content, in either the Shared Space or a Full Space.
- visionOS: windows use dynamic scale, with a close button, a window bar and resize handles, plus optional Share button, tab bar, toolbar and ornaments (`DefaultWindowStyle`).
- visionOS: prefer a window for familiar interfaces and tasks, saving immersive modes for meaningful content. Use a volume for bounded 3D content such as a game board.
- visionOS: keep the glass background. Removing it hurts legibility and unity, and an opaque background feels heavy and hides surroundings.
- visionOS: the default window size is 1280x720 pt. Pick an initial size with little empty space. (HG-115)
- visionOS: the system opens the first window about two meters ahead, appearing about three meters wide. (HG-116)
- visionOS: choose an initial shape that fits the content (wide for Keynote, tall for Safari, tall for a tower game). Set minimum and maximum sizes so layouts neither overlap nor become unusable.
- visionOS: keep 3D content in a window shallow, since content that extends far from the surface is clipped. Use a volume for deeper content.
- visionOS volumes: use them for rich 3D content viewable from any angle (`VolumetricWindowStyle`). Their close button and window bar turn to face the viewer.
- visionOS volumes: place 2D content so it works from several angles, and pin it to 3D content with an attachment.
- visionOS volumes: use dynamic scaling in general, and fixed scaling (default) when content represents a real object such as a product.
- visionOS volumes: keep the default baseplate glow (visionOS 2 and later) to show the volume edges, unless content is full bleed or you use a custom baseplate.
- visionOS volumes: consider one extra ornament for high-value content (anchors such as `topBack` or `bottomFront`). Never put it on the same edge as the toolbar or tab bar.
- visionOS volumes: choose floor-parallel alignment for low-interaction content and tilt-to-view alignment for content people use often, even when reclined.

## Color wells

Source: [Color wells](https://developer.apple.com/design/human-interface-guidelines/color-wells). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

A control showing a color that opens a color picker when tapped or clicked, to recolor text, shapes, guides and other elements.

- Prefer the system color picker for a familiar flow. It also lets people keep a shared palette across apps (`UIColorWell`, `UIColorPickerViewController`, `NSColorWell`).
- macOS: the clicked well highlights while active, then updates to the chosen color.
- macOS: support drag and drop of colors between wells and from the picker onto a well.

## Combo boxes

Source: [Combo boxes](https://developer.apple.com/design/human-interface-guidelines/combo-boxes). Applies to: macOS only.

A text field joined to a pull-down list. People type any value or pick a preset. A typed value is not added to the list.

- Prefill the field with a meaningful default from the list, which does not have to be the first entry. An empty field is allowed.
- Add an introductory label in title-style capitalization ending with a colon.
- Offer relevant choices in the list.
- Keep each list item no wider than the text field to avoid truncation (`NSComboBox`).

## Digit entry views

Source: [Digit entry views](https://developer.apple.com/design/human-interface-guidelines/digit-entry-views). Applies to: tvOS only.

A full-screen view for entering digits such as a PIN with a digit keyboard, with optional title and prompt above the digit line.

- Use secure digit fields, which show asterisks, for any sensitive entry.
- State the purpose through the title and prompt (`TVDigitEntryViewController`).

## Image wells

Source: [Image wells](https://developer.apple.com/design/human-interface-guidelines/image-wells). Applies to: macOS only.

An editable image view. Once selected, the image can be copied, pasted or deleted, and dragging in a new image works without selecting first.

- If the well needs an image, restore a default image when the content is cleared.
- Provide the standard Copy and Paste menu items and shortcuts when the well supports them (`NSImageView`).

## Pickers

Source: [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

Scrollable lists of distinct values, single or multipart. Date pickers add calendar and numeric entry. Shown values and their order follow the device language and location.

- Use a picker for medium-to-long lists. For short lists use a pull-down button, and for very large sets use a list or table, which can adjust in height and carry an index.
- Order values predictably (for example an alphabetical country list) so hidden values can be guessed.
- Show the picker in context, below or near the field being edited, usually at the bottom of the window or in a popover. Do not switch views for it.
- In date pickers, consider coarser minute steps. The default minute list has 60 values (0 to 59). Any interval that divides evenly into 60 works, such as 15 minutes. (HG-117)
- iOS, iPadOS date picker styles: compact (a button showing the value in the accent color that opens a modal editor), inline (a calendar, or a wheel button for time only), wheels (scrolling wheels with keyboard entry), automatic (system choice).
- iOS, iPadOS modes: date, time, date and time, and countdown timer. Countdown goes up to 23 hours 59 minutes and is unavailable in the inline and compact styles. (HG-118)
- iOS, iPadOS: use the compact style when space is tight. People can make several edits and confirm by tapping outside the modal.
- macOS (`NSDatePicker`): choose textual style for limited space and exact entry, or graphical style for calendar browsing, date ranges, or a clock-face look.
- tvOS: pickers are available through SwiftUI `Picker`.
- watchOS: lists navigate with the Digital Crown and use a wheels style (also for date and time). Configure outline, caption and scroll indicator as needed.
- watchOS: for long lists, the navigation link style shows a button that opens the list, and the Crown can scrub the options without tapping.

## Segmented controls

Source: [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

A linear set of two or more equal-width segments that work like buttons. They give a single choice (multiple on macOS) or act as a momentary button set (`isMomentary`).

- Use it when a few tightly related options act on an object, a state or a view, for example inside an inspector or toolbar.
- Choose it when grouping must persist at any size or the selection state should be visible at a glance.
- Do not mix types in one control: no actions in a selection control, no selection state in an action control.
- Limit segments to about five to seven in wide layouts and about five on iPhone.
- Keep segment widths, and icon and title widths, consistent.
- Use text or images in one control, not a mix.
- Give segments content of similar size so equal-width segments look balanced.
- Use noun or noun-phrase labels in title-style capitalization. Text segments need no intro text.
- iOS, iPadOS: use it to switch between closely related subviews (Calendar's event versus reminder). For separate app sections use a tab bar.
- macOS: consider intro text, labels under icon segments, and a tooltip per segment.
- macOS: in the main window area, use a tab view for view switching. A segmented control fits a toolbar or inspector pane for that.
- macOS: consider spring loading (force click while dragging items) (`NSSegmentedControl`).
- tvOS: for content filtering screens, prefer a split view. Segments select on focus, so keep other focusable elements away to avoid accidental focus.
- visionOS: icon segments show a tooltip with the description you supply.

## Sliders

Source: [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (not tvOS).

A horizontal track with a thumb between a minimum and maximum. The track fills with color up to the thumb, and optional end icons explain the extremes.

- Customize track color, thumb image and tint, and end icons when it adds meaning, such as a small and large image icon for an image-size slider.
- Keep the familiar direction: minimum on the leading side and maximum on the trailing side (horizontal), minimum at the bottom and maximum at the top (vertical).
- For wide ranges, consider adding a text field to show and set the exact value, and a stepper for whole increments.
- iOS, iPadOS: never use a slider for audio volume. Use the volume view, which includes output-device switching.
- macOS: sliders may have tick marks. A linear slider has a narrow lozenge thumb, and a circular slider has a small round thumb with dot ticks around the circumference.
- macOS: consider live feedback while dragging, like the Dock size slider scaling icons.
- macOS: use a horizontal slider for a fixed range such as opacity from 0 to 100 percent. (HG-119)
- macOS: use a circular slider for repeating or unbounded values, such as rotation from 0 to 360 degrees, or four spins equaling 1440 degrees. (HG-120)
- macOS: consider an intro label in sentence-style capitalization ending with a colon.
- macOS: add tick marks for clarity and optionally label them (numbers or words). Labeling just the minimum and maximum is often enough, but nonlinear scales benefit from periodic labels. Add a tooltip showing the thumb value on hover.
- visionOS: prefer horizontal sliders, since side-to-side gestures are easier.
- watchOS: the slider is a discrete-step or continuous bar with side buttons that change the value by a set amount. Plus and minus are defaults, and custom glyphs are allowed.

## Steppers

Source: [Steppers](https://developer.apple.com/design/human-interface-guidelines/steppers). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

A two-segment control to raise or lower a value in increments. It does not display the value, so it sits beside a field that does.

- Make it obvious which value the stepper changes.
- Pair it with a text field when large or widely varying changes are likely, such as number of copies when printing.
- macOS: for large ranges, support Shift-click to change the value by a bigger step, for example ten times the default (`NSStepper`, `UIStepper`).

## Text fields

Source: [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

A rectangle for entering or editing short, specific text such as a name or email. Use a text view for larger amounts.

- Show placeholder text (such as "Email") as a hint, and keep a separate label, since placeholders vanish while typing.
- Use a secure field for sensitive data like passwords (`SecureField`).
- Size the field to the expected amount of text.
- Space multiple fields evenly so each label clearly belongs to its field. Stack them vertically with consistent widths per kind (names one width, address another).
- Keep tab order logical. The system usually handles it.
- Validate at the right time: an email when focus leaves the field, a username or password before leaving it. Alert people to invalid characters, such as non-digits in a digits-only field.
- Use a number formatter to accept only numbers and to format decimals, percent or currency, but do not assume the presentation, since locales differ.
- Choose a line-break mode: clip (default), wrap by character or word, or truncate with an ellipsis at the start, middle or end. Consider an expansion tooltip for clipped text.
- iOS, iPadOS, tvOS, visionOS: show the keyboard type that fits the content (see virtual keyboards).
- tvOS, watchOS: minimize text entry. Gather input with buttons or lists instead.
- iOS, iPadOS: show a Clear button at the trailing end. Use the leading end for an image showing purpose, and the trailing end for extra features such as a Bookmarks button.
- macOS: consider a combo box to pair text input with preset choices.
- watchOS: present a text field only when needed. Prefer a list of options.

## Toggles

Source: [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles). Applies to: iOS, iPadOS, macOS (no extra rules for tvOS, visionOS, watchOS).

A control choosing between two opposing states. Styles include switch and checkbox. Buttons can also act as toggles (`ToggleStyle`).

- Use a toggle only for an on/off type state of content or a view. For lists of options use a pop-up button.
- Make clear what is being toggled. Context is usually enough, and a label is common on macOS. A toggle-style button uses a purposeful icon and changes its background by state.
- Make state differences obvious (fill, shape, checkmark or dot). Never rely on color alone.
- iOS, iPadOS: use the switch style only in a list row, without its own label.
- iOS, iPadOS: change the default green only if needed, and ensure the new color contrasts enough against the off appearance.
- iOS, iPadOS: outside a list use a toggle-style button, such as Phone's filter button with a blue highlight when active. Do not add a label that explains it (`changesSelectionAsPrimaryAction`).
- macOS: place switches, checkboxes and radio buttons inside the window body. Keep them out of toolbars and status bars.
- macOS switch: prefer it for emphasized settings or groups of settings. Use a mini switch for a single row in a grouped form; when settings nest, make the parent a regular switch and the children mini switches.
- macOS: do not swap an existing checkbox for a switch.
- macOS checkbox: a square button, empty when off, a checkmark when on, a dash when mixed, usually with a trailing title (no title in editable checklists).
- macOS: use checkboxes, not switches, for a hierarchy of settings, aligned on the leading edge with indentation. Intro a group with a label, baseline aligned to the first checkbox, if the relation is unclear.
- macOS: show the true state, including mixed when subordinate checkboxes differ (`allowsMixedState`).
- macOS radio buttons: a circle plus label, normally in groups of two to five, for mutually exclusive choices of more than two options. Selected is a filled circle.
- macOS: a mixed state on a radio button is rarely useful. Use a checkbox for that. For multiple selections, use checkboxes.
- macOS: with more than about five options, switch to a pop-up button.
- macOS: use a checkbox for a single on/off setting. Use a pair of labeled radio buttons only if one checkbox is unclear.
- macOS: space horizontal radio buttons consistently, based on the longest label.

## Virtual keyboards

Source: [Virtual keyboards](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards). Applies to: iOS, iPadOS, tvOS, visionOS, watchOS (not macOS).

On-screen keyboards tuned to the input type. They do not support keyboard shortcuts.

- Choose the keyboard type that matches the content (numbers, email, URL, phone, decimal, web search and so on). Set semantic meaning so the system picks the keyboard and refines corrections (`keyboardType(_:)`, `textContentType(_:)`, `UIKeyboardType`).
- Customize the Return key type when it clarifies the action, such as a search key for search (`submitLabel(_:)`, `UIReturnKeyType`).
- Custom input view: use it only when it improves data entry in your app, like Numbers' numeric view. Make sure people see its benefit, so they do not wonder why the system keyboard is gone (`inputViewController`).
- In a custom input view, play the standard keyboard sound (`playInputClick()`), which users can turn off in Settings > Sounds.
- Custom keyboard (iOS, iPadOS, tvOS): an app extension that works across apps, except secure text fields and phone number fields. Use it for systemwide features or unsupported languages. For in-app only needs, use a custom input view.
- Custom keyboard: give an obvious way to switch keyboards (people expect the Globe key). Do not duplicate Emoji/Globe or Dictation keys the system adds below.
- Custom keyboard: provide a tutorial in your app (how to enable, activate, use, switch back), not inside the keyboard.
- iOS, iPadOS: use the keyboard layout guide (`UIKeyboardLayoutGuide`) so the keyboard integrates with the layout and key content stays visible.
- iOS, iPadOS: place custom controls above the keyboard (input accessory view) only if relevant to the current task. Use a standard toolbar for automatic Liquid Glass, or apply Liquid Glass to your container when other views use it, with standard padding.
- tvOS: Siri Remote shows a linear keyboard; other devices show a grid keyboard screen. A digit entry view shows a digit keyboard.
- visionOS: the keyboard is a movable separate window supporting direct and indirect gestures. Do not plan layout around its position.
- watchOS: a keyboard shows on large enough screens, otherwise dictation or Scribble. You cannot change the keyboard type but can set the field's content type for suggestions. A paired iPhone can also enter text.
