# launch-video

Demo clips for launch and product pages, rendered from code: a UI rebuilt in HTML and CSS, stepped frame by frame in a headless browser, encoded into web-ready files and embedded so they load late, start on their first frame and can be paused. This part decides whether a clip is needed at all, and checks every step with the bundled scripts. Real screen recording of an app is not covered in this release. Paths below are relative to this file's folder.

## 0. Every answer, before anything else

These are the points runs miss most. Check each one that applies, in your first reply:

- **Slot first.** Show the Slot Read (section 1): the slot's size, its place on the page, loop or one-shot, and its file budget from the table in `references/encode-recipes.md` (a card is 400 KB per file [LV-WARN-BUDGET]). If the request does not say, ask; do not render first.
- **Recording requests.** Asked to record or capture the real app: say plainly that this part does not record a real app's screen, then offer both paths in so many words: (1) an HTML and CSS rebuild rendered to video, or (2) the user records the app and you encode that clip and embed it on the page (sections 5 and 6). Name both the encoding and the embedding. Never imply a capture will happen.
- **Live first.** When the source is HTML or CSS that could run on the page (a CSS animation, a mock), say it can run live with no video bytes, then either recommend that or say why a video is still wanted (section 1, option 2).
- **Someone else's clips.** Asked how another site made its clips: give no verdict either way (section 1), then turn to what the team can do: rebuild its own UI in HTML and CSS and render it, or encode and embed its own recording.
- **Hard rules beat the request.** A request for one codec, autoplay or no pause button still gets the compliant set (section 7). An AV1-only or VP9-only request: encode the H.264 file too and list it last in the markup, then say why (WebKit plays AV1 only with a hardware decoder) [LV-WARN-AV1]. Mentioning H.264 as an option the user may add later does not meet the rule. A transparent clip ships HEVC with alpha, then VP9 with alpha, then H.264 flattened over the background colour, and the answer or the delivered notes must say, in these words or close to them, that VP9 alone turns opaque in Safari [LV-WARN-ALPHA].
- **Start images are made, not reused.** Existing poster or thumbnail images are not proof of frame 0 [LV-POSTER-01]. Write each start image from frame 0 of its clip (`scripts/encode.mjs` writes it, or `ffmpeg -i <clip> -frames:v 1 <clip>.start.jpg`) and point the lazy `<img>` at that new file. If the clips are not in the checkout, still add that step to the project (a script or a build target that writes every start image from frame 0) and point the markup at its output, so the old pictures are never shipped as start images.
- **Finish the files.** Render, encode and check in the same run. Stop to ask only on exit 3 (a sandbox block) or a missing tool (exit 2); a probe that succeeds is not a reason to stop and wait.

## 1. Read the slot before making anything

Write down a Slot Read and show it to the user before or with the build:

| Field | Answer from the page |
|---|---|
| Slot | tile, card, device screen or hero; its CSS width and aspect ratio at each breakpoint |
| Density | the clip is rendered at device pixel ratio 2 and delivered at 1.3-2.0 video pixels per CSS pixel [LV-WARN-DENSITY] |
| Motion | what changes, as beats; a loop or a one-shot; how long |
| Alpha | does it sit over a background that shows through? |
| Reader | where it sits relative to the first screen, and what the caption says for someone who never plays it |

Then decide, and say which and why:

1. **A still** when the clip would show one state, a hover or a single transition. The start image alone carries it; no video.
2. **A live replica** when the UI is plain HTML and CSS that the page can host: the mock itself runs on the page, sharp at any density, with no video bytes, and it stops under reduced motion. Costs: its CSS and script ship with the page, and it cannot show the real app.
3. **A rendered clip** when the UI is complex, the same clip ships in several places (page, README, social), the timing must be exact, or the target cannot run code.
4. **A screen recording** of the real app: not covered yet. Say so, and offer either an HTML and CSS rebuild rendered to video, or encoding and embedding the user's own recording with sections 6 and 7.

Never assert how a reference site made its clips. A metadata tag that names a rendering tool is a hint, not proof (ON-9), and a clip that looks like a downscaled screen recording proves nothing either (PV-N2). Say what each points to and that neither settles it.

Library choices and their terms are in `references/paths-and-licenses.md`: GSAP and Remotion are not MIT licensed (EC-10, TQ-1).

## 2. Direct the clip

