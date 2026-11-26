#!/bin/bash
set -euo pipefail
jobs=$(launchctl list)
case "$jobs" in
  *com.example.sync*) echo loaded ;;
  *) launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.example.sync.plist" ;;
esac
if system_profiler SPBluetoothDataType | grep 'Connected: Yes' >/dev/null; then echo connected; fi
