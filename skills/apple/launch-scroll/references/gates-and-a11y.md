# Gates and accessibility

A pinned scene is an enhancement over a page that already works. The gates decide when the enhancement runs; everything else in this file keeps the scene usable by people who never see it move.

## The static baseline

- The page without script, without scroll timelines and under reduced motion shows every piece of content in reading order, at the scene's end state (AM-13) (AM-23).
- Pinning, travel and media are added on top: `data-scene-state="pinned"` in the JS engine, `@supports` plus a motion query in the CSS engine.
- Content is never hidden by default to be revealed later.

## The gates

| Gate | Signal | Result |
|---|---|---|
| Reduced motion | `prefers-reduced-motion: reduce`, or an `html.reduced-motion` class from a site setting | static layout at the end state, no film requested (AM-23) [LS-GATE-01] |
| Blocked autoplay, Low Power Mode | a muted inline `play()` on a tiny clip is rejected (AM-16) (SC-21) | static layout, no film requested [LS-GATE-01] |
| Short viewport | stage height plus sticky offset exceeds the viewport height | no pin [LS-GATE-02] |
| No support | no scroll timelines (CSS engine) or no script (JS engine) | static layout (TQ-14) |

Re-evaluate on resize and when the motion preference changes; collapsing must leave the end state, not a half-played scene.

Take the short-viewport threshold from the scene itself: the stage's measured height and the page's own sticky chrome. Thresholds measured on other sites are context, not values.

## Reduced motion in detail

- The scene does not pin and the film is not requested; the still shows the end state (AM-23).
- Durations elsewhere drop to 0 through one override of the motion tokens, not per-rule queries (AM-7).
- Controls the user starts (a play button on a separate video) keep working.

## Keyboard and screen readers

- The film is decoration for sighted readers: `aria-hidden="true"` on the video, and the box that holds it gets `role="img"` with a label that says what the film shows. The beat text carries the meaning.
- Beat text lives in the DOM in reading order and is visible in the static layout; screen readers read it whatever the progress is.
- Focusable elements inside a pinned stage must be reachable: when focus moves to one that a beat has not shown yet, scroll the scene to that beat (or show the element) instead of leaving focus on something invisible.
- Nothing in the scene moves on its own; motion follows the reader's scroll, so it needs no pause control. A looping clip elsewhere on the page does.

## Performance guards

- Animate transform and opacity only.
- Stacked backdrop blur over a moving, filtered stage can drop a software-rendered browser to a few frames per second (ON-4): test on a software proxy and cut the layers if it stutters [LS-WARN-BLUR].
- Compute progress only while the scene is near the viewport (ON-2).
