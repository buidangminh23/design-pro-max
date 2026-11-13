# Components: system experiences

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- App Shortcuts
- Complications
- Controls
- Live Activities
- Notifications
- Snippets
- Status bars
- Top Shelf
- Watch faces
- Widgets

## App Shortcuts

Source: [App Shortcuts](https://developer.apple.com/design/human-interface-guidelines/app-shortcuts). Applies to: iOS, iPadOS, watchOS and visionOS (macOS runs the underlying actions only; not tvOS).

Governs the ready-made actions an app hands to Siri, Spotlight, the Shortcuts app, the Action button and Apple Pencil squeeze. Use it when exposing app tasks to the system through App Intents.

- Build every App Shortcut on App Intents; each one bundles one or more actions that together finish a task.
- Ship no more than 10 App Shortcuts per app. (HG-121)
- Expect shortcuts to work as soon as installation ends, before the first launch, and let them reflect the person's own choices later (for example recent contacts).
- For common domains, adopt app schemas first so Siri and Apple Intelligence surface features in context; keep App Shortcuts for unique features or custom content that schemas do not cover.
- Limit shortcuts to the app's most common and important tasks; favor tasks finishable without leaving the current context, and open the app only when a multistep task is easier there.
- Allow at most one optional parameter, and fill it with predictable, familiar values (for example "Start [morning, daily, sleep] meditation"), because nobody sees the option list while speaking.
- When optional input is missing, ask a follow-up and propose the likeliest default (last used, or based on time of day) plus a short list of alternatives.
- Keep spoken phrases easy to say; a phrase that feels awkward aloud, or that carries two parameters, is too complex. Collect extra required details in a later step.
- Teach the shortcut in the app: show an occasional tip after the person does the matching action (`SiriTipUIView`).
- Respond with Siri dialogue plus custom visuals: use snippets for static information or choice dialogs, and Live Activities (`LiveActivityIntent`) for information that stays relevant and changes over time, such as timers and countdowns.
- Put every critical piece of information in the full dialogue text (`init(full:supporting:systemImageName:)`), because replies are also delivered on devices without a screen, for instance earbuds and smart speakers.
- Write short, memorable activation phrases and natural variants; each phrase must contain the app name, which can be used creatively (`AppShortcutPhrase`).
- Write "App Shortcuts" and the "Shortcuts app" in title case with Shortcuts plural; write an individual user-made shortcut in lowercase.
- iOS, iPadOS: Expect App Shortcuts to be listed under a Spotlight search for the app, first in its Top Hit entry and then in the Shortcuts section below.
- iOS, iPadOS: Give each shortcut an SF Symbol that represents it, or a preview image of the item it links to.
- iOS, iPadOS: List the most broadly useful shortcuts first; that order sets the initial arrangement in Spotlight and the Shortcuts app, and the system later promotes the most used ones.
- macOS: Do not plan for App Shortcuts; actions built with App Intents still work, and people can combine them into custom shortcuts in the Shortcuts app on Mac.

## Complications

Source: [Complications](https://developer.apple.com/design/human-interface-guidelines/complications). Applies to: watchOS only (not iOS, iPadOS, macOS, tvOS or visionOS).

Covers the glanceable data an app places on a watch face. Use it when designing or sizing complications; build them with WidgetKit on watchOS 9 and later and keep legacy ClockKit templates only for older systems.

- Show essential, changing information that people want at a glance; a static complication with no meaningful data is less likely to stay on the face.
- Support every complication family when you can, since each extra family lets the complication appear on more watch faces; where no useful data fits, fall back to an app image (such as the icon) that still launches the app.
- Offer several complications per family so people can build a face around the app, and pair them with a shareable watch face that preconfigures them.
- Give each complication its own deep link to the most relevant area of the app; identical destinations make them seem less useful.
- Treat privacy seriously: the Always-On display can expose the face to onlookers, so help people keep sensitive data hidden.
- Plan the data timeline carefully: each entry carries the time it should appear, the number of daily timeline updates is limited, and the system stores only a limited number of entries per app, so choose times that add value (a weather app shows a forecast at the moment it applies).
- Pick the gauge style by data type: closed for a share of a whole (such as battery), open for arbitrary minimum and maximum values (such as speed), segmented for a range with fast changes.
- Make images work in tinted mode, where the system turns text, gauges and images into one wearer-chosen color and desaturates full-color images.
- Never rely on color alone for meaning, so tinted and non-tinted modes convey the same information.
- Supply a separate tinted-mode version of any full-color image that looks poor once desaturated (`WidgetRenderingMode`).
- Use line widths of at least 2 points in complication artwork, since thinner lines are hard to read while moving. (HG-122)
- Provide static placeholder images for every complication; the system shows them before data exists and in the complication picker. Their size can differ from the live image, and sizes vary by layout (`placeholder(in:)`).
- Circular: Use circular layouts for text, gauges and full-color images on the Infograph and Infograph Modular faces; the extra-large circular layouts serve the X-Large face.
- Circular: Expect bezel text beside a regular circular image to curve along the bezel and truncate after filling nearly 180 degrees. (HG-123)
- Circular: Size a regular circular image from 42x42 pt on 40mm watches to 50x50 pt on 45mm/49mm; the system applies a circular mask. Closed gauge, open gauge and stack images have their own smaller sizes (see source). (HG-124)
- Circular: Default SwiftUI text in a regular circular layout is rounded, medium weight, from 12 pt (40mm) to 14.5 pt (45mm/49mm). (HG-125)
- Circular: Size an extra-large circular image from 120x120 pt (40mm) to 143x143 pt (45mm/49mm); circular masking applies to the image and gauge variants. (HG-126)
- Circular: Default text in the extra-large circular layout is rounded, medium weight, 34.5 pt on 40mm up to 41 pt on 45mm/49mm. (HG-127)
- Corner: Use corner layouts for images, text and gauges in the face corners (such as Infograph); some templates take multicolor text.
- Corner: Size the circular corner image from 32x32 pt (40mm) to 38x38 pt (45mm/49mm); gauge and text images are smaller (see source). (HG-128)
- Corner: Default text is rounded semibold, from 10 pt (40mm) to 12 pt (45mm/49mm). (HG-129)
- Inline: Use utilitarian small for a small rectangle in a face corner (images, interface icons, circular graphs) and utilitarian large for a mostly text row along the bottom, with an optional leading interface icon. Per-size image values are in the source tables.
- Rectangular: Use the large rectangular area for information-rich charts, graphs and diagrams of values that change over time; the Heart Rate complication charts a 24-hour span in high-contrast white and red with low-contrast gray for lines and labels. (HG-130)
- Rectangular: On watchOS 10 and later the system may place a rectangular layout in the Smart Stack; improve that by supplying a recognizable background color or content, declaring relevancy through intents, or building a layout made for the Smart Stack (`WidgetFamily.accessoryRectangular`).
- Rectangular: Size the large image with title from 150x47 pt (40mm) to 178.5x56 pt (45mm/49mm), and without title from 162x69 pt to 193x82 pt; both include a four-point corner radius. (HG-131)
- Rectangular: Default text is rounded medium, from 16.5 pt (40mm) to 19.5 pt (45mm/49mm). (HG-132)
- Legacy templates: Use them only for pre-watchOS 9 support; they are not tinted by the wearer's color unless graphic. Families are circular small, modular small, modular large and extra large, each with its own image, stack and placeholder sizes (for example ring 20x20 pt on 38mm to 26x26 pt on 45mm/49mm for circular small); take exact values from the source tables. (HG-133)
- Legacy templates: In stack measurements, treat the width as a maximum.

## Controls

Source: [Controls](https://developer.apple.com/design/human-interface-guidelines/controls). Applies to: iOS, iPadOS and macOS (Control Center, Lock Screen, Action button); not watchOS, tvOS or visionOS.

Describes buttons and toggles that expose app features in Control Center, on the Lock Screen and on the Action button. Use it when adding WidgetKit controls.

- Build a control from a symbol, a title and an optional value; the title names what it relates to and the value shows its state.
- Expect the Lock Screen to show just the symbol, larger Control Center tiles to add title and value, and the Dynamic Island to show symbol and value while the Action button is held.
- Use controls for actions that pay off without opening the app, such as starting a Live Activity.
- Refresh a control when the person uses it, when an action finishes, or by remote push so it shows true state and any action still in progress.
- Pick a descriptive symbol that implies the behavior, since the title and value may be hidden; give toggles a symbol for both on and off (for example `door.garage.open` and `door.garage.closed`).
- Animate symbols to show state changes: animate toggle transitions between on and off, and keep a button's symbol animating for as long as a timed action runs (`SymbolEffect`).
- Choose a brand-compatible tint; it colors a toggle symbol in the on state and the value and symbol shown in the Dynamic Island for the Action button.
- If setup is needed (for example choosing which light), prompt for it when the control is first added and allow later reconfiguration (`promptsForUserConfiguration()`).
- Provide verb-based hint text for the Action button so people know what press-and-hold does (`controlWidgetActionHint(_:)`).
- Include placeholder title and value when they vary, so the controls gallery and the Action button picker explain the control.
- Redact the title and value while the device is locked when they are personal or security-related; the symbol can also be redacted so it shows its off state.
- Require authentication for security-affecting actions such as locking doors or starting a car (`IntentAuthenticationPolicy`).
- Camera on a locked device (iOS 18 and later): offer a control that opens straight to the app's capture experience, and require unlock for anything beyond capture (`LockedCameraCapture`).
- Camera on a locked device: reuse the app's own camera UI for a seamless handoff, and explain how to add the control.

## Live Activities

Source: [Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities). Applies to: iOS, iPadOS, with automatic presence on macOS, watchOS and CarPlay (not tvOS or visionOS).

Covers glanceable, frequently updated tracking of a task or event from the Dynamic Island, Lock Screen, StandBy, Mac menu bar, Apple Watch Smart Stack and CarPlay. Use it when designing every presentation of a Live Activity.

- Support all four presentations: compact, minimal, expanded and Lock Screen; the system derives other contexts (Watch, CarPlay, Mac) from them.
- Use Live Activities for tasks and events with a clear start and end, lasting no more than eight hours. (HG-134)
- Show only what matters at a glance and let a tap open the app for detail.
- Keep ads and promotions out of a Live Activity; show only content tied to the ongoing event.
- Avoid sensitive data because Lock Screen and Always-On views are visible to bystanders; show a neutral summary or redact, and let people choose to reveal details.
- Match the app's look and personality in both light and dark appearances.
- Show a logo mark without a container and never the full app icon.
- Do not add app elements that draw attention to the Dynamic Island.
- Use large, heavier text (medium weight or more) and little small text.
- Scale layouts and assets for various devices and presentations, using the Specifications as a guide.
- Use only the space the content needs and size and place elements to fit together.
- Limited width: Fit compact and minimal views inside a 28 pt circle for cases such as landscape Dynamic Island, using a short abbreviation or graphic; if both sides cannot shrink, supply only the leading view and leave trailing empty (`isDynamicIslandLimitedInWidth`). (HG-135)
- Start from Apple's templates in Design Resources for system margins and text sizes, so the layout fits surroundings such as the Smart Stack.
- Use even margins and concentric placement so rounded shapes do not poke into the corners; match corners with `ContainerRelativeShape` instead of a hard-coded radius.
- Group content in an inset container shape or with a thick line, and never draw it right to the Dynamic Island edge.
- Change height with content on the Lock Screen and expanded presentation: shrink when there is little to show and grow as details arrive.
- Colors: You cannot set a background color for compact, minimal or expanded presentations, but you can for the Lock Screen; if you do, keep contrast adequate, especially for tints on an Always-On display with reduced luminance.
- Colors: Dynamic Island uses a black opaque background, so use bold text and object colors to convey brand and relate elements.
- Colors: Tint the key line (shown around the Dynamic Island on dark backgrounds) to match the content colors.
- Animation: Keep system and custom animations to a maximum of two seconds; none run on an Always-On display with reduced luminance. (HG-136)
- Animation: Reinforce updates with content-replace, numeric content transitions, or custom scale, opacity and movement transitions.
- Animation: When layout changes (StandBy expansion, new information), animate existing elements to new positions instead of removing and re-adding them.
- Animation: Avoid overlapping elements; in lists animate only the item that moves and fade the others.
- Interactivity: Make a tap open the app at the exact related screen, not a general entry point.
- Interactivity: Offer only simple, direct actions for essential functions people trigger once or pause and resume (music, workouts, live audio recording); prefer a single interactive element to prevent mis-taps.
- Interactivity: Add a button or toggle when people can respond to an update (such as contacting a rideshare driver).
- Lifecycle: Start at expected moments (after an order, a ride request, a match beginning) and let people turn it off from the matching in-app view, or they may disable Live Activities in Settings.
- Lifecycle: Offer an App Shortcut that starts it, for example from the Action button.
- Lifecycle: Update only when content or status actually changes.
- Lifecycle: Alert only for essential updates, since alerts light the screen, play the notification sound and expand the Dynamic Island or show a banner; do not duplicate the same update with a push notification.
- Lifecycle: Track multiple events with one Live Activity that rotates through them rather than several separate ones.
- Lifecycle: End it as soon as the task ends. The Dynamic Island and CarPlay drop it immediately; the Lock Screen, Mac menu bar and Smart Stack keep it up to four hours, so set a dismissal time proportional to its length, typically 15 to 30 minutes. (HG-137)
- Lifecycle: Choose a custom dismissal time of roughly 15 to 30 minutes for most cases, such as leaving a ride summary visible after a trip. (HG-138)
- Design the iPhone version first, then refine for StandBy, CarPlay and Apple Watch.
- Compact: Show the most important up-to-date data (for example two team logos and a score), and make the leading and trailing parts read as one piece with consistent color and typography.
- Compact: Keep content narrow and flush against the TrueDepth camera, with no padding next to it, balanced widths on both sides (use shortened units or less precise data), and without covering key status bar information.
- Compact: Link both sides to the same related screen.
- Minimal: Make it recognizable, preferably showing live data (like the Timer app's remaining time) rather than a static logo; up to three Live Activities can show when several are active.
- Expanded: Keep elements in the same relative positions as in compact or minimal so expansion is predictable, and wrap content close to the TrueDepth camera.
- Lock Screen: Create a layout unique to the data, not a copy of a notification.
- Lock Screen: Keep custom backgrounds, tints and transparency restrained so the activity sits well on customized wallpapers.
- Lock Screen: Test assets and colors in the dark appearance and on a reduced-luminance Always-On screen; the default background follows the appearance, and a custom color must suit both or be set per appearance.
- Lock Screen: Check the system-generated dismiss button color and adjust with `activitySystemActionForegroundColor(_:)` if needed.
- Lock Screen: Use the standard 14-point layout margin to align with notifications; tighter margins are fine for graphics or buttons, but do not crowd the edges. (HG-139)
- StandBy: The minimal view shows first and a tap turns it into the Lock Screen view scaled 2x; check assets at that scale and consider a custom layout. (HG-140)
- StandBy: Consider the default background color, which blends with the bezel and lets the system scale the activity larger; a custom background color is extended to fill the screen.
- StandBy: Keep standard margins and keep graphics off the screen edge so nothing is clipped; check contrast in Night Mode, which applies a red tint.
- CarPlay: The system merges compact leading and trailing elements into one CarPlay Dashboard layout; the same design is used on Apple Watch, so design for both.
- CarPlay: Declare `ActivityFamily.small` for a custom layout with larger text or more information, and avoid buttons and toggles since the system deactivates interactive elements there; prefer timely content.
- macOS: Active Live Activities appear in the paired Mac's menu bar as compact, minimal and expanded presentations, and a click opens iPhone Mirroring.
- watchOS: By default a Live Activity is pinned first in the Smart Stack, combining compact leading and trailing elements; a tap opens the watchOS app, or, without one, a full-size page offering to continue on the paired iPhone.
- watchOS: Consider a custom Watch layout for more information or an interactive button or toggle, and focus on progress, interactive controls like timers, and significant changes like score updates.
- Specifications (iOS): On a 430x932 screen compact is 62.33x36.67 pt, minimal is 36.67–45 pt wide by 36.67 pt tall, and expanded and Lock Screen are 408 pt wide by 84–160 pt high; see source for the 393x852 row. (HG-141)
- Specifications (CarPlay): Verify against sizes 240x78, 240x100 and 170x78 pt, and test Smart Display Zoom setups Widescreen 1920x720, Portrait 900x1200 and Standard 800x480. (HG-142)
- Specifications (iPadOS, macOS, watchOS): iPad Lock Screen widths are 425–500 pt with 84–160 pt height; macOS reuses iOS values; Smart Stack sizes match watchOS widgets, from 152x69.5 pt (40mm) to 198x81.5 pt (49mm Ultra 3, 4). (HG-143)

## Notifications

Source: [Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications). Applies to: All platforms; extra short-look, long-look and double-tap guidance for watchOS.

Covers timely notifications, their text, actions, badges and Apple Watch presentation. Use it before sending any notification; consent must be granted first.

- Request permission before sending anything, and respect the style and delivery settings people choose.
- Know the styles: banners on the Lock Screen, Home Screen, HomeView or desktop, badges on the app icon, and entries in Notification Center; communication notifications use contact images and group names in place of the app icon.
- Keep notifications concise and informative.
- Send one notification per event, even without a response, to avoid filling Notification Center or causing people to disable all of them.
- Do not tell people to perform tasks in the app; offer notification actions for simple tasks instead.
- Report errors with an alert, not a notification.
- When the app is in the foreground, no notification shows, so surface the data quietly (increment a badge or insert it into the current view, as Mail does).
- Keep sensitive, personal or confidential information out of notifications.
- Add a short title only if it adds context; prefer brief headlines, event names or subjects, especially on Apple Watch. If it would be generic (like New Document), let the system show the app name.
- Use title-style capitalization with no ending punctuation for titles.
- Write body text as complete, sentence-case sentences with proper punctuation, and do not truncate; the system does.
- Provide generic body text for when previews are hidden, which shows only the icon and the title Notification, such as "Friend request" or "Shipment" in sentence case (`hiddenPreviewsBodyPlaceholder`).
- Leave out the app name and icon; the system adds a large icon (or a badged contact image for communication).
- Optionally add a short, distinctive, professionally produced sound or a system sound (`UNNotificationSound`), but never rely on it alone; vibration cannot be set in code.
- Actions: A detail view supports up to four buttons. (HG-144)
- Actions: Offer beneficial, time-saving actions that fit the notification (such as Snooze), labeled with brief title-case phrases that describe the result, with no app name, localization in mind.
- Actions: Skip an action that only opens the app, since tapping the notification already does that.
- Actions: Prefer nondestructive actions; if one must be destructive, give enough context, and mark it so the system styles it distinctly.
- Actions: Add a simple recognizable interface icon (an SF Symbol or edited symbol) that appears after the action title.
- Badges: Use a badge only for the count of unread notifications, never for weather, dates, prices or scores.
- Badges: Do not depend on badging for essential information, since people can turn it off; make important items easy to find on opening.
- Badges: Update the count as soon as notifications are opened; setting it to zero clears related items from Notification Center.
- Badges: Do not build a custom element that imitates a badge.
- watchOS: Notifications appear first as a short look, then a long look, and also live in Notification Center; double tap responds on supported devices; supply Watch-specific assets and actions, or rely on defaults from a notification-capable iPhone companion.
- watchOS short look: It shows only while the wrist is raised, so never make it the only channel for important information and keep the title free of sensitive data.
- watchOS long look: Content scrolls with a swipe or the Digital Crown; the system fixes the structure (sash on top, Dismiss button at the bottom below custom buttons) while the content area can be static or dynamic.
- watchOS long look: Provide at least a static interface and preferably a dynamic one; the static one is the fallback offline, so package its resources with the app. Rich custom long looks can use SwiftUI animations, SpriteKit or SceneKit.
- watchOS long look: Pick the sash style (color or blurred; blurred suits a photo at the top) and a content background, which is transparent by default; white at 18% opacity matches system notifications. (HG-145)
- watchOS long look: Place no more than four custom actions under the content; the system picks which show by notification type, shares actionable types from the iPhone app, and always adds Dismiss last. (HG-146)
- watchOS double tap: It runs the first nondestructive action, so order actions with the most common first (a parking app might list extensions of 5 minutes, 15 minutes and an hour, with the usual choice on top). (HG-147)

## Snippets

Source: [Snippets](https://developer.apple.com/design/human-interface-guidelines/snippets). Applies to: iOS, iPadOS and macOS (not tvOS, visionOS or watchOS).

Describes compact result or confirmation views shown after an action run through Siri, Spotlight or Shortcuts. Use it when attaching a snippet to an App Intent.

- Choose the type: a confirmation snippet asks people to approve or back out and can expose options; a result snippet reports information needing no further action. An intent with a snippet always shows a result; the confirmation step is optional.
- Compose it from dialogue (spoken by Siri, placed above by default), a custom view (which may hold buttons to change content, get more information or act), and system buttons: Cancel plus a primary button for confirmation, or a single Done for results.
- Check contrast between custom content and the system background in light and dark appearances, and keep consistent inner margins.
- Keep content short; make the custom view no taller than 400 points so everything shows, remembering that text size follows the person's setting. (HG-148)
- For a result needing more detail, deep-link to the app rather than enlarging the view.
- Name the confirmation primary button for what it does (for example Order, not OK or Proceed) by choosing a `ConfirmationActionName` or a custom label; the default is Continue.
- Convey the purpose visually in the custom view and leave the spoken dialogue out of the visual layout, while keeping the dialogue essential for eyes-free use.

## Status bars

Source: [Status bars](https://developer.apple.com/design/human-interface-guidelines/status-bars). Applies to: iOS and iPadOS (not macOS, tvOS, visionOS or watchOS).

Covers the strip at the top of the screen showing time, carrier and battery. Use it when content scrolls behind it or when showing full-screen media.

- Do not leave content readable beneath a transparent status bar in a way that looks tappable; keep the bar legible and prefer a scroll edge effect that blurs content behind it (`ScrollEdgeEffectStyle`, `UIScrollEdgeEffect`).
- Hide the status bar temporarily for full-screen media, as Photos does.
- Do not hide it permanently; offer a simple, discoverable gesture to bring it back, such as a single tap in Photos.

## Top Shelf

Source: [Top Shelf](https://developer.apple.com/design/human-interface-guidelines/top-shelf). Applies to: tvOS only.

Covers the Apple TV Home Screen area that showcases an app's content when the app sits in the Dock. Use it when choosing a layout and sizing artwork.

- Lead people straight into content; the Carousel actions and Carousel details layouts give a primary playback button and a More Info button opening a detail view.
- Feature new or upcoming content and avoid promoting items already bought, rented or watched.
- Personalize with recommendations so people can resume playback or gameplay.
- Avoid ads and prices; purchasable items are acceptable, but show prices only once interest is shown.
- Prefer dynamic content, ideally layered images, over static art.
- Provide at least one static fallback image for when full-screen content is missing; tvOS mirrors and blurs it to fill a 16:9 area 1920 pixels wide. Use 2320x720 pt (4640x1440 px @2x). (HG-149)
- Do not imply a static image is interactive, since it cannot take focus.
- Carousel actions: Use it for full-screen video and images with light controls, suiting familiar content such as photos or new franchise items; include a short title and an optional subtitle (album date range, show name for an episode).
- Carousel details: Extends carousel actions with details such as plot summary and cast; provide a title for the playing content near the top, with an optional short phrase or attribution like "Featured on My App" above.
- Sectioned content row: Shows one labeled, focusable row; fill the full screen width with images at least, include at least one label, and expect label and motion effects on focus.
- Sectioned content row: Poster 2:3 actual size is 404x608 pt, focused/safe zone 380x570 pt, unfocused 333x570 pt. (HG-150)
- Sectioned content row: Square actual size is 608x608 pt, focused/safe zone 570x570 pt, unfocused 500x500 pt. (HG-151)
- Sectioned content row: 16:9 actual size is 908x512 pt, focused/safe zone 852x479 pt, unfocused 782x440 pt. (HG-152)
- Sectioned content row: Mixed image sizes scale up to the tallest image's height, so a 16:9 image sitting beside a poster or square grows to 500 pixels high. (HG-153)
- Scrolling inset banner: It auto-scrolls large nearly full-width images on a timer until one is focused, and loops; use three to eight images, since fewer feels weak and more is hard to navigate. (HG-154)
- Scrolling inset banner: Put any text inside the image (on a raised layer in layered images) and repeat it in the accessibility label for VoiceOver.
- Scrolling inset banner: Actual size is 1940x692 pt, focused/safe zone 1740x620 pt, unfocused 1740x560 pt. (HG-155)

## Watch faces

Source: [Watch faces](https://developer.apple.com/design/human-interface-guidelines/watch-faces). Applies to: watchOS only.

Covers shareable watch faces that feature an app's complications. Use it when configuring and promoting a face people can add with one step.

- Share faces that showcase the app's complications to aid discovery; offering several complications allows a curated face, and you may preset an accent color, images or styles. If the app is missing, the system prompts to install it.
- Show a preview that highlights the benefits; get one by emailing the face from the iOS Watch app (it includes an illustrated bezel for websites and apps), or swap in a high-fidelity bezel from Apple Design Resources.
- Aim to offer faces for all Apple Watch models: several faces (California, Chronograph Pro, Gradient, Infograph and its Modular variant, Meridian, Modular Compact, Solar Dial) need Series 4 or newer, and Explorer needs a cellular Series 3 or newer; also provide a similar configuration using a Series 3-compatible face, and label supported devices.
- Handle an incompatible face gracefully: the system reports an error on Series 3 or earlier, so respond by offering a compatible alternative instead of an error, and tell people in advance that they might get an alternative.
- Platform: Not supported outside watchOS.

## Widgets

Source: [Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets). Applies to: iOS, iPadOS, macOS, watchOS, visionOS and Apple HomeView (not tvOS).

Covers glanceable, interactive app content across Home Screen, Lock Screen, desktop, Smart Stack, Apple Vision Pro and HomeView. Use it for sizes, rendering modes, margins, text, color, previews and per-platform behavior.

- Choose which sizes to support: the system families from small up to extra large and extra large portrait, and the accessory families circular, corner, inline and rectangular; contexts differ (see source tables), and a custom design per context beats the default.
- Support the three looks: full-color (light and dark), accented (system removes the background and tints an accent group and a primary group, with Liquid Glass for clear), and vibrant (Lock Screen, StandBy at night; desaturates content).
- Pick simple ideas tied to the app's main purpose, with timely content and relevant actions or deep links; replicating the app icon adds little.
- Favor information that changes through the day so the widget stays on screen.
- Offer multiple sizes only when each adds value; do not stretch small content to fill a bigger size, and one well-fitted size beats all sizes.
- Balance density: not so sparse it seems pointless, nor so dense it loses glanceability; use a larger size or graphics instead of crowded text.
- Show only data tied to the widget's purpose, expanding detail with size.
- Use brand colors, typefaces and glyphs thoughtfully; if a logo helps (multiple sources), a small one in the top-right corner suffices.
- Decide between automatic content and user configuration (Stocks lets people pick symbols; Podcasts shows recent items automatically).
- Do not mirror the widget's look inside the app.
- Tell signed-out people that signing in adds value, for example "Sign in to view reservations".
- Updating: Widgets refresh periodically, not in real time, and the system can adjust limits. Match refresh to how often data changes (tide data hourly is fine) and show when data was last updated if people may check more often.
- Updating: Let the system refresh dates and times to save update opportunities, and show content promptly rather than masking out-of-date data with placeholders (`Keeping a widget up to date`).
- Updating: Animate data changes with standard or custom animations up to two seconds. (HG-156)
- Interactivity: Taps outside buttons and toggles launch the app; add simple buttons or toggles tied to the content (Reminders completes tasks).
- Interactivity: Deep link to the specific details the content refers to.
- Interactivity: Keep layouts uncluttered, make targets large enough to hit confidently, and remember an inline accessory widget has a single tap target.
- Margins: Supply content at suitable sizes and let the system scale it; iOS resizes large-device designs for small devices, and iPadOS renders at a large size then scales down. Use SwiftUI for flexibility, with Specifications as guidance.
- Margins: Use the standard 16 point margin for most widgets. (HG-157)
- Margins: Tighter 11 point margins work for grouped graphics, buttons or background shapes; widgets use smaller margins on the Mac desktop and the Lock Screen, including StandBy. (HG-158)
- Margins: Match content corners to the widget with `ContainerRelativeShape`.
- Text: Prefer system typography: the system font, its text styles, and SF Symbols; use a custom font sparingly, often for large text with SF Pro for small.
- Text: Avoid font sizes under 11 points. (HG-159)
- Text: Never rasterize text, so it scales and VoiceOver can speak it.
- Text: On iOS, iPadOS and visionOS, system and custom fonts scale with Dynamic Type from Large through AX5. (HG-160)
- Color: Use color to enhance rather than compete; set edit-mode colors in the asset catalog.
- Color: Do not carry meaning by color alone; add text and icons, since widgets may be monochrome or inverted on watchOS.
- Color: Use full-color images judiciously; tinted and clear appearances desaturate them by default, and forcing full color can look out of place. Reserve it for media such as album art and keep such images smaller than the widget.
- Full-color mode: Support light and dark; light backgrounds for light and dark for dark, preferably with semantic system colors or asset catalog variants.
- Accented mode: Divide the view hierarchy into accent and primary groups (`widgetAccentable(_:)`); on iPhone, iPad and Mac both are tinted white, and on Apple Watch primary is white and accented takes the watch face color.
- Vibrant mode: Image pixel opacity sets the blur strength and brightness sets vibrancy; use full-opacity white or light gray for primary content, darker grays for secondary, check contrast in grayscale, and use opaque grays rather than white opacities.
- Previews: Make a realistic gallery preview, using simulated data if real data is slow to load.
- Previews: Design placeholders from static components plus semi-opaque shapes (rectangles of varied width for text, circles or squares for glyphs and images).
- Previews: Write a short description starting with an action verb in sentence case; skip phrases like "This widget shows" or "Add this widget".
- Previews: Group all sizes under one widget with a single description, and consider tinting the Add button with the brand color.
- iOS, iPadOS: Lock Screen widgets follow complication principles; give them useful information and not just a launch path, and design the two together. Offer them as inline text above the clock, or circular and rectangular shapes below it.
- iOS, iPadOS: Support the Always-On display, which renders Lock Screen widgets with reduced luminance; use gray levels with enough contrast.
- iOS, iPadOS: Use Live Activities, not widgets, for real-time progress, and build both with shared code and design (`ActivityKit`).
- StandBy and CarPlay: StandBy shows two small widgets scaled up; supporting it covers CarPlay, which uses the small family without a background. Prefer large, rearranged text over rich images or color, and mark the background removable.
- StandBy: In low light the widget turns monochrome red.
- Apple HomeView: Widgets are small system family and look like iPhone widgets; the Modular face holds up to four, one shared face per household, while each member has a personal Home Screen. (HG-161)
- visionOS: Widgets are persistent 3D objects at real-world scale on horizontal or vertical surfaces; design for living spaces, test across all tint palettes and lighting, and check untinted elements stay legible.
- visionOS: Support two distance thresholds: simplified (fewer details, larger type, no buttons or toggles) when far, and default (more detail, smaller type) when near, keeping shared elements across both.
- visionOS: Pick family sizes for the placement (small for a desk, extra large for art) and ensure legibility; people can scale a widget between 75 and 125 percent, so use high-resolution assets. (HG-162)
- visionOS: Choose a mounting style: elevated (default, works on any surface) for standout content, or recessed (vertical surfaces only) for ambient content; declare with `supportedMountingStyles(_:)` and use separate configurations for mixed support. Test every system frame width.
- visionOS: Choose a treatment: paper for a print-like look responding to ambient light, or glass for information-rich layouts where foreground stays bright and legible.
- watchOS: Use a meaningful colored background instead of the default black (Stocks uses red and green), and supply relevancy data so the Smart Stack elevates the widget (`RelevanceKit`).
- Specifications (iOS): On a 430x932 pt screen small is 170x170 pt, medium 364x170 pt, large 364x382 pt, circular 76x76 pt, rectangular 172x76 pt, inline 257x26 pt; other devices are in the source. (HG-163)
- Specifications (iPadOS): Sizes are given as canvas and device values; for a 768x1024 screen the canvas small is 141x141 pt and device small is 120x120 pt. See source for others. (HG-164)
- Specifications (visionOS and watchOS): visionOS small is 158x158 pt up to extra large 450x338 pt; Smart Stack widgets run from 152x69.5 pt (40mm) to 198x81.5 pt (49mm Ultra 3, 4). (HG-165)
