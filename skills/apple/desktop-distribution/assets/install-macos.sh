#!/bin/bash
# desktop-distribution installer template (design-pro-max). Replace every EXAMPLE value before publishing.
# People run it with: curl -fsSL https://example.com/install.sh | bash
# Files fetched by curl carry no quarantine flag, so the script itself must check what it installs.
set -euo pipefail

APP_NAME="Example"
VERSION="1.0.0"
ARCHIVE_URL="https://downloads.example.com/${APP_NAME}-${VERSION}-macos-universal.zip"
ARCHIVE_SHA256="0000000000000000000000000000000000000000000000000000000000000000"
EXPECTED_TEAM="ABCDE12345"
DEST="/Applications/${APP_NAME}.app"

PATH="/usr/bin:/bin:/usr/sbin:/sbin"
export PATH
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

fail() { printf '%s\n' "install: $*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "this installer is for macOS"
if pgrep -xq "${APP_NAME}"; then fail "quit ${APP_NAME} and run the installer again"; fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 -o "${WORK}/app.zip" "${ARCHIVE_URL}"

ACTUAL_SHA256="$(shasum -a 256 "${WORK}/app.zip" | awk '{print $1}')"
if [ "${ACTUAL_SHA256}" != "${ARCHIVE_SHA256}" ]; then
  fail "checksum mismatch: expected ${ARCHIVE_SHA256}, got ${ACTUAL_SHA256}"
fi

ditto -x -k "${WORK}/app.zip" "${WORK}/unpacked"
[ -d "${WORK}/unpacked/${APP_NAME}.app" ] || fail "the archive holds no ${APP_NAME}.app"

codesign --verify --deep --strict --verbose=2 "${WORK}/unpacked/${APP_NAME}.app" || fail "the signature does not verify"
TEAM="$(codesign -dv "${WORK}/unpacked/${APP_NAME}.app" 2>&1 | sed -n 's/^TeamIdentifier=//p')"
if [ -n "${EXPECTED_TEAM}" ] && [ "${TEAM}" != "${EXPECTED_TEAM}" ]; then
  fail "signed by team ${TEAM:-none}, expected ${EXPECTED_TEAM}"
fi

/usr/bin/xattr -dr com.apple.quarantine "${WORK}/unpacked/${APP_NAME}.app"

STAGED="${DEST%.app}.installing.app"
OLD="${DEST%.app}.previous.app"
rm -rf "${STAGED}" "${OLD}"
ditto "${WORK}/unpacked/${APP_NAME}.app" "${STAGED}"

if [ -d "${DEST}" ]; then mv "${DEST}" "${OLD}"; fi
if ! mv "${STAGED}" "${DEST}"; then
  if [ -d "${OLD}" ]; then mv "${OLD}" "${DEST}"; fi
  fail "could not move the new copy into place; the previous copy is back"
fi
rm -rf "${OLD}"

"${LSREGISTER}" -f "${DEST}"
for EXTENSION in "${DEST}"/Contents/PlugIns/*.appex; do
  [ -d "${EXTENSION}" ] && pluginkit -a "${EXTENSION}"
done

printf '%s\n' "Installed ${APP_NAME} ${VERSION} in ${DEST}"
