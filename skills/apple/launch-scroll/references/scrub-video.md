# Scrubbing a film with scroll

A muted `<video>` whose current time follows scroll progress. Encoding decides whether seeks are cheap; loading decides whether they work at all; the driver decides whether frames keep coming; the reveal decides whether the reader ever sees a blank box.

## Contents

- Encoding
- Sources and codecs
- Loading
- Driving the seeks
- Start image, still and reveal
- Gates
- Checking a film by hand

## Encoding

`scripts/encode-scrub.mjs <master> --out <folder> [--width 1280] [--fps 30] [--webm] [--hevc]` produces everything a scene needs and checks it. What it does, and why:

- A closed GOP with a keyframe every 6 frames, 5 above 30 fps [LS-WARN-GOP]. Seek cost grows with the distance to the previous keyframe; a GOP of 6 kept every frame of a sweep while a default long GOP showed about half (SC-7). Product films ship a keyframe every 2-8 frames (SC-1), and a keyframe at least every 8 frames is the hard limit [LS-VID-01].
- Not all-intra: it costs about 2.9 times the bytes of GOP 6 for little gain on hardware decode (SC-7).
- A closed GOP for every codec: an HEVC encode with an open GOP lands seeks on the wrong frame (SC-9) [LS-VID-01].
- yuv420p always: a 4:4:4 master without it encodes to a profile that Chromium decodes on a slow path (SC-10).
- No audio and the moov box first: a moov at the end costs an extra request before playback, or the whole file without Range support (SC-16) [LS-VID-01].
- bt709 primaries and matrix with an sRGB transfer tag, written into the stream and read back, so the film matches its start image (AM-19) [LS-WARN-COLOR].

The script lists its outputs first and stops when one exists that it did not write. It also writes `<name>.encode.json` with its version and settings.

## Sources and codecs

List H.264 first and always ship it [LS-VID-02]. Chromium without hardware decode cannot play HEVC at all, and VP9 seeked slowest of the measured codecs (SC-22), so a VP9 or HEVC file is an addition for size, never the only file and never first [LS-WARN-VP9]. An HEVC file uses the hvc1 sample entry (SC-1) [LS-WARN-HEVC]. Pick per breakpoint with `<source>` media or separate scenes; a portrait crop for phones is smaller and sharper than scaling a landscape film.

Keep sources in `data-src`, not `src`: the browser must not fetch anything before the gates pass [LS-GATE-01].

## Loading

- Load the whole film before scrubbing. The `preload` attribute is a hint browsers may ignore (SC-15), and seeking into unbuffered ranges stalls.
- Start loading while the scene is 150-250vh away (SC-4); `mountScrubScene` sets the IntersectionObserver margin to `200%`.
- Prefer `fetch()` into a Blob URL: it is seekable whatever the server does. With plain `src`, the server must answer byte-range requests with 206, or Chromium marks the film unseekable and it stays on frame 0 (SC-14) [LS-VID-04]. Check a server with `curl --range 0-99 <url> -o /dev/null -w '%{http_code}'`, which must print 206.
- MediaSource streaming is the alternative for long films; it is also seekable.
- Time the load out and keep the still on failure (SC-2).

## Driving the seeks

`createSeekQueue(video, { fps })` from `assets/lib/seek-queue.js`:

- Latest wins: a new target is written only when the video is not seeking; otherwise it replaces the pending target, which is written on `seeked`. Writing on every frame starves the decoder (SC-8) [LS-VID-03].
- Targets are frame centres, `(i + 0.5) / fps`, so rounding never lands on the neighbour.
- Never `fastSeek()`: it snaps to keyframes (SC-17) [LS-VID-03].
- Progress goes to the film unsmoothed (AM-17).

## Start image, still and reveal

- The start image sits under the video and is frame 0 of the film itself, exported from the encoded film through the same colour conversion the browser uses (PV-4) [LS-VID-05]. A separately composed still differs clearly from frame 0 (PV-4) and belongs to the static layout only. Very fine detail (noise, fractals) can need a higher-quality start image to reach the bar.
- The still (`data-scene-still`) is the end state that the static layout shows under reduced motion, a rejected probe, a short viewport or a failed load.
- Prime decoding with `play().then(pause)` once loaded, and reveal the video only after it has presented a frame (`requestVideoFrameCallback`), over the start image (SC-4) [LS-VID-05].
- Give the film box an aspect ratio and the images their width and height, so nothing shifts.

## Gates

`mountScrubScene` runs a muted, inline `play()` on a tiny built-in clip before pinning. A rejection means autoplay is blocked or iOS is in Low Power Mode (AM-16) (SC-21); the scene stays static and requests no film [LS-GATE-01]. Reduced motion and the short-viewport gate apply as for any scene (`references/gates-and-a11y.md`).

## Checking a film by hand

```
ffprobe -v error -show_entries stream=codec_name,profile,pix_fmt,color_primaries,color_transfer,color_space -of compact film.mp4
ffprobe -v error -select_streams v:0 -show_entries packet=flags -of csv=p=0 film.mp4
node <absolute path to the skill>/shared/check-media.mjs film.mp4 film.webm
```

The second command prints one line per frame; keyframes carry `K`. `check-media.mjs` also reads the MP4 boxes to prove every keyframe is an IDR frame (a closed GOP), which ffprobe alone does not show.
