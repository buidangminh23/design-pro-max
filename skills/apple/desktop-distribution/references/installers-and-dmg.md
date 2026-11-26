# Installers and disk images

## Contents

- Why a curl installer has to check everything itself
- The installer, step by step
- Publishing the installer
- Disk images

## Why a curl installer has to check everything itself

Gatekeeper judges files that carry the quarantine flag, which browsers, Mail and other downloading apps set. curl sets none, so whatever a `curl ... | bash` installer writes opens without a Gatekeeper check, ad hoc signed and unnotarized builds included (IL-20). That makes the installer the only gate: it has to check the archive, the signature and the swap itself. `assets/install-macos.sh` does each step below and passes `check-installer.mjs`; copy it and replace the example values.

## The installer, step by step

1. `set -euo pipefail`, refuse to run off macOS, and set `PATH="/usr/bin:/bin:/usr/sbin:/sbin"` so the system copies of `xattr`, `codesign` and `ditto` run [DD-WARN-PATH].
2. Download over https with certificate checks on: `curl --fail --location --proto '=https'`, never `-k` or a plain http URL [DD-INSTALL-01].
3. Compare the SHA-256 of the archive with the published value and stop on a mismatch, before unpacking: `shasum -a 256` and a test, or `shasum -a 256 -c` [DD-INSTALL-01]. Publish the checksum next to the archive in the same release, from the same build job.
4. Unpack with `ditto -x -k` into a temporary folder.
5. Verify the unpacked app with `codesign --verify --deep --strict` and, when you know it, compare its `TeamIdentifier` with the expected team [DD-INSTALL-02]. Do this before anything touches the installed copy.
6. Remove quarantine only now, only from the verified copy, and with `/usr/bin/xattr -dr com.apple.quarantine` by its full path, in case the archive reached the Mac through a browser [DD-WARN-XATTR]. A `pip install xattr` earlier on PATH once broke a build in the same place (IL-23).
7. Copy with `ditto` to a staging path beside the destination (same volume, so the renames are atomic), rename the installed app aside, rename the staged app into place, and only then delete the old one; if the second rename fails, rename the old one back [DD-INSTALL-03]. Deleting first leaves the person with no app when anything later fails; `cp -R` over a running app mixes two versions inside one bundle and breaks its seal.
8. Register the result: `lsregister -f` on the installed app, and `pluginkit -a` on each extension in `Contents/PlugIns`, so Finder, Launchpad and the widget gallery see the new copy (IL-20) [DD-WARN-REGISTER]. A self-updating app also cleans up stale extension processes at launch; that is `../../menubar-widgets/PART.md`, rule MW-STALE-01 (IL-14).
9. Ask the person to quit the app before replacing it, or quit it with its own quit command; never kill processes by name.

## Publishing the installer

- Serve the script over https from the same origin as the archive, and pin the archive URL and checksum inside the script for each release, so an old script never installs a newer, unchecked archive.
- Show the command on the download page in full; say that it installs into `/Applications` and how to uninstall (move the app to the Trash, and the files a cask's zap stanza would remove).
- A Developer ID build that is notarized is better given out as a disk image or a zip; the curl installer is the path for ad hoc builds and for people who prefer a command [DD-WARN-ADHOC].

## Disk images

Build a compressed read-only image from a folder that holds the app and, if you like, a link to `/Applications`. Then sign, notarize and staple the image itself, and check it before publishing [DD-WARN-DMG]:

```
mkdir -p dmg && ditto App.app dmg/App.app && ln -s /Applications dmg/Applications
hdiutil create -volname "App" -srcfolder dmg -format UDZO -ov App.dmg
codesign --timestamp --sign "Developer ID Application: <Name> (<TEAMID>)" App.dmg
# notarize App.dmg through the router's notarization row, then:
xcrun stapler staple App.dmg
hdiutil verify App.dmg
spctl --assess --type open --context context:primary-signature --verbose=4 App.dmg
```

Mount the published image on a clean Mac (or a new user account), drag the app out, and open it: that is the check none of the scripts here can make.
