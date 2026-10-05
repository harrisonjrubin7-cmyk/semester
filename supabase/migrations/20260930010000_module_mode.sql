-- Semester — the mode of each module, per school: Connect or Core.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- D-151: Semester runs beside a school's systems (CONNECT, today's behaviour
-- and the default) and takes a module over only when the school switches that
-- module to CORE. This file is where the switch lives. It builds no module.
--
-- ## What the database refuses
--
-- - A school that is in Connect for every module, until someone says
--   otherwise: a module with no row reads Connect.
-- - Switching a module to Core on one person's say. A request names the
--   module and a reason; it is applied when TWO other people who hold
--   `tenant:configure` over the school have approved it. The requester never
--   counts, and neither does the same person twice.
-- - Switching to Core while `kill.core_modules` is engaged for the school (or
--   globally), and reading Core while it is: the switch reports Connect.
-- - A second pending request for the same module.
-- - An expired request being approved (seven days).
-- - Any edit or deletion of the history.
--
-- ## The way back
--
-- Reducing what Semester is the record for is always allowed and needs no
-- approval: a request to go from Core to Connect is applied at once. It does
-- not delete anything. The row stays, marked `frozen`: the module's Core data
-- is kept, read-only, and switching to Core again lifts the freeze.
--
-- ## Who writes: nobody through the API
--
-- There is no insert, update or delete policy on `tenant_module_mode`. The
-- only door is a request and its approvals, and the trigger that applies them
-- runs as the table's owner. Members of the school read their own modes;
-- administrators (`tenant:configure`) and auditors (`audit:read`) read the
-- requests and the history.

-- ── The kill switch ───────────────────────────────────────────────────────

do $$
begin
  alter table public.feature_kill_switch drop constraint if exists feature_kill_switch_switch_key_check;
  alter table public.feature_kill_switch add constraint feature_kill_switch_switch_key_check check (
    switch_key in (
      'kill.integration_sync', 'kill.ai_generation', 'kill.data_upload',
      'kill.code_execution', 'kill.sharing', 'kill.writeback', 'kill.core_modules'
    ) or switch_key ~ '^kill\.connection\.[a-z]+_[0-9a-f]{20}$');
end $$;

-- ── The modules ───────────────────────────────────────────────────────────
--
-- One list, in SQL, that the table, the function and the request all use. The
-- same fourteen ids are `CORE_MODULES` in packages/contract, and
-- app/src/lib/modulemode.test.ts reads this function and holds them equal.

create or replace function public.core_modules()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'lms_assignments', 'lms_gradebook', 'lms_assessments', 'attendance',
    'registration', 'degree_audit', 'records', 'admissions',
    'student_accounts', 'financial_aid', 'scheduling', 'events',
    'k12', 'advancement'
  ]::text[]
$$;
revoke all on function public.core_modules() from public, anon;
grant execute on function public.core_modules() to authenticated;

-- ── Where each module stands ──────────────────────────────────────────────

create table if not exists public.tenant_module_mode (
  tenant_id  text        not null references public.schools (id) on delete cascade,
  module     text        not null check (module = any (public.core_modules())),
  mode       text        not null default 'connect' check (mode in ('connect', 'core')),
  -- Set when a module goes back from Core to Connect: its Core data is kept,
  -- read-only. Cleared when it goes to Core again.
  frozen     boolean     not null default false,
  reason     text        not null check (length(btrim(reason)) between 1 and 1000),
  changed_by uuid        references auth.users (id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module),
  constraint tenant_module_mode_frozen_only_in_connect check (not (frozen and mode = 'core'))
);
create index if not exists tenant_module_mode_by_changer on public.tenant_module_mode (changed_by);

-- ── A request to change one ───────────────────────────────────────────────

