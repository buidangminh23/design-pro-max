# Signing and Gatekeeper

## Contents

- Which signature, for whom
- Signing inside out, one team
- Reading codesign and spctl
- Notarization handoff
- Recording a probe on another Mac

## Which signature, for whom

| Signature | Who can open it | Use it for |
|---|---|---|
| Ad hoc (`codesign -s -`) | The Mac that built it; any Mac when no quarantine flag is set, which is the case for a download made with curl (IL-20) | Builds for yourself, and the checksum-checking curl installer in `installers-and-dmg.md` [DD-WARN-ADHOC] |
| Apple Development | The developer's own Macs; Gatekeeper refuses a downloaded copy | Debug builds, never a download [DD-WARN-ADHOC] |
| Developer ID Application, notarized | Anyone, from a browser download, a disk image or Homebrew [DD-GATE-01] | Every build other people download |
| Mac App Store | Through the store only | The App Store Connect rows of the router |

On Apple silicon, native code that carries no signature at all does not run; the linker adds an ad hoc signature by default, and copying or editing a binary afterwards breaks it (IL-20). A Developer ID build that is not notarized opens only after the person approves it in System Settings, which most people will not do: notarize every Developer ID download.

## Signing inside out, one team

- Sign the innermost code first: loose executables and dylibs, then frameworks, helpers, XPC services, extensions and login items, and the app last. Signing the app with `--deep` re-signs nested code with the app's options and entitlements, so sign each piece on its own and keep `--deep` for verification [DD-SIGN-01].
- Every piece carries the app's team identifier [DD-TEAM-01]. A process that checks its peer's team (an XPC listener, a socket server that reads the client's signature, library validation under the hardened runtime) refuses code from any other team. A helper that runs node, python, ruby, deno or bun found on PATH, in Homebrew or in a version manager runs a binary signed by someone else or not at all; it was refused in exactly this way (IL-19). Bundle the runtime inside the app, sign it with the app's identity and start it by its path inside the bundle.
- Developer ID code is signed with `--options runtime` (the hardened runtime) and `--timestamp`; notarization refuses code without either [DD-WARN-RUNTIME]. Add only the entitlements the code needs; a bundled JavaScript or Python runtime usually needs `com.apple.security.cs.allow-jit` or `allow-unsigned-executable-memory`; write down which code needs it and why.

```
codesign --force --timestamp --options runtime --sign "Developer ID Application: <Name> (<TEAMID>)" App.app/Contents/Resources/runtime/node
codesign --force --timestamp --options runtime --entitlements App.entitlements --sign "Developer ID Application: <Name> (<TEAMID>)" App.app
codesign --verify --deep --strict --verbose=2 App.app
```

## Reading codesign and spctl

- `codesign -dv --verbose=4 <path>` prints its report on standard error, so pipe with `2>&1` (IL-19). Read `TeamIdentifier`, the `Authority` chain, `Signature=adhoc`, `flags=0x10000(runtime)` and `Timestamp`.
- `codesign --verify --deep --strict --verbose=2 App.app` exits 0 only when the seal of the app and every nested piece holds. "a sealed resource is missing or invalid" means a file changed after signing: re-sign, never edit a signed bundle [DD-SIGN-01].
- `spctl --assess --type execute --verbose=4 App.app` answers as Gatekeeper would for a quarantined copy: `accepted` with `source=Notarized Developer ID` is the goal [DD-GATE-01]. For a disk image use `spctl --assess --type open --context context:primary-signature --verbose=4 App.dmg`.
- A check run by hand from Terminal can be refused for another reason than the same check made by the app's own process: confirm a helper's acceptance in the app's log, not only by hand (IL-19).

## Notarization handoff

Notarizing is the router's notarization row (`asc-notarization`): it archives, exports with Developer ID, submits and staples. This part checks the result before and after: `probe-app.mjs` must pass DD-SIGN-01 and DD-TEAM-01 before you submit, and DD-GATE-01 after. Submitting needs the user's explicit yes, as every notarizing command does. Staple the ticket to what people download (the app inside a zip, or the disk image) with `xcrun stapler staple`, and check it with `xcrun stapler validate`.

## Recording a probe on another Mac

When the build is on a Mac you cannot run the probe on, ask the user to run these and send the outputs, then build the `--record` file the probe's header describes:

```
codesign --verify --deep --strict --verbose=2 App.app; echo "exit $?"
codesign -dv --verbose=4 App.app 2>&1
find App.app/Contents -type f -perm -u+x -exec sh -c 'file -b "$1" | grep -q Mach-O && { echo "== $1"; codesign -dv --verbose=4 "$1" 2>&1; }' _ {} \;
spctl --assess --type execute --verbose=4 App.app; echo "exit $?"
type -a xattr codesign ditto hdiutil plutil
```
