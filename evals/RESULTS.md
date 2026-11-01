# Eval results

## 2026-10-17: v0.1 routing, round 2 (Mac)

Round 2 measures the router description from #5 (3332b57), which opens its "Use when" list with App Store Connect and TestFlight through the asc CLI, names What's New and promotional text, notarizing and ad hoc installs, and adds launch and preview videos, store screenshots and GSAP APIs to its not-for clause. The prompts, the harness settings and the bars are those of round 1, below. Claude Code 2.1.302 with `claude-opus-5-5[1m]`; Codex codex-cli 0.163.0 with `gpt-6.1-sol`, reasoning high. The skill files were identical at f175fb5, where the round started, and at bf731f3, where the rerun ran.

22 Claude runs of the first pass (all 16 near misses, r38 to r40 and the three recorded prompts) ended on the Claude Code session limit without doing the task, and the first score counted them as misses and as clean near misses. The harness now detects such runs, stops the lane at the first one and leaves them out of every bar (bf731f3). The 22 runs were moved aside and run again after the limit reset; the scores below contain no limit-hit run.

| Bar | Target | Claude Code | Codex |
|---|---|---|---|
| Recall (40 router rows) | at least 90 % | 82.5 % (33/40): **not met** (round 1: 72.5 %) | 100 % (40/40): **met** (round 1: 97.5 %) |
| False triggers (16 near misses) | at most 10 % | 0 % (0/16): **met** (round 1: 12.5 %) | 37.5 % (6/16): **not met** (round 1: 37.5 %) |
| Correct first part (triggered rows) | at least 90 % | 100 % (33/33): **met** | 100 % (40/40): **met** |
| Full reads of guides | 100 % | 100 % (46/46): **met** | 100 % (86/86): **met** |
| Wrong-path reads | 0 | 0: **met** | 0: **met** |

Any read of the skill, whatever started it: Claude Code rows 37/40, near misses 3/16; Codex rows 40/40, near misses 6/16.

### What changed from round 1

