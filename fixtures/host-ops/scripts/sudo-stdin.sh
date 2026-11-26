#!/bin/sh
echo "$ADMIN_PASSWORD" | sudo -S pmset -a disablesleep 1
