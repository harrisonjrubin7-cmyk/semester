-- Scoped Operations Console read template (20261005120000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
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

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  perform pg_temp.nobody();
  return false;
exception when insufficient_privilege then
  perform pg_temp.nobody();
  return true;
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare
  platform_operator uuid := pg_temp.newuser('platform@scoped-read.example');
  tenant_operator uuid := pg_temp.newuser('tenant@scoped-read.example');
  expired_operator uuid := pg_temp.newuser('expired@scoped-read.example');
  sandbox_operator uuid := pg_temp.newuser('sandbox@scoped-read.example');
  stranger uuid := pg_temp.newuser('stranger@scoped-read.example');
  live_subject uuid := pg_temp.newuser('live-subject@scoped-read.example');
  other_subject uuid := pg_temp.newuser('other-subject@scoped-read.example');
  demo_subject uuid := pg_temp.newuser('demo-subject@scoped-read.example');
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('scoped-live', 'Scoped Live University', array['scoped-live.example'], false),
    ('scoped-other', 'Scoped Other University', array['scoped-other.example'], false),
    ('scoped-demo', 'Scoped Demo University', array['scoped-demo.example'], true);

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, granted_at, expires_at)
  values
    (platform_operator, 'platform_admin', 'platform', '', 'platform', now() - interval '1 day', null),
    (tenant_operator, 'university_admin', 'school', 'scoped-live', 'institution', now() - interval '1 day', null),
    (expired_operator, 'university_admin', 'school', 'scoped-live', 'institution', now() - interval '2 days', now() - interval '1 day'),
    (sandbox_operator, 'implementation_manager', 'school', 'scoped-demo', 'platform', now() - interval '1 day', null),
    (live_subject, 'faculty', 'course', 'scoped-live/ECON 1010', 'institution', now() - interval '1 hour', null),
    (live_subject, 'academic_advisor', 'school', 'scoped-live', 'institution', now() - interval '2 hours', null),
    (other_subject, 'faculty', 'course', 'scoped-other/ECON 1010', 'institution', now() - interval '1 hour', null),
    (demo_subject, 'faculty', 'course', 'scoped-demo/ECON 1010', 'institution', now() - interval '1 hour', null);

  insert into ids values
    ('platform_operator', platform_operator), ('tenant_operator', tenant_operator),
    ('expired_operator', expired_operator), ('sandbox_operator', sandbox_operator),
    ('stranger', stranger), ('live_subject', live_subject),
    ('other_subject', other_subject), ('demo_subject', demo_subject);
end $$;

grant select on table ids to authenticated;

do $$
begin
  if not pg_temp.refused((select v from ids where k = 'stranger'),
      $q$select * from public.console_tenant_access('scoped-live')$q$) then
    raise exception 'FAILED: a caller with no grant read a tenant inventory';
  end if;
  raise notice 'ok  a caller with no grant is refused';

  if not pg_temp.refused((select v from ids where k = 'tenant_operator'),
      $q$select * from public.console_tenant_access('scoped-other')$q$) then
    raise exception 'FAILED: a tenant operator widened access by changing want_tenant';
  end if;
  raise notice 'ok  changing want_tenant cannot widen a tenant-scoped grant';

  if not pg_temp.refused((select v from ids where k = 'expired_operator'),
      $q$select * from public.console_tenant_access('scoped-live')$q$) then
    raise exception 'FAILED: an expired grant authorized the read';
  end if;
  raise notice 'ok  an expired caller grant is refused';
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'tenant_operator'));
  select count(*) into n from public.console_tenant_access('scoped-live');
  perform pg_temp.counted('a valid tenant auditor sees only that tenant''s grants', n, 4);

  select count(*) into n
    from public.console_tenant_access(
      'scoped-live', (select v from ids where k = 'other_subject'));
  perform pg_temp.counted('changing want_subject cannot reach an account only granted elsewhere', n, 0);

  select count(*) into n
    from public.console_tenant_access(
      'scoped-live', (select v from ids where k = 'live_subject'));
  perform pg_temp.counted('an account filter narrows inside the authorized tenant', n, 2);
  perform pg_temp.nobody();
end $$;

do $$
declare
  n bigint;
  cursor_at timestamptz;
  cursor_id uuid;
begin
  perform pg_temp.become((select v from ids where k = 'platform_operator'));
  select granted_at, grant_id
    into cursor_at, cursor_id
    from public.console_tenant_access(
      'scoped-live', (select v from ids where k = 'live_subject'), null, null, 1, false);
  get diagnostics n = row_count;
  perform pg_temp.counted('the page size is bounded by want_limit', n, 1);

  select count(*) into n
    from public.console_tenant_access(
      'scoped-live', (select v from ids where k = 'live_subject'), cursor_at, cursor_id, 1, false);
  perform pg_temp.counted('the keyset cursor returns the next grant once', n, 1);

  select count(*) into n
    from public.console_tenant_access('scoped-demo', null, null, null, 50, false);
  perform pg_temp.counted('demo data is excluded by default', n, 0);
  perform pg_temp.nobody();

  if not pg_temp.refused((select v from ids where k = 'platform_operator'),
      $q$select * from public.console_tenant_access('scoped-demo', null, null, null, 50, true)$q$) then
    raise exception 'FAILED: a production operator opted into demo data without the sandbox capability';
  end if;
  raise notice 'ok  production console access alone cannot opt into demo data';

  perform pg_temp.become((select v from ids where k = 'sandbox_operator'));
  select count(*) into n
    from public.console_tenant_access('scoped-demo', null, null, null, 50, true);
  perform pg_temp.counted('tenant:implement over the demo tenant permits the explicit sandbox read', n, 2);
  perform pg_temp.nobody();
end $$;

do $$
declare n bigint;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'console_tenant_access'
     and p.prosecdef and p.provolatile = 's'
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c);
  perform pg_temp.counted('the RPC is stable, definer and search-path pinned', n, 1);

  if has_function_privilege('anon',
      'public.console_tenant_access(text, uuid, timestamptz, uuid, integer, boolean)', 'execute') then
    raise exception 'FAILED: anon can execute the scoped tenant read';
  end if;
  raise notice 'ok  anon cannot execute the scoped tenant read';

  if not has_function_privilege('authenticated',
      'public.console_tenant_access(text, uuid, timestamptz, uuid, integer, boolean)', 'execute') then
    raise exception 'FAILED: authenticated cannot reach the guarded scoped tenant read';
  end if;
  raise notice 'ok  authenticated can reach the guarded scoped tenant read';
end $$;

rollback;
