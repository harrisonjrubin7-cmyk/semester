-- Semester — whether a school requires campus SSO, for the entitlement order's
-- sso-policy step.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `supabase/functions/_shared/entitlement.ts` refuses at `sso-policy` when a
-- school requires campus SSO and the session did not come through it. Neither
-- half had a source on an LTI launch. This adds both.
--
-- ## The policy is the school's to set
--
-- Unlike a plan (`tenant_plan`, which only the service role writes because it
-- is what the school bought), requiring SSO is the school's own security
-- decision. So an administrator holding `tenant:configure` **in that school**
-- sets it, and nobody else's. `updated_by` is stamped from `auth.uid()` by a
-- trigger, so a row cannot claim a change somebody else made. There is no
-- delete: turning the requirement off is an update, and is kept.
--
-- ## No row means not required
--
-- Unlike a missing plan, which is "not recorded", a school with no row here
-- has made no requirement, and that is a true answer: `require_sso` is false.
--
-- ## "Came through campus SSO", on an LTI launch
--
-- The LMS authenticated the person, not Semester's campus sign-in. What the
-- policy is about is whether the Semester account the launch opens is a
-- campus-SSO account: its provider is `sso:…`, the same marker
-- `app/server/institution/auth.ts` trusts. An `lti.invalid` account the launch
-- made, or a personal account someone linked, is not one. The function returns
-- only that yes or no, never the provider or the address.

create table if not exists public.tenant_sso_policy (
  tenant_id   text        primary key references public.schools (id) on delete cascade,
  require_sso boolean     not null default false,
  reason      text        not null default '' check (length(reason) <= 1000),
  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists tenant_sso_policy_by_updater on public.tenant_sso_policy (updated_by);

alter table public.tenant_sso_policy enable row level security;
revoke all on public.tenant_sso_policy from public;
revoke all on public.tenant_sso_policy from anon, authenticated;
grant select, insert, update on public.tenant_sso_policy to authenticated;

drop policy if exists "tenant administrators and auditors read the sso policy" on public.tenant_sso_policy;
create policy "tenant administrators and auditors read the sso policy" on public.tenant_sso_policy
  for select to authenticated
  using (
    private.has_capability('tenant:configure', 'school', tenant_id)
    or private.has_capability('audit:read', 'school', tenant_id)
  );

drop policy if exists "tenant administrators set the sso policy" on public.tenant_sso_policy;
create policy "tenant administrators set the sso policy" on public.tenant_sso_policy
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

drop policy if exists "tenant administrators change the sso policy" on public.tenant_sso_policy;
create policy "tenant administrators change the sso policy" on public.tenant_sso_policy
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

-- Who changed it is who is signed in, never what the row says. The service
-- role has no auth.uid(), so its writes record null.
create or replace function private.stamp_tenant_sso_policy()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tenant_sso_policy_stamped on public.tenant_sso_policy;
create trigger tenant_sso_policy_stamped
before insert or update on public.tenant_sso_policy
for each row execute function private.stamp_tenant_sso_policy();

-- ── Every change, kept ────────────────────────────────────────────────────

create table if not exists public.tenant_sso_policy_history (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools (id) on delete cascade,
  require_sso boolean     not null,
  reason      text        not null,
  changed_by  uuid        references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists tenant_sso_policy_history_by_tenant_time
  on public.tenant_sso_policy_history (tenant_id, changed_at desc);
create index if not exists tenant_sso_policy_history_by_changer
  on public.tenant_sso_policy_history (changed_by);

alter table public.tenant_sso_policy_history enable row level security;
revoke all on public.tenant_sso_policy_history from public;
revoke all on public.tenant_sso_policy_history from anon, authenticated;
grant select on public.tenant_sso_policy_history to authenticated;

drop policy if exists "tenant auditors read sso policy history" on public.tenant_sso_policy_history;
create policy "tenant auditors read sso policy history" on public.tenant_sso_policy_history
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create or replace function private.record_tenant_sso_policy_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tenant_sso_policy_history (tenant_id, require_sso, reason, changed_by)
  values (new.tenant_id, new.require_sso, new.reason, new.updated_by);
  return new;
end $$;

create or replace function private.refuse_tenant_sso_policy_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Tenant SSO policy history is immutable.';
end $$;

revoke all on function private.stamp_tenant_sso_policy() from public, anon;
revoke all on function private.record_tenant_sso_policy_change() from public, anon, authenticated;
revoke all on function private.refuse_tenant_sso_policy_history_change() from public, anon, authenticated;

drop trigger if exists tenant_sso_policy_recorded on public.tenant_sso_policy;
create trigger tenant_sso_policy_recorded
after insert or update on public.tenant_sso_policy
for each row execute function private.record_tenant_sso_policy_change();

drop trigger if exists tenant_sso_policy_history_immutable on public.tenant_sso_policy_history;
create trigger tenant_sso_policy_history_immutable
before update or delete on public.tenant_sso_policy_history
for each row execute function private.refuse_tenant_sso_policy_history_change();

-- ── The launch's facts now include both halves ────────────────────────────
--
-- Dropped and recreated: the arguments and result type both change. The
-- launch now says who it is for (issuer and subject), because whether the
-- account is a campus-SSO one is about the person, not the school.

drop function if exists public.lti_launch_entitlement_facts(text);
-- And the three-argument form, so a second run of this file (a repair, a
-- restore rehearsal) can re-create it.
drop function if exists public.lti_launch_entitlement_facts(text, text, text);

create function public.lti_launch_entitlement_facts(want_tenant text, want_issuer text, want_subject text)
returns table (
  kill_switched boolean, module_state text, plan_status text, plan_ends_at timestamptz,
  require_sso boolean, account_sso boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select public.kill_switch_engaged('kill.integration_sync', want_tenant),
         public.feature_state('integration.lms_lti', want_tenant)::text,
         (select p.status from public.tenant_plan p where p.tenant_id = want_tenant),
         (select p.ends_at from public.tenant_plan p where p.tenant_id = want_tenant),
         coalesce((select s.require_sso from public.tenant_sso_policy s where s.tenant_id = want_tenant), false),
         exists (
           select 1
             from public.lti_identity i
             join auth.users u on u.id = i.user_id
            where i.issuer = want_issuer
              and i.subject = want_subject
              and coalesce(u.raw_app_meta_data ->> 'provider', '') like 'sso:%'
         )
$$;

revoke all on function public.lti_launch_entitlement_facts(text, text, text) from public;
revoke all on function public.lti_launch_entitlement_facts(text, text, text) from anon, authenticated;
grant execute on function public.lti_launch_entitlement_facts(text, text, text) to service_role;

comment on table public.tenant_sso_policy is
  'Whether a school requires campus SSO. Set by that school''s tenant:configure administrators; updated_by is stamped from auth.uid(). No row means not required.';
comment on table public.tenant_sso_policy_history is
  'Immutable record of every tenant_sso_policy insert and update.';
comment on function public.lti_launch_entitlement_facts(text, text, text) is
  'Service-only: kill switch, module state, plan, SSO requirement and whether the launch''s account is a campus-SSO account, for the shadow entitlement check. Reads; never writes.';
