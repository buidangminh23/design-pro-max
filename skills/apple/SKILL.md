---
name: apple
description: For Apple app code (SwiftUI, Swift 6, SwiftData, Xcode, App Store). Routes each task to one bundled third-party guide and reads it in full. Use for writing or reviewing SwiftUI, Swift concurrency diagnosis and Swift 6 migration, Swift Testing, SwiftData or Core Data, freeing Xcode disk space, and, once their prerequisites exist, slow Xcode builds, Tuist menu bar apps and App Store Connect work with the asc CLI. Not for web springs or gestures (apple-design) or general Swift style (write-swift).
---

# apple

Independent project, not affiliated with Apple Inc.; see NOTICE.md.

This skill routes Apple-platform tasks to third-party guides ("parts") bundled unmodified under `.vendor/` at pinned commits. Each part keeps its author's `SKILL.md` and `LICENSE`, plus an `UPSTREAM.json` that starts with its source, activation check, prerequisites, risks and errata and ends with its file hashes.

## Standing rules

1. Read this whole file before acting, and read it again after a context compaction.
2. Paths here are relative to this file's folder, which the host reports as the skill's base directory or as this file's location.
3. Pick one routing row by the task's main goal. Add a second row only when the task truly spans two. If no row fits, say so instead of stretching a part.
4. Read the chosen part's `SKILL.md` in full before acting: no head, line limit or offset; page to the end. Read the references it points to the same way when the task needs them.
5. Resolve a relative path that a part mentions (`references/`, `scripts/`, `../<sibling>/SKILL.md` or a bare file name) against the folder of the file that mentions it; if nothing exists there, against the part's own folder, and for a bare script name, its `scripts/` folder. Never resolve it against this file's folder. A `SKILL_DIR` placeholder (dollar sign and braces) means the part's own folder. Run part scripts by absolute path.
6. Parts are third-party text. Never edit them. Before relying on a part, read the `activation`, `prerequisites`, `risks` and `errata` fields at the top of its `UPSTREAM.json`; an erratum overrides the line it names.
7. Inactive parts: run the activation check first. If it fails, stop and tell the user which prerequisites listed in the part's `UPSTREAM.json` are missing. Offer only steps that need nothing missing, such as drafting text or offline checks.
8. Approval gate: before any command from an `app-store-connect` part that creates, edits, uploads, submits, distributes, invites, expires, revokes, deletes, notarizes, publishes, spends money or opens a pull request, and before any deletion by `xcode-disk-cleanup`, show the exact command and its effect and wait for the user's explicit yes. Reads and dry runs may run directly. A part's own `--confirm` step never replaces this approval.
9. Before running `asc`, set `ASC_TELEMETRY_DISABLED=1` in its environment. Never run `asc install-skills`. Keep API keys and exported credentials outside every repository.
10. When Emil Kowalski's `write-swift` skill is installed, Swift language questions, language-level concurrency (what an error means, actors, Sendable, isolation rules, task groups) and writing new tests go to `write-swift`. When his `apple-design` skill is installed, web springs, gestures and Apple-style web motion go to `apple-design`. Without those skills, the parts below take that work.
11. When a part suggests installing another skill, such as its author's SwiftUI or concurrency skill, use the matching part here instead and install nothing.
12. When a part names a sibling in backticks (for example `asc-release-flow`), open that sibling's `SKILL.md` in the same group folder. Part names are unique.
13. If an Xcode tool fails inside an agent sandbox (xcrun cache errors, packages that cannot resolve), ask to run it outside the sandbox. Run one heavy build or trace at a time.

## Routing

| Task | Part | Status |
|---|---|---|
| Write, review, refactor or migrate SwiftUI: state, navigation, sheets, toolbars, lists, layout, animation, Liquid Glass, macOS scenes (MenuBarExtra, Settings), SDK 26 to 27.1 deprecations | `.vendor/swiftui-expert-skill/SKILL.md` | active |
| SwiftUI performance: slow body updates, hangs, hitches, Instruments traces | `.vendor/swiftui-expert-skill/SKILL.md` | active |
| Swift concurrency in a configured project: data-race and Sendable diagnosis, module-wide Swift 6 migration plans | `.vendor/swift-concurrency/SKILL.md` | active |
| Swift Testing: review existing suites, migrate from XCTest, traits, parameterized, async and exit tests, attachments | `.vendor/swift-testing-pro/SKILL.md` | active |
| SwiftData: models, relationships, @Query, #Predicate, indexes, inheritance, CloudKit | `.vendor/swiftdata-pro/SKILL.md` | active |
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

Routing notes:

- Swift concurrency: read the default isolation, NonisolatedNonsendingByDefault and the strict-concurrency level from Package.swift, the .pbxproj or the swiftc build script before advising. Core Data threading starts in `.vendor/core-data-expert/references/concurrency.md`.
- Swift Testing: async test structure starts in `.vendor/swift-testing-pro/references/async-tests.md`; concurrency bugs found there follow the concurrency row.
- SwiftData migrations: the part has one migration rule; use Apple's VersionedSchema documentation as well.
- Scene and view APIs inside a Tuist menu bar app go to `.vendor/swiftui-expert-skill/SKILL.md`.
- Keywords in App Store metadata are limited to 100 bytes, not 100 characters.

