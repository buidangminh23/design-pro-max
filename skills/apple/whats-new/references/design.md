# Designing the popup

## Contents

- One card
- A pager
- The design tokens
- Media
- Motion
- Copy and localization
- How many pages

## One card

One feature gets one card and nothing that suggests more [WN-NAV-01]:

- A white card in light mode and a dark one in dark mode, centred over a dimmed app, with a large corner radius and generous padding.
- A close button at the top right: a small grey circle with an X, inside a hit area of Apple's recommended size [WN-WARN-TARGET44], named "Close" [WN-DIALOG-01].
- The media frame across the full content width, with a fixed aspect ratio (16:9 unless the popup sets another) and its own, smaller corner radius [WN-LAYOUT-01].
- Below it, on the left: a badge (one word, uppercase, letter-spaced, a tinted accent pill), the title (bold, one line if it can), and the description in the secondary text colour, about three lines at most [WN-WARN-TEXT].
- On the right, aligned to the bottom of the text: the primary button, a filled accent pill reading "Got it", which dismisses.

No arrows, no dots, no counter, no "1 of 1".

## A pager

Two to five features share one card that changes its content, not its size:

- A navigation row centred between the media and the text: the previous arrow, the page dots, the next arrow [WN-NAV-01].
- The arrows are round buttons named "Previous feature" and "Next feature". On the first page the previous arrow is disabled, on the last the next arrow is; both stay visible, so nothing in the row moves.
- One dot per page, the current one filled. Each dot is a button that jumps to its page, named "Feature N of M", with a hit area padded to at least 24x24 CSS px even when the drawn dot is small [WN-TARGET-01]; the current one carries `aria-current="true"`. The current dot takes the ink colour and the others a mid grey that stays distinct from the card in both schemes.
- The primary button reads "Next" on every page but the last and "Got it" on the last. It keeps one width: both labels are laid out and the inactive one is hidden, so the button does not jump when the label changes.
- Every page is rendered in the same grid cell, inactive ones hidden with `visibility: hidden`, `inert` and `aria-hidden`; the card is as tall as its tallest page and keeps that height on every page [WN-LAYOUT-01].
- The pager region is a group with `aria-roledescription="carousel"` and a label that does not contain the word carousel ("What's new"); each page is a group with `aria-roledescription="slide"` labelled "N of M"; the wrapper is `aria-live="polite"` so a page change is announced.
- No auto-advance by default [WN-WARN-AUTOADVANCE]. An integrator who turns it on gets a rotation control first in the tab order, and advance stops on focus and pauses on hover. On a card narrower than `520px` that control moves to the top corner opposite the close button, so it never overlaps the previous arrow.

## The design tokens

`assets/lib/whats-new.css` holds every value as a custom property on `.wn`; change the token, not the rules:

| Token | Default | Notes |
|---|---|---|
| `--wn-width` | `min(620px, 100vw - 32px)` | the card never touches the window edge |
| `--wn-pad` | `32px` | padding inside the card |
| `--wn-radius`, `--wn-media-radius` | `28px`, `20px` | the media radius is smaller than the card's |
| `--wn-aspect` | `16 / 9` | one ratio per popup, set through `aspectRatio` |
| `--wn-accent`, `--wn-on-accent` | a system-like blue, white | the primary button and the badge tint |
| `--wn-duration`, `--wn-shift` | `220ms`, `24px` | page change: a short slide plus a fade |

The light and dark sets are both in the file; every text pair holds 4.5:1 against its background in both [WN-WARN-CONTRAST] (WH-6).

Type: the badge at `13px` semibold with `0.06em` tracking, the title at `24px` bold with `1.2` line height, the description at `15px`. Below `520px` the primary button moves under the text and spans the card.

On Apple platforms let the system colours and fonts do this work: the accent colour, the secondary label colour, the title and body text styles, and the system materials for the sheet. Match the layout, not the hex values.

## Media

- **Image**: one still per page, cropped to the frame's ratio. Give it alt text that says what the feature does, or an empty alt when the title already says it all. Decode lazily.
- **Video**: a short screen clip of the feature, muted, with no audio track, a poster from its first frame, `playsinline`, `loop`, and `preload="metadata"` on pages that are not showing [WN-MEDIA-01]. Only the current page's video plays; leaving a page pauses and rewinds it. If `play()` is rejected, show the poster and a play button. A loop longer than 5 s gets a visible pause and play toggle with an accessible name [WN-MEDIA-01] (PV-21).
- **Nothing**: a card without media is fine for a small change; keep the frame out rather than showing an empty box, and use the same choice on every page of a pager.
- Bundle media with the app, or serve it from the web app's own origin; never make people wait for a download the first time the app opens after an update.
- Draw the feature itself, from the app: a screenshot or clip of the new screen. Never use Apple's product images, screenshots or marketing art.

## Motion

- A page change slides the content a short distance and fades it; the card itself never moves or resizes.
- Under reduced motion the change is instant or a plain fade, with no transform, and no video starts by itself: the poster shows with a play button [WN-MOTION-01]. Listen to the setting live; people switch it while the app runs.
- The popup itself fades in; it never zooms, bounces or slides in from an edge.

## Copy and localization

- Badge: one word that names the kind of change (New, Redesigned, Faster). Title: what people can now do, in their words, not the internal feature name. Description: one or two sentences on why it matters and where to find it.
- Labels to translate: Close, Previous feature, Next feature, Next, Got it, the "N of M" page label, the "Feature N of M" dot label, the region label, Pause video, Play video, All release notes, and the "What's New…" menu item. The lib takes them as `labels` with `{n}` and `{m}` placeholders; the Swift reference takes `WhatsNewLabels` with `%d` placeholders. A Vietnamese set ships in both as an example ("Hiểu rồi" for Got it, "Tiếp" for Next).
- Check the longest translation on the card: titles that wrap to three lines or descriptions past about three lines need shorter copy, not a smaller font [WN-WARN-TEXT].
- Right-to-left languages: the lib swaps the arrow keys' direction; mirror the arrow glyphs too.

## How many pages

- One page when one change matters; a pager for two to five. More than five is a warning [WN-WARN-COUNT]: people stop reading, and the guidelines advise against long rows of dots. Merge related changes into one page, or keep the top ones and link the rest with "All release notes".
- People who skipped versions see the current version's pages only, never a stack of every version they missed.
