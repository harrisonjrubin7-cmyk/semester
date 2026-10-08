#!/usr/bin/env bash
# Install the Semester handoff into the repo. Run from the repo root: bash design/handoff/install.sh
# Safe by default: never overwrites an existing file unless FORCE=1. Strips the .txt suffix design files carry.
set -euo pipefail
SRC="${SRC:-design/handoff}"; DEST="${DEST:-.}"; APP="${APP:-app}"
[ -d "$SRC" ] || { echo "Missing $SRC. Copy the design project export to ./design first."; exit 1; }
copy() { local from="$1" to="$2"; mkdir -p "$(dirname "$to")"; if [ -e "$to" ] && [ "${FORCE:-0}" != 1 ]; then echo "SKIP (exists) $to"; else cp "$from" "$to"; echo "OK   $to"; fi; }
strip() { local p="$1"; echo "${p%.txt}"; }
# 1 semester-core → $APP/src/lib/core
for f in "$SRC"/semester-core/*.ts.txt; do copy "$f" "$DEST/$APP/src/lib/core/$(basename "$(strip "$f")")"; done
# 2 semester-platform: migrations, lib, api routes, tests, middleware, seed
for f in "$SRC"/semester-platform/supabase/migrations/*.sql.txt; do copy "$f" "$DEST/supabase/migrations/$(basename "$(strip "$f")")"; done
for f in $(cd "$SRC/semester-platform" && find lib app tests -name '*.txt'); do copy "$SRC/semester-platform/$f" "$DEST/$APP/$(strip "$f")"; done
copy "$SRC/semester-platform/middleware.security.ts.txt" "$DEST/$APP/middleware.security.ts"
copy "$SRC/semester-platform/supabase/seed.sql.txt" "$DEST/supabase/seed.sql"
copy "$SRC/semester-platform/tests/helpers.ts.txt" "$DEST/$APP/tests/helpers.ts"
copy "$SRC/semester-platform/.env.test.txt" "$DEST/$APP/.env.test"
copy "$SRC/semester-platform/.env.example.txt" "$DEST/$APP/.env.example"
copy "$SRC/semester-platform/.github/ci-security-job.yml.txt" "$DEST/.github/ci-security-job.yml"
echo; echo "Installed. Next: bash design/handoff/preflight.sh && bash design/handoff/verify.sh"
