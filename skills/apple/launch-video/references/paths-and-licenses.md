# Live replica or rendered clip

Four ways to show a product in motion on a page, what each costs, and the licence terms of the tools around them. The choice comes from the Slot Read in `PART.md`, never from what another site appears to do.

## The four paths

| Path | Bytes on the page | Sharpness | Reduced motion | Upkeep | Use when |
|---|---|---|---|---|---|
| Still (the start image only) | one image | fixed | nothing to stop | none | the clip would show one state, a hover or one transition |
| Live replica (the HTML and CSS mock on the page) | its CSS and script | sharp at any density | the mock shows its end state | changes with the UI it copies | the UI is plain HTML and CSS, the page can host it, and the clip shows one idea |
| Rendered clip (this part's renderer and encoder) | one video set and a start image | fixed at the rendered density | the start image, nothing plays | re-render when the UI changes | the UI is complex, the clip ships in several places, timing must be exact, or the target cannot run code |
| The user's own recording | one video set and a start image | as recorded | the start image | re-record | the user already has it; this part only encodes and embeds it |

A live replica and a rendered clip can share one source: `assets/reference/ui-mock.html` runs on a page and renders to frames. Build the mock first, show it live, then decide whether the page should run it or carry the clip.

Recording the real app on screen is not covered in this release. Say so, and offer the rebuild or the user's own recording instead.

## Never assert how a reference site made its clips

People ask whether a product site drew its clips in code or recorded them. Neither kind of evidence settles it:

- A metadata tag inside a clip that names a rendering tool is a hint, not proof: tags survive re-encoding and can be written by any pipeline (ON-9).
- A clip that looks like a downscaled screen recording, with a full-size pointer and real wallpapers, shows only how it looks (PV-N2).

Report what each points to, say that neither proves the method, and move on to what the user's page needs.

## Tools and their terms

Not legal advice; read each licence before shipping.

| Tool | Role here | Terms |
|---|---|---|
| Playwright | drives headless Chromium for rendering and checks; loaded from the user's project, never bundled | Apache License 2.0 |
| ffmpeg and ffprobe | encoding and probing; called, never bundled | LGPL, or GPL when built with GPL parts such as libx264 |
| GSAP | a timeline library some mocks use | its own no-charge licence, free for sites and apps, not an open-source licence (TQ-1, EC-10) |
| Remotion | a React video framework, with its own skill | free for individuals, non-profits and small companies; a company licence above that size (EC-10) |

The renderer here needs no animation library: CSS animations, the Web Animations API and `requestAnimationFrame` all step frame by frame. When the user already uses Remotion or another video framework, route to its own skill instead of mixing the two. Check the licence of any other renderer before recommending it.