create table if not exists public.module_mode_request (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools (id) on delete cascade,
  module       text        not null check (module = any (public.core_modules())),
  to_mode      text        not null check (to_mode in ('connect', 'core')),
  reason       text        not null check (length(btrim(reason)) between 1 and 1000),
  status       text        not null default 'pending' check (status in ('pending', 'applied', 'expired')),
  requested_by uuid        references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  applied_at   timestamptz
);
create index if not exists module_mode_request_by_tenant on public.module_mode_request (tenant_id, requested_at desc);
create index if not exists module_mode_request_by_requester on public.module_mode_request (requested_by);
create unique index if not exists module_mode_request_one_pending
  on public.module_mode_request (tenant_id, module) where status = 'pending';

create table if not exists public.module_mode_approval (
  id         uuid        primary key default gen_random_uuid(),
  request_id uuid        not null references public.module_mode_request (id) on delete cascade,
  approver   uuid        references auth.users (id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (request_id, approver)
);
create index if not exists module_mode_approval_by_approver on public.module_mode_approval (approver);

-- ── Every change, kept ────────────────────────────────────────────────────

create table if not exists public.tenant_module_mode_history (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools (id) on delete cascade,
  module       text        not null,
  from_mode    text,
  to_mode      text        not null,
  frozen       boolean     not null,
  reason       text        not null,
  requested_by uuid,
  approvers    uuid[]      not null default '{}',
  changed_at   timestamptz not null default now()
);
create index if not exists tenant_module_mode_history_by_tenant_time
  on public.tenant_module_mode_history (tenant_id, changed_at desc);

-- ── Access ────────────────────────────────────────────────────────────────

alter table public.tenant_module_mode enable row level security;
alter table public.module_mode_request enable row level security;
alter table public.module_mode_approval enable row level security;
alter table public.tenant_module_mode_history enable row level security;

revoke all on table public.tenant_module_mode from public, anon, authenticated;
revoke all on table public.module_mode_request from public, anon, authenticated;
revoke all on table public.module_mode_approval from public, anon, authenticated;
revoke all on table public.tenant_module_mode_history from public, anon, authenticated;

grant select on table public.tenant_module_mode to authenticated;
grant select, insert on table public.module_mode_request to authenticated;
grant select, insert on table public.module_mode_approval to authenticated;
grant select on table public.tenant_module_mode_history to authenticated;

drop policy if exists "school members read module modes" on public.tenant_module_mode;
create policy "school members read module modes" on public.tenant_module_mode
  for select to authenticated
  using (tenant_id = (select private.school_of()));

drop policy if exists "tenant administrators read module requests" on public.module_mode_request;
create policy "tenant administrators read module requests" on public.module_mode_request
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('audit:read', 'school', tenant_id));
drop policy if exists "tenant administrators request a module mode" on public.module_mode_request;
create policy "tenant administrators request a module mode" on public.module_mode_request
  for insert to authenticated
  with check (requested_by = (select auth.uid())
              and private.has_capability('tenant:configure', 'school', tenant_id));

drop policy if exists "tenant administrators read module approvals" on public.module_mode_approval;
create policy "tenant administrators read module approvals" on public.module_mode_approval
  for select to authenticated
  using (exists (select 1 from public.module_mode_request r
                  where r.id = request_id
                    and (private.has_capability('tenant:configure', 'school', r.tenant_id)
                         or private.has_capability('audit:read', 'school', r.tenant_id))));
drop policy if exists "tenant administrators approve a module mode" on public.module_mode_approval;
create policy "tenant administrators approve a module mode" on public.module_mode_approval
  for insert to authenticated
  with check (approver = (select auth.uid())
              and exists (select 1 from public.module_mode_request r
                           where r.id = request_id
                             and private.has_capability('tenant:configure', 'school', r.tenant_id)));

drop policy if exists "tenant auditors read module history" on public.tenant_module_mode_history;
create policy "tenant auditors read module history" on public.tenant_module_mode_history
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id)
         or private.has_capability('tenant:configure', 'school', tenant_id));

