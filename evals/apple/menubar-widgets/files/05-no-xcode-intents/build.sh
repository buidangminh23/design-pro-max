#!/bin/sh
set -eu

APP="build/Weather.app"
APPEX="$APP/Contents/PlugIns/WeatherWidget.appex"
SDK="$(xcrun --show-sdk-path --sdk macosx)"
TARGET="arm64-apple-macos14"
IDENTITY="${SIGN_IDENTITY:--}"

rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APPEX/Contents/MacOS"

swiftc -sdk "$SDK" -target "$TARGET" -O -parse-as-library \
  Sources/App/*.swift -o "$APP/Contents/MacOS/Weather"

swiftc -sdk "$SDK" -target "$TARGET" -O -parse-as-library \
  -application-extension \
  Sources/Widget/*.swift -o "$APPEX/Contents/MacOS/WeatherWidget"

cp Resources/App-Info.plist "$APP/Contents/Info.plist"
cp Resources/Widget-Info.plist "$APPEX/Contents/Info.plist"

codesign --force --deep --options runtime \
  --entitlements Resources/App.entitlements \
  --sign "$IDENTITY" "$APP"
