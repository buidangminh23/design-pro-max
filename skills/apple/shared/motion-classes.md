# Motion classes

Shared by the own parts. Each class of motion has its own timing and its own rules, so a review never applies one class's limits to another.

| Class | What it is | Guidance | Owner |
|---|---|---|---|
| Controls | buttons, toggles, menus, hovers | short and responsive; flag slow ones | `animate`, if installed |
| Panels | flyouts, sheets, drawers | warn: duration grows with the distance travelled, clamped to 240-480 ms (AM-5) [LP-WARN-CLASS] | launch-page (nav panels) |
| Narrative reveals | content entering as the reader arrives | error: run once (AM-6) (ON-6) and visible by default, entrance states only behind a capability check (AM-23) [LP-REVEAL-01] [LP-BASE-01]; warn: 0.7-1.1 s [LP-WARN-CLASS] | launch-page |
| Hero intro | a film or sequence handing over to the hero | error: skipped under reduced motion or when the page loads scrolled, end state within 5 s with the film blocked (ON-1) [LP-INTRO-01] | launch-page |
| Scroll-linked | pinned scenes, scrubbed films | driven by progress, not by time; no smoothing or time-based smoothing | launch-scroll |
| Media | demo clips, loops | one idea per clip; loops need a pause control | launch-video |
| Ambient | backgrounds, marquees and galleries that move on their own | error: a labelled pause control past 5 s (PV-21) (AM-4) (ON-8), still under reduced motion (ON-20) [LP-AMB-01] | launch-page |

Review rule for every part: never flag narrative or scroll-linked motion for running longer than a control should; flag controls that run long. Scroll-linked motion has no duration at all: it lasts as long as the reader scrolls.

Under reduced motion every class stops moving on its own: scroll-linked scenes show their end state, reveals show their content, media and ambient motion do not autoplay, and controls change state without travelling.
