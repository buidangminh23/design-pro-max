# Embedding demo clips

`assets/lib/demo-embed.js` and its reference page `assets/reference/demo-embed.html`: lazy clips that start on their first frame, play while seen, pause on request and stay still under reduced motion.

## Contents

- Markup
- What the component does
- Styles
- Why each choice
- Checking a page

## Markup

```html
<figure data-demo>
  <div data-demo-frame>
    <img data-demo-start src="search.start.jpg" width="1280" height="720" alt="" loading="lazy" decoding="async">
    <video muted playsinline loop preload="none" aria-hidden="true" width="1280" height="720">
      <source data-src="search.av1.webm" type='video/webm; codecs="av01.0.05M.08"'>
      <source data-src="search.webm" type='video/webm; codecs="vp09.00.30.08"'>
      <source data-src="search.mp4" type='video/mp4; codecs="avc1.64001f"'>
    </video>
  </div>
  <button type="button" data-demo-toggle>Pause</button>
  <figcaption>Type a word and the matching invoice opens.</figcaption>
</figure>
<script type="module">
  import { mountDemos } from './demo-embed.js';
  mountDemos(document);
</script>
```

The caption says in words what the clip shows, for readers who never play it; the video itself is hidden from screen readers. For a transparent clip, list `<name>.alpha.mov` (`video/mp4; codecs="hvc1"`) first, then `<name>.alpha.webm`, then the flattened `<name>.mp4`.

## What the component does

1. Nothing loads at first except the lazy start image. It sets `preload="none"`, removes any `autoplay` attribute and keeps sources in `data-src` [LV-EMBED-01].
2. When a clip comes within the load margin of the viewport, 600px by default, its sources get their `src` (ON-11). A margin does not reach through a scrolling carousel's clipped edge, so where the browser supports the observer's `scrollMargin` option a second observer loads a carousel clip once the carousel is in view and the clip is within the margin of its edge; elsewhere such a clip loads once it scrolls into the carousel's box. The two margins are kept in separate observers because together they add up.
3. It plays a clip while at least half of it is visible and pauses it otherwise [LV-WARN-PLAYBACK]. By default only the most visible clip plays (`maxActive: 1`), a choice of the component rather than a measured rule.
4. Every `play()` checks reduced motion and the reader's own pause at that moment, including the call that follows loading [LV-EMBED-02].
5. The video is shown over the start image only after its first presented frame, so there is never a blank box.
6. Any loop, and any one-shot longer than 5 s, gets a labelled Pause button if the markup has none [LV-EMBED-02]. Its label switches between Pause and Play (an icon-only button keeps its icon and switches its `aria-label`), and the reader's choice sticks. A one-shot that has ended stays on its last frame; scrolling or returning to the tab does not restart it, only the Play button does.
7. Under reduced motion, nothing loads or plays; the button reads Play and starts the clip on request.
8. Under Save-Data the component does the same, and every `play()` checks Save-Data at that moment too. Like `maxActive`, this is a choice of the component rather than a measured rule; only Chromium browsers send the signal (PV-24).
9. A `[data-demo]` without a `<video>` (a still) is left alone.

Options: `mountDemos(root, { loadMargin, playRatio, maxActive, pauseAfterSeconds, labels })`; it returns a function that stops the observers.

## Styles

```css
[data-demo-frame] { position: relative; aspect-ratio: 16 / 9; overflow: hidden; }
[data-demo-frame] > img, [data-demo-frame] > video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
[data-demo-frame] > video { opacity: 0; }
[data-demo][data-demo-ready] [data-demo-frame] > video { opacity: 1; }
[data-demo-toggle] { min-height: 44px; }
```

Give the frame the clip's aspect ratio and the images their width and height, so nothing shifts while loading.

## Why each choice

- The `autoplay` attribute overrides `preload` and forces an early download (ON-14). A large product site leaves it out on every inline video, marks them muted and inline, and starts playback from script near the viewport (EC-5).
- The `poster` attribute loaded eagerly in every measured case, while `preload="none"` loaded no video bytes and a lazy picture loaded only near the viewport (PV-13). AVIF start images were about 85 % smaller than JPEG at equal quality (PV-13); serve one through `<picture>` when the build can make it.
- A lazy loading attribute for video exists only in recent Chromium and is experimental (ON-14), so the component loads from script.
- A measured reference page assigned sources about 600 px ahead, played at 55 % visible and paused otherwise, and its play call after loading skipped the reduced-motion check, so loops played under reduced motion (ON-11). The component checks at every call.
- Looping tiles of 8-10.3 s without a pause control fail the rule that motion lasting over 5 s needs a way to stop it (PV-21).
- Under reduced motion decorative video shows a still and never autoplays (AM-23).
- The Save-Data signal exists only in Chromium browsers (PV-24); elsewhere the component behaves normally.
- The start image is frame 0 of the clip, so the reveal does not jump (PV-4) [LV-POSTER-01].

## Checking a page

```
node <absolute path to this part>/scripts/check-embed.mjs --url http://localhost:5173/ --project .
node <absolute path to this part>/scripts/check-embed.mjs --serve dist --page index.html --viewport 1280x800 --viewport 390x844 --project .
```

It checks the demo clips (`[data-demo] video`, or when the page has none every video that is not a scrub film or inside a scroll scene; `--selector` picks others). It loads the page twice per viewport (normal and reduced motion), scrolls each clip into view, and reports the autoplay and poster attributes, `preload`, sources and video bytes before scrolling, playback at half visibility [LV-WARN-PLAYBACK], the pause control, playback under reduced motion after loading, density [LV-WARN-DENSITY] and source order [LV-WARN-AV1]. For a clip it saw moving on its own past the limit, it starts the clip, focuses each labelled control (the `data-demo-toggle` first, then ones named pause, play or stop) and presses Enter, then Space, until one pauses it; a control that Tab cannot reach fails, and native `controls` count as a pause control.
