# Recording pre-flight

Copy this file next to the project, fill in the three fields and tick each item only after checking it on the screen
that will be recorded. `scripts/capture-plan.mjs --preflight <file>` refuses to plan or run a capture until every field
is filled and every item is ticked. Fill it in again for each recording session.

Recording: <what will be recorded, for which slot>
Approved by: <the person who owns this screen and agrees to the recording>
Date: <YYYY-MM-DD>

- [ ] consent: The person named above agreed to this recording of this screen, for this use.
- [ ] demo-data: The app shows a demo account and fictional data, not a real account.
- [ ] notifications: Do Not Disturb or Focus is on, and no notification banner can appear during the capture.
- [ ] private-windows: Mail, chat, password managers, other browser tabs and every other private window are closed or outside the capture region.
- [ ] secrets: No password, key, token, environment file or shell history is visible anywhere in the region.
- [ ] other-people: No other person's name, face, address, message or record is visible in the region.
- [ ] status-bar: The clock, the menu bar or taskbar extras and account pictures are hidden or outside the region.
- [ ] region: The region is the app window cropped to the slot, at least as wide in points as the slot is in CSS pixels.
