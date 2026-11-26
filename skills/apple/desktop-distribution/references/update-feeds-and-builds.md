# Update feeds and build machines

## Contents

- Every platform, from the first release
- JSON feeds (Tauri's updater)
- Sparkle appcasts
- The release gate
- PATH and the build machine

## Every platform, from the first release

A self-update feed that has no entry for a platform leaves every install on that platform on its first build, with nothing but a log line about missing fallback platforms (IL-21). The usual cause is a release gate that requires a platform only once it has been served: nothing serves the first one, so the rule never fires. Require every platform the release builds, from the first release [DD-FEED-01].

## JSON feeds (Tauri's updater)

The static feed is a JSON file with `version`, `notes`, `pub_date` and a `platforms` map; each key is an os-arch pair (`darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`, `linux-x86_64`), optionally with an installer suffix (`darwin-aarch64-app`), and each entry has an https `url` and the `signature` of that archive, the contents of the `.sig` file the build wrote. `assets/latest.json` is a feed for a universal Mac build: both Mac keys point at the same archive.

- Write the feed in the job that built and signed every archive, from the archives it actually produced; never by hand.
- The signing key's public half is in the app; losing the private key means shipping an app that can no longer update. Keep it as a CI secret and a backup, never in the repository.
- Check the feed before publishing: `node <absolute path to this part>/scripts/check-feed.mjs --platforms darwin-aarch64,darwin-x86_64 latest.json`.

## Sparkle appcasts

The newest `<item>` needs an https `<enclosure>` with `sparkle:edSignature` (the EdDSA signature `sign_update` prints) and a `sparkle:version` that is higher than the installed `CFBundleVersion` [DD-FEED-01]. A universal binary needs one item; separate builds per architecture need the architecture checks Sparkle documents. `check-feed.mjs` reads an appcast too.

## The release gate

Fail the release job, before anything is published, when any of these is false:

1. Every planned platform built, and each archive has its signature [DD-FEED-01].
2. `probe-app.mjs` on the Mac build passes DD-SIGN-01, DD-TEAM-01 and, for a Developer ID build, DD-GATE-01 after notarization.
3. The feed passes `check-feed.mjs` with the full `--platforms` list, and the cask (if any) passes `check-cask.mjs`.
4. The archive URLs in the feed, the cask and the installer all name this release's files, with matching checksums.

Publish the archives first and the feed last, so an update check never sees a feed whose files are not there yet.

## PATH and the build machine

- Build, sign and package with `/usr/bin` first on PATH. A `pip install xattr` earlier on PATH broke a bundling step (IL-23); the same can happen with a `codesign`, `ditto`, `hdiutil` or `plutil` from Homebrew or npm [DD-WARN-PATH]. `type -a xattr codesign ditto` lists every copy; `probe-app.mjs` reports the first.
- Run one Xcode or packaging build at a time; if a build fails inside an agent sandbox on keychain or cache access, ask to run it outside the sandbox.
- Signing in CI uses a temporary keychain that the job creates, unlocks and deletes; on a shared Mac, never import a Developer ID identity into the login keychain of another user.
