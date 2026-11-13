# Components: content, layout, navigation and status

Own-words digest of the Human Interface Guidelines pages below, read on 2026-11-13 (HG-0). Each section links its page; when this digest and the page differ, the page wins. Bullets that start with platform names apply only there.

## Contents

- Charts
- Image views
- Text views
- Web views
- Boxes
- Collections
- Column views
- Disclosure controls
- Labels
- Lists and tables
- Lockups
- Outline views
- Split views
- Tab views
- Path controls
- Search fields
- Sidebars
- Tab bars
- Token fields
- Activity rings
- Gauges
- Progress indicators
- Rating indicators

## Charts

Source: [Charts](https://developer.apple.com/design/human-interface-guidelines/charts). Applies to: all platforms.

Governs how to build data charts: marks, axes, labels, color and accessibility. Read it before generating any graph, plot or sparkline.

- Pick the mark by the question: bars to compare categories or show parts of a whole, lines for change over time and trend, points for relationships, outliers and clusters.
- Use bars for time series only when each value is a total for its period, such as steps per day.
- Combine mark types when it adds clarity, for example points on top of a line to highlight single readings.
- Use a fixed axis range when the minimum and maximum have fixed meaning (a battery runs from empty to full); use a dynamic range when values vary widely and marks should fill the plot area.
- Start a bar chart's value axis at zero so bar heights compare honestly; do not force zero when it hides meaningful differences, such as resting versus active heart rate.
- Label ticks and grid lines with familiar sequences (0, 5, 10) rather than odd steps (1, 6, 11).
- Tune grid line count and weight to the context: too many overwhelm the data, too few make estimating values hard. When people can inspect individual points, use fewer lines and lighter labels.
- Give the chart a title and subtitle that state its purpose and its main message before the reader studies details.
- Keep a clear hierarchy: data is the most prominent element; axes, labels and descriptions stay secondary.
- In compact layouts, maximize plot width: keep vertical-axis labels short, move units into the title, and place long category names inside the plot area if they do not hide data.
- Make every chart accessible to VoiceOver users; consider Audio Graphs to add tones and a text summary.
- Keep critical information visible without interaction. Offer optional exploration, such as dragging an indicator along a line to read a value.
- When marks are too small to hit, make the whole plot area the touch or pointer target so people can scrub across it.
- Give keyboard, full keyboard access and Switch Control users a logical path through the chart, for example along the X axis, or let them move between subsets of values for large datasets (`accessibilityRespondsToUserInteraction(_:)`).
- Draw attention to changes in marks or axes. Animation helps, but add other cues too (post an accessibility notification) for VoiceOver users and people who disable animation.
- Align the chart with neighboring content, typically its leading edge. Put grid-line labels on the trailing side or move the Y axis to the trailing side, and anchor orphan labels with a tick.
- Do not rely on color alone to separate series or carry essential meaning; add shapes or patterns, as Health does for the two blood-pressure values.
- Add visual separation, such as separators, between touching color areas like stacked bar segments.
- Without Audio Graphs, supply an overview that names the chart type, what each axis represents and the axis bounds.
- A chart usually needs a label for each important or interactive element, not one label like an image. Use a single summary label only for a small chart that opens a detailed one.
- Match label detail to the chart's purpose: summarize stretches for a terrain overview; label each bar when exact per-period values are the point.
- Write accessibility labels with context (date, place) plus the value, without repeating what an axis name or overview already says.
- Use actual values instead of subjective words such as rapidly, gradually or almost.
- Avoid ambiguous formats and abbreviations: write "June 6" not "6/6", and spell out "60 minutes" not "60m".
- Describe what a series represents, not what color it is drawn in.
- Refer to axes in a consistent order throughout the app, for example always X first.
- Hide visible axis and tick text from assistive technologies, since labels and Audio Graphs already convey values and trend.
- watchOS: avoid requiring complex chart interaction. Show glanceable data with simple interaction, and leave detail and richer exploration to a companion version on another platform.

## Image views

Source: [Image views](https://developer.apple.com/design/human-interface-guidelines/image-views). Applies to: all platforms.

Covers displaying a single image or an animated image sequence. Use it when choosing between an image view, a symbol and an image button.

- Use an image view when the main job is simply to show an image; image views are normally not interactive.
- For a tappable image, configure a system button to show it instead of adding button behavior to an image view.
- For icons, prefer an SF Symbol or interface icon over a bitmap image view; these take color and opacity and follow the person's accent color.
- Supply image data in common formats such as PNG, JPEG or PDF.
- When placing text over an image, ensure strong contrast and add a text shadow or a background layer to protect legibility.
- For an animated sequence, make all frames the same size and shape, ideally prescaled to the view so the system does no scaling.
- macOS: use an image well for an editable image (copy, paste, drag and Delete to clear); use an image button for a clickable image.
- tvOS: many images are layered with transparency to create depth; follow the layered images guidance.
- visionOS: image views in windows can show 2D, stereoscopic and spatial photos. With RealityKit, images can sit beside 3D content or become a generated spatial scene (`ImagePresentationComponent`).
- watchOS: animate with SwiftUI when possible; otherwise animate a sequence inside an image element with WatchKit (`WKImageAnimatable`).

## Text views

Source: [Text views](https://developer.apple.com/design/human-interface-guidelines/text-views). Applies to: all platforms.

Covers multiline, styled and optionally editable text. Use it to decide between a text view, a label and a text field.

- Choose a text view for long, editable or specially formatted text; use a label for a little static text and a text field for a little editable text.
- Know the defaults: leading alignment, system label color, scrolling when content overflows the view, and in iOS, iPadOS and visionOS a keyboard that appears when an editable view is selected.
- Keep text readable even when mixing fonts, colors and alignments; adopt Dynamic Type and test with accessibility options such as bold text.
- Let people select and copy useful content such as error messages, serial numbers and IP addresses.
- iOS, iPadOS: show the keyboard type that matches the content being edited.
- tvOS: use a text view only to display text; use text fields for the minimal editable input.

## Web views

Source: [Web views](https://developer.apple.com/design/human-interface-guidelines/web-views). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

Covers embedding web content such as HTML or sites inside an app (`WKWebView`).

- Add forward and back navigation, with visible controls, when people may visit several pages, because it is not provided by default.
- Do not turn a web view into a browser. Brief in-context access to a site is fine; Safari remains the place to browse the web.

## Boxes

Source: [Boxes](https://developer.apple.com/design/human-interface-guidelines/boxes). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

Covers grouping related content with a border or background, optionally titled (`GroupBox`, `NSBox`).

- Keep a box small relative to its container; one that nearly fills the window or screen no longer separates anything and crowds other content.
- Show subgroups inside a box with padding and alignment instead of nested boxes, which look busy and cramped.
- Add a short title only when it clarifies what the box holds; it also helps VoiceOver users predict the contents.
- Write the title as a brief phrase in sentence-style capitalization with no ending punctuation, except a trailing colon when the box is in a settings pane.
- iOS, iPadOS: boxes default to the secondary and tertiary background colors.
- macOS: the title sits above the box by default.

## Collections

Source: [Collections](https://developer.apple.com/design/human-interface-guidelines/collections). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers ordered, visual item layouts, best for image-based content (`UICollectionView`, `NSCollectionView`).

- Use the standard horizontal row or grid layout; avoid custom layouts that confuse people or attract attention.
- For mostly text content, use a table or list instead.
- Make items easy to reach and choose: leave enough padding around images so focus or hover effects are visible and nothing overlaps.
- By default a tap selects, a long press starts editing and a swipe scrolls; add further gestures only for custom actions the app requires.
- Animate insertions, deletions and reordering as feedback, using standard or custom animation.
- iOS, iPadOS: be careful with dynamic layout changes. Keep them understandable and trackable, and avoid reflowing while people are looking at or using the layout unless they asked for it.

## Column views

Source: [Column views](https://developer.apple.com/design/human-interface-guidelines/column-views). Applies to: macOS only.

Covers browser-style navigation of a deep hierarchy through side-by-side columns (`NSBrowser`), as in Finder's column view.

- Choose a column view for deep hierarchies where people move back and forth between levels often and do not need table-style sorting.
- Each column is one level; parents show a triangle, and choosing one shows its children in the next column.
- Put the root level in the first column so people can scroll back and start over.
- When the selected item has no children, show information about it, such as a preview, dates, type and size.
- Let people resize columns so long names fit.
- On iPadOS and visionOS, consider a split view for hierarchical content instead.

## Disclosure controls

Source: [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls). Applies to: iOS, iPadOS, macOS, visionOS (not tvOS or watchOS).

Covers triangles and buttons that show or hide related content (`DisclosureGroup`, `NSButton.BezelStyle.disclosure`, `.pushDisclosure`).

- Hide details until they are relevant: keep the most-used controls visible at the top and tuck advanced options away by default.
- Disclosure triangle: it points inward from the leading edge when collapsed and down when expanded; activating it toggles the content and resizes the view.
- Give each disclosure triangle a descriptive label that names what is revealed, such as "Advanced Options".
- Disclosure button: it points down when collapsed and up when expanded; it toggles content tied to one specific control, like the extra location options beside a Save As field.
- Place a disclosure button next to the content it reveals so the relationship is clear.
- Keep a view to a single disclosure button; several add confusion.
- iOS, iPadOS, visionOS: use the SwiftUI `DisclosureGroup` view.

## Labels

Source: [Labels](https://developer.apple.com/design/human-interface-guidelines/labels). Applies to: all platforms.

Covers static, readable, non-editable text used in buttons, menu items, lists and views (`Label`, `Text`, `UILabel`).

- Use a label for a small amount of uneditable text; switch to a text field to edit small text and a text view for large text.
- Prefer system fonts, which support Dynamic Type; keep any custom styling legible.
- Use the four system label colors for importance: label for primary information, secondary for subheadings and supplemental text, tertiary for unavailable items or behavior, quaternary for watermarks (`label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`; AppKit `labelColor` and siblings).
- Let people select and copy useful label text such as error messages, locations and IP addresses.
- macOS: make an `NSTextField` uneditable with `isEditable`.
- watchOS: use the system date, time and countdown or count-up timer text components; they adapt to the space and update on their own. Consider them in complications.

## Lists and tables

Source: [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables). Applies to: all platforms.

Covers rows of data in one or more columns, including grouped, hierarchical, selectable and editable data (`List`, `Table`, `UITableView`, `NSTableView`).

- Use lists and tables mainly for text; for items of very different sizes or many images, use a collection.
- Allow editing when sensible; reordering is often welcome even without add or remove. iOS and iPadOS need an edit mode before selecting rows.
- Match selection feedback to meaning: navigation lists keep the selected row highlighted; option lists flash the highlight and then show a checkmark.
- Keep item text short to limit truncation and wrapping. For long text, list titles only and show the content in a detail view.
- Protect readability when text is clipped or width varies; a middle ellipsis keeps both the start and the end visible.
- In multicolumn tables, use noun or short noun-phrase column headings in title-style capitalization with no ending punctuation. For a single-column table without a heading, add a label or header for context.
- Pick a list style that suits the data and platform: grouped in iOS and iPadOS, elliptical in watchOS, bordered with alternating rows in macOS (`ListStyle`).
- Pick a row style that fits the content, such as a small leading image plus a label (`UIListContentConfiguration`).
- iOS, iPadOS, visionOS: use an info button (detail disclosure button) only to reveal more about a row's content; use a disclosure indicator accessory to drill into a hierarchy.
- iOS, iPadOS, visionOS: do not add an alphabetical index to a table that has controls such as disclosure indicators at the trailing end, because the two are hard to tell apart by touch.
- macOS: make column headings clickable for sorting, flipping the direction on repeat clicks of the sorted column.
- macOS: let people resize columns.
- macOS: consider alternating row colors in wide multicolumn tables.
- macOS: use an outline view, not a table, for hierarchical data.
- tvOS: check that images beside a table still look right when a focused row grows and its corners round; do not add your own corner masks.
- watchOS: keep row counts low, listing the most relevant items with a way to see more.
- watchOS: to support vertical page-based swiping between details, keep detail views short; scrolling details break it.

## Lockups

Source: [Lockups](https://developer.apple.com/design/human-interface-guidelines/lockups). Applies to: tvOS only.

Covers focusable units built from main content plus a header above and a footer below (`TVLockupView`, `TVLockupHeaderFooterView`).

- Header, content and footer scale as one when the lockup gains focus. Four kinds exist: cards, caption buttons, monograms and posters.
- Leave enough space between lockups so a focused one that expands does not overlap or push others.
- Keep lockup sizes consistent within a row or group.
- Cards: bundle header, footer and content to show reviews and scores for media (`TVCardView`).
- Caption buttons: a title and subtitle under an image or text button (`TVCaptionButtonView`). On focus they tilt with the swipe: up and down when stacked vertically, left and right when horizontal, both in a grid.
- Monograms: a circular picture of a person, usually cast or crew, with their name; show initials only when no image exists, and prefer images (`TVMonogramContentView`).
- Posters: an image with an optional title and subtitle hidden until focus; any size that suits the content (`TVPosterView`).

## Outline views

Source: [Outline views](https://developer.apple.com/design/human-interface-guidelines/outline-views). Applies to: macOS only.

Covers hierarchical data in columns and rows with expandable parents (`NSOutlineView`, `OutlineGroup`), as in Finder.

- Use it mainly for text content, often in the leading pane of a split view.
- For non-hierarchical data, use a table instead.
- Express nesting through the leftmost column alone; remaining columns carry attributes such as size or modification date.
- Always give multi-column outline views headings: nouns or short noun phrases in title-style capitalization, no trailing colon or punctuation. A single-column one without a heading needs a label or other context.
- Allow sorting by clicking a heading; sort within each hierarchy level, and reverse the order on a second click of the same column. Secondary sorting can happen behind the scenes.
- Let people resize columns to reveal wide data.
- Make expanding and collapsing easy; Option-clicking a disclosure triangle expands all nested subfolders, while a plain click expands one.
- Remember which levels people expanded and restore them next time.
- Consider alternating row colors in wide multi-column outline views.
- Support editing where it fits: single-click a cell to edit, while a double click may do something else, such as open a file. Reordering, adding and removing rows can also be offered.
- Truncate cell text with a centered ellipsis rather than clipping it.
- For long outlines, offer a search field, usually in the toolbar.

## Split views

Source: [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views). Applies to: all platforms.

Covers adjacent panes that show several hierarchy levels at once (`NavigationSplitView`, `UISplitViewController`, `NSSplitViewController`). Typical use is a sidebar, a content list and a detail pane.

- Keep the current selection persistently highlighted in each pane leading to the detail, so people see how panes relate.
- Consider drag and drop between panes to move content across hierarchy levels.
- iOS: prefer split views in regular-width environments, not compact ones such as iPhone portrait, where panes would truncate or wrap.
- iPadOS: a split view has two or three vertical panes; design for narrow, compact and intermediate widths because windows resize fluidly, and keep navigation between panes logical.
- macOS: panes can be arranged vertically, horizontally or both, with draggable dividers (`VSplitView`, `HSplitView`).
- macOS: set sensible minimum and maximum pane sizes so the divider never vanishes.
- macOS: consider letting people hide panes, as Keynote does for focus, and give several ways to bring them back, such as a toolbar button or a menu command with a shortcut.
- macOS: prefer the thin divider, one point wide, unless strong lines on both sides make it hard to see (`NSSplitView.DividerStyle`). (HG-102)
- tvOS: split views suit filtering, with categories in the primary pane and results in the secondary.
- tvOS: choose a balanced layout. The default gives the primary pane one third of the width and the secondary two thirds; a half-and-half layout is also possible.
- tvOS: show a single title above the whole split view, not a title per pane.
- tvOS: center that title when the secondary pane holds a collection; place it above the primary view when the secondary pane is one main view that needs more room.
- visionOS: prefer a split view over a new window for supplementary information; use a sheet for a small, required task.
- watchOS: the split view shows either the list or a detail view full screen.
- watchOS: open on the most relevant detail, based on location, time or recent actions.
- watchOS: put multiple detail pages in a vertical tab view so the Digital Crown scrolls between them, with a page indicator.

## Tab views

Source: [Tab views](https://developer.apple.com/design/human-interface-guidelines/tab-views). Applies to: macOS and watchOS (not iOS, iPadOS, tvOS or visionOS).

Covers mutually exclusive content panes switched by a tabbed control (`NSTabView`, `TabView`).

- Use tabs for closely related areas of content.
- Keep each pane self-contained: its controls affect only content in the same pane.
- Label each tab so people can predict its pane: usually a noun or short noun phrase in title-style capitalization; a verb phrase is occasionally fine.
- Avoid a pop-up button to switch tabs. Tabs need one click and show all choices; a pop-up needs two. It is acceptable only when there are too many panes for tabs.
- Avoid more than six tabs; with more, offer the choices as view options in a pop-up menu.
- The tab control runs along the upper boundary of the pane and can be hidden when code switches panes; the pane may then be borderless (solid or transparent), bezeled, or outlined with a line.
- Inset the tab view with window-body margin on all sides; edge-to-edge is unusual.
- iOS, iPadOS: consider a segmented control for similar behavior.
- watchOS: tab views appear as page controls.

## Path controls

Source: [Path controls](https://developer.apple.com/design/human-interface-guidelines/path-controls). Applies to: macOS only.

Covers displaying where a chosen file or folder lives on disk (`NSPathControl`), such as Finder's path bar.

- Put a path control inside the window's content area; keep it out of toolbars, status bars and the window frame.
- Standard style: a linear list of root disk, parent folders and the selected item, each with icon and name; long paths hide the middle names. An editable one accepts a dropped item to show its path.
- Pop-up style: behaves like a pop-up button showing the selected item's icon and name; its menu lists the root disk, parent folders and the item. An editable one adds a Choose command and also accepts drops.

## Search fields

Source: [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields). Applies to: all platforms.

Covers the editable field with a Search icon, Clear button and placeholder, plus scope bars, tokens and where to place search on each platform (`searchable`, `UISearchBar`, `NSSearchField`).

- Use placeholder text to say what can be searched and reinforce the search scope.
- Begin searching as the person types, if possible, and refine results continuously.
- Offer suggestions: recent searches before typing starts, predictive terms while typing.
- Rank the most relevant results first and consider grouping results by category.
- Let people filter results, for example with a scope bar in the results area.
- Scope bar: filter among clearly defined categories, moving from broad to narrow (Mail on iPhone narrows from all mailboxes to the current one). Default to the broader scope.
- Tokens: a selectable, editable chip for a search term that filters additional terms, such as a contact in Mail or photos in Messages. Pair tokens with suggestions so people discover which exist.
- iOS: search can be a tab in the tab bar, a bottom or top toolbar item, or an inline field.
- iOS search tab, standard style: opens a landing page whose search field sits first; choose it to offer suggestions and discovery for rich content, as Apple TV does with genres.
- iOS search tab, button appearance: a separate button that focuses the field and raises the keyboard right away, then returns to the previous tab; choose it for quick lookups.
- iOS toolbar: place search at the bottom when there is room, as an expanded field or a button that animates into a field above the keyboard. Settings uses a lone search toolbar; Mail and Notes combine it with other controls.
- iOS toolbar: place search at the top, as a navigation bar button, when the bottom must stay free for content (Wallet's pass stack) or there is no bottom toolbar.
- iOS inline: put search beside the content it filters to show it applies only there, especially with several search fields; position it above the list, and consider pinning it into the upper toolbar during scrolling.
- iPadOS, macOS: keep the search experience consistent across both.
- iPadOS, macOS: place the search field on the toolbar's trailing end for common cases, especially in split-view apps (Mail, Notes, Voice Memos) or when results fill the detail view (Freeform).
- iPadOS, macOS: put search at the top of the sidebar to filter sidebar content or navigation, as Settings does.
- iPadOS, macOS: use a sidebar or tab bar item for a dedicated discovery area with suggestions, categories and recents (Music, TV).
- iPadOS, macOS: in a dedicated search area, focus the field on arrival, except on iPad with only a virtual keyboard, where leaving it unfocused avoids the keyboard covering the view.
- iPadOS, macOS: account for window resizing; in compact iPad views keep search where it is useful, such as above the content list in Notes and Mail.
- tvOS: use a search screen, a specialized keyboard with results beneath it (`UISearchController`), and provide popular, contextual and recent suggestions to reduce typing.
- watchOS: tapping the field opens a full-screen text input; the app returns to the field only after Cancel or Search.

## Sidebars

Source: [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers leading-side navigation between app areas or top-level collections such as folders and playlists (`NavigationSplitView`, `sidebarAdaptable`).

- Use a sidebar only when there is room; when space is tight, a tab bar is more compact, and a tab bar that converts into a sidebar can offer both.
- Extend rich content beneath the sidebar, which floats on the Liquid Glass layer, by letting it scroll horizontally or by applying a background extension effect (`backgroundExtensionEffect()`).
- Let people customize which areas appear and in what order, where possible.
- For lots of content, group hierarchy with disclosure controls.
- Represent items with familiar SF Symbols; for custom icons prefer custom symbols over bitmaps.
- Show at most two hierarchy levels. For deeper data, add a content list between sidebar and detail in a split view.
- With two levels, title each group with short, descriptive labels.
- Give sidebar icon colors a purpose. By default they follow the app accent color, and on macOS they should follow the system accent color people choose. Use fixed colors sparingly for meaning or emphasis, such as Mail's yellow VIP icon.
- Allow hiding the sidebar with familiar interactions: edge swipe on iPadOS, a button or View menu commands on macOS. Do not hide it by default, and on visionOS it rarely needs hiding.
- iOS, iPadOS: with the `sidebarAdaptable` tab view, choose sidebar or tab bar at launch; a button switches between them and the control adapts to width, rotation and resizing. For a sidebar only, use `NavigationSplitView` or `UISplitViewController`.
- iOS, iPadOS: consider starting with a tab bar for more content space, using its sidebar form for less-used areas.
- iOS, iPadOS: without SwiftUI, use the sidebar appearance of a list layout (`UICollectionLayoutListConfiguration.Appearance.sidebar`).
- macOS: row height, text and glyph size follow a small, medium or large size, set in code or by the person in General settings.
- macOS: consider hiding and revealing the sidebar automatically as the window resizes.
- macOS: do not place critical information or actions at the bottom, which windows may move offscreen.
- visionOS: for deep hierarchies, use a sidebar inside a tab for secondary navigation, and keep sidebar selections from changing the open tab.

## Tab bars

Source: [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars). Applies to: iOS, iPadOS, macOS, tvOS, visionOS (not watchOS).

Covers top-level navigation between app sections while preserving each section's state (`TabView`, `UITabBar`).

- Use tabs for navigation, never for actions; use a toolbar for actions on the current view.
- Keep the tab bar visible when moving between sections, except when a temporary modal covers it.
- Use only as many tabs as the structure needs; fewer is easier. For complex apps, a sidebar, or a tab bar able to convert into one, may suit better.
- Avoid overflow tabs: when width limits visible tabs, iOS and iPadOS turn the trailing tab into a More tab that hides the rest. Limit when that happens.
- Never disable or hide tab buttons when content is unavailable; explain why an empty section is empty.
- Add tab labels, single words when possible, beside or beneath the icon.
- Prefer SF Symbols for tab icons: they adapt to compact (icon above label) and regular (side by side) layouts. Prefer filled symbols; for custom icons, use the dimensions from Apple Design Resources.
- Use a badge, a red oval with white text and a number or exclamation point, only for critical new or updated information.
- Avoid similar colors for tab labels and the content layer behind them. With colorful content, choose a monochrome tab bar or a clearly distinct accent (Liquid Glass color).
- iOS: the tab bar floats at the bottom on a Liquid Glass background that shows content through.
- iOS: with an attached accessory like Music's MiniPlayer, the tab bar can minimize on scroll down and move the accessory inline; choosing a tab or returning to the top of the content restores it (`TabBarMinimizeBehavior`).
- iOS: a dedicated search tab can sit at the trailing end.
- iPadOS: the tab bar sits near the top, either fixed or with a button converting it to a sidebar (`tabBarOnly`, `sidebarAdaptable`). To keep a sidebar without conversion, use a navigation split view.
- iPadOS: prefer a tab bar for navigation, and let people customize it in apps with many sections, as in Music's favorite playlist (`TabViewCustomization`, `UITab.Placement`). Default to five tabs or fewer to stay consistent between compact and regular sizes.
- tvOS: the bar is customizable: background tint, color or image; fonts, including one for the selected item; selected and unselected tints; extra icon buttons such as settings and search.
- tvOS: it is translucent by default with only the selected tab opaque and a drop shadow when focused; height is 68 points and the top edge sits 46 points from the screen top, neither changeable. (HG-103) (HG-104)
- tvOS: overflowing items fade out at the right edge, and at the left too when scrolling.
- tvOS: people can scroll the bar offscreen when the tab holds a single main view, but it stays pinned over split views, and pressing Menu on the remote always returns focus to it.
- tvOS: in live-viewing apps order tabs as live content, then recorded or Cloud DVR content, then other content.
- visionOS: the tab bar is vertical, fixed beside the window's leading side, and expands when looked at, possibly covering content briefly.
- visionOS: give every tab a symbol and a short text label; the symbol is always visible and labels appear on expansion.
- visionOS: for deep hierarchies, use a sidebar within a tab and keep its selections from switching tabs.

## Token fields

Source: [Token fields](https://developer.apple.com/design/human-interface-guidelines/token-fields). Applies to: macOS only.

Covers text fields that turn entries into selectable, draggable tokens, like Mail recipients (`NSTokenField`).

- Understand the behavior: typed text becomes a token, tokens can be selected and dragged to reorder or move to another field, and suggestions can appear as people type; picking one inserts a token.
- Add a context menu on tokens with useful information or editing actions, such as editing a recipient, marking VIP or viewing a contact card.
- A comma converts text to a token by default; consider extra triggers such as Return.
- Consider adjusting the delay before suggestions show, since instant suggestions can distract typing.
- Tokens can also represent search terms; see search field guidance.

## Activity rings

Source: [Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings). Applies to: iOS, iPadOS, watchOS (not macOS, tvOS or visionOS).

Covers the Move, Exercise and Stand progress element. It is strictly reserved for that data (`HKActivityRingView`).

- Show Activity rings only where relevant to the app, mainly health and fitness apps, such as workout metrics or a workout summary.
- Use them only for Move, Exercise and Stand; never copy them for other data or make another ring-like element for that progress.
- Show progress for one person only, and make it clear whose, with a label, photo or avatar.
- Never alter ring colors, including with filters or opacity changes.
- Always draw the rings on a black background, preferably inside a circle made by setting the container's corner radius, not a circular mask.
- Keep black visible around the outer ring; add a thin black stroke if needed, and no gradient, shadow or other effect.
- Scale rings so they do not look disconnected, and adapt the surrounding interface to the rings, never the reverse.
- Color labels and values tied to a ring (Move, Exercise, Stand, current and goal numbers) to match that ring.
- Keep an outer margin at least equal to the gap between rings, and let nothing crop or crowd it or the rings.
- Separate other ring-like elements from Activity rings with padding, lines, labels, color or scale.
- Do not duplicate system Activity notifications, and do not embed the ring element in your notifications; referencing progress in your own way is fine.
- Do not use the rings as decoration in labels or background graphics, or for branding in app icons or marketing.
- iOS: with an Apple Watch paired it shows all three rings; without one it shows the Move ring only, an estimate from steps and other apps' workouts. History can mix both styles.

## Gauges

Source: [Gauges](https://developer.apple.com/design/human-interface-guidelines/gauges). Applies to: iOS, iPadOS, macOS, visionOS, watchOS (not tvOS).

Covers showing a value within a range on a circular or linear path (`Gauge`), plus the macOS level indicator (`NSLevelIndicator`).

- Know the forms: circular or linear; standard (an indicator marks the value) or capacity (a fill stops at the value); and an accessory variant that resembles watchOS complications, good for iOS Lock Screen widgets.
- Write short labels for the current value and both ends of the range; VoiceOver reads the visible ones.
- Consider a gradient along the path that conveys meaning, such as red to blue for hot to cold.
- macOS: a level indicator can show capacity, rating or, rarely, relevance.
- macOS capacity, continuous: a translucent horizontal track filled by a solid bar. Prefer it for large ranges.
- macOS capacity, discrete: separate equal segments that fill completely, never partially, one per unit of capacity.
- macOS: the default fill is green; consider changing it at meaningful levels such as very low or very high, or use the tiered state to show several colors in one indicator.
- macOS relevance: a shaded horizontal bar, for example showing result relevancy in a list.
- For ranking, use the rating style (see rating indicators).

## Progress indicators

Source: [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators). Applies to: all platforms.

Covers feedback that work is ongoing: determinate bars and circles, indeterminate spinners and bars, and pull-to-refresh (`ProgressView`, `UIProgressView`, `UIActivityIndicatorView`, `NSProgressIndicator`).

- Indicators are transient: show them only while the operation runs and remove them afterward.
- Determinate indicators fill a track (bar: leading to trailing; circle: clockwise) for known durations; indeterminate ones use an animation for unknown durations.
- Prefer determinate whenever possible, since it lets people decide to wait, retry later or give up.
- Report progress accurately and smooth the pace; racing to near completion and then crawling looks broken or deceptive.
- Keep the indicator visibly moving, since a still one reads as a stall. If the process really stalls, explain the problem and what people can do.
- Convert an indeterminate bar to determinate once the duration becomes known.
- Never swap a spinner for a bar, or a bar for a spinner, mid-task, because shapes and sizes differ and disrupt the layout.
- Add a short, accurate description when it helps; skip vague words like loading or authenticating.
- Use one consistent location for progress across platforms and screens.
- Offer Cancel when stopping is harmless. If stopping loses work, such as a partial download, also offer Pause, and warn with an alert that lets people confirm cancelling or resume.
- iOS, iPadOS refresh control: a hidden activity indicator revealed by dragging down a view to reload content, as in Mail's Inbox (`UIRefreshControl`).
- iOS, iPadOS refresh control: also refresh content automatically on a schedule so people need not trigger every update.
- iOS, iPadOS refresh control: add a title only when it carries value, such as when the last update happened, and never use it to explain how to refresh.
- macOS: indeterminate indicators can be a bar or a circle.
- macOS: prefer a spinner for background operations or tight spaces, like inside a text field or beside a button.
- macOS: do not label a spinner, since it usually appears right after someone starts the action.
- watchOS: indicators are white over the scene background by default; set the tint color to change them.

## Rating indicators

Source: [Rating indicators](https://developer.apple.com/design/human-interface-guidelines/rating-indicators). Applies to: macOS only.

Covers a horizontal row of symbols, stars by default, showing a ranking (`NSLevelIndicator.Style.rating`).

- Know the behavior: values round to whole symbols, never partial ones, and symbols keep a fixed spacing instead of scaling to the control's width.
- In a list of ranked items, let people change a rating inline without opening an editor.
- If you replace the star, choose a symbol whose rating purpose is obvious, since stars are the recognized ranking symbol.
