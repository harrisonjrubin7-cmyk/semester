-- Phase 4 (institutional operation): three places where authority could be
-- handed out or kept without the server recording it, closed.
--
-- 1. `scim_group_mapping` decides which identity-provider group becomes which
--    Semester role, `admin` included, and it was the least-audited privilege
--    path in the schema: `approved_by`/`approved_at` were whatever the client
--    wrote, nothing kept earlier versions, and no check suite read it as another
--    school. Now the approver and time are stamped from the session, every
--    insert and update is copied to an immutable history, and the history is
--    readable only with `audit:read` at that school.
--
-- 2. Integration approval had no way back. `integration_approve_connection`
--    and `integration_approve_scope` set `approved_at`; nothing cleared it, and
--    pausing (which needs only `integration:sync`) resumed to `configuring`
--    with the approval intact. `integration_revoke_connection` and
--    `integration_revoke_scope` take the same `integration:approve` capability
--    the approval took, require a reason, clear the approval, and disconnect the
--    connection; the worker's existing rule (`approved_at` set and status not
--    `disconnected`) refuses the next run without learning anything new.
--    Scope approval also gains the two-person rule connections already had:
--    `proposed_by` is stamped on insert and the proposer may not approve.
--
-- 3. A membership deprovisioned by the identity provider revoked the person's
--    school-scoped grants (20260930210000) but left their signed-in sessions.
--    The gateway reloads membership per request, so gateway calls stopped; a
--    JWT already issued kept working against PostgREST for whatever ownership
--    or non-school grants still allowed, until it expired. The trigger now also
--    ends the person's `auth.sessions`, the way school offboarding does for a
--    whole school (20260930200000). The session ends everywhere, not only at the
--    deprovisioning school: a membership elsewhere is re-established by signing
--    in again, which is the one path that re-checks everything.
--
-- Proved by `identity-provisioning.check.sql`, `integration-control-plane.check.sql`
-- and `offboarding-grants.check.sql`, each of which was watched failing before
-- this file existed. Idempotent. No begin/commit: the runner opens the
-- transaction.

-- ── 1. Group → role mappings: stamped and kept ────────────────────────────

create or replace function private.stamp_scim_group_mapping()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  -- The approver's account being erased: the foreign key clears the name and
  -- that is the whole change. The approval's time stays what it was, and the
  -- history trigger records the erasure as a change with no author.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.approved_by is not null and new.approved_by is null then
    return new;
  end if;
  -- The session's user, when there is one. A service-role write (there is no
  -- such path today) keeps what it supplied rather than nulling the approver.
  new.approved_by := coalesce((select auth.uid()), new.approved_by);
  new.approved_at := now();
  return new;
end $$;
revoke all on function private.stamp_scim_group_mapping() from public, anon, authenticated;

drop trigger if exists scim_group_mapping_stamped on public.scim_group_mapping;
create trigger scim_group_mapping_stamped
before insert or update on public.scim_group_mapping
for each row execute function private.stamp_scim_group_mapping();

create table if not exists public.scim_group_mapping_history (
  id                uuid        primary key default gen_random_uuid(),
  mapping_id        uuid        not null,
  tenant_id         text        not null references public.schools (id) on delete cascade,
  external_group_id text        not null,
  display_name      text        not null,
  roles             text[]      not null,
  active            boolean     not null,
  changed_by        uuid        references auth.users (id) on delete set null,
  changed_at        timestamptz not null default now()
);

create index if not exists scim_group_mapping_history_by_tenant_time
  on public.scim_group_mapping_history (tenant_id, changed_at desc);
create index if not exists scim_group_mapping_history_by_mapping
  on public.scim_group_mapping_history (mapping_id);
create index if not exists scim_group_mapping_history_by_changer
  on public.scim_group_mapping_history (changed_by);

alter table public.scim_group_mapping_history enable row level security;
revoke all on public.scim_group_mapping_history from public;
revoke all on public.scim_group_mapping_history from anon, authenticated;
grant select on public.scim_group_mapping_history to authenticated;

drop policy if exists "tenant auditors read group mapping history" on public.scim_group_mapping_history;
create policy "tenant auditors read group mapping history" on public.scim_group_mapping_history
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create or replace function private.record_scim_group_mapping_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.scim_group_mapping_history
    (mapping_id, tenant_id, external_group_id, display_name, roles, active, changed_by)
  values (new.id, new.tenant_id, new.external_group_id, new.display_name, new.roles, new.active, new.approved_by);
  return new;
end $$;

-- Immutable to people; not to the foreign keys. A removed school's cascade
-- takes its history with it, and a departed administrator's account can be
-- erased because `changed_by` is allowed to clear and nothing else is. The
-- cascade's own trigger is depth 1, so this one sees depth 2; a person's
-- UPDATE is depth 1 (the shape 20260930233000 uses for guardian history).
create or replace function private.refuse_scim_group_mapping_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.changed_by is not null and new.changed_by is null
     and new.id = old.id and new.mapping_id = old.mapping_id and new.tenant_id = old.tenant_id
     and new.external_group_id = old.external_group_id and new.display_name = old.display_name
     and new.roles = old.roles and new.active = old.active and new.changed_at = old.changed_at then
    return new;
  end if;
  raise exception 'Group mapping history is immutable.';
