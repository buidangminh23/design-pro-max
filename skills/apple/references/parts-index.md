# Parts index

Generated from `vendor/sources.json` by `node scripts/gen.mjs`; do not edit it by hand. Paths are relative to the apple skill's folder, the folder of `SKILL.md`; an erratum pointer such as `SKILL.md:89` is relative to its part's folder. An erratum overrides the line it names, and each part's `UPSTREAM.json` holds the full text of its prerequisites, risks and errata.

| Group | Parts | Active |
|---|---|---|
| Top level | 7 | 6 |
| `xcode-build/` | 6 | 0 |
| `app-store-connect/` | 25 | 0 |

## Top level

### `swiftui-expert-skill`

- Guide: `.vendor/swiftui-expert-skill/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - None for SwiftUI code work.
  - Trace recording and analysis (scripts/record_trace.py, scripts/analyze_trace.py) need python3 and Xcode's xctrace; run them outside the agent sandbox, one trace at a time on 8 GB Macs.
- Errata (4): `references/latest-apis.md:381, :386, :418`; `references/latest-apis.md:402, :406`; `references/toolbar-patterns.md:33`; `references/latest-apis.md:5`
- Risks: 1
- Record: `.vendor/swiftui-expert-skill/UPSTREAM.json` holds the full text of all of the above

### `swift-concurrency`

- Guide: `.vendor/swift-concurrency/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - Access to the module's build settings: read default isolation, NonisolatedNonsendingByDefault and the strict-concurrency level from Package.swift, the .pbxproj or the swiftc build script before advising.
- Errata (3): `SKILL.md:89`; `references/threading.md:306, :342, :470`; `SKILL.md:20`
- Risks: 1
- Record: `.vendor/swift-concurrency/UPSTREAM.json` holds the full text of all of the above

### `swift-testing-pro`

- Guide: `.vendor/swift-testing-pro/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - A Swift toolchain with Swift Testing.
- Errata (1): one about the whole part
- Risks: 1
- Record: `.vendor/swift-testing-pro/UPSTREAM.json` holds the full text of all of the above

### `swiftdata-pro`

- Guide: `.vendor/swiftdata-pro/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - None beyond a project that uses SwiftData.
- Errata (2): `references/predicates.md:41`; `references/core-rules.md:12`
- Risks: 1
- Record: `.vendor/swiftdata-pro/UPSTREAM.json` holds the full text of all of the above

### `core-data-expert`

