-- The first SQL-native producer: feature-policy audit and outbox facts are one
-- atomic, bounded and tenant-scoped change.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run it: supabase/check.sh tenant-feature-policy-events

begin;

insert into public.schools (id, name, email_domains)
values ('feature-event-a', 'Feature event A', array['feature-event.example']);

do $$
declare
  policy_id uuid;
  first_audit uuid;
  first_event private.domain_outbox_events%rowtype;
  event_count integer;
  audit_count integer;
begin
  -- Insert: one existing audit fact and one pending, bounded event.
  insert into public.tenant_feature_policy
    (tenant_id, capability, state, permitted_roles, reason)
  values
    ('feature-event-a', 'module.course_studio', 'preview', array['faculty'], 'not allowed into the event')
  returning id into policy_id;

  select id into first_audit
    from public.tenant_policy_audit_event
   where entity_type = 'tenant_feature_policy' and entity_id = policy_id::text and action = 'insert';
  select * into first_event
    from private.domain_outbox_events
   where aggregate_type = 'tenant_feature_policy' and aggregate_id = policy_id::text;

  if first_audit is null or first_event.id is null then
    raise exception 'FAILED: the insert did not write both its audit and outbox facts';
  end if;
  if first_event.event_type <> 'entitlement.changed' or first_event.event_version <> 1
     or first_event.tenant_id <> 'feature-event-a' or first_event.producer <> 'tenant_policy'
     or first_event.data_classification <> 'internal' or first_event.retention_class <> 'commercial'
     or first_event.correlation_id <> 'tenant-policy:' || first_audit::text
     or first_event.idempotency_key <> 'tenant-policy-audit:' || first_audit::text
     or first_event.published_at is not null or first_event.claim_id is not null then
    raise exception 'FAILED: the insert event has the wrong envelope (%)', first_event;
  end if;
  if first_event.payload ->> 'policyId' <> policy_id::text
     or first_event.payload ->> 'capability' <> 'module.course_studio'
     or first_event.payload ->> 'action' <> 'insert'
     or first_event.payload ->> 'state' <> 'preview'
     or not (first_event.payload -> 'changedFields' ? 'state') then
    raise exception 'FAILED: the insert event has the wrong bounded payload (%)', first_event.payload;
  end if;
  if first_event.payload::text ~* 'not allowed|reason|faculty|actor|updated_by' then
    raise exception 'FAILED: free text, role scope or actor data escaped into the event (%)', first_event.payload;
  end if;
  raise notice 'ok  insert writes one pending entitlement event bound to its audit fact, with a bounded payload';

  -- Update and delete each produce their own audit-bound fact. A no-op field
  -- is not named as changed, and deletion does not leak the old policy body.
  update public.tenant_feature_policy
     set state = 'production', reason = 'still private'
   where id = policy_id;
  delete from public.tenant_feature_policy where id = policy_id;

  select count(*) into event_count from private.domain_outbox_events
   where aggregate_type = 'tenant_feature_policy' and aggregate_id = policy_id::text;
  select count(*) into audit_count from public.tenant_policy_audit_event
   where entity_type = 'tenant_feature_policy' and entity_id = policy_id::text;
  if event_count <> 3 or audit_count <> 3 then
    raise exception 'FAILED: insert/update/delete made % events and % audits, expected three of each', event_count, audit_count;
  end if;
  if not exists (
    select 1 from private.domain_outbox_events
     where aggregate_id = policy_id::text and payload ->> 'action' = 'update'
       and payload ->> 'state' = 'production' and payload -> 'changedFields' ? 'state'
       and not (payload -> 'changedFields' ? 'capability')
  ) then
    raise exception 'FAILED: update did not name only its meaningful changed fields';
  end if;
  if not exists (
    select 1 from private.domain_outbox_events
     where aggregate_id = policy_id::text and payload ->> 'action' = 'delete'
       and payload -> 'changedFields' = '["deleted"]'::jsonb
       and not (payload ? 'state')
  ) then
    raise exception 'FAILED: delete did not produce the bounded tombstone event';
  end if;
  raise notice 'ok  update and delete each produce one separately idempotent, audit-bound event';

  -- Other policy tables keep their existing audit behavior and do not become
  -- accidental producers in this slice.
  insert into public.ai_policy (tenant_id, allowed_providers, monthly_budget_cents)
  values ('feature-event-a', '{}', 0);
  if not exists (
    select 1 from public.tenant_policy_audit_event
     where tenant_id = 'feature-event-a' and entity_type = 'ai_policy'
  ) then
    raise exception 'FAILED: control — AI policy lost its existing audit row';
  end if;
  if exists (
    select 1 from private.domain_outbox_events
     where tenant_id = 'feature-event-a' and aggregate_type <> 'tenant_feature_policy'
  ) then
    raise exception 'FAILED: a policy outside this slice emitted an event';
  end if;
  raise notice 'ok  other policy tables retain audit behavior without becoming producers';

  -- A command rollback removes its policy, audit and event together.
  begin
    insert into public.tenant_feature_policy (tenant_id, capability, state)
    values ('feature-event-a', 'module.rollback_probe', 'preview');
    raise exception using errcode = 'P0001', message = 'rollback the command';
  exception when sqlstate 'P0001' then
    null;
  end;
  if exists (select 1 from public.tenant_feature_policy where capability = 'module.rollback_probe')
     or exists (select 1 from public.tenant_policy_audit_event where new_data ->> 'capability' = 'module.rollback_probe')
     or exists (select 1 from private.domain_outbox_events where payload ->> 'capability' = 'module.rollback_probe') then
    raise exception 'FAILED: policy, audit or event survived the command rollback';
  end if;
  raise notice 'ok  policy, audit and outbox event commit or roll back together';

  if has_function_privilege('anon', 'private.audit_tenant_policy_change()', 'execute')
     or has_function_privilege('authenticated', 'private.audit_tenant_policy_change()', 'execute') then
    raise exception 'FAILED: a client role can call the producer trigger directly';
  end if;
  raise notice 'ok  client roles cannot invoke the producer trigger directly';
end $$;

rollback;
