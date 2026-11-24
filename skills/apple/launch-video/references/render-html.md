# Rebuilding and rendering a UI

How to write a mock that runs live and renders, and what `scripts/render-frames.mjs` does with it.

## Contents

- A mock that renders
- What the renderer does per frame
- Running it
- Transparent clips
- Pitfalls

## A mock that renders

- Drive every moving part from time, never from events or real input: CSS animations, the Web Animations API, or script that reads time inside `requestAnimationFrame`.
- Put the whole loop on one clock. In `assets/reference/ui-mock.html` the root element runs a do-nothing `mock-clock` animation as long as the loop, every other animation shares that length, and the script that types text reads `mock-clock`'s `currentTime`. Live, the browser advances the clock; rendered, the renderer sets it. Both show the same frame at the same time.
- Give animations the loop's full length and place each beat with keyframe percentages, not `animation-delay`: a delay applies to the first iteration only, so a delayed loop drifts out of step.
- Under reduced motion, pause the clock at a meaningful moment (the mock uses `animation-play-state: paused` with a negative delay that lands on the result), so the live replica shows its end state.
- Size in `rem` from a root size tied to the viewport width, and keep the slot's aspect ratio, so one mock renders at any slot width.
- Seed anything random; a render must be repeatable.

## What the renderer does per frame

The browser opens the page at the slot's CSS size with device pixel ratio 2 and reduced motion off. Playwright's page clock is installed and paused before the page loads, so it stands still during loading; the renderer waits for load and fonts, then pauses every animation. Frame 0 is time 0 for the animations and the clock alike. For frame `i`, at time `t = i / fps`:

1. Each animation's `currentTime` is set to `t`. An animation that appears later (a class added by script) is paused and stepped from the frame it appears in.
2. The page clock runs to `t`, so timers, `Date.now()` and `performance.now()` read `t` past their value at load. `requestAnimationFrame` callbacks run on the clock's own frame grid, after the animations were set for the frame, so a callback that reads an animation's `currentTime` (as the mock's typing does) sees `t`; one that reads the clock sees the last frame tick at or before `t`. At frame 0 the clock has not moved, so no callback has run since load.
3. Every image inside the viewport must be decoded and painted before the renderer's image timeout (`IMAGE_TIMEOUT_MS` in the script). One that fails (a missing file, a broken data URL) or is still loading then stops the render with an error naming the element and the frame [LV-RENDER-01]; a page whose load event never fires is not waited for longer than that either.
4. The viewport, or `--selector`, is captured as `frame-<i>.png`.

It never uses the built-in page recording: that writes VP8 at 25 fps in CSS pixels with extra frames at both ends, while stepping gives an exact frame count at true 2x (PV-11). `--check` on a video flags VP8 at 25 fps as the recording's signature; that is a heuristic, since another VP8 file at 25 fps matches it too. Frames go to `$TMPDIR` with a `render.json` (written with `complete: false` before the first frame, so a failed render can be rerun into the same `--out`), and the renderer checks them: duration x fps frames, numbered from `frame-00000.png`, each at twice the slot's CSS pixels [LV-RENDER-01].

## Running it

```
node scripts/render-frames.mjs --serve <folder> --page ui-mock.html --slot 640x360 --duration 6 --project <folder with Playwright>
node scripts/render-frames.mjs --url http://localhost:5173/demo --selector .demo --viewport 1280x800 --slot 640x360 --duration 6
node scripts/render-frames.mjs --check <frames folder or video> --slot 640x360 --duration 6 --fps 30
```

`--slot` is the clip's CSS size; with `--selector`, it must equal that element's size. `--check` also reads a master video and flags the built-in recording's signature.

## Transparent clips

Pass `--alpha`: frames are captured without the page background, so the page and the mock's root must have no background of their own. Encode them with `encode.mjs --alpha` (see `references/encode-recipes.md`).

## Pitfalls

- CSS background images are not checked for painting; use `<img>` for anything that must appear in the first frame.
- A `<video>` inside the page is not stepped; render its frames separately or leave it out.
- Scroll-driven animations do not advance; render the scene's states with a time-based timeline instead.
- Web fonts must load before the clock starts; the renderer waits for `document.fonts.ready`, but a font requested late shows a fallback in early frames.
- Never load SF Pro or SF Symbols, even for a render (POL-2); `system-ui` shows the platform's own face.
