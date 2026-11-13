# Technologies: Live Photos to Wallet

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Live Photos
- Mac Catalyst
- Machine learning
- Maps
- NFC
- Photo editing
- ResearchKit
- SharePlay
- ShazamKit
- Sign in with Apple
- Siri
- Tap to Pay on iPhone
- VoiceOver
- Wallet

## Live Photos

Source: [Live Photos](https://developer.apple.com/design/human-interface-guidelines/live-photos). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers how an app shows, edits, shares and labels photos that carry extra frames and sound. Use it for any gallery, editor or share flow that touches Live Photos.

- Apply every edit, filter or effect to all frames of the Live Photo, not only the key still. If that is not possible, let people turn the item into a still photo first.
- Keep the photo whole. Never split it into separate frames or a separate audio clip.
- Give a Live Photo the same look and the same press-to-play behavior people know from other apps.
- In a share flow, let people preview the complete Live Photo before they send it, and always offer sending it as a plain still photo.
- While a Live Photo downloads, show a progress indicator. Show a clear signal when it finishes and can be played.
- In any environment that cannot play Live Photos, show an ordinary still image. Do not try to imitate the Live Photo behavior.
- Make Live Photos easy to tell apart from stills. The best cue is a small amount of motion; the system provides no built-in motion effect for this, so build a custom one.
- When motion is not possible, place the system-provided Live Photo badge over the picture, with or without text.
- Never add a play control that could be read as a video play button.
- Place any badge at one fixed position across all photos; a corner is the usual choice.
- visionOS: people can view Live Photos but cannot capture them.

## Mac Catalyst

Source: [Mac Catalyst](https://developer.apple.com/design/human-interface-guidelines/mac-catalyst). Applies to: iPadOS, macOS.

Governs a Mac app built from an iPad app with Mac Catalyst. Use it when deciding how far to move from the iPad layout toward Mac conventions.

- Before starting, check that the iPad app already handles drag and drop, keyboard navigation and shortcuts, window resizing (Split View, Slide Over, Picture in Picture) and multiple scenes. Those carry over to the Mac.
- Reject the port if the core experience depends on gyroscope, accelerometer, rear camera, HealthKit, ARKit, or on marking, handwriting or navigation as the main function.
- The default is the iPad idiom, which shrinks views and text to 77% on the Mac, so 17pt text shows at 13pt. (HG-231)
- Consider the Mac idiom once the app feels at home: text and art render in more detail, and graphics-heavy apps can run faster and use less power.
- With the Mac idiom, audit the whole layout. Views and text render at 100% of their size, so fixed font, view and layout sizes cause rework. (HG-232)
- Use a separate asset catalog for the Mac app when you adopt the Mac idiom.
- Prefer text styles over fixed font sizes, and check that images look right at full resolution.
- Limit appearance customizations to those that exist on both iPadOS and macOS controls.
- Do not just show the iPad layout in a window. Adapt navigation, input, layout and menus to Mac conventions.
- Replace a tab bar with a sidebar split view, or with a segmented control when the hierarchy is flat. A sidebar split view usually works better and keeps the iPad and Mac layouts consistent.
- List top-level tab items in the View menu so they stay one step away.
- Offer Next and Previous buttons for paging, in addition to swipe gestures, for pointer and keyboard users.
- Expect standard gesture mapping: a tap becomes a click, touch and hold becomes click and hold, a pan becomes click and drag; pinch and rotate on a trackpad map directly. Pinch and rotate go to the view under the pointer.
- Provide a Mac version of the app icon in the lifelike macOS rendering style.
- Use the wider screen: split single-column content into several columns, use regular size classes, and reflow items side by side as the window grows.
- Show an inspector next to the content instead of a popover.
- Move toolbar-style controls from the iPad main UI into the window toolbar, and list their commands in the menu bar.
- Arrange the window top-down, with the key actions and main content nearest the top.
- Move buttons away from the side and bottom edges; reaching those edges is an iPad ergonomic concern that does not apply to a Mac.
- Put every app command in the menu bar, since Mac users look there. Use `UIKeyCommand` for shortcuts, and `UIMenuBuilder` with `UICommand` for custom menus.
- Pop-up and pull-down menus and existing context menus convert automatically. Add context menus to more objects, because Mac users expect them on everything.

## Machine learning

Source: [Machine learning](https://developer.apple.com/design/human-interface-guidelines/machine-learning). Applies to: all platforms.

Guides the design of features driven by models: how to frame their role, collect feedback, and handle errors, options, confidence and limits.

- Design the model and the interface together, and expect that changing model behavior takes a long time.
- Define the role of machine learning in the app along five axes: critical or complementary, private or public data, proactive or reactive, visible or invisible, and dynamic or static.
- The more central a feature is to the app's purpose, the more accurate and reliable it must be. Secondary features can be more forgiving.
- The more sensitive the data, the higher the cost of a wrong result, so favor accuracy there. Protect privacy for all data.
- Proactive results are unrequested, so people tolerate poor ones less. Add data or filtering to keep them relevant.
- Invisible features give people less chance to judge or correct them, so think about how reliability and feedback will reach people.
- Dynamic features usually need calibration and feedback loops; static ones that only change with app updates may not.
- Explicit feedback: ask only when needed, prefer implicit signals, and make giving feedback optional.
- Describe each feedback option by its consequence, for example "Suggest less pop music" or "Mute politics for a week". Avoid vague words like dislike.
- Add an icon to an option only to support its text, never as the only label.
- Offer several feedback options, ordered from broad to specific, to give people control.
- Act on explicit feedback at once and keep the change across the app.
- Consider using feedback to tune when and where results appear, not only what appears.
- Implicit feedback: protect it, because it can be sensitive, and tell people how information is gathered and shared. Give them ways to restrict it.
- Avoid letting implicit feedback narrow what people see; keep room for discovery.
- Combine several signals before drawing a conclusion, since one action rarely shows intent.
- Withhold suggestions on private or sensitive topics, because devices and accounts are often shared.
- Weigh recent feedback more, falling back to older history when nothing recent exists.
- Match the update rate to people's expectations: typing suggestions update instantly, while constantly shifting recommendations feel rushed.
- Expect implicit signals to shift after UI changes, even small ones such as moving a button.
- Watch for confirmation bias, and do not rely only on implicit feedback.
- Calibration: use it only when the feature cannot work without that first input, and keep the data collected to the essentials.
- Explain what the feature does for people, not how the model works, and secure everything collected.
- Ask for calibration once and early, quickly, without requiring information people must look up or hard actions. Infer the rest.
- Give a clear goal and visible progress during calibration. If progress stalls, give an actionable next step without blaming the person.
- Confirm success with a clear path into the feature, and allow canceling at any time without judging or messaging about it.
- Let people edit or remove their calibration data later, outside the calibration flow.
- Mistakes: anticipate them, help people handle them, and learn from them when that improves the app. Match the corrective tools to how serious the consequence is.
- Make frequent or predictable mistakes easy to fix, and keep the model fresh with recent behavior and domain information.
- Be extra careful with proactive features, since errors there reduce people's sense of control.
- Improving one area can hurt another, such as better dog recognition lowering cat recognition; re-check overall accuracy as models change.
- Corrections: show the steps the app took so people can use familiar controls to adjust or undo the result.
- Show corrected content immediately, keep the correction, and let people correct their corrections.
- Never use corrections to cover for weak output, and make sure fixing a result is cheaper than doing the task by hand.
- Learn from a correction only when it will raise quality.
- Prefer guided corrections that suggest alternatives; allow freeform ones where fine control matters, or combine both.
- Multiple options: use them for suggested items, requested next steps and corrections. They give a sense of control.
- Favor diverse options, avoid offering too many, and fit them on one screen when possible.
- Put the most likely option first, and consider preselecting it.
- Make options easy to tell apart with short descriptions that stress differences; group them into categories if there are many.
- Learn from selections to improve ordering over time.
- Confidence: first check that confidence values really track result quality, otherwise do not show them.
- Turn confidence into ideas people know, such as an attribution like "Because you listen to pop music" instead of a bare match percentage.
- If ranking can imply confidence, order the results. If you must show it, use categories such as high chance and low chance, or numbers where people expect them, such as weather or polls.
- Prefer actionable advice like "Consider waiting for a better price" over raw percentages.
- Change the presentation at different confidence thresholds, for example asking for confirmation when confidence is lower.
- Hide results below a confidence threshold, especially for proactive suggestions.
- Attribution: explain the basis for a result without describing the model. It helps people tell options apart, build a mental model, and reduces the damage of mistakes.
- Keep attributions balanced between too specific and too general, factual, and free of any claim about feelings or beliefs ("Because you've read nonfiction", not "Because you love nonfiction").
- Avoid statistical jargon unless the result itself is statistical, as in weather, sports, polls or science.
- Limitations: tell people what the feature cannot do well or at all, so a limit does not look like a defect.
- Set expectations before use, especially for rare but serious limits, and show how to get the best results, for example through placeholder text that hints at what to search.
- While people use the feature, guide them with feedback on their actions, such as advice on lighting or distance.
- Suggest alternatives instead of an empty result, explain why a result was poor, and announce when a limit has been removed.

## Maps

Source: [Maps](https://developer.apple.com/design/human-interface-guidelines/maps). Applies to: all platforms (watchOS has its own static map rules).

Governs maps in apps and on web pages: interaction, styling, custom content, place cards and indoor venue maps.

- Keep the map interactive with zoom, pan and rotate. Avoid fixed elements that cover the map and break those expectations.
- Choose an emphasis style: the default, fully saturated, suits most maps and matches the Maps app; the muted, desaturated one lets rich custom content stand out.
- Help people find places with search plus category filters, such as store types on a mall map.
- Give a selected area or item a distinct outline and color change.
- Cluster overlapping points of interest under one pin and expand the cluster as people zoom in.
- Keep the Apple mark and the legal link in view. Brief cover by your UI is acceptable, constant cover is not.
- Pad the logo and link 7 points at the sides and 10 points above and below, away from map edges and custom controls. (HG-233)
- Keep the logo and link fixed to the map, not moving with your interface.
- If your interface moves relative to the map, position them from its lowest resting point, for example 10 points over the resting position of a pull-up card at its lowest. (HG-234)
- The logo and link do not appear on maps smaller than 200x100 pixels. (HG-235)
- Style annotations to match your app. The default marker is red with a white pin; change the tint or the glyph, such as a logo or a string.
- Keep a string glyph to two or three characters so it stays readable. (HG-236)
- To show custom info on top of standard features, make map features independently selectable and configure their appearance and details.
- Use overlays for areas tied to your content. "Above roads" sits over roads but under buildings and trees, so the map beneath stays understandable. "Above labels" hides roads and labels below it, good for abstracting or concealing parts of the map.
- Make custom controls contrast with the map using a thin stroke, a light shadow, or blend modes on the map area.
- Place cards show rich place details such as hours, phone and address. Show one directly in the map when someone selects a place, or in lists and store locators outside a map.
- Styles are automatic (chosen from map size), callout (a popover next to the place, full or compact), caption (an "Open in Apple Maps" link) and sheet. A full callout appears as a popover on iPadOS and macOS and as a sheet on iOS.
- Pick the style that fits the map. Use compact callout for a small map with many annotations.
- Make sure the card works across devices and window sizes; set a minimum width for full callouts to prevent text overflow.
- Avoid repeating information your app already shows; compact callout or caption may suit better.
- Keep the place's location visible while a card is showing; offset the card and point it at the place.
- If a place card is not inside a map view, it must contain a map.
- Use cues like place names, addresses, or a map pin icon to show that a place card can be opened.
- Indoor maps: reveal detail by zoom level. Rooms and buildings belong at every zoom level; add finer features and labels progressively as people zoom in.
- Use color with icons to differentiate area, store and service types.
- Offer a floor picker for multi-level venues, with short floor numbers rather than names.
- Include surrounding streets and nearby areas for orientation; dim and recolor them if not interactive.
- Consider routing between the venue and nearby transit, parking and stops, and a quick switch to Apple Maps.
- Limit scrolling away from the venue and keep part of the indoor map on screen, adjusting by zoom level.
- Make the indoor map feel like part of your app, with overlays, icons and text in your own style rather than copying Apple Maps.
- watchOS: a map is a static snapshot that opens the Maps app on tap; it can hold up to five annotations.
- watchOS: fit the whole map element on the display without scrolling, and show the smallest region that contains all key points.

## NFC

Source: [NFC](https://developer.apple.com/design/human-interface-guidelines/nfc). Applies to: iOS, iPadOS.

Covers reading nearby electronic tags with the iPhone, both inside the app and in the background.

- Do not tell people to touch objects. The device only has to be near the tag, so say "scan" or "hold near" rather than "tap" or "touch".
- Leave jargon (NFC, Core NFC, near-field communication, tag) out of user-facing text. Name the object instead, for example "Scan the [object name]."
- Write the scanning sheet text as one short sentence in sentence case with end punctuation. Name the object and avoid truncation.
- Reword the sheet for repeat scans, for example a follow-up asking people to bring the iPhone close to another [object name].
- Background tag reading works whenever the screen is on: the system matches a tag to an app and shows a notification to tap. It is unavailable while a scanning sheet is visible, when Wallet or Apple Pay is in use, when cameras are in use, in Airplane Mode, or right after a restart before the first unlock.
- Support background reading and in-app scanning together, since some devices lack background reading.

## Photo editing

Source: [Photo editing](https://developer.apple.com/design/human-interface-guidelines/photo-editing). Applies to: iOS, iPadOS, macOS.

Covers photo-editing extensions that run inside the Photos app on photos and videos.

- Edits are saved as new files, so originals stay safe. Dismissing the extension view either saves or cancels the edit.
- Ask for confirmation when someone cancels after making changes, and say the edits will be lost. Skip the prompt if nothing has been edited.
- Do not add your own top toolbar. The modal view already has one, and a second wastes space and confuses.
- Let people preview the result before they close the extension.
- Use your app icon as the extension icon so it is clearly yours.

## ResearchKit

Source: [ResearchKit](https://developer.apple.com/design/human-interface-guidelines/researchkit). Applies to: iOS, iPadOS.

Covers onboarding, surveys, active tasks, profile and dashboard screens in medical research apps.

- Show onboarding screens in this order: introduction, eligibility, informed consent, data permissions. People rarely revisit them, so keep them clear.
- Introduction: state the topic and purpose of the study, give a call to action, and let existing participants log in quickly to continue.
- Eligibility: check as early as possible, ask only necessary questions, use plain language and make entry easy. Ineligible people should not reach consent.
- Consent: make sure people understand the study first, and meet legal, review-board and App Store consent requirements.
- Break long consent into short sections, each covering one aspect (data gathering, data use, benefits, risks, time, how to withdraw), with plain summaries and a Learn More option for details.
- Let people view the whole consent form before agreeing. Consider a quiz that checks understanding.
- After agreement, show a confirmation dialog, then collect a signature and contact details. Typically email a PDF copy of the consent form.
- Permissions: ask for device, data and notification access, explain why location, Health or other data is needed, and request nothing that is not critical.
- Surveys: state the question count and the rough time needed up front.
- Put each question on its own screen, display progress, and keep surveys brief; a few short ones beat a single long one.
- Use the standard font for a question and a slightly smaller font for explanatory text. Tell people when the survey is complete.
- Active tasks: describe the task in clear, simple language and state requirements such as timing or conditions.
- Make completion of an active task obvious.
- Profile: let people edit data that changes (weight, sleep), see reminders of upcoming activities, leave the study, and view the consent document and privacy policy.
- Dashboard: show progress and encouragement, such as daily progress, weekly assessments, activity results, and comparison with aggregated results from others where appropriate.
- Keep both profile and dashboard reachable at all times.

## SharePlay

Source: [SharePlay](https://developer.apple.com/design/human-interface-guidelines/shareplay). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers shared real-time activities across devices, plus extra visionOS guidance on spatial Personas and seating templates.

- Use SharePlay for real-time togetherness. For asynchronous follow-up, offer a way to share or keep the activity once the session ends, such as a link to continue collaborating.
- Choose a shared view where everyone sees the same thing (watching, browsing) or role-based views where each person has a perspective (games).
- Make starting easy with a clear control, such as a button using the SharePlay symbol. The share sheet works too, and in visionOS the Share button beside the window bar.
- Make joining quick: get people to the shared content, avoid unrelated views, and guide sign-in, download or subscription in a view that dismisses itself afterward.
- Lower barriers for purchases with provisional access for nonsubscribers or Family Sharing. Defer nonessential setup, such as profiles, until after joining.
- Each participant needs their own access to purchased or subscribed content; the system prompts them.
- Give invitations a brief description, such as a title, short summary and poster for a movie, that avoids truncation.
- Help people understand shared changes: media playback is coordinated, and for other changes use in-app cues showing who did what, like initials beside a contribution.
- Use the term correctly: SharePlay works as a noun or verb. Never add an adjective such as virtual or spatial, and never alter the word (SharePlayed, SharePlays, SharePlaying).
- iOS, iPadOS, macOS: let shared video continue in Picture in Picture so people can multitask. On Mac, keep it playing in a window they can raise.
- visionOS: windows can be shared through the Share button by default; adopt SharePlay if you also want volumetric windows and immersive content shared.
- visionOS: align windows and volumes across everyone's devices, and position 3D objects, sounds and interactions so people feel together.
- Prefer starting from a window, since it is easy to share. An activity that starts in an immersive space needs custom UI to start.
- Resolve conflicts naturally. If only one person can use something at a time, do not show UI that lets another person take over; let people ask by voice or gesture. Consider a simple rule such as last change wins.
- Keep views and immersion levels in sync, and use a unique personalized view only when it enriches the experience. Replace the spatial Persona of anyone in a personal immersive view with a contact photo.
- When one person changes immersion, check whether it would interrupt others. If it would, offer a prompt to join when ready; otherwise transition right away.
- Keep personal settings such as volume and subtitles individual to each participant.
- Make leaving and rejoining easy, with a clear rejoin control. A windowed version lets people multitask while connected.
- Personas: people appear as spatial Personas, contact photos (no Persona set up), or 2D video windows on other devices. People in the same room see each other through passthrough.
- Support people without spatial Personas. If your experience needs facial expressions or gestures, offer alternatives.
- Spatial templates place participants by seat. Side-by-side suits watching content together, facing the content with less nonverbal interaction. Surround suits tabletop and 3D or per-person content, with people facing each other. Conversational places content at the edge, suited to tasks like music playback in the background.
- Divide a complex activity into stages with a template per stage, and mix system and custom templates rather than one complex custom one.
- Tie template transitions to a person's explicit action, such as choosing a team, so seat changes are not disorienting.
- Keep transitions rare and gentle: fade out and back in when moving someone, and add cues to reorient them.
- Custom templates: people in the same room cannot be moved by a template, so add visual cues like position markers when positions matter.
- Choose the seat orientation your content needs; seats face the content center by default.
- Define the maximum number of seats up front, which is five spatial Personas on Apple Vision Pro, and leave a seat where it is when its occupant goes. Add spectator seats if participants are limited.
- Place seats at least a meter apart; a Persona that gets too close to another is replaced with a contact photo: a meter (HG-237)
- Define the seating order so partial groups look balanced, rather than filling left to right.
- Keep roles independent of seats so everyone, including seatless participants, can have any role. Reserve a specific seat only for a role that needs it, like a game host.

## ShazamKit

Source: [ShazamKit](https://developer.apple.com/design/human-interface-guidelines/shazamkit). Applies to: all platforms.

Covers audio recognition against the Shazam catalog or a custom catalog, including its microphone and library privacy points.

- Typical uses: visuals matching the music genre, captions or sign language synced to audio, and in-app experiences synced with content such as lessons or retail.
- Request microphone access when you need audio samples, and explain why you need it.
- Stop recording as soon as you have a usable sample; people do not expect the microphone to stay on.
- If the app can save recognized songs to the person's iCloud library, ask for approval first.

## Sign in with Apple

Source: [Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple). Applies to: all platforms.

Governs when to offer Sign in with Apple, what data to request, and how to present its button. Official logo artwork must come from Apple's design resources.

- Request sign-in only when it buys the person something, and briefly say what signing in provides, such as personalization, extra features or sync.
- Delay sign-in as long as possible so people can try the app first.
- If an account is required, explain why, let people set it up, and then offer Sign in with Apple and other methods.
- Consider letting people link an existing account, either by suggesting it when a shared email matches an account or from account settings.
- In a commerce app, wait until after a purchase to ask for an account. After Apple Pay, offer account creation on the confirmation page without re-asking for name and email.
- Welcome people to the new account right away, without asking for information that is not required.
- Show when someone is signed in this way, for example "Using Sign in with Apple" in settings.
- Keep requests for extra data minimal and explain why you need it. Make clear whether it is required, as with terms, region or birth date under law, or optional.
- Never ask for a password unless the person has quit using that sign-in method for your app.
- If the person shares a private relay address, do not ask for a personal email. Let them view the relay address in your app, point them to the Apple Account settings area for apps using their Apple Account, or use other identifiers such as an order or phone number.
- Ask for optional data after people have used the app, and never block features if they decline.
- Be transparent by welcoming people with the name or email they shared, and show the data you received.
- Show a prominent Sign in with Apple button, at least as large as any other sign-in option, and reachable without scrolling.
- Prefer system-provided buttons: they have an approved look, keep proportions, translate the title, allow a custom corner radius (iOS, macOS, web), and give VoiceOver a label.
- Pick one title variant that fits your terminology and use it everywhere. On watchOS the only title is "Sign in".
- White style suits dark backgrounds with good contrast; available everywhere.
- White with outline suits white or light backgrounds; avoid it on dark or saturated backgrounds. Available on iOS, macOS and web.
- Black suits white or light backgrounds with good contrast, never black or dark ones. The watchOS button uses dark gray rather than pure black.
- Match the corner radius to your other buttons: rounded by default, with square or capsule options on iOS, macOS and web.
- Keep a minimum width of 140pt, a minimum height of 30pt, and a margin of one tenth of the button height. (HG-238)
- Custom buttons are allowed for iOS, macOS and web but App Review evaluates them. They must still be instantly recognizable as Sign in with Apple.
- Use only logo artwork downloaded from Apple's design resources. Never draw your own Apple logo, use the logo alone as a button, crop it, or add vertical padding. Match the logo file height to the button height.
- Do not change the allowed titles (the three "... with Apple" phrases: Sign in, Sign up, Continue), the general shape (rectangular with text; circular or rectangular for logo-only), or the colors: logo and title both black or both white.
- You may change the title font, weight and size, uppercase the title, adjust a black or white background with subtle texture or gradient, use your corner radius, and add a bezel stroke or shadow.
- For a logo-and-text button, use SVG or PDF at any height. Use PNG only for buttons 44 points tall, the recommended iOS height. (HG-239)
- Prefer the system font for the title. Title size is about 43% of button height, so the height is about 233% of the font size, rounded to a whole number. (HG-240)
- Keep the capitalization style (first word and Apple capitalized) unless the interface is all uppercase.
- Vertically center the title, then place the logo at full button height so everything lines up.
- Inset the logo if you need to align it with other authentication logos.
- Keep the title at least 8% of the button width from the right edge. (HG-241)
- For logo-only buttons, use SVG or PDF at any size or PNG only at 44x44 points. Keep a 1:1 aspect ratio and add no horizontal padding. (HG-242)
- Use a mask to change the logo-only shape, for example to a circle; never crop the artwork to reduce its padding. Keep a margin of at least one tenth of the button height.

## Siri

Source: [Siri](https://developer.apple.com/design/human-interface-guidelines/siri). Applies to: all platforms.

Governs how an app exposes actions and content to Siri through App Intents, and how to word responses and refer to Siri.

- An app is invisible to Siri until it exposes actions (intents) and content (entities) through App Intents; this also feeds Spotlight and Shortcuts.
- Where possible, map features and content to App schema domains for areas like email, music and photos, for built-in handling and deeper context.
- Share context: annotate onscreen views with app entities so Siri understands what a person refers to.
- Add entities to the on-device Spotlight index and donate performed actions as intents so Siri can anticipate and suggest them.
- Identify the most popular actions, and where and when they occur, such as hands-free use, to decide what to expose.
- Name intents and entities with familiar terms people would say.
- Offer relevant content, such as recent searches, favorites, bookmarks or wishlists. Email and messaging apps may reasonably expose their whole catalog.
- Do not put ads, marketing or in-app purchase pitches in content that Siri delivers.
- Create a custom response only when the built-in ones do not fit.
- For features outside schema domains, use App Shortcuts. Use optional properties to enrich responses, such as a playback snippet.
- Responses can appear where nothing is shown, so optional properties may not always display.
- Write clear, descriptive dialogue, especially for follow-up questions ("Which soup?" rather than "Which one?").
- Keep responses short and drop humor, because people may hear them often.
- Provide responses that can be spoken or shown, and make the spoken version stand alone without relying on visuals.
- Be inclusive: avoid unnecessary gendered pronouns, for example ask "Who should I send it to?"
- When the option list is too long to read out, ask an open-ended narrowing question.
- Avoid device-specific wording, since a request can start on one device and take effect on another.
- Leave your app name out of responses; the system already attributes them.
- Keep language appropriate, respect parental controls, and remember others nearby may hear the response.
- Make error messages specific, such as "Sorry, we're out of chicken noodle soup".
- Editorial: call it Siri, never she, him or her, and follow Apple trademark rules.
- Never impersonate Siri, copy its functionality, or give a reply that looks like it comes from Apple. Do not use reserved phrases such as "Call 911" or "Hey Siri".
- When localizing "Hey Siri", translate only "Hey" using Apple's approved list per locale, such as "Oye Siri" for es_ES, "Dis Siri" for fr_FR, "Ehi Siri" for it_IT. Never translate Siri.

## Tap to Pay on iPhone

Source: [Tap to Pay on iPhone](https://developer.apple.com/design/human-interface-guidelines/tap-to-pay-on-iphone). Applies to: iOS (not iPadOS).

Governs merchant apps that accept contactless payments with an iPhone: terms, education, checkout, results and non-payment reads. Use Apple-approved assets for marketing materials.

- You need a supported payment service provider, the entitlement and the ProximityReader APIs. If your provider's SDK supplies screens, follow its documentation.
- Merchants must accept the terms before device configuration. Use the ProximityReader API to check status and show the acceptance flow only when necessary, ideally before checkout.
- Show the terms only to an administrator, and tell nonadministrators that admin access is required. Enterprise apps can let an admin accept elsewhere, such as on the web.
- If your provider requires a minimum iOS version, show the terms only after the device is updated.
- Provide a tutorial on supported payment types and how to accept each. Offer it through Learn More, automatically after accepting terms, to new users, and in a consistent help or settings place.
- Build it from Apple-approved assets or use the `ProximityReaderDiscovery` API.
- A custom tutorial must show how to launch checkout for each payment type, how a customer places a card or wallet, and how PIN entry works including accessibility mode.
- End the tutorial with a way for merchants who have not accepted the terms to do so.
- Checkout is time-sensitive: be ready to offer other payment options, respond fast if checkout starts before enabling, continue while configuration is in progress, and present pre-payment actions that change the total.
- List Tap to Pay on iPhone in checkout even when the feature is not enabled yet; tapping it shows the terms if needed, then the Tap to Pay screen when configuration finishes.
- Prepare the feature when the app starts and after every return to the foreground (`prepare(using:)`) to minimize waiting.
- Keep the option selectable during background configuration and show a progress indicator, indeterminate normally and determinate if the API reports ongoing configuration.
- With several payment methods, make the Tap to Pay button easy to find without scrolling. If it is the only method, open it automatically at checkout.
- Make switching between Tap to Pay and hardware accessories possible within checkout, without visiting settings.
- Use the label "Tap to Pay on iPhone" on the button, shortened to "Tap to Pay" if space is limited. If it is the only method, you may reuse Charge or Checkout. When icons are used, pick the `wave.3.right.circle` symbol or its filled variant. Never put the Apple logo in the button.
- Use that label only for payments. Style the button to match your other buttons.
- Settle the final amount, including tips, before opening the Tap to Pay screen and show it there. Show pre-payment options before that screen.
- After a successful tap, the system shows a checkmark and returns encrypted payment data; your app shows results and offers alternatives after a failed tap.
- Start processing as soon as possible; `returnReadResultImmediately` lets you get the result before the checkmark animation ends.
- Show an authorization progress indicator after the Tap to Pay animation finishes (`PaymentCardReader.Event.readyForTap`).
- Clearly show whether a transaction was declined or successful, and offer digital receipts such as QR code or text.
- When a payment cannot complete, offer another form such as cash, another method such as hardware or a payment link, or relaunch for another card.
- Contact your provider for Strong Customer Authentication, where the issuer may request a PIN after the tap, and for Offline PIN markets with PIN fallback.
- When the merchant must fix an error, describe the problem and a remedy, for example an alert recommending an iOS update.
- Give an easy way to get help, such as in-app help content and a support contact.
- For reads with no amount (look up, store card, refund, verify), use a generic label such as "Look Up", "Store Card", "Verify" or "Refund", never "Tap to Pay".
- Loyalty or other NFC passes in Apple Wallet can be read with or without a payment. Give independent loyalty reads a separate, clearly labeled button without payment wording.

## VoiceOver

Source: [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover). Applies to: all platforms.

Covers supporting the screen reader for blind and low-vision users: descriptions and navigation.

- Give every key and custom interface element a spoken label, make them describe function rather than the generic default, and keep them current as the UI changes.
- Describe meaningful images, covering only what the image conveys, since nearby captions are read too.
- Give charts and infographics a concise description, and make any interactions available to VoiceOver users through the accessibility APIs.
- Hide purely decorative images from VoiceOver (`accessibilityHidden(_:)`, `isAccessibilityElement`).
- Use unique, concise screen titles and accurate section headings; the title is the first thing announced.
- Describe relationships that are only visual, such as grouping, order and links.
- VoiceOver reads in the reading order of the language and locale. Group an image with its caption (`shouldGroupAccessibilityChildren`) so they are read together.
- Report visible content or layout changes (`AccessibilityNotification`) so people can update their mental map.
- Support the VoiceOver rotor by identifying headings, links and other content types (`AccessibilityRotorEntry`, `UIAccessibilityCustomRotor`, `NSAccessibilityCustomRotor`).
- visionOS: with VoiceOver on, apps with custom gestures do not receive hand input by default. People can opt out with Direct Gesture mode, so offer accessible alternatives.

## Wallet

Source: [Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (not tvOS).

Covers passes, pass design and images, order tracking and identity verification. Use Apple's official Add to Apple Wallet, Track with Apple Wallet and Verify with Wallet buttons and badges; get artwork from Apple.

- Offer to add a new pass with system UI right after the action that creates it, such as a ticket purchase or reward signup. For frequent actions, add passes in the background after one-time authorization.
- If people want to inspect a pass first, present your own review view that carries an Add to Apple Wallet button.
- Suggest adding a pass created on the web or another device the next time the app opens. If declined, do not ask again.
- Add related passes together, such as all boarding passes of a trip, and bundle website downloads of pass sets.
- Show an Add to Apple Wallet button wherever pass information appears, for a pass declined or removed earlier. Badges exist for email and web.
- Link to a pass in Wallet with a label like "View in Wallet".
- Set expiration date, relevant date and voided properties correctly so expired passes are hidden.
- Get permission before deleting passes, for example through a setting for manual or automatic removal.
- Provide when-and-where relevance information so the system can show the pass on the Lock Screen or start a Live Activity.
- Keep passes current, such as delays and gate changes.
- Reserve change messages (set per field) for time-critical news; never use them for marketing.
- Define content with pass fields and semantic tags. Poster event and semantic boarding passes require semantic tags; also include pass fields so older iOS versions display correctly.
- Field areas: logo and logo text and header fields stay visible when collapsed; primary field holds the key info; secondary and auxiliary fields hold less critical info; footer fields hold supplements like category; back fields hold rarely needed details such as legal text.
- Design a clean pass that fits Wallet's style, not a copy of the physical item. Use Pass Designer to build and preview.
- Design for all devices; Apple Watch shows less. Do not rely on elements that may be missing and avoid padding in images, because watchOS may crop white space.
- Keep the front uncluttered: essential details in the header, quick-access info on the front, rare details on the additional information sheet.
- Make the pass recognizable with brand colors, images, icons and full-art backgrounds, and ensure text contrast on solid colors and images.
- Use device-neutral language, for example not "Slide to view".
- Styles: boarding pass (semantic tags for airlines, pass fields for other transit); coupon; event ticket (poster style supports full art; non-poster uses fields, background image, thumbnail); store card (loyalty, discount, points, gift cards, often with balance); poster generic pass (full background image, flexible); generic pass for other uses.
- Pass images are PNG in @2x and @3x. Use them only for visuals, not text or barcodes (use Pass Designer or APIs for barcodes). Keep files small, and provide a pass icon, which may be your app icon.
- Logo (`logo.png`) in the top leading corner: width 50 to 160 points, height 50 points. Avoid inner drop shadows. (HG-243)
- Primary logo (`primaryLogo.png`) for airline boarding passes plus poster event and poster generic styles: width 30 to 126 points, height 30 points. (HG-244)
- Secondary logo (`secondaryLogo.png`), bottom trailing corner of poster event tickets: width 12 to 135 points, height 12 points. (HG-245)
- Icon (`icon.png`) is square, 38 by 38 points; the system rounds corners. (HG-246)
- Strip image (`strip.png`) for coupons and store cards: 375 by 144 points. Keep areas behind text uncluttered, put key visuals toward the bottom or trailing edge, and embed no text. (HG-247)
- Thumbnail (`thumbnail.png`) for event tickets and generic passes: width 60 to 90 points, height 90 points; rounded artwork on transparent PNG. (HG-248)
- Background (`background.png`) for non-poster event tickets: 343 by 503 points. (HG-249)
- Poster background (`artwork.png`): 358 by 448 points. Keep content in the safe area, as a material strip covers the bottom edge, and allow for a barcode. (HG-250)
- Footer (`footer.png`), airline boarding passes only: 268 by 15 points. (HG-251)
- Order tracking: let Wallet show orders and update them as status changes. Supply as many properties from the Orders schema as match your process.
- Make adding an order easy, for example automatically after an Apple Pay purchase (`PKPaymentOrderDetails`, `ApplePayPaymentOrderDetails`) or with the Track with Apple Wallet button (`AddOrderToWalletButton`) on confirmation, status and tracking pages and in email.
- Show order data immediately after purchase, with a status such as "Check back later for full order details" if details are not ready. Then provide fulfillment info as soon as it is available and keep the status updated.
- Logo image: 300x300 pixels PNG or JPEG with a nontransparent background. (HG-252)
- Product images: distinct, straightforward, 300x300 pixels PNG or JPEG with a solid background; avoid lifestyle or busy backgrounds. (HG-253)
- Keep text brief, clear and localized, and make the price match what the customer confirmed.
- Link to an order management area with a universal link, describe each item with `LineItem`, and optionally attach a PDF receipt.
- Provide a prioritized list of your apps so the system links the best installed one, and avoid duplicate notifications when your app is installed.
- Offer multiple contact methods; the website or landing page link is the minimum, with optional Messages for Business, phone, email and support page.
- Help people track each fulfillment (shipping or pickup) with an arrival estimate, a direct carrier link in addition to the tracking number, a scannable barcode for pickup, and clear instructions.
- Keep the fulfillment screen focused on tracking over promotions.
- Use accurate shipping values: set `carrier` if known, otherwise leave "Track Shipment"; use specific statuses like `onTheWay`, `outForDelivery`, `delivered` when you have carrier steps, otherwise `shipped`. Include a tracking link.
- Write approachable, accurate status messages, and be direct about the reason and next step for Issue or Canceled.
- Identity verification: use the Verify with Wallet button to request an ID from Wallet, in iOS 16 and later. Only show it when the device can return the requested data, and provide a fallback verification method.
- Ask for identity information only at the moment it is needed, for example when completing the process, not at account creation.
- Write a purpose string that is a brief complete sentence in sentence case, active voice, with a period, saying why the information is needed.
- Ask only for needed data; use `age(atLeast:)` instead of requesting birth date or age.
- State whether you keep the data and for how long (`PKIdentityIntentToStore`).
- Pick the button label that fits: verify age, verify identity, continue (when more info is needed from other sources), or a general label when none fit. Multiline variants are automatic.
- The button has white text on black; use the outline style on dark backgrounds, and adjust corner radius to match.
- watchOS: passes appear in a scrolling carousel and tapping shows a details screen; overflow information goes there. watchOS crops strip images and may crop white space from others, so people can add your pass without a watch app.
