-- Tenant/pilot operations workspace (20261005121000).
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
  live_operator uuid := pg_temp.newuser('live@tenant-operations.example');
  demo_operator uuid := pg_temp.newuser('demo@tenant-operations.example');
  school_only uuid := pg_temp.newuser('school-only@tenant-operations.example');
  shell_only uuid := pg_temp.newuser('shell-only@tenant-operations.example');
  expired uuid := pg_temp.newuser('expired@tenant-operations.example');
  stranger uuid := pg_temp.newuser('stranger@tenant-operations.example');
  account uuid := gen_random_uuid();
  pilot uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('ops-live', 'Operations Live University', array['ops-live.example'], false),
    ('ops-other', 'Operations Other University', array['ops-other.example'], false),
    ('ops-demo', 'Operations Demo University', array['ops-demo.example'], true);

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, granted_at, expires_at)
  values
    (live_operator, 'implementation_manager', 'platform', '', 'platform', now() - interval '1 day', null),
    (live_operator, 'implementation_manager', 'school', 'ops-live', 'platform', now() - interval '1 day', null),
    (demo_operator, 'implementation_manager', 'platform', '', 'platform', now() - interval '1 day', null),
    (demo_operator, 'implementation_manager', 'school', 'ops-demo', 'platform', now() - interval '1 day', null),
    (school_only, 'implementation_manager', 'school', 'ops-live', 'platform', now() - interval '1 day', null),
    (shell_only, 'implementation_manager', 'platform', '', 'platform', now() - interval '1 day', null),
    (expired, 'implementation_manager', 'platform', '', 'platform', now() - interval '2 days', null),
    (expired, 'implementation_manager', 'school', 'ops-other', 'platform', now() - interval '2 days', now() - interval '1 day');

  insert into public.tenant_rollout (tenant_id, state, updated_at)
  values ('ops-live', 'requested', now() - interval '1 day');
  insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by, recorded_at)
  values ('ops-live', 'uat_signoff', 'synthetic-check', 'Synthetic approver', now() - interval '1 day');
  insert into public.tenant_plan (tenant_id, tier, status, ends_at, updated_at)
  values ('ops-live', 'pilot', 'trial', now() + interval '90 days', now() - interval '1 day');

  insert into public.gtm_accounts (id, name, segment, tenant_id, status, owner_id)
  values (account, 'Operations Live', 'research', 'ops-live', 'pilot', live_operator);
  insert into public.gtm_pilots
    (id, account_id, workflow, start_date, end_date, status, updated_at)
  values (pilot, account, 'Synthetic registration workflow', current_date,
          current_date + 60, 'proposed', now() - interval '1 day');

  insert into public.customer (id, tenant_id, legal_name, status, owner_seat, updated_at)
  values (customer_id, 'ops-live', 'Operations Live University', 'pilot', 'success', now() - interval '1 day');
  insert into public.customer_contract (customer_id, kind, signed_on, starts_on, ends_on)
  values (customer_id, 'pilot-agreement', current_date, current_date, current_date + 90);

  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, updated_at)
  values ('ops-live', 'lms', 'Synthetic LMS', 'Synthetic read connection', 'configuring', now() - interval '1 day');

  insert into ids values
    ('live_operator', live_operator), ('demo_operator', demo_operator),
    ('school_only', school_only), ('shell_only', shell_only),
    ('expired', expired), ('stranger', stranger);
end $$;

grant select on table ids to authenticated;

