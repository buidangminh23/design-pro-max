#!/bin/sh
set -eu
git -C "$HOME/src/app" fetch origin
git -C "$HOME/src/app" worktree add /private/tmp/app-prod origin/main
cd /private/tmp/app-prod && ./deploy.sh
