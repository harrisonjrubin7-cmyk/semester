-- Joining an LTI launch to an institutional membership.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- `public.lti_launch_membership` answers one question per launch, and every
-- answer but `joined` names the hop that failed. Each is walked below, and two
-- controls sit among them: a membership in *another* school must not join
-- (the tenant is matched, not just the account), and nothing the function is
-- asked changes a membership (it reads and never writes).

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

create or replace function pg_temp.outcome(sub text, deployment text default 'deploy-north')
returns text language sql as $$
  select outcome from public.lti_launch_membership('https://lms.test.edu', 'client-lti', deployment, sub)
$$;

do $$
declare
  linked_user uuid := pg_temp.newuser('linked@north-lti.example');
  provisioned_user uuid := pg_temp.newuser('abc@lti.invalid');
  loner_user uuid := pg_temp.newuser('loner@north-lti.example');
  paused_user uuid := pg_temp.newuser('paused@north-lti.example');
  elsewhere_user uuid := pg_temp.newuser('elsewhere@south-lti.example');
  fresh_user uuid := pg_temp.newuser('fresh@north-lti.example');
  joined_membership uuid;
  r record;
  before_rows text;
  after_rows text;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-lti', 'North LTI University', array['north-lti.example']),
    ('south-lti', 'South LTI College', array['south-lti.example']);

  insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url, tenant_id) values
    ('https://lms.test.edu', 'client-lti', 'deploy-north', 'https://lms.test.edu/auth', 'https://lms.test.edu/jwks', 'north-lti'),
    ('https://lms.test.edu', 'client-lti', 'deploy-legacy', 'https://lms.test.edu/auth', 'https://lms.test.edu/jwks', null);

  insert into public.lti_identity (issuer, subject, user_id, origin) values
    ('https://lms.test.edu', 'sub-linked', linked_user, 'linked'),
    ('https://lms.test.edu', 'sub-provisioned', provisioned_user, 'provisioned'),
    ('https://lms.test.edu', 'sub-loner', loner_user, 'linked'),
    ('https://lms.test.edu', 'sub-paused', paused_user, 'linked'),
    ('https://lms.test.edu', 'sub-elsewhere', elsewhere_user, 'linked'),
    ('https://lms.test.edu', 'sub-fresh', fresh_user, 'linked');

  insert into public.institution_membership (tenant_id, auth_user_id, status, roles)
  values ('north-lti', linked_user, 'active', array['student', 'teaching_assistant'])
  returning id into joined_membership;
  insert into public.institution_membership (tenant_id, auth_user_id, status, roles) values
    ('north-lti', paused_user, 'suspended', array['student']),
    -- The control for tenant matching: an active membership, in the wrong school.
    ('south-lti', elsewhere_user, 'active', array['student']),
    -- As SCIM creates one: active, no roles until a group mapping grants them.
    ('north-lti', fresh_user, 'active', '{}');
  -- A provisioned account that somehow holds a membership must still not join:
  -- the identity is not linked, and that is checked before any membership is.
  insert into public.institution_membership (tenant_id, auth_user_id, status, roles)
  values ('north-lti', provisioned_user, 'active', array['student']);

  select string_agg(id || ':' || status || ':' || array_to_string(roles, ','), ';' order by id)
    into before_rows from public.institution_membership where tenant_id in ('north-lti', 'south-lti');

  select * into r from public.lti_launch_membership('https://lms.test.edu', 'client-lti', 'deploy-north', 'sub-linked');
  perform pg_temp.answered('a linked identity with an active membership joins', r.outcome, 'joined');
  perform pg_temp.answered('it joins the membership in the registration''s school', r.membership_id::text, joined_membership::text);
  perform pg_temp.answered('and carries that membership''s current roles', array_to_string(r.roles, ','), 'student,teaching_assistant');
  perform pg_temp.answered('and names the school', r.tenant_id, 'north-lti');

  perform pg_temp.answered('an unknown deployment is no registration', pg_temp.outcome('sub-linked', 'deploy-unknown'), 'no-registration');
  perform pg_temp.answered('a registration with no school is unbound', pg_temp.outcome('sub-linked', 'deploy-legacy'), 'unbound');
  perform pg_temp.answered('a subject never seen has no identity', pg_temp.outcome('sub-nobody'), 'no-identity');
  perform pg_temp.answered('a provisioned identity is not linked, membership or not', pg_temp.outcome('sub-provisioned'), 'identity-not-linked');
  perform pg_temp.answered('a linked identity with no membership', pg_temp.outcome('sub-loner'), 'no-membership');
  perform pg_temp.answered('a membership in another school does not join', pg_temp.outcome('sub-elsewhere'), 'no-membership');

  select * into r from public.lti_launch_membership('https://lms.test.edu', 'client-lti', 'deploy-north', 'sub-fresh');
  perform pg_temp.answered('an active membership with no roles yet still joins', r.outcome, 'joined');
  perform pg_temp.answered('and carries an empty role list, not a missing one', r.roles::text, '{}');

  select * into r from public.lti_launch_membership('https://lms.test.edu', 'client-lti', 'deploy-north', 'sub-paused');
  perform pg_temp.answered('a suspended membership is named, not joined', r.outcome, 'membership-suspended');
  perform pg_temp.answered('and carries no roles', coalesce(array_to_string(r.roles, ','), 'none'), 'none');

  select string_agg(id || ':' || status || ':' || array_to_string(roles, ','), ';' order by id)
    into after_rows from public.institution_membership where tenant_id in ('north-lti', 'south-lti');
  perform pg_temp.answered('asking changed no membership', md5(after_rows), md5(before_rows));

  if has_function_privilege('anon', 'public.lti_launch_membership(text, text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.lti_launch_membership(text, text, text, text)', 'execute') then
    raise exception 'FAILED: the join is callable from the API';
  end if;
  raise notice 'ok  the join is callable by the service role only';

  -- ── The facts the shadow entitlement check reads ──────────────────────
  -- The control first: a school with nothing set reads as not switched off
  -- and module off, which is what an unconfigured school is.
  select * into r from public.lti_launch_entitlement_facts('north-lti', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('an unconfigured school: no kill switch', r.kill_switched::text, 'false');
  perform pg_temp.answered('an unconfigured school: module off', r.module_state, 'off');

  insert into public.tenant_feature_policy (tenant_id, capability, state)
  values ('north-lti', 'integration.lms_lti', 'production');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('north-lti', 'kill.integration_sync', true, 'check', now());
  select * into r from public.lti_launch_entitlement_facts('north-lti', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('the school''s LTI module state is read', r.module_state, 'production');
  perform pg_temp.answered('the school''s own kill switch is read', r.kill_switched::text, 'true');

  -- Another school's switch is not this school's.
  select * into r from public.lti_launch_entitlement_facts('south-lti', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('another school''s kill switch does not reach it', r.kill_switched::text, 'false');

  if has_function_privilege('anon', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute') then
    raise exception 'FAILED: the entitlement facts are callable from the API';
  end if;
  raise notice 'ok  the entitlement facts are callable by the service role only';

  raise notice 'lti membership: every check passed';
end $$;

rollback;
