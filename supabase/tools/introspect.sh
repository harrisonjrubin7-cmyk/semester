#!/usr/bin/env bash
#
# Build a throwaway Postgres from the migrations (the same way check.sh does)
# and run one SQL file against it, printing the result. Used to render
# docs/ROLE-PERMISSION-MATRIX.md and docs/DATA-INVENTORY-AND-LINEAGE.md from
# what the migrations actually build, instead of from memory.
#
#     supabase/tools/introspect.sh supabase/tools/inventory.sql > /tmp/inv.out
#     python3 supabase/tools/render_inventory.py /tmp/inv.out docs
#
# Needs PostgreSQL of the major in supabase/config.toml; runs as root by
# dropping to the postgres user, and never touches a configured PGHOST.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
want=$(sed -nE 's/^[[:space:]]*major_version[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' "$here/config.toml" | head -1)
bindir=/usr/lib/postgresql/$want/bin
[ -x "$bindir/initdb" ] || { echo "No PostgreSQL $want server at $bindir" >&2; exit 2; }
work=$(mktemp -d); port=54398
as=""; if [ "$(id -u)" = 0 ]; then chmod 777 "$work"; chown postgres "$work"; as="su postgres -c"; fi
run() { if [ -n "$as" ]; then su postgres -c "$*"; else eval "$*"; fi; }
trap '"$bindir/pg_ctl" -D "$work/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
run "'$bindir/initdb' -D '$work/data' -A trust -U postgres" >/dev/null
run "'$bindir/pg_ctl' -D '$work/data' -o '-p $port -k $work -c listen_addresses= -c wal_level=logical' -l '$work/log' start" >/dev/null
for _ in $(seq 1 30); do "$bindir/pg_isready" -h $work -p $port >/dev/null 2>&1 && break; sleep 0.5; done
psql() { "$bindir/psql" -X -q -h "$work" -p "$port" -U postgres "$@"; }
psql -v ON_ERROR_STOP=1 -f "$here/local.stub.sql" >/dev/null
for m in "$here"/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$m" >/dev/null; done
psql -f "$1"
