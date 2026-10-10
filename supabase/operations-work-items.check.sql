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
    (shell_only, 'implementation_manager', 'platform', '', 'platform', now()),
    (school_only, 'implementation_manager', 'school', 'work-a', 'platform', now());

  insert into ids values
    ('operator_a', operator_a), ('operator_b', operator_b),
    ('shell_only', shell_only), ('school_only', school_only), ('stranger', stranger);

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
     or payload#>>'{data,assigned_to}' <> actor::text then
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
    'registration-readiness-task:idempotent', 'Ignored retry text.',
    'urgent', 'tenant:implement', 'work-items:test:idempotent'
  );
  if first_id is distinct from second_id then
    raise exception 'FAILED: a retried source opened two work items';
  end if;

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
    delete from private.work_item_event where work_item_id = item;
    raise exception 'FAILED: work-item history can be deleted';
  exception when integrity_constraint_violation then null;
  end;
end $$;

rollback;
