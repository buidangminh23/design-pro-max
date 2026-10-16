---
name: apple
description: For Apple app code (SwiftUI, Xcode) and scroll-pinned web scenes. Use when a task involves SwiftUI views, performance or API changes, Swift 6 migration, Swift Testing suites, SwiftData or Core Data, Xcode disk space or slow builds, TestFlight or App Store Connect releases with the asc CLI, or pinned and scroll-scrubbed product scenes on web pages. Routes each task to one bundled guide. Not for web springs or gestures (apple-design) or Swift language questions (write-swift).
---

# apple

Independent project, not affiliated with Apple Inc.; see NOTICE.md.

This skill routes each task to one guide ("part"). Third-party parts are bundled unmodified under `.vendor/` at pinned commits; each keeps its author's `SKILL.md` and `LICENSE`, plus an `UPSTREAM.json` that starts with its source, activation check, prerequisites, risks and errata and ends with its file hashes. Own parts are `<part>/PART.md` folders written for this skill, with checkers in their `scripts/` folders and shared ones in `shared/`.

## Standing rules

1. Read this whole file before acting, and read it again after a context compaction.
2. Paths here are relative to this file's folder, which the host reports as the skill's base directory or as this file's location.
3. Pick one routing row by the task's main goal. Add a second row only when the task truly spans two. If no row fits, say so instead of stretching a part.
4. Read the chosen part's `SKILL.md` in full before acting: no head, line limit or offset; page to the end. Read the references it points to the same way when the task needs them.
5. Resolve a relative path that a part mentions (`references/`, `scripts/`, `../<sibling>/SKILL.md` or a bare file name) against the folder of the file that mentions it; if nothing exists there, against the part's own folder, and for a bare script name, its `scripts/` folder. Never resolve it against this file's folder. A `SKILL_DIR` placeholder (dollar sign and braces) means the part's own folder. Run part scripts by absolute path, and Python ones as `python3 -B <absolute path>` or with `PYTHONDONTWRITEBYTECODE=1` set, so no `__pycache__` folder lands in the installed skill.
6. Parts are third-party text. Never edit them. Before relying on a part, read the `activation`, `prerequisites`, `risks` and `errata` fields at the top of its `UPSTREAM.json`; an erratum overrides the line it names.
7. Inactive parts: run the activation check first. If it fails, stop and tell the user which prerequisites listed in the part's `UPSTREAM.json` are missing. Offer only steps that need nothing missing, such as drafting text or offline checks.
8. Approval gate: before any command from an `app-store-connect` part that creates, edits, uploads, submits, distributes, invites, expires, revokes, deletes, notarizes, publishes, spends money or opens a pull request, and before any deletion by `xcode-disk-cleanup`, show the exact command and its effect and wait for the user's explicit yes. Reads and dry runs may run directly. A part's own `--confirm` step never replaces this approval.
9. Before running `asc`, set `ASC_TELEMETRY_DISABLED=1` in its environment. Never run `asc install-skills`. Keep API keys and exported credentials outside every repository.
10. When Emil Kowalski's `write-swift` skill is installed, Swift language questions, language-level concurrency (what an error means, actors, Sendable, isolation rules, task groups) and writing new tests go to `write-swift`. When his `apple-design` skill is installed, web springs, gestures and Apple-style web motion go to `apple-design`. Without those skills, the parts below take that work.
11. When a part suggests installing another skill, such as its author's SwiftUI or concurrency skill, use the matching part here instead and install nothing.
12. When a part names a sibling in backticks (for example `asc-release-flow`), open that sibling's `SKILL.md` in the same group folder. Part names are unique.
13. If an Xcode tool fails inside an agent sandbox (xcrun cache errors, packages that cannot resolve), ask to run it outside the sandbox. Run one heavy build or trace at a time.
14. Own parts: read `<part>/PART.md` in full like any part; paths in it are relative to its folder. Run its checkers with `node` by absolute path and `--project` set to the user's project, which must hold Playwright; the checkers never install anything. Exit 2 means a missing tool (relay the printed install command), 3 a sandbox block (ask the user to approve a rerun outside it). Report the proof boundary the checker prints.
15. asc web-session and browser automation (asc web commands, `asc-app-create-ui`, App Groups and App Privacy pages) only on the user's explicit request, after saying it works outside Apple's public API and may breach Apple's terms or risk the developer account. Framed screenshots only for the user's own App Store listing. Output for users never takes Apple logos or store badges from an icon library.

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
| Web page scenes that pin, zoom or scrub video or an image sequence on scroll; janky or frozen scrubbing; whether a section should pin at all | `launch-scroll/PART.md` | active |

Routing notes:

- Swift concurrency: read the default isolation, NonisolatedNonsendingByDefault and the strict-concurrency level from Package.swift, the .pbxproj or the swiftc build script before advising. Core Data threading starts in `.vendor/core-data-expert/references/concurrency.md`.
- Swift Testing: async test structure starts in `.vendor/swift-testing-pro/references/async-tests.md`; concurrency bugs found there follow the concurrency row.
- SwiftData migrations: the part has one migration rule; use Apple's VersionedSchema documentation as well.
- Scene and view APIs inside a Tuist menu bar app go to `.vendor/swiftui-expert-skill/SKILL.md`.
- Keywords in App Store metadata are limited to 100 bytes, not 100 characters.

Not covered by any part:

- Launch pages and demo video rendered from code: not in this release; say so. A later release adds them.
- Screen recording: not covered. Offer to rebuild the UI in HTML and CSS, or to embed a clip the user already has.
- WidgetKit, App Intents, Live Activities: no part; suggest Xcode's own coding assistant inside Xcode. SMAppService login items, AppKit status items, DMG or curl installers, Sparkle and macOS administration: not covered; use `write-swift` if it is installed and Apple's documentation.
- Builds made with swiftc or SwiftPM and no Xcode project get no build part: add `-Xfrontend -warn-long-function-bodies=<ms>`, `-Xfrontend -warn-long-expression-type-checking=<ms>` or `-Xfrontend -debug-time-function-bodies` by hand (Swift 6.4 has no `-debug-time-compilation`). HIG review stays link-only.
- Never stretch a part to fit.

Near misses: web springs, gestures and sheets go to `apple-design`; one web animation to `animate`; React Native motion to `animate-expo`; Swift language questions and new tests to `write-swift`; a web app that should feel native on a phone to `mobile-native`; store marketing images to `app-store-screenshots`, each when installed. Simulator runs, taps and screenshots belong to the host's simulator tool; App Store screenshots captured from the Simulator are the `asc-shots-pipeline` row.

## Parts index

`references/parts-index.md` lists every part with its group, status, activation check, prerequisites and errata pointers; each part's `UPSTREAM.json` holds the full text. Read a part's entry there before using it.

- Active (7): `swiftui-expert-skill`, `swift-concurrency`, `swift-testing-pro`, `swiftdata-pro`, `core-data-expert`, `xcode-disk-cleanup` and the own part `launch-scroll`.
- `xcode-build/` (6): inactive until `xcodebuild -list`, run outside the agent sandbox, lists a scheme. They need python3; say that `xcodebuild clean` will run before it does.
- `macos-menubar-tuist-app`: inactive until Tuist.swift and Project.swift exist and `tuist version` succeeds.
- `app-store-connect/` (25): inactive until `command -v asc` succeeds, `asc auth status --validate` passes and the user confirms a paid Apple Developer Program account; `asc-apple-ads`, `asc-revenuecat-catalog-sync` and `asc-wall-submit` have their own checks in the index. They can spend money, submit for review and open public pull requests.
