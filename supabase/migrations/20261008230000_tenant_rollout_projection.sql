-- P1-06: tenant-rollout producer and its first bounded consumer.
--
-- A rollout transition already writes immutable history in the source
-- transaction. Extend that exact trigger so the history fact and one bounded
-- event commit or roll back together. The event contains state identifiers,
-- never the free-text reason or actor. Its consumer maintains a private,
-- school-scoped operational projection and participates in the existing
-- dormant ops-projector batch. No client read, scheduler, or activation is
-- added here.

insert into private.read_model_registry
  (name, version, capability, scope_kind, freshness_slo_seconds,
   source_tables, redaction_profile, status)
values
  ('ops_tenant_rollout', 1, 'tenant:configure', 'school', 300,
   array['public.tenant_rollout', 'public.tenant_rollout_history'],
   'bounded-rollout-state-v1', 'active')
on conflict (name, version) do update
  set capability = excluded.capability,
      scope_kind = excluded.scope_kind,
      freshness_slo_seconds = excluded.freshness_slo_seconds,
      source_tables = excluded.source_tables,
      redaction_profile = excluded.redaction_profile,
      status = excluded.status;

create table if not exists private.ops_tenant_rollout_projection (
  tenant_id text primary key references public.schools(id) on delete cascade,
  state text not null check (state in (
    'directory', 'requested', 'claimed', 'security_review', 'sandbox_uat',
    'pilot_read_only', 'pilot_write_enabled', 'production_limited',
    'production_active', 'expansion', 'paused', 'suspended', 'offboarding', 'archived')),
  resume_state text check (resume_state is null or resume_state in (
    'requested', 'claimed', 'security_review', 'sandbox_uat',
    'pilot_read_only', 'pilot_write_enabled', 'production_limited',
    'production_active', 'expansion')),
  revision bigint not null default 1 check (revision > 0),
  source_event_id uuid not null unique,
  source_occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  constraint ops_tenant_rollout_projection_resume
    check ((state in ('paused', 'suspended')) = (resume_state is not null))
);

alter table private.ops_tenant_rollout_projection enable row level security;
revoke all on table private.ops_tenant_rollout_projection from public, anon, authenticated;
grant select, insert, update, delete on table private.ops_tenant_rollout_projection to service_role;

create or replace function private.record_tenant_rollout_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  history_id uuid;
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    insert into public.tenant_rollout_history
      (tenant_id, from_state, to_state, reason, changed_by)
    values
      (new.tenant_id, case when tg_op = 'UPDATE' then old.state end,
       new.state, new.reason, new.updated_by)
    returning id into history_id;

    perform private.emit_domain_event(
      'tenant_rollout', new.tenant_id, 'tenant_rollout.changed', 1,
      new.tenant_id, 'tenant_rollout', 'tenant-rollout:' || history_id::text,
      'tenant-rollout-history:' || history_id::text,
      jsonb_build_object(
        'tenantId', new.tenant_id,
        'action', lower(tg_op),
        'fromState', case when tg_op = 'UPDATE' then old.state end,
        'state', new.state,
        'resumeState', new.resume_state,
        'changedFields', case
          when tg_op = 'INSERT' then jsonb_build_array('state', 'resumeState')
          when new.resume_state is distinct from old.resume_state
            then jsonb_build_array('state', 'resumeState')
          else jsonb_build_array('state')
        end
      ),
      'internal', 'audit'
    );
  end if;
  return new;
end
$$;

revoke all on function private.record_tenant_rollout_change()
  from public, anon, authenticated;

