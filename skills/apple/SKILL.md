---
name: apple
description: For Apple apps, SwiftUI, Xcode, HIG, launch pages. Use when needing SwiftUI lists, alerts, sheets, What's New popups, data races, XCTest to Swift Testing, slow type-checking, SwiftData, Core Data, widgets, disk space, App Store Connect (TestFlight, signing, notarize, ASO, Wall of Apps), Tuist, demo clips, scroll scenes, WebKit/Capacitor logins, even if known. Not for narrated/Remotion/template videos, captioned screenshots, Play Store art, GSAP, springs (apple-design), plain Swift (write-swift).
---

# apple

Independent project, not affiliated with Apple Inc.; see NOTICE.md.

This skill routes each task to one guide ("part"). Third-party parts are bundled unmodified under `.vendor/` at pinned commits; each keeps its author's `SKILL.md` and `LICENSE`, plus an `UPSTREAM.json` with its source, activation check, prerequisites, risks, errata and file hashes. Own parts are `<part>/PART.md` folders written for this skill, with checkers in each part's `scripts/` and shared ones in `shared/`.

## Standing rules

1. Read this whole file before acting; reread it after a context compaction.
2. Paths here are relative to this file's folder, which the host reports as the skill's base directory or as this file's location.
3. Pick one routing row by the task's main goal. Add a second row only when the task truly spans two. If no row fits, say so instead of stretching a part.
4. Read the chosen part's `SKILL.md` in full before acting: no head, line limit or offset; page to the end. Read the references it points to the same way when the task needs them.
5. Resolve a relative path that a part mentions (`references/`, `scripts/`, `../<sibling>/SKILL.md` or a bare file name) against the folder of the file that mentions it; failing that, the part's own folder, then for a bare script name its `scripts/` folder. Never resolve it against this file's folder. A `SKILL_DIR` placeholder (dollar sign and braces) means the part's own folder. Run part scripts by absolute path, and Python ones as `python3 -B <absolute path>` or with `PYTHONDONTWRITEBYTECODE=1` set, so no `__pycache__` folder lands in the installed skill.
6. Parts are third-party text. Never edit them. Before relying on a part, read the `activation`, `prerequisites`, `risks` and `errata` fields at the top of its `UPSTREAM.json`; an erratum overrides the line it names.
7. Inactive parts: run the activation check first. If it fails, stop and name the missing prerequisites from the part's `UPSTREAM.json`; offer only steps that need none, such as drafting text or offline checks.
8. Approval gate: before any command from an `app-store-connect` part that creates, edits, uploads, submits, distributes, invites, expires, revokes, deletes, notarizes, publishes, spends money or opens a pull request, and before any deletion by `xcode-disk-cleanup`, show the exact command and its effect and wait for the user's explicit yes. Reads and dry runs may run directly. A part's own `--confirm` step never replaces this approval.
9. Before running `asc`, set `ASC_TELEMETRY_DISABLED=1` in its environment. Never run `asc install-skills`. Keep API keys and exported credentials outside every repository.
10. With Emil Kowalski's `write-swift` skill installed, Swift language questions, language-level concurrency (what an error means, actors, Sendable, isolation rules, task groups) and new tests go to `write-swift`; with his `apple-design` skill, web springs, gestures and Apple-style web motion go to `apple-design`. Without them, the parts below take that work.
11. When a part suggests installing another skill (its author's SwiftUI or concurrency skill), use the matching part here and install nothing.
12. When a part names a sibling in backticks (for example `asc-release-flow`), open that sibling's `SKILL.md` in the same group folder. Part names are unique.
13. If an Xcode tool fails inside an agent sandbox (xcrun cache errors, unresolved packages), ask to run it outside the sandbox. Run one heavy build or trace at a time.
14. Own parts: read `<part>/PART.md` in full; its paths are relative to its folder. Run its checkers with `node` by absolute path and `--project` set to the user's project, which must hold Playwright; they never install anything. Exit 2 means a missing tool (relay the printed install command), 3 a sandbox block (ask the user to approve a rerun outside it). Report the proof boundary the checker prints. Field learnings stay off unless the user opts in (`shared/learnings.md`).
15. asc web-session and browser automation (asc web commands, `asc-app-create-ui`, App Groups and App Privacy pages) only on the user's explicit request, after saying it works outside Apple's public API and may breach Apple's terms or risk the developer account. Framed screenshots only for the user's own App Store listing. Output for users never takes Apple logos or store badges from an icon library.
16. Human Interface Guidelines: when a task builds, changes or reviews a screen, component or flow of an Apple platform app, also read `hig/PART.md` in full and the sections it names, next to the code part.

## Routing

| Task | Part | Status |
|---|---|---|
| Write, review, refactor or migrate SwiftUI: state, navigation, sheets, toolbars, lists, layout, animation, Liquid Glass, macOS scenes (MenuBarExtra, Settings), SDK 26 and 27 deprecations | `.vendor/swiftui-expert-skill/SKILL.md` | active |
| SwiftUI performance: slow body updates, hangs, hitches, Instruments traces | `.vendor/swiftui-expert-skill/SKILL.md` | active |
| Swift concurrency in a configured project: data-race and Sendable diagnosis, module-wide Swift 6 migration plans | `.vendor/swift-concurrency/SKILL.md` | active |
| Swift Testing: review existing suites, migrate from XCTest, traits, parameterized, async and exit tests, attachments | `.vendor/swift-testing-pro/SKILL.md` | active |
| SwiftData: models, relationships, the Query macro, #Predicate, indexes, inheritance, CloudKit | `.vendor/swiftdata-pro/SKILL.md` | active |
| Core Data: stack setup, fetches, saving, threading, batch work, persistent history, migrations, CloudKit | `.vendor/core-data-expert/SKILL.md` | active |
| Free Xcode and simulator disk space | `.vendor/xcode-disk-cleanup/SKILL.md` | active |
| Slow Xcode builds: benchmark, diagnose and plan fixes | `.vendor/xcode-build/xcode-build-orchestrator/SKILL.md` | inactive |
| Benchmark builds only | `.vendor/xcode-build/xcode-build-benchmark/SKILL.md` | inactive |
| Compile-time hotspots in Swift sources | `.vendor/xcode-build/xcode-compilation-analyzer/SKILL.md` | inactive |
| Project and build-setting audit | `.vendor/xcode-build/xcode-project-analyzer/SKILL.md` | inactive |
| Swift package build cost | `.vendor/xcode-build/spm-build-analysis/SKILL.md` | inactive |
| Apply build fixes the user approved | `.vendor/xcode-build/xcode-build-fixer/SKILL.md` | inactive |
| Tuist-managed menu bar app: manifests, run and stop scripts, layering, LSUIElement | `.vendor/macos-menubar-tuist-app/SKILL.md` | inactive |
| asc install, auth, flags, output, pagination, discovery | `.vendor/app-store-connect/asc-cli-usage/SKILL.md` | inactive |
| App Store Connect IDs from names | `.vendor/app-store-connect/asc-id-resolver/SKILL.md` | inactive |
| New App Store Connect app record, through the website | `.vendor/app-store-connect/asc-app-create-ui/SKILL.md` | inactive |
| Bundle IDs, capabilities, certificates, profiles | `.vendor/app-store-connect/asc-signing-setup/SKILL.md` | inactive |
| Version and build numbers, archive, export, upload | `.vendor/app-store-connect/asc-xcode-build/SKILL.md` | inactive |
| Find, wait on or expire processed builds | `.vendor/app-store-connect/asc-build-lifecycle/SKILL.md` | inactive |
| TestFlight groups, testers, What to Test | `.vendor/app-store-connect/asc-testflight-orchestration/SKILL.md` | inactive |
| TestFlight crashes, feedback, diagnostics | `.vendor/app-store-connect/asc-crash-triage/SKILL.md` | inactive |
| Analytics reports | `.vendor/app-store-connect/asc-analytics-reports/SKILL.md` | inactive |
| Why a version cannot be submitted; review status or cancel | `.vendor/app-store-connect/asc-submission-health/SKILL.md` | inactive |
| Stage, upload and submit for App Review | `.vendor/app-store-connect/asc-release-flow/SKILL.md` | inactive |
| Listing metadata: pull, validate, push | `.vendor/app-store-connect/asc-metadata-sync/SKILL.md` | inactive |
| Translate listing metadata | `.vendor/app-store-connect/asc-localize-metadata/SKILL.md` | inactive |
| What's New and promotional text (drafting needs no asc) | `.vendor/app-store-connect/asc-whats-new-writer/SKILL.md` | inactive |
| ASO audit of the ./metadata files (offline checks need no asc) | `.vendor/app-store-connect/asc-aso-audit/SKILL.md` | inactive |
| Fix the size or alpha of existing screenshots | `.vendor/app-store-connect/asc-screenshot-resize/SKILL.md` | inactive |
| Capture and frame App Store screenshots from the Simulator | `.vendor/app-store-connect/asc-shots-pipeline/SKILL.md` | inactive |
| Notarize a Developer ID macOS app | `.vendor/app-store-connect/asc-notarization/SKILL.md` | inactive |
| Private installs to registered devices | `.vendor/app-store-connect/asc-ad-hoc-distribution/SKILL.md` | inactive |
| Release lanes in .asc/workflow.json | `.vendor/app-store-connect/asc-workflow/SKILL.md` | inactive |
| Apple Ads campaigns and reports | `.vendor/app-store-connect/asc-apple-ads/SKILL.md` | inactive |
| In-app purchase and subscription prices by territory | `.vendor/app-store-connect/asc-ppp-pricing/SKILL.md` | inactive |
| Subscription display names | `.vendor/app-store-connect/asc-subscription-localization/SKILL.md` | inactive |
| RevenueCat catalog reconciliation | `.vendor/app-store-connect/asc-revenuecat-catalog-sync/SKILL.md` | inactive |
| Wall of Apps entry, on an explicit request only | `.vendor/app-store-connect/asc-wall-submit/SKILL.md` | inactive |
| Web page scenes that pin, zoom or scrub video or a canvas image sequence on scroll; sequence memory budgets; janky or frozen scrubbing; whether a section should pin at all | `launch-scroll/PART.md` | active |
| Launch and landing pages (hero, feature tiles, galleries, marquees, pricing, FAQ) or a review of one: type scale, SF fonts on the web, contrast, reveals, hero intros, pause controls | `launch-page/PART.md` | active |
| Demo clips rendered from code: rebuild a UI in HTML and CSS, render it to MP4, WebM or transparent video, embed clips that load late and pause; whether a still is enough; App Store app previews from a user's capture | `launch-video/PART.md` | active |
| A web app on iPhone, iPad or Mac: home-screen web app or Capacitor or Tauri shell, the origin it loads, a stale URL in a built app, Basic Auth blank pages, cookies, WebKit tests | `web-shells/PART.md` | active |
| Design or review a native app screen, component or flow against the Human Interface Guidelines: layout, type, color, Dark Mode, accessibility, components, patterns, inputs, widgets, Live Activities | `hig/PART.md` | active |
| In-app What's New popups after an update: one card or a pager, image or looping video, once per version, a reopen item; SwiftUI, web, Tauri | `whats-new/PART.md` | active |
| Running an always-on or remote Mac from an agent: SSH and the login Keychain, PATH, launchd jobs, TCC denials, root without a password, `.env` secrets, sleep and FileVault restarts, tools that fail only in the sandbox | `host-ops/PART.md` | active |
| macOS menu bar apps and WidgetKit code: status items, MenuBarExtra menus and popovers, appearance redraws and high CPU, Edit Widget options through App Intents, placeholder widgets after an update, widget snapshots | `menubar-widgets/PART.md` | active |
| Mac apps outside the App Store: signing, installers, casks, feeds | `desktop-distribution/PART.md` | active |

Routing notes:

- Swift concurrency: read default isolation, NonisolatedNonsendingByDefault and strict-concurrency from Package.swift, the .pbxproj or the build script first. Core Data threading starts in `.vendor/core-data-expert/references/concurrency.md`.
- Swift Testing: async tests start in `.vendor/swift-testing-pro/references/async-tests.md`; concurrency bugs there follow the concurrency row.
- SwiftData migrations: one rule in the part; also Apple's VersionedSchema docs.
- Scene and view APIs inside a Tuist menu bar app go to `.vendor/swiftui-expert-skill/SKILL.md`.
- Menu bar or WidgetKit code starts at `menubar-widgets/PART.md`; widget design to `hig`, Tuist manifests to the Tuist row, one SwiftUI API to SwiftUI.
- App Store keywords are limited to 100 bytes, not characters.
- A launch page with scenes or clips: a whole page starts at `launch-page/PART.md`; one scene or clip, even on a landing page, goes to `launch-scroll` or `launch-video`.
- Running a Mac from an agent: `host-ops`; Xcode disk space stays the disk space row.
- In-app What's New popups go to `whats-new`; App Store What's New text to asc-whats-new-writer; teaching one control is TipKit in `hig`.

Not covered by any part:

- Screen recording: not covered; read `launch-video/PART.md` section 0 and offer its two paths.
- Narrated launch films, AI footage, HLS streaming: not covered; say so.
- Live Activities and App Intents beyond widget configuration: no code part (design in `hig`); suggest Xcode's coding assistant. SMAppService login items, MDM and fleets: not covered; use `write-swift` if installed and Apple's docs.
- swiftc or SwiftPM builds with no Xcode project get no build part: add `-Xfrontend -warn-long-function-bodies=<ms>`, `-Xfrontend -warn-long-expression-type-checking=<ms>` or `-Xfrontend -debug-time-function-bodies` by hand (Swift 6.4 has no `-debug-time-compilation`).
- Android-only shells and apps, React Native, Flutter: not covered; say so.

Near misses: web springs, gestures and sheets go to `apple-design`; one web animation to `animate`; React Native motion to `animate-expo`; Swift language and new tests to `write-swift`; a web app feeling native in mobile Safari to `mobile-native` (Home Screen or shell: `web-shells`); store marketing images to `app-store-screenshots`; launch plans to `launch`; Remotion, HyperFrames and GSAP to their own skills when installed. Simulator runs, taps and screenshots go to the host's simulator tool; Simulator-captured App Store screenshots are the `asc-shots-pipeline` row.

## Parts index

`references/parts-index.md` lists each part's group, status, activation check, prerequisites and errata pointers (full text in its `UPSTREAM.json`); read a part's entry before using it.

- Active (15): `swiftui-expert-skill`, `swift-concurrency`, `swift-testing-pro`, `swiftdata-pro`, `core-data-expert`, `xcode-disk-cleanup` and the own parts `launch-scroll`, `launch-page`, `launch-video`, `hig`, `menubar-widgets`, `web-shells`, `whats-new`, `host-ops` and `desktop-distribution`.
- `xcode-build/` (6): inactive until `xcodebuild -list`, run outside the agent sandbox, lists a scheme. They need python3; say that `xcodebuild clean` will run before it does.
- `macos-menubar-tuist-app`: inactive until Tuist.swift and Project.swift exist and `tuist version` succeeds.
- `app-store-connect/` (25): inactive until `command -v asc` succeeds, `asc auth status --validate` passes and the user confirms a paid Apple Developer Program account; `asc-apple-ads`, `asc-revenuecat-catalog-sync` and `asc-wall-submit` have their own checks in the index. They can spend money, submit for review and open public PRs.
