-- Semester Intelligence tenant policy: real school-scoped grants are the
-- boundary. Client claims, profile choices and feature flags are not grants.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid, extra jsonb default '{}'::jsonb)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    (jsonb_build_object('sub', who::text, 'role', 'authenticated') || extra)::text,
    true
  );
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  northstar_admin   uuid;
  northstar_student uuid;
  cedar_user        uuid;
  n                 bigint;
  state             text;
  policy_row        public.ai_policy;
begin
  insert into public.schools (id, name, email_domains) values
    ('northstar-check', 'Northstar Check University', array['northstar-check.example']),
    ('cedar-check', 'Cedar Check College', array['cedar-check.example']);

  northstar_admin := pg_temp.newuser('admin@northstar-check.example', 'northstar-check');
  northstar_student := pg_temp.newuser('student@northstar-check.example', 'northstar-check');
  cedar_user := pg_temp.newuser('student@cedar-check.example', 'cedar-check');

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance)
  values
    (northstar_admin, 'university_admin', 'school', 'northstar-check', 'institution');

  perform pg_temp.become(northstar_admin);
  insert into public.tenant_feature_policy
    (tenant_id, capability, state, permitted_roles, updated_by)
  values
    ('northstar-check', 'semester_intelligence', 'sandbox', array['student'], northstar_admin);
  insert into public.ai_policy
    (tenant_id, allowed_modes, allowed_providers, default_provider,
     web_sources_allowed, monthly_budget_cents, updated_by)
  values
    ('northstar-check', array['explain', 'hint', 'practice', 'review'],
     array['institution'], 'institution', false, 25000, northstar_admin);
  insert into public.approved_source
    (tenant_id, course_id, title, origin, authority, created_by)
  values
    ('northstar-check', 'econ', 'ECON 101 syllabus', 'course',
     'authoritative', northstar_admin);
  reset role;

  perform pg_temp.become(northstar_student);
  select public.feature_state('semester_intelligence', 'northstar-check')::text into state;
  perform pg_temp.answered('same-tenant policy resolves through the read helper', state, 'sandbox');
  select * into policy_row
    from public.effective_ai_policy('northstar-check', northstar_student);
  perform pg_temp.answered('the effective policy preserves the default provider',
                           policy_row.default_provider, 'institution');
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by)
  values
    ('northstar-check', northstar_student, 'lecture_capture', 'consented',
     '2026-09-23', northstar_student);
  reset role;

  perform pg_temp.become(cedar_user);
  select count(*) into n
    from public.tenant_feature_policy where tenant_id = 'northstar-check';
  reset role;
  perform pg_temp.counted('another tenant cannot read policy', n, 0);

  perform pg_temp.become(cedar_user, '{"semester_intelligence":"production"}'::jsonb);
  select count(*) into n
    from public.tenant_feature_policy where tenant_id = 'northstar-check';
  reset role;
  perform pg_temp.counted('a client-provided production flag grants no row access', n, 0);

  if not pg_temp.refused(
    northstar_student,
    format(
      'insert into public.approved_source '
      '(tenant_id, course_id, title, origin, authority, created_by) '
      'values (%L, %L, %L, %L, %L, %L)',
      'northstar-check', 'econ', 'Counterfeit syllabus',
      'course', 'authoritative', northstar_student
    )
  ) then
    raise exception 'FAILED: a student made a source authoritative';
  end if;
  raise notice 'ok  a student cannot approve an authoritative source';

  perform pg_temp.become(cedar_user);
  update public.tenant_feature_policy
     set state = 'production'
   where tenant_id = 'northstar-check' and capability = 'semester_intelligence';
  reset role;
  select count(*) into n
    from public.tenant_feature_policy p
   where p.tenant_id = 'northstar-check'
     and p.capability = 'semester_intelligence'
     and p.state = 'sandbox';
  perform pg_temp.counted('another tenant cannot change policy', n, 1);

  perform pg_temp.become(northstar_admin);
  update public.tenant_feature_policy
     set state = 'production'
   where tenant_id = 'northstar-check' and capability = 'semester_intelligence';
  reset role;

  select count(*) into n
    from public.tenant_policy_audit_event
   where tenant_id = 'northstar-check'
     and entity_type = 'tenant_feature_policy'
     and action in ('insert', 'update')
     and actor_id = northstar_admin
     and actor_grant_id is not null;
  perform pg_temp.counted('policy writes preserve actor and verified grant evidence', n, 2);

  perform pg_temp.become(northstar_student);
  select count(*) into n from public.tenant_policy_audit_event;
  reset role;
  perform pg_temp.counted('students cannot read institutional audit events', n, 0);

  raise notice 'intelligence policy: every check passed';
end $$;

rollback;
