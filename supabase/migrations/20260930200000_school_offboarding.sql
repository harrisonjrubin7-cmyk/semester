-- A school leaves in steps, each of them kept and each of them undoable until
-- the last (full-beta gate G3).
--
-- Until this file nothing stopped `delete from schools`, and 125 tenant tables
-- reference `schools` with `on delete cascade`: one statement would have
-- silently taken every share, request, grant and roll-out record with it, with
-- no export, no second person and no record that it happened. This replaces
-- that with a procedure, and makes the statement itself impossible.
--
--   proposed ──► approved ──► access_disabled ──► export_verified ──► archived
--       │           │               │                    │               │
--       └─ cancelled┘               └────────────────────┴───────────────┴──► restored
--
--   1. PROPOSE  a person on one side (the school's administrator, or the
--               platform operator) opens a case with a reason.
--   2. PREFLIGHT the case counts everything that hangs from the school — every
--               public table with a tenant or school column, members, live
--               grants and connections, live legal holds — and keeps the
--               numbers. Nobody approves a departure they cannot see the size of.
--   3. APPROVE  a *different* person from the *other* side. Two people, and one
--               from each side, or nothing moves.
--   4. NOTICE   the date students were told they should export their own
--               records first. Recorded, not sent: this sends nothing.
--   5. DISABLE ACCESS  the school's role grants are revoked (each remembered),
--               its integration connections are disconnected and their
--               credential pointers cleared (each remembered), the holders'
--               sessions are ended, no new member can join and no new grant can
--               be made, and the roll-out is suspended. Nothing is deleted.
--   6. EXPORT   the operator records the export's manifest hash and row counts
--               and to whom it went; a second operator verifies that the counts
--               still match the school as it now stands.
--   7. ARCHIVE  the case is archived with a retention window (at least 30
--               days; the length is counsel's to set, 90 is the default and a
--               placeholder). The data is still there.
--   8. PURGE ELIGIBILITY  only after the window, with no live legal hold, and
--               only on the word of a third person who neither proposed nor
--               approved. This records that authorization and does nothing
--               else: the trigger on `schools` below still refuses every
--               delete, because the category-by-category purge (with a
--               confirmation per category) is not built and is not built here.
--
-- RESTORE undoes 5–7 exactly: the grants and connections it revoked come back
-- as they were, by a different operator from the one who disabled access, with
-- a reason. It cannot follow an authorization to purge.
--
-- Legal holds. A hold protects what it covers from ever being purged; a case
-- over a school with a live hold can still be disabled and archived (nothing
-- is destroyed) but is never purge-eligible. Holds are read from
-- `public.legal_holds` when that table exists, so this works before and after
-- it does.
--
-- The actors are named by uuid with no foreign key to `auth.users` on purpose:
-- erasing a staff member's account must not fail because they once approved a
-- departure, and the audit envelope already keeps them pseudonymously.

-- ── 1. The case ────────────────────────────────────────────────────────────

create table if not exists public.school_offboarding (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools (id) on delete restrict,
  status                text        not null default 'proposed' check (status in (
                          'proposed', 'approved', 'access_disabled', 'export_verified',
                          'archived', 'restored', 'cancelled')),
  reason                text        not null check (length(btrim(reason)) between 1 and 1000),
  proposed_by           uuid        not null,
  proposed_side         text        not null check (proposed_side in ('school', 'operator')),
  proposed_at           timestamptz not null default now(),
  -- The size of the departure, taken by `offboarding_preflight`.
  inventory             jsonb,
  inventory_at          timestamptz,
  approved_by           uuid,
  approved_at           timestamptz,
  students_notified_on  date,
  access_disabled_by    uuid,
  access_disabled_at    timestamptz,
  export_recorded_by    uuid,
  export_recorded_at    timestamptz,
  export_sha256         text        check (export_sha256 is null or export_sha256 ~ '^[0-9a-f]{64}$'),
  export_counts         jsonb,
  export_delivered_to   text        check (export_delivered_to is null or length(btrim(export_delivered_to)) between 1 and 300),
  export_verified_by    uuid,
  export_verified_at    timestamptz,
  archived_by           uuid,
  archived_at           timestamptz,
  retain_until          timestamptz,
  restored_by           uuid,
  restored_at           timestamptz,
  restore_reason        text        check (restore_reason is null or length(btrim(restore_reason)) between 1 and 1000),
  purge_authorized_by   uuid,
  purge_authorized_at   timestamptz,
  purge_reason          text        check (purge_reason is null or length(btrim(purge_reason)) between 1 and 1000),
  cancelled_reason      text        check (cancelled_reason is null or length(btrim(cancelled_reason)) between 1 and 1000),
  -- The two-person rules, on the row itself.
  constraint offboarding_two_people check (approved_by is null or approved_by <> proposed_by),
  constraint offboarding_verifier_is_not_recorder
    check (export_verified_by is null or export_verified_by is distinct from export_recorded_by),
  constraint offboarding_restorer_is_not_disabler
    check (restored_by is null or access_disabled_by is null or restored_by <> access_disabled_by),
  constraint offboarding_purge_by_a_third_person
    check (purge_authorized_by is null
           or (purge_authorized_by <> proposed_by and purge_authorized_by is distinct from approved_by))
);

