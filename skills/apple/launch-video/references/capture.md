# Record mode: capturing the real app

## Contents

- When to record
- The pre-flight
- Plan, probe and run
- Commands by system
- Review and hand-off
- What is and is not measured

## When to record

Record only when the clip must show the real app: an App Store app preview (always a capture of the app itself) [LV-WARN-FOOTAGE], behaviour a rebuild cannot fake, or a team that asks for real footage. A still, a live replica or a rebuild rendered from code stays the default for a page clip (PART.md section 1). The person who owns the screen records or approves the recording; the agent never starts a capture on its own [LV-CAP-01].

## The pre-flight

Copy `assets/reference/capture-preflight.md` beside the project and fill it in with the user, at the screen that will be recorded, for each session. It has three fields (what is recorded, who consents, the date) and eight items: consent, demo data, notifications off, private windows closed, no secrets, no other people, status bar extras hidden, and the region cropped to the slot. `scripts/capture-plan.mjs` refuses to probe, plan or run anything until every field is filled and every item ticked (POL-1). Do not tick items for the user: ask them to check each one on screen.

## Plan, probe and run

```
node scripts/capture-plan.mjs --preflight capture-preflight.md --slot 640x360 --region 120,90,640,360 --duration 6
```

- `--slot` is the clip's CSS size; `--region` is the capture rectangle in points; `--scale` is the display's backing scale (2 on a Retina Mac, the Windows display scale, otherwise 1). Ask the user for the window's position, or have them place the app window at a known spot.
- The region must be at least as wide in points as the slot is in CSS pixels, so the clip is never upscaled [LV-WARN-REGION] (PV-14). Crop to the slot; never capture the whole desktop and crop later in a shared file.
- The probe asks whether a screen is visible to this process. An agent sandbox, an SSH session or a missing Screen Recording permission hides it: the script exits 3 and prints the command. Ask the user to run it in their own terminal or to approve a rerun outside the sandbox; never leave the sandbox on your own.
- Without `--run` the script records and writes nothing; it prints the command and the output path. With `--run` it records into the system temporary folder unless `--out` names another file. Never write a capture into the repository.

## Commands by system

| System | Default | Alternative | Notes |
|---|---|---|---|
| macOS | `screencapture -v -V <seconds> -R<x,y,w,h>` (the system recorder) | ffmpeg `avfoundation` with a crop | needs Screen Recording permission for the terminal that runs it |
| Windows | ffmpeg `ddagrab` (Desktop Duplication) | ffmpeg `gdigrab` | keep gdigrab at the default frame rate or below [LV-WARN-CAPTURE] |
| Linux | ffmpeg `x11grab` on an X display | the desktop's recorder or OBS through PipeWire on Wayland | x11grab cannot see Wayland windows |

The master is H.264 at a very low CRF with no audio; `scripts/encode.mjs` makes the delivered files from it, and `scripts/app-preview.mjs` makes an App Store preview from it.

## Review and hand-off

1. Run `node scripts/contact-sheet.mjs <capture>` and show the sheet to the user. They check every tile for notifications, private windows, secrets and other people. A frame that shows any of them means recording again, not blurring later.
2. Encode with `scripts/encode.mjs` (page clips) or `scripts/app-preview.mjs` (previews), then check as in PART.md section 10.
3. Delete the master and the sheet from the temporary folder once the user has the delivered files, unless they ask to keep them.

## What is and is not measured

Windows: test captures through ddagrab and gdigrab were measured for this part, and gdigrab fell short of its requested rate at the higher setting, so ddagrab is the default (POL-4). macOS: region geometry is measured (PV-14), but no test capture through this script has been recorded, and an SSH session lists no screen device. Linux: not measured. Unmeasured systems warn [LV-WARN-CAPTURE]. No capture proves what the screen showed; the contact sheet review does that.
