#!/usr/bin/env bash
#
# The backup-and-restore drill, rehearsed where it is safe to get wrong.
#
# `ROLLBACK.md` is about putting the *code* back. This is the other half: the
# day the data is wrong — a bad migration, a delete that matched more rows than
# it should have, a mistake in the SQL editor at one in the morning — and the
# only way out is a copy from before it happened.
#
# Nobody had ever done that here. The build-out plan asks for a first drill,
# timed, before the pilot, and the reason it asks before rather than after is
# the same reason every other item in that stage exists: a restore procedure
# that has never been run is a document, not a capability.
#
# ## What this does and does not prove
#
# It builds production's shape from this repository, puts rows in it, dumps
# the whole database, restores the dump into an empty one, and compares the
# two — schema fingerprints, row counts, and the contents of what was seeded.
# Everything happens in a throwaway cluster in a temporary directory.
#
# So it proves **the procedure and the completeness of a logical dump**: that
# nothing in this schema is the kind of object `pg_dump` quietly leaves behind.
# That is not a rhetorical worry. `schema.snapshot.sql` was first written
# without the `ensure_rls` event trigger, and a database rebuilt without it is
# silently less safe than the original while every count of tables and policies
# matches. The event trigger is checked by name below for exactly that reason.
#
# It does **not** prove that Supabase's own backup of the live project can be
# restored. That is a different mechanism — physical, point-in-time, run from
# the dashboard against real infrastructure — and only a drill on the real
# project proves it. `RESTORE.md` is the procedure for that one, and this is
# the rehearsal you do first so that the real drill is not also the first time
# anybody has read the steps.
#
#     supabase/restore.sh
#
# It needs the Postgres major the live project runs, the same as `check.sh`,
# and takes the same `SEMESTER_CHECK_PG_ANY=1` escape hatch with the same
# caveat: a pass on another major is not a statement about production.
#
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
work=$(mktemp -d)
port=${SEMESTER_CHECK_PORT:-54398}

want=$(sed -nE 's/^[[:space:]]*major_version[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' \
  "$here/config.toml" | head -1)
bindir=""
if [ -x "/usr/lib/postgresql/$want/bin/initdb" ]; then
  bindir="/usr/lib/postgresql/$want/bin"
elif d=$(pg_config --bindir 2>/dev/null) && [ -x "$d/initdb" ] &&
     [ "$("$d/pg_config" --version 2>/dev/null | sed -nE 's/[^0-9]*([0-9]+).*/\1/p')" = "$want" ]; then
  bindir="$d"
elif [ -n "${SEMESTER_CHECK_PG_ANY:-}" ]; then
  bindir=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
  [ -z "$bindir" ] && bindir=$(pg_config --bindir 2>/dev/null || true)
  got=$("$bindir/pg_config" --version 2>/dev/null | sed -nE 's/[^0-9]*([0-9]+).*/\1/p' || true)
  echo "! Postgres $got, and the live project runs $want." >&2
  echo "! SEMESTER_CHECK_PG_ANY is set, so this is running anyway. A pass here is" >&2
  echo "! not a statement about production." >&2
fi
if [ -z "$bindir" ] || [ ! -x "$bindir/initdb" ]; then
  echo "No PostgreSQL $want server found, and that is the major the live project runs" >&2
  echo "(supabase/config.toml). To run against whatever is installed anyway:" >&2
  echo >&2
  echo "  SEMESTER_CHECK_PG_ANY=1 supabase/restore.sh" >&2
  exit 2
fi

cleanup() {
  "$bindir/pg_ctl" -D "$work/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$work"
}
[ -n "${SEMESTER_CHECK_KEEP:-}" ] || trap cleanup EXIT

as=""
if [ "$(id -u)" = 0 ] && id postgres >/dev/null 2>&1; then
  chmod 777 "$work"
  chown postgres "$work"
  as="su postgres -c"
fi
run() { if [ -n "$as" ]; then su postgres -c "$*"; else eval "$*"; fi; }

echo "· a throwaway PostgreSQL $("$bindir/pg_config" --version | sed -nE 's/[^0-9]*([0-9]+).*/\1/p') in $work"
run "'$bindir/initdb' -D '$work/data' -A trust -U postgres" >/dev/null
run "'$bindir/pg_ctl' -D '$work/data' -o '-p $port -k $work -c listen_addresses= -c wal_level=logical' -l '$work/log' start" >/dev/null
for _ in $(seq 1 30); do
  "$bindir/pg_isready" -h "$work" -p "$port" >/dev/null 2>&1 && break
  sleep 0.5
done

psql() { "$bindir/psql" -X -q -h "$work" -p "$port" -U postgres "$@"; }

# ── Build the thing that is going to be lost ──────────────────────────────

