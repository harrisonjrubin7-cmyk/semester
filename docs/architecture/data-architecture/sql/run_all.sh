#!/usr/bin/env bash
# Rebuild a disposable database from every migration, apply each proposal in order,
# run each test. Disposable Postgres only (docs/DATA-MIGRATION-PLAN.md: never a live one).
#
#   PGHOST=/path/to/socket PGPORT=54399 PGUSER=postgres ./run_all.sh [template_db]
#
# The database named by $TEMPLATE must already hold the migrated schema
# (supabase/local.stub.sql, then supabase/migrations/*.sql, as supabase/check.sh does).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
template=${1:-postgres}; db=sem_proposals
psql -X -q -c "drop database if exists $db" -c "create database $db template $template"
p() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
for f in "$here"/[0-9][0-9]_*.sql; do
  echo "apply  $(basename "$f")"; p -f "$f" 2>&1 | grep -v NOTICE || true
  [ "$(basename "$f")" = 01_registry_and_conformance.sql ] && p -f "$here/generated_data_registry_seed.sql"
  [ "$(basename "$f")" = 09_data_quality_rules.sql ] && p -f "$here/generated_dq_cross_tenant_rules.sql"
done
fail=0
for t in "$here"/tests/*.test.sql; do
  echo "test   $(basename "$t")"
  if out=$(p -f "$t" 2>&1); then echo "$out" | grep -v NOTICE | tail -1
  else echo "$out" | grep -v NOTICE | tail -4; echo "FAILED $(basename "$t")"; fail=1; fi
done
exit $fail
