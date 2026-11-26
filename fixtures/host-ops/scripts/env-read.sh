#!/bin/sh
set -eu
token=$(grep -E '^DEPLOY_TOKEN=' .env | cut -d= -f2-)
[ -n "$token" ] || { echo "DEPLOY_TOKEN is empty" >&2; exit 1; }
echo "DEPLOY_TOKEN has ${#token} characters"
