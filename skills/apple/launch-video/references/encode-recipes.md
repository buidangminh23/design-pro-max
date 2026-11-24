# Encoding demo clips

What `scripts/encode.mjs` writes, the flags behind it, the size budgets per slot and the alpha pair.

## Contents

- The profiles
- Why each setting
- Size budgets per slot
- Transparent clips
- Checking files by hand

## The profiles

```
node scripts/encode.mjs <frames folder or master> --out public/media --name search --profiles h264,vp9,av1 [--width 1280] [--fps 30] [--crf 23] [--start png]
node scripts/encode.mjs <frames rendered with --alpha> --out public/media --name badge --alpha --background #ffffff
```

| Profile | File | Codec and settings |
|---|---|
| h264 (always) | `<name>.mp4` | libx264 High, yuv420p limited range, moov first, avc1 tag |
| vp9 | `<name>.webm` | libvpx-vp9 constant quality, yuv420p |
| av1 | `<name>.av1.webm` | SVT-AV1 constant quality, yuv420p |
| `--alpha` | `<name>.alpha.mov`, `<name>.alpha.webm`, `<name>.mp4` | HEVC with alpha (VideoToolbox), VP9 with alpha, H.264 flattened over `--background` |

Every run also writes `<name>.start.jpg` (or `.png` with `--start png`), frame 0 of the H.264 file through the colour conversion browsers use, and `<name>.encode.json` with its settings, source order and version. It lists its outputs first, stops on files it did not write, then checks its own output with the shared `check-media.mjs` demo profile.

## Why each setting

- H.264 High in yuv420p with limited range and the moov box first is the baseline every browser plays at once (AM-19, PV-1) [LV-ENC-01]. `yuvj420p` (full range) and 4:4:4 encodes change how the clip decodes, and a moov at the end delays the first frame.
- Constant quality around CRF 18-25 for H.264 matches measured demo clips (PV-1); raise it before raising the resolution.
- No audio stream at all: a muted clip carrying a silent AAC track wasted 32.5-43.7 % of its file in measured clips (PV-2) [LV-ENC-02].
- The three colour tags are written with the `setparams` filter and read back: command-line colour options alone were not written for PNG-sourced encodes, and untagged clips drift in colour (PV-22, SC-N1) [LV-ENC-03]. The tags are bt709 primaries and matrix with the sRGB transfer, matching the start image (SC-23).
- The start image is frame 0 of the H.264 file, never a separate still (PV-4) [LV-POSTER-01]. Fine detail such as text on a flat field can need `--start png` to reach the SSIM bar.
- AV1 matched H.264 at about 55 % of the bytes, and hardware encoders needed 2.1-2.4 times the bytes of software ones, so encode with software (PV-9). List AV1 first and H.264 last, because WebKit plays AV1 only with a hardware decoder (PV-24) [LV-WARN-AV1].
- 30 fps unless the motion is fast: 60 fps costs about 34 % more bytes (PV-10) [LV-WARN-FPS].
- The HEVC and VP9 files are for size; HEVC support in Chrome and Firefox depends on hardware, so H.264 always ends the list (PV-24).

## Size budgets per slot

Bytes per second follow bits per pixel times width, height and frame rate; measured demos ran at 0.006-0.017 bits per pixel per frame (PV-1). Ceilings per file, checked with `--slot` [LV-WARN-BUDGET]:

| `--slot` | Slot and budget per file |
|---|---|
| `tile` | a tile up to 800 px wide: 120 KB (PV-N1) |
| `tile-5s`, `tile-5s@2x` | a 5 s tile: 250 KB at 1x, 600 KB at 2x (PV-N1) |
| `card` | a card 960-1280 px wide: 400 KB (PV-N1) |
| `device` | a device screen 1540-1600 px wide: 700 KB (PV-N1) |
| `hero`, `hero@2x` | a hero under 2 s: 300 KB at 1x, 1 MB at 2x (PV-N1) |

Over budget: shorten the clip, lower the frame rate to 30, raise the CRF, add AV1, or render a smaller slot, in that order. Deliver 1.3-2.0 video pixels per CSS pixel (PV-14) [LV-WARN-DENSITY].

## Transparent clips

VP9 with alpha keeps its transparency in Chrome but turns opaque in WebKit, while HEVC with alpha stays transparent in both (TQ-20). So a transparent clip ships three files in this order: HEVC with alpha, VP9 with alpha, then H.264 flattened over the page colour [LV-WARN-ALPHA]. HEVC with alpha encodes only through VideoToolbox, on macOS, and that encoder fails inside the agent sandbox with a compression-session error (TQ-31). `encode.mjs` then exits 3 and prints the exact command; ask the user to approve a rerun outside the sandbox or to run it. Off macOS it exits 2; `--skip-hevc-alpha` ships VP9 with alpha and the flattened H.264 file, and WebKit then shows the flattened clip.

## Checking files by hand

```
ffprobe -v error -show_entries stream=codec_name,profile,pix_fmt,color_range,color_primaries,color_transfer,color_space -of compact search.mp4
node <absolute path to the skill>/shared/check-media.mjs --profile demo --poster search.start.jpg --slot card --loop search.av1.webm search.webm search.mp4
```

List the files in source order; the check reads that order for the alpha pair. `--loop` also measures the seam [LV-WARN-SEAM].
