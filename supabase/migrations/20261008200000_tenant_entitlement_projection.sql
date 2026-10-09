-- The first registered projector transaction (CQRS backlog P1-04).
--
-- `entitlement.changed` is already emitted atomically with a tenant feature
-- policy audit fact. This migration gives that event one bounded consumer: a
-- private, school-scoped operational read model. Applying the materialized
-- state, recording the consumer receipt, advancing the watermark, and writing
-- the invalidation all happen in one database transaction. There is still no
-- worker, cron, public read API, or UI in this slice.

insert into private.read_model_registry
  (name, version, capability, scope_kind, freshness_slo_seconds,
   source_tables, redaction_profile, status)
values
  ('ops_tenant_entitlements', 1, 'tenant:configure', 'school', 300,
   array['public.tenant_feature_policy'], 'bounded-entitlement-v1', 'active')
on conflict (name, version) do update
  set capability = excluded.capability,
      scope_kind = excluded.scope_kind,
      freshness_slo_seconds = excluded.freshness_slo_seconds,
      source_tables = excluded.source_tables,
      redaction_profile = excluded.redaction_profile,
      status = excluded.status;

create table if not exists private.ops_tenant_entitlement_projection (
  tenant_id text not null references public.schools(id) on delete cascade,
  capability text not null check (length(trim(capability)) between 1 and 100),
  policy_id uuid not null,
  state public.feature_state,
  deleted boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  source_event_id uuid not null,
  source_occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  primary key (tenant_id, capability),
  constraint ops_tenant_entitlement_projection_state
    check ((deleted and state is null) or (not deleted and state is not null))
);

create unique index if not exists ops_tenant_entitlement_projection_event
  on private.ops_tenant_entitlement_projection (source_event_id);

alter table private.ops_tenant_entitlement_projection enable row level security;
revoke all on table private.ops_tenant_entitlement_projection from public, anon, authenticated;
grant select, insert, update, delete on table private.ops_tenant_entitlement_projection to service_role;

