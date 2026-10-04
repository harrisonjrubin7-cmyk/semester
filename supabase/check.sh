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
# Needs the Postgres server binaries for the major version the live project
# runs, which is read from `config.toml` rather than written here. It
# initialises its own cluster in a temporary directory, starts it on a private
# socket, and removes it on the way out; it never touches a configured PGHOST
# or a real project.
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

# ── Which Postgres, and why it is not "whichever one is here" ─────────────
#
# This used to take the newest server installed: `ls /usr/lib/postgresql/*/bin
# | sort -V | tail -1`. On a runner that ships 16 and a project running 17,
# that silently checked the policies against a different major than the one
# they will be enforced by — and said nothing, because the checks passed.
#
# `config.toml` already carries the number, for Branching, and its own comment
# says why a mismatch there is not cosmetic: "a preview branch would be built
# on a different major than production, and the first thing you would learn
# from it is something untrue about production." That is exactly what this
# script was doing. So it reads that file rather than repeating the number,
# and the two cannot drift.
want=$(sed -nE 's/^[[:space:]]*major_version[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' \
  "$here/config.toml" | head -1)
if [ -z "$want" ]; then
  echo "No major_version in supabase/config.toml, so there is nothing to match." >&2
  echo "That file is where the live project's Postgres major is recorded." >&2
  exit 2
fi

# The version asked for, and nothing else. `pg_config` is consulted only if it
# points at that same major — on a developer's machine it is usually the one
# on PATH, which is the one this script must not silently accept when it is
# the wrong one.
bindir=""
if [ -x "/usr/lib/postgresql/$want/bin/initdb" ]; then
  bindir="/usr/lib/postgresql/$want/bin"
elif d=$(pg_config --bindir 2>/dev/null) && [ -x "$d/initdb" ] &&
     [ "$("$d/pg_config" --version 2>/dev/null | sed -nE 's/[^0-9]*([0-9]+).*/\1/p')" = "$want" ]; then
  bindir="$d"
fi

# The escape hatch, which is loud on purpose.
#
# Refusing outright would mean a contributor whose machine has only 16 cannot
# run these at all, and checks nobody can run are checks nobody runs — the
# failure this whole directory is a record of. So another major is allowed,
# explicitly, per invocation, and says on every run that what it proved is not
# a fact about production. What is gone is the silence, not the option.
if [ -z "$bindir" ] && [ -n "${SEMESTER_CHECK_PG_ANY:-}" ]; then
  bindir=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
  [ -z "$bindir" ] && bindir=$(pg_config --bindir 2>/dev/null || true)
  if [ -n "$bindir" ] && [ -x "$bindir/initdb" ]; then
    got=$("$bindir/pg_config" --version 2>/dev/null | sed -nE 's/[^0-9]*([0-9]+).*/\1/p')
    echo "! Postgres $got, and the live project runs $want." >&2
    echo "! SEMESTER_CHECK_PG_ANY is set, so this is running anyway. A pass here is" >&2
    echo "! not a statement about production." >&2
  fi
fi

if [ -z "$bindir" ] || [ ! -x "$bindir/initdb" ]; then
  echo "No PostgreSQL $want server found, and that is the major the live project runs" >&2
  echo "(supabase/config.toml). Checking the policies against another major would" >&2
  echo "prove something about a database nobody is using." >&2
  echo >&2
  echo "  Debian/Ubuntu: apt-get install postgresql-$want  (from apt.postgresql.org)" >&2
  echo "  macOS:         brew install postgresql@$want" >&2
  echo >&2
  echo "To run against whatever is installed anyway — and it will say so, loudly:" >&2
  echo >&2
  echo "  SEMESTER_CHECK_PG_ANY=1 supabase/check.sh" >&2
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

echo "· starting a throwaway PostgreSQL $("$bindir/pg_config" --version | sed -nE 's/[^0-9]*([0-9]+).*/\1/p') in $work"
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

