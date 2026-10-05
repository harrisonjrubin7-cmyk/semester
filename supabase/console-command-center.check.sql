-- Live command-center read model (20260930180000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare operator uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('command-live', 'Command Live University', array['command-live.example'], false),
    ('command-demo', 'Command Demo University', array['command-demo.example'], true);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@command-live.example', now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@command-live.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
    values (operator, 'platform_admin', 'platform', '', 'platform');
  insert into ids values ('operator', operator), ('stranger', stranger);

  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, authentication_type, sync_mode)
  values
    ('command-live', 'lms', 'Live LMS', 'Live LMS', 'error', 'none', 'manual'),
    ('command-demo', 'lms', 'Demo LMS', 'Demo LMS', 'error', 'none', 'manual');
end $$;

do $$
declare denied boolean := false;
begin
  perform pg_temp.become((select v from ids where k = 'stranger'));
  begin
    perform * from public.console_command_center(false);
  exception when insufficient_privilege then denied := true;
  end;
  perform pg_temp.nobody();
  if not denied then raise exception 'FAILED: a non-operator read the command center'; end if;
  raise notice 'ok  a non-operator is refused';
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'operator'));
  select count(*) into n from public.console_command_center(false) where category = 'release gate';
  perform pg_temp.counted('missing platform proof is red, not silently green', n, 6);
  select count(*) into n from public.console_command_center(false) where category = 'integration';
  perform pg_temp.counted('the live integration exception is visible', n, 1);
  select count(*) into n from public.console_command_center(false) where tenant_id = 'command-demo';
  perform pg_temp.counted('demo tenants are absent by default', n, 0);
  select count(*) into n from public.console_command_center(true) where tenant_id = 'command-demo';
  perform pg_temp.counted('demo tenants appear only when requested', n, 1);
  perform pg_temp.nobody();
end $$;

insert into public.platform_release_evidence (gate, status, approved_by, evidence, observed_at)
select gate, 'pass', 'Named approver', 'evidence://command-center-check/' || gate, now()
from unnest(array[
  'production_restore', 'legal_approval', 'paid_infrastructure',
  'production_deployment', 'domain_tls', 'production_migrations'
]) gate;

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'operator'));
  select count(*) into n from public.console_command_center(false) where category = 'release gate';
  perform pg_temp.counted('current passing evidence clears only its release gates', n, 0);
  perform pg_temp.nobody();
end $$;

rollback;
