-- Whether a school requires campus SSO (tenant_sso_policy), its history, and
-- the launch facts that read it.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold: a school's own administrator sets its requirement and
-- nobody else's; a row cannot claim a change somebody else made; the
-- requirement is never deleted, only changed, and every change is kept; and
-- the launch facts report the requirement (false with no row) and whether the
-- launch's account is a campus-SSO one.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text, provider text default 'email')
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(),
          jsonb_build_object('provider', provider), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

do $$
declare
  north_admin uuid;
  south_admin uuid;
  student uuid;
  sso_student uuid;
  lti_student uuid;
  n bigint;
  who text;
  r record;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-sso', 'North SSO University', array['north-sso.example']),
    ('south-sso', 'South SSO College', array['south-sso.example']);
  north_admin := pg_temp.newuser('admin@north-sso.example', 'north-sso');
  south_admin := pg_temp.newuser('admin@south-sso.example', 'south-sso');
  student := pg_temp.newuser('student@north-sso.example', 'north-sso');
  sso_student := pg_temp.newuser('campus@north-sso.example', 'north-sso', 'sso:north-provider');
  lti_student := pg_temp.newuser('abc123@lti.invalid', 'north-sso');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (north_admin, 'university_admin', 'school', 'north-sso', 'institution'),
    (south_admin, 'university_admin', 'school', 'south-sso', 'institution');
  insert into public.lti_identity (issuer, subject, user_id, origin) values
    ('https://lms.sso.test', 'sub-campus', sso_student, 'linked'),
    ('https://lms.sso.test', 'sub-lti', lti_student, 'provisioned');

  -- The control: a school's administrator requires SSO for their own school.
  perform pg_temp.become(north_admin);
  insert into public.tenant_sso_policy (tenant_id, require_sso, reason) values ('north-sso', true, 'campus policy');
  reset role;
  select require_sso::text into who from public.tenant_sso_policy where tenant_id = 'north-sso';
  perform pg_temp.answered('an administrator requires SSO for their own school', who, 'true');
  select updated_by::text into who from public.tenant_sso_policy where tenant_id = 'north-sso';
  perform pg_temp.answered('and the change is stamped with who made it', who, north_admin::text);

  -- A row cannot claim a change somebody else made.
  perform pg_temp.become(north_admin);
  execute format('update public.tenant_sso_policy set reason = %L, updated_by = %L where tenant_id = %L',
                 'reworded', south_admin, 'north-sso');
  reset role;
  select updated_by::text into who from public.tenant_sso_policy where tenant_id = 'north-sso';
  perform pg_temp.answered('updated_by cannot be written to name someone else', who, north_admin::text);

  -- Nobody sets another school's policy, and a plain member sets none.
  perform pg_temp.become(north_admin);
  if not pg_temp.refused($q$insert into public.tenant_sso_policy (tenant_id, require_sso) values ('south-sso', true)$q$) then
    raise exception 'FAILED: an administrator set another school''s SSO policy';
  end if;
  reset role;
  perform pg_temp.become(student);
  if not pg_temp.refused($q$insert into public.tenant_sso_policy (tenant_id, require_sso) values ('south-sso', false)$q$) then
    raise exception 'FAILED: a student set an SSO policy';
  end if;
  update public.tenant_sso_policy set require_sso = false where tenant_id = 'north-sso';
  reset role;
  select require_sso::text into who from public.tenant_sso_policy where tenant_id = 'north-sso';
  perform pg_temp.answered('a student''s update changes nothing', who, 'true');
  raise notice 'ok  only a school''s own administrator sets its SSO policy';

  perform pg_temp.become(south_admin);
  select count(*) into n from public.tenant_sso_policy where tenant_id = 'north-sso';
  reset role;
  perform pg_temp.counted('another school''s administrator cannot read it', n, 0);

  -- Never deleted, only changed; every change kept and not rewritable.
  perform pg_temp.become(north_admin);
  if not pg_temp.refused($q$delete from public.tenant_sso_policy where tenant_id = 'north-sso'$q$) then
    raise exception 'FAILED: an SSO policy was deleted';
  end if;
  reset role;
  select count(*) into n from public.tenant_sso_policy_history where tenant_id = 'north-sso';
  perform pg_temp.counted('every change is kept in the history', n, 2);
  if not pg_temp.refused($q$update public.tenant_sso_policy_history set require_sso = false where tenant_id = 'north-sso'$q$) then
    raise exception 'FAILED: SSO policy history was rewritten';
  end if;
  raise notice 'ok  the policy is never deleted, and its history cannot be rewritten';

  -- The launch facts: the requirement, and whether the account is campus SSO.
  select * into r from public.lti_launch_entitlement_facts('north-sso', 'https://lms.sso.test', 'sub-campus');
  perform pg_temp.answered('the facts report the school''s requirement', r.require_sso::text, 'true');
  perform pg_temp.answered('a linked campus-SSO account reads as SSO', r.account_sso::text, 'true');
  select * into r from public.lti_launch_entitlement_facts('north-sso', 'https://lms.sso.test', 'sub-lti');
  perform pg_temp.answered('an lti.invalid account does not', r.account_sso::text, 'false');
  select * into r from public.lti_launch_entitlement_facts('north-sso', 'https://lms.sso.test', 'sub-nobody');
  perform pg_temp.answered('an unknown person does not', r.account_sso::text, 'false');
  select * into r from public.lti_launch_entitlement_facts('south-sso', 'https://lms.sso.test', 'sub-campus');
  perform pg_temp.answered('a school with no row does not require SSO', r.require_sso::text, 'false');

  if has_function_privilege('anon', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute') then
    raise exception 'FAILED: the entitlement facts are callable from the API';
  end if;
  raise notice 'ok  the entitlement facts are callable by the service role only';

  raise notice 'tenant sso policy: every check passed';
end $$;

rollback;
