#!/usr/bin/env bash
#
# Rehearse the production deploy, against production's shape and with data in it.
#
# `check.sh` builds every migration from empty and runs the policy suites. That
# answers "is this schema correct", and it is not the question a deploy asks.
# A deploy applies the *pending* migrations to a database that already exists,
# already has production's other twenty-one migrations in it, and already holds
# somebody's courses and the pilot's invite gate. Nothing here had ever asked
# that question before 21 September, which is part of why production's deploy
# had been failing since the 18th with no one aware.
#
# So this one starts from `schema.snapshot.sql` — the record of production —
# puts rows in the two places where a wrong migration would do visible harm,
# applies the migrations whose versions the live ledger does not have, and
# checks that they applied and that the rows did not move.
#
#     supabase/rehearse.sh
#
# It needs the Postgres major the live project runs, same as `check.sh`, and
# takes the same `SEMESTER_CHECK_PG_ANY=1` escape hatch with the same caveat:
# a pass on another major is not a statement about production.
#
# ## What it does not prove
#
# That the *ledger* will accept them. Postgres applies a file whatever it is
# called; Supabase's CLI refuses a version older than one already recorded, and
# that refusal is what had been failing. This script cannot see the ledger, so
# it proves the SQL is safe and leaves the ordering to the filenames — which is
# why `rollback.test.ts` pins those separately.
#
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# The versions production's ledger already has. A migration numbered at or
# below the last of these cannot be applied by `db push` at all, whatever this
# script says about its SQL — see the header.
#
# Read from `ledger.snapshot` rather than written here, and that is not a
# style preference. This was `LEDGER_NEWEST=20260921002658`, correct when it
# was typed on 21 September and wrong within the hour: the ledger took seven
# more rows that afternoon and the newest became `20260921150750`. A constant
# copied out of a database carries no date and cannot go stale loudly, so this
# script went on calling six already-applied migrations "pending" and
# rehearsing a deploy that was not the one about to run. The same constant in
# `rollback.test.ts` let a renumbering land at `20260921003000`-`003600`,
# below the real watermark, which is the fault it was written to prevent.
#
# `ledger.snapshot` is one dated reading of every row, and its header says a
# newer reading that disagrees is a finding rather than a number to bump.
LEDGER_SNAPSHOT=$here/ledger.snapshot
[ -f "$LEDGER_SNAPSHOT" ] || { echo "supabase/ledger.snapshot is missing" >&2; exit 2; }
LEDGER_NEWEST=$(sed -e 's/#.*//' "$LEDGER_SNAPSHOT" | awk 'NF {print $1}' | sort | tail -1)
# The control, before anything is concluded from it: a parse that stopped
# matching yields an empty string, and an empty string makes every `-gt`
# comparison below treat the whole directory as pending.
case "$LEDGER_NEWEST" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "ledger.snapshot did not parse into a version: '$LEDGER_NEWEST'" >&2; exit 2 ;;
esac

want=$(sed -nE 's/^[[:space:]]*major_version[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' \
  "$here/config.toml" | head -1)
bindir=""
if [ -x "/usr/lib/postgresql/$want/bin/initdb" ]; then
  bindir="/usr/lib/postgresql/$want/bin"
elif d=$(pg_config --bindir 2>/dev/null) && [ -x "$d/initdb" ] &&
     [ "$("$d/pg_config" --version 2>/dev/null | sed -nE 's/[^0-9]*([0-9]+).*/\1/p')" = "$want" ]; then
  bindir="$d"
fi
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
  echo "(supabase/config.toml). See supabase/check.sh for the same message at length." >&2
  exit 2
fi

