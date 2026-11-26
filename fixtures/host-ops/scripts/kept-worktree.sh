#!/bin/sh
set -eu
git -C "$HOME/src/app" worktree add "$HOME/deploy/app-prod" origin/main
log=$(mktemp /tmp/deploy.XXXXXX)
cd "$HOME/deploy/app-prod" && ./deploy.sh >"$log" 2>&1