-- One open case per school.
create unique index if not exists school_offboarding_one_open
  on public.school_offboarding (tenant_id)
  where status in ('proposed', 'approved', 'access_disabled', 'export_verified', 'archived');

create index if not exists school_offboarding_by_tenant on public.school_offboarding (tenant_id, proposed_at desc);

-- What was revoked, so it can be given back exactly.
create table if not exists public.school_offboarding_undo (
  id         uuid        primary key default gen_random_uuid(),
  case_id    uuid        not null references public.school_offboarding (id) on delete restrict,
  kind       text        not null check (kind in ('role_grant', 'connection', 'rollout')),
  object_id  text        not null,
  prior      jsonb       not null default '{}'::jsonb,
  taken_at   timestamptz not null default now(),
  unique (case_id, kind, object_id)
);

alter table public.school_offboarding enable row level security;
alter table public.school_offboarding_undo enable row level security;

revoke all on table public.school_offboarding, public.school_offboarding_undo from public, anon, authenticated;
grant select on table public.school_offboarding to authenticated;
grant select, insert, update on table public.school_offboarding, public.school_offboarding_undo to service_role;

-- A school's own administrators and auditors read their case; the operator
-- reads all of them. Nobody writes but through the functions below.
drop policy if exists school_offboarding_read on public.school_offboarding;
create policy school_offboarding_read on public.school_offboarding for select to authenticated
  using (
    (select private.is_app_admin())
    or (select private.has_capability('tenant:configure', 'school', tenant_id))
    or (select private.has_capability('audit:read', 'school', tenant_id))
  );

-- ── 2. The case is a record ────────────────────────────────────────────────

create or replace function private.school_offboarding_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ok boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'An offboarding case is a record and is never deleted.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'proposed';
    new.proposed_at := now();
    return new;
  end if;
  if (new.id, new.tenant_id, new.reason, new.proposed_by, new.proposed_side, new.proposed_at)
     is distinct from
     (old.id, old.tenant_id, old.reason, old.proposed_by, old.proposed_side, old.proposed_at) then
    raise exception 'What a case was opened for is not edited.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    ok := (old.status, new.status) in (
      ('proposed', 'approved'), ('proposed', 'cancelled'),
      ('approved', 'access_disabled'), ('approved', 'cancelled'),
      ('access_disabled', 'export_verified'), ('access_disabled', 'restored'),
      ('export_verified', 'archived'), ('export_verified', 'restored'),
      ('archived', 'restored'));
    if not ok then
      raise exception 'A case cannot go from % to %.', old.status, new.status using errcode = '23514';
    end if;
  elsif old.status in ('restored', 'cancelled') then
    raise exception 'A % case is closed.', old.status using errcode = '23514';
  end if;
  -- A fact once recorded is not overwritten (the export is recorded again by
  -- a fresh case, not by editing this one).
  if (old.approved_by is not null and new.approved_by is distinct from old.approved_by)
     or (old.access_disabled_by is not null and new.access_disabled_by is distinct from old.access_disabled_by)
     or (old.export_sha256 is not null and new.export_sha256 is distinct from old.export_sha256)
     or (old.export_verified_by is not null and new.export_verified_by is distinct from old.export_verified_by)
     or (old.archived_by is not null and new.archived_by is distinct from old.archived_by)
     or (old.purge_authorized_by is not null and new.purge_authorized_by is distinct from old.purge_authorized_by) then
    raise exception 'A recorded step of an offboarding case is not overwritten.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function private.school_offboarding_guard() from public, anon, authenticated;

