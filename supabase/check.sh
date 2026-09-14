#!/usr/bin/env bash
#
# Build the schema from migrations/ into a throwaway database, then run every
# check suite against it.
#
#     supabase/check.sh                 # all five
#     supabase/check.sh groups records  # just those
#
# Needs a Postgres you can create databases on, and nothing else — no Supabase
# CLI, no project, no network. `local.stub.sql` stands in for what the platform
# supplies; see README.md for what is in it and why.
#
# This is the only way to find out whether the migrations still build the
# schema from nothing, which is the one thing a project that already has the
# schema cannot tell you. The suites themselves need an empty database anyway:
# their counts are wrong wherever real rows exist, and the live project has
# enrolments in the very rooms classmates.check.sql counts.
#
# Everything the suites write is rolled back by the suites themselves. The
# database is dropped and rebuilt on every run regardless, so a suite that
# somehow left rows behind cannot quietly change the next run's answer.

set -euo pipefail

DB="${SEMESTER_CHECK_DB:-semester_check}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '%s\n' "$*" >&2; }

# Named on the command line, or every suite in this directory.
#
# Read off the directory rather than listed here, because a list written down
# is a list that has to be remembered: add a sixth `*.check.sql` and a
# hardcoded default would skip it silently, reporting that everything passed
# while never running it. That is the same shape as every other fault this
# directory's history records — a written-down fact drifting from the one it
# describes — and it is not worth repeating in the thing that checks for it.
#
# Globbed, so the order is the filename order and a run reads the same way
# twice. `check.sh groups` is enough on the command line; the suffix is added
# below.
if [ "$#" -gt 0 ]; then
  SUITES=("$@")
else
  SUITES=()
  for f in "$HERE"/*.check.sql; do
    [ -e "$f" ] || continue
    SUITES+=("$(basename "$f" .check.sql)")
  done
  if [ "${#SUITES[@]}" -eq 0 ]; then
    say "no *.check.sql in $HERE"
    exit 1
  fi
fi

say "building $DB from $(ls "$HERE"/migrations/*.sql | wc -l | tr -d ' ') migrations"

dropdb --if-exists "$DB"
createdb "$DB"

psql -q -1 -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/local.stub.sql" >/dev/null

for f in "$HERE"/migrations/*.sql; do
  if ! psql -q -1 -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null 2>/tmp/semester-check-err; then
    say "MIGRATION FAILED: $(basename "$f")"
    grep -v '^psql.*NOTICE' /tmp/semester-check-err >&2 || true
    exit 1
  fi
done

# After the migrations, because they are `on all tables` and there are no
# tables until the migrations have run. Supabase applies the equivalent as
# default privileges on `public`, which is why nothing in migrations/ grants
# them itself.
psql -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'SQL'
grant usage on schema auth, public to anon, authenticated;
grant select, insert on auth.users to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
SQL

failed=0
for s in "${SUITES[@]}"; do
  file="$HERE/${s%.check.sql}.check.sql"
  if [ ! -f "$file" ]; then
    say "no such suite: $s"
    failed=1
    continue
  fi
  out="$(psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$file" 2>&1 || true)"
  if printf '%s' "$out" | grep -q 'ALL CHECKS PASSED'; then
    printf '  ok   %s\n' "$(basename "$file")"
  else
    printf '  FAIL %s\n' "$(basename "$file")"
    printf '%s\n' "$out" | grep -E 'FAILED|ERROR' | head -3 | sed 's/^/       /'
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  say "a suite did not pass; $DB is left in place to look at"
  exit 1
fi

dropdb --if-exists "$DB"
say "every suite passed"
