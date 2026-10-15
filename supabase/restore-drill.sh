#!/usr/bin/env bash
#
# The restore drill against real infrastructure: production's data, copied into
# the second Supabase project (Semester2), and compared.
#
# `restore.sh` is the rehearsal. It builds production's *shape* from this
# repository in a throwaway cluster, so it proves the procedure and nothing
# about the live project. This one reads the live project itself — read-only:
# `pg_dump` and `select`, nothing else — and restores it somewhere that is not
# the live project, which is step 4 of RESTORE.md's drill and the step that
# makes a drill a drill.
#
# ## What it answers, and what it does not
#
# It fills four of the six rows at the bottom of RESTORE.md: the recovery time
# for a logical restore, whether the six fingerprints matched, whether
# `ensure_rls` survived, and whether row-level security is still enforced.
# It also compares every table's row count in `public` and `private`.
#
# It does **not** say how far back Supabase's own backups reach or what the
# recovery point is. Those are properties of the platform's physical backups
# and are read off the dashboard (Database → Backups), not measured from here.
#
# ## What it copies, and what it deliberately does not
#
#   copied      schemas `public` and `private`, schema and data; `auth.users`
#               and `auth.identities` rows, so the foreign keys to them hold;
#               the database's event triggers (a schema-filtered dump leaves
#               them behind — that includes `ensure_rls` — so they are
#               re-created from the source's own definitions and then checked)
#   not copied  `cron` (Semester2 would start running production's jobs against
#               production's functions), Vault secrets, storage objects, and
#               auth sessions and refresh tokens (nobody signs in to the copy)
#
# The copy holds real accounts. Semester2 lives in the same organisation and
# nobody but the owner can reach it, but it is still a second place personal
# data sits: run with DRILL_CLEANUP=1, or clear it afterwards, as RESTORE.md
# step 7 asks.
#
# ## Running it
#
#     SOURCE_DB_URL='postgresql://postgres:…@db.lzrqvlugnawcgywkhqlz.supabase.co:5432/postgres' \
#     TARGET_DB_URL='postgresql://postgres:…@db.kpuulmnicidgdmwgfngv.supabase.co:5432/postgres' \
#     DRILL_WIPE_TARGET=kpuulmnicidgdmwgfngv \
#     DRILL_CLEANUP=1 \
#       supabase/restore-drill.sh
#
# The URLs are each project's direct connection string (Dashboard → Connect).
# Use the direct one, not the pooler: pg_dump needs a session.
#
# DRILL_WIPE_TARGET is the target's project ref, typed out. It is required
# whenever the target already has tables in `public`, because the drill drops
# `public` and `private` there and replaces `auth.users` — Semester2 had 19
# tables on 28 September. The script refuses outright if the target is the live
# project, whatever else is set.
#
# Needs `pg_dump`, `pg_restore` and `psql` at the server's major (17) or newer.
#
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
live_ref=lzrqvlugnawcgywkhqlz

: "${SOURCE_DB_URL:?set SOURCE_DB_URL to the live project direct connection string}"
: "${TARGET_DB_URL:?set TARGET_DB_URL to the drill project direct connection string}"

# ── Guards, before anything touches the target ──────────────────────────────

if [ "$SOURCE_DB_URL" = "$TARGET_DB_URL" ]; then
  echo "The source and the target are the same database. Refusing." >&2
  exit 2
fi
case "$TARGET_DB_URL" in
  *"$live_ref"*)
    echo "TARGET_DB_URL names the live project ($live_ref). The drill restores" >&2
    echo "somewhere else, never over production. Refusing." >&2
    exit 2 ;;
esac

src() { psql -X -q -v ON_ERROR_STOP=1 -d "$SOURCE_DB_URL" "$@"; }
dst() { psql -X -q -v ON_ERROR_STOP=1 -d "$TARGET_DB_URL" "$@"; }

major() { sed -nE 's/[^0-9]*([0-9]+).*/\1/p' | head -1; }
server_major=$(src -At -c 'show server_version' | major)
client_major=$(pg_dump --version | major)
if [ "$client_major" -lt "$server_major" ]; then
  echo "pg_dump is $client_major and the source runs $server_major. pg_dump cannot" >&2
  echo "dump a newer server; install the PostgreSQL $server_major client tools." >&2
  exit 2
