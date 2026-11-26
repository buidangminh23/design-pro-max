#!/bin/bash
set -euo pipefail
if launchctl list | grep -q com.example.sync; then
  echo loaded
else
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.example.sync.plist"
fi
