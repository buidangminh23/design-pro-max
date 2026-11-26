# launch-video

Demo clips for launch and product pages: a UI rebuilt in HTML and CSS and stepped frame by frame in a headless browser, or the real app recorded after consent and a completed pre-flight (record mode, section 4); then encoded into web-ready files and embedded so they load late, start on their first frame and can be paused. It also encodes and checks App Store app previews (section 5). It decides whether a clip is needed at all and checks every step with bundled scripts. Paths are relative to this file's folder.

## 0. Every answer, before anything else

The points runs miss most. Check each one that applies, in your first reply:

- **Slot first.** Show the Slot Read (section 1): size, place on the page, loop or one-shot, and the file budget from `references/encode-recipes.md` (a card is 400 KB per file [LV-WARN-BUDGET]). If the request does not say, ask; do not render first.
- **Recording requests.** Asked to record the real app: name both paths, an HTML and CSS rebuild rendered to video, or record mode (section 4). Record mode starts with the pre-flight in `assets/reference/capture-preflight.md`, filled in with the user at that screen; `scripts/capture-plan.mjs` refuses to plan or run without it [LV-CAP-01]. Never claim a capture happened, never tick items for the user, and never start a capture on your own.
- **App Store previews.** A preview must be a capture of the app itself, recorded by the user or in record mode; never offer a rendered rebuild as a preview. Ask for the display classes, encode each with `scripts/app-preview.mjs` and read `references/app-preview.md` [LV-APP-01] [LV-WARN-FOOTAGE].
- **Live first.** When the source is HTML or CSS that could run on the page, say it can run live with no video bytes, then recommend that or say why a video is still wanted (section 1, option 2).
- **Someone else's clips.** No verdict on how another site made them (section 1); then what the team can do: rebuild and render, or record its own app.
- **Hard rules beat the request.** One codec, autoplay or no pause button still gets the compliant set (section 7). AV1-only or VP9-only: encode H.264 too, list it last, and say why (WebKit plays AV1 only with a hardware decoder) [LV-WARN-AV1]; naming H.264 as a later option does not meet the rule. A transparent clip ships HEVC with alpha, then VP9 with alpha, then H.264 flattened over the background, and the answer or notes say that VP9 alone turns opaque in Safari [LV-WARN-ALPHA].
- **Start images are made, not reused.** Existing posters are not proof of frame 0 [LV-POSTER-01]. Write each from frame 0 (`scripts/encode.mjs`, or `ffmpeg -i <clip> -frames:v 1 <clip>.start.jpg`) and point the lazy `<img>` at it; if the clips are not in the checkout, add a build step that does.
- **Finish the files.** Render or record, encode and check in the same run. Stop to ask only on exit 3 (a sandbox block), exit 2 (a missing tool) or a pre-flight the user has not completed.

## 1. Read the slot before making anything

Write down a Slot Read and show it before or with the build:

| Field | Answer from the page |
|---|---|
| Slot | tile, card, device screen or hero; its CSS width and aspect ratio at each breakpoint |
| Density | rendered at device pixel ratio 2, delivered at 1.3-2.0 video pixels per CSS pixel [LV-WARN-DENSITY] |
| Motion | what changes, as beats; loop or one-shot; how long |
| Alpha | does it sit over a background that shows through? |
| Reader | where it sits relative to the first screen, and what the caption says for someone who never plays it |

Then decide, and say which and why:

1. **A still** when the clip would show one state, a hover or a single transition: the start image alone carries it.
2. **A live replica** when the UI is plain HTML and CSS the page can host: sharp at any density, no video bytes, stops under reduced motion. Costs: its CSS and script ship with the page, and it cannot show the real app.
3. **A rendered clip** when the UI is complex, the clip ships in several places (page, README, social), timing must be exact, or the target cannot run code.
4. **A recording** when it must show the real app (an App Store preview, behaviour a rebuild cannot fake): record mode, section 4.

Never assert how a reference site made its clips. A metadata tag naming a rendering tool is a hint, not proof (ON-9), and a clip that looks like a downscaled screen recording proves nothing either (PV-N2). Library terms are in `references/paths-and-licenses.md`: GSAP and Remotion are not MIT licensed (EC-10, TQ-1).

## 2. Direct the clip

Write the beats as a table (start, end, what moves, what the viewer reads) before building or recording. One idea per clip. Defaults [LV-WARN-DIRECTION]: transitions 300-500 ms, holds of at least 1 s and 1.5 s on a result, typing at 8-12 characters per second, one cursor move of 0.3-0.8 s per target, loops of 4-8 s (PV-N0); measured demos never cut or zoom inside a clip (PV-20). Render at 30 fps unless the motion is fast [LV-WARN-FPS]. End a loop where it began [LV-WARN-SEAM]. Details: `references/direction.md`. Clips are the Media class in `../shared/motion-classes.md`, so a review never holds them to control limits.

