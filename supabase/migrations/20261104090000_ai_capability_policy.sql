-- Institution-controlled AI capability policy.
--
-- The existing tenant feature row is the master release gate and ai_policy is
-- the provider/data/budget ceiling. This table narrows that decision for each
-- product surface and role. Absence means off. It never gates Today, Courses,
-- Calendar, assignments, notes, or any other non-AI academic workflow.

create table if not exists public.ai_capability_policy (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  feature_key text not null check (feature_key in ('assistant', 'tutoring', 'writing', 'advising')),
  enabled boolean not null default false,
  permitted_roles text[] not null default '{}',
  allowed_modes text[] not null default '{}',
  reason text not null default '' check (length(reason) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_key),
  constraint ai_capability_policy_modes_valid check (
    allowed_modes <@ array['explain', 'hint', 'practice', 'review', 'draft']::text[]
  ),
  constraint ai_capability_policy_enabled_has_scope check (
    not enabled or (cardinality(permitted_roles) > 0 and cardinality(allowed_modes) > 0)
  ),
  constraint ai_capability_policy_enabled_has_reason check (
    not enabled or length(trim(reason)) between 3 and 1000
  )
);

create index if not exists ai_capability_policy_by_updater
  on public.ai_capability_policy (updated_by);

alter table public.ai_capability_policy enable row level security;
revoke all on table public.ai_capability_policy from anon, authenticated;
grant select, insert, update, delete on table public.ai_capability_policy to authenticated;

drop policy if exists "school members read AI capability policy" on public.ai_capability_policy;
create policy "school members read AI capability policy" on public.ai_capability_policy
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));

drop policy if exists "AI administrators insert capability policy" on public.ai_capability_policy;
create policy "AI administrators insert capability policy" on public.ai_capability_policy
  for insert to authenticated
  with check (private.has_capability('ai:configure', 'school', tenant_id));

drop policy if exists "AI administrators update capability policy" on public.ai_capability_policy;
create policy "AI administrators update capability policy" on public.ai_capability_policy
  for update to authenticated
  using (private.has_capability('ai:configure', 'school', tenant_id))
  with check (private.has_capability('ai:configure', 'school', tenant_id));

drop policy if exists "AI administrators delete capability policy" on public.ai_capability_policy;
create policy "AI administrators delete capability policy" on public.ai_capability_policy
  for delete to authenticated
  using (private.has_capability('ai:configure', 'school', tenant_id));

create or replace function private.stamp_ai_capability_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

revoke all on function private.stamp_ai_capability_policy() from public, anon, authenticated;

create or replace trigger stamp_ai_capability_policy
  before insert or update on public.ai_capability_policy
  for each row execute function private.stamp_ai_capability_policy();

-- The audit table predates this entity type; retain its closed vocabulary and
-- add this policy rather than weakening the constraint.
alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'ai_capability_policy',
    'approved_source', 'consent_record'
  ));

create or replace trigger audit_ai_capability_policy
  after insert or update or delete on public.ai_capability_policy
  for each row execute function private.audit_tenant_policy_change();

comment on table public.ai_capability_policy is
  'Per-tenant, per-AI-surface role and mode narrowing. Missing or disabled rows deny AI without affecting core academic workflows.';