Write the beats as a table (start, end, what moves, what the viewer reads) before building. One idea per clip. Defaults [LV-WARN-DIRECTION]: transitions 300-500 ms, holds of at least 1 s and 1.5 s on a result, typing at 8-12 characters per second, one cursor move of 0.3-0.8 s per target, loops of 4-8 s (PV-N0); measured demos never cut or zoom inside a clip (PV-20). Render at 30 fps unless the motion is fast [LV-WARN-FPS]. End a loop where it began, so the seam does not jump [LV-WARN-SEAM]. Details: `references/direction.md`. Clips are the Media class in `../shared/motion-classes.md`: their timings are media timings, so a review never holds them to control limits.

## 3. Rebuild the UI in HTML and CSS

- Start from `assets/reference/ui-mock.html`: one original mock that runs live and renders. Every moving part hangs on one CSS clock animation; script reads that clock, so the live page and the frames agree.
- Frame it with `assets/reference/device-frames.css` (a browser window, a laptop, a phone, all generic CSS). Never use product photos, store badges, a vendor's device images, SF Pro or SF Symbols (POL-2); the font stack starts with `system-ui`.
- Use the user's own UI, words and brand. Data shown in the mock is plainly fictional, and proof the user has not supplied (ratings, quotes, user counts) appears as a marked placeholder, never invented (POL-3).
- Size everything in `rem` from a root size tied to the viewport width, so the slot's width sets the composition.

Details and pitfalls: `references/render-html.md`.

## 4. Render

`scripts/render-frames.mjs` opens the page at the slot's CSS size and device pixel ratio 2, installs and pauses the page clock, pauses every animation and, for each frame, sets each animation's `currentTime`, runs the page timers to that time, waits until every image in view has decoded and painted, and captures the frame. An image that never paints stops the render with the element and the frame named. It writes `frame-00000.png` onwards and `render.json` into `$TMPDIR`, then checks them [LV-RENDER-01].

Never use the browser's built-in page recording for a master: it writes VP8 at 25 fps in CSS pixels, with extra frames at both ends, while stepping frames gives exact frame counts at true 2x (PV-11).

## 5. Encode

`scripts/encode.mjs <frames folder or master> --out <folder>` writes the clip set and checks it. Profiles: `h264` (always), `vp9`, `av1`. Every file is muted with no audio track [LV-ENC-02], 4:2:0 in limited range, and carries the three colour tags written with `setparams` and read back [LV-ENC-03]; the H.264 file is High profile with the moov box first [LV-ENC-01]. It also writes the start image, frame 0 through the browser's colour conversion [LV-POSTER-01]. With `--alpha` it writes HEVC with alpha (VideoToolbox, macOS only), VP9 with alpha, and H.264 flattened over `--background` [LV-WARN-ALPHA]. VP9 with alpha keeps its transparency in Chrome and turns opaque in WebKit, while HEVC with alpha works in both (TQ-20). The VideoToolbox encoder fails inside the agent sandbox (TQ-31): the script then exits 3 and prints the command to run outside it. Ask the user to approve that rerun or run it; never leave the sandbox on your own. Size targets per slot are in `references/encode-recipes.md` [LV-WARN-BUDGET].

## 6. Embed

Copy `assets/lib/demo-embed.js` and follow `assets/reference/demo-embed.html` and `references/embed-component.md`:

- Markup ships `muted playsinline preload="none"`, no `autoplay` attribute, sources in `data-src`, best codec first and H.264 last [LV-WARN-AV1], and a lazy `<img>` start image instead of the `poster` attribute, which loads eagerly (PV-13).
- The component gives a clip its sources when it comes within the load margin, plays it while at least half is visible and pauses it otherwise [LV-WARN-PLAYBACK], and reveals the video only after its first presented frame. By default it also lets one clip play at a time (`maxActive: 1`); that is a choice of the component, not a measured rule.
- A clip that moves on its own for over 5 s, which includes every loop, gets a labelled pause button that a keyboard reaches and presses [LV-EMBED-02]. Under reduced motion nothing loads or plays until the reader presses Play.
- Under Save-Data, too, nothing loads or plays until the reader presses Play; like `maxActive`, that is a choice of the component, not a measured rule, and only Chromium browsers send the signal (PV-24).

## 7. Hard rules

Each has a check that was seen failing on a broken fixture. These rules hold even when the request asks for the opposite (autoplay, one codec, no pause button): they protect readers who cannot waive them. Deliver the compliant version in code and commands, and say in a sentence or two what it adds.

