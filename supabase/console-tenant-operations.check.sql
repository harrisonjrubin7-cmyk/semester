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

-- Shared operations work items (20261010030720).
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

create or replace function pg_temp.refused(who uuid, statement text, wanted text default '42501')
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  perform pg_temp.nobody();
  return false;
exception when others then
  perform pg_temp.nobody();
  return sqlstate = wanted;
end $$;

create temp table ids (k text primary key, v uuid not null);
create temp table work (k text primary key, v uuid not null);
grant select on table ids, work to authenticated;

do $$
declare
  operator_a uuid := pg_temp.newuser('operator-a@work-items.example');
  operator_b uuid := pg_temp.newuser('operator-b@work-items.example');
  operator_a_peer uuid := pg_temp.newuser('operator-a-peer@work-items.example');
  shell_only uuid := pg_temp.newuser('shell-only@work-items.example');
  school_only uuid := pg_temp.newuser('school-only@work-items.example');
  stranger uuid := pg_temp.newuser('stranger@work-items.example');
  made uuid;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('work-a', 'Work Item A', array['work-a.example'], false),
    ('work-b', 'Work Item B', array['work-b.example'], false);

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, granted_at)
  values
    (operator_a, 'implementation_manager', 'platform', '', 'platform', now()),
    (operator_a, 'implementation_manager', 'school', 'work-a', 'platform', now()),
    (operator_b, 'implementation_manager', 'platform', '', 'platform', now()),
    (operator_b, 'implementation_manager', 'school', 'work-b', 'platform', now()),
    (operator_a_peer, 'implementation_manager', 'platform', '', 'platform', now()),
    (operator_a_peer, 'implementation_manager', 'school', 'work-a', 'platform', now()),
    (shell_only, 'implementation_manager', 'platform', '', 'platform', now()),
    (school_only, 'implementation_manager', 'school', 'work-a', 'platform', now());

  insert into ids values
    ('operator_a', operator_a), ('operator_b', operator_b),
    ('operator_a_peer', operator_a_peer), ('shell_only', shell_only), ('school_only', school_only), ('stranger', stranger);

  set local role service_role;
  made := private.open_work_item(
    'work-a', 'registration_readiness.referral', 'registration_readiness', 'evaluation-a',
    'registration-readiness-task:task-a',
    'Resolve an authoritative-data mismatch before registration.',
    'high', 'tenant:implement', 'work-items:test:a'
  );
  insert into work values ('a', made);

  made := private.open_work_item(
    'work-b', 'registration_readiness.referral', 'registration_readiness', 'evaluation-b',
    'registration-readiness-task:task-b',
    'Resolve an authoritative-data mismatch before registration.',
    'urgent', 'tenant:implement', 'work-items:test:b'
  );
  insert into work values ('b', made);
  reset role;
end $$;

do $$
declare
  payload jsonb;
  n integer;
begin
  if not pg_temp.refused((select v from ids where k = 'stranger'),
      $q$select public.ops_operations_inbox()$q$) then
    raise exception 'FAILED: a caller without the console shell reached the inbox';
  end if;
  if not pg_temp.refused((select v from ids where k = 'school_only'),
      $q$select public.ops_operations_inbox()$q$) then
    raise exception 'FAILED: a school capability without the console shell reached the inbox';
  end if;

  perform pg_temp.become((select v from ids where k = 'shell_only'));
  payload := public.ops_operations_inbox();
  n := jsonb_array_length(payload->'data');
  if n <> 0 then raise exception 'FAILED: shell-only caller saw % work items', n; end if;
  perform pg_temp.nobody();

  perform pg_temp.become((select v from ids where k = 'operator_a'));
  payload := public.ops_operations_inbox();
  if payload->>'authority' <> 'authoritative'
     or payload#>>'{freshness,status}' <> 'current'
     or jsonb_array_length(payload->'data') <> 1
     or payload#>>'{data,0,tenant_id}' <> 'work-a'
     or payload#>>'{data,0,state}' <> 'open' then
    raise exception 'FAILED: inbox envelope was not authoritative and tenant-scoped: %', payload;
  end if;
  perform pg_temp.nobody();

  if not pg_temp.refused((select v from ids where k = 'operator_a'),
      format('select public.ops_operations_inbox(%L::uuid)', (select v from work where k = 'b'))) then
    raise exception 'FAILED: an exact-school operator opened another tenant work item';
  end if;
  if not pg_temp.refused((select v from ids where k = 'operator_a'),
      format('select public.ops_operations_inbox(%L::uuid)', gen_random_uuid())) then
    raise exception 'FAILED: a nonexistent item disclosed a different authorization result';
  end if;
