-- Graduation scenario drafts are a person's work.
--
-- Phase D of the feature expansion lets a signed-in student save a graduation
-- scenario draft to their account, in public.graduation_scenarios (created by
-- 20260926150000_expansion_roles_and_features.sql, behind the
-- graduation_simulator flag in the app). An LTI-provisioned account holding
-- such a draft is not empty, so account linking must not retire it.
--
-- This is the complete latest definition, not a delta — CREATE OR REPLACE
-- replaces the whole body — and it is the previous one
-- (20260925103000_support_access.sql) with one row added.
-- app/src/lib/ltiaccount.test.ts reads this file and holds it against
-- OWNED_TABLES in app/src/lib/cloud.ts.
--
-- Additive and safe to re-run. It changes no table and no data.
create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.graduation_scenarios', 'user_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;
