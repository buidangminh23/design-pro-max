# launch-scroll

Pinned web scenes driven by scroll: a sticky stage that changes while the reader scrolls, and films or image sequences scrubbed frame by frame. This part decides whether a section should pin at all, builds it on a static baseline, and checks it with the bundled probe. Paths below are relative to this file's folder.

## 1. Read the scene before building

Ask, and write the answers down as a beat table (progress window, what changes, which element):

1. What changes on screen while the reader scrolls through this section? If nothing changes, or the change is one reveal that plays once, **do not pin**: use a normal section with a one-time reveal (see `../shared/motion-classes.md`) and stop here.
2. Is the change continuous and tied to position (a device turning, a film advancing, a diagram assembling)? Then pin.
3. How tall is the stage's content, and how tall is the page's sticky chrome (a fixed nav)? Both decide the short-viewport gate [LS-GATE-02]. Take them from this page, never from another site's measurements.
4. How much travel does the story need? Aim for 70-300vh [LS-WARN-TRAVEL]; more asks the reader to scroll through too little change.
5. Is there a film? Then plan its sources, start image and still now (`references/scrub-video.md`).

## 2. Choose the engine

- **CSS scroll timeline** (`assets/reference/scene-css.html`): no script; pins only inside `@supports (animation-timeline: view())` with motion allowed, over a finished static layout [LS-WARN-SUPPORTS]. Firefox stable gets the static page (TQ-14). Best when the stage has a fixed height and no film.
- **One JS progress value** (`assets/lib/scene-progress.js`, `assets/reference/scene-js.html`): the default when gates need script, the stage height depends on content, or a film scrubs. It writes one clamped value to `--scene-progress` and children read it.
- **GSAP ScrollTrigger**: only for labelled timelines with many overlapping tweens or callbacks. It is free for sites and apps but not open source (TQ-1), and GSAP with ScrollTrigger adds about 44.9 KB gzipped (TQ-23). For its API, use the `gsap-scrolltrigger` skill if it is installed.

Whatever the engine, the stage animates `transform` and `opacity` only, and the static layout is the end state.

## 3. Hard rules

Each has a check that was seen failing on a broken fixture; `scripts/probe-scene.mjs` or `../shared/check-media.mjs` reports it.

- [LS-GATE-01] Under reduced motion, or when a muted `play()` probe is rejected (blocked autoplay, iOS Low Power Mode), the scene stays in normal flow at its end state and requests no film.
- [LS-GATE-02] The scene does not pin when the viewport is shorter than the stage's content height plus the sticky offset.
- [LS-GEOM-01] The box is its travel plus 100vh; the sticky child fills the viewport below its offset and stays put for the whole travel; progress stays in [0, 1] and never runs backwards on a forward sweep.
- [LS-VID-01] Scrub files: a closed GOP with a keyframe at least every 8 frames, yuv420p, no audio, moov before mdat.
- [LS-VID-02] Every set of sources for a film includes an H.264 file; HEVC, VP9 or AV1 never ship alone.
- [LS-VID-03] The driver never writes `currentTime` while the video is seeking and never calls `fastSeek()`.
- [LS-VID-04] The film is seekable wherever it is served: a Blob URL, MediaSource, or 206 Range responses.
- [LS-VID-05] The start image is frame 0 of the film (SSIM at least 0.99) and the video stays hidden until it has presented a frame.

Warnings (guidance, not failures): smoothing is time-based or absent [LS-WARN-SMOOTH]; a closed GOP of 6 frames, 5 above 30 fps [LS-WARN-GOP]; image sequences only for short films, alpha or software decode, with the memory shown [LS-WARN-SEQ]; stacked blur tested on a software proxy [LS-WARN-BLUR]; VP9 never the default codec [LS-WARN-VP9]; colour tags written [LS-WARN-COLOR]; HEVC tagged hvc1 [LS-WARN-HEVC].

