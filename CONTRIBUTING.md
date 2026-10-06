# Contributing

design-pro-max ships agent skills, one per design. Today there is one, `apple`: a router over third-party guides ("parts") that are vendored byte for byte under `skills/apple/.vendor/`.

## Open an issue first

Open an issue before a pull request. Describe the problem, or the guide you want added with a link to its source, and wait until the approach is agreed. A pull request without an agreed issue may be closed.

## Sources must be MIT-licensed

A vendored part must come from a public repository under the MIT licence, with the licence text in the part's folder or at the repository root. `sync` copies only parts whose licence matches the MIT text, and the guard fails anything else, so a source without a licence, under another licence, under PolyForm or a noncompete clause, or with any limit on redistribution cannot be added.

Short passages a part quotes from Apple, such as WWDC session titles or a sentence of Apple documentation, are recorded under `appleText` in `vendor/sources.json`. A part that reproduces Apple's design guidelines, fonts, symbols or images cannot be added.

## How a part is added

1. Agree in the issue on the part's id, its routing row, whether it is active, and the activation check of an inactive part.
2. Add its entry to `vendor/sources.json`: `id`, `repo`, the full 40-character `commit`, the `path` of its skill folder, `exclude` globs for everything that must not ship (`agents/**`, `assets/**`, images, media, plugin manifests, nested git metadata), and `active`, `activation`, `prerequisites`, `risks`, `errata` and `appleText`.
3. Run `node scripts/vendor-sync.mjs sync --only <id>`, then `node scripts/vendor-sync.mjs check`, `node scripts/vendor-sync.mjs notices`, `node scripts/gen.mjs` and `node scripts/vendor-guard.mjs`.
4. Route it in `skills/apple/SKILL.md`: an active part gets a routing row and an inactive part its activation check, and the router's parts index names it.
5. Add it to the Parts tables of the README. The credits table, `THIRD_PARTY_NOTICES.md`, `skills.json` and `skills/apple/references/parts-index.md` are generated.
6. Run `npm test` and `node scripts/check-history.mjs`, then open the pull request.

Never edit a vendored file. Record a known error as an erratum in `vendor/sources.json`, naming the file and line it overrides, and sync again.

## The project's own files

- Code runs on Node 22 or later, uses ES modules and the standard library only, and carries no inline comments; a file header or a function's doc comment is fine.
- No images, fonts, media or archives except reviewed files listed in `scripts/lib/media.mjs`. The history check covers every commit, so a file removed later still fails.
- No symlinks, no files named `metadata.json`, and no `.claude`, `.agents` or `.codex` folders under `skills/`.
- No personal data: home or volume paths, email addresses, account or machine names. The guard checks for them.
- Apple's marks only to refer to Apple's products. The trademark line in the README and in `skills/apple/NOTICE.md` is generated from the marks the project uses.
- Commit messages follow Conventional Commits.

## Vendor updates

The weekly vendor sync proposes upstream changes as one pull request on the `vendor-sync` branch. A `safe` update merges itself once its checks pass; a `needs-review` update waits for the maintainer. Comments on that pull request about what you checked in the upstream diff are welcome.

## Releases

The maintainer cuts releases from `vX.Y.Z` tags; the README's Maintenance section describes the steps and the workflows.