## 3. Rebuild the UI in HTML and CSS

- Start from `assets/reference/ui-mock.html`: one original mock that runs live and renders, every moving part on one CSS clock that script reads, so the live page and the frames agree.
- Frame it with `assets/reference/device-frames.css` (generic CSS). Never product photos, store badges, vendor device images, SF Pro or SF Symbols (POL-2); the font stack starts with `system-ui`.
- Use the user's own UI, words and brand. Data is plainly fictional; proof the user has not supplied (ratings, quotes, user counts) is a marked placeholder, never invented (POL-3).
- Size in `rem` tied to the viewport width. Pitfalls: `references/render-html.md`.

## 4. Render, or record the real app

**Render.** `scripts/render-frames.mjs` opens the page at the slot's CSS size and device pixel ratio 2, pauses the page clock and every animation, and for each frame sets each animation's `currentTime`, runs the timers, waits until every image in view has painted and captures it; an image that never paints stops the render with the element and frame named. It writes frames and `render.json` into `$TMPDIR`, then checks them [LV-RENDER-01]. Never use the built-in page recording for a master (PV-11).

**Record.** Read `references/capture.md` first. Fill in the pre-flight with the user: consent, demo data, notifications off, private windows closed, no secrets or other people in view, status bar hidden, region cropped to the slot (POL-1). Then `scripts/capture-plan.mjs --preflight <file> --slot <WxH> --region <x,y,w,h> --duration <s>` checks it [LV-CAP-01], probes whether a screen is visible, and prints the platform command (screencapture or ffmpeg avfoundation on macOS, ffmpeg ddagrab or gdigrab on Windows, x11grab on Linux); `--run` records into the system temporary folder. The region is at least as wide in points as the slot in CSS pixels, so nothing is upscaled [LV-WARN-REGION] (PV-14). When a sandbox, SSH or a missing Screen Recording permission hides the screen it exits 3 with the command for the user to run. Systems without a measured test capture warn [LV-WARN-CAPTURE]. Before encoding, the user reviews every tile of `scripts/contact-sheet.mjs <capture>`; anything private in a frame means recording again.

## 5. Encode

`scripts/encode.mjs <frames folder or master> --out <folder>` writes the clip set and checks it. Profiles: `h264` (always), `vp9`, `av1`. Every file has no audio track [LV-ENC-02], is 4:2:0 in limited range with three colour tags written with `setparams` and read back [LV-ENC-03]; the H.264 file is High profile, moov first [LV-ENC-01]. It writes the start image from frame 0 through the browser's colour conversion [LV-POSTER-01]. `--alpha` writes HEVC with alpha (VideoToolbox, macOS only), VP9 with alpha and H.264 over `--background` [LV-WARN-ALPHA]; VP9 alpha turns opaque in WebKit, HEVC alpha works in both (TQ-20). VideoToolbox fails in the agent sandbox (TQ-31): exit 3 with the command to run outside it. Size targets: `references/encode-recipes.md` [LV-WARN-BUDGET].

App Store previews: `scripts/app-preview.mjs <capture> --device <class> --out <file>` re-encodes a capture into one display class (H.264 High at level 4.0, or ProRes 422 HQ for Apple Vision Pro; exact size; at most 30 fps; 15 to 30 seconds; stereo audio) and checks it [LV-APP-01]. Read `references/app-preview.md` first: sizes, what the footage may show [LV-WARN-FOOTAGE] and bit rates [LV-WARN-BITRATE]. A preview keeps its audio, so [LV-ENC-02] does not apply.

## 6. Embed

Copy `assets/lib/demo-embed.js` and follow `assets/reference/demo-embed.html` and `references/embed-component.md`:

- Markup ships `muted playsinline preload="none"`, no `autoplay`, sources in `data-src`, best codec first and H.264 last [LV-WARN-AV1], and a lazy `<img>` start image instead of the eager `poster` attribute (PV-13).
- The component loads a clip within the load margin, plays it while at least half is visible and pauses it otherwise [LV-WARN-PLAYBACK], and reveals the video after its first presented frame. One clip plays at a time by default (`maxActive: 1`), a choice of the component, not a measured rule.
- Motion over 5 s, which includes every loop, gets a labelled pause button a keyboard reaches and presses [LV-EMBED-02]. Under reduced motion nothing loads or plays until the reader presses Play.
- Save-Data also waits for Play: a component choice; only Chromium sends it (PV-24).

## 7. Hard rules

Each has a check seen failing on a broken fixture. They hold even when the request asks otherwise: deliver the compliant version and say what it adds.

