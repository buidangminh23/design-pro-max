#!/bin/zsh
set -a
source settings.env
set +a
echo "$ADMIN_PASSWORD" | sudo -S pmset -a disablesleep 1
echo "done for $ADMIN_USER"