- Guide: `.vendor/core-data-expert/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - None beyond a project that uses Core Data.
- Errata (1): `references/batch-operations.md:26-34`
- Risks: 1
- Record: `.vendor/core-data-expert/UPSTREAM.json` holds the full text of all of the above

### `xcode-disk-cleanup`

- Guide: `.vendor/xcode-disk-cleanup/SKILL.md`
- Status: active
- Activation: None; active by default.
- Prerequisites:
  - macOS with Xcode's command line tools (xcrun, simctl) and python3.
  - Run the audit outside the agent sandbox; xcrun hits a cache error inside it.
- Errata (1): `scripts/xcode_disk_cleanup.py:567`
- Risks: 3
- Record: `.vendor/xcode-disk-cleanup/UPSTREAM.json` holds the full text of all of the above

### `macos-menubar-tuist-app`

- Guide: `.vendor/macos-menubar-tuist-app/SKILL.md`
- Status: inactive until its activation check passes
- Activation: Tuist.swift and Project.swift exist in the working project and `tuist version` succeeds.
- Prerequisites:
  - Tuist on PATH and a Tuist-managed project (Tuist.swift and Project.swift).
- Errata (2): 2 about the whole part
- Risks: 1
- Record: `.vendor/macos-menubar-tuist-app/UPSTREAM.json` holds the full text of all of the above

## `xcode-build/`

Activation, unless a part below names its own: The working project has an .xcodeproj or .xcworkspace with a scheme: `xcodebuild -list`, run outside the agent sandbox, lists at least one scheme.

Prerequisites of every part below:

- Xcode and an .xcodeproj or .xcworkspace with a scheme.
- python3 for the bundled scripts.
- Run xcodebuild outside the agent sandbox; SwiftPM packages fail to resolve inside it.

### `xcode-build-orchestrator`

- Guide: `.vendor/xcode-build/xcode-build-orchestrator/SKILL.md`
- Status: inactive until its activation check passes
- Errata (2): `scripts/diagnose_compilation.py:172`; `references/build-settings-best-practices.md:153`
- Risks: 4
- Record: `.vendor/xcode-build/xcode-build-orchestrator/UPSTREAM.json` holds the full text of all of the above

### `xcode-build-benchmark`

- Guide: `.vendor/xcode-build/xcode-build-benchmark/SKILL.md`
- Status: inactive until its activation check passes
- Errata: none recorded
- Risks: 2
- Record: `.vendor/xcode-build/xcode-build-benchmark/UPSTREAM.json` holds the full text of all of the above

### `xcode-build-fixer`

- Guide: `.vendor/xcode-build/xcode-build-fixer/SKILL.md`
- Status: inactive until its activation check passes
- Errata (1): `references/build-settings-best-practices.md:153`
- Risks: 3
- Record: `.vendor/xcode-build/xcode-build-fixer/UPSTREAM.json` holds the full text of all of the above

### `xcode-compilation-analyzer`

- Guide: `.vendor/xcode-build/xcode-compilation-analyzer/SKILL.md`
- Status: inactive until its activation check passes
- Errata (1): `SKILL.md:28`, `references/code-compilation-checks.md:11`, `scripts/diagnose_compilation.py:172`
- Risks: 2
- Record: `.vendor/xcode-build/xcode-compilation-analyzer/UPSTREAM.json` holds the full text of all of the above

### `xcode-project-analyzer`

- Guide: `.vendor/xcode-build/xcode-project-analyzer/SKILL.md`
- Status: inactive until its activation check passes
- Errata (1): `references/build-settings-best-practices.md:153`
- Risks: none recorded
- Record: `.vendor/xcode-build/xcode-project-analyzer/UPSTREAM.json` holds the full text of all of the above

### `spm-build-analysis`

- Guide: `.vendor/xcode-build/spm-build-analysis/SKILL.md`
- Status: inactive until its activation check passes
- Errata: none recorded
- Risks: none recorded
- Record: `.vendor/xcode-build/spm-build-analysis/UPSTREAM.json` holds the full text of all of the above

## `app-store-connect/`

Activation, unless a part below names its own: `command -v asc` succeeds, `asc auth status --validate` passes, and the user confirms a paid Apple Developer Program account.

### `asc-cli-usage`

- Guide: `.vendor/app-store-connect/asc-cli-usage/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata (1): `SKILL.md:3`
- Risks: 3
- Record: `.vendor/app-store-connect/asc-cli-usage/UPSTREAM.json` holds the full text of all of the above

### `asc-id-resolver`

- Guide: `.vendor/app-store-connect/asc-id-resolver/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata: none recorded
- Risks: none recorded
- Record: `.vendor/app-store-connect/asc-id-resolver/UPSTREAM.json` holds the full text of all of the above

### `asc-app-create-ui`

- Guide: `.vendor/app-store-connect/asc-app-create-ui/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - An Account Holder, Admin or App Manager role, and the Account Holder has signed the latest agreement.
  - The user's own signed-in browser session; Apple offers no API for creating app records.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-app-create-ui/UPSTREAM.json` holds the full text of all of the above

### `asc-signing-setup`

- Guide: `.vendor/app-store-connect/asc-signing-setup/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - The Account Holder role for Developer ID certificates.
  - A git repository for encrypted signing sync.
  - An Apple ID web session for App Groups.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-signing-setup/UPSTREAM.json` holds the full text of all of the above

### `asc-xcode-build`