end $$;

do $$
declare
  item uuid := (select v from work where k = 'a');
  actor uuid := (select v from ids where k = 'operator_a');
  payload jsonb;
begin
  perform pg_temp.become(actor);
  payload := public.ops_transition_work_item(item, 'claim', 1);
  if payload#>>'{data,state}' <> 'claimed'
     or payload#>>'{data,version}' <> '2'
     or payload#>'{data,assigned_to_me}' is distinct from 'true'::jsonb then
    raise exception 'FAILED: claim did not return the committed version: %', payload;
  end if;
  perform pg_temp.nobody();

  if not pg_temp.refused(actor,
      format('select public.ops_transition_work_item(%L::uuid, %L, 1)', item, 'claim'), '40001') then
    raise exception 'FAILED: stale compare-and-swap claim did not conflict';
  end if;

  if not pg_temp.refused((select v from ids where k = 'operator_b'),
      format('select public.ops_transition_work_item(%L::uuid, %L, 2, null, %L, %L, %L)',
        item, 'resolve', 'reconciled', 'Matched the authoritative record.', 'receipt-a')) then
    raise exception 'FAILED: a foreign-tenant operator resolved the item';
  end if;
  if not pg_temp.refused((select v from ids where k = 'operator_a_peer'),
      format('select public.ops_transition_work_item(%L::uuid, %L, 2, null, %L, %L, %L)',
        item, 'resolve', 'reconciled', 'Matched the authoritative record.', 'receipt-a')) then
    raise exception 'FAILED: a same-tenant non-assignee resolved the item';
  end if;
  if not pg_temp.refused(actor,
      format('select public.ops_transition_work_item(%L::uuid, null, 2)', item), '22023') then
    raise exception 'FAILED: a null action did not fail closed';
  end if;
  if not pg_temp.refused(actor,
      format('select public.ops_transition_work_item(%L::uuid, %L, 1)', gen_random_uuid(), 'claim')) then
    raise exception 'FAILED: a nonexistent transition target disclosed a different authorization result';
  end if;

  perform pg_temp.become(actor);
  payload := public.ops_transition_work_item(
    item, 'resolve', 2, null, 'reconciled',
    'Matched the authoritative record.', 'receipt-a'
  );
  if payload#>>'{data,state}' <> 'resolved' or payload#>>'{data,version}' <> '3' then
    raise exception 'FAILED: assignee resolution did not commit: %', payload;
  end if;
  payload := public.ops_transition_work_item(
    item, 'reopen', 3, 'The authoritative source changed.'
  );
  if payload#>>'{data,state}' <> 'open' or payload#>>'{data,version}' <> '4' then
    raise exception 'FAILED: reopen did not commit: %', payload;
  end if;
  payload := public.ops_operations_inbox(item);
  if jsonb_array_length(payload#>'{data,history}') <> 4
     or payload#>>'{data,history,2,resolution,receipt_ref}' <> 'receipt-a'
     or payload#>>'{data,history,3,reason}' <> 'The authoritative source changed.' then
    raise exception 'FAILED: immutable receipt history was not preserved: %', payload;
  end if;
  perform pg_temp.nobody();
end $$;

do $$
declare
  first_id uuid;
  second_id uuid;
  task_id text := 'task-trigger-' || gen_random_uuid()::text;
begin
  set local role service_role;
  first_id := private.open_work_item(
    'work-a', 'registration_readiness.referral', 'registration_readiness', 'evaluation-idempotent',
    'registration-readiness-task:idempotent', 'Resolve the readiness referral.',
    'normal', 'tenant:implement', 'work-items:test:idempotent'
  );
  second_id := private.open_work_item(
    'work-a', 'registration_readiness.referral', 'registration_readiness', 'evaluation-idempotent',
    'registration-readiness-task:idempotent', 'Resolve the readiness referral.',
    'normal', 'tenant:implement', 'work-items:test:idempotent:retry'
  );
  if first_id is distinct from second_id then
    raise exception 'FAILED: an exact semantic retry opened two work items';
  end if;
  begin
    perform private.open_work_item(
      'work-a', 'registration_readiness.referral', 'registration_readiness', 'evaluation-idempotent',
      'registration-readiness-task:idempotent', 'A different work-item purpose.',
      'urgent', 'tenant:implement', 'work-items:test:idempotent:conflict'
    );
    raise exception 'FAILED: a divergent source-key retry was silently conflated';
  exception when invalid_parameter_value then null;
  end;

  insert into private.registration_readiness_evaluations (
    id, tenant_id, subject_id, term_id, requested_by, state, version, generation,
    projection_version, created_at, updated_at
  ) values (
    'evaluation-trigger', 'work-a', 'subject-minimized', 'term-a', 'system',
    'needs_review', 1, 1, 1, now(), now()
  );
  insert into private.registration_readiness_tasks (
    tenant_id, evaluation_id, task_id, generation, state, opened_at
  ) values ('work-a', 'evaluation-trigger', task_id, 1, 'open', now());

  if not exists (
    select 1 from private.work_item w
     where w.tenant_id = 'work-a'
       and w.source_ref = 'registration-readiness-task:' || task_id
       and w.subject_id = 'evaluation-trigger'
       and w.required_capability = 'tenant:implement'
  ) then
    raise exception 'FAILED: an open registration-readiness task produced no shared work item';
  end if;
  reset role;
end $$;

do $$
declare
  item uuid := (select v from work where k = 'a');
  body text;
begin
  if has_function_privilege('anon', 'public.ops_operations_inbox(uuid,boolean)', 'execute')
     or has_function_privilege('anon', 'public.ops_transition_work_item(uuid,text,bigint,text,text,text,text)', 'execute') then
    raise exception 'FAILED: anon can execute work-item RPCs';
  end if;
  if not has_function_privilege('authenticated', 'public.ops_operations_inbox(uuid,boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.ops_transition_work_item(uuid,text,bigint,text,text,text,text)', 'execute') then
    raise exception 'FAILED: authenticated cannot reach guarded work-item RPCs';
  end if;
  if has_function_privilege('authenticated',
      'private.open_work_item(text,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'FAILED: authenticated can create work items directly';
  end if;

  select pg_get_functiondef(p.oid) into body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ops_transition_work_item';
  if body not ilike '%security definer%' or body not ilike '%set search_path to %' then
    raise exception 'FAILED: transition RPC is not a pinned definer';
  end if;

  if not pg_temp.refused((select v from ids where k = 'operator_a'),
      $q$select * from private.work_item$q$) then
    raise exception 'FAILED: authenticated can read the private work-item table';
  end if;

  begin
    update private.work_item_event set reason = 'rewritten' where work_item_id = item;
    raise exception 'FAILED: work-item history can be updated';
  exception when integrity_constraint_violation then null;
  end;
  begin
    set local role service_role;
    delete from private.work_item_event where work_item_id = item;
    reset role;
    raise exception 'FAILED: service role can delete work-item history';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;

rollback;
