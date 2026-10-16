# Motion classes

Shared by the own parts. Each class of motion has its own timing and its own rules, so a review never applies one class's limits to another.

| Class | What it is | Guidance | Owner |
|---|---|---|---|
| Controls | buttons, toggles, menus, hovers | short and responsive; flag slow ones | `animate`, if installed |
| Panels | flyouts, sheets, drawers | duration grows with the distance travelled, within a short clamp | not covered yet |
| Narrative reveals | content entering as the reader arrives | run once, visible by default; entrance states only behind a capability check | not covered yet |
| Scroll-linked | pinned scenes, scrubbed films | driven by progress, not by time; no smoothing or time-based smoothing | launch-scroll |
| Media | demo clips, loops | one idea per clip; loops need a pause control | not covered yet |
| Ambient | backgrounds and decoration that move on their own | a pause control when it runs long; still under reduced motion | not covered yet |

Review rule for every part: never flag narrative or scroll-linked motion for running longer than a control should; flag controls that run long. Scroll-linked motion has no duration at all: it lasts as long as the reader scrolls.

Under reduced motion every class stops moving on its own: scroll-linked scenes show their end state, reveals show their content, media and ambient motion do not autoplay, and controls change state without travelling.
