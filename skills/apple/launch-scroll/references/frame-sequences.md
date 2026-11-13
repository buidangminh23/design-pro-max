# Image sequences instead of video

A canvas that draws one image per progress step. It is frame-exact and needs no seeking, but it costs bytes and memory, so it is the exception [LS-WARN-SEQ].

## Contents

- When a sequence is the right call
- The costs, before choosing
- Making the frames
- The frame window
- Building the scene
- Checking it

## When a sequence is the right call

- The film is short.
- It needs alpha in every browser.
- The target devices decode video in software, where seeks are slow.
- Video seeking misbehaves on a target browser and cannot be fixed with a short closed GOP.

Otherwise use a scrubbed film (`references/scrub-video.md`). When unsure, measure both (see "Checking it").

## The costs, before choosing

- Bytes: at matched quality a sequence costs 1.95-5.3 times the bytes of a closed GOP-6 film, depending on content (SC-11), and about 3.7 times a long-GOP file (TQ-N0). Prefer AVIF, then WebP, then JPEG.
- Memory: each decoded frame holds width x height x 4 bytes, so decoding every frame costs frames x width x height x 4 bytes (SC-12). Work it out and show it to the user before building, for a phone breakpoint and a desktop one. For example `600 x 1920 x 1080 x 4` is about `4.98 GB`, which no phone can hold; `60 x 640 x 360 x 4` is about `55 MB`.
- Decode time: decoding one frame takes milliseconds, and WebKit does not decode in parallel (SC-12), so decode only what the next few steps need.

`scripts/make-sequence.mjs --dry-run` prints both decoded totals (every frame, and the window below) without writing anything.

## Making the frames

```
node <this part>/scripts/make-sequence.mjs master.mov --out public/sequence --width 960 --format avif
```

It cuts the master into `frames/f0000.<ext>` onwards, writes `startframe.jpg` (frame 0; for `jpg` a copy of `f0000.jpg`), `still.jpg` (the last frame, for the static layout) and `sequence.json` (count, size, format and the frame template), then prints the decoded memory, the download total and, for a lossy format at the default quality, the size range a GOP-6 film of the same clip would have at matched quality. A `--width` wider than the master is clamped to it, and the manifest states the size the frames really have. Everything is made in a staging folder and moved into place at the end, so a failed run leaves an earlier sequence as it was. It refuses when every decoded frame together would exceed its budget (`--budget-mb`, printed with the totals) unless given `--force`; the answer to a refusal is usually a film, a shorter clip, a smaller `--width` or a lower `--fps`, not `--force`. Like the film encoder, it lists every path first and stops on a file it did not write. `jpg` and `png` work with any ffmpeg; `webp` needs libwebp and `avif` an AV1 encoder, and the script says which is missing.

## The frame window

`assets/lib/frame-window.js` keeps the encoded files (the download, held in memory once fetched) and decodes only a window of frames around the current one (expensive), closing every `ImageBitmap` that leaves it. With radius `r` the decoded memory is `(2r + 1) x width x height x 4` bytes, plus the decodes in flight, whatever the length of the sequence (SC-12); `radiusForBudget()` turns a memory budget into a radius and returns -1 when the budget cannot hold a single frame. Frames nearest the current one decode first, ties going to the direction of travel, and a step whose frame is not decoded yet draws the nearest decoded one instead of a blank. The encoded frames are fetched once the scene is near, a few at a time: the window first, then outward from the current frame in the direction of travel. Each fetch times out after 10 s (SC-2); a frame that fails twice is skipped, and losing the current frame sets `data-scrub-state="failed"`, which keeps the start image. When the scene stops pinning, the decoded window is closed and fetching pauses.

## Building the scene

Start from `assets/reference/scrub-sequence.html`:

- Copy `assets/lib/frame-window.js` with `scene-progress.js`, `scrub-loader.js` (its muted `play()` probe) and `seek-queue.js`, plus `scene.css`.
- Inside `[data-scene-film]`: the still, the start image (`startframe.jpg`, `src` set in the markup) and `<canvas data-sequence data-src="sequence/sequence.json">`. Mount with `mountSequenceScene(element, { radius })`.
- Nothing is requested before the gates pass: reduced motion, a rejected muted `play()` probe or a short viewport keep the static layout and fetch neither the manifest nor a frame [LS-GATE-01] [LS-GATE-02]. Loading starts 150-250vh ahead (SC-4) and times out after 10 s, keeping the start image (SC-2).
- The canvas stays hidden until it has drawn a frame; until then the start image covers it, the same reveal as a film.
- The canvas is sized to its box times the device pixel ratio, capped at 2, redrawn on resize, and drawn with cover math so the frame fills the box without stretching.

## Checking it

- `scripts/probe-scene.mjs` treats the manifest and the frames as scrub media: under reduced motion or a rejected `play()` none may be requested [LS-GATE-01]; a demo clip elsewhere on the page does not count. It compares the start image with frame 0 of the sequence and checks that the canvas stays hidden until the scene reports a drawn frame [LS-VID-05]. It also counts live `ImageBitmap`s and loaded frame `<img>` elements during a sweep and warns when the page held more than `2r + 1` frames plus the decodes in flight, `r` being the manifest's radius [LS-WARN-SEQ].
- `scripts/bench-scrub.mjs --film film.mp4 --sequence sequence/sequence.json --project .` sweeps both through headless Chromium and counts the distinct frames each shows. It is advisory and never fails: a sequence earns its bytes only where the film visibly drops frames, and headless Chromium on a laptop is not the target device, so repeat the comparison on a phone before deciding.