- [LV-ENC-01] Every clip ships an H.264 High, yuv420p, limited-range, moov-first file; never `yuvj420p` or 4:4:4.
- [LV-ENC-02] A muted or decorative clip has no audio stream.
- [LV-ENC-03] Every file carries bt709 primaries and matrix and a bt709 or sRGB transfer tag.
- [LV-POSTER-01] The start image is frame 0 of the clip.
- [LV-EMBED-01] A clip below the fold has no `autoplay` attribute, `preload="none"`, no `poster` attribute, and no source or video bytes until it comes near.
- [LV-EMBED-02] Motion over 5 s has native controls or a labelled pause control that works from the keyboard, and under reduced motion nothing plays, also after loading.
- [LV-RENDER-01] A master has duration x fps frames at twice the slot's CSS pixels, every image painted, never the built-in recording.

Warnings (guidance, not failures): direction bands [LV-WARN-DIRECTION]; slot budgets [LV-WARN-BUDGET]; delivered density [LV-WARN-DENSITY]; frame rate [LV-WARN-FPS]; AV1 first and H.264 last [LV-WARN-AV1]; loop seam [LV-WARN-SEAM]; the alpha pair [LV-WARN-ALPHA].

## 8. Build in the user's project

1. List every path you will write before writing any, and stop if one exists that you did not create. `demo-embed.js` starts with a `launch-video demo-embed.js <version> (design-pro-max)` header and `encode.mjs` writes `<name>.encode.json` with its version; an older version means an earlier release, so ask once whether to upgrade.
2. Rebuild the UI (section 3) and check it live in a browser first.
3. Render frames into `$TMPDIR` (section 4), then encode them into the project's media folder (section 5).
4. Copy `assets/lib/demo-embed.js`, write the markup and mount it (section 6).
5. Verify (section 10).

## 9. Never ship

- A clip with the `autoplay` attribute, `preload="auto"` or the `poster` attribute below the fold.
- An AAC track in a clip that is always muted, or a file without colour tags.
- A loop without a pause button, or a play call that skips the reduced-motion check.
- A start image composed separately instead of frame 0, or a master from the built-in page recording.
- HEVC, VP9 or AV1 without an H.264 file last, or VP9 with alpha as the only transparent file.
- SF Pro, SF Symbols, product photos, store badges, copied text, or class names and media from another site.
- Claims about how someone else's clips were made.

## 10. Verify

Run the scripts from the project folder that holds Playwright. This folder has no `package.json` and needs no install; the scripts load Playwright from `--project`, and media checks call ffmpeg and ffprobe:

```
node <absolute path to this folder>/scripts/render-frames.mjs --serve mock --page ui-mock.html --slot 640x360 --duration 6 --project .
node <absolute path to this folder>/scripts/encode.mjs <frames folder> --out public/media --name search --profiles h264,vp9,av1
node <absolute path to this folder>/../shared/check-media.mjs --profile demo --poster public/media/search.start.jpg --slot card --loop public/media/search.av1.webm public/media/search.webm public/media/search.mp4
node <absolute path to this folder>/scripts/check-embed.mjs --url http://localhost:5173/ --project .
node <absolute path to this folder>/scripts/render-frames.mjs --check <frames folder or master video> --slot 640x360 --duration 6
```

Output is JSON lines `{rule, level, where, measured, expected}` and a summary; exit 0 passes, 1 means an error rule failed, 2 a missing tool or bad usage, 3 a sandbox block. On exit 3, ask the user to approve a rerun outside the sandbox or to run the printed command.

## 11. Report

Give the user: the Slot Read and the decision; the beat table; the files written with their sizes against the slot budget; the summary lines of each check with any errors fixed; and the proof boundary: headless Chromium and synthetic media prove frame counts, pixel sizes, encode parameters, load order, gating and controls, not iOS Safari autoplay, Low Power Mode, which codec WebKit picks, real device decoding or taste. Say which of those to check on a device.

## 12. Routing

- Scrubbing a clip with scroll: `launch-scroll` in this skill.
- Remotion compositions or HyperFrames templates: their own skills, if installed. GSAP timelines: the GSAP skills, if installed.
- One web animation that is not a clip: `animate`, if installed. Springs and gestures: `apple-design`, if installed.
- Spacing of the page around the clip: `design-spacing-rhythm`, if installed. Icons: `icons-pro-max`, if installed.
- Narration, AI footage, long films with audio, HLS streaming and app store preview videos: not covered; say so.