create or replace function private.apply_tenant_rollout_event(
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
  consumer_name constant text := 'ops.tenant-rollout.v1';
  projection_name constant text := 'ops_tenant_rollout';
  projection_version constant integer := 1;
  event_row private.domain_outbox_events%rowtype;
  event_state text;
  event_resume_state text;
  applied_revision bigint;
begin
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
    raise exception 'The rollout event is not held by this claim.' using errcode = '40001';
  end if;

  if not exists (
    select 1 from private.read_model_registry r
     where r.name = projection_name and r.version = projection_version
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'tenant:configure'
  ) then
    raise exception 'The tenant rollout projector is not registered active.' using errcode = '55000';
  end if;

  if event_row.aggregate_type <> 'tenant_rollout'
     or event_row.aggregate_id <> event_row.tenant_id
     or event_row.event_type <> 'tenant_rollout.changed'
     or event_row.event_version <> 1
     or event_row.producer <> 'tenant_rollout'
     or event_row.tenant_id is null
     or event_row.data_classification <> 'internal'
     or event_row.retention_class <> 'audit'
     or event_row.payload ->> 'tenantId' is distinct from event_row.tenant_id
     or event_row.payload ->> 'action' not in ('insert', 'update')
     or jsonb_typeof(event_row.payload -> 'changedFields') is distinct from 'array'
     or exists (
       select 1 from jsonb_object_keys(event_row.payload) as key(name)
        where key.name not in
          ('tenantId', 'action', 'fromState', 'state', 'resumeState', 'changedFields')
     ) then
    raise exception 'The event does not match tenant_rollout.changed version 1.' using errcode = '22023';
  end if;

  event_state := nullif(event_row.payload ->> 'state', '');
  event_resume_state := nullif(event_row.payload ->> 'resumeState', '');
  if event_state not in (
       'directory', 'requested', 'claimed', 'security_review', 'sandbox_uat',
       'pilot_read_only', 'pilot_write_enabled', 'production_limited',
       'production_active', 'expansion', 'paused', 'suspended', 'offboarding', 'archived')
     or ((event_state in ('paused', 'suspended')) <> (event_resume_state is not null))
     or (event_resume_state is not null and event_resume_state not in (
       'requested', 'claimed', 'security_review', 'sandbox_uat',
       'pilot_read_only', 'pilot_write_enabled', 'production_limited',
       'production_active', 'expansion')) then
    raise exception 'The rollout state or resume state is invalid.' using errcode = '22023';
  end if;

  insert into private.ops_tenant_rollout_projection as current (
    tenant_id, state, resume_state, revision,
    source_event_id, source_occurred_at, projected_at
  ) values (
    event_row.tenant_id, event_state, event_resume_state, 1,
    event_row.id, event_row.occurred_at, now()
  )
  on conflict (tenant_id) do update
    set state = excluded.state,
        resume_state = excluded.resume_state,
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
      ('ops.tenant_rollout', event_row.tenant_id, event_row.tenant_id,
       applied_revision, 'tenant_rollout.changed', event_row.correlation_id);
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

revoke all on function private.apply_tenant_rollout_event(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.apply_tenant_rollout_event(uuid, uuid)
  to service_role;

-- Keep the established private function signature while widening its bounded
-- candidate set to the two registered handlers. It remains service-only.
create or replace function private.claim_tenant_entitlement_events(
  want_limit integer default 25
)
returns setof private.domain_outbox_events
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  batch uuid := gen_random_uuid();
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.read_model_registry r
     where r.name = 'ops_tenant_entitlements' and r.version = 1
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'tenant:configure'
  ) or not exists (
    select 1 from private.read_model_registry r
     where r.name = 'ops_tenant_rollout' and r.version = 1
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'tenant:configure'
  ) then
    raise exception 'Every registered ops projector must be active before claiming.' using errcode = '55000';
  end if;

  return query
  with candidates as (
    select e.id
      from private.domain_outbox_events e
     where (e.event_type, e.event_version) in (
             ('entitlement.changed', 1),
             ('tenant_rollout.changed', 1))
       and e.published_at is null
       and e.dead_lettered_at is null
       and coalesce(e.next_attempt_at, e.occurred_at) <= now()
       and (e.claim_id is null or e.claimed_at < now() - interval '5 minutes')
       and not exists (
         select 1 from private.domain_event_receipts r
          where r.consumer = case e.event_type
                  when 'entitlement.changed' then 'ops.tenant-entitlements.v1'
                  when 'tenant_rollout.changed' then 'ops.tenant-rollout.v1'
                end
            and r.event_id = e.id
            and r.outcome in ('processed', 'skipped')
       )
     order by coalesce(e.next_attempt_at, e.occurred_at), e.occurred_at, e.id
     for update skip locked
     limit want_limit
  ), claimed as (
    update private.domain_outbox_events e
       set claim_id = batch,
           claimed_at = now()
      from candidates c
     where e.id = c.id
     returning e.*
  )
  select c.* from claimed c
   order by coalesce(c.next_attempt_at, c.occurred_at), c.occurred_at, c.id;
end
$$;

create or replace function public.run_ops_projector(
  want_limit integer default 25
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name text;
  event_row private.domain_outbox_events%rowtype;
  applied jsonb;
  failed jsonb;
  failure_state text;
  failure_message text;
  claimed_count integer := 0;
  processed_count integer := 0;
  skipped_count integer := 0;
  retrying_count integer := 0;
  dead_lettered_count integer := 0;
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;

  for event_row in
    select * from private.claim_tenant_entitlement_events(want_limit)
  loop
    claimed_count := claimed_count + 1;
    consumer_name := case event_row.event_type
      when 'entitlement.changed' then 'ops.tenant-entitlements.v1'
      when 'tenant_rollout.changed' then 'ops.tenant-rollout.v1'
    end;
    begin
      applied := case event_row.event_type
        when 'entitlement.changed'
          then private.apply_tenant_entitlement_event(event_row.id, event_row.claim_id)
        when 'tenant_rollout.changed'
          then private.apply_tenant_rollout_event(event_row.id, event_row.claim_id)
      end;
      if applied ->> 'outcome' = 'processed' then
        processed_count := processed_count + 1;
      elsif applied ->> 'outcome' in ('skipped', 'already_settled') then
        skipped_count := skipped_count + 1;
      else
        raise exception 'The registered projector returned an unsupported outcome.' using errcode = '22023';
      end if;
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate;
      failure_message := case event_row.event_type
        when 'entitlement.changed' then 'invalid entitlement.changed version 1 event'
        when 'tenant_rollout.changed' then 'invalid tenant_rollout.changed version 1 event'
        else 'registered projector transaction failed'
      end;
      failed := private.fail_domain_event(
        consumer_name,
        event_row.id,
        event_row.claim_id,
        case when failure_state in ('22023', '23514')
          then failure_message
          else 'registered projector transaction failed'
        end,
        failure_state not in ('22023', '23514')
      );
      if failed ->> 'state' = 'dead_letter' then
        dead_lettered_count := dead_lettered_count + 1;
      else
        retrying_count := retrying_count + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'claimed', claimed_count,
    'processed', processed_count,
    'skipped', skipped_count,
    'retrying', retrying_count,
    'deadLettered', dead_lettered_count
  );
end
$$;

comment on table private.ops_tenant_rollout_projection is
  'Private tenant rollout state projected from bounded tenant_rollout.changed events; no client role can read it.';
comment on function private.apply_tenant_rollout_event(uuid, uuid) is
  'Atomically applies one claimed tenant_rollout.changed v1 event to the private rollout read model, receipt, watermark, and invalidation.';
comment on function public.run_ops_projector(integer) is
  'Runs one bounded service-only batch through the active entitlement and rollout projection handlers; it does not schedule or activate the worker.';