fi

target_tables=$(dst -At -c "
  select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'")
if [ "$target_tables" -gt 0 ]; then
  target_id=$(printf '%s' "$TARGET_DB_URL" | sed -nE 's#.*@([^:/]+).*#\1#p')
  if [ -z "${DRILL_WIPE_TARGET:-}" ] || ! printf '%s' "$target_id" | grep -qF "$DRILL_WIPE_TARGET"; then
    echo "The target has $target_tables tables in public, and the drill replaces them." >&2
    echo "To go ahead, set DRILL_WIPE_TARGET to the target's project ref ($target_id)." >&2
    exit 2
  fi
fi

work=$(mktemp -d)
touched=""
# DRILL_CLEANUP runs from the EXIT trap, not at the end of the script: a
# restore that fails half way (`set -e`, `--exit-on-error`) would otherwise
# leave a partial copy of real accounts in the target, which is the case
# cleanup exists for.
clear_target() {
  echo "· clearing the copy from the target (DRILL_CLEANUP)"
  dst >/dev/null <<'SQL'
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
truncate auth.users cascade;
SQL
}
finish() {
  status=$?
  if [ -n "$touched" ] && [ -n "${DRILL_CLEANUP:-}" ]; then
    clear_target || { echo "  ✗ clearing the target failed; clear it by hand" >&2; status=1; }
  fi
  rm -rf "$work"
  exit "$status"
}
trap finish EXIT

# ── What production looks like now ──────────────────────────────────────────

# Every table in public and private, counted exactly. `query_to_xml` so that one
# statement can count tables it does not know the names of in advance.
counts_sql="
  select string_agg(format('%s.%s=%s', table_schema, table_name, n), ',' order by table_schema, table_name)
    from (select table_schema, table_name,
                 (xpath('/row/n/text()', query_to_xml(
                    format('select count(*) as n from %I.%I', table_schema, table_name),
                    false, true, '')))[1]::text::bigint as n
            from information_schema.tables
           where table_schema in ('public', 'private') and table_type = 'BASE TABLE') t"
auth_sql="select 'auth.users=' || count(*) from auth.users"

echo "· $(date -u +%H:%M:%SZ) drill started"
t0=$(date +%s)

before_fp=$(src -At -f "$here/fingerprint.sql")
before_rows=$(src -At -c "$counts_sql")
before_auth=$(src -At -c "$auth_sql")
before_triggers=$(src -At -c "select count(*) from pg_event_trigger where evtname = 'ensure_rls'")

# ── The dump, read-only ─────────────────────────────────────────────────────

echo "· dumping public and private from the source"
td0=$(date +%s)
pg_dump -d "$SOURCE_DB_URL" -Fc --no-owner -n public -n private -f "$work/app.dump"
auth_tables=$(src -At -c "
  select string_agg('--table=auth.' || table_name, ' ') from information_schema.tables
   where table_schema = 'auth' and table_name in ('users', 'identities')")
# shellcheck disable=SC2086
pg_dump -d "$SOURCE_DB_URL" --data-only --no-owner $auth_tables -f "$work/auth.sql"
# Event triggers are database-level, so `-n` leaves them out. Rebuild each one
# from the source's own catalogue rather than from a file in this repository,
# so the copy has what production has, not what the repository thinks it has.
src -At -c "
  select format('create event trigger %I on %s%s execute function %s();',
                e.evtname, e.evtevent,
                case when e.evttags is null then ''
                     else ' when tag in (' || (select string_agg(quote_literal(t), ', ') from unnest(e.evttags) t) || ')' end,
                e.evtfoid::regproc)
    from pg_event_trigger e
    join pg_proc p on p.oid = e.evtfoid
   where p.pronamespace::regnamespace::text in ('public', 'private')" > "$work/event-triggers.sql"
# Extensions the dump's objects may lean on, by the schema they live in.
src -At -c "
  select format('create extension if not exists %I with schema %I;', extname, extnamespace::regnamespace)
    from pg_extension where extname <> 'plpgsql'" > "$work/extensions.sql"
td1=$(date +%s)
size=$(stat -c %s "$work/app.dump" 2>/dev/null || stat -f %z "$work/app.dump")

# ── The restore, into the drill project ─────────────────────────────────────

echo "· restoring into the target"
tr0=$(date +%s)
touched=1
dst >/dev/null <<'SQL'
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public;
SQL
# Missing extensions are created where the target allows it; one that cannot
# be (not available on that project) is reported, and the restore goes on to
# fail on whatever needed it, which is the honest outcome.
while IFS= read -r stmt; do
  [ -n "$stmt" ] || continue
  schema=$(printf '%s' "$stmt" | sed -nE 's/.* with schema "?([a-z_]+)"?;$/\1/p')
  dst -c "create schema if not exists \"$schema\"" >/dev/null 2>&1 || true
  dst -c "$stmt" >/dev/null 2>&1 || echo "  ! could not run on the target: $stmt" >&2
done < "$work/extensions.sql"

# auth first: every foreign key into it is created after the data it guards.
dst -c 'truncate auth.users cascade' >/dev/null
dst -f "$work/auth.sql" >/dev/null
# `--exit-on-error` on purpose, as in restore.sh: a restore that prints errors
# and carries on returns most of the data and no list of what is missing.
# The dump creates schema `public`, which already exists above so extensions
# could land in it first; that one entry is left out of the restore list.
pg_restore -l "$work/app.dump" | grep -vE '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public ' > "$work/app.list"
pg_restore -d "$TARGET_DB_URL" --no-owner --exit-on-error -L "$work/app.list" "$work/app.dump"
dst -f "$work/event-triggers.sql" >/dev/null
tr1=$(date +%s)

# ── Compare ─────────────────────────────────────────────────────────────────

echo "· comparing"
after_fp=$(dst -At -f "$here/fingerprint.sql")
after_rows=$(dst -At -c "$counts_sql")
after_auth=$(dst -At -c "$auth_sql")

fail=0
say() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1"; echo "      source:   $2"; echo "      restored: $3"; fail=1; fi; }

say "schema fingerprints" "$before_fp" "$after_fp"
say "row counts, every table in public and private" "$before_rows" "$after_rows"
say "accounts" "$before_auth" "$after_auth"
after_triggers=$(dst -At -c "select count(*) from pg_event_trigger where evtname = 'ensure_rls'")
rls_off=$(dst -At -c "
  select coalesce(string_agg(relname, ','), 'none') from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")
# Exactly one on each side, not merely equal: a source that has already lost
# the trigger reads 0 = 0, and that is the drift this check is for.
say "the ensure_rls event trigger is on the source" "1" "$before_triggers"
say "the ensure_rls event trigger survived" "1" "$after_triggers"
say "row-level security is still on for every table" "none" "$rls_off"

# The control on the controls: every comparison above also passes between two
# empty databases, which is what a dump that silently took nothing looks like.
restored_tables=$(dst -At -c "
  select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'")
restored_rows=$(printf '%s' "$after_rows" | tr ',' '\n' | awk -F= '{s += $2} END {print s + 0}')
if [ "$restored_tables" -lt 15 ] || [ "$restored_rows" -eq 0 ]; then
  echo "  ✗ the restored copy has $restored_tables tables and $restored_rows rows: nothing was compared"
  fail=1
else
  echo "  ✓ and there was something there to compare ($restored_tables tables, $restored_rows rows)"
fi

t1=$(date +%s)

yes_no() { [ "$1" = "$2" ] && echo yes || echo no; }
day=$(date -u +%Y-%m-%d)
echo
echo "· for the table at the bottom of RESTORE.md"
echo "| Time to restore, start to finish (logical, this drill) | $((t1 - t0))s: dump $((td1 - td0))s ($size bytes), restore $((tr1 - tr0))s | $day |"
echo "| Did the six fingerprints match? | $(yes_no "$before_fp" "$after_fp") | $day |"
echo "| Did \`ensure_rls\` survive? | $(yes_no 11 "$before_triggers$after_triggers") | $day |"
echo "| Was row-level security still enforced? | $(yes_no none "$rls_off") | $day |"
echo
[ "$fail" = 0 ] && echo "· the live project's data restored faithfully into the target" \
                || echo "· the drill FAILED; that is a finding, write it down as one"
exit "$fail"