## 4. Recipes

Read the reference the task needs, in full:

| Need | Read |
|---|---|
| Box geometry, progress, sticky offsets, the CSS and JS engines | `references/engines-and-geometry.md` |
| Encoding, loading, seeking and revealing a scrubbed film | `references/scrub-video.md` |
| Image sequences instead of video, memory budgets | `references/frame-sequences.md` |
| Gates, reduced motion, keyboard and screen readers | `references/gates-and-a11y.md` |
| Motion classes: which motion may run long and which must stay short | `../shared/motion-classes.md` |
| Every rule's evidence | `references/evidence.md` |

## 5. Build in the user's project

1. List every path you will write before writing any, and stop if one exists that you did not create. The library files start with a `launch-scroll ... (design-pro-max)` header; an older header means an earlier release, so ask once whether to upgrade them.
2. Copy `assets/lib/scene.css`, `assets/lib/scene-progress.js`, and for a film `assets/lib/seek-queue.js` and `assets/lib/scrub-loader.js` into the project. They have no dependencies.
3. Mark up the scene: `[data-scene]` (the tall box), `[data-scene-sticky]` (its child), `[data-scene-stage]` (the content whose height the gate measures). Set `--scene-travel` and, under a fixed nav, `--scene-sticky-top`. For a film add `[data-scene-film]` holding the still, the start image and `<video data-scrub>` with `<source data-src>` children, H.264 first.
4. For a film, encode it with `scripts/encode-scrub.mjs` (it writes the film, the start image, the still and a manifest, then checks its own output).
5. Mount: `createScene(element)` for a plain scene, `mountScrubScene(element)` for a film.
6. Verify (section 7).

## 6. Never ship

- A pinned scene without a finished static layout, or content that is hidden until script runs.
- `currentTime` written from a raw scroll handler, or `fastSeek()`.
- An HEVC, VP9 or AV1 film without an H.264 source, or a start image that is a separately composed still.
- `preload="auto"` as the loading plan (SC-15): load the film in a scroll-ahead window instead.
- Smoothing as a fixed fraction per frame (AM-10).
- Thresholds, type sizes, breakpoints, class names or media copied from another site; measured values elsewhere are context, never defaults.
- SF Pro, SF Symbols, Apple product images or store badges in web output.

## 7. Verify

Run the probe against the page, from the project folder that holds Playwright (it never installs anything; exit 2 means a missing tool, with the install command):

```
node <absolute path to this folder>/scripts/probe-scene.mjs --url http://localhost:5173/ --project .
node <absolute path to this folder>/scripts/probe-scene.mjs --serve dist --page index.html --server 200 --project .
node <absolute path to this folder>/../shared/check-media.mjs public/film.mp4 public/film.webm
```

`--server 200` serves the folder like an origin without Range support. Output is JSON lines `{rule, level, where, measured, expected}` and a summary; exit 0 passes, 1 means an error rule failed, 2 a missing tool or bad usage, 3 a sandbox block. On exit 3, ask the user to approve a rerun outside the sandbox or to run the printed command; never leave the sandbox on your own.

## 8. Report

Give the user: the beat table; which engine and why; what the static layout shows and when it is used (reduced motion, rejected probe, short viewport, no support); the probe's summary line with any errors fixed; and the proof boundary: headless Chromium and synthetic media prove structure, gating, load order and encode parameters, not iOS Safari, Low Power Mode, real device frame rates or taste. Say which of those the user should check on a device.

## 9. Routing

- GSAP APIs: `gsap-scrolltrigger` and the other GSAP skills, if installed.
- Springs, gestures and sheet motion on the web: `apple-design`, if installed. One web animation that is not scroll-linked: `animate`, if installed.
- Whether a CSS feature is Baseline: `modern-web-guidance`, if installed.
- Making the film itself from code (a rendered UI or animation): not covered yet; launch-video arrives in a later release. Say so.