-- ── What a school's modules are, for whoever asks ─────────────────────────
--
-- Security invoker: the caller sees only their own school's rows, so a school
-- they do not belong to reads all-Connect. A module with no row is Connect.
-- Under the kill switch every module reads Connect, and one that was Core
-- reads frozen: nothing is deleted, nothing is writable.

create or replace function public.effective_module_modes(want_tenant text)
returns table (module text, mode text, frozen boolean, killed boolean)
language sql stable set search_path = '' as $$
  with k as (select public.kill_switch_engaged('kill.core_modules', want_tenant) as killed)
  select m.module,
         case when k.killed then 'connect' else coalesce(t.mode, 'connect') end,
         (coalesce(t.frozen, false) or (k.killed and coalesce(t.mode, 'connect') = 'core')),
         k.killed
    from unnest(public.core_modules()) as m(module)
    cross join k
    left join public.tenant_module_mode t
      on t.tenant_id = want_tenant and t.module = m.module
   order by m.module
$$;
revoke all on function public.effective_module_modes(text) from public, anon;
grant execute on function public.effective_module_modes(text) to authenticated;

-- ── The rules ─────────────────────────────────────────────────────────────

create or replace function private.guard_module_mode_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cur text;
begin
  select coalesce((select t.mode from public.tenant_module_mode t
                    where t.tenant_id = new.tenant_id and t.module = new.module), 'connect') into cur;
  if new.to_mode = cur then
    raise exception 'The % module is already in % mode.', new.module, cur;
  end if;
  if new.to_mode = 'core' and public.kill_switch_engaged('kill.core_modules', new.tenant_id) then
    raise exception 'Core modules are switched off for this school (kill.core_modules).';
  end if;
  -- Core also needs the school's own entitlement: module.core_mode is off
  -- until a policy row for this school puts it in sandbox or production. An
  -- unset policy is off, so an administrator alone cannot open the door.
  if new.to_mode = 'core'
     and public.feature_state('module.core_mode', new.tenant_id) not in ('sandbox', 'production') then
    raise exception 'Core modules are not enabled for this school (module.core_mode).';
  end if;
  -- A request past its seven days takes no more approvals, so it is closed
  -- here, before the one-pending index looks, or it would block every
  -- replacement for the module for good.
  update public.module_mode_request
     set status = 'expired'
   where tenant_id = new.tenant_id and module = new.module
     and status = 'pending' and expires_at <= clock_timestamp();
  new.status := 'pending';
  new.applied_at := null;
  new.requested_at := clock_timestamp();
  new.expires_at := clock_timestamp() + interval '7 days';
  return new;
end $$;

create or replace function private.guard_module_mode_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.module_mode_request%rowtype;
begin
  -- Locked, so two approvals arriving together are taken one at a time: the
  -- second counts the first after it commits, and one of them applies it.
  select * into r from public.module_mode_request where id = new.request_id for update;
  if r.status <> 'pending' then
    raise exception 'That request is already %.', r.status;
  end if;
  if r.expires_at <= clock_timestamp() then
    raise exception 'That request expired; make a new one.';
  end if;
  if r.requested_by is not distinct from new.approver then
    raise exception 'The person who asked cannot approve their own request.';
  end if;
  if r.to_mode = 'core' and public.kill_switch_engaged('kill.core_modules', r.tenant_id) then
    raise exception 'Core modules are switched off for this school (kill.core_modules).';
  end if;
  if r.to_mode = 'core'
     and public.feature_state('module.core_mode', r.tenant_id) not in ('sandbox', 'production') then
    raise exception 'Core modules are not enabled for this school (module.core_mode).';
  end if;
  new.decided_at := clock_timestamp();
  return new;
end $$;

