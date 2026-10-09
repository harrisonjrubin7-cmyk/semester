-- Tenant-rollout producer and first consumer (P1-06).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh tenant-rollout-projection

begin;

insert into public.schools (id, name, email_domains)
values ('rollout-projection-a', 'Rollout projection A', array['rollout-projection.example']);

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
declare
  made_event private.domain_outbox_events%rowtype;
  history_id uuid;
begin
  insert into public.tenant_rollout (tenant_id, state, reason)
  values ('rollout-projection-a', 'requested', 'free text stays in source history');

  select id into history_id from public.tenant_rollout_history
   where tenant_id = 'rollout-projection-a' order by changed_at desc, id desc limit 1;
  select * into made_event from private.domain_outbox_events
   where aggregate_type = 'tenant_rollout' and aggregate_id = 'rollout-projection-a';

  if history_id is null or made_event.id is null
     or made_event.event_type <> 'tenant_rollout.changed'
     or made_event.event_version <> 1
     or made_event.tenant_id <> 'rollout-projection-a'
     or made_event.producer <> 'tenant_rollout'
     or made_event.correlation_id <> 'tenant-rollout:' || history_id::text
     or made_event.idempotency_key <> 'tenant-rollout-history:' || history_id::text
     or made_event.data_classification <> 'internal'
     or made_event.retention_class <> 'audit'
     or made_event.payload ->> 'tenantId' <> 'rollout-projection-a'
     or made_event.payload ->> 'state' <> 'requested'
     or made_event.payload ->> 'action' <> 'insert'
     or made_event.payload::text ~* 'free text|reason|updated_by|actor' then
    raise exception 'FAILED: rollout source, history, and bounded event do not agree (%)', made_event;
  end if;
  raise notice 'ok  rollout history and one bounded event commit in the source transaction';
end $$;

do $$
declare
  event_id uuid;
begin
  begin
    insert into public.tenant_rollout (tenant_id, state, reason)
    values ('rollout-projection-a', 'directory', 'duplicate source probe');
    raise exception using errcode = 'P0001', message = 'rollback the command';
  exception when unique_violation then
    null;
  end;
  select id into event_id from private.domain_outbox_events
   where aggregate_type = 'tenant_rollout' and aggregate_id = 'rollout-projection-a';
  if (select count(*) from public.tenant_rollout_history where tenant_id = 'rollout-projection-a') <> 1
     or (select count(*) from private.domain_outbox_events where aggregate_type = 'tenant_rollout' and aggregate_id = 'rollout-projection-a') <> 1
     or event_id is null then
    raise exception 'FAILED: a refused source write left history or an outbox fact';
  end if;
  raise notice 'ok  refused source writes leave no partial history or event';
end $$;

do $$
declare
  source_event uuid;
  result jsonb;
begin
  select id into source_event from private.domain_outbox_events
   where aggregate_type = 'tenant_rollout' and aggregate_id = 'rollout-projection-a';
  result := pg_temp.run_batch();
  if result <> jsonb_build_object(
      'claimed', 1, 'processed', 1, 'skipped', 0,
      'retrying', 0, 'deadLettered', 0) then
    raise exception 'FAILED: rollout event did not run through the bounded worker (%)', result;
  end if;
  if not exists (
    select 1 from private.ops_tenant_rollout_projection
     where tenant_id = 'rollout-projection-a' and state = 'requested'
       and resume_state is null and revision = 1 and source_event_id = source_event
  ) or not exists (
    select 1 from private.domain_event_receipts
     where consumer = 'ops.tenant-rollout.v1' and event_id = source_event
       and outcome = 'processed'
  ) or not exists (
    select 1 from private.projection_watermark
     where projection = 'ops_tenant_rollout' and version = 1
       and last_event_id = source_event and status = 'idle'
  ) or not exists (
    select 1 from private.projection_invalidation
     where namespace = 'ops.tenant_rollout' and tenant_id = 'rollout-projection-a'
       and resource_id = 'rollout-projection-a' and version = 1
  ) then
    raise exception 'FAILED: rollout effect, receipt, watermark, and invalidation did not commit together';
  end if;
  raise notice 'ok  effect, receipt, watermark, and invalidation commit atomically';
end $$;

do $$
declare
  made uuid;
  result jsonb;
begin
  made := private.emit_domain_event(
    'tenant_rollout', 'rollout-projection-a', 'tenant_rollout.changed', 1,
    'rollout-projection-a', 'tenant_rollout', 'rollout-projection-invalid',
    'rollout-projection-invalid',
    jsonb_build_object('tenantId', 'rollout-projection-a', 'action', 'update',
      'fromState', 'requested', 'state', 'not-a-state', 'resumeState', null,
      'changedFields', jsonb_build_array('state')),
    'internal', 'audit'
  );
  result := pg_temp.run_batch();
  if result ->> 'deadLettered' <> '1'
     or not exists (
       select 1 from private.domain_outbox_events
        where id = made and dead_lettered_at is not null
          and last_error = 'invalid tenant_rollout.changed version 1 event'
     ) or not exists (
       select 1 from private.domain_event_receipts
        where consumer = 'ops.tenant-rollout.v1' and event_id = made
          and outcome = 'failed'
          and last_error = 'invalid tenant_rollout.changed version 1 event'
     ) or (select state from private.ops_tenant_rollout_projection
            where tenant_id = 'rollout-projection-a') <> 'requested' then
    raise exception 'FAILED: malformed rollout event was not isolated (%)', result;
  end if;
  raise notice 'ok  malformed rollout input dead-letters without changing the projection';
end $$;

do $$
begin
  if has_table_privilege('anon', 'private.ops_tenant_rollout_projection', 'select')
     or has_table_privilege('authenticated', 'private.ops_tenant_rollout_projection', 'select')
     or has_function_privilege('anon', 'private.apply_tenant_rollout_event(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.apply_tenant_rollout_event(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'private.record_tenant_rollout_change()', 'execute')
     or has_function_privilege('authenticated', 'private.record_tenant_rollout_change()', 'execute') then
    raise exception 'FAILED: a client role can read or invoke the private rollout projection path';
  end if;
  if not has_function_privilege('service_role', 'private.apply_tenant_rollout_event(uuid,uuid)', 'execute') then
    raise exception 'FAILED: control — service_role cannot execute the rollout projector';
  end if;
  raise notice 'ok  producer trigger and projection remain private and service-only';
end $$;

rollback;