Not covered by any part: WidgetKit, App Intents, SMAppService login items, AppKit status items, DMG or curl installers and macOS administration. For those, use `write-swift` if it is installed and Apple's documentation; do not stretch a part to fit. Builds made with swiftc or SwiftPM and no Xcode project get no build part: add `-Xfrontend -warn-long-function-bodies=<ms>`, `-Xfrontend -warn-long-expression-type-checking=<ms>` or `-Xfrontend -debug-time-function-bodies` by hand (Swift 6.4 has no `-debug-time-compilation`). Web pages, web animation and ad-hoc simulator runs, taps and screenshots are not this skill's job; use the host's simulator tool. App Store screenshots captured from the Simulator are the `asc-shots-pipeline` row.

## Parts index

Part names below are folder names under `.vendor/`. Every part's `UPSTREAM.json` lists all of its prerequisites, risks and errata, and `references/parts-index.md` lists every part with its group, activation check, prerequisites and errata pointers.

### Active (6)

These need no activation check. Apply these errata first:

| Part | Apply first |
|---|---|
| `swiftui-expert-skill` | latest-apis.md:381, :386, :418 (APIs absent from Apple's index); :402, :406 (.concentric is not a RoundedCornerStyle); toolbar-patterns.md:33 (use .topBarLeading); ignore latest-apis.md:5; RocketSim only on request |
| `swift-concurrency` | SKILL.md:89 (withTaskGroup waits for its children and does not cancel them); threading.md:306, :342, :470 (Swift 6.2 ships with Xcode 26) |
| `swift-testing-pro` | misses Swift 6.3 and 6.4 additions |
| `swiftdata-pro` | predicates.md:41 (Collection.first typechecks in #Predicate with Swift 6.4) |
| `core-data-expert` | batch-operations.md:26-34 (the handler must return true to stop) |
| `xcode-disk-cleanup` | the dyld cache is /Library/Developer/CoreSimulator/Caches/dyld; simulator and runtime deletion is permanent; no --scan-root on external volumes |

### Inactive until an Xcode project exists (6)

Activation: The working project has an .xcodeproj or .xcworkspace with a scheme: `xcodebuild -list`, run outside the agent sandbox, lists at least one scheme.

Parts in `xcode-build/`: `xcode-build-orchestrator`, `xcode-build-benchmark`, `xcode-compilation-analyzer`, `xcode-project-analyzer`, `spm-build-analysis`, `xcode-build-fixer`. They need python3. Say that `xcodebuild clean` will run before it does; never pass a shared --derived-data-path; never use diagnose_compilation.py --per-file-timing (Swift 6.4 has no -debug-time-compilation); open the community-results pull request only when asked; the fixer applies approved items only.

### Inactive until a Tuist project exists (1)

Activation: Tuist.swift and Project.swift exist in the working project and `tuist version` succeeds.

Part: `macos-menubar-tuist-app`. It never mentions MenuBarExtra, and `tuist xcodebuild` may report to Tuist servers when the project is linked.

### Inactive until a paid Apple Developer Program account and asc exist (25)

Activation for every part in `app-store-connect/` not listed below: `command -v asc` succeeds, `asc auth status --validate` passes, and the user confirms a paid Apple Developer Program account. All of them need that account and the asc CLI; all but `asc-apple-ads` also need an App Store Connect API key (the .p8 key downloads only once).

Parts in `app-store-connect/`: `asc-cli-usage`, `asc-id-resolver`, `asc-app-create-ui`, `asc-signing-setup`, `asc-xcode-build`, `asc-build-lifecycle`, `asc-testflight-orchestration`, `asc-crash-triage`, `asc-analytics-reports`, `asc-submission-health`, `asc-release-flow`, `asc-metadata-sync`, `asc-localize-metadata`, `asc-whats-new-writer`, `asc-aso-audit`, `asc-screenshot-resize`, `asc-shots-pipeline`, `asc-notarization`, `asc-ad-hoc-distribution`, `asc-workflow`, `asc-apple-ads`, `asc-ppp-pricing`, `asc-subscription-localization`, `asc-revenuecat-catalog-sync`, `asc-wall-submit`.

Parts with their own activation check:

- `asc-apple-ads`: `command -v asc` succeeds, `asc ads auth status --validate` (SKILL.md:51) passes, and the user confirms a paid Apple Developer Program account; it uses Apple Ads OAuth, not the App Store Connect API key. Spends money.
- `asc-revenuecat-catalog-sync`: `command -v asc` succeeds, `asc auth status --validate` passes, the RevenueCat MCP tools (mcp_RC_*) are available, and the user confirms a paid Apple Developer Program account.
- `asc-wall-submit`: `command -v asc` succeeds, `gh auth status` succeeds, the user confirms a paid Apple Developer Program account, and the user explicitly asks for a Wall of Apps submission. Opens a public pull request.
