# Technologies: AirPlay to iMessage

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- AirPlay
- Always On
- App Clips
- Apple In-App Purchase
- Apple Pay
- Augmented reality
- CareKit
- CarPlay
- Game Center
- Generative AI
- HealthKit
- HomeKit
- iCloud
- ID Verifier
- iMessage apps and stickers

## AirPlay

Source: [AirPlay](https://developer.apple.com/design/human-interface-guidelines/airplay). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers apps that send video or audio to Apple TV, HomePod or AirPlay-capable TVs and speakers, plus how to show the AirPlay icon and name. Use it when building a media player, a custom playback control, or marketing copy that mentions AirPlay.

- Start from the system media player (`AVPlayerViewController`). It already brings chapter navigation, subtitles, captions and AirPlay. Build a custom player only when the system one cannot meet a real need.
- Publish the HLS playlist with the whole ladder of resolutions, so each receiving screen can pick a fitting one. A single low-resolution rendition looks poor once it is cast to a 4K TV.
- Send to the remote screen only what people expect to see there. Keep background loops and short in-app clips on the local device (`usesExternalPlaybackWhileExternalScreenIsActive`).
- Support both AirPlay streaming and screen mirroring.
- Handle remote command events, so play, pause and skip also work from the lock screen, from Siri and from HomePod.
- Keep playback running when the app goes to the background or the device locks. In that case do not switch on mirroring by yourself.
- Leave other apps' playback alone, unless your app is starting immersive content. Launch-time or inline autoplay video should play on the local device only.
- Keep the rest of the app usable while casting. When people leave the player screen, make sure no other in-app video starts and cuts the stream.
- Custom player: give it a hand-built AirPlay control that matches the system one in look and behavior, with distinct states for starting, playing and unavailable.
- Custom player: use only Apple-provided symbols for any control that starts AirPlay, and place it in the lower-right corner of the player (iOS 16, iPadOS 16 and later).
- AirPlay icon: use the black version on white or light backgrounds, the white version on black or dark backgrounds, and a custom color only when the other technology icons share that color.
- AirPlay icon: position it like the other technology icons, and put it inside the same kind of shape if they sit in shapes.
- AirPlay icon: never put the icon or the name AirPlay on a custom button or any interactive element. Use them in noninteractive ways only.
- AirPlay icon: show the name beside or below the icon only if other technologies are shown that way. Set it in the layout's own font, and do not use the icon inside a sentence or in place of the word.
- Make any mention of AirPlay less prominent than your own app name and identity.
- Text: write AirPlay as one word with a capital A and a capital P. Use all caps only when the whole layout is all caps.
- Text: use AirPlay as a noun ("Use AirPlay to listen on your speaker"), never as a verb ("AirPlay to your speaker").
- Text: say support with wording such as "compatible with", "use" or "now supports", for example "AirPlay-enabled speaker" or "You can use AirPlay with [App Name]"; avoid "[App Name] has AirPlay" and the verb form "You can AirPlay with [App Name]". "Compatible with Apple AirPlay" is fine.
- Text: mention AirPlay when it adds clarity or in technical specs, for example "now supports AirPlay".
- Platforms: no extra rules for iOS, iPadOS, macOS, tvOS or visionOS; the feature does not exist on watchOS.

## Always On

Source: [Always On](https://developer.apple.com/design/human-interface-guidelines/always-on). Applies to: iOS (iPhone with an Always On display), watchOS.

Describes how an interface behaves when the display dims while the device is idle: iPhone 14 Pro and later show Lock Screen items such as widgets and Live Activities when set face up, and Apple Watch dims the face when the wrist drops. Use it when a widget, Live Activity or watch app can stay visible in that state.

- Hide sensitive data such as balances or health numbers while Always On is active. Hide it in notification text too.
- Keep non-sensitive, useful data glanceable: workout pace and heart rate on Apple Watch, flight arrival or ride arrival on iPhone. People who want nothing visible can switch the feature off.
- Keep the important content legible and dim the rest. Fade secondary text, images and color fills, and consider dropping row backgrounds or swapping rich images and large color areas for dimmed colors.
- Keep the layout steady. When Always On starts or ends, avoid jarring changes; turn an interactive control into an unavailable look instead of deleting it.
- While in Always On, update seldom and subtly. A sports app can stop play-by-play updates and refresh only when the score changes.
- On iPhone, treat motion as extra distracting, because the phone often lies face up on a surface and movement is visible from the side.
- When motion has to stop, ease it down to a resting state instead of freezing it instantly, so nobody thinks something broke.
- Platforms: no extra rules for iOS or watchOS; not supported on iPadOS, macOS, tvOS or visionOS.

## App Clips

Source: [App Clips](https://developer.apple.com/design/human-interface-guidelines/app-clips). Applies to: iOS, iPadOS.

An App Clip is a small, instantly available slice of an app or game that finishes one task or plays a demo, then goes away after inactivity. Use this page when designing the clip, its App Store card, its notifications, or the printed and digital App Clip Codes that launch it.

- Let people finish the whole task, demo or game level inside the clip. Never require installing the full app to complete it.
- Offer only the essential features. Leave advanced or complex functions to the full app. A demo clip should show the core of the app or game.
- Give real value. Do not build a clip only for marketing, do not use it to advertise products or services, and show no ads in it.
- Use native components and frameworks. Avoid web views; if only web content exists, link to the website rather than shipping a clip.
- Keep the interface linear and focused: no tab bars, complex navigation or settings, few screens and few form fields, nothing extraneous.
- On launch, open directly on the part that fits how the clip was invoked and skip needless steps.
- Make the clip usable at once: bundle every required asset, skip the splash screen, never make people wait.
- Keep the clip small so it launches fast, especially on slow networks. Trim code and unused assets, and avoid extra downloads that break the feeling of immediacy.
- Make the clip shareable. Recipients can open a shared link from Messages, so let people share links to specific points in the clip.
- Support Apple Pay so paying means express checkout and shipping details need no typing.
- Do not demand an account before the benefit. Skip it, or ask after the task is done; if an account is unavoidable, collect little and offer Sign in with Apple.
- Prepare the handover to the full app. Installing it replaces the clip, and later invocations open the app. Keep that experience familiar and do not ask for a second login.
- Privacy: the system forbids background work in clips.
- Privacy: store little data yourself. Keep logins and similar data secure and off the device, and never rely on data saved earlier, because the system may remove the clip and its data between launches.
- Privacy: offer Sign in with Apple and Apple Pay as privacy-preserving options.
- Showcasing: clips have no Home Screen icon and people do not manage them; the system removes them after inactivity. The App Clip card and a banner on first launch already link to the app's App Store page.
- Showcasing: do not spoil the experience with install prompts. For on-the-go clips, ask whether the card and banner are enough. For demo clips, let people finish the demo first.
- Showcasing: when a task ends or a natural pause arrives, show `SKOverlay` so people can start the full-app download from inside the clip.
- Showcasing: recommend the app politely. No repeated asks, no interruptions mid-task, no push notifications for it, and say plainly what extra features the app has.
- Notifications: a clip can schedule and receive them for 8 hours after launch. (HG-174)
- Notifications: request longer-lasting permission only when the clip's job spans more than a day, for example a rental return reminder.
- Notifications: send nothing purely promotional, send only in response to an explicit user action, and skip them entirely if the task ends inside the clip.
- Notifications: keep each one tied to the task, for example a scheduled food delivery.
- Businesses: when one clip serves many businesses, show each business's branding front and center and tone down your own.
- Businesses: handle people using the clip for several businesses or locations. Offer a way to switch among recent ones and verify the person's location at launch.
- Card image: make it say what the clip offers. Prefer photos or graphics, or a photo of the place, over a screenshot of the interface.
- Card image: avoid text in it, since text cannot be localized and is hard to read.
- Card image: use a PNG or JPEG without transparency at 1800x1200 px. (HG-175)
- Card copy: a title is required and may be at most 30 characters. (HG-176)
- Card copy: a subtitle is required and may be at most 56 characters. (HG-177)
- Card button verb: View for media or informational and educational content, Play for games, Open for everything else.
- Codes: an App Clip Code is the best way to get discovered. Use only the artwork generated in App Store Connect or by the App Clip Code Generator tool; never draw your own or alter one.
- Codes: do not apply filters, recolor, or add glows, shadows, gradients or reflections. When scaling, keep the aspect ratio and scale every attribute, such as stroke widths.
- Codes: choose the badge design with the App Clip logo, or the design without it when space is tight. The logo only ever appears as part of the badge below the code, never alone.
- Codes: use a default color pair or custom foreground and background colors. The tools refuse combinations that scan badly, and they can suggest a better foreground color.
- Codes: use the NFC-integrated variant (iPhone icon in the center) wherever people can reach the code: tabletops, registers, storefront windows, signage, gift cards or coupons.
- Codes: use the scan-only variant (camera icon in the center) for posters, printed ads, unreachable signage and digital uses such as email, displays or social posts.
- Codes: leave out the App Clip logo on disposable paper or plastic items and on gambling or drinking items (playing cards, poker chips, coasters), or when the clear-space rule cannot be met.
- Codes: mount them on a flat or cylindrical surface only. On a cylinder, keep the code's width no more than one-sixth of the circumference. (HG-178)
- Codes: keep them flat. Avoid fold-prone materials like paper, plastic or fabric; attach a rigid card to flexible objects, and make sure stickers stay stuck to flat surfaces.
- Codes: place them where lighting is good and scanning does not need a wide angle.
- Codes: keep them unobstructed (no text, logos or images on top), never animated, never dimmed, and upright (no rotation of the code or its center glyph).
- Codes: printed codes must be at least 3/4 inch (1.9 cm) across. (HG-179)
- Codes: digital codes must be at least 256x256 px, as PNG or SVG. (HG-180)
- Codes: the embedded NFC tag must be at least 35 mm across or equivalent. (HG-181)
- Codes: with a tag at the minimum size, the printed code needs a diameter of 1.37 inches (3.48 cm) or more. (HG-182)
- Codes: keep the distance-to-code-size ratio at most 20:1, and aim for 10:1 where possible. (HG-183)
- Codes: next to a QR code or other scannable item, make the App Clip Code at least as large as that item.
- Codes: leave clear space around the code equal to the gap between the center glyph and the circle, and more when it sits beside other machine-readable codes.
- Codes: add a plain call to action, especially without the logo. Scan-only: "Scan to [what the clip does]" or a longer form that names the iPhone or iPad camera as the scanner and then states what the clip does. NFC: "Scan to [what it does]", or tell people to hold their iPhone close to the named object to open a clip that does the described thing.
- Codes: follow Apple's trademark rules: no Apple trademarks in your app name or images, and title case for "App Clips" and "App Clip Code".
- Printing: test printed codes from several angles before handing them out.
- Printing: use high-quality matte, non-textured materials. Avoid gloss, reflective or holographic finishes and thin laminates; use matte laminate if you must laminate, and UV-resistant material outdoors.
- Printing: for professional runs prefer flexographic printing; for desktop printing prefer inkjet.
- Printing: rasterize the SVG at no less than 600 ppi and print at no less than 300 dpi. (HG-184)
- Printing: calibrate the printer and avoid misaligned color channels, wrong gamma, artifacts or distorted (non-circular) codes. On receipt printers, print the code as close to the paper's maximum bounds as possible.
- Printing: convert the sRGB SVG to CMYK with relative colorimetric (media-relative) intent, using the Generic CMYK profile for CMYK printers and the GRACoL 2013 profile for CMYKOV printers, with a CIELab Delta E tolerance of 2.5. (HG-185)
- Printing: on grayscale-only printers, generate grayscale codes only.
- Printing: for NFC-integrated codes choose Type 5 NFC tags.
- Printing: for big batches, run a small pilot first, print on templates that show the encoded URL and SVG filename for checking, and keep a file mapping each SVG to its invocation URL, with careful versioning.
- Printing: use Apple's calibration test sheets to check color-pair print quality and the grayscale bars. Missing or light grays mean the printer needs calibration or is unsuitable.
- Legal: only unmodified Apple-generated codes that follow these rules are approved. Stop showing a code once its clip is inactive.
- Legal: do not use the code, the Apple logo or the App Clip mark in your company or product name, do not register any of them as a copyright or trademark, and do not add a symbol to a generated code.
- Legal: never use the codes in ways that harm Apple's reputation, infringe others' rights, or confuse people about who makes the product.
- Legal: do not translate Apple trademarks; keep them in English inside other languages.
- Platforms: no extra rules for iOS or iPadOS; not supported on macOS, tvOS, visionOS or watchOS.

## Apple In-App Purchase

Source: [Apple In-App Purchase](https://developer.apple.com/design/human-interface-guidelines/apple-in-app-purchase). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

In-App Purchase sells virtual goods inside an app: consumables, non-consumables, auto-renewable subscriptions and non-renewing subscriptions. Use it for digital content and features; use Apple Pay for physical goods, services and donations. This page covers store design, Family Sharing, refund help, subscription sign-up, offer codes and subscription management.

- Pick the right product type: consumable (used up, can be bought again), non-consumable (never expires), auto-renewable subscription (renews until cancelled), or non-renewing subscription (limited access, bought again to extend).
- Let people try the app before buying, and consider limited free access for subscriptions.
- Make the store feel like part of the app: present products and handle transactions in the app's own style.
- Use short, plain product names and descriptions that do not truncate or wrap.
- Display the full amount billed for each item you sell, whatever its type.
- Show the store only when payments are possible. If not (for example parental restrictions), hide it or explain why it is unavailable (`canMakePayments`).
- Use the default confirmation sheet and never alter or copy it.
- Family Sharing: mention it where people learn about content (for example "Family" or "Shareable" in a name, and on the sign-up screen), explain its benefits and how to take part, and word in-app messages so they suit both purchasers and family members ("Your family subscription includes...").
- Refund help: a custom purchase-help screen can offer assistance, alternatives and a route into the system refund flow (`beginRefundRequest(for:in:)`). Let people read the help before requesting a refund.
- Refund help: title the action simply, such as "Refund" or "Request a Refund".
- Refund help: show context for each recent purchase, such as an image, name, description and original purchase date.
- Refund help: offer alternatives, such as immediate fulfillment or a conciliatory item, while keeping the refund option clear.
- Refund help: do not bury the refund button behind scrolling or another screen.
- Refund help: do not describe or predict Apple's refund policy. You may link to Apple's "Request a refund" page.
- Subscriptions: explain what subscribers gain during onboarding, with a prominent action button and terms summarized clearly.
- Subscriptions: give people several content tiers, service levels and lengths to choose from, and consider a free taste through freemium, a metered paywall or a free trial.
- Subscriptions: prompt at relevant moments, such as nearing a monthly free limit, and make subscribing possible at any time.
- Subscriptions: prompt only people who are not already subscribers. If the same subscription is sold in several apps or on the web, offer sign-in so people do not pay twice.
- Sign-up: give clear, distinguishable options with short names, price and duration. For an introductory price, list that price, its duration and the standard price afterward.
- Sign-up: ask only for necessary information and defer the rest until after signing up. On tvOS, send a code to another device for entering details.
- Sign-up: the screen must include the subscription name, duration and what each period provides, the correctly localized billing amount, and a control that lets current subscribers log in or recover purchases, plus links to Terms of Service and Privacy Policy in the app and App Store metadata.
- Sign-up: show billing totals most prominently and put per-period breakdowns in secondary positions so options can be compared.
- Sign-up: explain free trials plainly, including the duration and that payment starts automatically afterward, with the amount.
- Sign-up: also offer a way to subscribe in app or account settings.
- Offer codes (iOS, iPadOS): one-time use codes are unique and generated in App Store Connect (redeemed by link, in the app, or in the App Store), good for small distribution or restricted access. Custom codes (like NEWYEAR) work for mass campaigns and are redeemed by link or in the app only.
- Offer codes: describe the offer plainly in marketing, and keep custom codes to alphanumeric ASCII characters, with no special, Chinese or Arabic characters.
- Offer codes: explain where a custom code can be used, since typing it into the App Store account settings does not work.
- Offer codes: support in-app redemption. The system supplies the screens, so you only build a button (for example "Redeem Code" on a paywall, onboarding or settings) that starts them (`presentOfferCodeRedeemSheet(from:options:)`, `offerCodeRedemption(options:isPresented:onCompletion:)`).
- Offer codes: supply an optional promotional image (otherwise the app icon is used), and make unlocked content available straight after redemption, with a welcome or tour, including for people who subscribe before first opening the app.
- Management: show a summary of the customer's subscriptions with the next renewal date near the manage option (`Product.SubscriptionInfo`).
- Management: prefer the system management UI (`showManageSubscriptions(in:)`) so people can change or cancel without leaving the app.
- Management: when someone tries to cancel, you may remind them what they lose, suggest another plan or offer a discount, and later send a win-back offer. Always keep cancellation easy to find and do.
- watchOS: the sign-up screen needs the same required information as other versions. Explain differences between the watch and other versions without implying equal experiences.
- watchOS: consider a modal sheet for the required details, with its Close button, or a custom flow that has a Close or Cancel button.
- watchOS: make options easy to compare, either one button per option locked up with its description, or a list of options plus a start button whose title reflects the choice.

## Apple Pay

Source: [Apple Pay](https://developer.apple.com/design/human-interface-guidelines/apple-pay). Applies to: iOS, iPadOS, macOS, visionOS, watchOS, and web browsers (not tvOS).

Apple Pay pays for physical goods, services and donations in apps and browsers through a payment sheet, authenticated with Face ID, Touch ID, Optic ID or a double-click on Apple Watch. Use this page for offering Apple Pay, checkout, the sheet, errors, subscriptions, donations, buttons, the mark and wording. Official buttons and the mark must come from Apple's APIs and artwork.

- Offer Apple Pay on every device and browser that supports it, and do not show it where unsupported (`PKPaymentAuthorizationController`, `applePayCapabilities`).
- When you check for an active Wallet card, make Apple Pay the primary (not necessarily only) payment option everywhere, in the same step, such as pre-selected.
- Use Apple Pay buttons only to start payment or, where appropriate, the setup process. A custom button that starts the payment must not show "Apple Pay" or the logo; accept Apple Pay in text or with the mark on the same page.
- Use the Apple Pay mark only to say Apple Pay is accepted; never as or styled like a button. For a selected state, add a separate custom button.
- Keep the Apple Pay button visible and enabled-looking. If a required choice such as size or color is missing, explain the problem after the tap.
- List Apple Pay as a payment option in semantic markup for search engines. Websites need a privacy statement and must follow the acceptable use guidelines.
- Checkout: keep the whole flow cohesive and branded, and avoid opening other pages or windows, which can seem like a handoff to another site.
- Checkout: assume people want Apple Pay when available: show it first, larger, or set apart by a line.
- Checkout: add buttons on product pages for single-item purchase (that item only, removed from the cart afterward), and express checkout for the whole cart with one shipping method and destination.
- Checkout: let people enter coupons or promo codes in the payment sheet, especially in express checkout, and show an applied code on the sheet.
- Checkout: collect required choices (color, size) before the button; if missing, highlight, explain and jump to the field.
- Checkout: collect optional data (gift messages, delivery notes) before or after, because the sheet cannot take it.
- Checkout: gather multiple shipping methods or destinations beforehand, since the sheet supports one per order.
- Checkout: for pickup, have people choose the location first and show its address on the sheet (read-only pickup address).
- Checkout: prefer contact, shipping and payment info from Apple Pay, fetched fresh, over stored data.
- Checkout: do not require an account before purchase; offer registration on the confirmation page with fields prefilled.
- Checkout: report results in the sheet with error messages for failures, then show an order confirmation page with shipping timing and status instructions. Apple Pay may appear there after the last four digits ("1234 (Apple Pay)") or as a note ("Paid with Apple Pay").
- Payment sheet: show and request only essential information. For an electronically delivered gift card, ask for email, not a shipping address.
- Payment sheet: let people choose shipping method there, with description, cost and optional delivery or pickup dates (`PKDateComponentsRange`), correct in any time zone; consider pickup windows.
- Payment sheet: use line items to explain surcharges, discounts, costs still pending, donations added on, and recurring or future payments, but not to list the products bought (`paymentSummaryItems`). Keep them short, ideally on one line.
- Payment sheet: put the business name after "Pay" on the total line, matching the bank statement name ("Pay [Business Name]").
- Payment sheet: if you are an intermediary, name both: "Pay [End Merchant (via Your Business)]".
- Payment sheet: when the total may change after authorization (ride fare, tip), where regulations allow explain it and mark a subtotal "Amount Pending"; preauthorized amounts must match what the sheet shows.
- Payment sheet: let the sheet show progress, with no extra spinners or progress indicators.
- Website icon: provide an icon for payment authorization and Handoff (and Wallet for subscriptions) at 60x60 pt, which is 120x120 px at @2x. (HG-186)
- Website icon: the same icon at @3x is 180x180 px. (HG-187)
- Validation: check input when the sheet appears, when fields change and after authentication. Until the person authorizes, you can see just the card type and a masked shipping address, so check whatever is available early and show errors on failure.
- Validation: do not force business rules; ignore irrelevant data and infer missing data (accept Zip+4 when five digits are needed; accept phone numbers with or without dashes or country code).
- Validation: send the proper status code and custom error (`PKPaymentError`) so the sheet highlights the right field.
- Validation: name the field and the expectation ("Zip code doesn't match city", "Shipping not available for this state"), not "Address is invalid". Use noun phrases, sentence-style capitalization, no ending punctuation, and keep to 128 characters or fewer to avoid truncation. (HG-188)
- Processing: on cancellation or timeout that dismisses the sheet, cancel any in-progress payment; people may restart with the button.
- Subscriptions: explain billing frequency and terms before the sheet, and add line items for frequency, discounts and upfront fees. If nothing is charged at authorization, say when billing starts.
- Subscriptions: for trials, show the trial amount (including $0), the regular amount and the date billing begins. Make the total line show what is charged now.
- Subscriptions: show the sheet for a subscription change only when it adds fees.
- Subscriptions: keep the billing agreement field a concise plain-language summary and leave it blank when in doubt.
- Donations (approved nonprofits only): add a line item such as "Donation $50.00", offer predefined amounts like $25, $50, $100 plus an Other Amount option.
- Buttons: always create them with Apple's APIs (`PKPaymentButtonType`, `PKPaymentButtonStyle`, `WKInterfacePaymentButton`, Apple Pay on the Web). That gives approved captions, fonts and styles, proportional scaling, localization, adjustable corner radius and VoiceOver support. Never design or imitate your own.
- Buttons: choose the type that fits your flow: plain, Buy, Pay-bills (invoices), Check Out, Continue, Book, Donate, Subscribe, Reload, Add Money, Top Up, Order, Rent, Support, Contribute, Tip. The system may fall back to the plain button where a type is unsupported or the width is too small.
- Buttons: show Set Up Apple Pay only when the device supports Apple Pay but it is not set up, in Settings, a profile or an interstitial.
- Button style: automatic follows system appearance. Black goes on white or light backgrounds with enough contrast, never on dark. White with outline goes on white or light backgrounds with weak contrast, never on dark or saturated ones. White goes on dark backgrounds with enough contrast.
- Button size: size the Apple Pay button at least as large as any other payment button, and place it where no scrolling is needed to see it.
- Button size: beside Add to Cart, place it to the right in a side-by-side layout and above in a stacked one.
- Button size: match the corner radius to your other buttons (square corners to capsule shape are possible).
- Button size: minimum width for the plain Apple Pay button is 100 pt. (HG-189)
- Button size: minimum height is 30 pt. (HG-190)
- Button size: typed buttons such as Book with Apple Pay need a minimum width of 140 pt. (HG-191)
- Button size: minimum margin around any button is 1/10 of the button's height. (HG-192)
- Mark: use Apple's artwork, changing only height, which must be equal to or larger than other payment marks. Do not alter width, radius or aspect ratio, add a trademark symbol or content, remove the border, add effects, or flip, rotate or animate it.
- Mark: keep clear space of at least 1/10 of its height, and do not share its border with another graphic or button. (HG-193)
- Wording: write Apple Pay as two words with capital A and P, never plural or possessive, following the Apple Trademark List; all caps only in an all-caps style.
- Wording: never use the Apple logo in place of the name. In the United States add ® on the first appearance in body text, but not on a selection option at checkout.
- Wording: use your own fonts and sizes, not Apple's, and never translate Apple Pay.
- Wording: text-only mention is allowed in payment selection only when all other options are text-only; if any has an icon or logo, use the mark. Follow App Store marketing guidelines in apps.

## Augmented reality

Source: [Augmented reality](https://developer.apple.com/design/human-interface-guidelines/augmented-reality). Applies to: iOS, iPadOS (visionOS uses ARKit differently; not supported on macOS, tvOS, watchOS).

Covers camera-based AR built on ARKit: capability checks, placing and manipulating virtual objects, coaching, multiuser sessions, image detection, wording, interruptions, and the official AR glyph and badges. Use it for any app that overlays 3D content on the live camera view.

- Offer AR only on devices that can run it. If AR is the app's whole purpose, restrict availability to ARKit-capable devices. If AR is optional, quietly leave the feature out on unsupported devices instead of showing an error.
- Give the camera view as much of the screen as possible. Do not clutter it with controls and information that weaken immersion.
- Build convincing objects: detailed 3D assets with lifelike textures, correct scale, placement on detected surfaces, matching environment lighting and camera grain, soft top-down shadows on real surfaces, and visuals that follow camera movement.
- Update the scene 60 times per second, so objects do not jump or flicker. (HG-194)
- For reflective virtual surfaces, remember reflections are approximations from the camera feed. Prefer small or coarse reflective areas so the approximation is less noticeable.
- Use audio and haptics to confirm contact between a virtual object and a surface or another object, and consider background music to envelop people.
- Minimize text placed in the environment; show only what the experience needs.
- Put extra information or controls in screen space, which stays fixed in one place while the AR scene moves with the device.
- For persistent controls, prefer indirect controls: 2D controls in screen space, placed so people need not change how they hold the device. Use translucency so they do not block the scene.
- Expect many real-world settings: small rooms, no large flat surface. Say up front what the experience needs, and consider feature sets for different environments.
- Protect comfort: avoid holding poses that tire people. Place objects at a distance that spares the user from moving close, and keep game levels short with downtime between them.
- If the app encourages movement, introduce it gradually, and do not ask for dodging right at the start.
- Protect safety: people immersed in AR may not notice their surroundings, so avoid encouraging rapid, sweeping or large motions.
- Coaching: use the built-in coaching view (`ARCoachingOverlayView`) to guide initialization and to help relocalize after an interruption.
- Coaching: hide unrelated app UI while the coaching view shows, since it appears automatically when initialization or relocalization starts.
- Coaching: create a custom coaching experience only when you need other information or another visual style, and model it on the system view.
- Placement: show when a surface is found and an object can be placed. Use the coaching view to find a horizontal or vertical plane, then show your own indicator aligned with the detected plane.
- Placement: put the object into the scene the moment it is placed, then refine its position subtly as surface detection improves (`ARTrackedRaycast`). If it landed beyond the surface bounds, nudge it back gently.
- Placement: guide people toward offscreen objects with visual or audible cues, such as an indicator along the edge facing the object.
- Placement: do not try to align objects exactly to detected surface edges, since boundaries are approximate and can change.
- Placement: use plane classification, for example furniture only on a "floor" plane or a game board only on a "table" plane.
- Interaction: prefer direct manipulation by touching 3D objects, and use indirect screen-space controls when people move around while using the app.
- Interaction: use familiar gestures, such as a one-finger drag to move and a two-finger rotation to spin.
- Interaction: keep interactions simple, since touch is two-dimensional while the scene is three-dimensional.
- Interaction: treat a gesture near a small, thin or distant interactive object as aimed at that object.
- Interaction: allow scaling only when it fits the purpose (an imaginary environment yes, a furniture preview no), and never use scaling to change an object's apparent distance.
- Interaction: test similar gestures, such as pinch and two-finger rotation, so they are told apart correctly.
- Interaction: keep moving objects attached to real surfaces and visible; they should not jump or vanish and reappear while resized, rotated or moved.
- Interaction: consider other triggers like motion and proximity, for example a character turning to face a person who approaches.
- Multiuser: each participant maps the space on their own and ARKit merges the maps (`isCollaborationEnabled`).
- Multiuser: let people occlude virtual objects when your app places objects behind people in the camera feed.
- Multiuser: let new people join an ongoing session through implicit map merging, unless everyone must be present before it starts.
- Real-world triggers: supply 2D reference images or 3D reference objects so detection can make virtual content appear.
- Real-world triggers: when a detected image first disappears, wait up to one second before fading out or removing attached virtual objects, to prevent flicker. (HG-195)
- Real-world triggers: keep active reference images to 100 or fewer; switch the active set by context, such as museum area, if you need more. (HG-196)
- Real-world triggers: limit images that need an accurate tracked position, using tracked images when the image may move or the attached content is small relative to it.
- Wording: use friendly terms, not "ARKit", "world detection", "tracking" or "plane". Good examples: tell people a surface could not be found and suggest moving sideways or repositioning the phone; ask them to tap a spot to place the named object; suggest more light and walking around; suggest moving the phone more slowly.
- Wording: in 3D contexts prefer 3D hints, such as a rotation indicator around an object, over text overlays, and use text overlays only if people do not respond to contextual hints.
- Wording: put critical labels and instructions in screen space. Text placed in 3D must face the person and keep the same type size at any distance.
- Wording: if more detail is available, show an indicator that fits the experience to show a tap reveals it.
- Interruptions: tracking stops when people switch apps or take a call, so placed objects may be misplaced afterwards. Support relocalization, and use the coaching view to guide people back to where the device was held before.
- Interruptions: consider hiding placed objects during relocalization and redisplaying them at the new positions, to avoid flicker.
- Interruptions: when the app mixes AR and non-AR tasks, embed the non-AR task inside the AR view, such as changing upholstery without leaving AR.
- Interruptions: give a reset button or another way to cancel relocalization, which otherwise can continue forever.
- Interruptions: when the front camera loses the face for roughly half a second or longer, show a visual indicator, with only minimal text if any. (HG-197)
- Problems: let people reset the experience, and do not make them wait for conditions to improve.
- Problems: suggest fixes in plain language: pair each failure with a hint: too few features, suggest more light and walking around; too much motion, suggest a slower phone; slow surface detection, suggest moving, adding light and aiming at a textured surface.
- AR glyph: use it only to start an ARKit-based experience. Change only its size and color, never use it for other purposes or for experiences not built on ARKit.
- AR glyph: keep clear space of at least 10% of the glyph's height, with nothing overlapping it. (HG-198)
- AR badges: use the badge only to mark products or objects viewable in AR through ARKit. Do not alter the badge or its color, and download the official collapsed and expanded artwork from Apple.
- AR badges: prefer the full badge, and use the glyph-only badge in spaces too small for it. Both work at default size.
- AR badges: use badging only when some items can be viewed in AR and others cannot.
- AR badges: place the badge in the same corner of each item's photo, large enough to see but not hiding important detail.
- AR badges: keep clear space of at least 10% of the badge's height. (HG-199)
- visionOS: ARKit on visionOS can detect surfaces, use hand and finger positions for custom gestures, and bring nearby physical objects into immersive experiences.

## CareKit

Source: [CareKit](https://developer.apple.com/design/human-interface-guidelines/carekit). Applies to: iOS, iPadOS (not supported on macOS, tvOS, visionOS, watchOS).

Guides apps built with CareKit for care plans: privacy, health-data permissions, the task, chart and contact views, notifications, symbols and branding. Use it when designing a care-plan or treatment-tracking app.

- Treat privacy as the top concern. Supply a URL to a clear privacy policy during submission, and get permission before reading data through device features. Protect data whether people typed it or the system provided it.
- HealthKit: ask for health data only at the moment it is needed (weight when the user logs weight, not at launch), and ask again whenever access is needed, since people can change permissions.
- HealthKit: add short descriptive messages to the standard permission screen, explaining why you need the data and how sharing helps. Do not build custom screens that copy its behavior.
- HealthKit: leave health-data sharing management to the system privacy settings; do not add app screens that alter data flow.
- Motion data: with permission and only if useful for treatment, you may read motion state (still, walking, running, cycling, driving), step count, pace and floors climbed.
- Photos: with permission, let people share camera or photo-library pictures with the care team, such as periodic photos of an injury.
- ResearchKit: add related surveys, tasks and charts when appropriate, and use its informed consent module to ask permission to collect and share data.
- Use each view category for its purpose: tasks for prescribed actions and symptom logging, charts for treatment progress, contact views for contact details and communication by phone, message and email, with a map link.
- Views: a CareKit view has a header (text, symbol, disclosure indicator, optional bottom separator) and an optional vertical stack of content subviews. The framework handles layout constraints.
- Tasks: every task needs a title and a schedule. Instructions and a group ID are optional.
- Tasks: use the simple style for one-step tasks. It has a title, subtitle and button, shows a checkmark when done unless you supply an image, and has no content stack.
- Tasks: use the instructions style when a one-step task needs a short note, for example a timing hint such as "Take at bedtime".
- Tasks: use the log style to record events, for example each time a patient feels nauseated, with automatic timestamps.
- Tasks: use the checklist style for multistep tasks, with a text description and done-button per step, for example three daily medication times.
- Tasks: use the grid style for a compact set of buttons in a multistep task, with short button titles. Use a checklist if each step needs a longer description. The grid gives access to its collection view for custom UI.
- Tasks: use color to reinforce meaning, such as one color for medication and another for activity, and never as the only carrier of information.
- Tasks: describe tasks accurately but simply, using a medication's marketing name rather than its chemical name, and dropping words the context already implies, like "take".
- Tasks: add videos or images to complex or multistep tasks to prevent mistakes.
- Charts: use bar, scatter or line charts with a descriptive title and subtitle, axis markers and a data set.
- Charts: highlight narratives and trends, such as medication adherence against pain level, to encourage following the plan.
- Charts: keep labels short and avoid repetition, for instance put the unit in an axis label instead of every data point.
- Charts: use distinct colors, not shades of one color for different meanings, with enough contrast.
- Charts: add a legend when color meaning is not obvious.
- Charts: state the unit of time (seconds through years) in an axis label or elsewhere.
- Charts: consolidate large data sets so points stay readable.
- Charts: offset or restructure data when tiny values would vanish beside very large ones.
- Contacts: choose the simple or detailed contact style, and consider color to categorize care team members.
- Notifications: keep them few, since care plans differ in size, and combine several items into one notification when possible.
- Notifications: consider a detail view that lets people act, such as marking pending tasks complete, without opening the app.
- Symbols: stick with the built-in CareKit symbols (phone, messaging, envelope, clock) for most view styles. The grid style is the place for custom ones, ideally SF Symbols, such as a pill for medication.
- Symbols: custom symbols must relate to the app or to health and wellness. Avoid purely decorative symbols and corporate logos.
- Branding: keep it refined and unobtrusive through color and communication style. Show no advertising.

## CarPlay

Source: [CarPlay](https://developer.apple.com/design/human-interface-guidelines/carplay). Applies to: iOS (not supported on iPadOS, macOS, tvOS, visionOS, watchOS).

CarPlay shows apps from a connected iPhone on the car display, built from system templates for audio, communication, navigation and similar types, for drivers who are driving. Use this page for the shared rules on interaction, audio, layout, color, icons and errors.

- Design for use while driving: quick tasks, minimal interaction. The system renders your template content, so you need no per-resolution layouts or input handling for touchscreens, knobs or touch pads.
- iPhone: remove app interactions on the iPhone while CarPlay is active. Setup that needs the phone must happen before the vehicle moves.
- iPhone: a pending prompt on the phone must never block CarPlay. The app has to keep working while the phone sits in a bag or the trunk; let people handle phone-side problems once the car has stopped.
- iPhone: make every CarPlay feature work with the phone locked, because most people use CarPlay that way.
- Audio: remember your app shares the speakers with the car radio and navigation voice prompts.
- Audio: let people start playback. Autoplay only when the app plays a single audio source or resumes audio that was interrupted. Do not open an audio session before you are ready to play, since that silences other sources.
- Audio: start playing as soon as enough audio has loaded. The system keeps the chosen item highlighted with a spinner until you signal readiness.
- Audio: show the Now Playing screen once audio is ready, without waiting for descriptive metadata. Keep loading that in the background.
- Audio: resume after a temporary interruption (such as a phone call) if audio was playing when it began. Do not resume after a permanent one, such as a Siri-started playlist.
- Audio: you may adjust relative mix levels, but never the overall output volume; people control that.
- Layout: the system scales icons and UI across display sizes such as 800x480, 960x540, 1280x720 and 1920x720 px (aspect ratios 5:3, 16:9, 16:9, 8:3), so elements appear at roughly the same size. (HG-200)
- Layout: present valuable information in an uncluttered layout that can be read at a glance from the driver's seat, without extra detail or ornament.
- Layout: keep a consistent look, with similar-looking elements for similar functions.
- Layout: make the main content prominent and tappable: bigger items look more important and are easier to hit, and the top half of the screen is where the key content and controls go.
- Color: use a limited palette that matches your logo; subtle color can carry the brand.
- Color: never give interactive and noninteractive elements the same color.
- Color: test the scheme in a real car under varied light (time of day, weather, tinted windows). Check night brightness and low-contrast colors that wash out in sunlight.
- Color: support both light and dark appearances, since CarPlay may switch automatically with lighting.
- Color: choose colors that work for people who perceive color differently.
- Images: provide @2x and @3x artwork for everything in CarPlay; the system picks and scales the right one for landscape or portrait displays.
- Icons: reuse your iPhone app icon instead of designing a second one.
- Icons: do not use black as the icon background. Lighten it or add a border so it does not melt into the display.
- Icons: create the CarPlay app icon at 120x120 px for @2x. (HG-201)
- Icons: create the CarPlay app icon at 180x180 px for @3x. (HG-202)
- Errors: handle errors gracefully and surface them only when unavoidable.
- Errors: show any error in CarPlay itself, and never tell people to pick up the iPhone to read or fix it.
- Audio and video CarPlay apps also run on Apple HomeView with no changes.

## Game Center

Source: [Game Center](https://developer.apple.com/design/human-interface-guidelines/game-center). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS (with limits).

Game Center is Apple's social gaming layer, used through GameKit, covering the access point, achievements, leaderboards, challenges and multiplayer activities. Use it when adding profiles, progress, friends and competition to a game, and when preparing the required artwork.

- Check at launch whether the player is signed in to Game Center and, if not, initialize them then. That gives the smoothest experience and the most discovery, for example in Top Played and friend recommendations.
- Access point: it is the Apple-designed element that opens the player's profile and info without leaving the game. On iOS, iPadOS and macOS it opens the Game Overlay; on visionOS and tvOS it opens the full-screen in-game dashboard.
- Access point: show it on menu screens such as the main menu or settings. Do not show it during active play, splash screens, cinematics or tutorials before the main menu.
- Access point: it can sit in any of four screen corners at a fixed position and has collapsed and expanded forms, so keep other controls away and check for overlap with important UI.
- Access point (visionOS): where it appears varies with the type of game, for instance immersive versus volume-based.
- Consider pausing play while the Game Overlay or dashboard is showing, so players do not feel the action continues without them.
- Custom links: you may deep-link into the Game Overlay or dashboard, for example to leaderboards or the player's profile.
- Custom links: use the official Game Center artwork from Apple Design Resources, unchanged in appearance and dimensions, with no added effects.
- Custom links: use exact terms. Say Game Center (not GameKit, GameCenter or game center) with the system translation; Game Center Profile (not Profile, Account or Player Info), localizing only "Profile"; Achievements (not Awards, Trophies, Medals); Leaderboards (not Rankings, Scores, Leaders); Challenges (not Competitions); Add Friends (not Add, Add Profiles, Include Friends).
- Achievements: map yours to the four Game Center states: locked, in-progress, hidden, completed. The system lists completed ones in a Completed group and the rest in Locked.
- Achievements: plan the display order before uploading, because upload order is display order. A good order follows the most common path through the game.
- Achievements: the card allows at most two lines for the title and two for the description; longer text is truncated. Use title-style capitalization for titles and sentence-style for descriptions.
- Achievements: use progressive achievements so the system shows progress and encouraging messages.
- Achievement images: make rich, high-quality art, and never reuse one image for several achievements. A missing image becomes a placeholder.
- Achievement images: the system applies a circular mask, so keep content centered.
- Achievement images: use PNG, TIF or JPG in sRGB or P3, at 72 DPI or higher (minimum). (HG-203)
- Achievement images (iOS, iPadOS, macOS, visionOS): image size 512x512 pt (1024x1024 px @2x). (HG-204)
- Achievement images (iOS, iPadOS, macOS, visionOS): mask diameter 512 pt (1024 px @2x). (HG-205)
- Achievement images (tvOS): image size 320x320 pt (640x640 px @2x). (HG-206)
- Achievement images (tvOS): mask diameter 200 pt (400 px @2x). (HG-207)
- Leaderboards: pick classic (best all-time score, never ends, such as top rhythm-game score or longest endless run) or recurring (resets on an interval you set, such as daily puzzles, seasonal events, or weekly boards per battle mode).
- Leaderboards: group many boards into leaderboard sets by theme or play style, such as difficulty modes, activity types, or genres.
- Leaderboards: give each board its own image that reflects the gameplay being ranked. Use a single image on iOS, iPadOS and macOS, and a set of animating layered images on tvOS (focus effect; Apple Design Resources has a tvOS template).
- Leaderboard images (iOS, iPadOS, macOS): JPEG, JPG or PNG in sRGB or P3, image size 512x512 pt (1024x1024 px @2x). (HG-208)
- Leaderboard images (iOS, iPadOS, macOS): the cropped area is 512x312 pt (1024x624 px @2x). (HG-209)
- Leaderboard images (tvOS): PNG, TIF or JPG, image size 659x371 pt (1318x742 px @2x). (HG-210)
- Leaderboard images (tvOS): focused size 618x348 pt (1236x696 px @2x). (HG-211)
- Leaderboard images (tvOS): unfocused size 548x309 pt (1096x618 px @2x). (HG-212)
- Mind cropping: the system crops art for boards inside a set (iOS, iPadOS, macOS), and tvOS focus can crop layer edges. Keep key content comfortably inside.
- Challenges: they are timed contests built on leaderboards. Use them for short, skill-based activities with a clear measure, playable alone, taking 1-5 minutes. (HG-213)
- Challenges: do not track overall progress or personal bests, which favor regular players. Track the most recent score of each attempt so everyone is on equal footing.
- Challenges: deep-link straight into the mode or level that hosts the challenge. When a first-time player needs a tutorial, run it first, show a notice that the challenge follows automatically, and then start the challenge.
- Challenge artwork: keep key visuals away from the zone where the title and description overlay the image. If the image contains text, deliver localized variants via App Store Connect or Xcode.
- Challenge artwork: JPEG, JPG or PNG in sRGB or P3, at least 72 DPI, image size 1920x1080 pt (3840x2160 px @2x). (HG-214)
- Challenge artwork: cropped area 1465x767 pt (2930x1534 px @2x). (HG-215)
- Multiplayer: support both real-time and turn-based sessions. Entry points are party codes, the Game Overlay, the dashboard and the Games app.
- Party codes: generated codes are alphanumeric and typically eight characters long, like "2MP4-9CMF". (HG-216)
- Party codes: let players join late, leave early and come back; show the current code in the game; accept a manually entered code.
- Offer multiplayer through in-game UI. The default interface lets players invite nearby or recent players, friends and contacts; you can also build it in custom UI.
- Activity artwork: JPEG, JPG or PNG in sRGB or P3, at least 72 DPI, image size 1920x1080 pt (3840x2160 px @2x). (HG-217)
- Activity artwork: cropped area 1465x767 pt (2930x1534 px @2x). (HG-218)
- tvOS: add an optional simple, recognizable image at the top of the dashboard, such as the game logo or word mark, but not the app icon.
- tvOS: dashboard image size is 600x180 pt (1200x360 px @2x), PNG, TIF or JPG, in sRGB or P3, 72 DPI or higher. (HG-219)
- watchOS: GameKit APIs work, but there is no system Game Center UI to call. Game Center content for watch games appears on the paired iPhone.
- iOS, iPadOS, macOS, visionOS: no extra considerations.

## Generative AI

Source: [Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai). Applies to: all platforms.

Principles for apps and games that create or transform text, images and other content with machine-learning models. Use it when planning a generative feature, its disclosures, privacy handling, inputs, outputs and updates.

- Design responsibly. Outputs can vary for the same input and requests are unpredictable, so build inclusive, careful, privacy-protecting experiences, not just a quick prototype.
- Keep people in control. Honor in-scope requests with clear expected output, handle sensitive content carefully, let people dismiss unwanted content and revert or retry changes, and make clear when and where AI is used.
- Be inclusive. Models favor common patterns and can produce stereotypes. When generating images or descriptions of people, ask for the needed details rather than inferring personal or cultural traits, and seek clarity before assuming things like gender identity or relationship type. Test with diverse people.
- Offer generative features only where they bring clear, specific value, such as time saved, better communication or more creativity.
- Keep the experience good when generative features are unavailable or declined. Provide a non-AI fallback when possible, as with regular emoji beside Genmoji or reading notifications without summaries.
- Transparency: tell people when and where AI is used, never let them think a human wrote AI content, and follow disclosure rules of regions where you ship.
- Transparency: set expectations for what the feature can and cannot do. Use a short tutorial or curated starter suggestions for open-ended prompts, state known limits up front, and explain why weaker results happen.
- Privacy: pick a model type that fits the feature and protects privacy. On-device models keep data local, respond fast and work offline; server models suit heavy processing or bigger context. Weigh privacy with capability and performance.
- Privacy: when a server is involved, do the bulk of the work on the device, send the least possible, show people what leaves the device, and say what could be kept remotely or feed training.
- Privacy: ask permission before using personal or usage data, use the minimum, offer a clear opt-out, get explicit permission for data used in model improvement or storage, check third parties' privacy practices, remember outputs can leak sensitive data, and follow stricter rules for kids' apps.
- Privacy: explain concisely and specifically how personal data is used and stored, including whether it trains the model.
- Models: understand a model's capabilities early and remember availability varies by device, network and battery. The Foundation Models framework needs a compatible device with Apple Intelligence on.
- Datasets: choose or build data with diverse representation, know its source, hold licenses for data you do not own, offer choices when using people's data, and allow time to test for bias and misinformation.
- Inputs: guide people with varied predefined example inputs that show what is possible.
- Inputs: warn that output may contain errors, and limit hallucinations by scoping what you ask for. Avoid requesting facts without verified, current data, and avoid AI content where a wrong answer could harm.
- Inputs: before irreversible or problematic actions, think about consequences and get permission. Do not automate destructive actions like deleting photos or hard-to-undo ones like purchases, and ask for confirmation on significant actions. Follow model usage policies and local AI regulations.
- Outputs: put refine and revert controls (Edit, Undo, Retry, Adjust) near generated content, and signal clearly when a correction took effect.
- Outputs: when a request is blocked or the result is poor, coach people toward better requests, with example prompts if possible, as in Image Playground's "Unable to use that description".
- Outputs: reduce harm through risk analysis, policies and testing. Try out-of-scope, vague, poorly phrased, sensitive and malicious requests, and improve the model from what you learn.
- Outputs: reduce copyright risk by building on models with protections, curating inputs (such as pre-approved prompts), and instructing the model not to mimic certain works or styles.
- Outputs: plan for latency. Generation takes longer than real-time models such as ARKit body tracking or Vision, so design a loading state or run it in the background.
- Outputs: give specific progress messages ("Summarizing key themes from your notes") rather than vague ones ("Processing..."). If something fails, say what happened plainly and give a next step.
- Outputs: consider offering several meaningfully different results to choose from, as Image Playground does.
- Improvement: plan model updates, such as quick blocked-word list changes outside app releases and bigger changes tied to updates. Re-test, re-tune prompts and fine-tune when moving to a new base model.
- Improvement: let people give feedback on outputs, always voluntary, in a clear place that does not interrupt, such as thumbs-up and thumbs-down plus an optional detailed route. Resolve issues quickly.
- Improvement: separate the model from the user experience so you can swap models as the technology changes.

## HealthKit

Source: [HealthKit](https://developer.apple.com/design/human-interface-guidelines/healthkit). Applies to: iOS, iPadOS, watchOS (not supported on macOS, tvOS, visionOS).

HealthKit is the shared store for health and fitness data. This page covers permission and privacy, the Activity rings element, the Apple Health icon, and the wording used to mention Apple Health. Use it for any app that reads or writes health data or shows Move, Exercise and Stand progress.

- Ask for health data access only when the app really offers health or fitness functionality.
- Request permission to read data, and protect it fully. Show clearly how the data is used so trust holds.
- Supply a URL to a clear privacy policy during submission.
- Request access at the moment of need (weight when the user logs weight, not at launch) and every time access is needed, since people can change permissions.
- Add a few short sentences to the standard permission screen explaining why you need the data and the benefit. Do not build custom screens that mimic it.
- Leave health-data sharing control to the system privacy settings, with no extra in-app screens that alter data flow.
- Activity rings: use them for Move, Exercise and Stand only. Never copy or change them for other data, and never show those three measures in another ring-like element.
- Activity rings: show one person's progress, and make it obvious whose it is with a label, photo or avatar.
- Activity rings: do not use them as decoration in labels or background graphics, and not for branding in the app icon or marketing.
- Activity rings: keep their colors and background unchanged. Do not apply filters, recolor or change opacity; design the surroundings to blend in, for example by enclosing the rings in a circle, and scale them sensibly.
- Activity rings: keep an outer margin at least equal to the distance between rings, with nothing cropping or covering it. To fit a circle, adjust the enclosing view's corner radius instead of masking.
- Activity rings: separate other ring-like elements from them with padding, lines, labels, color or scale. Use `HKActivityRingView`.
- Activity rings: do not repeat the system's progress updates in notifications, and never show the ring element in notifications. Mention Activity progress only in an app-specific way.
- Apple Health icon: use only Apple's artwork. Do not draw or imitate it.
- Apple Health icon: show the name Apple Health near the icon, and make the icon no smaller than other app icons beside it.
- Apple Health icon: use it only to show compatibility, never as a button.
- Apple Health icon: do not mask it into other corner radii or a circle, and add no borders, overlays, gradients, shadows or effects.
- Apple Health icon: keep clear space of at least 1/10 of its height, and do not composite it onto another graphic. (HG-220)
- Apple Health icon: never use it inside text or in place of Health, Apple Health or HealthKit.
- Apple Health icon: do not show Health app images or screenshots, which are copyrighted. Use an Activity ring element for ring progress.
- Wording: call the app Apple Health or the Apple Health app, written as two words with capital A and H (all caps only where the whole interface style is all caps).
- Wording: keep the term HealthKit away from users, as it is a developer name; phrase it as your app working with, or drawing data from, the Apple Health app.
- Wording: use the system translation of Health.
- Platforms: no extra rules for iOS, iPadOS or watchOS.

## HomeKit

Source: [HomeKit](https://developer.apple.com/design/human-interface-guidelines/homekit). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

HomeKit lets people control home accessories by Siri or the Home app. Apps and accessories integrate through its object model, system setup flow, naming rules, Siri phrasing, camera views and icon and trademark rules. Use it for smart-home accessory apps.

- Use HomeKit's own terms and object model: home at the root, containing rooms, accessories and zones. Reflect them when helping people set up or control accessories, since voice commands depend on location.
- Show an accessory's HomeKit details (zone, room) in its detail view, not buried in settings.
- Remember people may have several homes, and surface home info in the accessory detail view even if your app has one-home logic.
- Never duplicate home settings. Defer to what people set in the Home app and present it your way instead of asking them to configure again.
- Vocabulary: home is a place (house, office); room is a named space with no size or location; accessory is a physical device and category is its type; service is a controllable feature; characteristic is an attribute of a service; service group controls services as a unit; action changes a characteristic; scene is a group of actions; automation reacts to location, time, accessory state or sensors; zone is an area holding several rooms.
- Never show the words "service" or "characteristic" in UI; use descriptive names like "garage door opener" or "speed". Always say "scene" in UI, not the API's "action set".
- A switch controlling a fan or lamp should share that device's category, and your app may help assign it.
- Setup: use the system setup flow (`performAccessorySetup(using:completionHandler:)`). It handles naming, joining networks, pairing, room and category assignment and favorites in few steps.
- Setup: write a purpose string that says why Home data is needed, for example so people can run the accessory from Apple Home and Siri on their devices.
- Setup: do not require an account or personal information. Defer to HomeKit, and make any cloud account optional and offered after initial setup.
- Setup: honor the choice of HomeKit setup. Do not force setup on other platforms in that flow.
- Setup: show the system flow first, then offer a custom post-setup experience for unique features, such as personalized light scenes from photo colors.
- Names: suggest good service names when someone picks a poor one for Siri, and never propose company names or model numbers.
- Names: check renamed services against the rules: only letters, digits, spaces and apostrophes; start and end with a letter or digit; no emoji. Explain a violation briefly and suggest alternatives. "Reading lamp" and "2nd garage door" pass; "📚 lamp" and "#2 garage door" fail.
- Names: help people avoid putting room or zone names inside service names ("kitchen light"), which makes voice control unpredictable; suggest assigning the room instead.
- Siri: after setup, show example voice commands using the chosen service name, and later teach more complex phrases, such as in a scene detail view ("Hey Siri, set 'Movie Time'").
- Siri: it identifies targets by home, room, zone, service, service group, scene, accessory category and characteristic (for example "brighter" implies brightness), and by current home or room ("It's dark in here").
- Siri: suggest zones and service groups when they help an accessory, such as "upstairs" or "media center".
- Siri: offer shortcuts only for functions HomeKit lacks, such as "Order AC filters", never for scenes or actions HomeKit already supports, and explain the difference between shortcuts and HomeKit voice control.
- Custom features: be clear about what your app does versus the Home app. For example, guide a lights-only app to create a scene with its own actions, then suggest adding shades and TV in the Home app.
- Custom features: defer to the HomeKit database if yours differs, and reflect changes made in the Home app or other apps. For conflicts, present both values visually, such as two names side by side.
- Custom features: ask permission before writing to the HomeKit database, and never overwrite settings without explicit direction.
- Cameras: show still images or streaming from HomeKit IP cameras without covering the image. Extras like activity alerts are fine.
- Cameras: show a microphone button only when the camera supports two-way audio.
- Icons: the HomeKit icon belongs in setup and instructional material; the Apple Home app icon may refer to the app, or sit on a button that opens its App Store page. Only Apple's own artwork is allowed.
- Icons: match the surrounding technology icons: black version over white or light areas when they are black, white version over black or dark areas when they are white, a custom tint when they all share one.
- Icons: place the HomeKit icon like other technology icons, inside the same shape if they have one.
- Icons: use it noninteractively; no HomeKit icon or name in custom buttons.
- Icons: do not use it inside text or in place of the word HomeKit. Pair it with the name below or beside it only if other technologies are shown that way, in the layout font.
- Text: keep HomeKit and Apple Home references less prominent than your app. Follow Apple trademark rules: no Apple trademarks in app names or images, singular and non-possessive, untranslated, no category descriptors (say iPad, not tablet), no implied sponsorship, correct credit lines in legal text, and Apple devices or OS versions only in specs or compatibility notes.
- Text: HomeKit is one word with capital H and K; Apple Home is two words with capital A and H. Use all caps only in an all-caps layout.
- Text: do not use HomeKit as a descriptor ("HomeKit lightbulbs"); use works with, use, supports or compatible, for example "HomeKit-enabled thermostat". Do not make HomeKit the actor ("HomeKit unlocked the back door").
- Text: "Apple HomeKit" is fine, and HomeKit can name setup and settings ("Open HomeKit settings").
- Text: on first mention in body copy call the app Apple Home, then Home is acceptable.

## iCloud

Source: [iCloud](https://developer.apple.com/design/human-interface-guidelines/icloud). Applies to: all platforms.

iCloud makes content available on every device without manual sync, and people should never need to know where content lives. Use this page when a document, setting or game save syncs through iCloud.

- Work with iCloud automatically when it is on in Settings. If a choice is wanted, show one simple first-launch option: iCloud for all data or none.
- Do not ask which individual documents to keep in iCloud; do more file management for people automatically.
- Keep content current when you can, balanced against storage and bandwidth. For very large documents, let people control downloads, signal that a newer version exists, and show subtle feedback when an update takes more than a few seconds.
- Treat iCloud space as paid and finite. Store what people create and understand, not app resources or regenerable content. Remember backups include each app's Documents folder, so be picky about what goes there.
- When iCloud is unavailable (turned off or Airplane Mode), no alert is needed; at most tell people unobtrusively that changes will not reach other devices until iCloud returns.
- Store app state in iCloud, such as the last page read, and sync only settings people want on all devices.
- Before deleting a document, warn and confirm, because it is removed from iCloud and every device.
- Resolve version conflicts automatically when possible; otherwise show an unobtrusive way to tell the versions apart and choose, as early as possible.
- Include iCloud content in search results.
- Games: consider saving progress through the GameSave framework, which syncs save data and provides alerts for offline and conflict situations, or build custom conflict UI.
- Platforms: no extra considerations.

## ID Verifier

Source: [ID Verifier](https://developer.apple.com/design/human-interface-guidelines/id-verifier). Applies to: iOS (not supported on iPadOS, macOS, tvOS, visionOS, watchOS).

ID Verifier lets an iPhone app read ISO 18013-5 mobile IDs in person with no extra hardware, for example checking ages at a venue. Use it when building an in-person age or identity check.

- Choose the request type: Display Only shows data such as name or age with a portrait inside system UI on the requester's iPhone and sends nothing to your app; Data Transfer is for a legal need to store or process data like address or birth date and needs an extra entitlement.
- Ask only for needed data. For a minimum-age check use an age threshold request (`ageAtLeast(_:)`) rather than age or birth date.
- If the app qualifies, register with Apple Business Register so the system shows your official organization name and logo in the verification UI.
- Start verification from a button: label it Verify Age for a plain age check, or Verify Identity when requesting detailed identity data. Skip symbols tied to one transport such as NFC or QR, and never put the Apple logo in the label.
- In a Display Only request, let the person using the app record the visual check, with buttons such as Matches Person and Doesn't Match Person that return approved or rejected.

## iMessage apps and stickers

Source: [iMessage apps and stickers](https://developer.apple.com/design/human-interface-guidelines/imessage-apps-and-stickers). Applies to: iOS, iPadOS (not supported on macOS, tvOS, visionOS, watchOS).

iMessage apps and sticker packs live inside Messages conversations and in effects in Messages and FaceTime, as standalone apps or extensions. Use this page for design choices and icon and sticker asset specs.

- Give the iMessage app one primary experience that is instantly understandable. For several functions or content collections, make separate iMessage apps.
- Consider surfacing content from the main app that people share, such as a shopping list or trip itinerary, or a simple collaborative task like picking a restaurant or movie.
- Put the most used items in the compact view (below the transcript) and keep extras for the expanded view.
- Allow text editing only in the expanded view, because the compact view is about as tall as the keyboard.
- Make stickers expressive, inclusive and versatile: legible on many backgrounds, rotated and scaled; transparency helps them blend with text, photos and other stickers.
- Give every sticker a localized alternative description for VoiceOver.
- Icons: supply a square-cornered icon per extension; the system rounds the corners. It appears in Messages, the App Store, notifications, Settings and the Messages app drawer.
- Icons (Messages, notifications) at @2x: 148x110 px. (HG-221)
- Icons (Messages, notifications) at @2x: 143x100 px. (HG-222)
- Icons (Messages, notifications) at @2x: 120x90 px, and at @3x: 180x135 px. (HG-223)
- Icons (Messages, notifications) at @2x: 64x48 px, and at @3x: 96x72 px. (HG-224)
- Icons (Messages, notifications) at @2x: 54x40 px, and at @3x: 81x60 px. (HG-225)
- Icons (Settings): 58x58 px at @2x and 87x87 px at @3x. (HG-226)
- Icons (App Store): 1024x1024 px at both scales. (HG-227)
- Stickers: pick one size (small, regular or large) and use it for the whole pack; do not mix sizes.
- Stickers: prepare images at @3x, and the system downscales for @2x and @1x. Small is 300x300 px. (HG-228)
- Stickers: regular is 408x408 px at @3x. (HG-229)
- Stickers: large is 618x618 px at @3x. (HG-230)
- Stickers: each file must be 500 KB or smaller. (HG-231)
- Stickers: PNG has 8-bit transparency and no animation; APNG has 8-bit transparency and animation; GIF has single-color transparency and animation; JPEG has neither.
