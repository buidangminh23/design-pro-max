# Engines and geometry

How a pinned scene is built, how progress is measured, and how the CSS and JS engines express the same scene.

## Contents

- Geometry
- Progress
- The JS engine (`scene-progress.js`)
- The CSS engine (scroll timelines)
- Mapping progress to the stage
- GSAP, when it earns its weight

## Geometry

A pinned scene is a tall box with one sticky child (AM-12):

- The box's height is the scene's travel plus 100vh (AM-12). Travel is how far the reader scrolls while the stage is pinned.
- The sticky child is as tall as the viewport below the page's sticky chrome: `top` is the chrome's height, and the height is 100vh (or svh, or lvh) minus that offset. Under those two, the child stays pinned exactly while progress runs from 0 to 1 [LS-GEOM-01].
- The stage is the content inside the sticky child. Give it an intrinsic height (fixed sizes, aspect ratios, a max height in pixels), not one that follows the viewport, so the short-viewport gate can measure it.

`assets/lib/scene.css` encodes this and pins only when `data-scene-state="pinned"`; without that attribute the scene is a normal section. Set `--scene-travel` per scene and `--scene-sticky-top` under a fixed nav.

Mobile: svh keeps the sticky child inside the smallest visible viewport, so collapsing browser toolbars never cut the stage. lvh fills the largest one and may leave content under the toolbar; prefer svh unless the stage is decoration.

## Progress

Progress is 0 when the box's top meets the viewport's top and 1 when its bottom meets the viewport's bottom: `clamp(-top / (height - innerHeight), 0, 1)`. One value drives the whole scene (ON-2); everything else is derived from it.

- Clamp it. Unclamped values overshoot at both ends, and anything keyed to them jumps [LS-GEOM-01].
- Compute it only while the scene is near the viewport (an IntersectionObserver), and only in a scroll handler that does no layout writes.
- Map it linearly, then shape individual beats with easing (AM-10). If the stage needs smoothing, use a time constant, not a fraction per frame: per-frame factors settle at a speed that depends on the refresh rate (AM-10), so use time-based smoothing with a time constant of about 100 ms, or none (SC-N0) [LS-WARN-SMOOTH]. A scrubbed film takes progress unsmoothed (AM-17).

## The JS engine

`createScene(element, options)` from `assets/lib/scene-progress.js`:

- Starts static and pins only when every gate passes: reduced motion is off, the stage fits (stage height plus sticky offset at most the viewport height), and any extra gate the caller passes as a promise (a film passes the muted `play()` probe) [LS-GATE-01] [LS-GATE-02].
- Re-checks the gates on resize and when the reduced-motion preference changes; collapsing writes progress 1, the end state.
- Writes `--scene-progress` on the box with four decimals and calls `onProgress(progress, state)`.
- Options: `smoothingMs` (0 means none), `nearMargin` (the IntersectionObserver margin), `gate`, `onProgress`, `onState`. The returned object has `state`, `progress`, `block(reason)` and `destroy()`.

## The CSS engine

`assets/reference/scene-css.html` pins with no script:

- Register `--scene-progress` with `@property` as a number whose initial value is 1, so every browser without the feature shows the end state.
- Inside `@supports (animation-timeline: view())` and a motion-allowed media query, give the box its travel and animate `--scene-progress` from 0 to 1 on `animation-timeline: view()` over `animation-range: contain 0% contain 100%`. For a box taller than the viewport that range is exactly the pinned stretch.
- Add the short-viewport gate as a height media query in the same block: the stage's height plus the sticky offset.
- Firefox stable has no scroll timelines (TQ-14), so it shows the static layout; check that layout there [LS-WARN-SUPPORTS].

## Mapping progress to the stage

- Read `--scene-progress` in `calc()`: `transform: scale(calc(1.6 - 0.6 * var(--scene-progress)))`. Transform and opacity stay on the compositor; layout properties do not.
- Beats are windows of progress. Remap a window to its own 0 to 1 in JS (`(p - start) / (end - start)`, clamped), or in CSS with `clamp()`.
- Text that the reader must read sits in the DOM in reading order and is visible in the static layout; only its motion depends on progress.

## GSAP, when it earns its weight

Use ScrollTrigger for labelled timelines, many overlapping tweens or callbacks at labels. Its licence is free for sites and apps but not open source (TQ-1), and GSAP with ScrollTrigger adds about 44.9 KB gzipped (TQ-23), against nothing for CSS timelines. When it is used, the same rules hold: a static baseline, the gates, a clamped progress, and no layout properties in the timeline. Use the `gsap-scrolltrigger` skill for its API if it is installed.
