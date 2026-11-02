#!/usr/bin/env bash
# Applies every migration in order to DATABASE_URL, then runs the SQL tests.
# DATABASE_URL must point at a disposable database owned by a superuser.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point at a disposable Postgres database}"
dir="$(cd "$(dirname "$0")/.." && pwd)"
for f in "$dir"/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$dir/tests/student_tasks_rls.sql"
