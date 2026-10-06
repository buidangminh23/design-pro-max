# design-pro-max

<img src="skills/apple/assets/apple.svg" width="56" height="56" alt="Apple logo, the icon of the apple skill">

Design skills for AI coding agents, one skill per design. The first skill is **apple**: a router for Apple-platform work that sends each task to one bundled third-party guide and has the agent read that guide in full.

> **Status: pre-release.** Nothing has been released yet. Install instructions will arrive with v0.1.

## Layout

```text
skills/
  apple/
    SKILL.md                 router: standing rules, routing table, parts index
    NOTICE.md                disclaimer, trademarks and the icon's source
    references/parts-index.md  generated: every part's group, activation, prerequisites and errata pointers
    agents/openai.yaml       display name and icon for Codex
    assets/apple.svg         the skill icon (the Apple logo)
    .vendor/                 third-party parts, byte-for-byte at pinned commits
      <part>/
        SKILL.md ...         upstream files, unmodified
        LICENSE              the upstream licence
        UPSTREAM.json        source, commit, prerequisites, risks, errata, Apple text, file hashes and modes
      xcode-build/<part>/
      app-store-connect/<part>/
skills.json                  generated: the skills in this repository, for installers
vendor/sources.json          the 38 parts: repository, commit, path, excludes, status
scripts/vendor-sync.mjs      sync, check and notices
scripts/vendor-guard.mjs     offline guard
scripts/gen.mjs              writes skills.json, the parts index, the README credits and the trademark line
scripts/check-history.mjs    keeps unreviewed images and vendored agents/ and assets/ files out of git history
scripts/release.mjs          checks, packs and verifies the release ZIP
THIRD_PARTY_NOTICES.md       generated credits with every licence text
```

### Why `.vendor` is hidden

Agent hosts register every `SKILL.md` they find. Codex scans skill folders recursively but skips dot-directories, and Claude Code registers only the direct children of a skills folder. With every vendored part inside the hidden `.vendor/` folder, both hosts list exactly one skill, `apple`, while every vendored file stays byte-identical to upstream: nothing is renamed or edited to hide them.

The same constraint shapes the rest of the tree: `skills/apple/SKILL.md` is the only `SKILL.md` outside dot-directories, there are no symlinks, no `.claude-plugin` or `.codex-plugin` folder sits inside `skills/apple`, no folder is named `.claude`, `.agents`, `.codex` or `.git`, and no file is named `metadata.json`, which some installers drop. `.gitattributes` marks `skills/apple/.vendor/**` as `-text`, so git never rewrites vendored line endings.

## Parts

The router reads a part's `SKILL.md` in full, resolves each relative path a part mentions against the folder of the file that mentions it (then the part's own folder), checks inactive parts' activation first, and applies the errata recorded in its `UPSTREAM.json`.

### Active (6)

| Part | Covers | Prerequisites |
|---|---|---|
| `swiftui-expert-skill` | Writing, reviewing and migrating SwiftUI for iOS and macOS, including performance traces | None; traces need python3 and Xcode's xctrace |
| `swift-concurrency` | Data-race and Sendable diagnosis, Swift 6 migration plans | The module's concurrency build settings |
| `swift-testing-pro` | Swift Testing reviews, XCTest migration, traits, parameterized and async tests | A Swift toolchain with Swift Testing |
| `swiftdata-pro` | SwiftData models, queries, predicates, indexes, CloudKit | A SwiftData project |
| `core-data-expert` | Core Data stacks, fetches, saving, threading, migrations, CloudKit | A Core Data project |
| `xcode-disk-cleanup` | Auditing and reclaiming Xcode and simulator disk space | Xcode command line tools and python3 |

### Inactive until their prerequisites exist (32)

An inactive part stays in the tree in full. The router runs its activation check first and stops with the missing prerequisites when the check fails.

| Group | Parts | Activation |
|---|---|---|
| Xcode build optimization | `xcode-build/xcode-build-orchestrator`, `xcode-build-benchmark`, `xcode-build-fixer`, `xcode-compilation-analyzer`, `xcode-project-analyzer`, `spm-build-analysis` | An `.xcodeproj` or `.xcworkspace` with a scheme (`xcodebuild -list` lists one) |
| Tuist menu bar apps | `macos-menubar-tuist-app` | `Tuist.swift` and `Project.swift` in the project and `tuist version` succeeds |
| App Store Connect | 25 `app-store-connect/asc-*` parts | `asc` on PATH, `asc auth status --validate` passes, and a paid Apple Developer Program account; Apple Ads, RevenueCat and Wall of Apps parts add their own checks |

