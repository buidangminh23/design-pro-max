# Inputs

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Action button
- Apple Pencil and Scribble
- Camera Control
- Digital Crown
- Eyes
- Focus and selection
- Game controls
- Gestures
- Gyroscope and accelerometer
- Keyboards
- Nearby interactions
- Pointing devices
- Remotes

## Action button

Source: [Action button](https://developer.apple.com/design/human-interface-guidelines/action-button). Applies to: iOS, watchOS.

Covers the hardware button that people map to a quick function on supported iPhone and Apple Watch Ultra models. Read it when an app exposes actions to that button through App Shortcuts.

- Offer a small set of the app's most-used actions for the button, such as starting a timer in a cooking app.
- Skip an action that merely opens the app. The system already provides that, and icons, widgets and complications cover it.
- Write each action label so it starts with a verb, uses present tense, uses title-style capitalization and omits articles and prepositions.
- Keep each action label to three words or fewer, for example "Start Race" rather than "Start the Race". (HG-166)
- Let the system teach people how to assign and use the button. Do not add your own text that repeats the Settings guidance.
- iOS: Let an action finish without pulling people out of their current context, using Live Activities or custom snippets. A timer action, for instance, asks for a duration and starts a countdown Live Activity instead of launching the Clock app.
- watchOS: The first press can start a workout, begin a dive or drop a waypoint. Design later presses to flow logically from the first one, since people often press without looking.
- watchOS: Consider adding one simple secondary function for workout or dive actions, such as marking a segment or moving to the next phase. Think hard before adding more than one, since extra functions raise cognitive load and make the app seem harder to use.
- watchOS: Use follow-up presses to add capability, not to end the main task. Put a stop control in the app's own interface.
- watchOS: Pause the current function when the Action button and side button are pressed together. The exception is a diving app, where pausing could endanger the diver by hiding depth or elapsed time.
- Not supported on iPadOS, macOS, tvOS or visionOS.

## Apple Pencil and Scribble

Source: [Apple Pencil and Scribble](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble). Applies to: iPadOS.

Covers drawing, marking, hover, double tap, squeeze, barrel roll and handwriting-to-text input on iPad. Read it when an iPad app accepts Apple Pencil input or has text fields.

- Support what people expect from a physical pen or pencil, such as writing in margins of a document.
- Make every control respond to Pencil taps so people never have to switch to a finger. A control that ignores Pencil looks broken or like a dead battery. Scribble itself works only with Pencil.
- Start a mark the instant the tip touches the screen. Never require a button press or a special mode first.
- Use tilt (altitude), pressure (force), azimuth and barrel roll to shape strokes. Map pressure to continuous properties such as opacity or brush size and keep the mapping simple.
- Make the Pencil appear to act directly on the content under its tip, not on distant parts of the screen.
- Keep controls reachable for left- and right-handed people, avoid spots a hand would cover, and let people move controls that might be hidden.
- Hover: Show a preview of the mark the current tool will make so people can predict the result.
- Hover: Do not keep changing the preview as the Pencil moves nearer or farther. Height-dependent changes add noise without clarifying anything.
- Hover: Never start an action from hover alone, especially a destructive one. Hovering is imprecise.
- Hover: Preview a mid-range value for dynamic properties such as opacity or flow, because extremes either cover the canvas or vanish.
- Hover: Consider showing a nearby contextual menu, such as tool sizes, when hover combines with a squeeze or a keyboard modifier.
- Hover: Show Pencil hover previews only for the Pencil, not for a mouse or trackpad pointer.
- Double tap: Honor the person's system choice (switch to eraser, switch to previous tool, show or hide color picker, or nothing) whenever it makes sense in the app.
- Double tap: If the app needs different behavior, use it to toggle an interaction mode, such as raise versus lower in a mesh tool.
- Double tap: Add a visible control for selecting a custom double-tap mode, make the mode discoverable, and leave it off by default.
- Double tap: Do not make it modify content or cause data loss. Accidental double taps happen and may go unnoticed. Prefer easily undone actions.
- Squeeze (Apple Pencil Pro): Treat it as one quick, discrete gesture. Holding or repeating squeezes is tiring.
- Squeeze: Show any resulting UI, such as a menu, close to the Pencil tip and promptly. Squeeze works only with the screen on and the Pencil not touching it, so people may not be looking.
- Squeeze: Bind only nondestructive, easily undone actions. People may also assign squeeze to an App Shortcut.
- Barrel roll: Use it only to change how marks are made, such as rotating a highlighter angle, never for navigation or showing controls.
- Scribble: Let people write anywhere text is accepted, with no tapping or mode switch. Standard text fields, text views, search fields and web editable fields work by default, except password fields.
- Scribble: Do not force a custom text field to be tapped or selected before writing begins.
- Scribble: Offer writing in places where it feels natural even without a field, like blank space under the last reminder in a list.
- Scribble: Do not show autocompletion text while people write, and hide placeholder text as soon as writing begins.
- Scribble: Keep the field still while people write. If a move or resize is unavoidable, wait for a pause.
- Scribble: Do not autoscroll text during writing or selecting, which can make people select the wrong range.
- Scribble: Give fields enough room. When Pencil input is likely, enlarge a field before writing starts or during a pause, never mid-stroke.
- Custom drawing (PencilKit): Disable dynamic dark-mode color adjustment when people draw over existing content such as a PDF or photo, so markup stays visible.
- Custom drawing: In a compact environment the tool picker has no undo or redo, so add toolbar buttons and consider the three-finger undo and redo gesture.
- Not supported on iOS, macOS, tvOS, visionOS or watchOS.

## Camera Control

Source: [Camera Control](https://developer.apple.com/design/human-interface-guidelines/camera-control). Applies to: iOS.

Covers the iPhone 16 hardware control that opens a camera app and adjusts values through an on-screen overlay. Read it when building a camera experience that adds sliders or pickers to that overlay.

- Pick the right control type: a slider for a range of values (such as contrast) or a picker for discrete options (such as a grid toggle).
- Choose symbols from SF Symbols to represent each control. Custom symbols are not supported, and the symbol does not show state.
- Keep control names short because labels follow Dynamic Type and can cover the viewfinder.
- Add units or symbols (EV, %, or a custom string) to slider values so their meaning is clear, for example with `localizedValueFormat`.
- Define prominent values (`prominentValues`) for sliders, such as common or evenly spaced zoom steps, so sliding lands on them easily.
- Leave room for the overlay next to the Camera Control, whichever way the phone is held. Keep your own UI out of that area and let the overlay appear over a maximized viewfinder.
- Keep the viewfinder clean. Do not duplicate sliders or toggles in your own UI while the overlay shows them.
- Enable or disable controls according to camera mode, such as disabling video controls for photos. Controls cannot be added or removed at runtime.
- Put the most-used controls in the middle and rarer ones on the sides. The system reopens on the last control used.
- Provide a locked camera capture extension so people can launch your camera from the lock screen, Home Screen or inside other apps with the Camera Control.
- Not supported on iPadOS, macOS, watchOS, tvOS or visionOS.

## Digital Crown

Source: [Digital Crown](https://developer.apple.com/design/human-interface-guidelines/digital-crown). Applies to: watchOS, visionOS.

Covers the crown as a hardware input. On Apple Watch it is the main navigation input and apps can read its rotation; on Apple Vision Pro it is system-level only.

- visionOS: Treat the crown as system-owned. It adjusts volume and immersion, recenters content, opens Accessibility settings and exits to Home, and apps receive no direct crown data.
- watchOS: Presses are reserved for the system, such as showing the Home Screen. Apps respond only to rotation.
- watchOS: Anchor navigation to the crown. From watchOS 10 it scrolls lists and switches vertically paginated tabs. Keep list, tab and scroll views vertical, and always back crown actions with touch equivalents.
- watchOS: Use the crown to inspect data when navigation is not needed, as World Clock does when it advances the time of day.
- watchOS: Give visual feedback for every rotation, for example pickers changing the displayed value, or update your UI yourself if you track turns directly. Without feedback people assume the crown does nothing.
- watchOS: Match the speed of interface changes to how fast the crown is turned, and never change values so fast that picking one becomes hard.
- watchOS: Keep the default haptic detents when they suit the app. Turn them off if they clash with your animation, or switch tables to linear detents when row heights differ a lot.
- Not supported on iOS, iPadOS, macOS or tvOS.

## Eyes

Source: [Eyes](https://developer.apple.com/design/human-interface-guidelines/eyes). Applies to: visionOS.

Covers gaze-based targeting, where looking at an element highlights it before a tap. Read it for layout, spacing, shapes and custom hover effects in visionOS.

- Know the privacy model: the system never tells the app where someone is looking before a tap. Standard components report only the tap.
- Hover effects (gaze) and focus effects (keyboard or controller) are separate systems.
- Always provide more than one way to interact, and support accessibility features.
- Keep objects people need within their field of view and avoid requiring quick eye jumps over wide areas or several depth levels.
- Place content at a comfortable distance, at least a meter away for anything read or used for long: one meter (HG-167)
- Prefer standard UI components, which give consistent gaze feedback. Custom visual cues are harder to learn.
- Reduce clutter and motion, particularly in peripheral vision. New content appearing near a gazed button pulls the eyes away from it.
- Space interactive items so eyes can rest on one: at least 16 points of margin around each item or centers at least 60 points apart. (HG-168) (HG-169)
- Do not fill the field of view with a repeating pattern or texture, which can make elements seem to sit at different depths. Use it in a smaller area.
- Use subtle cues to draw gaze to the likely next target, such as central placement, gentle motion, contrast, or color or scale variation. Avoid flashy or harsh cues.
- Give interactive items rounded shapes, because gaze gravitates to corners and rounder shapes are easier to target.
- For a multi-element component, supply one containing shape that the system can highlight, such as a custom region around an image and its label.
- Custom hover effects: Define two appearances (with and without the effect). The system applies the effect out of process, so the app cannot know when it shows or run code at that moment, and the effect cannot perform actions.
- Custom hover effects: Save them for special moments. Too many, or using them where standard effects suffice, dilutes the design and can cause discomfort.
- Custom hover effects: Choose a delay that fits the content: none for subtle or inviting effects (a slider knob), short for quick interaction (tab bar expansion), longer for extra information (tooltips).
- Custom hover effects: Keep at least one primary view unchanged between the two states for visual stability.
- Custom hover effects: Test them on a real Apple Vision Pro.
- Not supported on iOS, iPadOS, macOS, tvOS or watchOS.

## Focus and selection

Source: [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection). Applies to: iPadOS, tvOS, visionOS, macOS.

Covers the focus model used with keyboards, remotes and game controllers, where focus marks the target and a separate action may select it. Read it for keyboard navigation on iPad and Mac and for tvOS layouts.

- Rely on system focus effects. Create custom ones only if truly necessary.
- Never move focus without a person's input. The exception is directional input (keyboard, remote, controller) when the focused item disappears: move focus to a neighboring remaining item. With other input, hide the focus indicator instead.
- Match platform conventions for reaching items. With full keyboard access on iPadOS and macOS, support focus only for content elements (list items, text and search fields), not buttons, sliders or toggles. On tvOS, every element must be focusable.
- Show focus with the platform's look: on iPadOS and macOS, a focused list item gets white text and an accent-color highlight, and unfocused items get standard text on a gray highlight.
- Use a focus ring for text and search fields, and a full-row highlight for lists and collections. A ring can suit an item that fills its cell, like a photo.
- iPadOS: The focus system (iPadOS 15 and later) covers text fields, text views, sidebars and collection views. Tab moves between focus groups; arrow keys move among items inside one group.
- iPadOS: Components show focus with the halo effect (a customizable outline, `UIFocusHaloEffect`) or the highlighted appearance (accent-colored text, not a true focus effect).
- iPadOS: Refine the halo's shape to match rounded corners or Bézier paths, and shift it if another view occludes or clips it, for instance so a badge sits above it.
- iPadOS: Make focus traverse custom views in reading order (leading to trailing, top to bottom). To move down a vertical stack first, mark the container as one focus group (`focusGroupIdentifier`).
- iPadOS: Give the most important item in a group higher priority (`UIFocusGroupPriority`) so it takes focus when the group does.
- tvOS: In a full-screen experience, let gestures act on the content instead of moving focus, since no focus is shown there.
- tvOS: Avoid a free-moving pointer. Navigate menus and interface through focus, and use free movement only in play, or make any pointer very visible and well integrated.
- tvOS: Design for up to five states per focusable item: unfocused, focused, pressed or chosen, selected, and unavailable. Supply sharp artwork for the larger focused size and ensure a scaled-up item does not crowd neighbors.
- visionOS: Keyboard and controller input uses the same focus system as iPadOS and tvOS. Gaze uses the hover effect, which is unrelated.
- Not supported on iOS or watchOS.

## Game controls

Source: [Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls). Applies to: iOS, iPadOS, macOS, tvOS, visionOS.

Covers touch controls, physical controllers and keyboard bindings for games. Read it when planning input support for a game.

- Support each platform's default input (touch, remote, mouse and keyboard, gestures) as well as controllers, since not everyone owns a controller.
- iOS, iPadOS: Add virtual controls only where they help, typically games with many actions or needing movement. Prefer direct touch on game objects or in-game gestures, such as tapping an object instead of a select button.
- iOS, iPadOS: Put buttons where they are easy to reach and clear of the Home indicator and Dynamic Island. Frequent buttons go near the thumb, outside the regions used for movement and camera. Secondary controls like menus go at the top.
- iOS, iPadOS: Make frequently used controls at least 44x44 pt and less important ones, like menus, at least 28x28 pt. (HG-170) (HG-171)
- iOS, iPadOS: Give every virtual control a visible press state (such as a glow that shows under a finger) plus sound and haptics.
- iOS, iPadOS: Use symbols that depict the action, such as a weapon for attack. Avoid abstract shapes or controller labels like A, X or R1 as artwork.
- iOS, iPadOS: Show or hide controls with context, for example hiding movement controls until the screen is touched.
- iOS, iPadOS: Merge actions into one control. Replace simultaneous or sequential button presses with double tap or touch and hold variants, and combine walking and sprinting.
- iOS, iPadOS: Use the left side of the screen for movement and the right for the camera, with large input areas. Show a floating thumbstick where the thumb lands, and pan the camera by direct touch.
- Provide a fallback to the platform's default input whenever controllers are supported.
- tvOS, visionOS: If a controller is required, the App Store shows a "Game Controller Required" badge. Check for a controller at launch and prompt people to connect one (`GCRequiresControllerUserInteraction`).
- Detect paired controllers automatically through the Game Controller framework instead of manual setup.
- Use the connected controller's own labeling and colors when naming buttons, because the framework's standard element names may differ from the physical labels (`GCControllerElement`).
- Outside of gameplay, map buttons the standard way: A activates, B cancels or goes back, shoulder buttons move left or right between sections, thumbsticks and D-pad move selection, Menu opens settings or pauses, and Home or logo is reserved for the system. X, Y and triggers have no UI role.
- Support several connected controllers by matching glyphs to the one in use, and label each player's controller correctly in multiplayer.
- Prefer SF Symbols glyphs over text to refer to controller elements.
- Keyboards: Favor single-key commands (I for Inventory, M for Map, Space for the main action).
- Keyboards: Test bindings on Apple keyboards, e.g. remap Control to Command, which sits near Space and the W, A, S, D keys.
- Keyboards: Place related or high-value commands on keys near the movement keys, and number keys for inventory categories.
- Keyboards: Offer default bindings and let players customize them.
- visionOS: Spatial controllers should mirror hand input: look at an object and press a trigger for indirect interaction, or reach out and press a trigger for direct interaction.

## Gestures

Source: [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures). Applies to: all platforms.

Covers standard and custom gestures across touch, trackpad, remote, controller and visionOS hand input. Read it before defining any gesture-driven interaction.

- Offer more than one way to do each task, because people use voice, a keyboard or Switch Control instead of gestures.
- Keep gesture meanings consistent. Tap activates or selects. Do not give tap or swipe app-specific meanings, and do not invent a new gesture for something standard like pressing a button or scrolling.
- Respond immediately and show progress that lets people predict the result and the movement needed to complete it.
- Make it obvious when a gesture is unavailable, for example a locked item or a disabled button that looks clearly different from an enabled one.
- Custom gestures: Add them only for specialized, frequent tasks that no standard gesture covers, like in games or drawing apps. They must be discoverable, easy to perform, distinct from others and never the only way to do something important.
- Custom gestures: Teach them in the app and test in real use. If a gesture is hard to describe simply, it will be hard to learn.
- Custom gestures: Use shortcut gestures to supplement, not replace, standard navigation. Keep the Back button even if an edge swipe also goes back.
- Custom gestures: Do not conflict with system gestures, such as the watchOS edge swipe or the visionOS hand-roll for system overlays. Immersive apps can defer some of these.
- iOS, iPadOS: Recognize the extra system gestures: three-finger swipe left or right for undo or redo, three-finger pinch for copy or paste, shake for undo or redo, and four-finger swipe to switch apps (iPadOS only).
- iOS, iPadOS: Allow simultaneous gestures only when useful, mostly games with several controls used together, like a joystick and fire buttons.
- macOS: Keyboard and pointing device remain primary. If touch is supported (touch-screen Mac or Sidecar iPad), do not change layout or control sizes.
- macOS: Enlarge tap targets, not the controls, and use standard controls that size touch targets for you.
- macOS: Consider a temporary touch-sized expanded variant of small or dense controls that stays briefly after release. Standard steppers, sliders and dials do this automatically.
- macOS: Never make touch the only route to a feature. Everything must work with keyboard and pointer, and pointer-only actions (modifier drags, hover menus) need touch equivalents.
- macOS: Reuse gestures people know from iPhone, iPad or trackpad, and verify they do not collide with macOS system gestures.
- macOS: Ensure any custom gesture works with direct touch and with a trackpad, adding modifier keys if needed.
- macOS: Equivalents on trackpad versus touch display: select is click or tap, open is double click or double tap, scroll is two fingers or one finger, context menu is secondary click or touch and hold, and drag is click-drag or touch and hold then drag.
- tvOS: Use standard gestures with a Siri Remote, compatible remote or touch-surface controller.
- visionOS: Gestures are indirect (look, then pinch from a distance) or direct (touch objects within reach). Prefer indirect for buttons and common UI and reserve direct for objects that invite close interaction. Direct use tires the arms, so keep it occasional.
- visionOS: Support standard gestures everywhere, since tap is the first thing people try.
- visionOS: Do not require particular body movements or positions. Offer alternative inputs.
- visionOS: Custom gestures need a Full Space and permission for hand data. Test comfort, avoid long arm-raised or repetitive motions, give lower-effort alternatives to complex multi-finger or two-hand gestures, and do not require a specific hand.
- visionOS: Looking at the palm opens Home and Control Center overlays (visionOS 2 and later). Keep content off the hands and wrists, be careful with gestures involving rolling the hand or wrist, and consider deferring the overlay in immersive games with `persistentSystemOverlays(_:)`.
- watchOS: Double tap (watchOS 11 and later) scrolls lists and advances vertical tabs, or runs a view's primary action (`handGestureShortcut(_:isEnabled:)`, `primaryAction`). It also acts on the first nondestructive notification action.
- watchOS: Choose the most-used button in a nonscrolling view as the primary action, such as play/pause. Do not set one in a view that scrolls through lists or switches vertical tabs.
- Standard gestures: tap activates or selects; swipe reveals actions, dismisses or scrolls; drag moves an element; touch and hold reveals more controls; double tap zooms (or runs the primary action on newer Apple Watch); zoom and rotate manipulate content. See the source page for per-platform support.

## Gyroscope and accelerometer

Source: [Gyroscope and accelerometer](https://developer.apple.com/design/human-interface-guidelines/gyro-and-accelerometer). Applies to: iOS, iPadOS, watchOS, tvOS (Siri Remote gyroscope).

A short page on using motion sensor data through Core Motion. Read it before adding motion input.

- Use motion data only when it gives people a real benefit, such as fitness feedback or better gameplay. Do not collect it just to have it.
- Provide copy that explains why the app needs motion data, since the system shows it in the first permission request.
- Outside active gameplay, avoid motion for direct manipulation of the interface. Such gestures can be imprecise, physically hard for some people and costly for battery.

## Keyboards

Source: [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards). Applies to: all platforms except watchOS.

Covers physical keyboards, standard shortcuts and defining custom shortcuts. Read it when adding menu commands, shortcuts or keyboard navigation.

- Support Full Keyboard Access where available (iOS, iPadOS, macOS, visionOS). Test with it enabled in Accessibility settings (`isFullKeyboardAccessEnabled`).
- iPadOS: Keyboard navigation for text fields, text views and sidebars is fine, but do not add your own keyboard navigation to buttons, segmented controls or switches. Full Keyboard Access handles those and drag and drop.
- Respect standard shortcuts. Do not reuse one for a different meaning. Repurpose only when its action makes no sense in your app, like Command-I for Get Info in a non-text app. Games should honor Command-Q yet allow rebinding other keys.
- Standard shortcuts people expect include: Command-Z undo, Shift-Command-Z redo, Command-X/C/V cut, copy, paste, Command-A select all, Command-S save, Command-N new, Command-O open, Command-P print, Command-W close window, Command-Q quit, Command-H hide app, Command-M minimize, Command-F find, Command-comma open settings, Command-period or Esc cancel, Command-question mark open Help, and Command-grave accent switch windows within an app. See the source table for the full list including screenshot and accessibility shortcuts.
- Define custom shortcuts only for the most frequent app-specific commands. Too many makes the app hard to learn.
- Use modifiers conventionally: Command-drag moves items as a group, Shift-drag constrains resizing to the aspect ratio, and holding an arrow key moves the selection by the app's smallest unit.
- Prefer Command as the main modifier, Shift as a secondary one, Option sparingly for rare or power commands, and avoid Control because the system uses it widely.
- Beware of characters that need modifiers on other keyboard layouts. Command is usually safe. Otherwise combine a non-Command modifier only with letters.
- List multiple modifiers in the order Control, Option, Shift, Command.
- Do not add Shift when the shortcut uses the upper symbol of a two-symbol key. Help is Command-Question mark, while Hide Status Bar is Command-Slash.
- Let the system localize shortcuts for the connected keyboard and mirror them in right-to-left layouts.
- Do not derive a shortcut by adding a modifier to a familiar one for an unrelated command. Shift-Command-Z should not mean something other than redo.
- visionOS: Holding Command shows an app's shortcuts in one flat list grouped by menu categories (File, Edit, View). Write descriptive titles that make sense without a submenu (`discoverabilityTitle`).
- visionOS: Connecting a physical keyboard shows a virtual keyboard overlay with typing completion and other controls. Account for it.
- Not supported on watchOS.

## Nearby interactions

Source: [Nearby interactions](https://developer.apple.com/design/human-interface-guidelines/nearby-interactions). Applies to: iOS, iPadOS, watchOS.

Covers experiences built on Ultra Wideband devices that know distance and sometimes direction to a peer. Read it when using the Nearby Interaction framework.

- Know the basics: it needs Ultra Wideband hardware, people grant permission while using the app, and identifiers are random and last only for the session.
- Draw inspiration from the physical world, such as bringing devices together to move audio from iPhone to HomePod mini.
- Use distance, direction and context together, for example a share sheet suggesting the closest contact the person faces.
- Let feedback sharpen with proximity, such as the AirTag finder changing from a direction arrow to a pulsing circle as you get close.
- Give continuous, uninterrupted feedback that follows the person's movement.
- Mix visual, audible and haptic feedback by context. Use visual while the person watches the screen and audio or haptics while they move around.
- Never make a nearby interaction the only way to complete a task. Provide alternatives.
- Prefer portrait orientation. Landscape reduces distance and direction accuracy. Hint at the holding position with implicit visual feedback instead of telling people.
- Account for the sensor's field of view, similar to the Ultra Wide camera. Outside it you may get distance but no direction.
- Warn in onboarding that people, animals or large objects between devices reduce accuracy or availability.
- iOS: Gives a peer's distance and direction.
- watchOS: Gives only distance, and participating watchOS apps must be in the foreground.
- Not supported on macOS, tvOS or visionOS.

## Pointing devices

Source: [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices). Applies to: macOS, iPadOS, visionOS.

Covers mouse and trackpad behavior, pointer effects on iPad, touch support for hidden controls on Mac, and pointer use in visionOS. Read it when designing hover, cursor and click behavior.

- Respond to mouse and trackpad gestures the same way across the app and system, for example consistent "swipe between pages".
- Do not redefine systemwide trackpad gestures (Dock, Mission Control), even in games. Mac users can customize them.
- Make the experience consistent across touch, eyes, pointer and keyboard, so people never relearn per input.
- Let the pointer reveal and hide controls that auto-minimize or fade, like Safari's minimized toolbar on iPad or video playback controls.
- Make modifier-key interactions match across input methods, e.g. Option-drag to duplicate must behave the same by touch and by pointer.
- iPadOS: The pointer supplements touch and adapts to context. Support multiple selection in custom views by band selection (`UIBandSelectionInteraction`), as standard collection views do.
- iPadOS: Separate pointer from finger behavior only when it adds value, for example precise click-to-seek on a scrubber.
- iPadOS: Pointer shape is an arrow by default, becomes an I-beam over text, and can be customized. Content effects change the element under it: highlight, lift and hover.
- iPadOS: Use highlight (a Liquid Glass shape) for grouped controls in a Liquid Glass container, lift (scale up with shadow and highlight) for standalone Liquid Glass controls or small opaque elements, and hover (custom scale, tint, shadow) for large elements.
- iPadOS: Prefer system pointer appearances for standard buttons and text areas, and system effects for custom elements that act like standard ones, so they do not seem broken.
- iPadOS: Pad interactive elements for comfortable hit regions: about 12 points around elements with a bezel and about 24 points around those without. (HG-172) (HG-173)
- iPadOS: Make hit regions for adjacent custom bar buttons contiguous so the highlight does not flicker out between them.
- iPadOS: Use pointer effects consistently, such as the same pointer in every drawing area. Skip decorative effects with no practical value.
- iPadOS: Keep custom pointer shapes simple and instantly understandable.
- iPadOS: Add helpful annotations, like X and Y values over a graph or dimensions of a resizable image, but no instructional text.
- iPadOS: Pointer accessories are small secondary indicators (such as resize arrows, `UIPointerAccessory`). Use clear, simple images, and use the accessory transition to signal state changes, like a plus symbol turning into a slashed circle when adding becomes unavailable.
- iPadOS: With custom hover effects, scale only elements with space around them (not table rows). With little space, use tint without scale and shadow. Do not use shadow without scale.
- macOS: the first seven behaviors (primary and secondary click, scrolling, smart zoom, both swipes, Mission Control) work with a mouse or a trackpad; lookup and data detectors, tap to click, Force Click, pinch zoom, rotate, Notification Center, App Exposé, Apps and Show Desktop are trackpad-only, so offer a non-gesture route to anything they trigger.
- macOS: Use standard pointer styles to communicate state: arrow, I-beam, pointing hand for links, open or closed hand for dragging content, crosshair for precise selection, resize cursors for dividers and window edges, and drag copy, drag link, disappearing item and not-allowed pointers during drag and drop.
- macOS touch: Decide which hover-revealed controls need touch support. Only essential ones. Skip static info like tooltips and controls reachable another way, such as carousel buttons when swiping works. Do not leave hidden controls always visible just for touch.
- macOS touch: Reveal a hidden control when its area is tapped, show only controls relevant to the content, and hide it after use or a few seconds.
- macOS touch: Keep the current selection when tapping to reveal a control and when tapping the revealed control.
- macOS touch: Put essential hidden controls in a context menu, which touch opens with touch and hold. Keep it short.
- macOS touch: In sidebars, tapping a header or row acts like a click, reveals controls for just that item, and reveals a hidden control without activating it until tapped again. Keep them visible until touch leaves the sidebar or a pointer is used again.
- macOS touch: In tabbed windows, tapping anywhere reveals the selected tab's close button until a pointing device is used again. After closing a tab by touch, show the button on the newly selected tab.
- visionOS: External pointers work with eyes and hands. Focus follows the pointer, context follows where the person looks, and the pointer hides during gestures and returns where they look. No extra work needed.
- Not supported on tvOS or watchOS. No additional guidance for iOS.

## Remotes

Source: [Remotes](https://developer.apple.com/design/human-interface-guidelines/remotes). Applies to: tvOS.

Covers the Siri Remote and compatible remotes as the main Apple TV input, including gestures, buttons and channel-guide buttons. Read it for tvOS navigation and playback controls.

- Use standard gestures for standard actions. Outside gameplay, people expect the remote to behave identically in every app.
- Match the tvOS focus experience: focus must travel the way the finger swipes.
- Give clear feedback about what a gesture does, such as a resting thumb hinting where to swipe for the info area.
- Create new gestures only where they add fun, mainly in games. Elsewhere people prefer not to learn new ones.
- Treat press and tap differently. Press means intentional choosing or confirming. Taps suit navigation or revealing information. Ignore taps during live video playback because resting a thumb or handling the remote can trigger them.
- Use tap position (up, down, left, right) for navigation or gameplay only when intuitive and discoverable.
- In an app, the swipe moves focus and the touch surface press activates or goes deeper. In a game, the swipe acts as a directional pad and the press as the primary button.
- Back: open the parent of the current screen, which is the Home Screen at the top level and follows the app hierarchy elsewhere, not necessarily the previous screen. In active play, show a pause menu instead. Back then closes the pause menu and resumes. Press and hold Back to reach the Home Screen.
- Play/Pause: toggle media playback in apps. In games it acts as a secondary button, such as skipping an intro video.
- Swipe scrolls with momentum that starts fast and slows, and swiping at the remote's edge moves faster. Press-then-swipe enters scrubbing mode.
- EPG: Open your guide on "guide" or "browse" buttons and use "page up" and "page down" to move through it, without giving those buttons other meanings meanwhile. Tapping the upper or lower touch area also browses. Without an EPG, the system routes these presses to the default guide app.
- During playback, make "page up" and "page down" change channels.
- Not supported on iOS, iPadOS, macOS, visionOS or watchOS.
