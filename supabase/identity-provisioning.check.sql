-- Institutional identity and SCIM lifecycle checks.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
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
  north_user uuid;
  cedar_user uuid;
  north_provider uuid := gen_random_uuid();
  cedar_provider uuid := gen_random_uuid();
  north_credential uuid := gen_random_uuid();
  membership uuid;
  n bigint;
  state text;
begin
  insert into public.schools (id, name, email_domains) values
    ('northstar-identity', 'Northstar Identity University', array['northstar-identity.example']),
    ('cedar-identity', 'Cedar Identity College', array['cedar-identity.example']);
  north_user := pg_temp.newuser('student@northstar-identity.example', 'northstar-identity');
  cedar_user := pg_temp.newuser('student@cedar-identity.example', 'cedar-identity');

  insert into public.institution_identity_provider
    (id, tenant_id, provider_identifier, provider_type, status, domains, authorized_at)
  values
    (north_provider, 'northstar-identity', 'sso:northstar', 'saml', 'authorized', array['northstar-identity.example'], now()),
    (cedar_provider, 'cedar-identity', 'sso:cedar', 'saml', 'authorized', array['cedar-identity.example'], now());

  insert into public.scim_credential
    (id, tenant_id, label, secret_salt, secret_hash, status)
  values
    (north_credential, 'northstar-identity', 'Primary SCIM credential',
     decode('00112233445566778899aabbccddeeff', 'hex'),
     digest(decode('00112233445566778899aabbccddeeff', 'hex') || convert_to('correct horse battery staple', 'utf8'), 'sha256'),
     'active');

  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'scim_credential'
     and column_name in ('secret', 'token', 'bearer_token', 'plaintext');
  perform pg_temp.counted('SCIM credentials have no plaintext secret column', n, 0);

  if exists (
    select 1 from public.scim_credential
     where id = north_credential and secret_hash = convert_to('correct horse battery staple', 'utf8')
  ) then
    raise exception 'FAILED: the stored SCIM hash equals the plaintext token';
  end if;
  raise notice 'ok  SCIM stores salted verification material rather than the token';

  set local role service_role;
  select private.provision_scim_user(
    'northstar-identity', north_credential, 'request-create-1', 'vu-1001',
    'student@northstar-identity.example', 'Student One', true
  ) into membership;
  reset role;

  update public.institution_membership
     set auth_user_id = north_user
   where id = membership;

  perform pg_temp.become(cedar_user);
  select count(*) into n from public.institution_membership where tenant_id = 'northstar-identity';
  reset role;
  perform pg_temp.counted('another tenant cannot read memberships', n, 0);

  perform pg_temp.become(north_user);
  select count(*) into n from public.institution_membership where id = membership and status = 'active';
  reset role;
  perform pg_temp.counted('a person can read their current institutional membership', n, 1);

  if not pg_temp.refused(format(
    'insert into public.scim_external_identity '
    '(tenant_id, membership_id, external_id, user_name, active) '
    'values (%L, %L, %L, %L, true)',
    'northstar-identity', membership, 'vu-1001', 'duplicate@northstar-identity.example'
  )) then
    raise exception 'FAILED: duplicate tenant/external identity was accepted';
  end if;
  raise notice 'ok  external identifiers are unique inside a tenant';

  insert into public.scim_group_mapping
    (tenant_id, external_group_id, display_name, roles, active)
  values ('northstar-identity', 'vanderbilt-advisors', 'Advisors', array['advisor'], true);

  set local role service_role;
  select private.replace_scim_group_members(
    'northstar-identity', north_credential, 'request-group-unknown',
    'unapproved-group', 'Unapproved group', array['vu-1001']
  ) into n;
  reset role;
  perform pg_temp.counted('an unknown SCIM group grants nothing', n, 0);

  set local role service_role;
  select private.replace_scim_group_members(
    'northstar-identity', north_credential, 'request-group-known',
    'vanderbilt-advisors', 'Advisors', array['vu-1001']
  ) into n;
  reset role;
  perform pg_temp.counted('an approved group updates one identity', n, 1);
  select roles[1] into state from public.institution_membership where id = membership;
  perform pg_temp.answered('approved group roles are derived server-side', state, 'advisor');

  set local role service_role;
  perform private.provision_scim_user(
    'northstar-identity', north_credential, 'request-deactivate-1', 'vu-1001',
    'student@northstar-identity.example', 'Student One', false
  );
  reset role;
  select status into state from public.institution_membership where id = membership;
  perform pg_temp.answered('active false deprovisions membership immediately', state, 'deprovisioned');

  if not pg_temp.refused(format(
    'update public.provisioning_audit_event set outcome = %L where tenant_id = %L',
    'rewritten', 'northstar-identity'
  )) then
    raise exception 'FAILED: provisioning audit history was mutable';
  end if;
  raise notice 'ok  provisioning audit events are immutable';

  select count(*) into n
    from pg_class c join pg_namespace nsp on nsp.oid = c.relnamespace
   where nsp.nspname = 'public'
     and c.relname in (
       'institution_identity_provider', 'institution_membership', 'scim_credential',
       'scim_external_identity', 'scim_group_mapping', 'provisioning_audit_event'
     ) and c.relrowsecurity;
  perform pg_temp.counted('every identity and provisioning table has RLS', n, 6);

  raise notice 'identity provisioning: every check passed';
end $$;

rollback;