drop trigger if exists school_offboarding_guard on public.school_offboarding;
create trigger school_offboarding_guard
  before insert or update or delete on public.school_offboarding
  for each row execute function private.school_offboarding_guard();

create or replace function private.school_offboarding_undo_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'What an offboarding revoked is kept as it was taken.' using errcode = '42501';
end $$;

revoke all on function private.school_offboarding_undo_guard() from public, anon, authenticated;

drop trigger if exists school_offboarding_undo_guard on public.school_offboarding_undo;
create trigger school_offboarding_undo_guard
  before update or delete on public.school_offboarding_undo
  for each row execute function private.school_offboarding_undo_guard();

-- ── 3. A school row is never deleted ───────────────────────────────────────
--
-- Not "is deleted through a procedure": is not deleted. The purge that would
-- take a school's records category by category, confirming each, is a later,
-- separately authorized piece of work, and until it exists the only safe answer
-- to `delete from schools` is no. A disposable database that must remove a
-- school (a test, a restore drill) does so with `session_replication_role =
-- replica`, which a hosted project's API roles cannot set.

create or replace function private.refuse_school_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A school is never deleted: it is offboarded (see docs/SCHOOL-OFFBOARDING.md). Deleting % would cascade through its tenant records.', old.id
    using errcode = '42501';
end $$;

revoke all on function private.refuse_school_delete() from public, anon, authenticated;

drop trigger if exists refuse_school_delete on public.schools;
create trigger refuse_school_delete
  before delete on public.schools
  for each row execute function private.refuse_school_delete();

-- ── 4. While a school is leaving, nothing new attaches to it ──────────────

create or replace function private.school_is_leaving(school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('semester.offboarding_restore', true), '') <> 'on'
     and exists (
       select 1 from public.school_offboarding o
        where o.tenant_id = school
          and o.status in ('access_disabled', 'export_verified', 'archived'));
$$;

revoke all on function private.school_is_leaving(text) from public, anon, authenticated;

create or replace function private.refuse_grant_to_leaving_school()
returns trigger
language plpgsql
-- Definer: a trigger runs as the writer, who may not execute private helpers.
security definer
set search_path = ''
as $$
begin
  if new.scope_kind = 'school' and new.revoked_at is null and private.school_is_leaving(new.scope_id) then
    raise exception 'This school is being offboarded; it takes no new role grants.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.refuse_grant_to_leaving_school() from public, anon, authenticated;

drop trigger if exists refuse_grant_to_leaving_school on public.role_grants;
create trigger refuse_grant_to_leaving_school
  before insert or update on public.role_grants
  for each row execute function private.refuse_grant_to_leaving_school();

create or replace function private.refuse_member_of_leaving_school()
returns trigger
language plpgsql
-- Definer: a trigger runs as the writer, who may not execute private helpers.
security definer
set search_path = ''
as $$
begin
  if new.school_id is not null
     and (tg_op = 'INSERT' or new.school_id is distinct from old.school_id)
     and private.school_is_leaving(new.school_id) then
    raise exception 'This school is being offboarded; it takes no new members.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.refuse_member_of_leaving_school() from public, anon, authenticated;

drop trigger if exists refuse_member_of_leaving_school on public.profiles;
create trigger refuse_member_of_leaving_school
  before insert or update of school_id on public.profiles
  for each row execute function private.refuse_member_of_leaving_school();

create or replace function private.refuse_connection_of_leaving_school()
returns trigger
language plpgsql
-- Definer: a trigger runs as the writer, who may not execute private helpers.
security definer
set search_path = ''
as $$
begin
  if new.status <> 'disconnected' and private.school_is_leaving(new.tenant_id) then
    raise exception 'This school is being offboarded; its integrations stay disconnected.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.refuse_connection_of_leaving_school() from public, anon, authenticated;

drop trigger if exists refuse_connection_of_leaving_school on public.integration_connections;
create trigger refuse_connection_of_leaving_school
  before insert or update on public.integration_connections
  for each row execute function private.refuse_connection_of_leaving_school();

