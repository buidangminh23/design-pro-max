#!/bin/bash
set -euo pipefail
rm -rf /private/tmp/app-prod
git -C "$HOME/src/app" worktree add /private/tmp/app-prod origin/main
cd /private/tmp/app-prod
./build.sh
if docker ps | grep -q app-web; then
  docker compose up -d --no-deps web
else
  docker compose up -d
fi