# Schema usage and the stub's own `auth.users`, which lives outside `public`
# and so is not covered by the default privileges.
#
# What used to be here as well was
#
#     grant all on all tables in schema public to anon, authenticated;
#
# and it had to go. Running after the migrations, it handed back every table
# privilege a migration had deliberately revoked — so a relation-level revoke
# could neither succeed nor fail here, because the evidence was erased a moment
# later. `local.stub.sql` now sets the table privileges as default privileges
# before the migrations run, the way Supabase does, which leaves a revoke
# standing where a suite can read it. See the note in that file.
# The second pass. `supabase/README.md` promises that every migration is
# idempotent — that running the set twice is a no-op — because a migration
# that only works on an empty database cannot repair a half-built one, which is
# the state a restore or a failed deploy leaves behind. Nothing had ever run
# them twice: the first attempt, in launch-readiness Phase 7, found nine files
# that failed. This applies every one again on top of the built schema, before
# any check runs, so the suites below also prove the schema survived it.
#
# `reapply.known` lists the files allowed to fail, each with its reason. A file
# not on it that fails is a new non-idempotent migration; a file on it that now
# passes is a stale entry. Both fail, so the list can only shrink honestly.
if [ -n "${SEMESTER_CHECK_REAPPLY:-}" ]; then
  echo "· migrations, a second time"
  dump() { "$bindir/pg_dump" -s -h "$work" -p "$port" -U postgres postgres | grep -vE '^\\(un)?restrict '; }
  # And the rows. A migration can succeed on every run and still not be a
  # no-op: an insert with no conflict clause seeds a second copy, an update
  # rewrites a row each time. One line per table in public and private: its
  # row count and a hash of every row, sorted, so the physical order a
  # second pass leaves them in does not matter.
  rows() {
    psql -At -v ON_ERROR_STOP=1 <<'SQL'
select format('select %L, count(*), md5(coalesce(string_agg(t::text, chr(10) order by t::text), %L)) from %I.%I t',
              n.nspname || '.' || c.relname, '', n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p') and n.nspname in ('public', 'private')
 order by 1
\gexec
SQL
  }
  dump > "$work/schema.1"
  rows > "$work/rows.1"
  known=$(sed -e 's/#.*//' "$here/reapply.known" | awk 'NF {print $1}')
  bad=0
  for m in "$here"/migrations/*.sql; do
    name=$(basename "$m")
    if out=$(psql -v ON_ERROR_STOP=1 -f "$m" 2>&1); then
      if echo "$known" | grep -qx "$name"; then
        echo "  ✗ $name passes a second time; remove it from reapply.known"
        bad=1
      fi
    elif echo "$known" | grep -qx "$name"; then
      echo "  · $name (known: reapply.known)"
    else
      echo "  ✗ $name is not idempotent"
      echo "$out" | grep -E "ERROR" | head -2 | sed 's/^/      /'
      bad=1
    fi
  done
  [ "$bad" = 0 ] || exit 1
  # Passing twice is not enough on its own: a file that stops part way on the
  # second run leaves an older definition behind, and so does one that quietly
  # re-creates something a later file had replaced. The schema after two passes
  # has to be the schema after one.
  dump > "$work/schema.2"
  if ! diff -q "$work/schema.1" "$work/schema.2" >/dev/null; then
    echo "  ✗ the schema after a second pass differs from the first:"
    diff "$work/schema.1" "$work/schema.2" | head -20 | sed 's/^/      /'
    exit 1
  fi
  rows > "$work/rows.2"
  # The control: a query that matched no tables would compare two empty files.
  if [ "$(wc -l < "$work/rows.1")" -lt 50 ]; then
    echo "  ✗ the row fingerprint read only $(wc -l < "$work/rows.1") tables; the query is broken"
    exit 1
  fi
  if ! diff -q "$work/rows.1" "$work/rows.2" >/dev/null; then
    echo "  ✗ a second pass changed the rows in these tables (table|rows|hash):"
    diff "$work/rows.1" "$work/rows.2" | grep '^[<>]' | head -20 | sed 's/^/      /'
    exit 1
  fi
  echo "  ✓ every other migration applied twice; the schema and the rows in $(wc -l < "$work/rows.1") tables are unchanged"
fi

psql -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
grant usage on schema auth, public to anon, authenticated;
grant select, insert on auth.users to anon, authenticated;
SQL

# A fixture, and only a fixture: an account the check suites make without a
# birth date is recorded as an adult who said so. Since D-139 an account that
# never stated its age is kept out of every social feature, and the suites
# that test those features make their accounts by inserting into auth.users
# with no birth date — they are about the features, not the age. The trigger
# is named to fire after the real one, adds a row only where the real one
# added none, and is never part of a migration. `minimum-age.check.sql`, which
# tests the age rules themselves, turns it off with
# `set semester.fixture_age = 'off'`.
psql -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create or replace function private.zz_fixture_adult() returns trigger
language plpgsql security definer set search_path = '' as $fx$
begin
  if coalesce(current_setting('semester.fixture_age', true), '') <> 'off' then
    insert into private.account_ages (user_id, source) values (new.id, 'sign_up')
    on conflict (user_id) do nothing;
  end if;
  return new;
end $fx$;
revoke all on function private.zz_fixture_adult() from public;
drop trigger if exists zz_fixture_adult on auth.users;
create trigger zz_fixture_adult after insert on auth.users
  for each row execute function private.zz_fixture_adult();
SQL

# Another script's turn at the same database, instead of the suites. `load.sh`
# uses it so the load scenarios run against exactly what the checks see — the
# same major, the same stub, every migration — without a second copy of the
# setup above to drift from this one. The sourced script has `psql`, `$bindir`,
# `$work` and `$port`, and its exit status is this script's.
if [ -n "${SEMESTER_CHECK_THEN:-}" ]; then
  # shellcheck source=/dev/null
  . "$SEMESTER_CHECK_THEN"
  exit $?
fi

echo "· checks"
failed=0
for c in "${suites[@]}"; do
  out=$(psql -f "$c" 2>&1 || true)
  oks=$(echo "$out" | grep -cE 'NOTICE: +ok' || true)
  if echo "$out" | grep -qE "FAILED|ERROR"; then
    echo "  ✗ $(basename "$c")"
    echo "$out" | grep -E "FAILED|ERROR" | head -5 | sed 's/^/      /'
    failed=1
  elif [ "$oks" = 0 ]; then
    # A suite that prints no `ok` line proved nothing we can see. psql exits 0
    # and prints no ERROR for an empty file or an `\ir` of a path that is not
    # there, so "no error" alone cannot tell a passing suite from one that never
    # ran. Every suite ends by saying what it established.
    echo "  ✗ $(basename "$c") — passed with no 'ok' notice, so nothing shows it ran"
    echo "$out" | head -3 | sed 's/^/      /'
    failed=1
  else
    echo "  ✓ $(basename "$c") — $oks checks"
  fi
done

[ "$failed" = 0 ] && echo "· every policy check passed"
exit "$failed"