work=$(mktemp -d)
port=${SEMESTER_REHEARSE_PORT:-54455}
cleanup() {
  "$bindir/pg_ctl" -D "$work/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

as=""
if [ "$(id -u)" = 0 ] && id postgres >/dev/null 2>&1; then
  chmod 777 "$work"; chown postgres "$work"; as="su postgres -c"
fi
run() { if [ -n "$as" ]; then su postgres -c "$*"; else eval "$*"; fi; }

run "'$bindir/initdb' -D '$work/data' -A trust -U postgres" >/dev/null
run "'$bindir/pg_ctl' -D '$work/data' -o '-p $port -k $work -c listen_addresses= -c wal_level=logical' -l '$work/log' start" >/dev/null
for _ in $(seq 1 30); do
  "$bindir/pg_isready" -h "$work" -p "$port" >/dev/null 2>&1 && break
  sleep 0.5
done
psql() { "$bindir/psql" -X -q -h "$work" -p "$port" -U postgres "$@"; }

echo "· the parts Supabase provides"
psql -v ON_ERROR_STOP=1 -f "$here/local.stub.sql" >/dev/null

echo "· production's shape, from the snapshot"
if ! out=$(psql -v ON_ERROR_STOP=1 -f "$here/schema.snapshot.sql" 2>&1); then
  echo "  ✗ the snapshot no longer applies over the stub"
  echo "$out" | grep -E "ERROR" | head -3 | sed 's/^/      /'
  exit 1
fi

# The two places a wrong migration does visible harm. The gate is on, because
# that is how the live project is configured and because `invites.sql` seeds
# the same row — a seed without `on conflict do nothing` would silently open
# the pilot to the world, and that is exactly the failure this catches.
echo "· and rows in it, because an empty database cannot be harmed"
psql -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into public.access_gate (only_one, invite_only) values (true, true)
  on conflict (only_one) do update set invite_only = true;
insert into public.invites (email) values ('rehearsal@vanderbilt.edu');
insert into auth.users (id, email, email_confirmed_at)
  values ('11111111-1111-1111-1111-111111111111', 'rehearsal@vanderbilt.edu', now());
insert into public.courses (user_id, id, data)
  values ('11111111-1111-1111-1111-111111111111', 'rehearsal', '{"name":"PSCI 1100"}');
SQL
before_gate=$(psql -Atc "select invite_only from public.access_gate")
before_rows=$(psql -Atc "select count(*) from public.courses")

# ── Catching the snapshot up to the ledger ────────────────────────────────
#
# `schema.snapshot.sql` is production's shape *as it was when it was read*, and
# the ledger has moved since. It declares how far it reaches on a
# `SNAPSHOT-THROUGH:` line, and everything between that and `LEDGER_NEWEST` is
# a migration production has applied and this file does not show.
#
# Without this the rehearsal starts from a schema sixteen ledger rows behind
# production and does not know it. Every migration at or below the watermark is
# assumed present, so `public.forms`, `public.lti_platform`, `public.schools`,
# `public.app_admins` and `private.is_app_admin()` are all silently absent —
# and the first pending migration to reference one of them fails with an error
# about its own SQL. That happened: `20260921214500_report_status.sql` on a
# branch whose migration was correct and whose `check.sh` suites all passed.
#
# These are applied quietly unless one fails. They are not the rehearsal — they
# are the part of production the snapshot could not show, and a failure here is
# a broken record rather than a broken deploy, so it says which it is.
SNAPSHOT_THROUGH=$(sed -n 's/^-- SNAPSHOT-THROUGH: *\([0-9]\{14\}\).*/\1/p' "$here/schema.snapshot.sql" | head -1)
if [ -z "$SNAPSHOT_THROUGH" ]; then
  echo "· schema.snapshot.sql declares no SNAPSHOT-THROUGH line." >&2
  echo "  Without it this script cannot tell which ledger rows the snapshot predates," >&2
  echo "  and would rehearse against a schema it believes is complete and is not." >&2
  exit 2
fi

caught=0
for m in "$here"/migrations/*.sql; do
  version=$(basename "$m" | cut -c1-14)
  [ "$version" -gt "$SNAPSHOT_THROUGH" ] || continue
  [ "$version" -le "$LEDGER_NEWEST" ] || continue
  if out=$(psql -v ON_ERROR_STOP=1 -f "$m" 2>&1); then
    caught=$((caught + 1))
  else
    echo "· the snapshot is behind the ledger, and catching it up failed:" >&2
    echo "    ✗ $(basename "$m")" >&2
    echo "$out" | grep -E "ERROR" | head -3 | sed 's/^/      /' >&2
    echo "  This is the snapshot or the ledger being wrong, not the deploy." >&2
    exit 1
  fi
done
if [ "$caught" -gt 0 ]; then
  echo "· $caught migrations the ledger has and the snapshot predates, applied first"
fi

echo "· the migrations a deploy would apply, in the order it would apply them"
pending=0
for m in "$here"/migrations/*.sql; do
  version=$(basename "$m" | cut -c1-14)
  [ "$version" -gt "$LEDGER_NEWEST" ] || continue
  pending=$((pending + 1))
  if out=$(psql -v ON_ERROR_STOP=1 -f "$m" 2>&1); then
    echo "  ✓ $(basename "$m")"
  else
    echo "  ✗ $(basename "$m")"
    echo "$out" | grep -E "ERROR" | head -3 | sed 's/^/      /'
    failed=1
  fi
done

# ── Nothing to rehearse, and the two ways to arrive there ─────────────────
#
# This used to be one case and an `exit 2`, which read as "you asked for a
# rehearsal and got nothing, which is not a pass". That is the right instinct
# and it was aimed at the wrong half.
#
# **Everything on disk is in the ledger.** Production has applied all of it
# and the next deploy carries nothing. That is the ordinary state of this
# repository between migrations, and it is what `20260921211500` produced the
# moment its row was recorded: the watermark passed the newest file, every
# branch in the repository went red on `rehearse.sh`, and not one of them had
# touched `supabase/`. A gate that fails on the calendar rather than on the
# diff teaches people to ignore it, which is the one thing a gate cannot
# survive.
#
# **Or a file is missing from the ledger and numbered at or below the
# watermark.** `db push` can never apply it, whatever this script would have
# said about its SQL. That is a real fault and keeps a non-zero exit.
#
# `lib/migrationorder.test.ts` holds the same rule from the other side, and
# says it plainly: *"The rule is not 'every migration must already be
# applied'. A new migration is supposed to be pending; that is what a
# migration is. The rule is that a pending version may not be below the
# watermark."* The old `exit 2` failed the first sentence to enforce the
# third.
if [ "$pending" = 0 ]; then
  applied=$(sed -e 's/#.*//' "$LEDGER_SNAPSHOT" | awk 'NF {print $1}')
  stranded=""
  for m in "$here"/migrations/*.sql; do
    version=$(basename "$m" | cut -c1-14)
    printf '%s\n' "$applied" | grep -qxF "$version" || stranded="$stranded  $(basename "$m")"
  done
  if [ -n "$stranded" ]; then
    echo "  ✗ at or below the watermark $LEDGER_NEWEST and not in the ledger, so a" >&2
    echo "    deploy can never apply them:$stranded" >&2
    exit 2
  fi
  echo "  (every migration is in the ledger — nothing to deploy, nothing to rehearse)"
  exit 0
fi

after_gate=$(psql -Atc "select invite_only from public.access_gate")
after_rows=$(psql -Atc "select count(*) from public.courses")
echo "· the pilot's invite gate: $before_gate → $after_gate"
echo "· one account's courses:   $before_rows → $after_rows"
if [ "$before_gate" != "$after_gate" ] || [ "$before_rows" != "$after_rows" ]; then
  echo "  ✗ a migration moved live state. That is the thing this exists to catch." >&2
  failed=1
fi

# ── And that a re-apply did not hand a view back to the browser ───────────
#
# Rows are not the only live state a second application can move, and this
# script's first version could only see rows.
#
# `20260921143455_forms.sql` says `drop view if exists public.published_forms`
# and creates it again. The statements are idempotent and the **privileges are
# not**: a recreated relation in `public` is handed the default privileges
# afresh, and on Supabase those are `grant all on tables to anon,
# authenticated, service_role`. `published_forms` is auto-updatable and runs
# with its owner's rights, so that restores every verb on a relation whose
# writes never meet `forms`' owner-only policies — measured on the live
# project as `anon` going from SELECT to the full seven across one re-run.
#
# It moves no rows, so everything above stayed green while it happened. A
# deploy is exactly the re-application this models, which makes this the right
# place to ask.
#
# **It cannot fail on today's pending set, and that is worth saying rather
# than discovering.** `forms.sql` now carries the version the ledger recorded,
# so a deploy does not re-apply it and this rehearsal never runs the statement
# that would reopen the hole — the snapshot it starts from already has the
# view correct. Dropping the revoke from `forms.sql` is caught by
# `grants.check.sql`, which builds from `migrations/` on an empty cluster,
# and not by this. What this guards is the next migration to create or
# recreate a view while it is still pending, which is the state `forms.sql`
# was in this morning.
writable=$(psql -Atc "
  select string_agg(r.rolname || ' → ' || c.relname, ', ')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) as r(rolname)
   where n.nspname = 'public' and c.relkind = 'v'
     and (has_table_privilege(r.rolname, c.oid, 'insert')
       or has_table_privilege(r.rolname, c.oid, 'update')
       or has_table_privilege(r.rolname, c.oid, 'delete'))")
if [ -n "$writable" ]; then
  echo "· views writable from the API after the deploy: $writable"
  echo "  ✗ a view runs with its owner's rights, so those writes meet no policy." >&2
  failed=1
else
  echo "· no view in public is writable from the API afterwards"
fi

[ "$failed" = 0 ] && echo "· $pending pending migrations apply to production's shape, and move nothing"
exit "$failed"
