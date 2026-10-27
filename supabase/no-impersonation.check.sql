-- No staff account gets a hidden "become this student" path.
--
-- company-roles-student-data.check.sql covers direct table reads. This suite
-- covers authenticated-callable functions that accept somebody else's account
-- id. Legitimate cross-subject workflows remain explicit and inventoried; a
-- new one cannot quietly become impersonation.
--
-- Run: supabase/check.sh no-impersonation

begin;

create or replace function pg_temp.answered(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create temporary table expected_cross_subject_function (
  signature text primary key,
  boundary text not null
);

insert into expected_cross_subject_function (signature, boundary) values
  ('private.action_reaches_me(want_kind text, want_tenant text, want_student uuid, want_cohort text, want_program text, want_eligibility text)', 'self-scoped action projection'),
  ('private.can_read_billing(want_account uuid)', 'billing capability'),
  ('private.can_read_delivery(want_account uuid)', 'commercial staff or tenant capability'),
  ('private.capture_consent_is_active(want_capture uuid, want_tenant text, want_person uuid)', 'active consent predicate'),
  ('private.gtm_account_visible(want_account uuid)', 'GTM capability'),
  ('private.mentors(want_student uuid)', 'self or school-scoped mentor grant'),
  ('private.subject_has_capability(want_subject uuid, want_capability text, want_scope_kind text, want_scope_id text)', 'role-grant predicate'),
  ('private.support_consent_active(want_consent uuid, want_tenant text, want_student uuid)', 'student support consent predicate'),
  ('public.console_tenant_access(want_tenant text, want_subject uuid, after_granted_at timestamp with time zone, after_id uuid, want_limit integer, include_demo boolean)', 'operator capability and exact-scope grant'),
  ('public.gradebook_enter(want_item uuid, want_student uuid, want_score numeric, want_mark text, want_comment text, want_reason text, want_key text)', 'course-scoped grading capability'),
  ('public.gradebook_moderate(want_item uuid, want_student uuid, want_key text)', 'course-scoped moderation capability'),
  ('public.read_guardian_calendar_projection(wanted_student uuid, wanted_purpose text)', 'accepted family grant'),
  ('public.registrar_grant_override(want_student uuid, want_section uuid, want_waives text[], want_reason text, want_key text)', 'school-scoped registrar capability'),
  ('public.roster_admin_bind(want_tenant text, want_sourced_id text, want_subject uuid, want_key text)', 'school-scoped roster administration capability');

do $$
declare
  n bigint;
  actual text;
  expected text;
begin
  -- Account erasure temporarily assumes its target inside a private,
  -- service-role-only function so existing cascades run, then restores the
  -- claims. It is the only identity-changing implementation in the schema.
  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('public', 'private')
     and p.prokind in ('f', 'p')
     and pg_get_functiondef(p.oid) ~* $rx$set_config[[:space:]]*\([[:space:]]*'request\.jwt\.claim$rx$;
  perform pg_temp.answered('only the private erasure implementation changes JWT identity', n, 1);

  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('public', 'private')
     and p.prokind in ('f', 'p')
     and pg_get_functiondef(p.oid) ~* $rx$set_config[[:space:]]*\([[:space:]]*'request\.jwt\.claim$rx$
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));
  perform pg_temp.answered('no client role can execute an identity-changing function', n, 0);

  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('public', 'private')
     and p.prokind in ('f', 'p')
     and p.proname ~* '(impersonat|assume_(user|account)|act_as|become_(user|account)|login_as)';
  perform pg_temp.answered('no function advertises an impersonation operation', n, 0);

  with callable as (
    select ns.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
           pg_get_functiondef(p.oid) as body
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname in ('public', 'private')
       and p.prokind in ('f', 'p')
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
       and pg_get_function_identity_arguments(p.oid)
             ~* '(user|student|person|subject|owner|account|requester)[^,]*uuid'
  )
  select coalesce(string_agg(signature, E'\n' order by signature), '') into actual from callable;

  select coalesce(string_agg(signature, E'\n' order by signature), '') into expected
    from expected_cross_subject_function;

  if actual <> expected then
    raise exception 'FAILED: authenticated cross-subject function inventory changed. Expected:% Actual:%',
      E'\n' || expected, E'\n' || actual;
  end if;
  raise notice 'ok  every authenticated cross-subject definer is explicitly inventoried (%)',
    (select count(*) from expected_cross_subject_function);

  -- The owning suites prove each boundary's behavior. This catches a listed
  -- function being replaced with an unguarded body before review.
  with callable as (
    select pg_get_functiondef(p.oid) as body
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname in ('public', 'private')
       and p.prokind in ('f', 'p')
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
       and pg_get_function_identity_arguments(p.oid)
             ~* '(user|student|person|subject|owner|account|requester)[^,]*uuid'
  )
  select count(*) into n
    from callable
   where body !~* '(auth\.uid\(\)|has_capability|role_grants|consent_record|support_consent|family_grants|subject_has_capability|gradebook_require|registration_registrar|roster_admin_require|commercial_staff)';
  perform pg_temp.answered('every inventoried cross-subject function retains an authorization boundary', n, 0);
end $$;

rollback;
