# App Store app previews

An app preview is the short video on an App Store product page. This part encodes and checks one from footage the user supplies; it records nothing and never turns a rendered mock into a preview.

## Contents

- What the footage must be
- The specification
- Encoding
- Checking a file the user already has
- Proof boundary

## What the footage must be

App Review accepts previews made of screen captures of the app itself. Narration and video or text overlays may explain what the capture alone does not make clear; stickers and iMessage extensions may show their experience inside Messages (PV-26). A clip rendered from an HTML and CSS rebuild, a design mock, another app or stock footage does not qualify. When the user has no capture yet, say so and tell them to record the app on a device or in Simulator, then come back with the file [LV-WARN-FOOTAGE]. Every frame must also suit a 4+ rating, and the user needs the rights to all of it, with made-up account data instead of a real person's.

## The specification

These values restate Apple's App Store Connect reference in our own words (PV-25). Re-read that page before relying on them for a release; the checker's table is `APP_PREVIEW` and `APP_PREVIEW_DEVICES` in `../../shared/check-media.mjs`.

| Property | Value |
|---|---|
| Video | H.264, progressive, up to High profile at level 4.0, aim for 10 to 12 Mbps; or ProRes 422 HQ, progressive, about 220 Mbps |
| Container | H.264 in `.mov`, `.m4v` or `.mp4`; ProRes in `.mov` only |
| Frame rate | at most 30 fps [LV-APP-01] |
| Audio | stereo, every track enabled: one 2-channel track, or two mono tracks (left, then right); AAC at 256 kbps, 44.1 or 48 kHz; with ProRes also 16, 24 or 32-bit PCM |
| Length | 15 to 30 seconds |
| File size | at most 500 MB [LV-APP-01] |
| Count | up to three per display size and language |
| Poster | the frame at 5 seconds unless another is chosen in App Store Connect |

| Display class (`--device`) | Portrait | Landscape |
|---|---|---|
| `iphone-6.9`, `iphone-6.7`, `iphone-6.5`, `iphone-6.3`, `iphone-5.8` | 886x1920 | 1920x886 |
| `iphone-5.5`, `iphone-4` | 1080x1920 | 1920x1080 |
| `iphone-4.7` | 750x1334 | 1334x750 |
| `ipad-13`, `ipad-11`, `ipad-10.5` | 1200x1600 | 1600x1200 |
| `ipad-12.9-2nd-gen` | 1200x1600 or 900x1200 | 1600x1200 or 1200x900 |
| `ipad-9.7` | 900x1200 | 1200x900 |
| `mac`, `apple-tv` | none | 1920x1080 |
| `vision-pro` | none | 3840x2160 |

A 3840x2160 frame holds more macroblocks than H.264 level 4.0 allows, so the `vision-pro` class is always ProRes. The 3.5-inch iPhone takes no previews.

## Encoding

```
node <absolute path to this folder>/../scripts/app-preview.mjs capture.mov --device iphone-6.9 --out previews/iphone-6.9.mp4
node <absolute path to this folder>/../scripts/app-preview.mjs capture.mov --device iphone-6.9 --start 4 --duration 28 --fit crop --out previews/iphone-6.9.mp4
node <absolute path to this folder>/../scripts/app-preview.mjs vision-capture.mov --device vision-pro --out previews/vision-pro.mov
```

- The orientation follows the footage unless `--orientation` says otherwise; landscape-only classes refuse portrait.
- The frame is scaled to fit and padded with `--background` (black by default), or scaled to fill and cropped with `--fit crop`. It is never stretched, so a capture in another aspect ratio gets bars; capture at the class's own aspect ratio when bars would look wrong.
- Frame rate is capped at 30 fps [LV-APP-01]. Audio becomes one 48 kHz stereo track: the footage's own sound as 256 kbps AAC (24-bit PCM for ProRes), or silence when the footage has none, because the specification asks for stereo audio either way.
- The clip must last 15 to 30 seconds after `--start` and `--duration`. The script refuses anything else instead of looping or speeding up footage; pick a section of the capture or record more.
- It lists the output first and stops when the file exists, unless `--force`.
- After encoding it checks its own file with the `app-preview` profile and exits 1 if any value is off.

## Checking a file the user already has

```
node <absolute path to this folder>/../../shared/check-media.mjs --profile app-preview --device ipad-13 previews/ipad-13.mov
```

[LV-APP-01] covers codec, profile and level, container, progressive scan, exact size, frame rate, length, file size, audio layout, codec and sample rate. [LV-WARN-BITRATE] flags a video rate far from the target, an audio rate other than 256 kbps and a moov box after the media. [LV-WARN-FOOTAGE] is always printed, because no file check can tell what the footage shows.

## Proof boundary

ffprobe and the MP4 box reader prove the file's streams and container. They do not prove that App Store Connect accepts the upload, what it chooses as the poster, how the preview looks on a device, or that the footage meets App Review. Upload one preview to App Store Connect and watch it on a device before producing the rest.
