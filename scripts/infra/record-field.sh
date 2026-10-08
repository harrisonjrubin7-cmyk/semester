#!/usr/bin/env bash
# Read one header field from a change record.
#
#   scripts/infra/record-field.sh infra/changes/CC-1234.md Status
#
# A record opens with `Key: value` lines before its first heading, so the
# fields a pipeline must act on are machine-readable and the prose below them
# stays prose. Prints the value, or nothing if the field is absent.
set -euo pipefail
file="${1:?record}"
key="${2:?field}"
awk -v key="$key" '
  /^#/ { exit }
  index($0, key ":") == 1 { sub("^" key ":[ \t]*", ""); print; exit }
' "$file"
