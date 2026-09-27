-- Semester — the facts the entitlement order can read today, for one school's
-- LTI launch.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `supabase/functions/_shared/entitlement.ts` decides in twelve steps. For an
-- LTI launch, two of them have a source in the database, and this returns
-- exactly those two, for the school the launch's registration names:
--
--   kill_switched  `kill.integration_sync`, platform-wide or this school's
--                  (20260927170000_integration_control_plane.sql). It is the
--                  switch every other LTI path already obeys; there is no
--                  launch-specific one, and inventing one here would be a
--                  switch nobody knows to throw.
--   module_state   `feature_state('integration.lms_lti', school)`, the flag
--                  grade passback and context recording already read.
--
-- The launch runs the order in **shadow**: it logs what it would decide and
-- refuses nothing new (docs/ENTITLEMENT-RESOLUTION.md). So this reads and
-- never writes, and returns no row about a person.

create or replace function public.lti_launch_entitlement_facts(want_tenant text)
returns table (kill_switched boolean, module_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select public.kill_switch_engaged('kill.integration_sync', want_tenant),
         public.feature_state('integration.lms_lti', want_tenant)::text
$$;

-- Both spellings, for the reason 20260921160000_lti.sql gives at length.
revoke all on function public.lti_launch_entitlement_facts(text) from public;
revoke all on function public.lti_launch_entitlement_facts(text) from anon, authenticated;
grant execute on function public.lti_launch_entitlement_facts(text) to service_role;

comment on function public.lti_launch_entitlement_facts(text) is
  'Service-only: the LTI kill switch and module state for one school, for the launch''s shadow entitlement check. Reads; never writes.';