- Guide: `.vendor/app-store-connect/asc-xcode-build/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - An Xcode project with working signing.
- Errata: none recorded
- Risks: 2
- Record: `.vendor/app-store-connect/asc-xcode-build/UPSTREAM.json` holds the full text of all of the above

### `asc-build-lifecycle`

- Guide: `.vendor/app-store-connect/asc-build-lifecycle/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata: none recorded
- Risks: 2
- Record: `.vendor/app-store-connect/asc-build-lifecycle/UPSTREAM.json` holds the full text of all of the above

### `asc-testflight-orchestration`

- Guide: `.vendor/app-store-connect/asc-testflight-orchestration/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata (1): one about the whole part
- Risks: 1
- Record: `.vendor/app-store-connect/asc-testflight-orchestration/UPSTREAM.json` holds the full text of all of the above

### `asc-crash-triage`

- Guide: `.vendor/app-store-connect/asc-crash-triage/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata: none recorded
- Risks: none recorded
- Record: `.vendor/app-store-connect/asc-crash-triage/UPSTREAM.json` holds the full text of all of the above

### `asc-analytics-reports`

- Guide: `.vendor/app-store-connect/asc-analytics-reports/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI with an Admin API key.
  - jq, openssl and a live app.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-analytics-reports/UPSTREAM.json` holds the full text of all of the above

### `asc-submission-health`

- Guide: `.vendor/app-store-connect/asc-submission-health/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - An Apple ID web session for App Privacy.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-submission-health/UPSTREAM.json` holds the full text of all of the above

### `asc-release-flow`

- Guide: `.vendor/app-store-connect/asc-release-flow/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-release-flow/UPSTREAM.json` holds the full text of all of the above

### `asc-metadata-sync`

- Guide: `.vendor/app-store-connect/asc-metadata-sync/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata (1): `SKILL.md:160`
- Risks: 1
- Record: `.vendor/app-store-connect/asc-metadata-sync/UPSTREAM.json` holds the full text of all of the above

### `asc-localize-metadata`

- Guide: `.vendor/app-store-connect/asc-localize-metadata/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
- Errata (1): `SKILL.md:93, :108`
- Risks: 1
- Record: `.vendor/app-store-connect/asc-localize-metadata/UPSTREAM.json` holds the full text of all of the above

### `asc-whats-new-writer`

- Guide: `.vendor/app-store-connect/asc-whats-new-writer/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - Drafting and localizing (phases 1-3) need no asc when the user supplies keywords.
  - Uploading needs a paid Apple Developer Program account and asc with an App Store Connect API key.
- Errata (1): one about the whole part
- Risks: 1
- Record: `.vendor/app-store-connect/asc-whats-new-writer/UPSTREAM.json` holds the full text of all of the above

### `asc-aso-audit`

- Guide: `.vendor/app-store-connect/asc-aso-audit/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - Offline checks of the ./metadata files need no asc.
  - Keyword gap analysis uses Astro MCP (optional, SKILL.md:15); the optimize plan needs Apple Ads credentials.
- Errata (1): `SKILL.md:105`
- Risks: 1
- Record: `.vendor/app-store-connect/asc-aso-audit/UPSTREAM.json` holds the full text of all of the above

### `asc-screenshot-resize`

- Guide: `.vendor/app-store-connect/asc-screenshot-resize/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - sips, built into macOS, for checks and resizing.
  - Uploading needs a paid Apple Developer Program account and asc with an App Store Connect API key.
- Errata (1): `SKILL.md:119`
- Risks: 2
- Record: `.vendor/app-store-connect/asc-screenshot-resize/UPSTREAM.json` holds the full text of all of the above

### `asc-shots-pipeline`

- Guide: `.vendor/app-store-connect/asc-shots-pipeline/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - AXe and Koubou 0.20.0 (install Koubou in a virtual environment).
  - bash 4 or later for `declare -A` (SKILL.md:205, :252, :316); macOS /bin/bash is 3.2.
