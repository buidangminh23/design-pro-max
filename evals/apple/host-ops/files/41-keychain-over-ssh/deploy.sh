#!/bin/sh
set -eu
ssh build-mac "cd ~/src/app && git pull && docker build -t registry.example.com/app:$(git rev-parse --short HEAD) . && docker push registry.example.com/app:$(git rev-parse --short HEAD)"
