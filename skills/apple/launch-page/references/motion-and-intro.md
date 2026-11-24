# Motion and the hero intro

Which motion a launch page may use, how long each kind runs, and the gates that keep the page whole without it. The classes are shared with the other parts in `../../shared/motion-classes.md`.

## Contents

- The capability gate
- Reveals
- The hero intro
- Ambient motion
- Reduced motion
- Durations by class
- Heavy set pieces

## The capability gate

- Content is visible in the markup. `markMotion()` in `../assets/lib/gate.js` sets `html[data-motion="ok"]` only when motion is allowed, and every entrance state is written under that selector. Without script, or under reduced motion, the selector never matches and the page is its end state [LP-BASE-01] (AM-23).
- The gate also honours an `html.reduced-motion` class, so a site-level "reduce motion" setting works like the system preference.

## Reveals

- `createReveals()` in `../assets/lib/reveal.js` marks each `[data-reveal]` element `data-revealed` the first time any part of it enters the viewport, and stops observing it: a reveal runs once and is never hidden again [LP-REVEAL-01] (AM-6) (ON-6). It also reveals what is already in or above the viewport at load, what the reader jumps past, and everything left when the page is scrolled to its end, so a block taller than the viewport or a line at the very bottom never stays hidden. `destroy()` removes its observer and listeners when a single-page app unmounts the view.
- Items in a `[data-reveal-group]` are staggered by `--reveal-index` times `--reveal-stagger`, capped so a long list does not keep the reader waiting.
- Reveals are narrative motion: a rise and fade of 0.7-1.1 s is in class, and the 300 ms limit for controls does not apply to them [LP-WARN-CLASS] (AM-6) (ON-6). The tokens use `800ms` (restrained) and `1000ms` (expressive) with a small rise.
- Without `IntersectionObserver`, on print, and when reduced motion turns on mid-visit, everything is revealed at once.

## The hero intro

An intro hands a film over to the real hero. Offer one only when the user has a film or asks for it.

1. Decide before first paint with the inline head script in `../assets/reference/intro-handoff.html`: skip under reduced motion, on a page that loads scrolled or at an anchor, and on a second visit in the session; otherwise set `html[data-intro="play"]` so the hero's `[data-intro-end]` elements start hidden (ON-1).
2. `runIntro()` in `../assets/lib/gate.js` confirms the decision once the page has loaded and the browser has restored the scroll position, then plays the film. Any of these ends it: the film's end, an error, a rejected `play()`, a scroll, a key press, the skip button, or a timeout of `3500ms`. The hero then fades in.
3. The end state must appear within 5 s even when the film never arrives or `play()` is refused [LP-INTRO-01] (ON-1). The head script carries its own timeout, so the page recovers even if the module fails to load.
4. Mark the intro as seen for the session; never replay it on every visit.

The film is the user's: H.264 first, muted, no audio track, with its first frame matching the hero's start. Making it is launch-video's job.

## Ambient motion

- Marquees, auto-advancing galleries, slow orbits and looping decoration move on their own. Anything that does so for over 5 s gets a labelled pause control that stops it [LP-AMB-01] (PV-21). Ambient motion often runs for seconds per cycle (AM-4), so most of it needs one.
- Under reduced motion and without script nothing moves on its own: the marquee becomes a wrapped list, galleries stop on their first slide, orbits stand still (ON-20). Put the animation itself behind `html[data-motion="ok"]`; a pause button wired by script does nothing when the script never ran.
- Pause what is off screen or in a hidden tab, and never autoplay sound.

## Reduced motion

- One block of tokens switches it, for the media query and for `html.reduced-motion`: every duration token drops to `0ms`, the rise to `0px`, and progress values to `1`, so components show their end states without a query of their own (AM-7) (AM-23).
- Controls the reader starts (a play button, opening a panel) still work; they change state without travelling.

## Durations by class

| Class | Guidance | Rule |
|---|---|---|
| Controls | short; icon controls about 100 ms linear (AD-20) | [LP-WARN-CLASS] |
| Panels | grows with the distance, within 240-480 ms (AM-5) | [LP-WARN-CLASS] |
| Narrative reveals | once, visible by default, 0.7-1.1 s (AM-6) (ON-6) | [LP-REVEAL-01] |
| Hero intro | skip rules and an end state within 5 s (ON-1) | [LP-INTRO-01] |
| Ambient | a pause control past 5 s; still under reduced motion (PV-21) | [LP-AMB-01] |

A review never flags a reveal or an intro for running longer than a control should, and always flags a control that does [LP-WARN-CLASS].

## Heavy set pieces

- At most three pinned or scrubbed set pieces on one page [LP-WARN-PINS]; each one is a launch-scroll scene with its own gates.
- Put image sequences, several films and stacked blur behind a low-memory gate: `lowMemory()` in `../assets/lib/gate.js` is true for low device memory and for Save-Data, and the page then serves the static layout [LP-WARN-MEMORY]. Decoded sequence frames cost width times height times four bytes each (SC-12), and stacked blur can fall to a few frames per second in software rendering (ON-4).