create or replace function private.apply_tenant_entitlement_event(
  want_event uuid,
  want_claim uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'ops.tenant-entitlements.v1';
  projection_name constant text := 'ops_tenant_entitlements';
  projection_version constant integer := 1;
  event_row private.domain_outbox_events%rowtype;
  event_action text;
  event_capability text;
  event_state public.feature_state;
  applied_revision bigint;
begin
  -- A repeated delivery after an atomic success is a no-op. A failed receipt
  -- is deliberately not terminal because an approved replay must apply it.
  if exists (
    select 1 from private.domain_event_receipts r
     where r.consumer = consumer_name and r.event_id = want_event
       and r.outcome in ('processed', 'skipped')
  ) then
    return jsonb_build_object('event', want_event, 'applied', false, 'outcome', 'already_settled');
  end if;

  select e.* into event_row
    from private.domain_outbox_events e
   where e.id = want_event
     and e.claim_id = want_claim
     and e.published_at is null
     and e.dead_lettered_at is null
   for update;
  if not found then
    if exists (
      select 1 from private.domain_event_receipts r
       where r.consumer = consumer_name and r.event_id = want_event
         and r.outcome in ('processed', 'skipped')
    ) then
      return jsonb_build_object('event', want_event, 'applied', false, 'outcome', 'already_settled');
    end if;
    raise exception 'The entitlement event is not held by this claim.' using errcode = '40001';
  end if;

  if not exists (
    select 1 from private.read_model_registry r
     where r.name = projection_name and r.version = projection_version
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'tenant:configure'
  ) then
    raise exception 'The tenant entitlement projector is not registered active.' using errcode = '55000';
  end if;

  if event_row.aggregate_type <> 'tenant_feature_policy'
     or event_row.event_type <> 'entitlement.changed'
     or event_row.event_version <> 1
     or event_row.producer <> 'tenant_policy'
     or event_row.tenant_id is null
     or event_row.data_classification <> 'internal'
     or event_row.retention_class <> 'commercial'
     or event_row.aggregate_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or event_row.payload ->> 'policyId' is distinct from event_row.aggregate_id
     or jsonb_typeof(event_row.payload -> 'changedFields') is distinct from 'array'
     or exists (
       select 1 from jsonb_object_keys(event_row.payload) as key(name)
        where key.name not in ('policyId', 'capability', 'action', 'state', 'changedFields')
     ) then
    raise exception 'The event does not match entitlement.changed version 1.' using errcode = '22023';
  end if;

  event_action := event_row.payload ->> 'action';
  event_capability := nullif(trim(event_row.payload ->> 'capability'), '');
  if event_action not in ('insert', 'update', 'delete')
     or event_capability is null or length(event_capability) > 100 then
    raise exception 'The entitlement event action or capability is invalid.' using errcode = '22023';
  end if;
  if event_action = 'delete' then
    if event_row.payload ? 'state' then
      raise exception 'An entitlement deletion must be a bounded tombstone.' using errcode = '22023';
    end if;
    event_state := null;
  else
    begin
      event_state := (event_row.payload ->> 'state')::public.feature_state;
    exception when invalid_text_representation then
      raise exception 'The entitlement state is invalid.' using errcode = '22023';
    end;
    if event_state is null then
      raise exception 'An entitlement upsert needs a state.' using errcode = '22023';
    end if;
  end if;

  -- The source time and UUID form the ordering key. A delayed earlier event is
  -- settled as skipped and cannot resurrect or overwrite a newer state.
  insert into private.ops_tenant_entitlement_projection as current (
    tenant_id, capability, policy_id, state, deleted, revision,
    source_event_id, source_occurred_at, projected_at
  ) values (
    event_row.tenant_id, event_capability, event_row.aggregate_id::uuid,
    event_state, event_action = 'delete', 1,
    event_row.id, event_row.occurred_at, now()
  )
  on conflict (tenant_id, capability) do update
    set policy_id = excluded.policy_id,
        state = excluded.state,
        deleted = excluded.deleted,
        revision = current.revision + 1,
        source_event_id = excluded.source_event_id,
        source_occurred_at = excluded.source_occurred_at,
        projected_at = excluded.projected_at
    where (excluded.source_occurred_at, excluded.source_event_id)
        > (current.source_occurred_at, current.source_event_id)
  returning revision into applied_revision;

  if applied_revision is not null then
    insert into private.projection_invalidation
      (namespace, tenant_id, resource_id, version, reason, correlation_id)
    values
      ('ops.tenant_entitlements', event_row.tenant_id, event_capability,
       applied_revision, 'entitlement.changed', event_row.correlation_id);
  end if;

  insert into private.projection_watermark as current
    (projection, version, last_event_id, last_occurred_at, last_processed_at,
     source_updated_at, status, last_error, lag_seconds)
  values
    (projection_name, projection_version, event_row.id, event_row.occurred_at, now(),
     event_row.occurred_at, 'idle', null,
     greatest(0, floor(extract(epoch from now() - event_row.occurred_at)))::integer)
  on conflict (projection, version) do update
    set last_event_id = excluded.last_event_id,
        last_occurred_at = excluded.last_occurred_at,
        last_processed_at = excluded.last_processed_at,
        source_updated_at = excluded.source_updated_at,
        status = 'idle',
        last_error = null,
        lag_seconds = excluded.lag_seconds
    where current.last_occurred_at is null
       or (excluded.last_occurred_at, excluded.last_event_id)
        > (current.last_occurred_at, current.last_event_id);

  perform private.complete_domain_event(
    consumer_name, event_row.id, want_claim,
    case when applied_revision is null then 'skipped' else 'processed' end
  );

  return jsonb_build_object(
    'event', event_row.id,
    'applied', applied_revision is not null,
    'outcome', case when applied_revision is null then 'skipped' else 'processed' end,
    'revision', applied_revision
  );
end
$$;

revoke all on function private.apply_tenant_entitlement_event(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.apply_tenant_entitlement_event(uuid, uuid)
  to service_role;

comment on function private.apply_tenant_entitlement_event(uuid, uuid) is
  'Atomically applies one claimed entitlement.changed v1 event to the private tenant entitlement read model, receipt, watermark, and invalidation.';
