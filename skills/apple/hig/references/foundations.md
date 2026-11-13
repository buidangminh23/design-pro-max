# Foundations

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Accessibility
- App icons
- Branding
- Color
- Dark Mode
- Icons
- Images
- Immersive experiences
- Inclusion
- Layout
- Materials
- Motion
- Privacy
- Right to left
- SF Symbols
- Spatial layout
- Typography
- Writing

## Accessibility

Source: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Applies to: all platforms.

Covers how to make an interface usable by people with vision, hearing, mobility, speech and cognitive differences. Use it when auditing any screen, control, animation or media for inclusive behavior.

- Let people enlarge text to at least twice its size (140% on watchOS), through Dynamic Type or custom controls. (HG-16)
- Follow the platform defaults when you define custom type styles. iOS, iPadOS: body default 17 pt, never below 11 pt. (HG-17)
- macOS: default 13 pt, minimum 10 pt. (HG-18)
- tvOS: default 29 pt, minimum 23 pt. (HG-19)
- visionOS: default 17 pt, minimum 12 pt. (HG-20)
- watchOS: default 16 pt, minimum 12 pt. (HG-21)
- Choose larger sizes when a custom font is thin, because light weights read worse at small sizes.
- Measure text and icon contrast with a standard calculator (WCAG or APCA). Text up to 17 pt needs at least 4.5:1. (HG-22)
- Text at 18 pt and above, and any bold text, needs at least 3:1. (HG-23)
- If default colors miss those ratios, ship a higher-contrast scheme that applies when Increase Contrast is on, and verify contrast in both light and dark appearances.
- Reach for system-defined colors first; their accessible variants follow Increase Contrast and appearance switches.
- Never use color as the only signal. Pair it with shapes, icons or labels, especially red-green and blue-orange pairings, and consider letting people customize chart or character colors.
- Give every interface element and piece of content a VoiceOver description.
- Offer text alternatives for sound and video: captions, subtitles, audio descriptions and transcripts, and let people restyle the text.
- Pair sound cues (success chime, error tone, game feedback) with matching haptics; on iOS and iPadOS, Music Haptics and audio graphs can convey music and charts by touch.
- Add visual cues next to audio cues, particularly in games and spatial apps where action may happen off screen.
- Size controls for easy touch or click. iOS, iPadOS: default 44x44 pt, minimum 28x28 pt. (HG-24)
- macOS: controls default 28x28 pt, minimum 20x20 pt. (HG-25)
- tvOS: controls default 66x66 pt, minimum 56x56 pt. (HG-26)
- visionOS: controls default 60x60 pt, minimum 28x28 pt. (HG-27)
- watchOS: controls default 44x44 pt, minimum 28x28 pt. (HG-28)
- Treat spacing as seriously as size: leave about 12 pt around bezeled elements. (HG-29)
- Leave about 24 pt around the visible edges of elements without a bezel. (HG-30)
- Use the simplest gesture for frequent actions; avoid custom multifinger or multihand gestures.
- Provide an on-screen alternative to every gesture, for example a button that does what a swipe-to-dismiss does.
- Label elements properly so Voice Control can target them and dictation can fill fields.
- Integrate Siri and Shortcuts so repetitive tasks can run by voice, the Action button, Home Screen or Control Center.
- Test with VoiceOver, AssistiveTouch, Pointer Control, Switch Control and keyboard-only navigation, and confirm elements are labeled.
- Make everything operable with the keyboard alone and do not override system-defined or accessibility keyboard shortcuts.
- Support Switch Control so people can select, tap, type and draw using external switches or sounds.
- Keep interactions simple and consistent; favor familiar system gestures over new ones people must memorize.
- Avoid UI that disappears on a timer; dismiss through an explicit action so slower readers and assistive-tech users have time.
- In games, consider difficulty options such as relaxed success criteria, adjustable reaction time or control assistance.
- Do not autoplay audio or video without discoverable start and stop controls; consider a global opt-out for autoplay.
- Respond to the Dim Flashing Lights setting in video playback.
- Limit fast or blinking animation. When Reduce Motion is on, cut automatic and repeating animation including zooming, scaling and peripheral motion.
- To reduce motion: tighten spring bounce.
- To reduce motion: track animation directly to the gesture.
- To reduce motion: do not animate depth changes along the z-axis.
- To reduce motion: swap x, y and z transitions for fades.
- To reduce motion: avoid animating into or out of blurs.
- Optimize for Assistive Access: keep only core functionality and drop noncritical flows and UI.
- Assistive Access: split multistep flows so each screen holds one interaction.
- Assistive Access: ask for confirmation twice before any action that is hard to undo, such as deleting a file.
- visionOS: keep interface elements inside the field of view, prefer horizontal layouts to avoid neck strain, and do not demand attention in far-apart places in quick succession.
- visionOS: slow down and soften animated objects, especially in peripheral vision.
- visionOS: keep camera and video motion gentle so the world never seems to move without the person's control.
- visionOS: do not lock content to the wearer's head; it feels confining and blocks Pointer Control.
- visionOS: minimize large or repeated gestures, which tire people and may not fit their surroundings.

## App icons

Source: [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons). Applies to: iOS, iPadOS, macOS, tvOS, visionOS, watchOS.

Defines how to build an app icon from layers, shapes and appearance variants. Use it when creating or reviewing an icon asset for any Apple platform.