-- ── 5. Live legal holds over a school ─────────────────────────────────────

create or replace function private.school_live_holds(school text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if to_regclass('public.legal_holds') is not null then
    execute
      'select count(*)::int from public.legal_holds h
        where h.released_at is null
          and (h.tenant_id = $1 or h.subject_kind = ''platform'')'
      into n using school;
  end if;
  return n;
end $$;

revoke all on function private.school_live_holds(text) from public, anon, authenticated;

-- ── 6. The steps ───────────────────────────────────────────────────────────

-- Every public table that holds rows for a school, as it stands *now*: one
-- column per table (school_id sorts before tenant_id), zero-row tables left
-- out. The audit record is Semester's own evidence, grows with every step of
-- this very procedure, and is kept (3-year sweep); it is not the school's to be
-- handed back, so it is not counted or exported. Preflight reads it to size the
-- departure and verification reads it again to be sure the export still covers
-- everything, including a table that was empty at preflight and is not now.
create or replace function private.school_tenant_tables(school text)
returns table (tbl text, col text, n bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec record;
  cnt bigint;
begin
  for rec in
    select t.table_name, min(c.column_name) as column_name
      from information_schema.tables t
      join information_schema.columns c
        on c.table_schema = t.table_schema and c.table_name = t.table_name
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and c.column_name in ('tenant_id', 'school_id')
       and t.table_name not in ('school_offboarding', 'school_offboarding_undo', 'audit_event')
     group by t.table_name
     order by t.table_name
  loop
    execute format('select count(*) from public.%I where %I::text = $1', rec.table_name, rec.column_name)
      into cnt using school;
    if cnt > 0 then
      tbl := rec.table_name; col := rec.column_name; n := cnt;
      return next;
    end if;
  end loop;
end $$;

revoke all on function private.school_tenant_tables(text) from public, anon, authenticated;

create or replace function private.offboarding_operator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not private.is_app_admin() then
    raise exception 'Only a signed-in platform operator does this.' using errcode = '42501';
  end if;
  return me;
end $$;

revoke all on function private.offboarding_operator() from public, anon, authenticated;

create or replace function private.offboarding_case(want uuid, expect text[])
returns public.school_offboarding
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.school_offboarding;
begin
  select * into c from public.school_offboarding where id = want for update;
  if not found then
    raise exception 'No such case.' using errcode = 'no_data_found';
  end if;
  if not (c.status = any (expect)) then
    raise exception 'This case is %, not %.', c.status, array_to_string(expect, ' or ') using errcode = '23514';
  end if;
  return c;
end $$;

revoke all on function private.offboarding_case(uuid, text[]) from public, anon, authenticated;

-- 1. Propose.
create or replace function public.propose_offboarding(want_school text, why text, as_side text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  made uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if as_side = 'operator' and not private.is_app_admin() then
    raise exception 'You are not a platform operator.' using errcode = '42501';
  end if;
  if as_side = 'school' and not private.has_capability('tenant:configure', 'school', want_school) then
    raise exception 'You do not administer that school.' using errcode = '42501';
  end if;
  if as_side not in ('school', 'operator') then
    raise exception 'Propose as the school or as the operator.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.schools where id = want_school) then
    raise exception 'No such school.' using errcode = 'no_data_found';
  end if;
  insert into public.school_offboarding (tenant_id, reason, proposed_by, proposed_side)
  values (want_school, why, me, as_side)
  returning id into made;
  perform private.record_audit(want_school, 'school.offboarding_proposed', 'school_offboarding', made::text, 'allowed',
                               null, jsonb_build_object('side', as_side));
  return made;
end $$;

-- 2. Preflight: the dependency inventory.
create or replace function public.offboarding_preflight(want uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.school_offboarding;
  rec record;
  n bigint;
  tables jsonb := '[]'::jsonb;
  inv jsonb;
begin
  select * into c from public.school_offboarding where id = want;
  if not found then raise exception 'No such case.' using errcode = 'no_data_found'; end if;
  if not (private.is_app_admin()
          or private.has_capability('tenant:configure', 'school', c.tenant_id)) then
    raise exception 'Not yours to read.' using errcode = '42501';
  end if;
  c := private.offboarding_case(want, array['proposed', 'approved']);
  for rec in select * from private.school_tenant_tables(c.tenant_id) loop
    tables := tables || jsonb_build_array(jsonb_build_object('table', rec.tbl, 'column', rec.col, 'rows', rec.n));
  end loop;
  inv := jsonb_build_object(
    'tables', tables,
    'members', (select count(*) from public.profiles where school_id = c.tenant_id),
    'role_grants', (select count(*) from public.role_grants g where g.scope_kind = 'school' and g.scope_id = c.tenant_id and g.revoked_at is null),
    'live_connections', (select count(*) from public.integration_connections i where i.tenant_id = c.tenant_id and i.status <> 'disconnected'),
    'live_legal_holds', private.school_live_holds(c.tenant_id));
  update public.school_offboarding set inventory = inv, inventory_at = now() where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_preflight', 'school_offboarding', want::text, 'allowed',
                               null, jsonb_build_object('tables', jsonb_array_length(tables)));
  return inv;
end $$;

-- 3. Approve: a different person, from the other side.
create or replace function public.approve_offboarding(want uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.school_offboarding;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  c := private.offboarding_case(want, array['proposed']);
  if me = c.proposed_by then
    raise exception 'A case is approved by someone other than the person who proposed it.' using errcode = '42501';
  end if;
  if c.proposed_side = 'school' and not private.is_app_admin() then
    raise exception 'A school-side proposal is approved by a platform operator.' using errcode = '42501';
  end if;
  if c.proposed_side = 'operator' and not private.has_capability('tenant:configure', 'school', c.tenant_id) then
    raise exception 'An operator-side proposal is approved by the school''s own administrator.' using errcode = '42501';
  end if;
  if c.inventory is null then
    raise exception 'Take the preflight inventory before approving; nobody approves a departure they cannot size.' using errcode = '23514';
  end if;
  update public.school_offboarding set status = 'approved', approved_by = me, approved_at = now() where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_approved', 'school_offboarding', want::text, 'allowed');
end $$;

create or replace function public.cancel_offboarding(want uuid, why text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.school_offboarding;
begin
  c := private.offboarding_case(want, array['proposed', 'approved']);
  if not (private.is_app_admin() or private.has_capability('tenant:configure', 'school', c.tenant_id)) then
    raise exception 'Not yours to cancel.' using errcode = '42501';
  end if;
  update public.school_offboarding set status = 'cancelled', cancelled_reason = why where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_cancelled', 'school_offboarding', want::text, 'allowed');
end $$;

-- 4. Notice: the date students were told to export their own records.
create or replace function public.record_offboarding_notice(want uuid, given_on date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.school_offboarding;
begin
  c := private.offboarding_case(want, array['approved']);
  if not (private.is_app_admin() or private.has_capability('tenant:configure', 'school', c.tenant_id)) then
    raise exception 'Not yours to record.' using errcode = '42501';
  end if;
  if given_on > current_date then
    raise exception 'A notice is recorded on the day it was given, not before.' using errcode = '22023';
  end if;
  update public.school_offboarding set students_notified_on = given_on where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_notice_recorded', 'school_offboarding', want::text, 'allowed');
end $$;

-- 5. Disable access. Reversible: everything taken is remembered.
create or replace function public.disable_school_access(want uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  g record;
  k record;
  r record;
  n_grants int := 0;
  n_conns int := 0;
  n_sessions int := 0;
  holders uuid[] := '{}';
  suspended boolean := false;
begin
  c := private.offboarding_case(want, array['approved']);
  if c.students_notified_on is null then
    raise exception 'Record the day students were told to export their own records first.' using errcode = '23514';
  end if;
  for g in
    select id, subject, role from public.role_grants
     where scope_kind = 'school' and scope_id = c.tenant_id and revoked_at is null
     for update
  loop
    insert into public.school_offboarding_undo (case_id, kind, object_id, prior)
    values (want, 'role_grant', g.id::text, jsonb_build_object('subject', g.subject, 'role', g.role));
    update public.role_grants set revoked_at = now() where id = g.id;
    holders := holders || g.subject;
    n_grants := n_grants + 1;
  end loop;

  for k in
    select id, status, credentials_reference from public.integration_connections
     where tenant_id = c.tenant_id and (status <> 'disconnected' or credentials_reference is not null)
     for update
  loop
    insert into public.school_offboarding_undo (case_id, kind, object_id, prior)
    values (want, 'connection', k.id::text,
            jsonb_build_object('status', k.status, 'credentials_reference', k.credentials_reference));
    update public.integration_connections set status = 'disconnected', credentials_reference = null where id = k.id;
    n_conns := n_conns + 1;
  end loop;

  -- The holders' sessions end. A student's own session is not touched: they
  -- keep their account, and their own export, whatever happens to the school.
  if to_regclass('auth.sessions') is not null and cardinality(holders) > 0 then
    execute 'delete from auth.sessions where user_id = any ($1)' using holders;
    get diagnostics n_sessions = row_count;
  end if;

  if to_regclass('public.tenant_rollout') is not null then
    select * into r from public.tenant_rollout where tenant_id = c.tenant_id;
    if found and r.state in ('pilot_read_only', 'pilot_write_enabled', 'production_limited', 'production_active', 'expansion',
                             'requested', 'claimed', 'security_review', 'sandbox_uat') then
      insert into public.school_offboarding_undo (case_id, kind, object_id, prior)
      values (want, 'rollout', c.tenant_id, jsonb_build_object('state', r.state));
      update public.tenant_rollout set state = 'suspended', reason = 'Offboarding case ' || want::text || ': access disabled', updated_by = me
       where tenant_id = c.tenant_id;
      suspended := true;
    end if;
  end if;

  update public.school_offboarding
     set status = 'access_disabled', access_disabled_by = me, access_disabled_at = now() where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_access_disabled', 'school_offboarding', want::text, 'allowed',
                               null, jsonb_build_object('grants', n_grants, 'connections', n_conns, 'sessions', n_sessions));
  return jsonb_build_object('grants', n_grants, 'connections', n_conns, 'sessions', n_sessions, 'rollout_suspended', suspended);
end $$;

-- 6a. The export, recorded by one operator …
create or replace function public.record_offboarding_export(want uuid, manifest_sha256 text, counts jsonb, delivered_to text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
begin
  c := private.offboarding_case(want, array['access_disabled']);
  if counts is null or jsonb_typeof(counts) <> 'object' then
    raise exception 'The export records its row counts per table.' using errcode = '22023';
  end if;
  update public.school_offboarding
     set export_sha256 = manifest_sha256, export_counts = counts, export_delivered_to = delivered_to,
         export_recorded_by = me, export_recorded_at = now()
   where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_export_recorded', 'school_offboarding', want::text, 'allowed');
end $$;

-- … and verified by another: the counts it claims are the counts there are.
create or replace function public.verify_offboarding_export(want uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  rec record;
  n bigint;
  differs jsonb := '[]'::jsonb;
begin
  c := private.offboarding_case(want, array['access_disabled']);
  if c.export_sha256 is null then
    raise exception 'No export has been recorded.' using errcode = '23514';
  end if;
  if me = c.export_recorded_by then
    raise exception 'The export is verified by a different operator from the one who recorded it.' using errcode = '42501';
  end if;
  for rec in select key as tbl, value as claimed from jsonb_each_text(c.export_counts) loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = rec.tbl and column_name in ('tenant_id', 'school_id')) then
      differs := differs || jsonb_build_array(jsonb_build_object('table', rec.tbl, 'why', 'not a tenant table'));
      continue;
    end if;
    execute format('select count(*) from public.%I where %I::text = $1', rec.tbl,
                   (select column_name from information_schema.columns
                     where table_schema = 'public' and table_name = rec.tbl and column_name in ('tenant_id', 'school_id')
                     order by column_name limit 1))
      into n using c.tenant_id;
    if n <> rec.claimed::bigint then
      differs := differs || jsonb_build_array(jsonb_build_object('table', rec.tbl, 'exported', rec.claimed::bigint, 'now', n));
    end if;
  end loop;
  -- The export must also cover every table the preflight found ...
  for rec in select (t ->> 'table') as tbl from jsonb_array_elements(c.inventory -> 'tables') t loop
    if not (c.export_counts ? rec.tbl) then
      differs := differs || jsonb_build_array(jsonb_build_object('table', rec.tbl, 'why', 'not in the export'));
    end if;
  end loop;
  -- ... and every table that holds rows for the school *now*, so a table that
  -- was empty at preflight and gained its first row since cannot be left out.
  for rec in select * from private.school_tenant_tables(c.tenant_id) loop
    if not (c.export_counts ? rec.tbl)
       and not exists (select 1 from jsonb_array_elements(c.inventory -> 'tables') t where t ->> 'table' = rec.tbl) then
      differs := differs || jsonb_build_array(jsonb_build_object('table', rec.tbl, 'why', 'has rows now and is not in the export'));
    end if;
  end loop;
  if jsonb_array_length(differs) > 0 then
    perform private.record_audit(c.tenant_id, 'school.offboarding_export_rejected', 'school_offboarding', want::text, 'denied',
                                 null, jsonb_build_object('tables', jsonb_array_length(differs)));
    return jsonb_build_object('verified', false, 'differences', differs);
  end if;
  update public.school_offboarding
     set status = 'export_verified', export_verified_by = me, export_verified_at = now() where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_export_verified', 'school_offboarding', want::text, 'allowed');
  return jsonb_build_object('verified', true, 'differences', '[]'::jsonb);
end $$;

-- 7. Soft-archive, with a retention window. Nothing is deleted.
create or replace function public.archive_school(want uuid, retain_days integer default 90)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  until timestamptz;
begin
  c := private.offboarding_case(want, array['export_verified']);
  if retain_days is null or retain_days < 30 then
    raise exception 'A school is kept for at least 30 days after it is archived.' using errcode = '22023';
  end if;
  until := now() + make_interval(days => retain_days);
  update public.school_offboarding
     set status = 'archived', archived_by = me, archived_at = now(), retain_until = until where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_archived', 'school_offboarding', want::text, 'allowed',
                               null, jsonb_build_object('retain_days', retain_days));
  return until;
end $$;

-- Restore: gives back exactly what was taken, by a different operator.
create or replace function public.restore_school(want uuid, why text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  u record;
  n_grants int := 0;
  n_conns int := 0;
  resumed boolean := false;
begin
  c := private.offboarding_case(want, array['access_disabled', 'export_verified', 'archived']);
  if c.purge_authorized_by is not null then
    raise exception 'A purge has been authorized; this case cannot be restored.' using errcode = '23514';
  end if;
  if why is null or length(btrim(why)) = 0 then
    raise exception 'A restoration needs its reason.' using errcode = '22023';
  end if;
  if me = c.access_disabled_by then
    raise exception 'A school is restored by a different operator from the one who disabled it.' using errcode = '42501';
  end if;
  perform set_config('semester.offboarding_restore', 'on', true);

  for u in select * from public.school_offboarding_undo where case_id = want and kind = 'role_grant' loop
    update public.role_grants set revoked_at = null where id = u.object_id::uuid and revoked_at is not null;
    n_grants := n_grants + 1;
  end loop;
  for u in select * from public.school_offboarding_undo where case_id = want and kind = 'connection' loop
    update public.integration_connections
       set status = u.prior ->> 'status', credentials_reference = u.prior ->> 'credentials_reference'
     where id = u.object_id::uuid;
    n_conns := n_conns + 1;
  end loop;
  if exists (select 1 from public.school_offboarding_undo where case_id = want and kind = 'rollout')
     and to_regclass('public.tenant_rollout') is not null
     and exists (select 1 from public.tenant_rollout where tenant_id = c.tenant_id and state = 'suspended') then
    insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by, recorded_by)
    values (c.tenant_id, 'remediation', 'Offboarding case ' || want::text || ' restored: ' || why, 'platform operator', me);
    update public.tenant_rollout
       set state = (select u2.prior ->> 'state' from public.school_offboarding_undo u2
                     where u2.case_id = want and u2.kind = 'rollout'),
           reason = 'Offboarding case ' || want::text || ' restored', updated_by = me
     where tenant_id = c.tenant_id;
    resumed := true;
  end if;

  perform set_config('semester.offboarding_restore', 'off', true);
  update public.school_offboarding
     set status = 'restored', restored_by = me, restored_at = now(), restore_reason = why where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_restored', 'school_offboarding', want::text, 'allowed',
                               null, jsonb_build_object('grants', n_grants, 'connections', n_conns));
  return jsonb_build_object('grants', n_grants, 'connections', n_conns, 'rollout_resumed', resumed);
end $$;

-- 8. Purge eligibility: a question with reasons, and an authorization that acts on nothing.
create or replace function public.school_purge_eligibility(want uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.school_offboarding;
  blockers text[] := '{}';
begin
  select * into c from public.school_offboarding where id = want;
  if not found then raise exception 'No such case.' using errcode = 'no_data_found'; end if;
  if not (private.is_app_admin() or private.has_capability('tenant:configure', 'school', c.tenant_id)
          or private.has_capability('audit:read', 'school', c.tenant_id)) then
    raise exception 'Not yours to read.' using errcode = '42501';
  end if;
  if c.status <> 'archived' then blockers := array_append(blockers, 'the case is ' || c.status || ', not archived'); end if;
  if c.retain_until is not null and now() < c.retain_until then blockers := array_append(blockers, 'the retention window has not ended'); end if;
  if private.school_live_holds(c.tenant_id) > 0 then blockers := array_append(blockers, 'a legal hold is live'); end if;
  return jsonb_build_object('eligible', cardinality(blockers) = 0, 'blockers', to_jsonb(blockers),
                            'authorized', c.purge_authorized_at is not null);
end $$;

create or replace function public.authorize_school_purge(want uuid, why text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  elig jsonb;
begin
  c := private.offboarding_case(want, array['archived']);
  if me = c.proposed_by or me = c.approved_by then
    raise exception 'A purge is authorized by someone who neither proposed nor approved the departure.' using errcode = '42501';
  end if;
  if why is null or length(btrim(why)) = 0 then
    raise exception 'An authorization needs its reason.' using errcode = '22023';
  end if;
  elig := public.school_purge_eligibility(want);
  if not (elig ->> 'eligible')::boolean then
    raise exception 'Not eligible for purge: %', elig ->> 'blockers' using errcode = '23514';
  end if;
  update public.school_offboarding
     set purge_authorized_by = me, purge_authorized_at = now(), purge_reason = why where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_purge_authorized', 'school_offboarding', want::text, 'allowed');
end $$;

-- ── 7. Who may call what ───────────────────────────────────────────────────

revoke all on function public.propose_offboarding(text, text, text) from public, anon;
revoke all on function public.offboarding_preflight(uuid) from public, anon;
revoke all on function public.approve_offboarding(uuid) from public, anon;
revoke all on function public.cancel_offboarding(uuid, text) from public, anon;
revoke all on function public.record_offboarding_notice(uuid, date) from public, anon;
revoke all on function public.disable_school_access(uuid) from public, anon;
revoke all on function public.record_offboarding_export(uuid, text, jsonb, text) from public, anon;
revoke all on function public.verify_offboarding_export(uuid) from public, anon;
revoke all on function public.archive_school(uuid, integer) from public, anon;
revoke all on function public.restore_school(uuid, text) from public, anon;
revoke all on function public.school_purge_eligibility(uuid) from public, anon;
revoke all on function public.authorize_school_purge(uuid, text) from public, anon;

grant execute on function public.propose_offboarding(text, text, text) to authenticated;
grant execute on function public.offboarding_preflight(uuid) to authenticated;
grant execute on function public.approve_offboarding(uuid) to authenticated;
grant execute on function public.cancel_offboarding(uuid, text) to authenticated;
grant execute on function public.record_offboarding_notice(uuid, date) to authenticated;
grant execute on function public.disable_school_access(uuid) to authenticated;
grant execute on function public.record_offboarding_export(uuid, text, jsonb, text) to authenticated;
grant execute on function public.verify_offboarding_export(uuid) to authenticated;
grant execute on function public.archive_school(uuid, integer) to authenticated;
grant execute on function public.restore_school(uuid, text) to authenticated;
grant execute on function public.school_purge_eligibility(uuid) to authenticated;
grant execute on function public.authorize_school_purge(uuid, text) to authenticated;

comment on table public.school_offboarding is
  'One school''s departure, step by step: proposed, sized, approved by both sides, access disabled, export verified, archived, restorable until a purge is authorized. Written only through the functions; a school row itself is never deleted.';
comment on table public.school_offboarding_undo is
  'What an offboarding revoked, as it stood, so restore gives back exactly that. Immutable.';
