-- Bounded, manually invoked ops-projector worker boundary (P1-04).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh ops-projector-worker

begin;

insert into public.schools (id, name, email_domains)
values ('ops-projector-a', 'Ops projector A', array['ops-projector.example']);

create or replace function pg_temp.run_batch(want integer default 25)
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  execute 'set local role service_role';
  select public.run_ops_projector(want) into result;
  execute 'reset role';
  return result;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.run_ops_projector(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.run_ops_projector(integer)', 'execute')
     or has_function_privilege('anon', 'private.claim_tenant_entitlement_events(integer)', 'execute')
     or has_function_privilege('authenticated', 'private.claim_tenant_entitlement_events(integer)', 'execute') then
    raise exception 'FAILED: a client role can invoke the projection worker';
  end if;
  if not has_function_privilege('service_role', 'public.run_ops_projector(integer)', 'execute') then
    raise exception 'FAILED: control — the service role cannot invoke the projection worker';
  end if;
  begin
    perform pg_temp.run_batch(26);
    raise exception 'FAILED: a batch larger than 25 was accepted';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok  the worker is service-only and capped at 25 events';
end $$;

do $$
declare
  policy uuid;
  entitlement_event uuid;
  unrelated_event uuid := gen_random_uuid();
  result jsonb;
begin
  insert into private.domain_outbox_events (
    id, aggregate_type, aggregate_id, event_type, event_version, environment,
    tenant_id, producer, correlation_id, idempotency_key, payload,
    data_classification, retention_class
  ) values (
    unrelated_event, 'task', gen_random_uuid()::text, 'task.created', 1, 'staging',
    'ops-projector-a', 'worker-check', 'ops-projector-unrelated', 'unrelated',
    jsonb_build_object('taskId', gen_random_uuid()), 'internal', 'operational'
  );

  insert into public.tenant_feature_policy (tenant_id, capability, state)
  values ('ops-projector-a', 'module.course_studio', 'preview')
  returning id into policy;
  select id into entitlement_event from private.domain_outbox_events
   where aggregate_id = policy::text and event_type = 'entitlement.changed';

  result := pg_temp.run_batch();
  if result <> jsonb_build_object(
      'claimed', 1, 'processed', 1, 'skipped', 0,
      'retrying', 0, 'deadLettered', 0) then
    raise exception 'FAILED: unexpected worker summary (%)', result;
  end if;
  if not exists (
    select 1 from private.domain_event_receipts
     where consumer = 'ops.tenant-entitlements.v1'
       and event_id = entitlement_event and outcome = 'processed'
  ) or not exists (
    select 1 from private.ops_tenant_entitlement_projection
     where tenant_id = 'ops-projector-a' and capability = 'module.course_studio'
       and state = 'preview' and not deleted
  ) then
    raise exception 'FAILED: the registered event was not applied atomically';
  end if;
  if not exists (
    select 1 from private.domain_outbox_events
     where id = unrelated_event and published_at is null and dead_lettered_at is null
       and claim_id is null and publish_attempts = 0
  ) then
    raise exception 'FAILED: the worker claimed or mutated an unrelated event type';
  end if;
  raise notice 'ok  only the registered entitlement handler receives matching events';
end $$;

do $$
declare
  policy uuid;
  bad_event uuid;
  before_row private.ops_tenant_entitlement_projection%rowtype;
  after_row private.ops_tenant_entitlement_projection%rowtype;
  result jsonb;
begin
  select id into policy from public.tenant_feature_policy
   where tenant_id = 'ops-projector-a' and capability = 'module.course_studio';
  select * into before_row from private.ops_tenant_entitlement_projection
   where tenant_id = 'ops-projector-a' and capability = 'module.course_studio';

  bad_event := private.emit_domain_event(
    'tenant_feature_policy', policy::text, 'entitlement.changed', 1,
    'ops-projector-a', 'tenant_policy', 'ops-projector-invalid',
    'ops-projector-invalid',
    jsonb_build_object('policyId', policy::text, 'capability', 'module.course_studio',
      'action', 'update', 'state', 'invalid-state', 'changedFields', jsonb_build_array('state')),
    'internal', 'commercial'
  );

  result := pg_temp.run_batch();
  select * into after_row from private.ops_tenant_entitlement_projection
   where tenant_id = 'ops-projector-a' and capability = 'module.course_studio';
  if result ->> 'deadLettered' <> '1'
     or to_jsonb(after_row) is distinct from to_jsonb(before_row)
     or not exists (
       select 1 from private.domain_outbox_events
        where id = bad_event and dead_lettered_at is not null
          and last_error = 'invalid entitlement.changed version 1 event'
     )
     or not exists (
       select 1 from private.domain_event_receipts
        where consumer = 'ops.tenant-entitlements.v1'
          and event_id = bad_event and outcome = 'failed'
          and last_error = 'invalid entitlement.changed version 1 event'
     ) then
    raise exception 'FAILED: malformed input was not safely dead-lettered (%)', result;
  end if;
  raise notice 'ok  malformed input dead-letters without a partial effect or leaked error';
end $$;

do $$
declare
  event_id uuid;
  policy_id uuid := gen_random_uuid();
begin
  update private.read_model_registry set status = 'proposed'
   where name = 'ops_tenant_entitlements' and version = 1;
  event_id := private.emit_domain_event(
    'tenant_feature_policy', policy_id::text, 'entitlement.changed', 1,
    'ops-projector-a', 'tenant_policy', 'ops-projector-disabled',
    'ops-projector-disabled',
    jsonb_build_object('policyId', policy_id::text, 'capability', 'module.course_studio',
      'action', 'delete', 'changedFields', jsonb_build_array('deleted')),
    'internal', 'commercial'
  );
  begin
    perform pg_temp.run_batch();
    raise exception 'FAILED: an inactive registered handler was dispatched';
  exception when sqlstate '55000' then null;
  end;
  if not exists (
    select 1 from private.domain_outbox_events
     where id = event_id and claim_id is null and publish_attempts = 0
       and published_at is null and dead_lettered_at is null
  ) then
    raise exception 'FAILED: inactive registration changed the pending event';
  end if;
  raise notice 'ok  inactive registration fails before claim or dispatch';
end $$;

rollback;