Main risks, all gated by the router: the build parts run `xcodebuild clean` and can delete a passed DerivedData folder; the App Store Connect parts can upload, submit for review, change prices, spend money on Apple Ads, revoke certificates or open a public pull request, so the router shows the exact command and waits for an explicit yes before any of these, sets `ASC_TELEMETRY_DISABLED=1` before running `asc`, and never runs `asc install-skills`. Every part's prerequisites, risks and errata are listed in `vendor/sources.json` and in its `UPSTREAM.json`.

## Credits

Every vendored part is MIT-licensed and every vendored file is unmodified. The excludes in `vendor/sources.json` leave out a nested plugin copy, a plugin manifest, agent UI metadata (`agents/openai.yaml`) and icon images, some of which reproduce Apple's Swift logo, so no image ships. Short passages that a part quotes from Apple, such as a sentence of Apple documentation, WWDC session titles, a few phrases or a short code listing, belong to Apple and are not covered by the MIT licences; each part lists the known ones, with their sources, under `appleText` in its `UPSTREAM.json`. Thanks to the authors. Full licence texts are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

<!-- gen:credits -->

| Part | Author | Repository | Commit | Licence |
|---|---|---|---|---|
| `swiftui-expert-skill` | Antoine van der Lee | [AvdLee/SwiftUI-Agent-Skill](https://github.com/AvdLee/SwiftUI-Agent-Skill) | `204dba7c6725` | MIT |
| `swift-concurrency` | Antoine van der Lee | [AvdLee/Swift-Concurrency-Agent-Skill](https://github.com/AvdLee/Swift-Concurrency-Agent-Skill) | `d5770817d262` | MIT |
| `swift-testing-pro` | Paul Hudson | [twostraws/Swift-Testing-Agent-Skill](https://github.com/twostraws/Swift-Testing-Agent-Skill) | `2d6bba14a3c8` | MIT |
| `swiftdata-pro` | Paul Hudson | [twostraws/SwiftData-Agent-Skill](https://github.com/twostraws/SwiftData-Agent-Skill) | `922d989473a9` | MIT |
| `core-data-expert` | Antoine van der Lee | [AvdLee/Core-Data-Agent-Skill](https://github.com/AvdLee/Core-Data-Agent-Skill) | `855ca7d0df50` | MIT |
| `xcode-disk-cleanup` | Antoine van der Lee | [AvdLee/Xcode-Disk-Cleanup-Agent-Skill](https://github.com/AvdLee/Xcode-Disk-Cleanup-Agent-Skill) | `304e86e619ac` | MIT |
| `xcode-build/xcode-build-orchestrator` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `xcode-build/xcode-build-benchmark` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `xcode-build/xcode-build-fixer` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `xcode-build/xcode-compilation-analyzer` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `xcode-build/xcode-project-analyzer` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `xcode-build/spm-build-analysis` | Antoine van der Lee | [AvdLee/Xcode-Build-Optimization-Agent-Skill](https://github.com/AvdLee/Xcode-Build-Optimization-Agent-Skill) | `6bd7b596cd68` | MIT |
| `app-store-connect/asc-cli-usage` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-id-resolver` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-app-create-ui` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-signing-setup` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-xcode-build` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-build-lifecycle` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-testflight-orchestration` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-crash-triage` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-analytics-reports` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-submission-health` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-release-flow` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-metadata-sync` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-localize-metadata` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-whats-new-writer` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-aso-audit` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-screenshot-resize` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-shots-pipeline` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-notarization` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-ad-hoc-distribution` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-workflow` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-apple-ads` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-ppp-pricing` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-subscription-localization` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-revenuecat-catalog-sync` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `app-store-connect/asc-wall-submit` | Rudrank Riyam | [rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) | `9c7e769f09a1` | MIT |
| `macos-menubar-tuist-app` | Thomas Ricouard | [Dimillian/Skills](https://github.com/Dimillian/Skills) | `05ba982bfeb0` | MIT |

<!-- /gen:credits -->

## Maintenance

Node 22 or later; no dependencies.

| Command | What it does |
|---|---|
| `node scripts/vendor-sync.mjs sync [--only <id>] [--force]` | Fetches each pinned repository once (a shallow git fetch by commit), copies every part's tracked files byte for byte with their executable bits, adds the upstream licence and writes `UPSTREAM.json`. Parts that already match only get their metadata refreshed, so a repeated sync is offline. It refuses to start while `.vendor/` holds a symlink or special file, never writes outside the real `.vendor/` folder, and refuses upstream symlinks, submodules, nested git metadata files, images, media, fonts, archives, names outside plain ASCII and names that differ only in case from the `LICENSE` or `UPSTREAM.json` it writes; exclude those in `vendor/sources.json` |
| `node scripts/vendor-sync.mjs check` | Offline: every part's files and executable bits match its `UPSTREAM.json` and the manifest, `appleText` entries name shipped files and existing lines, and nothing else, including symlinks and special files, sits in `.vendor/` |
| `node scripts/vendor-sync.mjs notices [--check]` | Regenerates `THIRD_PARTY_NOTICES.md`, or fails when it is out of date |
| `node scripts/gen.mjs [--check]` | Writes `skills.json`, `skills/apple/references/parts-index.md`, the README credits table and the trademark line in this README and in `skills/apple/NOTICE.md`, from the skill folders and `vendor/sources.json`; `--check` fails when one is out of date. Only the lines between `<!-- gen:<name> -->` markers are generated. The trademark line names the Apple marks that the project's own shipped text uses, the Apple logo while the skill ships it, and Cisco's IOS sentence when iOS is named |
| `node scripts/vendor-guard.mjs [--json]` | Offline guard over what git would ship: MIT licences, part files, sizes, file system entries, file types and signatures, UTF-8, names, hidden Unicode, secrets, skill layout and personal data in the project's own files; risky command patterns are reported as warnings |
| `node scripts/check-history.mjs` | Fails when any commit reachable from HEAD adds an image, font, media file or archive, recognised by extension or by its first bytes, other than a reviewed file with its reviewed bytes (`REVIEWED_MEDIA` in `scripts/lib/media.mjs`; today only `skills/apple/assets/apple.svg`), or any file in a vendored part's `assets/` or `agents/` folder. It needs the full history, so it fails in a shallow clone |
| `node scripts/release.mjs check [vX.Y.Z]` | Validates the release inputs: the payload exists, `skills.json` is current and `.gitattributes` marks exactly the repo-only paths `export-ignore`. With a tag, the tag must match the `package.json` version, `[Unreleased]` must be empty and the newest CHANGELOG entry must be that version, dated, with notes |
| `node scripts/release.mjs notes vX.Y.Z` | Prints the CHANGELOG notes of that version |
| `node scripts/release.mjs pack [vX.Y.Z]` | Builds `dist/design-pro-max-vX.Y.Z.zip` from a clean HEAD (the tag's commit when a tag is given) with git archive, plus `dist/SHA256SUMS.txt` naming it, then verifies both. The ZIP holds one `design-pro-max-vX.Y.Z/` folder with `skills/` (the hidden `.vendor/` folders included), `skills.json`, `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md` and `CHANGELOG.md`; everything else is `export-ignore` |
| `node scripts/release.mjs verify <dir>` | Checks release assets, such as a downloaded release, against the installers' contract: `SHA256SUMS.txt` names exactly one ZIP, without "plugin" in its name, and its hash matches; the ZIP holds one `SKILL.md` outside dot-folders per skill in `skills.json`, every vendored file with the hash in its `UPSTREAM.json`, one MIT `LICENSE` per part and exactly the parts of `vendor/sources.json`, and no symlinks, `__pycache__` folders, compiled Python, `metadata.json` files or media other than reviewed files |
| `npm test` | The test suite, including sync runs against local fake upstream repositories |

To change a pin, edit `vendor/sources.json`, run `sync`, `check`, `notices`, `gen` and the guard, and review the upstream diff before committing.

Exclude globs in `vendor/sources.json` are matched against paths inside the part and anchored at the part's folder, unlike gitignore patterns: `agents/**` leaves out the top-level `agents` folder only, and `**/__pycache__` matches at any depth. A pattern that matches a folder leaves out everything in it, and a trailing slash is ignored.

To record Apple text that a part quotes, add an entry to the part's `appleText` list in `vendor/sources.json` with the `file`, the `lines` (`"12"`, `"12-14"` or `"12, 30"`), the `source` and the `reason`, then run `sync`.

## Disclaimers

- design-pro-max is an independent open-source project and has not been authorized, sponsored, or otherwise approved by Apple Inc.
- design-pro-max is unrelated to nextlevelbuilder/ui-ux-pro-max.
- The apple skill's icon, `skills/apple/assets/apple.svg`, is the Apple logo, a trademark of Apple Inc. It identifies the skill's subject only, is not covered by the MIT License, and must not be modified, recolored or redrawn. The drawing comes from devicon (MIT) via buidangminh23/icons-pro-max. It will be replaced with a neutral icon if Apple asks.
- The vendored parts are their authors' work and are shipped as published. Known errors are recorded as errata in each part's `UPSTREAM.json` rather than edited in place.

<!-- gen:trademarks -->

Apple, the Apple logo, iOS, macOS, Swift, SwiftUI, Xcode, TestFlight and App Store are trademarks of Apple Inc., registered in the U.S. and other countries and regions. IOS is a trademark or registered trademark of Cisco in the U.S. and other countries and is used under license.

<!-- /gen:trademarks -->

## License

The project's own files are released under the [MIT License](LICENSE), except the Apple logo at `skills/apple/assets/apple.svg` (see Disclaimers). Each vendored part keeps its upstream MIT licence in its own `LICENSE` file.
