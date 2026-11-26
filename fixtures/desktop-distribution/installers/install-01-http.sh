#!/bin/bash
set -euo pipefail
APP="Relay"
URL="http://downloads.example.com/Relay.zip"
SUM="0000000000000000000000000000000000000000000000000000000000000000"
DEST="/Applications/Relay.app"
WORK="$(mktemp -d)"
curl -fsSL -o "$WORK/app.zip" "$URL"
GOT="$(shasum -a 256 "$WORK/app.zip" | awk '{print $1}')"
[ "$GOT" = "$SUM" ] || exit 1
ditto -x -k "$WORK/app.zip" "$WORK/out"
codesign --verify --deep --strict "$WORK/out/Relay.app"
/usr/bin/xattr -dr com.apple.quarantine "$WORK/out/Relay.app"
ditto "$WORK/out/Relay.app" "$WORK/staged.app"
if [ -d "$DEST" ]; then mv "$DEST" "$WORK/old.app"; fi
mv "$WORK/staged.app" "$DEST"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST"
