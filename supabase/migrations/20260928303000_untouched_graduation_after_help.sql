-- Graduation scenario drafts are a person's work, restated after help requests.
--
-- 20260928300000_untouched_graduation_drafts.sql added
-- `public.graduation_scenarios` to `lti_account_untouched` (Phase D, D-025).
-- 20260927230000_help_requests.sql then redefined the function from the
-- definition before that, adding `help_requests`. Migrations apply in version
-- order, so without this file the later definition wins and a saved
-- graduation draft stops counting: an LTI account holding one would read as
-- empty and could be retired.
--
-- This is the complete latest definition — CREATE OR REPLACE replaces the
-- whole body — and it is 20260927230000's with the graduation row added.
-- `app/src/lib/ltiaccount.test.ts` reads whichever migration defines the
-- function last and holds it against OWNED_TABLES.
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
      ('public.help_requests',        'student_id'),
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
