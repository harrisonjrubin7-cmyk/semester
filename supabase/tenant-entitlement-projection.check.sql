-- First registered projector transaction (P1-04).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh tenant-entitlement-projection

begin;

create or replace function pg_temp.claim_one()
returns private.domain_outbox_events language plpgsql as $$
declare claimed private.domain_outbox_events%rowtype;
begin
  select * into claimed
    from private.claim_domain_events('ops.tenant-entitlements.v1', 1);
  if claimed.id is null then
    raise exception 'FAILED: expected one claimable entitlement event';
  end if;
  return claimed;
end $$;

insert into public.schools (id, name, email_domains)
values ('entitlement-projection-a', 'Entitlement projection A', array['entitlement-projection.example']);

insert into private.projection_watermark (projection, version)
values ('ops_tenant_entitlements', 1);

-- Registration and privilege boundaries are explicit before any event runs.
do $$
begin
  if not exists (
    select 1 from private.read_model_registry
     where name = 'ops_tenant_entitlements' and version = 1 and status = 'active'
       and capability = 'tenant:configure' and scope_kind = 'school'
  ) then
    raise exception 'FAILED: the tenant entitlement read model is not registered active';
  end if;
  if has_table_privilege('anon', 'private.ops_tenant_entitlement_projection', 'select')
     or has_table_privilege('authenticated', 'private.ops_tenant_entitlement_projection', 'select')
     or has_function_privilege('anon', 'private.apply_tenant_entitlement_event(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.apply_tenant_entitlement_event(uuid,uuid)', 'execute') then
    raise exception 'FAILED: a client role can read or execute the private projector';
  end if;
  if not has_function_privilege('service_role', 'private.apply_tenant_entitlement_event(uuid,uuid)', 'execute') then
    raise exception 'FAILED: control — service_role cannot execute the projector';
  end if;
  raise notice 'ok  projector registration and client privilege boundaries are explicit';
end $$;

-- One produced event applies the effect, receipt, watermark and invalidation.
do $$
declare
  policy uuid;
  claimed private.domain_outbox_events%rowtype;
  result jsonb;
begin
  insert into public.tenant_feature_policy (tenant_id, capability, state)
  values ('entitlement-projection-a', 'module.course_studio', 'preview')
  returning id into policy;

  update private.domain_outbox_events
     set occurred_at = now() - interval '3 minutes'
   where aggregate_id = policy::text and payload ->> 'action' = 'insert';

  claimed := pg_temp.claim_one();
  result := private.apply_tenant_entitlement_event(claimed.id, claimed.claim_id);

  if result ->> 'outcome' <> 'processed' or (result ->> 'applied')::boolean is not true then
    raise exception 'FAILED: the valid event was not applied (%)', result;
  end if;
  if not exists (
    select 1 from private.ops_tenant_entitlement_projection
     where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio'
       and policy_id = policy and state = 'preview' and not deleted and revision = 1
       and source_event_id = claimed.id
  ) then
    raise exception 'FAILED: the projected entitlement state is wrong';
  end if;
  if not exists (
    select 1 from private.domain_event_receipts
     where consumer = 'ops.tenant-entitlements.v1' and event_id = claimed.id
       and outcome = 'processed'
  ) or not exists (
    select 1 from private.projection_watermark
     where projection = 'ops_tenant_entitlements' and version = 1
       and last_event_id = claimed.id and status = 'idle'
  ) or not exists (
    select 1 from private.projection_invalidation
     where namespace = 'ops.tenant_entitlements' and tenant_id = 'entitlement-projection-a'
       and resource_id = 'module.course_studio' and version = 1
       and correlation_id = claimed.correlation_id
  ) then
    raise exception 'FAILED: receipt, watermark, and invalidation did not commit with the effect';
  end if;
  if (private.apply_tenant_entitlement_event(claimed.id, claimed.claim_id) ->> 'outcome') <> 'already_settled' then
    raise exception 'FAILED: a repeated delivery was not idempotent';
  end if;
  raise notice 'ok  effect, receipt, watermark and invalidation commit atomically and repeat safely';
end $$;

-- A later change wins. A delayed older delivery is settled as skipped and
-- creates neither a regressed state nor a spurious invalidation.
do $$
declare
  policy uuid;
  newer private.domain_outbox_events%rowtype;
  stale_id uuid;
  stale private.domain_outbox_events%rowtype;
  invalidations integer;
  result jsonb;
