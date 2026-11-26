#!/bin/sh
set -a
. ./.env
set +a
curl -fsS -H "Authorization: Bearer $DEPLOY_TOKEN" https://deploy.example.com/hook
