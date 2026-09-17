#!/usr/bin/env bash
#
# Apply every migration to a throwaway Postgres and run every check script.
#
# The `.check.sql` files are the only test this half of the app has. Everything
# that matters in `migrations/` is a row-level security policy, and a policy is
# only ever wrong in a way you notice when a *second* account is involved — so
# the scripts make their synthetic users, walk them through what a real pair
# would do, assert what each may see, and roll the lot back.
#
# Until this existed the only way to run one was to paste it into a live
# project's SQL Editor, against real data, by hand. So they were not run. Two
# of them had been failing on their first block since the migration that broke
# them landed, and because a failed block aborts the transaction, everything
# after it was skipped: thirteen of the twenty-two checks in records.check.sql
# and all twenty-five in classmates.check.sql had never executed.
#
# Needs a Postgres server binary — `postgresql-16` or newer. It initialises its
# own cluster in a temporary directory, starts it on a private socket, and
# removes it on the way out; it never touches a configured PGHOST or a real
# project.
#
#     supabase/check.sh                 # every suite
#     supabase/check.sh groups records  # only these
#
# Naming suites is for iterating on one: the cluster and the migrations are the
# slow part and happen either way, but a failing suite's output is far easier to
# read without the other five around it.
#
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Which suites, resolved here — before a cluster is built — so that a typo
# costs nothing and is answered at once rather than after half a minute of
# initdb. A name matching no file is an error, never a quiet no-op: asking for
# a suite and being told everything passed, having run nothing, is the failure
# this directory keeps turning out to have had.
suites=()
if [ "$#" -gt 0 ]; then
  for name in "$@"; do
    c="$here/${name%.check.sql}.check.sql"
    if [ ! -f "$c" ]; then
      echo "No such suite: $name" >&2
      echo "Available: $(cd "$here" && ls *.check.sql | sed 's/\.check\.sql$//' | tr '\n' ' ')" >&2
      exit 2
    fi
    suites+=("$c")
  done
else
  for c in "$here"/*.check.sql; do suites+=("$c"); done
fi

work=$(mktemp -d)
port=${SEMESTER_CHECK_PORT:-54399}

bindir=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
[ -z "$bindir" ] && bindir=$(pg_config --bindir 2>/dev/null || true)
if [ -z "$bindir" ] || [ ! -x "$bindir/initdb" ]; then
  echo "No Postgres server found. Install postgresql (the server, not just the client)." >&2
  exit 2
fi

cleanup() {
  "$bindir/pg_ctl" -D "$work/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$work"
}
[ -n "${SEMESTER_CHECK_KEEP:-}" ] || trap cleanup EXIT

# initdb refuses to run as root, which is how this often runs in a container.
as=""
if [ "$(id -u)" = 0 ] && id postgres >/dev/null 2>&1; then
  chmod 777 "$work"
  chown postgres "$work"
  as="su postgres -c"
fi
run() { if [ -n "$as" ]; then su postgres -c "$*"; else eval "$*"; fi; }

echo "· starting a throwaway Postgres in $work"
run "'$bindir/initdb' -D '$work/data' -A trust -U postgres" >/dev/null
# No TCP socket at all: everything here goes over the Unix socket in $work, so
# a cluster somebody already has running cannot collide with this one.
# `wal_level=logical` only so that creating the realtime publication does not
# warn; nothing subscribes to it.
run "'$bindir/pg_ctl' -D '$work/data' -o '-p $port -k $work -c listen_addresses= -c wal_level=logical' -l '$work/log' start" >/dev/null
for _ in $(seq 1 30); do
  "$bindir/pg_isready" -h "$work" -p "$port" >/dev/null 2>&1 && break
  sleep 0.5
done

# `$bindir/psql` and not a bare `psql`, which is the same discovery this script
# already does for initdb, pg_ctl and pg_isready. A bare one was an unstated
# dependency on the client happening to be on PATH — true on a developer's
# machine, not true in a container that has the server under
# /usr/lib/postgresql/16/bin and nothing on PATH, where this failed with
# "command not found" and read as a broken script rather than a missing
# directory. Using the binary it already located makes the script say the same
# thing everywhere.
psql() { "$bindir/psql" -X -q -h "$work" -p "$port" -U postgres "$@"; }

echo "· the parts Supabase provides, for a plain Postgres"
psql -v ON_ERROR_STOP=1 -f "$here/local.stub.sql" >/dev/null

echo "· migrations"
for m in "$here"/migrations/*.sql; do
  if ! out=$(psql -v ON_ERROR_STOP=1 -f "$m" 2>&1); then
    echo "  ✗ $(basename "$m")"
    echo "$out" | grep -E "ERROR" | head -3
    exit 1
  fi
  echo "  ✓ $(basename "$m")"
done

# After the migrations, because they are `on all tables` and there are no
# tables until the migrations have run. Supabase applies the equivalent as
# default privileges on `public`, which is why nothing in `migrations/` grants
# them itself and why `local.stub.sql` cannot either. See its header.
psql -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
grant usage on schema auth, public to anon, authenticated;
grant select, insert on auth.users to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
SQL

echo "· checks"
failed=0
for c in "${suites[@]}"; do
  out=$(psql -f "$c" 2>&1 || true)
  if echo "$out" | grep -qE "FAILED|ERROR"; then
    echo "  ✗ $(basename "$c")"
    echo "$out" | grep -E "FAILED|ERROR" | head -5 | sed 's/^/      /'
    failed=1
  else
    echo "  ✓ $(basename "$c") — $(echo "$out" | grep -cE 'NOTICE: +ok') checks"
  fi
done

[ "$failed" = 0 ] && echo "· every policy check passed"
exit "$failed"