- Build icons in layers: iOS, iPadOS, macOS and watchOS use one background plus one or more foreground layers, and the system adds Liquid Glass effects to them.
- tvOS: use two to five layers so the icon shows parallax depth when focused. (HG-31)
- visionOS: use a background layer plus one or two layers above it.
- Give foreground shapes crisp edges; avoid soft or feathered outlines so system highlights and shadows render well.
- Vary opacity across foreground layers to add depth. Import opaque layers and adjust transparency in Icon Composer so you can preview the interaction with system effects.
- Choose a background that stands out and supports the foreground. Prefer solid colors or gradients set in Icon Composer; a custom background must be full-bleed and opaque.
- Prefer vector layers (SVG or PDF) with outlined artwork and text converted to outlines; use PNG for mesh gradients and raster art.
- Pick the format deliberately on iOS, iPadOS, macOS and watchOS: a layered Icon Composer file, or a flat bitmap such as PNG.
- Prefer the Icon Composer format; with a bitmap, the system splits it into two layers, which keeps dark and tinted variants working.
- From a bitmap, the system applies Liquid Glass only to large simple shapes, not to small details like text or thin lines; use a layered file to control which elements get it.
- Supply unmasked square layers for iOS, iPadOS, macOS, visionOS and watchOS, and rectangular layers for tvOS; the system applies rounded or circular masks.
- Do not pre-mask layers; baked-in masks hurt specular highlights and give jagged edges.
- Keep the main content centered so masking never trims it, especially for visionOS and watchOS circular icons; use the production template grids.
- Keep the idea simple: one core concept, few shapes, and a plain background, without filling the whole canvas.
- Keep the design visually consistent on every platform you ship, so people recognize the app everywhere.
- Consider filled, overlapping shapes; with transparency and blur they create depth.
- Add text only if essential to brand or meaning. Avoid instructional words such as Watch or Play and context words like New or For visionOS; a single mnemonic letter is acceptable. On tvOS, keep any text above other layers so parallax does not crop it.
- Prefer illustration over photographs, avoid very thin lines and sharp corners, and do not copy standard UI components or screenshots into the icon.
- Do not draw replicas of Apple hardware.
- Leave blur, specular highlights, drop shadows between layers, bevels and glows to the system; if you add custom effects, use them deliberately and test in Icon Composer, a simulated device or real hardware.
- Group layers in Icon Composer when effects should apply to several layers together; groups expose extra Liquid Glass options.
- iOS, iPadOS, macOS: people may pick default, dark, clear or tinted icon appearance; design variants for each (the system generates any you omit).
- Keep the same core features in every appearance; do not swap elements between variants.
- Make dark, clear and tinted icons sit comfortably beside system icons and widgets; they are more subdued, but must stay legible and recognizable.
- Derive the dark icon from the light one with complementary colors and no excessively bright imagery; colored backgrounds give the best contrast.
- Consider alternate icons users can choose in settings (iOS, iPadOS, tvOS, and compatible apps in visionOS). Keep them tied to your content and never resemble another app.
- iOS, iPadOS: each alternate icon also needs its own dark, clear and tinted variants, and all icons go through App Review.
- tvOS: keep content inside a safe zone because focus scaling and motion can crop edges; foreground layers are cropped more than background layers.
- visionOS: do not add a shape in the background that imitates a hole or dent; system shadows and highlights make it protrude.
- watchOS: do not use black as the icon background; lighten it so the icon stays visible on the display.
- Canvas size for iOS, iPadOS and macOS is square 1024x1024 px; it ships as layered art in six looks: default, dark, and light and dark versions each of clear and tinted. (HG-32)
- tvOS layout is a landscape rectangle, 800x480 px, layered with parallax. (HG-33)
- visionOS layout is square, 1024x1024 px, layered in 3D and masked to a circle. (HG-34)
- watchOS layout is square, 1088x1088 px, layered and masked to a circle. (HG-35)
- The system derives smaller sizes (Settings, notifications) itself. Supported color spaces: sRGB, Gray Gamma 2.2, and Display P3 (not on visionOS).

## Branding

