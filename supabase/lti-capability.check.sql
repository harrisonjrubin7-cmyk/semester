-- Whether an LTI launch's account holds lti:launch at the school, as the
-- launch facts report it.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- The facts function repeats private.has_capability's rules for an account
-- other than the caller. Each rule is walked: a live grant of a role that
-- carries the capability, at exactly this school, counts; a revoked grant, an
-- expired grant, a grant at another school, a role without the capability,
-- and no grant at all do not.

begin;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.can_launch(sub text, school text default 'north-cap')
returns text language sql as $$
  select account_can_launch::text
    from public.lti_launch_entitlement_facts(school, 'https://lms.cap.test', sub)
$$;

do $$
declare
  granted uuid := pg_temp.newuser('granted@north-cap.example');
  revoked uuid := pg_temp.newuser('revoked@north-cap.example');
  expired uuid := pg_temp.newuser('expired@north-cap.example');
  elsewhere uuid := pg_temp.newuser('elsewhere@north-cap.example');
  wrong_role uuid := pg_temp.newuser('officer@north-cap.example');
  ungranted uuid := pg_temp.newuser('ungranted@north-cap.example');
begin
  insert into public.schools (id, name, email_domains) values
    ('north-cap', 'North Capability University', array['north-cap.example']),
    ('south-cap', 'South Capability College', array['south-cap.example']);

  insert into public.lti_identity (issuer, subject, user_id, origin) values
    ('https://lms.cap.test', 'sub-granted', granted, 'linked'),
    ('https://lms.cap.test', 'sub-revoked', revoked, 'linked'),
    ('https://lms.cap.test', 'sub-expired', expired, 'linked'),
    ('https://lms.cap.test', 'sub-elsewhere', elsewhere, 'linked'),
    ('https://lms.cap.test', 'sub-officer', wrong_role, 'linked'),
    ('https://lms.cap.test', 'sub-ungranted', ungranted, 'linked');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (granted, 'undergraduate_student', 'school', 'north-cap', 'institution'),
    (elsewhere, 'faculty', 'school', 'south-cap', 'institution'),
    (wrong_role, 'organization_member', 'school', 'north-cap', 'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (revoked, 'student', 'school', 'north-cap', 'institution', now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (expired, 'faculty', 'school', 'north-cap', 'institution', now() - interval '1 day');

  -- The control: a live grant of a role carrying the capability counts.
  perform pg_temp.answered('a live student grant at the school holds lti:launch', pg_temp.can_launch('sub-granted'), 'true');

  perform pg_temp.answered('a revoked grant does not', pg_temp.can_launch('sub-revoked'), 'false');
  perform pg_temp.answered('an expired grant does not', pg_temp.can_launch('sub-expired'), 'false');
  perform pg_temp.answered('a grant at another school does not', pg_temp.can_launch('sub-elsewhere'), 'false');
  perform pg_temp.answered('the same grant does at its own school', pg_temp.can_launch('sub-elsewhere', 'south-cap'), 'true');
  perform pg_temp.answered('a role without the capability does not', pg_temp.can_launch('sub-officer'), 'false');
  perform pg_temp.answered('no grant at all does not', pg_temp.can_launch('sub-ungranted'), 'false');
  perform pg_temp.answered('an unknown person does not', pg_temp.can_launch('sub-nobody'), 'false');

  -- The matrix holds it for the learner and teaching roles, and not beyond.
  perform pg_temp.answered('seven roles carry lti:launch',
    (select count(*)::text from public.role_capabilities where capability = 'lti:launch'), '7');
  perform pg_temp.answered('no administrative role carries it',
    (select count(*)::text from public.role_capabilities
      where capability = 'lti:launch' and role in ('university_admin', 'platform_admin', 'business_admin', 'employer')), '0');

  raise notice 'lti capability: every check passed';
end $$;

rollback;
