-- Semester — cohort scope for feature flags.
--
-- The release documents of 29 September ask for flags that resolve
--
--   global → environment → tenant → … → cohort → role → user → kill switch
--
-- and the GO gate's item O-1 is partial for one reason: the evaluator
-- (`app/src/lib/flags.ts`) walks every one of those scopes except the cohort.
-- A pilot is a cohort — "first-year registration 2027", fifty named students —
-- so without it the only way to limit a module to a pilot was a role, which is
-- the wrong shape: a role is what somebody is, a cohort is who was chosen.
--
-- Two additions, both additive:
--
--   * `tenant_feature_policy.permitted_cohorts` — beside the existing
--     `permitted_roles`, and with the same meaning: empty admits everybody the
--     earlier steps admitted; non-empty admits only members of a named cohort.
--     The column is on a table whose writes are already limited to
--     `tenant:configure` and already audited, so it inherits both.
--   * `feature_cohort_members` — who is in which cohort at which school.
--     Written only by a holder of `tenant:configure` at that school. A student
--     reads their own memberships and nobody else's; a configurer reads the
--     school's. Membership is never deleted: removing somebody stamps
--     `removed_at` and `removed_by`, so the table is its own record of who was
--     in a pilot and when.
--
-- `public.feature_cohort_allows(capability, tenant)` answers the evaluator's
-- question for the caller — security invoker, so it can see only what the
-- caller's own row-level security already lets them see, and it takes no user
-- parameter: nobody can ask it about somebody else.
--
-- A cohort is a release scope, never an authority. It narrows who sees a
-- feature the earlier steps allowed; it cannot widen anything.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

alter table public.tenant_feature_policy
  add column if not exists permitted_cohorts text[] not null default '{}';

create table if not exists public.feature_cohort_members (
  tenant_id  text not null references public.schools(id) on delete cascade,
  cohort     text not null check (cohort ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  removed_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz,
  primary key (tenant_id, cohort, user_id)
);

create index if not exists feature_cohort_members_by_user
  on public.feature_cohort_members (user_id);
create index if not exists feature_cohort_members_by_adder
  on public.feature_cohort_members (added_by);
create index if not exists feature_cohort_members_by_remover
  on public.feature_cohort_members (removed_by);

alter table public.feature_cohort_members enable row level security;
revoke all on table public.feature_cohort_members from anon, authenticated;
grant select, insert, update on table public.feature_cohort_members to authenticated;

-- Who added and who removed are stamped from the session, not the request.
create or replace function private.stamp_cohort_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := (select auth.uid());
    new.added_at := now();
    new.removed_by := null;
    new.removed_at := null;
  else
    -- Only `removed_*` may change, and only from null to set: a membership is
    -- ended once, and the row keeps who was in the cohort and when.
    if new.tenant_id is distinct from old.tenant_id or new.cohort is distinct from old.cohort
       or new.user_id is distinct from old.user_id or new.added_by is distinct from old.added_by
       or new.added_at is distinct from old.added_at then
      raise exception 'A cohort membership is ended, never rewritten.';
    end if;
    if old.removed_at is not null then
      raise exception 'This membership has already ended.';
    end if;
    if new.removed_at is null then
      raise exception 'An update may only end the membership.';
    end if;
    new.removed_by := (select auth.uid());
    new.removed_at := now();
  end if;
  return new;
end $$;

revoke all on function private.stamp_cohort_membership() from public, anon, authenticated;

drop trigger if exists stamp_cohort_membership on public.feature_cohort_members;
create trigger stamp_cohort_membership
  before insert or update on public.feature_cohort_members
  for each row execute function private.stamp_cohort_membership();

drop policy if exists "members read their own cohorts" on public.feature_cohort_members;
create policy "members read their own cohorts" on public.feature_cohort_members
  for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_capability('tenant:configure', 'school', tenant_id));

drop policy if exists "tenant administrators add cohort members" on public.feature_cohort_members;
create policy "tenant administrators add cohort members" on public.feature_cohort_members
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

drop policy if exists "tenant administrators end cohort memberships" on public.feature_cohort_members;
create policy "tenant administrators end cohort memberships" on public.feature_cohort_members
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

-- Whether the policy row's cohort list admits the caller. True when the row
-- names no cohort (the step does not apply) or when the caller has a live
-- membership in one it names; false when there is no row, because a flag with
-- no policy row is off and nothing downstream should read it as open.
create or replace function public.feature_cohort_allows(want_capability text, want_tenant text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select cardinality(p.permitted_cohorts) = 0
        or exists (
             select 1 from public.feature_cohort_members m
              where m.tenant_id = p.tenant_id
                and m.user_id = (select auth.uid())
                and m.removed_at is null
                and m.cohort = any (p.permitted_cohorts))
      from public.tenant_feature_policy p
     where p.tenant_id = want_tenant and p.capability = want_capability
  ), false);
$$;

revoke all on function public.feature_cohort_allows(text, text) from public, anon, authenticated;
grant execute on function public.feature_cohort_allows(text, text) to authenticated;

comment on column public.tenant_feature_policy.permitted_cohorts is
  'Empty admits everybody earlier steps admitted; otherwise only live members of a named cohort in feature_cohort_members.';
comment on table public.feature_cohort_members is
  'Who a school placed in which release cohort, and when they left it. Written only with tenant:configure; never deleted.';