begin
  select id into policy from public.tenant_feature_policy
   where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio';
  update public.tenant_feature_policy set state = 'production' where id = policy;
  select id into newer from private.domain_outbox_events
   where aggregate_id = policy::text and payload ->> 'action' = 'update';
  update private.domain_outbox_events set occurred_at = now() - interval '1 minute' where id = newer.id;
  newer := pg_temp.claim_one();
  perform private.apply_tenant_entitlement_event(newer.id, newer.claim_id);

  stale_id := private.emit_domain_event(
    'tenant_feature_policy', policy::text, 'entitlement.changed', 1,
    'entitlement-projection-a', 'tenant_policy', 'stale-entitlement-event',
    'stale-entitlement-event',
    jsonb_build_object('policyId', policy::text, 'capability', 'module.course_studio',
      'action', 'update', 'state', 'preview', 'changedFields', jsonb_build_array('state')),
    'internal', 'commercial'
  );
  update private.domain_outbox_events set occurred_at = now() - interval '2 minutes' where id = stale_id;
  select count(*) into invalidations from private.projection_invalidation
   where namespace = 'ops.tenant_entitlements';
  stale := pg_temp.claim_one();
  result := private.apply_tenant_entitlement_event(stale.id, stale.claim_id);

  if result ->> 'outcome' <> 'skipped'
     or (select state from private.ops_tenant_entitlement_projection
          where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio') <> 'production'
     or (select count(*) from private.projection_invalidation
          where namespace = 'ops.tenant_entitlements') <> invalidations
     or (select outcome from private.domain_event_receipts
          where consumer = 'ops.tenant-entitlements.v1' and event_id = stale.id) <> 'skipped'
     or (select last_event_id from private.projection_watermark
          where projection = 'ops_tenant_entitlements' and version = 1) <> newer.id then
    raise exception 'FAILED: a delayed event regressed state, freshness or invalidation (%)', result;
  end if;
  raise notice 'ok  delayed events settle as skipped without regressing state or freshness';
end $$;

-- Malformed input fails before settlement; because the function is one SQL
-- statement, no partial effect, receipt, watermark, or invalidation survives.
do $$
declare
  policy uuid;
  bad_id uuid;
  claimed private.domain_outbox_events%rowtype;
  before_projection private.ops_tenant_entitlement_projection%rowtype;
  after_projection private.ops_tenant_entitlement_projection%rowtype;
  before_invalidations integer;
begin
  select id into policy from public.tenant_feature_policy
   where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio';
  select * into before_projection from private.ops_tenant_entitlement_projection
   where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio';
  select count(*) into before_invalidations from private.projection_invalidation
   where namespace = 'ops.tenant_entitlements';

  bad_id := private.emit_domain_event(
    'tenant_feature_policy', policy::text, 'entitlement.changed', 1,
    'entitlement-projection-a', 'tenant_policy', 'bad-entitlement-event',
    'bad-entitlement-event',
    jsonb_build_object('policyId', policy::text, 'capability', 'module.course_studio',
      'action', 'update', 'state', 'not-a-state', 'changedFields', jsonb_build_array('state')),
    'internal', 'commercial'
  );
  claimed := pg_temp.claim_one();
  begin
    perform private.apply_tenant_entitlement_event(claimed.id, claimed.claim_id);
    raise exception 'FAILED: malformed state was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  select * into after_projection from private.ops_tenant_entitlement_projection
   where tenant_id = 'entitlement-projection-a' and capability = 'module.course_studio';
  if to_jsonb(after_projection) is distinct from to_jsonb(before_projection)
     or exists (select 1 from private.domain_event_receipts where event_id = bad_id)
     or (select count(*) from private.projection_invalidation
          where namespace = 'ops.tenant_entitlements') <> before_invalidations
     or not exists (select 1 from private.domain_outbox_events
                     where id = bad_id and published_at is null and claim_id = claimed.claim_id) then
    raise exception 'FAILED: malformed input left a partial projector transaction';
  end if;
  raise notice 'ok  malformed input leaves no partial effect, receipt, watermark or invalidation';
end $$;

rollback;