end $$;

-- The same shape has sat on tenant_sso_policy_history since 20260928011845:
-- its refusal aborted the cascade from `schools` and the `set null` from
-- `auth.users`, so a school could not be removed and an administrator's
-- account could not be erased once either had an SSO policy change on record.
-- Redefined here with the same two exceptions.
create or replace function private.refuse_tenant_sso_policy_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.changed_by is not null and new.changed_by is null
     and new.id = old.id and new.tenant_id = old.tenant_id and new.require_sso = old.require_sso
     and new.reason = old.reason and new.changed_at = old.changed_at then
    return new;
  end if;
  raise exception 'Tenant SSO policy history is immutable.';
end $$;

revoke all on function private.record_scim_group_mapping_change() from public, anon, authenticated;
revoke all on function private.refuse_scim_group_mapping_history_change() from public, anon, authenticated;

drop trigger if exists scim_group_mapping_recorded on public.scim_group_mapping;
create trigger scim_group_mapping_recorded
after insert or update on public.scim_group_mapping
for each row execute function private.record_scim_group_mapping_change();

drop trigger if exists scim_group_mapping_history_immutable on public.scim_group_mapping_history;
create trigger scim_group_mapping_history_immutable
before update or delete on public.scim_group_mapping_history
for each row execute function private.refuse_scim_group_mapping_history_change();

-- ── 2. Integration approval has a way back ────────────────────────────────

create or replace function public.integration_revoke_connection(want_connection text, want_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare c public.integration_connections;
begin
  select * into c from public.integration_connections where public_id = want_connection;
  if c.id is null or not private.has_capability('integration:approve', 'school', c.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if length(trim(coalesce(want_reason, ''))) = 0 then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  -- Already withdrawn: nothing to do, and saying so is not an error.
  if c.approved_at is null and c.status = 'disconnected' then
    return 'disconnected';
  end if;
  -- `read` is the one direction the check constraint allows without an
  -- approval, so the direction falls back to it as the approval goes.
  update public.integration_connections
     set approved_by = null, approved_at = null, sync_direction = 'read',
         status = 'disconnected', disconnected_at = now(),
         paused_reason = left(want_reason, 1000), updated_at = now()
   where id = c.id;
  return 'disconnected';
end $$;
revoke all on function public.integration_revoke_connection(text, text) from public, anon;
grant execute on function public.integration_revoke_connection(text, text) to authenticated;

create or replace function public.integration_revoke_scope(want_scope uuid, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.integration_scopes;
begin
  select * into s from public.integration_scopes where id = want_scope;
  if s.id is null or not private.has_capability('integration:approve', 'school', s.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if length(trim(coalesce(want_reason, ''))) = 0 then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  update public.integration_scopes
     set approved = false, approved_by = null, approved_at = null, updated_at = now()
   where id = s.id and approved;
end $$;
revoke all on function public.integration_revoke_scope(uuid, text) from public, anon;
grant execute on function public.integration_revoke_scope(uuid, text) to authenticated;

alter table public.integration_scopes
  add column if not exists proposed_by uuid references auth.users (id) on delete set null;
create index if not exists integration_scopes_by_proposer on public.integration_scopes (proposed_by);

create or replace function private.stamp_integration_scope_proposer()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.proposed_by := coalesce((select auth.uid()), new.proposed_by);
  return new;
end $$;
revoke all on function private.stamp_integration_scope_proposer() from public, anon, authenticated;

drop trigger if exists integration_scope_proposer_stamped on public.integration_scopes;
create trigger integration_scope_proposer_stamped
before insert on public.integration_scopes
for each row execute function private.stamp_integration_scope_proposer();

-- Redefined: the body is 20260927170000's with the two-person rule added.
create or replace function public.integration_approve_scope(want_scope uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.integration_scopes;
begin
  select * into s from public.integration_scopes where id = want_scope;
  if s.id is null or not private.has_capability('integration:approve', 'school', s.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  -- Nobody approves their own scope.
  if s.proposed_by is not null and s.proposed_by = (select auth.uid()) then
    raise exception 'The proposer of a scope cannot approve it.' using errcode = '42501';
  end if;
  update public.integration_scopes
     set approved = true, approved_by = (select auth.uid()), approved_at = now(), updated_at = now()
   where id = s.id;
end $$;
revoke all on function public.integration_approve_scope(uuid) from public, anon;
grant execute on function public.integration_approve_scope(uuid) to authenticated;

-- ── 3. Deprovisioning ends the person's sessions ──────────────────────────

-- Redefined: 20260930210000's body, plus the session deletion.
create or replace function private.revoke_grants_on_deprovision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deprovisioned'
     and old.status is distinct from 'deprovisioned'
     and new.auth_user_id is not null then
    update public.role_grants
       set revoked_at = now()
     where subject = new.auth_user_id
       and scope_kind = 'school'
       and scope_id = new.tenant_id
       and revoked_at is null;
    -- `auth.sessions` is Supabase's; a plain Postgres has none, and a
    -- deprovisioning there has no sessions to end.
    if to_regclass('auth.sessions') is not null then
      execute 'delete from auth.sessions where user_id = $1' using new.auth_user_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.revoke_grants_on_deprovision() from public, anon, authenticated, service_role;