- Errata (1): one about the whole part
- Risks: 1
- Record: `.vendor/app-store-connect/asc-shots-pipeline/UPSTREAM.json` holds the full text of all of the above

### `asc-notarization`

- Guide: `.vendor/app-store-connect/asc-notarization/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - A Developer ID Application certificate, which only the Account Holder can create.
  - An Xcode project for the archive steps; apps built without Xcode use only the notarize and staple steps.
- Errata (1): `SKILL.md:152-153`
- Risks: 1
- Record: `.vendor/app-store-connect/asc-notarization/UPSTREAM.json` holds the full text of all of the above

### `asc-ad-hoc-distribution`

- Guide: `.vendor/app-store-connect/asc-ad-hoc-distribution/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The experimental `asc distribute` command.
  - A PKCS#12 signing identity, a devices file, an S3 bucket and jq.
- Errata: none recorded
- Risks: 2
- Record: `.vendor/app-store-connect/asc-ad-hoc-distribution/UPSTREAM.json` holds the full text of all of the above

### `asc-workflow`

- Guide: `.vendor/app-store-connect/asc-workflow/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI, jq and a trusted .asc/workflow.json file.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-workflow/UPSTREAM.json` holds the full text of all of the above

### `asc-apple-ads`

- Guide: `.vendor/app-store-connect/asc-apple-ads/SKILL.md`
- Status: inactive until its activation check passes
- Activation: `command -v asc` succeeds, `asc ads auth status --validate` (SKILL.md:51) passes, and the user confirms a paid Apple Developer Program account; it uses Apple Ads OAuth, not the App Store Connect API key.
- Prerequisites:
  - A paid Apple Developer Program account.
  - An Apple Ads account with an OAuth client ID and team ID.
  - The asc CLI and jq.
- Errata: none recorded
- Risks: 3
- Record: `.vendor/app-store-connect/asc-apple-ads/UPSTREAM.json` holds the full text of all of the above

### `asc-ppp-pricing`

- Guide: `.vendor/app-store-connect/asc-ppp-pricing/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - Existing in-app purchases or subscriptions.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-ppp-pricing/UPSTREAM.json` holds the full text of all of the above

### `asc-subscription-localization`

- Guide: `.vendor/app-store-connect/asc-subscription-localization/SKILL.md`
- Status: inactive until its activation check passes
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - Existing subscriptions.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-subscription-localization/UPSTREAM.json` holds the full text of all of the above

### `asc-revenuecat-catalog-sync`

- Guide: `.vendor/app-store-connect/asc-revenuecat-catalog-sync/SKILL.md`
- Status: inactive until its activation check passes
- Activation: `command -v asc` succeeds, `asc auth status --validate` passes, the RevenueCat MCP tools (mcp_RC_*) are available, and the user confirms a paid Apple Developer Program account.
- Prerequisites:
  - A paid Apple Developer Program account.
  - The asc CLI on PATH with an App Store Connect API key (the .p8 key downloads only once).
  - The RevenueCat MCP server (mcp_RC_* tools, SKILL.md:74-77) and a RevenueCat v2 API key.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-revenuecat-catalog-sync/UPSTREAM.json` holds the full text of all of the above

### `asc-wall-submit`

- Guide: `.vendor/app-store-connect/asc-wall-submit/SKILL.md`
- Status: inactive until its activation check passes
- Activation: `command -v asc` succeeds, `gh auth status` succeeds, the user confirms a paid Apple Developer Program account, and the user explicitly asks for a Wall of Apps submission.
- Prerequisites:
  - The asc CLI and a signed-in gh.
  - An App Store app ID, or a TestFlight link plus an app name.
  - SKILL.md:25 runs its commands from an App-Store-Connect-CLI repository checkout.
- Errata: none recorded
- Risks: 1
- Record: `.vendor/app-store-connect/asc-wall-submit/UPSTREAM.json` holds the full text of all of the above
