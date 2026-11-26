#!/bin/bash
APP="/Applications/Relay.app"
curl -L -o /tmp/Relay.zip http://downloads.example.com/Relay.zip
unzip -o /tmp/Relay.zip -d /tmp/relay
rm -rf "$APP"
cp -R /tmp/relay/Relay.app /Applications/
xattr -dr com.apple.quarantine "$APP"
open "$APP"