do $$
begin
  if not pg_temp.refused((select v from ids where k = 'stranger'),
      $q$select * from public.console_tenant_operations()$q$) then
    raise exception 'FAILED: a caller with no grants reached tenant operations';
  end if;
  raise notice 'ok  a caller with no grants is refused';

  if not pg_temp.refused((select v from ids where k = 'school_only'),
      $q$select * from public.console_tenant_operations()$q$) then
    raise exception 'FAILED: a school grant without console shell access reached tenant operations';
  end if;
  raise notice 'ok  a school grant without platform console access is refused';
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'shell_only'));
  select count(*) into n from public.console_tenant_operations();
  perform pg_temp.counted('console shell access alone returns no tenant facts', n, 0);
  perform pg_temp.nobody();

  perform pg_temp.become((select v from ids where k = 'expired'));
  select count(*) into n from public.console_tenant_operations();
  perform pg_temp.counted('an expired tenant grant returns no tenant facts', n, 0);
  perform pg_temp.nobody();

  perform pg_temp.become((select v from ids where k = 'live_operator'));
  select count(*) into n from public.console_tenant_operations();
  perform pg_temp.counted('one exact tenant grant returns the eight allowed fact classes', n, 8);

  select count(*) into n from public.console_tenant_operations()
   where tenant_id <> 'ops-live' or is_demo;
  perform pg_temp.counted('the response cannot cross into another or demo tenant', n, 0);

  select count(*) into n from public.console_tenant_operations()
   where fact_key in ('rollout', 'pilot', 'entitlement', 'contract', 'integration', 'support', 'readiness')
     and value <> '' and provenance <> '' and owner <> '' and classification <> ''
     and visibility_reason like 'Live tenant:implement%';
  perform pg_temp.counted('every operational domain carries provenance, owner, classification and visibility basis', n, 7);

  select count(*) into n from public.console_tenant_operations()
   where fact_key = 'support' and value = '0 active scoped grant(s)';
  perform pg_temp.counted('support is an aggregate grant-state fact without student content', n, 1);
  perform pg_temp.nobody();
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'demo_operator'));
  select count(*) into n from public.console_tenant_operations(false);
  perform pg_temp.counted('demo tenants are excluded by default', n, 0);

  select count(*) into n from public.console_tenant_operations(true)
   where tenant_id = 'ops-demo' and is_demo;
  perform pg_temp.counted('an explicitly requested, exactly granted demo tenant is visible', n, 8);
  perform pg_temp.nobody();
end $$;

do $$
declare n bigint;
declare body text;
begin
  select count(*), pg_get_functiondef(p.oid)
    into n, body
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'console_tenant_operations'
     and p.prosecdef and p.provolatile = 's'
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c)
   group by p.oid;
  perform pg_temp.counted('the RPC is stable, definer and search-path pinned', n, 1);

  if body ~* 'support_tickets|student_id|consent_id|consent_record|support_access_event' then
    raise exception 'FAILED: the tenant operations RPC references student or ticket content';
  end if;
  raise notice 'ok  the function definition contains no student or ticket-content read';

  if has_function_privilege('anon', 'public.console_tenant_operations(boolean)', 'execute') then
    raise exception 'FAILED: anon can execute tenant operations';
  end if;
  raise notice 'ok  anon cannot execute tenant operations';

  if not has_function_privilege('authenticated', 'public.console_tenant_operations(boolean)', 'execute') then
    raise exception 'FAILED: authenticated cannot reach the guarded tenant operations RPC';
  end if;
  raise notice 'ok  authenticated can reach the guarded tenant operations RPC';
end $$;

rollback;


-- The same tenant-derived console authority must protect the shared operations
-- inbox. Kept in this suite so the red contract does not create a second queue
-- or a second tenant-operations evidence family.
begin;

do $$
begin
  if to_regprocedure('public.ops_operations_inbox(uuid,boolean)') is null then
    raise exception 'FAILED: the durable operations inbox RPC does not exist';
  end if;
  if to_regprocedure('public.ops_transition_work_item(uuid,text,bigint,text,text,text,text)') is null then
    raise exception 'FAILED: the atomic work-item transition RPC does not exist';
  end if;
  if to_regprocedure('private.open_work_item(text,text,text,text,text,text,text,text,text)') is null then
    raise exception 'FAILED: the service-only work-item producer does not exist';
  end if;
end $$;

rollback;
