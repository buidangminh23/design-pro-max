#!/bin/sh
set -eu
usage='usage: env-value.sh <file> <NAME> [--value]'
file=${1:?$usage}
name=${2:?$usage}
case $name in
  *[!A-Za-z0-9_]*) echo "not a variable name: $name" >&2; exit 2 ;;
esac
line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" "$file" | tail -n 1 || true)
if [ -z "$line" ]; then
  echo "$name is not set in $file" >&2
  exit 1
fi
value=${line#*=}
case $value in
  \"*\") value=${value#\"}; value=${value%\"} ;;
  \'*\') value=${value#\'}; value=${value%\'} ;;
esac
if [ "${3:-}" = "--value" ]; then
  printf '%s' "$value"
else
  printf '%s is set, %s characters\n' "$name" "${#value}"
fi
