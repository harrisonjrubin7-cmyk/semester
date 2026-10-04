-- PROPOSAL 04 · tenant data manifest, restore follow-up
--
-- What the repository already has (verified, not restated): account erasure and
-- export derived from the catalog (private.account_data_map), legal holds with a
-- two-person release, hold-aware sweeps, a school offboarding state machine whose
-- purge is authorised but deliberately not built.
--
-- What is missing and this file supplies:
--   1. A per-tenant manifest: for each table that carries tenant_id, how many rows
--      this tenant has, its registry class, and whether it is held. Offboarding step 6
--      "record and verify the export" today records a hash and counts of an export made
--      elsewhere; the manifest is the thing those counts should be compared to, and
--      after a purge it is the zero-row proof.
--   2. A restore record and the executable form of RESTORE.md's follow-up: "run the
--      sweeps, then notify every account in the window". D-124 chose NOT to keep a
--      deletion ledger, and this file does not reverse that: it records WHEN a restore
--      happened and WHICH ACCOUNTS WERE ACTIVE in the window (from `activity`, which
--      already exists), never who asked to be erased.

create or replace function private.tenant_data_manifest(_tenant text)
returns table (table_schema text, table_name text, domain text, record_class text,
               classification text, row_count bigint, tenant_held boolean)
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
declare r record; n bigint; held boolean := private.tenant_is_held(_tenant);
begin
  for r in
    select c.oid, ns.nspname::text as s, c.relname::text as t
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
     where ns.nspname in ('public','private') and c.relkind in ('r','p') and not c.relispartition
     order by 1, 2
  loop
    execute format('select count(*) from %I.%I where tenant_id = $1', r.s, r.t) into n using _tenant;
    table_schema := r.s; table_name := r.t; row_count := n; tenant_held := held;
    select g.domain, g.record_class, g.classification into domain, record_class, classification
      from private.data_registry g where g.table_schema = r.s and g.table_name = r.t;
    return next;
  end loop;
end $$;
revoke all on function private.tenant_data_manifest(text) from public, anon, authenticated;
grant execute on function private.tenant_data_manifest(text) to service_role;

create table if not exists private.restore_event (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('pitr','snapshot','logical_rehearsal')),
  environment      text not null check (environment in ('production','staging','rehearsal')),
  restore_point    timestamptz not null,        -- the moment the database was returned to
  restored_at      timestamptz not null,        -- when the restore finished
  measured_rpo     interval generated always as (restored_at - restore_point) stored,  -- data lost, upper bound
  sweeps_run_at    timestamptz,
  accounts_notified_at timestamptz,
  verified_by      text,
  check (restore_point <= restored_at),
  -- A production restore is not closed until its sweeps ran and its accounts were told.
  -- (Rehearsals are exempt: nobody real was in them.)
  check (environment <> 'production' or accounts_notified_at is null or sweeps_run_at is not null)
);
alter table private.restore_event enable row level security;
revoke all on private.restore_event from public, anon, authenticated;

-- Accounts that had the app open between the restore point and the restore:
-- the people whose work after the restore point may have been lost, and whose
-- erasure requests in that window may need repeating. Read from `activity`
-- (400-day clock), so it also works for a restore point inside that window.
create or replace function private.accounts_to_notify_after_restore(_restore_point timestamptz, _restored_at timestamptz)
returns table (user_id uuid)
language sql stable security definer set search_path = pg_catalog, public as $$
  select distinct a.user_id from public.activity a
   where a.day >= (_restore_point at time zone 'utc')::date
     and a.day <= (_restored_at at time zone 'utc')::date;
$$;
revoke all on function private.accounts_to_notify_after_restore(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.accounts_to_notify_after_restore(timestamptz, timestamptz) to service_role;

insert into private.data_registry (table_schema, table_name, domain, record_class, review_state)
values ('private','restore_event','governance','append_only_evidence','proposed') on conflict do nothing;
