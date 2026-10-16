# Image sequences instead of video

A canvas that draws one image per progress step. It is frame-exact and needs no seeking, but it costs bytes and memory, so it is the exception [LS-WARN-SEQ].

## When a sequence is the right call

- The film is short.
- It needs alpha in every browser.
- The target devices decode video in software, where seeks are slow.
- Video seeking misbehaves on a target browser and cannot be fixed with a short closed GOP.

Otherwise use a scrubbed film (`references/scrub-video.md`).

## The costs, before choosing

- Bytes: at matched quality a sequence costs 2.3-5.3 times the bytes of GOP-6 video, depending on content (SC-11). Prefer AVIF, then WebP, then JPEG.
- Memory: each decoded frame holds width x height x 4 bytes, so the budget is frames x width x height x 4 bytes (SC-12). Work it out and show it to the user before building, for example for a phone breakpoint and a desktop one. A full high-resolution sequence can need gigabytes; phones cannot hold that.
- Decode time: decoding one frame takes milliseconds, and WebKit does not decode in parallel (SC-12).

## Building one

- Keep the encoded files (cheap) and a window of decoded frames around the current one (expensive); close each `ImageBitmap` that leaves the window.
- Size the canvas to its box times the device pixel ratio, capped at 2, and redraw on resize.
- Draw with cover math so the frame fills the box without stretching.
- The gates, the static layout and the start image rules are the same as for a film [LS-GATE-01] [LS-GATE-02].

Tooling for sequences (a decoded-frame window, a reference page and a maker script) is planned for a later release; until then, build from these notes and say so.
