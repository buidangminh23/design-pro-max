# Patterns

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Charting data
- Collaboration and sharing
- Drag and drop
- Entering data
- Feedback
- File management
- Going full screen
- Launching
- Live-viewing apps
- Loading
- Managing accounts
- Managing notifications
- Modality
- Multitasking
- Offering help
- Onboarding
- Playing audio
- Playing haptics
- Playing video
- Printing
- Ratings and reviews
- Searching
- Settings
- Undo and redo
- Workouts

## Charting data

Source: [Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data). Applies to: all platforms.

Governs when a chart is the right way to show a dataset and how to design one that is simple, understandable and consistent. Use it before adding any chart to an app.

- Use a chart only when you want to point out something specific about the data, such as a trend, a current state or a comparison across categories.
- When people only need the raw values, offer a list or table they can scroll, search and sort instead of a chart.
- State clearly what the viewer should learn from the chart, because charts draw attention.
- Keep each chart simple. Do not cram in every data point; let people reveal more detail, other subsets or other levels of detail on request.
- For interactive charts, consider offering several versions, each with more functionality than the previous, so people can learn the interactions step by step.
- Make every chart accessible: give accessibility labels that describe the values and the chart parts, and expose accessibility elements so people can explore the chart with assistive technology.
- Prefer familiar chart types such as bar and line charts so people already know how to read them.
- If you use an unusual chart type, teach people how to read it, for example by animating its parts one at a time to show what each represents.
- Review the data at several levels: overall summaries such as totals and averages, useful subsets, and individual values worth highlighting. Surface the ones that help.
- Add descriptive text (title, subtitle, annotations, a short headline summary) to stress the key message and any action to take. Text like this helps but never replaces accessibility labels.
- Size each chart to its purpose: large enough for readable labels, annotations and the interaction you offer, or small for a glanceable snapshot or preview of a larger chart elsewhere.
- Keep charts that serve a similar purpose consistent in type and style, and differ only to signal a meaningful difference.
- When several charts show the same dataset from different angles, keep one chart type and the same colors, annotations, layout and descriptive text, so the link between them is obvious. Make a compact chart and its expanded version look alike.

## Collaboration and sharing

