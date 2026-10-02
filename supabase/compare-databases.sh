#!/usr/bin/env bash
# Compare a Supabase preview branch with production without printing either
# database address or putting a password in the process list.
#
# Configure two named libpq services in a protected pg_service.conf / pgpass
# setup, then run:
#
#   SEMESTER_STAGING_PGSERVICE=semester_preview \
#   SEMESTER_PRODUCTION_PGSERVICE=semester_production \
#   supabase/compare-databases.sh
#
# A match proves the repository-owned schemas have the same columns,
# constraints, indexes, function code and policies; both projects use the
# configured Postgres major; RLS is on for every public table; and the event
# trigger that makes RLS the default exists. It does not inspect Edge Function
# versions or branch secrets. STAGING.md keeps those as separate dashboard
# checks so this command cannot overstate what it proved.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
stage=${SEMESTER_STAGING_PGSERVICE:-}
production=${SEMESTER_PRODUCTION_PGSERVICE:-}
psql_bin=${SEMESTER_PSQL_BIN:-psql}

if [ -z "$stage" ] || [ -z "$production" ]; then
  echo "Set SEMESTER_STAGING_PGSERVICE and SEMESTER_PRODUCTION_PGSERVICE to named libpq services." >&2
  exit 2
fi
case "$stage$production" in
  *[!A-Za-z0-9_.-]*)
    echo "Service names may contain only letters, digits, dot, underscore and hyphen." >&2
    exit 2
    ;;
esac
if ! command -v "$psql_bin" >/dev/null 2>&1; then
  echo "psql is required (or set SEMESTER_PSQL_BIN to its executable)." >&2
  exit 2
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

run() {
  service=$1
  shift
  "$psql_bin" "service=$service" -X -v ON_ERROR_STOP=1 -qAt "$@"
}

fingerprint() {
  service=$1
  output=$2
  run "$service" -f "$here/fingerprint.sql" > "$output"
}

controls() {
  service=$1
  output=$2
  run "$service" > "$output" <<'SQL'
select 'major=' || current_setting('server_version_num')::int / 10000;
select 'public_tables_without_rls=' || count(*)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select 'ensure_rls_trigger=' || count(*)
  from pg_event_trigger where evtname = 'ensure_rls';
SQL
}

expected=$(sed -nE 's/^[[:space:]]*major_version[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' \
  "$here/config.toml" | head -1)

echo "· reading staging controls"
fingerprint "$stage" "$work/staging.fingerprint"
controls "$stage" "$work/staging.controls"
echo "· reading production controls"
fingerprint "$production" "$work/production.fingerprint"
controls "$production" "$work/production.controls"

fail=0
if diff -u "$work/production.fingerprint" "$work/staging.fingerprint" > "$work/fingerprint.diff"; then
  echo "  ✓ repository-owned schema fingerprints match"
else
  echo "  ✗ repository-owned schema fingerprints differ" >&2
  sed -n '1,80p' "$work/fingerprint.diff" >&2
  fail=1
fi

check_controls() {
  label=$1
  file=$2
  major=$(sed -n 's/^major=//p' "$file")
  rls=$(sed -n 's/^public_tables_without_rls=//p' "$file")
  trigger=$(sed -n 's/^ensure_rls_trigger=//p' "$file")
  if [ "$major" = "$expected" ]; then echo "  ✓ $label uses PostgreSQL $expected"; else echo "  ✗ $label uses PostgreSQL ${major:-unknown}; expected $expected" >&2; fail=1; fi
  if [ "$rls" = 0 ]; then echo "  ✓ $label has no public table without RLS"; else echo "  ✗ $label has ${rls:-unknown} public tables without RLS" >&2; fail=1; fi
  if [ "$trigger" = 1 ]; then echo "  ✓ $label has one ensure_rls event trigger"; else echo "  ✗ $label has ${trigger:-unknown} ensure_rls event triggers" >&2; fail=1; fi
}

check_controls staging "$work/staging.controls"
check_controls production "$work/production.controls"

if [ "$fail" = 0 ]; then
  echo "· database parity passed"
  echo "  Still verify Edge Function versions and branch secrets in the Supabase dashboard."
fi
exit "$fail"