create or replace function private.apply_module_mode(want_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.module_mode_request%rowtype;
  before_mode text;
  now_frozen boolean;
  who uuid[];
begin
  select * into r from public.module_mode_request where id = want_request for update;
  select t.mode into before_mode from public.tenant_module_mode t
   where t.tenant_id = r.tenant_id and t.module = r.module;
  now_frozen := (r.to_mode = 'connect' and before_mode = 'core');
  select coalesce(array_agg(a.approver order by a.decided_at), '{}') into who
    from public.module_mode_approval a where a.request_id = want_request;

  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason, changed_by, entered_at, updated_at)
  values (r.tenant_id, r.module, r.to_mode, now_frozen, r.reason, r.requested_by, clock_timestamp(), clock_timestamp())
  on conflict (tenant_id, module) do update
     set mode = excluded.mode, frozen = excluded.frozen, reason = excluded.reason,
         changed_by = excluded.changed_by, entered_at = excluded.entered_at, updated_at = excluded.updated_at;

  insert into public.tenant_module_mode_history
    (tenant_id, module, from_mode, to_mode, frozen, reason, requested_by, approvers)
  values (r.tenant_id, r.module, coalesce(before_mode, 'connect'), r.to_mode, now_frozen, r.reason, r.requested_by, who);

  update public.module_mode_request set status = 'applied', applied_at = clock_timestamp() where id = want_request;
end $$;

-- A rollback is applied the moment it is asked for.
create or replace function private.after_module_mode_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.to_mode = 'connect' then
    perform private.apply_module_mode(new.id);
  end if;
  return new;
end $$;

-- Core is applied on the second distinct approver.
-- How many distinct approvers, other than the requester, Core needs.
create or replace function private.module_mode_approvals_required()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;

create or replace function private.after_module_mode_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(distinct a.approver) from public.module_mode_approval a where a.request_id = new.request_id)
       >= private.module_mode_approvals_required() then
    perform private.apply_module_mode(new.request_id);
  end if;
  return new;
end $$;

create or replace function private.refuse_module_mode_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Module mode history is immutable.';
end $$;

revoke all on function private.guard_module_mode_request() from public, anon, authenticated;
revoke all on function private.guard_module_mode_approval() from public, anon, authenticated;
revoke all on function private.apply_module_mode(uuid) from public, anon, authenticated;
revoke all on function private.after_module_mode_request() from public, anon, authenticated;
revoke all on function private.after_module_mode_approval() from public, anon, authenticated;
revoke all on function private.module_mode_approvals_required() from public, anon, authenticated;
revoke all on function private.refuse_module_mode_history_change() from public, anon, authenticated;

drop trigger if exists module_mode_request_guarded on public.module_mode_request;
create trigger module_mode_request_guarded
before insert on public.module_mode_request
for each row execute function private.guard_module_mode_request();

drop trigger if exists module_mode_request_applied on public.module_mode_request;
create trigger module_mode_request_applied
after insert on public.module_mode_request
for each row execute function private.after_module_mode_request();

drop trigger if exists module_mode_approval_guarded on public.module_mode_approval;
create trigger module_mode_approval_guarded
before insert on public.module_mode_approval
for each row execute function private.guard_module_mode_approval();

drop trigger if exists module_mode_approval_applied on public.module_mode_approval;
create trigger module_mode_approval_applied
after insert on public.module_mode_approval
for each row execute function private.after_module_mode_approval();

drop trigger if exists tenant_module_mode_history_immutable on public.tenant_module_mode_history;
create trigger tenant_module_mode_history_immutable
before update or delete on public.tenant_module_mode_history
for each row execute function private.refuse_module_mode_history_change();

comment on table public.tenant_module_mode is
  'Whether one school runs a module in Connect (Semester reads its system) or Core (Semester is the record). No write policy: changed only by an approved request. Core to Connect freezes the module''s data; it never deletes it.';
comment on table public.module_mode_request is
  'A request to change one module''s mode. Connect to Core needs two approvals from people other than the requester; Core to Connect applies at once.';
comment on table public.module_mode_approval is
  'One approver''s yes to a module_mode_request. Two distinct approvers, neither the requester, apply a request to Core.';
comment on table public.tenant_module_mode_history is
  'Immutable record of every module mode change, with who asked and who approved.';
