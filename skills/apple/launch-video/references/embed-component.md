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
2. When a clip comes within the load margin, 600px by default on both axes so carousels work too, its sources get their `src` (ON-11).
3. It plays a clip while at least half of it is visible and pauses it otherwise; only the most visible clip plays (`maxActive: 1`).
4. Every `play()` checks reduced motion, Save-Data and the reader's own pause at that moment, including the call that follows loading [LV-EMBED-02].
5. The video is shown over the start image only after its first presented frame, so there is never a blank box.
6. Any loop, and any one-shot longer than 5 s, gets a labelled Pause button if the markup has none [LV-EMBED-02]. Its label switches between Pause and Play, and the reader's choice sticks.
7. Under reduced motion or Save-Data, nothing loads or plays; the button reads Play and starts the clip on request.

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

It loads the page three times per viewport (normal, reduced motion, Save-Data), scrolls each clip into view, and reports the autoplay attribute, `preload`, sources and video bytes before scrolling, playback at half visibility, the pause control (it clicks it), playback under reduced motion after loading, Save-Data, density [LV-WARN-DENSITY] and source order [LV-WARN-AV1].
