-- Semester — the plan a school is on, for the entitlement order's tenant-plan
-- step.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `supabase/functions/_shared/entitlement.ts` refuses at `tenant-plan` when a
-- school's plan is suspended or ended, or its end date has passed. Nothing
-- stored a plan, so on LTI launches that step was unsourced. This is the one
-- current plan per school, and the history of every change to it.
--
-- ## Who writes a plan: nobody through the API
--
-- A plan is a commercial fact: what the school signed. A school administrator
-- holding `tenant:configure` must not be able to grant their own school a
-- plan, or extend one, so there is **no write policy at all**. Only the
-- service role writes, which is whoever operates Semester recording a signed
-- contract. Tenant administrators and auditors can read their own school's.
--
-- ## The vocabulary is one that already exists
--
-- `tier` is the deal desk's (`app/src/lib/governance/deal-desk.ts`: pilot,
-- department, campus, system). `status` is the entitlement order's own
-- (`trial`, `active`, `suspended`, `ended`), so a row reads straight into the
-- step without translation. A pilot must have an end date, because the deal
-- desk's rule is that a pilot converts or ends.
--
-- ## No row is not "ended"
--
-- A school with no plan row has no recorded plan, which the shadow log reports
-- as unsourced for that school rather than as a refusal. Whoever turns
-- enforcement on must decide that no row refuses (docs/ENTITLEMENT-RESOLUTION.md).

create table if not exists public.tenant_plan (
  tenant_id   text        primary key references public.schools (id) on delete cascade,
  tier        text        not null check (tier in ('pilot', 'department', 'campus', 'system')),
  status      text        not null check (status in ('trial', 'active', 'suspended', 'ended')),
  starts_at   timestamptz not null default now(),
  -- Null is open-ended: an active plan with no fixed end.
  ends_at     timestamptz,
  reason      text        not null default '' check (length(reason) <= 1000),
  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint tenant_plan_ends_after_start check (ends_at is null or ends_at > starts_at),
  constraint tenant_plan_pilot_ends check (tier <> 'pilot' or ends_at is not null)
);

create index if not exists tenant_plan_by_updater on public.tenant_plan (updated_by);

alter table public.tenant_plan enable row level security;
revoke all on public.tenant_plan from public;
revoke all on public.tenant_plan from anon, authenticated;
grant select on public.tenant_plan to authenticated;

drop policy if exists "tenant administrators and auditors read their plan" on public.tenant_plan;
create policy "tenant administrators and auditors read their plan" on public.tenant_plan
  for select to authenticated
  using (
    private.has_capability('tenant:configure', 'school', tenant_id)
    or private.has_capability('audit:read', 'school', tenant_id)
  );

-- ── Every change, kept ────────────────────────────────────────────────────

create table if not exists public.tenant_plan_history (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools (id) on delete cascade,
  tier        text        not null,
  status      text        not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  reason      text        not null,
  changed_by  uuid        references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists tenant_plan_history_by_tenant_time
  on public.tenant_plan_history (tenant_id, changed_at desc);
create index if not exists tenant_plan_history_by_changer
  on public.tenant_plan_history (changed_by);

alter table public.tenant_plan_history enable row level security;
revoke all on public.tenant_plan_history from public;
revoke all on public.tenant_plan_history from anon, authenticated;
grant select on public.tenant_plan_history to authenticated;

drop policy if exists "tenant auditors read plan history" on public.tenant_plan_history;
create policy "tenant auditors read plan history" on public.tenant_plan_history
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create or replace function private.record_tenant_plan_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tenant_plan_history
    (tenant_id, tier, status, starts_at, ends_at, reason, changed_by)
  values (new.tenant_id, new.tier, new.status, new.starts_at, new.ends_at, new.reason, new.updated_by);
  return new;
end $$;

create or replace function private.refuse_tenant_plan_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Tenant plan history is immutable.';
end $$;

revoke all on function private.record_tenant_plan_change() from public, anon, authenticated;
revoke all on function private.refuse_tenant_plan_history_change() from public, anon, authenticated;

drop trigger if exists tenant_plan_recorded on public.tenant_plan;
create trigger tenant_plan_recorded
after insert or update on public.tenant_plan
for each row execute function private.record_tenant_plan_change();

drop trigger if exists tenant_plan_history_immutable on public.tenant_plan_history;
create trigger tenant_plan_history_immutable
before update or delete on public.tenant_plan_history
for each row execute function private.refuse_tenant_plan_history_change();

-- ── The launch's facts now include the plan ───────────────────────────────
--
-- Dropped and recreated, not replaced: the returned columns change, and
-- `create or replace` cannot change a function's result type.

drop function if exists public.lti_launch_entitlement_facts(text);

create function public.lti_launch_entitlement_facts(want_tenant text)
returns table (kill_switched boolean, module_state text, plan_status text, plan_ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select public.kill_switch_engaged('kill.integration_sync', want_tenant),
         public.feature_state('integration.lms_lti', want_tenant)::text,
         (select p.status from public.tenant_plan p where p.tenant_id = want_tenant),
         (select p.ends_at from public.tenant_plan p where p.tenant_id = want_tenant)
$$;

revoke all on function public.lti_launch_entitlement_facts(text) from public;
revoke all on function public.lti_launch_entitlement_facts(text) from anon, authenticated;
grant execute on function public.lti_launch_entitlement_facts(text) to service_role;

comment on table public.tenant_plan is
  'The current plan per school: deal-desk tier, entitlement status, dates. Written only by the service role; a school cannot grant itself a plan.';
comment on table public.tenant_plan_history is
  'Immutable record of every tenant_plan insert and update.';
comment on function public.lti_launch_entitlement_facts(text) is
  'Service-only: the LTI kill switch, module state and plan (null when none recorded) for one school, for the launch''s shadow entitlement check. Reads; never writes.';