echo "· building production's shape"
psql -v ON_ERROR_STOP=1 -d postgres -c 'create database live' >/dev/null
psql -v ON_ERROR_STOP=1 -d live -f "$here/local.stub.sql" >/dev/null
for m in "$here"/migrations/*.sql; do
  # Output captured rather than redirected: the migrations are noisy with
  # `does not exist, skipping` notices on a first build, and a wall of those
  # is how a real error goes unread. Errors are printed; notices are not.
  if ! out=$(psql -v ON_ERROR_STOP=1 -d live -f "$m" 2>&1); then
    echo "  ✗ $(basename "$m")" >&2
    echo "$out" | grep -E "ERROR" | head -3 >&2
    exit 1
  fi
done

# ── Rows, because a restore that keeps the schema and loses the data is the
# failure this is for, and a schema-only comparison cannot see it ──────────

echo "· seeding an account with a semester in it"
psql -v ON_ERROR_STOP=1 -d live >/dev/null <<'SQL'
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'drill@example.edu', now(), now(), now());
insert into public.state (user_id, data)
values ('11111111-1111-1111-1111-111111111111', '{"term":"Fall 2026","notes":"a paragraph somebody typed"}'::jsonb);
insert into public.courses (user_id, id, data)
values ('11111111-1111-1111-1111-111111111111', 'econ-101',
        '{"title":"Intermediate Microeconomics"}'::jsonb);
insert into public.activity (user_id, day, mark) values
  ('11111111-1111-1111-1111-111111111111', current_date - 40, 'opened'),
  ('11111111-1111-1111-1111-111111111111', current_date - 40, 'course'),
  ('11111111-1111-1111-1111-111111111111', current_date, 'studied');
SQL

before_rows=$(psql -At -d live -c "
  select string_agg(t || '=' || n, ',' order by t) from (
    select 'state' t, count(*) n from public.state
    union all select 'courses', count(*) from public.courses
    union all select 'activity', count(*) from public.activity
    union all select 'users', count(*) from auth.users) x")
before_body=$(psql -At -d live -c "
  select md5(string_agg(data::text, '|' order by data::text))
    from (select data from public.state union all select data from public.courses) x")
before_fp=$(psql -At -d live -f "$here/fingerprint.sql")

# ── The dump ──────────────────────────────────────────────────────────────

echo "· dumping"
dump_start=$(date +%s.%N)
run "'$bindir/pg_dump' -h '$work' -p $port -U postgres -Fc -f '$work/live.dump' live"
dump_end=$(date +%s.%N)
size=$(stat -c %s "$work/live.dump" 2>/dev/null || stat -f %z "$work/live.dump")

# ── The restore, into an empty database, the way a real one would go ──────

echo "· restoring into an empty database"
psql -v ON_ERROR_STOP=1 -d postgres -c 'create database restored' >/dev/null
restore_start=$(date +%s.%N)
# `--exit-on-error` on purpose. A restore that prints errors and carries on is
# how somebody ends up with most of their data back and no idea which part is
# missing, which is worse than a restore that stops.
run "'$bindir/pg_restore' -h '$work' -p $port -U postgres --exit-on-error -d restored '$work/live.dump'" >/dev/null
restore_end=$(date +%s.%N)

# ── Compare, six ways ─────────────────────────────────────────────────────

echo "· comparing"
after_rows=$(psql -At -d restored -c "
  select string_agg(t || '=' || n, ',' order by t) from (
    select 'state' t, count(*) n from public.state
    union all select 'courses', count(*) from public.courses
    union all select 'activity', count(*) from public.activity
    union all select 'users', count(*) from auth.users) x")
after_body=$(psql -At -d restored -c "
  select md5(string_agg(data::text, '|' order by data::text))
    from (select data from public.state union all select data from public.courses) x")
after_fp=$(psql -At -d restored -f "$here/fingerprint.sql")

fail=0
say() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1"; echo "      before: $2"; echo "      after:  $3"; fail=1; fi; }

say "schema fingerprints" "$before_fp" "$after_fp"
say "row counts" "$before_rows" "$after_rows"
say "the contents of what was seeded" "$before_body" "$after_body"

# The control, and the reason it is named rather than counted. An event
# trigger is what makes row-level security on by default true here, and it is
# the one object a rebuild has already been caught losing — see the header.
trigger=$(psql -At -d restored -c "select count(*) from pg_event_trigger where evtname = 'ensure_rls'")
say "the ensure_rls event trigger survived" "1" "$trigger"

# And the half a schema comparison cannot see: policies are in the fingerprint,
# but whether they are *enforced* is a flag on the table.
rls_off=$(psql -At -d restored -c "
  select coalesce(string_agg(relname, ','), 'none') from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")
say "row-level security is still on for every table" "none" "$rls_off"

# The control on the controls. Every comparison above passes against two empty
# databases, which is what a build that silently did nothing looks like.
tables=$(psql -At -d restored -c "
  select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'")
if [ "$tables" -lt 15 ]; then
  echo "  ✗ the restored database has $tables tables, so this compared two empty databases"
  fail=1
else
  echo "  ✓ and there was something there to compare ($tables tables)"
fi

took() { awk "BEGIN{printf \"%.1f\", $2 - $1}"; }
echo
echo "· timings, on this machine, for a database with one account in it"
echo "    dump     $(took "$dump_start" "$dump_end")s  ($size bytes)"
echo "    restore  $(took "$restore_start" "$restore_end")s"
echo
if [ "$fail" = 0 ]; then
  echo "· the dump is complete and the restore is faithful"
  echo "  This rehearses the procedure. It says nothing about the live project's"
  echo "  own backups — RESTORE.md is the drill for those."
fi
exit "$fail"