Source: [Collaboration and sharing](https://developer.apple.com/design/human-interface-guidelines/collaboration-and-sharing). Applies to: all platforms except tvOS.

Covers starting a share or collaboration from the system share sheet and showing collaboration state in your app. Use it for any feature where people share content or work on it together.

- Put the Share button where it is easy to reach, such as a toolbar. In SwiftUI, present the system share sheet with `ShareLink`.
- Tailor the share sheet or popover so it lists only the sharing types your app handles.
- To allow "send copy", pass the file together with your collaboration object when using CloudKit; iCloud Drive supports it by default; for a custom setup, include the file or a plain-text form of it in the collaboration object.
- Write short permission summaries that describe the sharing state, such as "Only invited people can edit". The system shows the summary on a button that opens the sharing options.
- Keep custom sharing options few and grouped so they read at a glance: who can access, whether they can edit or only read, and whether collaborators can add others.
- Show the Collaboration button as soon as a collaboration begins, ideally next to the Share button, so people see the content is shared and with whom.
- Fill the collaboration popover sparingly. It has three parts: collaborators with buttons to open Messages or FaceTime at the top, your custom items in the middle, and a management button at the bottom. Offer only the few items people need while working together, such as a summary of recent updates.
- Rename the management button ("Manage Shared File" by default) when a more fitting title exists. With CloudKit sharing the system supplies the management view; otherwise build your own.
- Consider posting collaboration events (content change, membership change, a mention) to Messages, each with a universal link that opens the relevant view in your app (`SWHighlightEvent`).
- Support universal links if you use a custom collaboration back end, so system sharing features work with it.
- visionOS: Windows shared from the Shared Space stream to collaborators by default. If the sharer moves the app into a Full Space, others see a paused stream until the app comes back to the Shared Space.
- watchOS: Use `ShareLink` in SwiftUI to show the system share sheet.

## Drag and drop

Source: [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop). Applies to: iOS, iPadOS, macOS, visionOS; not supported on tvOS or watchOS.

Covers moving or copying selected content from a source to a destination, within a container, across containers or across apps. Use it when adding drag support, accepting drops or designing drag feedback.

- Support drag and drop wherever it is plausible; system text fields and text views already do.
- Provide another way to do the same job, such as menu commands for copy and move. On iOS and iPadOS, describe sources and destinations to assistive technologies with `accessibilityDragSourceDescriptors` and `accessibilityDropPointDescriptors`.
- Default to a move when source and destination are the same container and a copy when they differ. Dragging between apps always copies. Change defaults only if the alternative is less likely to frustrate people or lose data.
- Support dragging several items as a group where it fits. On iPadOS, people can add items to a drag already in progress.
- Prefer making a drop undoable. If it cannot be undone, consider a confirmation before completing it, or another way to reverse it afterward.
- Offer several representations of dragged content, from highest to lowest fidelity (for example vector PDF, then lossless PNG, then JPEG; or a native object, then a plain image), so the destination takes the best one it can handle.
- Consider spring loading: dragging content over a button or segmented control activates it. On a Mac with a Magic Trackpad, force-click does it; on iPad, hovering does it.
- Show the drag image once the drag has moved about three points, and keep it until the drop. (HG-84)
- Make the drag image translucent so people can tell it from the original and see destinations beneath it.
- Adjust the drag image only when it helps people predict the result, for example previewing the default size in a document. Use flocking to group multiple items and ungroup them on drop. Avoid constant, dramatic changes.
- Indicate whether a destination accepts the content: show an insertion point or highlight only for valid destinations, and show nothing or a "not allowed" image such as the `circle.slash` symbol otherwise. Highlight only while the drag is over the target, and one target at a time.
- On a failed or invalid drop, give visual feedback, such as the item returning to its source or scaling up and fading out.
- Auto-scroll a scrolling destination while the item is dragged over it, and stop when the drag leaves the container.
- When a destination has a choice, accept the richest version of the content it supports.
- Extract only the part of dropped content that is relevant, such as just the name and email from a contact dropped into a recipient field.
- With a hardware keyboard, read the Option key state when the drop happens: holding it forces a copy within the same container; releasing it before the drop results in a move.
- Show progress or a placeholder at the drop location when a transfer takes time, and show that a task has started and how it is going when a drop triggers one, such as printing.
- Keep the original text styling if source and destination support the same styles; otherwise adopt the destination style.
- Keep dropped content selected in the destination. Within one container, a move removes the content from its old spot; a copy removes the selection from the original. Across containers, deselect the content in the source.
- iOS, iPadOS: Let people gather more items into an active drag and accept several simultaneous drops, with flocking as visual feedback.
- macOS: Consider letting people drag content to the Finder in a format your app can reopen later (for example an `.ics` file for a calendar event), or as a clipping for text. A clipping is unrelated to the Clipboard.
- macOS: Let people drag a background selection from an inactive window without activating it, and drag an unselected item from an inactive window without disturbing that window's selection.
- macOS: Consider a count badge on multi-item drags, updated if the destination accepts only some items.
- macOS: Consider changing the pointer (copy, drag link, disappearing item, not allowed) to show what the drop will do.
- macOS: Let people select and drag in one continuous motion instead of pausing between the two.
- visionOS: Where possible, launch your app to handle content dropped into empty space, by associating an `NSUserActivity` with the draggable content.

## Entering data

Source: [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data). Applies to: all platforms.

Covers asking people for information with as little effort and as few mistakes as possible. Use it when designing forms and text fields.

- Collect information from the system or with permission (settings, location, calendar) rather than asking people to type it.
- Support every available input method so people can choose the one that suits them.
- Say plainly what you need: use a placeholder that shows the expected format, such as a sample address, or a short label such as "Email", and prefill sensible defaults to speed things up.
- Use a secure field (`SecureField`) for sensitive input, so entered characters show as filled dots. In tvOS, a digit entry view can hide digits (`isSecureDigitEntry`). The system text field in visionOS shows data only to the wearer and blurs it when mirrored.
- Never prefill a password field. Ask for the password or use biometric or keychain authentication.
- Offer choices (picker, menu, other selection control) instead of free text whenever it makes sense.
- Accept drag and drop and paste for data entry.
- Validate as people type and flag problems immediately, instead of after a long form. For numbers, use a number formatter to accept only numeric input and to show decimals, percentages or currency.
- Make required fields obvious, and enable Next or Continue only once the required data is present.
- macOS: Consider an expansion tooltip that reveals the full text of a truncated or clipped field when the pointer rests on it.

## Feedback

Source: [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback). Applies to: all platforms.

Covers telling people what is happening, what happened and what to do next. Use it to decide how loudly to deliver each kind of message.

- Match the delivery to the importance: show status passively where people can look when they want it, and interrupt only for warnings about problems such as data loss.
- Deliver feedback through several channels (color, text, sound, haptics) so it reaches people whether the device is silenced, they look away, or they use VoiceOver.
- Place status feedback near the thing it describes, inside the interface, so people need not leave their context. A mailbox toolbar showing last update time and unread count is the model.
- Use alerts only for critical information, ideally with an action. They interrupt, so overuse or trivial content weakens them.
- Warn before a task that causes unexpected, irreversible data loss. Do not warn when loss is the expected outcome, such as deleting a file.
- Confirm completion of significant tasks (such as a payment) but not routine ones, since people expect success and mainly need to hear about failure.
- When a command cannot run, say so and explain why, for example that directions need different start and end points.
- watchOS: Avoid indeterminate progress indicators, which suggest people must keep watching. Reassure people that a notification arrives when the work finishes.

## File management

Source: [File management](https://developer.apple.com/design/human-interface-guidelines/file-management). Applies to: iOS, iPadOS, macOS (visionOS has the Files app; watchOS and tvOS have no document browsing).

Covers creating, opening and saving documents, previews, and the system extensions for file browsing and sync. Use it for document-based apps and apps that handle user files.

- Offer New and Open as menu commands with keyboard shortcuts. On iPadOS they show in the shortcuts overlay held with Command; on macOS they live in the File menu. Also include an Add (+) button for new documents.
- If you need a custom file browser, keep the platform's familiar file layout. Open at the most relevant spot (Documents, iCloud, last used location) but let people reach the rest of the file system.
- Make people confident their work is saved. Avoid requiring an explicit save; save periodically while editing, on closing a file, and when switching apps.
- Hide file extensions by default, let people show them, and honor that choice in every save and open interface.
- Use Quick Look to preview files inside your app, including files your app cannot open, so people need not leave.
- If your app writes its own file types, consider a Quick Look generator so Finder, Files and Spotlight can show previews.
- iOS 18, iPadOS 18: A document-based app can adopt the system document launcher (`DocumentGroupLaunchScene`). It has a title card with two app-specific buttons, a background image with optional accessory images around the card, and a sheet holding the file browser and optional controls.
- iOS, iPadOS: Give the title card's buttons the app's most important actions. The primary button usually creates a document; the secondary offers more options, such as choosing a template.
- iOS, iPadOS: Make the launcher background (solid color, gradient or pattern) stand apart from the accessories and the title card, and skip busy images.
- iOS, iPadOS: Place accessories carefully. Layering them above and below the card adds depth, but the app name and both buttons must stay visible. Avoid clutter and test all supported screen sizes and orientations.
- iOS, iPadOS: Animate launcher accessories sparingly with gentle repeating motion such as a slow sway or breathing.
- iOS, iPadOS: With a file provider extension, list only documents suited to the current context (for example only PDFs for a PDF editor) and consider showing modified date, size and local or remote status.
- iOS, iPadOS: In a file provider extension, let people pick a destination when exporting or moving, navigating your folder hierarchy and creating subfolders unless you use a single directory.
- iOS, iPadOS: Do not add your own top toolbar to a file provider extension; it loads in a modal view that already has one.
- macOS: Use the default file browser unless there is a strong reason for a custom one.
- macOS: Make a custom open interface convenient with an "open recent" action, filtering criteria and multi-select. Retitle the Open button to match the task, for example Insert.
- macOS: Provide a save interface for name, format and location. New documents are titled "Untitled" until named. Start at a sensible location and let people choose a file format if you support several.
- macOS: Consider an accessory view in the Save dialog for useful options, such as including attachments when saving a mail message.
- macOS: For apps that sync files, consider a Finder Sync extension to show sync badges, add contextual menu items (favorite, password-protect) and toolbar buttons for global actions such as starting a sync.
- macOS: If people turn off autosaving ("Ask to keep changes when closing documents"), show unsaved state and present a save dialog on close, quit, log out and restart.
- macOS: With autosaving off, show unsaved changes with a dot on the window's close button and beside the document name in the Window menu. Do not show the dot when autosaving is on, because it wrongly implies action is needed. You may append "Edited" to the title either way, but remove it once the work is saved.

## Going full screen

Source: [Going full screen](https://developer.apple.com/design/human-interface-guidelines/going-full-screen). Applies to: iOS, iPadOS, macOS; not supported on tvOS, visionOS or watchOS.

Covers letting a window fill the screen for focus and immersion. Use it for media, games and long tasks.

- Offer full screen when focus helps, such as games, video or photo slideshows, and deep tasks.
- Adjust the layout for the extra space subtly, keeping the same items and a consistent interface, but never resize the window yourself. Avoid jarring changes between modes.
- Keep essential controls available or easy to reveal so people can finish tasks without leaving full screen, for example playback controls for media.
- On iPadOS and macOS, outside games, people must still be able to bring up the Dock in full screen. To avoid accidents in a game, ask iPadOS to ignore the first bottom-edge swipe (`preferredScreenEdgesDeferringSystemGestures`) or hide the Dock on macOS (`hideDock`).
- When people leave and return, resume where they left off, and pause games or slideshows automatically while away.
- Let people decide when to exit. Do not end full screen automatically after they switch tasks or finish a movie or game.
- Hide toolbars and navigation when content is the focus (photos, reading), and restore them with a familiar action: tap, swipe down, or push the cursor to the top edge. Keep controls visible when needed for navigation or tasks.
- iOS, iPadOS: Consider deferring system gestures so people do not leave a full-screen app or game by accident. The Home indicator normally hides and returns when people touch the bottom area for a single-swipe exit; keep that where you can, and require two swipes only if accidental exits happen.
- macOS: Use the system full-screen support (`toggleFullScreen(_:)`), which also handles the camera housing on some Macs.
- macOS: In a game, do not change the display mode when entering full screen.
- macOS: Entering full screen should always be the person's choice, via the window button, the View menu or Control-Command-F. Do not make a custom window-mode menu; a game may add its own toggle.

## Launching

Source: [Launching](https://developer.apple.com/design/human-interface-guidelines/launching). Applies to: all platforms.

Covers the time from opening an app until the first screen is ready, including launch screens and state restoration.

- Launch instantly; people expect to start using the app within a couple of seconds at most.
- Provide a launch screen where the platform requires one (iOS, iPadOS, tvOS). macOS, visionOS and watchOS do not need it.
- If you want a splash screen, show it at the start of onboarding, or right after launch finishes when there is no onboarding.
- Restore the previous state on relaunch, including scroll position and window arrangement, so people do not retrace their steps.
- Keep the launch screen understated. Its only job is to make the app feel fast and ready; it is not onboarding, a splash screen or an art piece.
- Make the launch screen almost the same as the first screen to avoid a flash. If the first screen is a solid color, use only that color. Match the current device orientation and appearance mode.
- Leave text off the launch screen, because it cannot be localized.
- Do not advertise on the launch screen: no logos or branding unless they are a fixed part of the first screen, and nothing resembling a splash or About window.
- iOS, iPadOS: Launch in the device's current orientation when both are supported; if only one orientation is supported, launch in it. A landscape-only interface must work after rotating either left or right.
- tvOS: The launch screen is static, unlike the layered images used elsewhere.
- tvOS: In a live-viewing app, consider starting playback automatically after a few seconds of inactivity.
- visionOS: Consider opening in the Shared Space even for a fully immersive app, to give context and loading time and a control people use to enter the Full Space.

## Live-viewing apps

Source: [Live-viewing apps](https://developer.apple.com/design/human-interface-guidelines/live-viewing-apps). Applies to: all platforms (guidance is mostly for TV-style apps).

Covers apps that play live content, their program guide and cloud recording. Use it for live TV and sports streaming.

- Put live content first, so people reach playback in one tap at most when live is the first tab.
- Let people start playback with a single tap or none, for example a Watch Now button over featured or recently viewed live content that disappears and begins full-screen playback.
- Make live content look live. Mark it, for example a "Live" row with a badge, symbol or sash on each item, and distinguish it from video on demand at a glance.
- Consider showing the progress of in-progress live content, such as a progress bar, so people know where they will join.
- Keep playback the primary action and offer extras such as record, restart, download and favorite. Show actions in the same order everywhere (for example Watch, Start Over, Record, Favorite) and show other airtimes so people can schedule.
- Consider a footer strip for browsing channels while video plays. Give it a subtle darkening so text stays legible and items stay distinct.
- In a content footer, mark the thumbnail for the current content (a badge or a tinted progress bar), use the same categories as the program guide, and make invoking and dismissing it predictable, for example swipe up to open and swipe down to close.
- Give instant visual feedback when the channel changes, to confirm the new channel and buy loading time.
- Match audio to context: keep live audio playing when people browse while it runs, and stop it when they leave the live area of the app.
- Program guide: Show the current program, channel and time prominently on opening and make returning to playback easy.
- Program guide: Make browsing effortless with paging, scrolling or jumping, and consider My Channels or Favorites groups.
- Program guide: Group content into familiar categories such as Movies, TV Shows, Kids, Sports and Popular, matching those in any content footer.
- Program guide: Let people browse while the current content keeps playing, for instance in picture-in-picture or in the background.
- Cloud DVR: Put start and stop recording in the info panel that people open during live playback.
- Cloud DVR: Offer recording of a future program from a details view, with a choice of just that program or all future episodes.
- Cloud DVR: Let people specify what to record, such as the current episode only, new episodes only, or games involving certain teams.
- Cloud DVR: Allow playing, deleting and adjusting recording settings from a recorded item's details view.
- Cloud DVR: Consider a control for DVR settings, like deleting watched or old recordings, and ideally automatic storage management that overwrites the oldest or already watched content.

## Loading

Source: [Loading](https://developer.apple.com/design/human-interface-guidelines/loading). Applies to: all platforms.

Covers how to keep waiting for assets or content from disrupting the experience. Use it for any screen, level or feed that loads.

- Show something right away, such as placeholder text, graphics or animation that is replaced as real content arrives. A blank screen reads as a malfunction.
- Load in the background so people can do other things meanwhile, for example a game that loads the next level while the player reads a menu.
- When a long wait cannot be avoided, give people something worth viewing, such as gameplay hints, tips or new-feature introductions. Estimate the remaining time well so the placeholder content is neither cut short nor repeated.
- Download large assets in the background (Background Assets framework) right after install, during updates or at other quiet times, to speed up installation and launch.
- Show that loading is happening and, when possible, how long it will take, using progress indicators. Use a determinate indicator when the duration is known and an indeterminate one when it is not.
- Games: Consider a custom loading view with animations and elements that match the game's style, since standard indicators can feel out of place.
- watchOS: Avoid loading indicators as far as possible and show content immediately. When content needs about a second or two, a loading indicator is better than a blank screen. (HG-85)

## Managing accounts

Source: [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts). Applies to: all platforms.

Covers when to require an account, how to sign in, and how to let people delete accounts. Use it for sign-in, sign-up and account settings.

- Require an account only when core functionality needs it. If you do, consider Sign in with Apple for a trusted, consistent sign-in.
- Explain on the sign-in screen, briefly and in a friendly tone, why an account is needed and what it offers.
- Delay sign-in as long as possible, so people can see what the app does first. A shopping app can wait until checkout.
- Without Sign in with Apple, prefer passkeys on iOS, iPadOS, macOS and visionOS, so people only supply a user name. If you keep passwords, add two-factor authentication.
- Name the authentication method on its control, such as "Sign In with Face ID" rather than a bare "Sign In".
- Mention only methods available on the current device and check capabilities (`LABiometryType`), so you never reference Face ID on a device without it.
- Avoid an in-app opt-in setting for biometric authentication; people enable it at the system level.
- Avoid the word "passcode" for account authentication, since it suggests reusing the device passcode.
- If people can create an account in the app, let them delete it (not only deactivate it) and follow your region's legal rules for deletion and the right to be forgotten. If you must retain data or follow a set process, explain this clearly.
- Provide a clear in-app way to start deletion, or a direct, easy-to-find link to the web page that does it. Do not bury it in the Privacy Policy or Terms.
- If accounts were created with Sign in with Apple, revoke the associated tokens when the account is deleted.
- Keep deletion equally simple in the app and on the website.
- Consider letting people schedule deletion for later, such as after a subscription renews, and always offer immediate deletion too.
- Tell people when deletion will finish and notify them when it has.
- With in-app purchases, explain billing and cancellation after deletion: an auto-renewable subscription keeps billing through Apple until cancelled, and people must cancel it or request a refund themselves. Say how to cancel and manage purchases. Account deletion support is required even if the subscription was bought elsewhere.
- TV provider apps: If sign-in is required, use TV Provider Authentication. Hide sign-out when the viewer is signed in system-wide; if you must offer it, send them to Settings > TV Provider. Never tell people to sign out through privacy controls.
- tvOS: Ask for the least information possible, because people use a remote.
- tvOS: Prefer letting people sign up or authenticate on another device, using associated domains so Apple TV can suggest credentials, including Sign in with Apple.
- tvOS: For shared accounts, avoid asking for a profile every time the user changes. In tvOS 16 and later, share credentials while storing each person's profile and data separately (`kSecUseUserIndependentKeychain`).
- tvOS: Minimize data entry by sending larger forms to a website on another device. For email, show the email keyboard screen with recently used addresses.
- watchOS: Use iCloud synchronization of the Keychain so people can autofill user names and passwords and keep app settings.

## Managing notifications

Source: [Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications). Applies to: all platforms.

Covers permission, Focus integration, interruption levels and marketing messages for notifications.

- Get permission before sending any notification. People can change that choice later in settings and silence everything.
- Let the system's Focus and delivery scheduling work: people filter alerts during activities and may receive summaries at chosen times. A delayed alert is still available in the notification list the moment it arrives.
- Classify your notifications. Use communication notifications (adopting SiriKit intents such as `INSendMessageIntent`) for calls and messages, where the sender decides delivery; use noncommunication notifications for everything else and give each a system interruption level.
- Pick the right interruption level. Passive is for info people read at leisure; Active (default) is for updates worth knowing on arrival; Time Sensitive is for things needing immediate attention, such as security issues or package delivery; Critical is for urgent health and safety matters, extremely rare.
- Know the level behaviors: Passive and Active do not override scheduled delivery, Focus or the Ring/Silent switch. Time Sensitive overrides scheduled delivery and Focus but not the switch. Critical overrides all three and requires a special entitlement.
- Represent urgency honestly. Do not inflate the level for low-priority content, because people can turn notifications off entirely.
- Use Time Sensitive only for events happening now or within an hour: within an hour (HG-86) The system explains the level on the first such notification and lets people turn it off, then re-prompts periodically (`UNNotificationInterruptionLevel`).
- Send marketing or promotional notifications only with explicit permission, requested through an alert, modal view or similar interface that describes the content and offers a clear opt-in or opt-out.
- Never send marketing at the Time Sensitive level, even with permission.
- Provide in-app notification settings so people can change their choice, including for informational and marketing types.
- watchOS: iPhone notification settings apply to the watch by default and can be managed in the Apple Watch app on iPhone. People can also swipe left on a notification for per-notification options, such as muting or turning off Time Sensitive.

## Modality

Source: [Modality](https://developer.apple.com/design/human-interface-guidelines/modality). Applies to: all platforms.

Covers presenting content in a separate mode that blocks the parent view until dismissed (alerts, sheets, popovers, full-screen modals). Use it when deciding whether and how to interrupt.

- Use a modal presentation only when it clearly helps: delivering critical information, confirming or changing the latest action, a narrow separate task, or focus on a complex or immersive one.
- Choose the component by platform: alerts on every platform, plus activity views, sheets, confirmation dialogs or action sheets. iOS, iPadOS and macOS tend to use sheets or popovers for distinct tasks; iPadOS, macOS and visionOS may use a separate window.
- Keep modal tasks simple, short and streamlined so people do not lose track of the suspended task.
- Do not let a modal task turn into an app within the app. If it needs subviews, provide one path through them and avoid buttons that could be mistaken for the dismiss button.
- A full-screen modal suits deep content such as video, photos and camera views, or multistep tasks such as markup or photo editing. In visionOS Shared Space it fills a window and can become more immersive in a Full Space.
- Always give an obvious way to dismiss. iOS, iPadOS and watchOS people expect a button in the top toolbar or a swipe down; macOS and tvOS people expect a button in the main content.
- Before closing a modal view that would lose user-created content, explain it and offer ways to resolve it, for example an action sheet with a save option, whether people use a gesture or a button.
- Give the modal view a title, or descriptive text, that names its task so people keep their place.
- Allow dismissing one modal view before presenting another. Avoid stacking several; an alert may appear above other modals, but never show more than one alert at once.
## Multitasking

Source: [Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking). Applies to: iOS, iPadOS, macOS, tvOS, visionOS; not supported on watchOS.

Covers behaving well when people switch between apps or run apps side by side. Almost every app must support it, apart from rare cases such as some games and visionOS apps in a Full Space.

- Always be ready to save and restore context, because you cannot know when multitasking starts.
- Pause activities that need attention or participation when people switch away (games, media), and let them resume as if they never left.
- Handle audio interruptions: pause indefinitely for primary audio such as music, podcasts or audiobooks, and lower the volume or pause briefly for short interruptions such as GPS prompts, then restore volume or playback afterward.
- Finish user-started tasks, such as downloads or video processing, in the background before suspending when they need no more input.
- Use notifications sparingly: notify on completion of important or time-sensitive tasks, not routine or secondary ones.
- iPadOS: Adapt gracefully to any window size, because apps are not told which multitasking configuration people chose and can be windowed, resized, tiled or full screen, with several windows per app.
- iPadOS: Expect videos and FaceTime calls to float over other content as Picture in Picture, whether apps are full screen or windowed.
- macOS: Running several apps at once is the normal case, and the system itself draws layered windows with shadows and state effects that tell windows apart.
- visionOS: Do not change the appearance of a window's edges, since the system masks a window people look away from. Closing a window sends the app to the background but leaves it running.
- visionOS: Do not pause a window's video when people look away from it; playback should continue while they use another window.
- visionOS: Expect audio to duck when people look at another app, unless yours is the Now Playing app. Closing the Now Playing window pauses playback.
- iOS, tvOS: Picture in Picture lets people watch video while using other apps or browsing.

## Offering help

Source: [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help). Applies to: all platforms; tooltips apply to macOS and visionOS.

Covers contextual help: inline guidance, tutorials, TipKit tips and tooltips. Use it when a feature needs explaining.

- Match help to the task: an inline view for one- or two-step tasks, a tutorial for complex multistep ones. Tie help to what the person is doing now and make it easy to skip or dismiss.
- Keep language and images consistent with the current context and platform, for example no game-controller imagery for Siri Remote users and no "click" on iPhone or "tap" on Mac.
- Make help inclusive.
- Do not explain standard components. Describe what a control does in your app. If a control or input style is unusual, like turning the Siri Remote 90 degrees, orient people with animation or graphics rather than long text. (HG-87)
- A tip is a small transient view (`TipKit`). Use a popover tip to keep content flow, or an inline tip to keep surrounding content visible. Inline tips come as annotation style, pointing at a UI element, or hint style, when not tied to a specific element.
- Use tips for simple features. A feature needing more than three actions is probably too complex for a tip. (HG-88)
- Write tips short, action-oriented and engaging, one or two sentences, with no promotional text or content about another flow.
- Set eligibility rules (parameter-based or event-based) so tips appear only to people who could benefit, such as not for features already used, and set a reasonable frequency, for example once every 24 hours. (HG-89)
- Include a familiar image or symbol for the feature when one exists, preferring the filled variant. Do not repeat in the tip an image that the tip points at directly in the UI.
- Add buttons in tips that lead to settings or further information such as a setup flow.
- macOS, visionOS: Tooltips (help tags) appear on pointer hover, or on gaze in visionOS (`help(_:)`). Describe only the control the person is asking about, not nearby controls or bigger tasks.
- macOS, visionOS: Start tooltip text with a verb that explains the action, such as "Restore default settings", and avoid repeating the control's name.
- macOS, visionOS: Keep tooltips to about 60 to 75 characters at most, remembering that localization changes length. Use sentence fragments without articles; use sentence case; omit final punctuation on full sentences unless your style needs it. (HG-90)
- macOS, visionOS: Consider context-sensitive tooltips that change with the control's state.

## Onboarding

Source: [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding). Applies to: all platforms.

Covers first-run teaching after launch finishes. Ideally the app is understandable by use; if onboarding is needed, make it fast, fun and optional.

- Teach through interaction: let people safely try an action, find a feature or test a mechanic instead of only reading.
- Prefer context-specific tips (`TipKit`) near the relevant interface area over one big onboarding flow.
- If a prerequisite flow is needed, keep it brief and enjoyable and avoid asking people to memorize much.
- Make a separate tutorial optional. If skipped, do not show it again on later launches, but keep it findable in help, account or settings.
- Focus on your own experience; do not teach how to use the device or system.
- If a splash screen is needed, show it just long enough to absorb at a glance.
- Bundle enough media and content so large downloads do not block onboarding or first use.
- Leave licensing and agreements to the App Store; if they must appear in onboarding, integrate them without disruption.
- Postpone nonessential setup and customization, and ship good defaults so people can start at once.
- Ask for access to private data during onboarding only when the app cannot work without it, explaining why and the benefit; otherwise ask when the person first uses the feature that needs it.
- Let people experience the app before asking for ratings or purchases.


## Playing audio

Source: [Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio). Applies to: all platforms.

Covers how app sound should respond to silent mode, volume, output routing, audio categories and interruptions. Use it for any app that plays or records sound.

- Silent mode: when a device is silenced, play only audio people explicitly start (media playback, alarms, audio or video messages) and mute nonessential sounds such as keyboard clicks, effects and game soundtracks.
- Volume: the system volume governs all sound, including in-app effects, whichever way people change it. The iPhone ringer volume is the one separate setting.
- Headphones: reroute sound automatically and without interruption on connect; pause playback immediately on disconnect.
- Adjust relative levels inside your app for a good mix, but never change the overall system volume.
- Let people send audio to other outputs (stereo, car radio, Apple TV) unless something strongly argues against it.
- Use the system volume view (`MPVolumeView`) for the level slider and output route control; its look can be customized.
- Choose an audio category (`AVAudioSession.Category`) that fits your use, so you do not stop other apps' music needlessly.
- Solo ambient: nonessential sound that silences other audio, like a game soundtrack. It follows the silence switch, does not mix, and does not play in the background.
- Ambient: nonessential sound that lets other audio continue. It obeys the silence switch, mixes, and stops in the background.
- Playback: essential sound, such as audiobooks or language lessons. It ignores the silence switch, can play in the background, and mixing is optional.
- Record: recorded sound, such as a note recorder. It ignores the silence switch, does not mix, and can record in the background. Switch to playback if the app also plays notes back.
- Play and record: simultaneous recording and playing, such as calls or audio messaging. It ignores the silence switch, can record and play in the background, and mixing is optional.
- Respond to external audio controls (Control Center, headphones) only when you are playing, in a clear audio context, or connected to a Bluetooth or AirPlay device. Otherwise do not halt another app's audio.
- Do not redefine what audio controls mean, and ignore controls you do not support.
- Build custom player controls only for commands the system lacks, such as custom skip intervals or related content like a sports score.
- When you finish temporary audio that interrupted others, signal it (`notifyOthersOnDeactivation`) so they can resume.
- Decide how to respond to audio-session interruptions. You may stop the system interrupting important recording for a call unless people accept it. A VoIP app must end a call when the iPad Smart Folio closes, and must not restart the session on reopen, which would unmute the microphone without people knowing.
- When an interruption ends, decide whether to resume: a media app should check that the interruption is resumable (`shouldResume`) first, while a game, which plays without explicit user choice, can resume without checking.
- iOS, iPadOS: Use system sound services (Audio Services) for short sounds and vibrations.
- macOS: By default, notification sounds blend with other playing audio.
- tvOS: Sound is played only on the person's action or during calibration, so do not add sounds to alerts or notifications.
- visionOS: Never convey important information with sound alone; provide other cues.
- visionOS: Prefer playing sound. An app with no sound, especially in immersive moments, can feel lifeless or broken.
- visionOS: Design custom sounds for custom UI elements, giving feedback and a sense of space like system elements do.
- visionOS: Use Spatial Audio, combining ambient audio that anchors people in a virtual world with sources that seem to come from specific objects.
- visionOS: Consider defining the places sounds can come from. A sound should follow its window or object when moved.
- visionOS: Vary sounds that could feel repetitive, for instance by randomizing pitch and volume at playback instead of making many files.
- visionOS: Choose fixed sound (seems aimed at the wearer, like a calming enveloping scene) or tracked sound (seems to come from an object and changes with its distance). Tracked sound usually adds realism.
- visionOS: Closing the Now Playing app's window pauses its audio, and other apps' audio can duck when people look away.
- watchOS: The system manages playback. Apps play short clips in the foreground, or longer audio that continues after the wrist is lowered or the app is switched.
- watchOS: Encode media at the recommended 64 kbps HE-AAC for good quality with less data. (HG-91)
- watchOS: Consider a system Now Playing view to control current or recent audio without leaving the app.

## Playing haptics

Source: [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics). Applies to: all platforms; patterns differ for iOS, macOS and watchOS.

Covers touch feedback from the Taptic Engine, trackpads, controllers and Apple Pencil, including custom haptics.

- Use system haptic patterns only for their documented meaning. If a pattern does not fit, use a generic pattern or build your own.
- Be consistent so each haptic maps clearly to one cause. Do not reuse a failure pattern for a success such as level completion.
- Use haptics to complement visual and audio feedback. Match a haptic's intensity and sharpness to the accompanying animation, and sync sound with it where useful.
- Do not overuse haptics. Test with users; the best haptic experience is often one people barely notice but miss when it is off.
- In most apps, prefer short haptics on discrete events. Long-running ones suit gameplay flows but dilute meaning in apps and distract. On Apple Pencil Pro, continuous haptics rarely help and can make holding it less pleasant.
- Make haptics optional. Offer a way to turn them off, and keep the app pleasant without them.
- Check that haptic vibration does not disturb camera, gyroscope or microphone use.
- Custom haptics can vary with input or context, such as a stronger impact for a jump from a height than a jump in place, or a hit versus a subtle footstep.
- Build custom patterns from transient events (brief taps or impulses, like the Flashlight button) and continuous events (sustained vibration, like the lasers message effect), and tune sharpness (soft and organic versus crisp and mechanical) and intensity (strength). Optional audio can be added (Core Haptics).
- iOS: Use standard components (toggles, sliders, pickers), which play system haptics by default on supported iPhones.
- iOS: Use a feedback generator (`UIFeedbackGenerator`) for predefined notification, impact and selection patterns.
- iOS: Notification haptics report the outcome of a task, such as a check deposit or unlocking a vehicle.
- iOS: Impact haptics add a physical metaphor, like a tap as a view snaps into position or a thump as two heavy objects meet.
- iOS: Selection haptics give feedback while a control's value is changing.
- macOS: With a Magic Trackpad, offer one of three patterns for drags or force clicks (`NSHapticFeedbackPerformer`).
- macOS: Alignment marks a dragged item lining up with another, reaching a target size or position, or the start, end, minimum or maximum of something like a scrubber.
- macOS: Level change marks movement between discrete pressure levels, such as a fast-forward button speeding up playback.
- macOS: Generic is general feedback when the others do not apply.
- watchOS: Series 4 and later give Digital Crown haptic detents, linear by default, and some controls like tables add detents as items scroll in (`WKHapticType`).
- watchOS: Notification means something significant needs attention and is also played for arriving notifications.
- watchOS: Up and Down mean an important value rose above or fell below a significant threshold.
- watchOS: Success means an action completed; Failure means it failed; Retry means it failed but can be retried.
- watchOS: Start and Stop mark an activity beginning or ending, such as a timer; Stop usually follows Start.
- watchOS: Click gives a dial-click feel for progress at set increments. Overuse weakens it, and overlapping clicks confuse.

## Playing video

Source: [Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

Covers embedding video playback, aspect-ratio modes, TV app integration and platform specifics. Use it for any app or game that plays video.

- Prefer the system video player for familiar, consistent behavior. If you build a custom one, copy the system player's interface and behavior, since small differences frustrate people.
- Know the default modes. Full-screen (aspect-fill, `resizeAspectFill`) fills the display with some cropping and is the default for wide video from 2:1 to 2.40:1. Fit-to-screen (aspect, `resizeAspect`) shows the whole frame with letterboxing or pillarboxing and is the default for standard video up to 2:1 and ultrawide video above 2.40:1. (HG-92)
- tvOS, visionOS: The built-in player has transport controls (subtitles, audio language, add to library, favorite) and content tabs such as Info, Episodes and Chapters. In visionOS the controls appear as an ornament.
- Always show video at its original aspect ratio. Padding baked into the frame stops the system scaling correctly, makes the video look smaller and breaks edge-to-edge contexts such as Picture in Picture on iPad.
- Supply extra information (image, title, description) where it adds value on iOS, iPadOS, tvOS and visionOS (`externalMetadata`), without covering playback.
- Support the input people expect: Space on a connected keyboard plays or pauses video on Apple TV, iPad, iPhone, Mac and Vision Pro, and the Siri Remote keeps its familiar swipe and press behavior on Apple TV.
- tvOS: For playback options or content details, add a transport control (for actions like favoriting) or a custom content tab (supplementary information or recommendations). Keep actions to a step or two and content brief.
- Do not let audio from different sources mix when viewers switch modes, for instance a game that ignores secondary audio while Picture in Picture video is unmuted (`silenceSecondaryAudioHintNotification`).
- TV app: When playback starts from the TV app, it fades to black without your launch screen. Show your own black screen immediately before playing or resuming.
- TV app: Start the chosen content immediately, with no splash, detail screen or intro. If an interstitial is unavoidable, Select steps through it and Play skips it.
- TV app: Resume automatically instead of asking whether to resume.
- TV app: Play or pause on Space from a Bluetooth keyboard.
- TV app: Play for the right viewer. Switch to the profile named in the playback request; if none is named, ask the viewer to choose a profile before playback.
- TV app: Resume long clips from the previous end time.
- TV app: Avoid loading screens. If loading takes over two seconds, consider a black screen with a centered spinner and nothing else. Start playback as soon as enough content has loaded and keep loading the rest. Keep loading-screen branding minimal and the background black. (HG-93)
- TV app: After exiting playback, people stay in your app, so show a relevant screen: the detail view of what they watched with a resume option, else a menu listing the content, else the main menu. Prepare the exit view right after the playback notification, in case they exit immediately.
- tvOS: Keep logos and noninteractive overlays small, unobtrusive and short, preferring translucent SDR graphics over bright opaque ones because some displays suffer image retention.
- tvOS: For interactive overlays (quizzes, surveys), pause playback with a minimum delay of 0.5 seconds, and give a clear way to dismiss and resume. (HG-94)
- visionOS: Support comfort by letting people choose when playback starts, using a small resizable window, and keeping the surroundings visible.
- visionOS: In a fully immersive experience, make sure virtual objects never cover the default player or its bottom ornament with transport controls.
- visionOS: Do not start fully immersive video automatically.
- visionOS: Provide a thumbnail track for scrubbing, using thumbnails 160 px wide for better performance (HLS trick play). (HG-95)
- visionOS: Do not expand an inline player to fill the window. Inline video must stay 2D, with window content visible around it, and its controls sit in the same plane (`AVPlayerViewController`).
- visionOS: Use a RealityKit video player for splash or transitional video that leads into the next experience without controls; it handles 2D and 3D aspect ratios and captions, and can play video on object surfaces.
- watchOS: The system manages playback; apps play short clips in the foreground using a movie element inline or in a separate interface (`VideoPlayer`).
- watchOS: Keep clips to 30 seconds or shorter to save space and avoid wrist fatigue. (HG-96)
- watchOS: Do not scale video clips; use the recommended encoding: H.264 High Profile video at 160 kbps up to 30 fps. (HG-97)
- watchOS: Use recommended resolutions of 208x260 px in portrait for full screen or 320x180 px landscape for 16:9, with audio at 64 kbps HE-AAC. (HG-98) (HG-99)
- watchOS: Do not make a poster image look like a system control; use one that represents the clip content, since tapping it starts inline playback.

## Printing

Source: [Printing](https://developer.apple.com/design/human-interface-guidelines/printing). Applies to: iOS, iPadOS, macOS, visionOS; not supported on tvOS or watchOS.

Covers adding system print support with optional custom options.

- Make printing easy to find in standard places: a Print item in the macOS File menu, and in iOS or iPadOS a toolbar button opening an action sheet. A macOS toolbar Print button can be an optional button people add by customizing.
- Offer printing only when possible. Dim Print in the File menu, or remove it from the iOS or iPadOS action sheet, when nothing can print or no printer is available; dim or hide a custom print button likewise.
- Show relevant options (page range, copies, double-sided) in the system view when the printer supports them.
- macOS: For app-specific options, add a custom category to the print panel with a unique name such as the app name (for example presenter notes or slide backgrounds). Existing categories include Layout, Paper Handling and Media & Quality.
- macOS: For document-specific settings, consider a page setup dialog for rarely changed size, orientation and scaling, without duplicating system features such as orientation or reverse order.
- macOS: Make dependencies between options clear, for instance transparencies becoming unavailable when double-sided printing is available.
- macOS: Hide advanced options behind a disclosure control labeled Advanced Options.
- macOS: Consider previewing a setting's effect, such as an updating thumbnail for a tone control.
- macOS: Consider saving changed print settings with the document, or at least until it closes.

## Ratings and reviews

Source: [Ratings and reviews](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews). Applies to: all platforms.

Covers when and how to ask for an App Store rating. A good experience is the best driver; timing matters.

- Decide timing from engagement signals such as launch count or frequency, features explored, or tasks completed. People can always rate in the App Store.
- Ask only after demonstrated engagement, such as finishing a level or a significant task. Not at first launch or during onboarding, which can invite negative feedback.
- Do not interrupt a task or game; choose natural breaks.
- Do not pester. Space requests at least a week or two apart and ask again only after more engagement. (HG-100)
- Prefer the system prompt on iOS, iPadOS and macOS (`RequestReviewAction`). It checks for previous feedback, asks for a rating and optional review, dismisses with one tap or click, and lets people opt out for all apps. The system limits it to three displays per app in 365 days. (HG-101)
- Weigh resetting the summary rating on a new version: it reflects the current version but leaves fewer ratings, which may discourage downloads.

## Searching

Source: [Searching](https://developer.apple.com/design/human-interface-guidelines/searching). Applies to: all platforms.

Covers in-app search, scoping, suggestions and system-wide search through Spotlight.

- Use a search field for in-app search, and personalize it with recent searches, suggestions, completions or corrections where useful.
- Support scoping or filtering by attributes such as date, size or type with scope bars and tokens, and consider find-in-window or find-in-page for open documents on iOS, iPadOS and macOS.
- If search matters, give it a primary position: for example in a bottom toolbar beside key actions, or as a dedicated tab in apps with tab bars.
- Make all content searchable from one clearly identified place. Local search is still fine in distinct sections, acting as a filter on the current view.
- Show the current scope clearly through descriptive placeholder text, a scope bar, tokens or a title.
- Provide suggestions: recent searches before typing and predictive ones while typing (`searchSuggestions(_:)`).
- Consider privacy before showing search history where others may see it, and let people clear it.
- Make content searchable in Spotlight by indexing it with descriptive metadata, so people can find it without opening the app.
- Define metadata for your custom file types with a Spotlight File Importer plug-in (`CSImportExtension`).
- Consider in-context Spotlight search, such as a button that searches for the current selection and shows results in a custom view.
- Prefer the system open and save views, which include a built-in search field covering the whole system.
- Provide a Quick Look generator for custom file types so Spotlight and other apps can preview them.

## Settings

Source: [Settings](https://developer.apple.com/design/human-interface-guidelines/settings). Applies to: all platforms; macOS and watchOS have specific rules.

Covers app and game settings: what belongs in settings, where it goes, and how to avoid redundant options.

- Choose defaults that serve the most people, such as automatically maximizing game performance for the device, so most people need no changes.
- Offer few settings. Too many hurt approachability and make items hard to find.
- Open settings the expected way: Command-Comma with a physical keyboard, or Esc in games.
- Do not ask in settings for information you can detect, such as a connected controller or Dark Mode.
- Respect system-wide settings (accessibility, scrolling, authentication) and do not duplicate them, which would imply they do not apply to your app.
- Put general, infrequently changed options in your own settings area, such as window configuration, game saving, keyboard mapping and account options.
- Keep task-specific options with the task, such as showing or hiding parts of a view, reordering or filtering, so they stay discoverable and results visible. In games, such adjustments are usually gameplay.
- Put only the most rarely changed options in the system Settings app, and consider a button that opens it directly.
- macOS: Open the custom settings window from a Settings item in the App menu (document-level options go in the File menu), not from a toolbar button.
- macOS: Dim the minimize and maximize buttons of the settings window, since it opens fast with Command-Comma and sizes itself to the pane.
- macOS: Use a noncustomizable toolbar that stays visible, marks the active pane and lets people switch panes.
- macOS: Update the window title to the current pane, or "App Name Settings" if there is a single pane.
- macOS: Reopen at the most recently viewed pane.
- watchOS: Apps cannot add settings to the system Settings app. Place a handful of key options low in the main view, or use a More menu to reconfigure objects.

## Undo and redo

Source: [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo). Applies to: iOS, iPadOS, macOS, visionOS; not supported on tvOS or watchOS.

Covers reversing actions safely and predictably.

- Let people predict what an undo or redo will do. On iPhone, describe it in the shake-to-undo alert with a choice to perform or cancel; in menus, change labels to name the action, such as Undo Typing or Redo Bold.
- Show the result of each undo or redo. If the affected content is offscreen, scroll to it, for example to a restored paragraph, so people do not think nothing happened and repeat it.
- Allow many undo steps. Do not cap them without need; people expect to undo everything since opening or saving.
- Consider reverting a group of related changes at once (such as incremental adjustments of one property) or everything since opening or saving.
- Add dedicated undo and redo buttons only when really needed. Use the standard system symbols in a toolbar; otherwise rely on the Edit menu, keyboard shortcuts on Mac or iPad, and shake on iPhone.
- iOS, iPadOS: Do not redefine standard undo gestures such as shake or the three-finger swipe.
- iOS, iPadOS: Keep undo and redo alert titles short. The system adds the "Undo " or "Redo " prefix, so supply one or two words such as "Name" or "Address Change".
- macOS: Place Undo and Redo first in the Edit menu, with the Command-Z and Shift-Command-Z shortcuts.

## Workouts

Source: [Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts). Applies to: iOS, iPadOS, watchOS; not supported on macOS, tvOS or visionOS.

Covers fitness apps that track activity, mostly on Apple Watch, with iPhone and iPad as companions.

- watchOS: Use workout sessions to show useful data and controls. The app stays on screen between wrist raises, so show what matters, such as elapsed or remaining time, calories and distance, plus controls like laps or intervals.
- Do not distract with irrelevant information, such as your list of workouts or other app areas during a session. Follow the common arrangement used by apps like Workout.
- Give an active workout a distinct look recognizable at a glance, for example a metrics page with live-updating values and a unique layout.
- Make pause, resume and stop controls easy to find and tap, with clear feedback when a session starts or stops.
- If sensors are unavailable, such as heart rate in water, explain what is still recorded (distance, calories, laps). For Swimming or Other workouts use wording like the Workout app's, such as that calories are still tracked through the accelerometer.
- End with a summary screen that confirms completion and shows recorded data, ideally with Activity rings for current progress.
- Discard very short sessions, or ask whether to save them as a workout, if one ends seconds after it begins.
- Keep text legible during motion: large fonts, high contrast, and the most important information easiest to read.
- Use Activity rings only for their documented purpose; their colors and meanings match the Activity app.