- r28 (What's New and promotional text) now starts apple on both hosts and reaches `asc-whats-new-writer`.
- Claude Code now calls apple on r33 (ad hoc distribution) and on the asc rows it reached only by exploring the project in round 1: r13, r29, r35, r37 and r38. r40 (scroll-scrubbed phone render) still calls apple.
- Claude Code's near misses no longer call apple: n14 and n16 did in round 1. n10, n14 and n15 read the router and the parts index while exploring the empty project, without calling apple (6 near misses read skill files that way in round 1).
- Codex's six near misses still read the router, and the bar counts a router read as a trigger because Codex has no Skill tool. All six stopped there and read no part; in round 1, n12 went on to `launch-scroll/PART.md`.

### Failures

Claude Code, recall:

- Apple not called and no skill file read: `claude-with-r05` (SwiftData, answered directly), `claude-with-r17` (app record through the website), `claude-with-r32` (notarization).
- Apple not called, but the agent listed the empty project, found `.claude/skills/apple` and read the part directly: `claude-with-r14` (Tuist menu bar app, timed out at 480 s while running `tuist`), `claude-with-r30` (screenshot resize), `claude-with-r31` (screenshot pipeline), `claude-with-r39` (Wall of Apps). These reads would not happen with the skill installed outside the project, so they are scored as misses. r14, r17 and r31 called apple in round 1.
- Timed out at 480 s: `claude-with-r14`, `claude-with-n08`, `claude-with-n10`.

Codex, false triggers (router read, no part read): `codex-with-n08` (store screenshots), `codex-with-n11` (Remotion promo), `codex-with-n12` (ScrollTrigger `pinSpacing`), `codex-with-n14` (launch video template), `codex-with-n15` (narrated launch film), `codex-with-n16` (App Store preview video).

Each case ran once per host, so a single row can flip between rounds without a change to the description: r14, r17 and r31 went from a hit to a miss with the description closer to them than before.

Router findings to act on in a later change, not fixed here:

- Claude Code still misses 7 rows, 4 of them by reading the part while exploring the empty project. The listing alone does not decide those runs; a recall bar for Claude Code needs runs where the skill sits outside the project, or several runs per row.
- Codex's false-trigger bar cannot reach 10 % while a router read counts as a trigger: reading the description it was shown is how Codex checks the not-for clause. Deciding whether to count only a part read after the router is a change to the bar, so it waits for the plan.

### Recorded, not scored

| Prompt | Claude Code | Codex |
|---|---|---|
| Fix this data race in my SwiftUI view model | not triggered | router only |
| Add Swift Testing tests to my command-line package | not triggered | router only |
| Review my SwiftUI screen against the HIG | not triggered | router, then `.vendor/swiftui-expert-skill` |

## 2026-10-16: v0.1 routing, round 1 (Mac)

| | Claude Code | Codex |
|---|---|---|
| CLI | 2.1.301 | codex-cli 0.163.0 |
| Model | `claude-opus-5-5[1m]`, effort from the user's settings (xhigh) | `gpt-6.1-sol`, reasoning high |
| Runs | 59 routing prompts, with apple, plus one listing run per condition | 59 routing prompts, with apple, plus one listing run per condition |
| Turn or time cap | 10 turns, 480 s | 480 s |

Harness: `node evals/harness.mjs` (run, trace, score). Each run starts in a fresh empty git project in the system temp folder, which is deleted afterwards. Claude runs `claude -p` with stream-json output, `bypassPermissions`, hooks disabled through `--settings` and no session persistence, with the skill at `.claude/skills/apple`. Codex runs `codex exec --json --ephemeral` (no `-s`) with the skill at `.agents/skills/apple`. The user's own skill library and global instructions stay in place, so the near-miss skills that are installed (`write-swift`, `apple-design`, `animate`, `animate-expo`, `mobile-native`) compete for each prompt as they would in daily use; `gsap-scrolltrigger`, `modern-web-guidance`, Remotion, HyperFrames, `launch` and `app-store-screenshots` are not installed here.

### Bars (plan 8.1, Mac)

| Bar | Target | Claude Code | Codex |
|---|---|---|---|
| Recall (40 router rows) | at least 90 % | 72.5 % (29/40): **not met** | 97.5 % (39/40): **met** |
| False triggers (16 near misses) | at most 10 % | 12.5 % (2/16): **not met** | 37.5 % (6/16): **not met** |
| Correct first part (triggered rows) | at least 90 % | 100 % (29/29): **met** | 100 % (39/39): **met** |
| Full reads of guides | 100 % | 98 % (49/50): **not met** | 100 % (85/85): **met** |
| Wrong-path reads | 0 | 0: **met** | 0: **met** |
| Listing | apple listed with its description | full 478-character description among 34 listed skills: **met** | full description in the catalog line, so every row's keywords fit the window and no row needed `$apple`: **met** |

How each bar is counted:

- Triggered: Claude Code called the Skill tool with `apple`; Codex read the router `SKILL.md`. Codex has no Skill tool, so reading the router is how it starts a skill.
- First part: the part folder of the first part file read (a `.vendor` part or `launch-scroll`), compared with the row's expected part.
- Full reads: every part `SKILL.md`, `PART.md` and router file that was read at all was read in full at least once (`cat`, an unranged Read, or a range that covers the file).
- Wrong-path reads: reads of a path under the skill that does not exist, or a Read that failed.
- Any read of the skill, whatever started it: Claude Code rows 37/40, near misses 6/16; Codex rows 39/40, near misses 6/16.

### Failures

Claude Code:

- Recall, apple not called and no skill file read: `claude-with-r28` (What's New and promotional text), `claude-with-r32` (notarization), `claude-with-r33` (ad hoc distribution).
- Recall, apple not called, but the agent listed the empty project, found `.claude/skills/apple` and read the part directly: `claude-with-r05`, `claude-with-r13`, `claude-with-r29`, `claude-with-r30`, `claude-with-r35`, `claude-with-r37`, `claude-with-r38`, `claude-with-r39`. These reads would not happen with the skill installed in the user's skill folder, outside the project, so they are scored as misses.
- False triggers, apple called: `claude-with-n14` (launch video template, belongs to HyperFrames), `claude-with-n16` (App Store preview video, out of scope until 1.0).
- Full reads: `claude-with-n10` (Product Hunt plan) read the first 80 lines of the router while exploring the project, without calling apple.
- Not counted as triggers, but the agent read skill files while exploring: `claude-with-n08`, `claude-with-n10`, `claude-with-n11`, `claude-with-n15`.
- Timed out at 480 s: `claude-with-n08`, `claude-with-n10`, `claude-with-n16`.

Codex:

- Recall: `codex-with-r28` (What's New and promotional text) never read the router.
- False triggers, router read: `codex-with-n08` (store screenshots), `codex-with-n11` (Remotion promo), `codex-with-n12` (ScrollTrigger `pinSpacing`, which then read `launch-scroll/PART.md`), `codex-with-n14` (launch video template), `codex-with-n15` (narrated launch film), `codex-with-n16` (App Store preview video).

Router findings to act on in a later change, not fixed here:

- r28 failed on both hosts: the description names App Store Connect releases but no listing copy (What's New, promotional text), so a writing request does not match.
- The six Codex false triggers are app-launch and store-media requests. The description's "TestFlight or App Store Connect releases" and "scroll-pinned and scroll-scrubbed product scenes" are close enough to pull them in. A not-for clause for launch videos, store marketing media and GSAP APIs would address all six, and Claude's n14 and n16.
- Claude Code reads the user's project before deciding on a skill. On asc rows (r29 to r39) it more often skipped the Skill call; the description's front half is about app code, and the asc keywords sit near its end.

### Recorded, not scored

| Prompt | Claude Code | Codex |
|---|---|---|
| Fix this data race in my SwiftUI view model | not triggered | router, then `.vendor/swift-concurrency` |
| Add Swift Testing tests to my command-line package | not triggered | router only |
| Review my SwiftUI screen against the HIG | not triggered (read skill files while exploring) | router only |

These three prompts are kept verbatim from the plan and still refer to files that the empty project does not have.

### Changes from plan 8.1, and why

- Claude baseline: `skillOverrides {"apple": "off"}` in the project's `.claude/settings.local.json` hides apple from the listing (checked: `claude-without-r40-listing` lists 33 skills and no apple), but a probe run with the folder still present listed the project, found `.claude/skills/apple` and read it. The baseline therefore keeps the override and also leaves the skill folder out of the project. It matters for the part evals, which use the baseline; routing runs only with apple.
- The first routing pass was discarded. Its row prompts referred to "our app" or "our Tests folder", and in an empty project Claude Code checked the project first, found nothing and stopped without loading a skill, so that pass measured the empty fixture rather than routing. All row prompts and the near misses that referred to the user's own app were reworded to be self-contained (table below); both hosts were then run again on the same prompts. n01, n02, n13 and the three recorded prompts were unchanged.
- The trace parser was fixed after the first pass to follow `cd` into a part folder, shell variables, `for` loops, pipes into `head` or `sed`, and Codex's `zsh -lc "..."` wrapper; every trace was re-extracted with the fixed parser before scoring.

### Reworded prompts

| Case | First pass | Scored pass |
|---|---|---|
| `r01` | Refactor my SwiftUI settings screen: it still uses NavigationView and an ObservableObject with @Published properties. Move it to NavigationStack and the Observation framework. | How do I move a SwiftUI settings screen off NavigationView and an ObservableObject with @Published properties, onto NavigationStack and the Observation framework? Show the before and after. |
| `r02` | My SwiftUI list stutters while scrolling and an Instruments trace shows long view body updates. How do I find which views re-render too often? | A SwiftUI list stutters while scrolling, and an Instruments trace shows long view body updates. How do I find which views re-render too often, and what usually fixes it? |
| `r03` | Plan the move of our iOS app target to Swift 6 strict concurrency checking. The build settings use minimal checking today and the networking module has dozens of Sendable warnings. | What is the safest plan for moving an iOS app target from minimal concurrency checking to Swift 6 strict concurrency, when the networking module already shows dozens of Sendable warnings? |
| `r04` | Migrate the XCTest cases in our Tests folder to Swift Testing and keep the table-driven ones as parameterized tests. | How do I migrate XCTest cases to Swift Testing while turning the table-driven ones into parameterized tests? Show a typical before and after. |
| `r05` | In SwiftData, model a one-to-many relationship between Folder and Note with cascade delete, and filter notes by folder name with a #Predicate. | In SwiftData, how do I model a one-to-many relationship between Folder and Note with cascade delete, and filter notes by folder name with a #Predicate? |
| `r06` | Our Core Data app crashes when it saves from a background context. Set up the stack with a background context and merge its changes into the view context. | A Core Data app crashes when it saves from a background context. How should the stack be set up with a background context whose changes merge into the view context? |
| `r07` | My Mac is almost out of space. How much are Xcode's DerivedData, archives and old simulators taking, and what could I safely free? Don't delete anything yet. | My Mac is almost out of space. How do I see how much Xcode's DerivedData, archives and old simulators take, and what is safe to free? Don't delete anything yet. |
| `r08` | Our Xcode app takes six minutes to build from clean. Benchmark it, work out why, and give me a plan to make it faster. | An Xcode app takes six minutes to build from clean. How do I benchmark it, work out why it is slow, and plan fixes? |
| `r09` | Only benchmark our Xcode scheme: time a few clean and incremental builds. I don't want any fixes yet. | How do I benchmark an Xcode scheme's clean and incremental build times reliably, over several runs, without changing anything yet? |
| `r10` | Which Swift functions or expressions in our app take longest to type-check? Find the compile-time hotspots. | How do I find which Swift functions or expressions take longest to type-check in an Xcode app, the compile-time hotspots? |
| `r11` | Audit our Xcode project's build settings for anything that slows down debug builds. | Which Xcode build settings commonly slow down debug builds, and how do I audit a project for them? |
| `r12` | Which of our Swift package dependencies cost the most build time, and is any of them worth replacing? | How do I find out which Swift package dependencies cost the most build time in an Xcode project, and whether one is worth replacing? |
| `r13` | Last week you proposed three Xcode build-time fixes: no dSYM for Debug, explicit modules, and splitting the big target. I approve the first two. Apply them to the project. | I approved two build-time fixes for my Xcode project: no dSYM for the Debug configuration, and explicit modules. What exactly changes in the project to apply them, and how do I check the gain afterwards? |
| `r14` | Set up a Tuist-managed macOS menu bar app with a Project.swift, LSUIElement set, and scripts to run and stop it. | How do I set up a Tuist-managed macOS menu bar app: the Project.swift, LSUIElement, and scripts to run and stop it? |
| `r16` | Using asc, look up the App Store Connect app ID and the latest build ID for our app called Pebble Notes. | With asc, how do I look up an App Store Connect app ID and the latest build ID from the app's name, say an app called Pebble Notes? |
| `r17` | Create the new App Store Connect app record for bundle ID com.example.pebble. It has to go through the website because the API can't do it. | I need a new App Store Connect app record for bundle ID com.example.pebble, and I hear the API can't create one. How do I do it through the website? |
| `r18` | With asc, register a bundle ID with the push notifications capability and create a development provisioning profile for it. | With asc, how do I register a bundle ID with the push notifications capability and create a development provisioning profile for it? |
| `r19` | Bump the build number, archive the iOS app, export the IPA and upload it to App Store Connect. | What are the steps and commands to bump the build number, archive an iOS app, export the IPA and upload it to App Store Connect? |
| `r20` | Wait until the build I just uploaded finishes processing in App Store Connect, then expire our two oldest TestFlight builds. | How do I wait until an uploaded build finishes processing in App Store Connect, then expire the two oldest TestFlight builds? |
| `r21` | Create an external TestFlight group called Beta Testers, invite three testers by email, and set the What to Test notes. | How do I create an external TestFlight group called Beta Testers, invite three testers by email, and set the What to Test notes? |
| `r22` | Pull the TestFlight crash reports and tester feedback for build 214 and summarize the top crashes. | How do I pull the TestFlight crash reports and tester feedback for build 214 and summarize the top crashes? |
| `r23` | Download the App Store Connect analytics reports for installs and sessions over the last 30 days. | How do I download App Store Connect analytics reports for installs and sessions over the last 30 days? |
| `r24` | App Store Connect won't let me submit version 2.3 for review. Why not, and what is its review status? | App Store Connect won't let me submit version 2.3 for review. How do I find out why, and see its review status? |
| `r25` | Stage version 2.4 with build 230 and submit it for App Review. | Walk me through staging version 2.4 with build 230 and submitting it for App Review. |
| `r26` | Pull our App Store listing metadata into local files, check the field lengths, and push my edited description back. | How do I pull App Store listing metadata into local files, check the field lengths, and push an edited description back? |
| `r27` | Translate our App Store listing metadata into German, Japanese and Vietnamese. | How do I translate an App Store listing's metadata into German, Japanese and Vietnamese and upload it? |
| `r28` | Write the What's New and promotional text for version 2.4. Changes: offline mode, faster sync, a new widget, and a crash fix on launch. | Write the App Store What's New and promotional text for version 2.4 of a notes app. Changes: offline mode, faster sync, a new widget, and a fix for a crash on launch. |
| `r29` | Run an ASO audit on the files in ./metadata: keywords, subtitle and description. | How do I run an ASO audit on App Store metadata files (keywords, subtitle and description) kept in a ./metadata folder? |
| `r30` | App Store Connect rejects our screenshots for the wrong size and an alpha channel. Fix the existing PNG files. | App Store Connect rejects my screenshots for the wrong size and an alpha channel. How do I fix the existing PNG files? |
| `r31` | Capture App Store screenshots of each screen from the iOS Simulator and frame them in device bezels. | How do I capture App Store screenshots of each screen from the iOS Simulator and frame them in device bezels? |
| `r32` | Notarize our Developer ID signed macOS app and staple the ticket. | How do I notarize a Developer ID signed macOS app and staple the ticket? |
| `r33` | Get an ad hoc build onto the five registered test iPhones without going through TestFlight. | How do I get an ad hoc build onto five registered test iPhones without going through TestFlight? |
| `r34` | Set up release lanes in .asc/workflow.json for a beta lane and a production lane. | How do I set up release lanes in .asc/workflow.json, one for beta and one for production? |
| `r35` | Show last week's spend and taps for our Apple Ads campaigns, and pause the worst-performing keyword. | How do I see last week's spend and taps for my Apple Ads campaigns, and pause the worst-performing keyword? |
| `r36` | Set our subscription's price in each territory based on purchasing-power parity. | How do I set a subscription's price in each territory based on purchasing-power parity? |
| `r37` | Localize the display names of our three subscriptions into French and Spanish. | How do I localize the display names of three subscriptions into French and Spanish? |
| `r38` | Reconcile our RevenueCat products and offerings with the in-app purchases in App Store Connect. | How do I reconcile RevenueCat products and offerings with the in-app purchases in App Store Connect? |
| `r39` | Please submit our app to the Wall of Apps. | I'd like to submit my app to the Wall of Apps. How do I do that? |
| `r40` | On our landing page I want a section where the phone render stays pinned while its screen scrubs through a short video as the reader scrolls. | On a landing page I want a section where a phone render stays pinned while its screen scrubs through a short video as the reader scrolls. How should I build it? |
| `n03` | A Swift closure stored on my class captures self strongly and the object never deallocates. How do I break the retain cycle? | A Swift closure stored on a class captures self strongly, and the object never deallocates. How do I break the retain cycle? |
| `n04` | I need a spring for a bottom sheet drag in our web app so that it settles naturally when released, the way iOS sheets do. | I need a spring for a bottom sheet drag in a web app, so that it settles naturally when released, the way iOS sheets do. How should I tune it? |
| `n05` | Make our dropdown menu feel snappier; right now it fades in over 400ms. | How do I make a dropdown menu feel snappier? Right now it fades in over 400ms. |
| `n06` | In our Expo app, make a card follow the finger and spring back on release with Reanimated. | In an Expo app, how do I make a card follow the finger and spring back on release with Reanimated? |
| `n07` | Our web app feels like a website on the iPhone: hover styles stick after a tap and the 100vh hero jumps when the browser toolbar hides. | My web app feels like a website on the iPhone: hover styles stick after a tap and the 100vh hero jumps when the browser toolbar hides. How do I fix that? |
| `n08` | Design marketing screenshots for our App Store and Google Play listings, with captions over device frames. | How should I design marketing screenshots for App Store and Google Play listings, with captions over device frames? |
| `n09` | Make a Google Play Store feature graphic for our app. | How do I make a Google Play Store feature graphic for my app? |
| `n10` | Plan our Product Hunt launch for next Tuesday: tagline, first comment and an hour-by-hour timeline. | Plan a Product Hunt launch for next Tuesday: tagline, first comment and an hour-by-hour timeline. |
| `n11` | Build a Remotion composition for a 20-second promo of our app. | How do I build a Remotion composition for a 20-second promo of an app? |
| `n14` | Give me a product launch video template that I can fill in with our screenshots. | Where can I get a product launch video template that I fill in with app screenshots, and how would I use it? |
| `n15` | Script and produce a 60-second narrated launch film for our app. | Help me script and produce a 60-second narrated launch film for an app. |
| `n16` | Make the App Store app preview video for our iPhone app. | How do I make an App Store app preview video for an iPhone app? |

## launch-scroll part evals: not run yet

Cases 6, 7, 8, 9, 10, 16, 18 and 19 of `evals/apple/launch-scroll/evals.json` have not been run. Each runs with and without apple on both hosts, one run at a time (the probe and encoder steps must not overlap on an 8 GB Mac):

```sh
for id in 6 7 8 9 10 16 18 19; do
  for condition in with without; do
    node evals/harness.mjs run --suite launch-scroll --host claude --condition "$condition" --out <dir> --ids "$id"
    node evals/harness.mjs run --suite launch-scroll --host codex --condition "$condition" --out <dir> --ids "$id"
  done
done
```

`<dir>` must be outside the repository: it holds each run's full output, its final answer and the diff of the files it wrote. Grade each run's answer and diff against the case's expectations, then add both pass rates per host here. A minor or major release needs that entry, dated after the last change to `PART.md`.
