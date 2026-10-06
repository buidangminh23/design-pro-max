# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Repository scaffold: MIT licence, a package manifest for Node 22 or later with no dependencies, and git attributes that keep vendored bytes unchanged.
- `vendor/sources.json`: 38 parts from 9 repositories, pinned to full commits, with excludes, activation checks, prerequisites, risks, errata and the Apple text each part is known to quote (`appleText`).
- `scripts/vendor-sync.mjs`: `sync` fetches each pinned repository once and copies every part byte for byte with its licence and an `UPSTREAM.json` record; `check` verifies the tree offline; `notices` regenerates `THIRD_PARTY_NOTICES.md`. Sync refuses to run while the vendor folder holds a symlink or special file, never writes outside it, and refuses upstream files that would change what git stores or collide with the files it writes.
- `UPSTREAM.json` for every part: identity, licence, activation, prerequisites, risks, errata and `appleText` first, then each file's SHA-256, size and executable bit. The per-file hashes cover every script, so no separate script hashes are kept; hosts and risky-command counts are computed by the guard on each run instead of being stored.
- `scripts/vendor-guard.mjs`: an offline guard over what git would ship, for licences, part files, sizes, file system entries, file types and signatures, UTF-8, names, hidden Unicode, secrets, skill layout and personal data, with risky command patterns reported as warnings.
- 38 MIT-licensed parts under `skills/apple/.vendor/`, unmodified at their pinned commits: 6 active and 32 inactive until an Xcode project, a Tuist project, or a paid Apple Developer Program account with the asc CLI exists. Agent UI metadata and icon images are excluded, so no image ships. `THIRD_PARTY_NOTICES.md` credits every source with its licence text and says that quoted Apple text is not covered by those licences.
- The `apple` skill: a router `SKILL.md` with standing rules (full reads, part paths resolved from the file that mentions them, activation checks, an approval gate for App Store Connect mutations and disk cleanup deletions, asc telemetry off), a routing table and a parts index.
- README with the layout, why `.vendor` is hidden, the parts and their prerequisites, credits, maintenance commands, exclude glob rules and disclaimers.
- Tests for the manifest, the vendored tree and notices, every guard rule on its own fixture, both command-line tools (including runs through a symlinked path and FIFOs where files are expected), sync against local fake upstream repositories, the router and its path rule, and the README.
