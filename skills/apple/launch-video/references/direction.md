# Directing a demo clip

A demo clip shows one idea in a few beats that a viewer can read without sound. Write the beats down before building the mock, then build the timeline from them.

## Contents

- Beats and timing
- A worked beat table
- Loops, one-shots and the seam
- Text, pointer and camera
- Frame rate

## Beats and timing

Measured demo clips move in short beats separated by readable holds, type at a steady rate and move the pointer straight to each target (PV-20). The defaults below are derived from those measurements, so they guide and never fail a check [LV-WARN-DIRECTION]:

- Transitions of 300-500 ms between states (PV-N0).
- Holds of at least 1 s on anything the viewer must read, and 1.5 s on the result the clip exists to show (PV-N0).
- Typing at 8-12 characters per second, one character at a time, no instant paste (PV-N0).
- One pointer move of 0.3-0.8 s per target, straight and eased, then a short press (PV-N0).
- Loops of 4-8 s with one idea each (PV-N0); split a longer story into several clips.

These are media timings. They are not control timings, so a review never flags them for running longer than a button press should (`../shared/motion-classes.md`).

## A worked beat table

The reference mock, `assets/reference/ui-mock.html`, follows this table:

```
start   end     what moves                              what the viewer reads
0.0 s   0.3 s   nothing; the field waits                an empty search field
0.3 s   0.7 s   the field takes focus                   where input goes
0.6 s   1.3 s   "invoice" typed at 10 characters/s      the query
1.4 s   2.0 s   three results rise in, 0.1 s apart      that the search found files
2.0 s   2.6 s   the pointer moves to the second result  which one matters
2.6 s   2.8 s   a press, then the row highlights        the choice
2.8 s   4.6 s   a confirmation stays on screen          the result
4.6 s   5.0 s   everything fades back                   (nothing new)
5.0 s   6.0 s   the empty field, as at the start        (the loop closes)
```

## Loops, one-shots and the seam

- A loop ends where it began. Its last frame against frame 0 should score an SSIM at least the clip's own median for consecutive frames, about 0.995 for calm UI; measured seams of 0.714-0.971 were visible jumps (PV-3) [LV-WARN-SEAM]. Check with `check-media.mjs --profile demo --loop`.
- Never fade in from a flat colour: the start image then differs from the first frames and the clip flashes (PV-3).
- A one-shot of up to 5 s needs no pause control (PV-N0); a longer one-shot, and every loop, gets one [LV-EMBED-02].

## Text, pointer and camera

- Every word on screen is the user's or plainly fictional; proof such as ratings or quotes is a marked placeholder (POL-3).
- Keep text large enough to read at the slot's CSS width; render at the final aspect ratio, never crop later.
- Measured demos keep a static camera with no cut or zoom inside a clip (PV-20); move the UI, not the camera.
- Draw the pointer yourself as a simple shape; do not copy an operating system's cursor artwork.

## Frame rate

Use 30 fps for UI demos; 60 fps costs about 34 % more bytes at the same quality and suits only fast motion graphics (PV-10) [LV-WARN-FPS].