Source: [Branding](https://developer.apple.com/design/human-interface-guidelines/branding). Applies to: all platforms.

Explains how to express a brand without fighting the platform. Use it when deciding where brand color, fonts, logos and tone appear in the interface.

- Write all visible copy in a consistent brand voice and tone.
- Use the accent or brand color sparingly: reserve it for primary actions and status cues such as unread badges or the selected tab icon, not for every control.
- To spread brand color further, put it in the content layer, so it slides under glass controls and is sampled live.
- A custom font is fine if it stays legible at every size and honors bold text and Dynamic Type; consider it for headlines and use system fonts for body and captions.
- Express the brand through familiar components; when you restyle one, keep its size, position and behavior recognizable for the platform.
- Let content win: do not spend screen space on pure brand assets.
- Use standard patterns consistently (expected placement, standard symbols, established navigation and modality) even when the look is highly stylized.
- Show your logo only where it gives needed context; people rarely need reminding which app they are in.
- Do not treat the launch screen as branding; use a welcome or onboarding screen for that.
- Never put Apple trademarks in the app name or imagery; follow Apple's trademark rules.

## Color

Source: [Color](https://developer.apple.com/design/human-interface-guidelines/color). Applies to: all platforms.

Guides color choice, adaptivity, accessibility and color management, including Liquid Glass tinting. Use it when defining a palette, picking system colors or checking light, dark and high-contrast behavior.

- Give each color one meaning; do not use your interactive tint on non-interactive text.
- Ship every custom color with light and dark variants plus an increased-contrast option for each, even if the app has only one appearance, so Liquid Glass can adapt.
- Prefer system colors, which already cover light, dark and Increase Contrast.
- Test colors in bright sun (colors look darker and muted) and in dim light (they look brighter and more saturated), and on visionOS against varied walls and objects.
- Test on different devices and displays: True Tone, P3 versus sRGB profiles on a Mac, and several TV brands for tvOS.
- Where reading, photo, video or gaming content warrants it, you can set a white point adaptivity style (`UIWhitePointAdaptivityStyle`).
- Adjust nearby colors for artwork and translucency; colors shift behind translucent bars such as toolbars.
- When users choose colors, prefer the system color picker (`ColorPicker`).
- Do not rely on color alone for object identity, interactivity or essential information; add text labels or glyph shapes.
- Avoid color pairs with poor contrast or that color-blind people cannot tell apart.
- Check how colors read in other cultures; red means danger in some and something positive in others.
- Do not hard-code system color values; they can change between releases. Apply them through APIs such as `Color`.
- On iOS, iPadOS, macOS and visionOS use the dynamic system colors, which are named for purpose, and do not repurpose them (for example, no separator color for text or secondary label color for a background).
- Liquid Glass has no color of its own and takes color from the content behind it; you can tint it for emphasis, as prominent buttons do.
- Toolbars and tab bars flip between light and dark glass to match content; their symbols and text are monochrome by default. Large elements like sidebars are more opaque.
- Use color on glass sparingly, only for status or primary actions; tint the background of the primary control rather than its symbol or text, and do not tint the backgrounds of several controls.
- With colorful backgrounds, keep toolbars and tab bars monochrome or choose a clearly different accent; with mostly monochrome content, the brand color works well as accent.
- Keep content and controls from sharing similar colors, and make sure the resting state, such as the top of a scrolling screen, is legible.
- Embed a color profile in images; sRGB is accurate on most displays.
- Use wide color where it helps: Display P3 at 16 bits per channel, exported as PNG. (HG-36)
- Supply separate sRGB and P3 assets in the asset catalog if similar P3 colors blur together or gradients clip on sRGB displays.
- iOS, iPadOS: default to the `systemBackground` family (`systemBackground`, `secondarySystemBackground`, `tertiarySystemBackground`), and the grouped trio for grouped tables.
- iOS, iPadOS: primary level is for the overall view, secondary for groups inside it, tertiary for groups inside those.
- iOS, iPadOS foreground colors: `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`, `placeholderText`, `separator`, `opaqueSeparator`, `link`.
- macOS: use semantic AppKit colors such as `labelColor`, `controlAccentColor`, `windowBackgroundColor`, `separatorColor` and `selectedContentBackgroundColor` instead of fixed values.
- macOS: set an app accent color for buttons, selection and sidebar icons; it applies only while the user's accent setting is multicolor, and a fixed-color sidebar icon keeps its color.
- tvOS: use a limited palette that coordinates with the logo, and never show focus by color alone; scaling and animation are the primary focus cues.
- visionOS: use color sparingly on glass, favor bold text and large areas, and keep brightness balanced in fully immersive scenes; avoid a bright, flashing or moving object on a very dark backdrop.
- watchOS: use background color to inform or place content, not as decoration, and avoid full-screen color in long-lived views like workouts or audio playback.
- watchOS: expect some wearers to choose tinted mode for graphic complications.
- System color specs: twelve hues (red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown) each have light, dark and increased-contrast values; iOS and iPadOS also have six gray levels, and visionOS uses the dark values. See the source page for the values.

## Dark Mode

Source: [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode). Applies to: iOS, iPadOS, macOS, tvOS.

Describes supporting the systemwide dark appearance. Use it when checking that an app, its colors and its assets look right in both light and dark. Not supported on visionOS or watchOS.

- Do not add an app-specific appearance switch; it forces extra settings and makes the app look broken when it ignores the system choice.
- Make the app work in both appearances, including Auto, which can switch while the app is running.
- Test legibility in both modes, including Increase Contrast and Reduce Transparency separately and together; dark text on dark backgrounds is the common failure.
- A permanently dark UI is acceptable in rare cases, such as immersive media viewing.
- Dark palettes use dimmer backgrounds and brighter foregrounds; some colors are inverted, some are not.
- Use semantic colors that adapt (`labelColor`, `controlColor` on macOS; `separator` on iOS and iPadOS). For custom colors, add a Color Set in the asset catalog with bright and dim variants; avoid fixed values.
- Never let contrast between colors fall below 4.5:1. (HG-37)
- For custom foreground and background colors, target 7:1, especially for small text. (HG-38)
- Slightly darken images with white backgrounds so they do not glow in dark surroundings.
- Use SF Symbols where possible; they adapt, and tinting with dynamic colors or vibrancy keeps them correct.
- Make separate light and dark interface icons if one version fails, such as adding a thin outline in only one mode.
- Check full-color images and icons in both modes; reuse one asset if it works, otherwise adapt it or make light and dark versions bundled in one named asset catalog image.
- Use the system label colors (primary through quaternary) for text.
- Draw text with system text views and controls so vibrancy and contrast are handled for you.
- iOS, iPadOS: the system switches between base (dimmer) and elevated (brighter) backgrounds to show layering; prefer system backgrounds so popovers, sheets, multitasking and windows keep that separation.
- macOS: with the graphite accent, window backgrounds pick up desktop color (desktop tinting). Give custom components with a visible background or bezel some transparency, only in neutral, uncolored states.

## Icons

Source: [Icons](https://developer.apple.com/design/human-interface-guidelines/icons). Applies to: all platforms.

Covers interface icons (glyphs) used for actions and modes, as opposed to app icons. Use it when creating custom glyphs or choosing symbols for common actions.

- Keep the design simple and recognizable, using familiar metaphors tied to the action or content.
- Match size, detail level, stroke weight and perspective across all interface icons in the app, adjusting dimensions where visual weight differs.
- Match icon weight to adjacent text unless you want to emphasize one.
- Add padding for optical centering of asymmetric icons, then center the padded asset geometrically; adjustments are tiny but visible.
- Make a selected-state icon only when needed; standard toolbars, tab bars and buttons handle selection automatically.
- Use inclusive imagery: gender-neutral figures and metaphors that travel across cultures and languages.
- Use text in an icon only when essential; localize any characters, and for suggested text passages use an abstract shape with a mirrored version for right-to-left contexts.
- Create custom icons as vector PDF or SVG so they scale automatically; PNG needs multiple resolutions. A custom SF Symbol with a matching scale is another option.
- Add alternative text (accessibility descriptions) to custom icons for VoiceOver.
- Do not depict Apple hardware; use Apple Design Resources images or SF Symbols for Apple products.
- Standard action symbols, part 1: `scissors` (cut), `document.on.document` (copy), `document.on.clipboard` (paste), `checkmark` (done), `xmark` (cancel), `trash` (delete).
- Standard action symbols, part 2: `arrow.uturn.backward` (undo), `arrow.uturn.forward` (redo), `square.and.pencil` (compose), `plus.square.on.square` (duplicate), `pencil` (rename), `folder` (move to), `paperclip` (attach), `plus` (add), `ellipsis` (more).
- Selection: select `checkmark.circle`, deselect `xmark`.
- Text formatting: `bold`, `italic`, `underline`, `textformat.superscript`, `textformat.subscript`, alignment `text.alignleft`, `text.aligncenter`, `text.justify`, `text.alignright`.
- Search: `magnifyingglass`; find `text.page.badge.magnifyingglass`; filter `line.3.horizontal.decrease`.
- Sharing: share `square.and.arrow.up`, print `printer`. Accounts: `person.crop.circle`. Ratings: `hand.thumbsup`, `hand.thumbsdown`.
- Layer order: `square.3.layers.3d.top.filled` (front), `square.3.layers.3d.bottom.filled` (back), `square.2.layers.3d.top.filled` (forward), `square.2.layers.3d.bottom.filled` (backward).
- Other: `alarm`, `archivebox`, `calendar`.
- macOS document icons: combine a background fill, a center image and a label as you like; the system composites them onto the folded-corner page shape. Without one, macOS composites your app icon and the extension.
- Use simple shapes and a small palette; document icons can render as small as 16x16 px, so they must stay recognizable at every size. (HG-39)
- Reduce complexity at small sizes, for example fewer, thicker grid lines at intermediate sizes and none at the smallest.
- The folded corner hides the upper-right area of the background fill, so put nothing important there.
- Background fill sizes: 512, 256, 128, 32 and 16 px squares at 1x, with 2x versions twice that. (HG-40)
- A center image is half the document icon canvas (for example 16x16 px for a 32x32 px icon), offered at 256, 128, 32 and 16 px at 1x and double at 2x. (HG-41)
- Leave about a 10% margin on the center image canvas and fill roughly 80%, so a 256x256 px canvas holds art in about 205x205 px. (HG-42)
- Supply a short descriptive term for unfamiliar extensions; it must be short enough to read at small sizes and is shown capitalized.

## Images

Source: [Images](https://developer.apple.com/design/human-interface-guidelines/images). Applies to: all platforms.

Explains how the system scales images and which formats and resolutions to deliver. Use it when preparing bitmap, vector or layered artwork for any device.

- A point is an abstract unit whose pixel count varies by display; on visionOS it is an angle, so size scales with viewing distance.
- Supply high-resolution bitmaps for each supported device and mark scale in the filename (`@1x`, `@2x`, `@3x`) in the asset catalog.
- iPadOS and watchOS need @2x; iOS needs @2x and @3x; macOS and tvOS need @1x and @2x; visionOS needs @2x or higher.
- Design at the lowest resolution and scale up; align vector control points to whole values at 1x so they stay on the pixel grid at 2x and 3x.
- Bitmaps: de-interlaced PNG; use an 8-bit palette when full 24-bit color is not needed.
- Photos: optimized JPEG or HEIC; stereo or spatial photos: stereo HEIC.
- Resolution-independent flat art, including glyphs and interface icons: PDF or SVG.
- Include a color profile with each image.
- Test images on real devices for pixelation, stretching or compression.
- tvOS: layered images drive the parallax effect (the focused item rises, sways and shines); a tvOS app icon must be layered, other focusable images including Top Shelf should be.
- tvOS layered images use two to five layers; use standard views and focus APIs such as `FocusState` so parallax is automatic. (HG-43)
- tvOS: foreground layers hold prominent items, middle layers hold shadows and secondary content, and an opaque backdrop sits behind; text normally belongs in front unless you mean to obscure it.
- tvOS: the background layer must be opaque or Xcode reports an error.
- tvOS: keep layering subtle, keep essential content in a safe zone because scaling can crop foreground layers, and preview in Xcode, Parallax Previewer or the Photoshop exporter, then on a real TV.
- tvOS: images fetched at runtime must be runtime layered images (`.lcr`) made with `layerutil`; do not embed them.
- visionOS: images are viewed at a wide range of sizes and angles and rescaled dynamically; use a layered app icon of two to three layers. (HG-44)
- visionOS: prefer vector art for 2D images and avoid bitmaps that blur when enlarged.
- visionOS: for rasters, trade quality against file size and speed; @2x is fine at normal distances but not close up, resolutions above @6x hurt performance, and anything over @2x needs high-quality filtering. (HG-45)
- visionOS spatial photos: stereo HEIC with spatial metadata; place text over them with the feathered glass background effect (`GlassBackgroundEffect`).
- visionOS: consider visual comfort before editing spatial metadata (such as disparity adjustment) of existing 2D content.
- visionOS: show spatial photos and spatial scenes in a standalone view such as a sheet or window; if stereoscopic images must be inline, leave generous space around them.
- visionOS: spatial scenes take several seconds to generate, so create them for specific moments or on explicit action, and avoid showing many at once.
- visionOS: when immersive, use minimal UI, and prefer larger spatial scenes centered in view so the parallax is noticeable.
- watchOS: avoid transparency to keep files small, except for template images such as complications and menu icons.
- watchOS: use an autoscaling PDF designed for 40mm and 42mm at 2x; scale is 90% at 38mm, 100% at 40mm, 106% at 41mm, 100% at 42mm, 110% at 44mm and 119% at 45mm and 49mm. (HG-46)

## Immersive experiences

Source: [Immersive experiences](https://developer.apple.com/design/human-interface-guidelines/immersive-experiences). Applies to: visionOS.

Covers designing visionOS apps that go beyond windows into Full Space, including immersion styles, comfort, transitions, virtual hands and custom environments. Not supported on other platforms.

- Remember that passthrough shows the real surroundings; the Digital Crown lets people recenter content (press and hold) or briefly reveal passthrough (double-click).
- In `mixed` style, content close to a person dims automatically when they near a real object.
- In `progressive` and `full` styles the system sets a boundary about 1.5 meters from the head's start position; approaching it fades the experience and increases passthrough, and beyond it the app icon replaces the visuals until the person returns or recenters. (HG-47)
- Dimmed or tinted passthrough (black by default, or a custom tint) focuses attention in either space type (`SurroundingsEffect`).
- `mixed` style blends content with passthrough and has no boundary; in a Full Space it can use ARKit for room and object data.
- `progressive` style partially replaces passthrough with a custom environment; the Digital Crown changes the amount of immersion across a default span of 120 to 360 degrees, or a span you define, and content can be portrait or landscape. (HG-48)
- `full` style replaces passthrough with a 360-degree environment.
- Offer several ways to use the app and support accessibility features.
- Prefer launching in the Shared Space or in `mixed` style so people can reference other apps and choose when to immerse.
- Reserve immersion for meaningful moments; for example browse in a window and go immersive only to examine one photo.
- Draw attention to key moments with subtle cues such as dimming, tinting, motion or scale, and strengthen them only with good reason.
- Use subtle passthrough tints (visionOS 2 and later); bright or dramatic tints distract and weaken immersion.
- Keep 3D content in the field of view and show motion comfortably.
- Choose an immersion style that fits the movement people may make; avoid `progressive` or `full`, or fall back to `mixed`, if people may need to move beyond the boundary.
- Do not encourage movement in progressive or full experiences; let people bring objects closer instead of walking to them.
- In `mixed` style, do not block too much of the passthrough view; use `full` or `progressive` if virtual objects would obscure it substantially.
- Use ARKit to blend content with surroundings or hand positions, and request permission for that sensitive data.
- Make immersion transitions gentle and trackable, never abrupt.
- Let people choose when to enter or leave immersion with a clear control, and do not make them rely on system controls to reduce it.
- Make an exit control's purpose clear: return to a less immersive context or quit; if exit also quits, offer pause or save first.
- Virtual hands: ask permission to hide real hands; match the wearer's hand positions and gestures; be cautious with oversized hands; when tracking drops, fade the virtual hands out and show the real ones, then fade back in.
- Environments: minimize distracting movement and high-contrast detail, and use detail and quality only in areas needing attention.
- Environments: make interactive objects distinguishable, since distance affects whether people try to touch them.
- Environments: keep animation subtle and away from the edges of the field of view.
- Environments: make them expansive; small enclosed ones feel claustrophobic.
- Environments: use Spatial Audio for atmosphere, avoid heavy repetition or loops, and lower or stop the soundscape if other audio plays.
- Environments: avoid a flat 360-degree image; prefer lit object meshes and shaders for subtle motion such as clouds or reflections.
- Environments: always add a ground plane mesh, even with a flat 360-degree image, so people do not feel they float.
- Environments: avoid reusing the same assets or models too often.

## Inclusion

Source: [Inclusion](https://developer.apple.com/design/human-interface-guidelines/inclusion). Applies to: all platforms.

Covers wording, imagery, and access so that people with different backgrounds and abilities can use and enjoy the app. Use it when writing copy, choosing pictures, collecting personal details, or preparing for localization.

- Question your own assumptions about how people with other backgrounds read your words and pictures. Aim for a welcoming experience, not just the absence of offensive content.
- Read your copy from several viewpoints. A scholarly tone can signal that only highly educated people are wanted; keep the tone clear, direct, and respectful.
- Speak to people as "you" and "your". Calling them "the user" or "the player" feels distant. Use "we" and "our" only for the software or company.
- Define specialized or technical terms before using them, make the definitions easy to find, and prefer plain words that also translate more easily.
- Swap idioms and slang for plain language. They are tied to one culture, are hard to translate, and some have exclusionary origins.
- Think twice before adding humor. It is subjective, translates poorly, and can confuse, tire, or offend people.
- Keep the interface clear and straightforward so no prior skill or knowledge is needed, and follow each platform's own conventions.
- Give newcomers a way to learn the app, such as a step-by-step onboarding flow that experienced people can skip.
- Remove needless gender references from copy. Prefer a plural or neutral noun over "his or her"; this also survives translation into languages with gendered pronouns.
- Avoid fixing a gender on avatars, emoji, glyphs, and game characters; let people customize them instead.
- Use a nongendered figure when you show a generic person. SF Symbols includes `figure` and `person` symbols for this.
- Ask for gender only when a health or legal reason requires it. If you ask, offer nonbinary, self-describe, and decline-to-answer options, and consider letting people state their pronouns.
- Show a range of people in text and pictures, varying ethnicity, body type, age, and ability. Do not limit roles to stereotypes, such as only male doctors and female nurses.
- Review the places, objects, and lifestyles you depict. Heavy displays of wealth can feel out of touch; prefer familiar, relatable settings.
- Check features for hidden assumptions, for example a family-account screen that only models one kind of family.
- Do not build prompts on experiences not everyone has, such as security questions about college or a first car. Use broadly shared prompts like a favorite activity.
- Support the system accessibility features: VoiceOver, Display Accommodations, captions, Switch Control, and Speak Screen.
- Do not assume a disability means someone won't want your app. Treat each disability as a spectrum, and remember temporary and situational limits such as a noisy train.
- Leave out images and wording that exclude people with disabilities, and never use a disability as a metaphor for something negative. Include people with disabilities when you depict a variety of people.
- Write about disability people-first: describe accomplishments and goals before a disability, and ask individuals or communities how they describe themselves.
- Favor simple, familiar, consistent interactions, and make content perceivable through sight, hearing, or touch.
- Prepare for internationalization so people can pick a language and a region for dates, times, and money, then supply localized text and resources.
- Use plain language, neutral wording, varied people, and little culture-specific content to ease localization. Use SF Symbols for glyphs, including ones that serve either reading direction.
- Check what each color means in every locale you ship. White can signal grief in one place and purity in another, so keep color-coded messages consistent across versions.

## Layout

Source: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout). Applies to: all platforms, with extra notes for macOS, tvOS, visionOS, and watchOS.

Governs how content is arranged and how it adapts to screen sizes, windows, orientations, and text sizes. Use it for any screen structure, responsive behavior, safe areas, or spacing decision.

- Order content by importance. Place key items first in reading order: high on the screen and on the leading side.
- Prefer standard system components so layouts flip correctly for right-to-left languages.
- Align related elements so they scan easily, and indent subordinate items. People read aligned items as related and indented items as children.
- Group related items using whitespace, container shapes, or separator lines so the grouping is visible.
- Reveal content gradually to avoid overload. Use disclosure triangles, menus, nested views, or scrolling sections to hold back secondary content.
- Let controls look different from content with Liquid Glass. Do not place a solid or semi-opaque color behind controls; use a scroll edge effect to lift them above content.
- Extend full-screen background content beneath sidebars, toolbars, and tab bars so it fills the whole screen or window.
- When sidebars or inspectors would hide key parts of a scaled background image, mirror and blur the image under them with `backgroundExtensionEffect()` or `UIBackgroundExtensionView`.
- Use SwiftUI or Auto Layout so the interface adapts to size classes, screen sizes, orientation and aspect ratio, the Dynamic Island, external displays, Display Zoom, resizable windows, text-size changes, and locale effects such as layout direction and text length.
- Respect safe areas, margins, and layout guides, and use layout modifiers to fine-tune placement.
- Make an orientation-locked app, such as a landscape-only game, still resize well across devices and window sizes.
- Support Dynamic Type in layouts. Stack horizontally adjacent views vertically when space runs short, let rows grow taller, and allow single-line rows to wrap to several lines so text is never cropped or overlapped.
- In a Unity game, use Apple's accessibility plug-in for Dynamic Type.
- Preview on several devices, size classes, localizations, and text sizes. Test the largest and smallest layouts first, and use Device Hub to catch clipping, including iPad resizing and iPhone Mirroring on Mac.
- When a display change would crop or letterbox background art, keep its aspect ratio and scale it to fill the screen. Very wide or very tall windows may need art that extends beyond a typical view.
- iOS, iPadOS: Choose layouts from size classes (compact or regular, horizontal and vertical), not from device type or orientation, because size classes describe the space actually available. Observe them with `UITraitChangeObservable` and `UserInterfaceSizeClass`.
- iOS, iPadOS: Plan for every size-class combination, including iPad windows resized to regular height or regular width, rather than only compact portrait or landscape iPhone.
- iOS, iPadOS: Do not change what the app can do when size classes change. Vary only how much is visible, for example swapping a tab bar for a sidebar or exposing items that would otherwise sit in an overflow menu.
- iOS, iPadOS: Keep the layout recognizable for the device's idiom even when the window is resized.
- Use predefined or custom layout guides (`UILayoutGuide`, `NSLayoutGuide`) for standard margins and for limiting text width to a readable measure.
- Keep content and controls inside the safe area so toolbars, tab bars, status bars, and hardware features such as the Dynamic Island never cover them.
- macOS: Do not put controls or critical information along the bottom edge of a window; people often drag windows partly below the screen.
- macOS: Keep content out of the area under the camera housing along the window's top edge (`NSPrefersDisplaySafeAreaCompatibilityMode`).
- tvOS: Inset primary content from the top and bottom screen edges: 60 points (HG-49)
- tvOS: Inset primary content from the left and right screen edges: 80 points (HG-50)
- tvOS: Leave padding between focusable elements, because focused items grow. Check that a focused item never covers important information.
- tvOS: In grids, use fixed spacing between unfocused rows and columns so nothing overlaps on focus. `UICollectionViewFlowLayout` picks the column count from width and spacing.
- tvOS: A two-column grid uses 860 pt wide unfocused items. (HG-51)
- tvOS: A three-column grid uses 560 pt wide unfocused items. (HG-52)
- tvOS: A four-column grid uses 410 pt wide unfocused items. (HG-53)
- tvOS: A five-column grid uses 320 pt wide unfocused items; see the source page for six to nine columns. (HG-54)
- tvOS: Every grid shown there puts horizontal spacing between items: 40 pt (HG-55)
- tvOS: Every grid shown there keeps a minimum vertical gap between rows: 100 pt (HG-56)
- tvOS: For a titled row, leave room between the previous row's bottom and the title's center, and between the title's bottom and the row's items.
- tvOS: Space items evenly so the grid reads as a grid. Show equal slivers of partly hidden content on both sides of the screen.
- visionOS: Support window and volume resizing, and center content horizontally once the window gets very large.
- visionOS: Set minimum and maximum sizes only to prevent overlap at small sizes or unwieldy layouts at large ones, never to block resizing.
- visionOS: Use 3D content inside windows sparingly and inset from the edges. Use a volume or immersive space for larger or mostly 3D content.
- visionOS: Open supplemental content in an adjacent window (`defaultWindowPlacement(_:)`) rather than an ornament; keep ornaments for app-specific controls such as toolbars and playback controls.
- visionOS: Give controls enough room that hover effects do not hide neighbors; place button centers at least this far apart: 60 points (HG-57)
- watchOS: In one row, show at most three glyph buttons or two text buttons. Prefer full-width text buttons; two short side-by-side text buttons are fine on a screen that does not scroll.
- watchOS: Support autorotation (`isAutorotating`) on views people may show to others, such as an image or QR code.

## Materials

Source: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials). Applies to: all platforms.

Describes Liquid Glass and standard materials that separate controls and content by depth. Use it when choosing blur, translucency, vibrancy, or backgrounds for custom components.

- Use Liquid Glass for the functional layer of controls and navigation, such as tab bars and sidebars, floating above content. Do not use it in the content layer; use standard materials there.
- The exception is a transient interactive control in the content layer, such as a slider or toggle, which may take on Liquid Glass while a person is activating it.
- Apply Liquid Glass to custom controls sparingly and only for the most important functional elements. Standard system components pick it up automatically.
- Pick the regular Liquid Glass variant when background content could hurt legibility or the component holds a lot of text, as in alerts, sidebars, and popovers.
- Pick the clear variant only for components floating over visually rich media such as photos or video.
- Expect both variants to change with system settings, including a preferred glass look and settings that reduce transparency or raise contrast.
- Place a dimming layer behind clear glass over bright content, at this opacity: 35% (HG-58)
- Skip the dimming layer when the content below is dark enough or when AVKit playback controls already add their own.
- Use standard materials and effects (`UIBlurEffect`, `UIVibrancyEffect`, `NSVisualEffectView.BlendingMode`) to give structure to content beneath Liquid Glass.
- Choose a material by its meaning and recommended use, not by the color it appears to add; system settings can change its look.
- Draw text and fills in system vibrant colors on top of any material so contrast holds in every context.
- Trade thickness against context: thicker materials give fine text better contrast, thinner ones keep the background visible.
- iOS, iPadOS: Content-layer materials come in four thicknesses: ultra-thin, thin, regular (default), and thick.
- iOS, iPadOS: Use vibrancy styles matched to the material: `UIVibrancyEffectStyle.label`, `.secondaryLabel`, `.tertiaryLabel`, and `.quaternaryLabel` for labels; `.fill`, `.secondaryFill`, and `.tertiaryFill` for fills; `.separator` for separators. Avoid quaternary labels on thin and ultra-thin materials.
- macOS: Use the purpose-specific materials in `NSVisualEffectView.Material` and decide per custom view whether vibrancy helps; test in many contexts.
- macOS: Choose a blending mode that suits the design, either behind window or within window.
- tvOS: Liquid Glass appears in navigation and system experiences, and focused images and buttons adopt it.
- tvOS: Use ultraThin for full-screen views needing a light scheme, thin for partial overlays needing a light scheme, regular for partial overlays, and thick for partial overlays needing a dark scheme.
- visionOS: Windows use the system glass material, which cannot be modified. Prefer translucency over opaque color so people stay aware of their surroundings.
- visionOS: For custom components, use thin to highlight interactive or selected items, regular to separate sections such as sidebars or grouped tables, and thick for a dark element on top of a regular background.
- visionOS: Use `UIVibrancyEffectStyle.label` for standard text, `.secondaryLabel` for footnotes and subtitles, and `.tertiaryLabel` only for inactive items that need little legibility.
- watchOS: Keep the default material backgrounds on full-screen modal sheets rather than removing or replacing them.

## Motion

Source: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion). Applies to: all platforms, with extra notes for visionOS and watchOS.

Sets rules for custom animation: when to use it, how to keep it comfortable, and how to make it optional. Use it when adding transitions, feedback animation, or game motion.

- Add motion only when it supports the experience. Excess animation distracts and can make people uncomfortable.
- Make motion optional. Never rely on it alone for important information; add haptics or audio as alternatives.
- Make feedback motion follow gestures realistically. A view that slides in from the top should not dismiss by sliding sideways.
- Keep feedback animations short and precise so they read as light and unobtrusive.
- Avoid adding motion to frequent interactions with custom elements, since people must watch it every time.
- Let people cancel or skip animation instead of making them wait, especially for repeated animations.
- Consider animated SF Symbols (SF Symbols 5 or later) where they fit.
- Games: Make motion look good by default on each platform, using the device's graphics capability.
- Games: A steady frame rate in this range usually looks smooth: 30 to 60 fps (HG-59)
- Games: Let people tune visuals for performance or battery life, for example switching power modes when plugged in.
- visionOS: Keep motion away from the edges of the field of view, since peripheral motion distracts and can cause discomfort. If an object must move there in an immersive scene, match its brightness to the rest of the view.
- visionOS: When a large virtual object moves, raise its translucency or lower its contrast so people do not feel they are moving. For moving windows, also keep the size fairly small.
- visionOS: When relocating an object without useful movement, fade it out, move it, and fade it in.
- visionOS: Do not let people rotate a virtual world. Use instant direction changes during a quick fade-out instead.
- visionOS: Provide a stationary frame of reference, so the whole surrounding area is never moving.
- visionOS: Avoid sustained oscillation near this frequency, which people are very sensitive to. If you must oscillate, use low amplitude and translucent content: 0.2 Hz (HG-60)
- watchOS: Use SwiftUI for animation, or WatchKit (`WKInterfaceImage`) for layout and appearance changes and image sequences. Built-in easing at the start and end of layout and appearance animations cannot be turned off or customized.

## Privacy

Source: [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy). Applies to: all platforms, with extra notes for macOS and visionOS.

Covers asking for permission, explaining data use, and protecting stored data and sign-in. Use it when adding any feature that touches personal data, device capabilities, or authentication.

- Ask only for data a feature needs, and make each request as specific as possible. Asking early or for more than needed erodes trust.
- Explain how you collect and use data. Respect people's use of Hide My Email, plus Mail Privacy Protection, and know what app tracking requires of you.
- Provide privacy details for the App Store product page and keep them current in App Store Connect.
- Process data on the device where possible, for example with the Neural Engine or Create ML models, to avoid server round trips.
- Adopt system privacy protections and security best practices, such as CloudKit encryption and key management.
- Request permission for personal data (location, health, financial, contacts), user-generated content (mail, messages, calendar, photos, audio, video, HomeKit, Apple Music activity), protected resources (Bluetooth, home automation, Wi-Fi, local networks), camera and microphone, and the advertising identifier.
- visionOS: Request permission for ARKit data (hand tracking, plane estimation, image anchoring, world tracking) when running in a Full Space.
- Ask at the moment a feature needs access, not earlier. The Location button is one way to ask after a person shows interest.
- Avoid launch-time requests unless the app cannot work without the data, as with a navigation app needing location.
- Write the purpose string as one brief, active, specific sentence in sentence case with a period, saying why the app needs the access. Do not use passive vagueness or bare commands.
- Pre-alert screens: Show one button only, and title it "Continue" or "Next" rather than "Allow", so it clearly leads to the system alert.
- Pre-alert screens: Offer no close, cancel, or other way out that skips the system alert, except where legal consent requires it.
- Tracking: If tracking starts at launch, show the system alert before collecting any tracking data.
- Tracking: Never place a screen before the system alert that could mislead people. Prohibited designs include offering incentives, imitating the request, picturing the alert, and marking up the background behind it. Consent screens required by local privacy law are allowed.
- iOS, iPadOS, watchOS: Offer the Location button (`LocationButton` in SwiftUI, `CLLocationButton`) for one-time location sharing tied to a specific task.
- Customize the location button only through the allowed options: system title, filled or outlined glyph, background and content colors, and corner radius.
- Ensure the button label is never cut off, at any accessibility text size or in any translation, and fix any contrast or translucency warnings. If problems persist, the button will not grant location access.
- Avoid relying on passwords alone; use passkeys, or add two-factor authentication, and protect logged-in apps with Face ID, Optic ID, or Touch ID.
- Keep sensitive data in the keychain, never in plain-text files.
- Avoid inventing custom authentication. Prefer system options: passkeys, Password AutoFill, or Sign in with Apple.
- macOS: Sign apps distributed outside the store with a valid Developer ID.
- macOS: Use app sandboxing, which is required for the Mac App Store.
- macOS: Do not assume who is signed in; fast user switching can leave several people active.
- visionOS: ARKit data reaches apps only through a Full Space, and these need the person's consent: hand tracking, image anchoring, plane estimation, and scene reconstruction.
- visionOS: Rely on system hover effects from SwiftUI or RealityKit components, which show gaze feedback without revealing where someone looks.
- visionOS: The front camera needs permission and the back camera gives blank input. Remove camera features from ported apps or let people import content instead.

## Right to left

Source: [Right to left](https://developer.apple.com/design/human-interface-guidelines/right-to-left). Applies to: all platforms.

Explains how to mirror an interface for languages such as Arabic and Hebrew. Use it when fine-tuning layout, text, numbers, controls, images, or icons for right-to-left locales.

- Rely on system frameworks and standard layouts, which flip automatically for right-to-left.
- When the system does not do it, mirror text alignment with the interface direction.
- Align a paragraph of three or more lines by its own language rather than the interface direction; keep one- and two-line blocks matched to the context.
- Use one alignment for every item in a list, flipping all of them, even items in another script.
- Check number systems per locale. Hebrew uses Western Arabic numerals; Arabic may use Western or Eastern, varying by region. Number-heavy apps should pick locale-appropriate forms; others can use system formatting.
- Keep the digit order of any single number fixed, whether a quantity like 541, a phone number, or a card number.
- When numerals label a flipped control or a sequence, reorder them to follow the new direction, but never mirror the digit shapes.
- Flip controls that show progress between values, such as sliders and progress indicators, and swap the glyphs or images marking the start and end.
- Flip navigation controls with a fixed order: a back button points right, and next and previous buttons follow reading order.
- Keep controls that mean a real direction or point at a screen area unflipped; a "to the right" control always points right.
- Balance Arabic or Hebrew text beside all-caps Latin text, since the former has no capitals. Raise the right-to-left font size by about this amount: 2 points (HG-61)
- Do not flip photographs, illustrations, or general artwork; flipping can change meaning or infringe copyright. Make a new version if the content depends on reading direction.
- Reverse the positions of images shown in a meaningful order, such as chronological, alphabetical, or favorites.
- Use SF Symbols for icons to get right-to-left variants and localized symbols; for custom symbols, specify directionality.
- Flip icons that represent text or reading direction, such as left-aligned bars standing in for text.
- Make localized versions of icons that show actual letters or words, such as signature, rich text, or the I-beam pointer. For icons using text for unrelated concepts, design a text-free alternative.
- Flip icons showing forward or backward motion, such as a speaker with sound waves coming from the leading side.
- Do not flip logos or universal marks such as the checkmark.
- Do not flip icons of real-world objects unless direction matters. A clock stays the same, and right-handed tools need no flipping.
- Before flipping a complex custom icon, examine its parts. Keep a consistent component such as the prohibition slash, flip a badge that mirrors real UI, and rebalance a badge that would unbalance the icon. Preserve a tool's handedness while flipping the base.

## SF Symbols

Source: [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols). Applies to: all platforms.

Describes the SF Symbols library: rendering modes, weights and scales, variants, animations, and custom symbols. Use it when picking or building interface icons that must match text.

- Check availability: symbols and features only exist on the system versions that introduced them.
- Do not use symbols, or lookalikes, in app icons, logos, or other trademarked uses.
- Choose among four rendering modes: monochrome (one color), hierarchical (one color at varying opacity per layer), palette (two or more colors, one per layer), and multicolor (built-in colors like green for `leaf`).
- A symbol splits into primary, secondary, and tertiary layers; for example `cloud.sun.rain.fill` has cloud, sun, and rain layers.
- With palette mode and fewer colors than layers, the later layers share the last color.
- Use system-provided colors so symbols adapt to accessibility settings, vibrancy, and Dark Mode.
- Verify the rendering mode in each context; automatic gives a preferred mode, but legibility depends on size and background.
- SF Symbols 7 and later: Use gradient rendering, a linear gradient from one source color, in any rendering mode and for custom symbols. It looks best when large.
- Use variable color to show a changing value like capacity or strength, coloring layers as thresholds are crossed. Exclude layers that should not change, such as the speaker body in `speaker.wave.3`.
- Never use variable color to convey depth; use hierarchical rendering for that.
- Match symbol weight to adjacent text; there are nine weights from ultralight to black, matching San Francisco.
- Pick among three scales (small, medium default, large), defined relative to cap height, to adjust emphasis without breaking weight matching. Use `imageScale(_:)`, `UIImage.SymbolScale`, or `NSImage.SymbolConfiguration`.
- Use variants to express state: slash for unavailable, fill for selected, and enclosed shapes to aid small-size legibility.
- Use outline beside text in toolbars and lists; use fill for iOS tab bars, swipe actions, and accent-colored selection. The containing view often picks the variant for you.
- Use script-specific variants covering Latin, Arabic, Hebrew, Hindi, Thai, CJK, Cyrillic, Devanagari, and Indic numeral systems; they switch automatically with device language.
- Animation effects: appear, disappear, bounce (once by default), scale (persists), pulse (opacity), variable color (cumulative or iterative, open or closed loop), replace (down-up, up-up, off-up), Magic Replace (default, related shapes), wiggle, breathe, rotate (whole or by layer), and draw on or off (SF Symbols 7 and later).
- Use animation sparingly and with a clear purpose, matched to the symbol's meaning and the app's tone.
- Use symbol animation to give compact feedback or show ongoing activity.
- Create custom symbols from the exported template of a similar symbol. Match detail, weight, alignment, and perspective, and keep them simple, recognizable, inclusive, and related to the action.
- Do not customize symbols that depict Apple products or features, marked with an Info badge, and do not design Apple product replicas.
- Annotate layers with a color or hierarchy level to support several rendering modes.
- Add negative side margins named like `left-margin-Regular-M` to align symbols with badges.
- Annotate layers for animation, set z-order for variable color direction, group related layers, and test every animation preset. Draw whole shapes and use an erase layer instead of cutouts.
- Use the component library for enclosures and badges rather than building those variants yourself.
- Give custom symbols alternative text labels for VoiceOver.

## Spatial layout

Source: [Spatial layout](https://developer.apple.com/design/human-interface-guidelines/spatial-layout). Applies to: visionOS only.

Covers placing content in space on Apple Vision Pro: field of view, depth, scale, and comfort. Use it when designing windows, volumes, and immersive scenes for visionOS.

- Center important content in the field of view, and in immersive scenes keep the edges free of distracting movement and of bright, stark objects. The system does not report field of view.
- Anchor content in space, not to the wearer's head, so people can look around freely.
- Provide visual cues that match real-world depth; missing or conflicting cues cause discomfort.
- Add small amounts of depth throughout the interface, even in standard windows; SwiftUI adds depth effects to 2D views. Use RealityKit objects or volumes for more.
- Use depth for hierarchy, such as a sheet moving a window back along the z-axis.
- Do not give text depth, since text hovering above a background is harder to read.
- Use depth only where it clarifies. It suits large elements like toolbars but can hurt small ones like button symbols. Vary depths sparingly, since eyes must refocus for each change.
- Dynamic scale keeps windows looking the same size at any distance. Fixed scale makes objects shrink with distance, so use it sparingly and only for noninteractive objects such as a life-size product.
- visionOS defines a point as an angle, not a pixel count, which enables dynamic scaling.
- Avoid showing too many windows; they obscure surroundings and are hard to relocate.
- Prioritize indirect gestures, which work on anything the person looks at; reserve direct gestures for nearby objects needing short close handling.
- Rely on the Digital Crown for recentering; your app needs no extra support.
- Leave room around interactive components so the hover effect doesn't crowd neighbors: place regular-size buttons with centers at least this far apart: 60 points (HG-62)
- Also leave this much gap between those controls: 16 points (HG-63)
- Keep controls from overlapping other interactive elements or views; overlap makes picking one hard.
- Let people use the app with little or no physical movement unless movement is essential.
- For large immersive scenes with floor-based content, align a flat horizontal plane with the floor.

## Typography

Source: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography). Applies to: all platforms, with notes for iOS, iPadOS, macOS, tvOS, visionOS, and watchOS.

Covers type sizes, weights, hierarchy, system and custom fonts, and Dynamic Type. Use it for any text styling, font choice, or layout that must scale with text size.

- Follow default and minimum sizes for system and custom fonts. iOS and iPadOS default: 17 pt (HG-64)
- iOS and iPadOS minimum text size: 11 pt (HG-65)
- macOS default text size: 13 pt (HG-66)
- macOS minimum text size: 10 pt (HG-67)
- tvOS default text size: 29 pt (HG-68)
- tvOS minimum text size: 23 pt (HG-69)
- visionOS default text size: 17 pt (HG-70)
- visionOS minimum text size: 12 pt (HG-71)
- watchOS default text size: 16 pt (HG-72)
- watchOS minimum text size: 12 pt (HG-73)
- Thin custom fonts need sizes above these minimums. Test legibility in real contexts, and raise size, contrast, or use system fonts if text is hard to read.
- Avoid ultralight, thin, and light weights, especially small; prefer regular, medium, semibold, or bold.
- Express hierarchy with weight, size, and color, and keep relative distinctions when people change text size.
- Limit typefaces; too many muddy hierarchy and consistency.
- When text grows, enlarge the content people care about, not everything. Tab titles need not grow; character dialog may matter more than hit-damage numbers.
- Choose San Francisco (variants: Pro, Compact, Arabic, Armenian, Georgian, Hebrew, Mono, plus rounded versions) or the serif New York.
- Get system fonts through `Font.Design` constants (default for system, serif for New York), and never embed them.
- Rely on dynamic optical sizes in the variable fonts; discrete Text and Display sizes matter only in design tools lacking variable support.
- Use built-in text styles for hierarchy and scaling with Dynamic Type; each pairs weight, size, and leading.
- Modify styles with symbolic traits: bold for another level (`bold()` in SwiftUI, `traitBold` in UIKit), loose leading for wide columns or long passages, tight leading for constrained rows. Avoid tight leading with three or more lines (`leading(_:)`).
- In mockups, adjust tracking by size; the running system adjusts it automatically.
- Make custom fonts legible and give them Dynamic Type and Bold Text behavior. In Unity use Apple's plug-ins or offer another size control.
- Dynamic Type exists in iOS, iPadOS, tvOS, visionOS, and watchOS. Verify at all sizes, including Larger Accessibility Text Sizes in Settings.
- Scale meaningful interface icons with font size; SF Symbols do this automatically.
- Keep truncation minimal. At the largest accessibility size aim to show as much useful text as at the largest standard size, avoid truncating scrollable text, and let labels use multiple lines (`numberOfLines`).
- At large sizes, stack secondary items below text and cut the number of text columns (`isAccessibilityCategory`).
- Keep the same hierarchy at every size, with primary elements staying near the top.
- iOS, iPadOS: The system font is SF Pro, and NY is available.
- iOS, iPadOS: At the default size, Body is regular weight at this size and leading: 17 pt / 22 pt (HG-74)
- iOS, iPadOS: Large Title at default size: 34 pt / 41 pt (HG-75)
- iOS, iPadOS: Caption 2 at default size; see the source for all sizes and the AX1 to AX5 tables. (HG-76)
- macOS: The system font is SF Pro, NY works with Mac Catalyst, and Dynamic Type is unsupported. Use dynamic font variants such as `controlContentFont(ofSize:)`, `labelFont(ofSize:)`, `menuFont(ofSize:)`, `menuBarFont(ofSize:)`, `messageFont(ofSize:)`, `paletteFont(ofSize:)`, `titleBarFont(ofSize:)`, `toolTipsFont(ofSize:)`, `userFont(ofSize:)`, and `userFixedPitchFont(ofSize:)` to match system controls.
- macOS: Body text style size and line height: 13 pt / 16 pt (HG-77)
- macOS: Large Title size and line height: 26 pt / 32 pt (HG-78)
- tvOS: SF Pro is the system font and NY is available; Body is medium weight at this size and leading: 29 pt / 36 pt (HG-79)
- visionOS: SF Pro is the system font; specify type styles for NY. Dynamic Type body and title styles are bolder, and Extra Large Title 1 and 2 exist for editorial layouts.
- visionOS: Prefer 2D text with little or no visual depth.
- visionOS: Test scaled text for legibility, using a text style that works at full scale.
- visionOS: Maximize text contrast with its container; white default text suits the default material. Test other colors.
- visionOS: For text without a background, use bold and avoid shadows.
- visionOS: Use billboarding for labels tied to points in space so they face the wearer.
- watchOS: SF Compact is the system font, with SF Compact Rounded in complications, and NY is available.
- watchOS: Body at the large size (40/41/42 mm) is this size and leading. (HG-80)
- Tracking: SF Pro tracking is positive at small sizes and falls to zero at 12 points. (HG-81)
- Tracking: SF Pro reaches its tightest value at 17 points. (HG-82)
- Tracking: At large sizes, SF Pro returns to zero: 80 pt (HG-83)
- Use the source tables for SF Pro Rounded, New York, macOS, tvOS, SF Compact, and SF Compact Rounded tracking.

## Writing

Source: [Writing](https://developer.apple.com/design/human-interface-guidelines/writing). Applies to: all platforms.

Guides the words in an interface: voice, tone, labels, errors, empty states, and settings. Use it when drafting any UI text.

- Set a voice from your audience and values, and keep a list of common terms so language stays consistent.
- Match tone to context: serious for a payment error, light for a goal reached.
- Be clear. Cut unneeded words, and read the text aloud when unsure.
- Write simply for everyone, with accessibility and localization in mind. Avoid jargon and gendered terms.
- Order each screen by importance, format for readability, and split multiple ideas across screens.
- Use verbs on buttons and links; prefer "Send" to something cute. Replace "Click here" with descriptive link text for screen readers.
- Build consistent language patterns.
- Pick a capitalization style per element type and apply it consistently; title case is formal, sentence case casual.
- In multistep flows, start with "Get Started", use consistent "Continue" or "Next" labels, and end with "Done".
- Use possessives sparingly; "Favorites" beats "Your Favorites". If you use them, be consistent. Avoid "we", particularly in errors; "Unable to load content" is clearer.
- Adapt wording per device and describe gestures correctly: "tap" on touch devices, not "click". Be brief on small screens and on TVs, which need large text and shared audiences.
- In empty states, give clear next steps with a button or link, and do not put crucial information there.
- Write helpful errors: avoid them where possible, show them near the problem, avoid blame, say how to fix it, state the actual requirement, and skip "oops" or "uh-oh". If language cannot fix a widespread error, redesign the interaction.
- Pick a delivery method by urgency, importance, and context: notification, alert, or action sheet.
- Keep settings labels simple. Explain what a setting does when on, and link directly to a setting instead of describing where it lives.
- Label every text field and add hint text with an example or description. Show errors next to the field and explain the correct input instead of scolding; avoid robotic messages like "Invalid name".