- [LV-ENC-01] Every clip ships an H.264 High, yuv420p, limited-range, moov-first file; never `yuvj420p` or 4:4:4.
- [LV-ENC-02] A muted or decorative clip has no audio stream.
- [LV-ENC-03] Every file carries bt709 primaries and matrix and a bt709 or sRGB transfer tag.
- [LV-POSTER-01] The start image is frame 0 of the clip.
- [LV-EMBED-01] A clip below the fold has no `autoplay`, `preload="none"`, no `poster`, and no source or video bytes until it comes near.
- [LV-EMBED-02] Motion over 5 s has native controls or a labelled pause control that works from the keyboard; under reduced motion nothing plays, also after loading.
- [LV-RENDER-01] A master has duration x fps frames at twice the slot's CSS pixels, every image painted, never the built-in recording.
- [LV-APP-01] An App Store app preview matches its display class: codec, level and container, progressive, exact size, at most 30 fps, 15 to 30 seconds, at most 500 MB, stereo audio at 44.1 or 48 kHz.
- [LV-CAP-01] No screen capture is planned or run without a completed recording pre-flight: three fields filled and eight items ticked.

Warnings: direction [LV-WARN-DIRECTION]; budgets [LV-WARN-BUDGET]; density [LV-WARN-DENSITY]; frame rate [LV-WARN-FPS]; AV1 first, H.264 last [LV-WARN-AV1]; seam [LV-WARN-SEAM]; alpha pair [LV-WARN-ALPHA]; preview bit rates [LV-WARN-BITRATE]; preview footage [LV-WARN-FOOTAGE]; capture region [LV-WARN-REGION]; unmeasured capture systems [LV-WARN-CAPTURE].

## 8. Build in the user's project

1. List every path you will write first, and stop if one exists that you did not create. `demo-embed.js` carries a `launch-video demo-embed.js <version> (design-pro-max)` header and `encode.mjs` writes `<name>.encode.json`; an older version means an earlier release, so ask once whether to upgrade.
2. Rebuild the UI and check it live (section 3), or complete the pre-flight and record (section 4). Captures stay in the system temporary folder, never in the repository.
3. Render frames into `$TMPDIR`, then encode into the project's media folder (section 5).
4. Copy `assets/lib/demo-embed.js`, write the markup and mount it (section 6), then verify (section 10).

## 9. Never ship

- A clip with `autoplay`, `preload="auto"` or `poster` below the fold; an AAC track in an always-muted clip, or a file without colour tags.
- A loop without a pause button, or a play call that skips the reduced-motion check.
- A start image composed separately instead of frame 0, or a master from the built-in page recording.
- HEVC, VP9 or AV1 without an H.264 file last, or VP9 alpha as the only transparent file.
- SF Pro, SF Symbols, product photos, store badges, copied text, or class names and media from another site; claims about how someone else's clips were made.
- A capture made without consent and a completed pre-flight, one whose contact sheet the user has not reviewed, one showing notifications, secrets or other people, or one upscaled to fit the slot.
- An App Store preview made from a rebuild, a mock or another app, or stretched, looped or sped up to fit.

## 10. Verify

From the project folder that holds Playwright (this folder needs no install); media checks call ffmpeg and ffprobe:

```
node <this folder>/scripts/render-frames.mjs --serve mock --page ui-mock.html --slot 640x360 --duration 6 --project .
node <this folder>/scripts/capture-plan.mjs --preflight capture-preflight.md --slot 640x360 --region 120,90,640,360 --duration 6
node <this folder>/scripts/contact-sheet.mjs <capture>
node <this folder>/scripts/encode.mjs <frames folder or capture> --out public/media --name search --profiles h264,vp9,av1
node <this folder>/../shared/check-media.mjs --profile demo --poster public/media/search.start.jpg --slot card --loop public/media/search.av1.webm public/media/search.webm public/media/search.mp4
node <this folder>/scripts/check-embed.mjs --url http://localhost:5173/ --project .
node <this folder>/scripts/app-preview.mjs <capture> --device iphone-6.9 --out previews/iphone-6.9.mp4
```

Output is JSON lines `{rule, level, where, measured, expected}` and a summary; exit 0 passes, 1 an error rule failed, 2 a missing tool or bad usage, 3 a sandbox block (ask the user to approve a rerun outside it or to run the printed command).

## 11. Report

Give the Slot Read and decision, the beat table, the files with sizes against the budget, each check's summary, and the proof boundary: headless Chromium and synthetic media prove frame counts, sizes, encode parameters, load order, gating and controls, not iOS Safari autoplay, Low Power Mode, WebKit's codec pick, device decoding or taste; a capture plan proves the pre-flight and a visible screen, not what it showed (the contact sheet review covers that). Say what to check on a device.

## 12. Routing

- Scrubbing a clip with scroll: `launch-scroll` in this skill.
- Remotion, HyperFrames or GSAP: their own skills; one web animation that is not a clip: `animate`; springs and gestures: `apple-design`; if installed.
- Spacing: `design-spacing-rhythm`; icons: `icons-pro-max`; if installed.
- Narration, AI footage, long films and HLS: not covered; say so. App Store screenshots: `app-store-screenshots`, if installed.
