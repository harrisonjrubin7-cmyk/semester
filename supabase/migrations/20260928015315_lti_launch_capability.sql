-- Semester — the capability an LTI launch requires, for the entitlement
-- order's capability step.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `supabase/functions/_shared/entitlement.ts` refuses at `capability` unless
-- the person holds the capability the action requires. No capability existed
-- for opening Semester from an LMS, and the launch had no way to ask whether
-- somebody held one. This adds both, using the capability system as it is:
-- `role_grants` (who holds which app role over which scope) joined to
-- `role_capabilities` (what each role may do). Nothing new decides roles.
--
-- ## Who holds it
--
-- The learner and teaching roles: student, undergraduate, graduate and
-- transfer student, faculty, teaching assistant, tutor. Not organisation,
-- employer or administrative roles: opening a course link is what someone in
-- a course does.
--
-- ## Read for the launch's account, not the caller
--
-- `private.has_capability` asks about `auth.uid()`, and a launch runs as the
-- service role, which has none. So the facts function asks the same question,
-- with the same rules (a live grant: not revoked, not expired, at exactly the
-- school's scope), about the account the launch opens. It returns only yes or
-- no.
--
-- ## What shadow will show
--
-- SCIM writes memberships, not grants, so until a school issues grants most
-- launches will log "would refuse at capability". That is an accurate reading
-- of today's data, and the point of shadow is to show it before anything
-- enforces it (docs/ENTITLEMENT-RESOLUTION.md).

insert into public.app_capabilities (capability, about) values
  ('lti:launch', 'Open Semester from a course link in the school''s LMS (LTI 1.3).')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('student',               'lti:launch'),
  ('undergraduate_student', 'lti:launch'),
  ('graduate_student',      'lti:launch'),
  ('transfer_student',      'lti:launch'),
  ('faculty',               'lti:launch'),
  ('teaching_assistant',    'lti:launch'),
  ('tutor',                 'lti:launch')
on conflict (role, capability) do nothing;

-- ── The launch's facts now include the capability ─────────────────────────
--
-- Dropped and recreated: the result type changes.

drop function if exists public.lti_launch_entitlement_facts(text, text, text);

create function public.lti_launch_entitlement_facts(want_tenant text, want_issuer text, want_subject text)
returns table (
  kill_switched boolean, module_state text, plan_status text, plan_ends_at timestamptz,
  require_sso boolean, account_sso boolean, account_can_launch boolean
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
         ),
         -- private.has_capability's rules, for the launch's account.
         exists (
           select 1
             from public.lti_identity i
             join public.role_grants g on g.subject = i.user_id
             join public.role_capabilities rc on rc.role = g.role
            where i.issuer = want_issuer
              and i.subject = want_subject
              and rc.capability = 'lti:launch'
              and g.scope_kind = 'school'
              and g.scope_id = want_tenant
              and g.revoked_at is null
              and (g.expires_at is null or g.expires_at > now())
         )
$$;

revoke all on function public.lti_launch_entitlement_facts(text, text, text) from public;
revoke all on function public.lti_launch_entitlement_facts(text, text, text) from anon, authenticated;
grant execute on function public.lti_launch_entitlement_facts(text, text, text) to service_role;

comment on function public.lti_launch_entitlement_facts(text, text, text) is
  'Service-only: kill switch, module state, plan, SSO requirement, whether the launch''s account is campus SSO, and whether it holds a live lti:launch grant at the school, for the shadow entitlement check. Reads; never writes.';
