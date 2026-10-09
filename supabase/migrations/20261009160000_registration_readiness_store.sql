-- Durable registration-readiness evaluations.
--
-- The TypeScript aggregate in packages/institution/src/readiness-workflow.ts
-- decides a command. This migration persists that decision with one service-
-- only transaction: compare-and-swap the aggregate, write its receipt and any
-- reconciliation task, append audit evidence, and emit the minimized outbox
-- event. No prerequisite, hold, source payload, or student-entered plan is
-- stored here.
--
-- Nothing calls this adapter from an HTTP route or worker yet. This is durable
-- repository infrastructure, not evidence of a live SIS or official write.
--
-- Rollback: ship a forward migration that revokes the two RPCs first. After
-- confirming no caller and draining the outbox, drop the functions, helper,
-- then receipts/tasks/evaluations. Records are not deleted by this migration.

create table if not exists private.registration_readiness_evaluations (
  id                 text primary key check (length(id) between 1 and 200),
  tenant_id          text not null references public.schools(id) on delete cascade,
  subject_id         text not null check (length(subject_id) between 1 and 200),
  term_id            text not null check (length(term_id) between 1 and 200),
  requested_by       text not null check (length(requested_by) between 1 and 200),
  state              text not null check (state in (
                       'requested', 'evaluating', 'ready', 'blocked',
                       'needs_review', 'unknown', 'stale', 'reconciling'
                     )),
  version            integer not null check (version >= 1),
  generation         integer not null check (generation >= 1),
  projection_version integer check (projection_version is null or projection_version >= 1),
  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  constraint registration_readiness_time_order check (updated_at >= created_at),
  unique (tenant_id, id),
  unique (id, version)
);

create index if not exists registration_readiness_by_subject
  on private.registration_readiness_evaluations (tenant_id, subject_id, term_id);

create table if not exists private.registration_readiness_tasks (
  tenant_id    text not null,
  evaluation_id text not null,
  task_id      text not null check (length(task_id) between 1 and 300),
  generation   integer not null check (generation >= 1),
  state        text not null check (state in ('open', 'resolved')),
  opened_at    timestamptz not null,
  resolved_at  timestamptz,
  primary key (tenant_id, task_id),
  foreign key (tenant_id, evaluation_id)
    references private.registration_readiness_evaluations (tenant_id, id) on delete cascade,
  constraint registration_readiness_task_resolution
    check ((state = 'open' and resolved_at is null) or (state = 'resolved' and resolved_at is not null))
);

create index if not exists registration_readiness_open_tasks
  on private.registration_readiness_tasks (tenant_id, evaluation_id, generation)
  where state = 'open';

create table if not exists private.registration_readiness_receipts (
  tenant_id       text not null,
  evaluation_id   text not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 300),
  fingerprint     text not null check (length(fingerprint) between 1 and 500),
  status          text not null check (status in ('pending', 'completed')),
  state           text not null check (state in (
                    'requested', 'evaluating', 'ready', 'blocked',
                    'needs_review', 'unknown', 'stale', 'reconciling'
                  )),
  record_version  integer not null check (record_version >= 1),
  recorded_at     timestamptz not null,
  correlation_id  text not null check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  event_type       text not null check (event_type in (
                    'registration.readiness_requested',
                    'registration.readiness_evaluated',
                    'registration.readiness_reconciliation_requested'
                  )),
  event_payload    jsonb not null check (jsonb_typeof(event_payload) = 'object'),
  primary key (tenant_id, idempotency_key),
  unique (evaluation_id, record_version),
  foreign key (tenant_id, evaluation_id)
    references private.registration_readiness_evaluations (tenant_id, id) on delete cascade
);

alter table private.registration_readiness_evaluations enable row level security;
alter table private.registration_readiness_tasks enable row level security;
alter table private.registration_readiness_receipts enable row level security;
revoke all on table private.registration_readiness_evaluations from public, anon, authenticated;
revoke all on table private.registration_readiness_tasks from public, anon, authenticated;
revoke all on table private.registration_readiness_receipts from public, anon, authenticated;
grant select, insert, update on table private.registration_readiness_evaluations to service_role;
grant select, insert, update on table private.registration_readiness_tasks to service_role;
grant select, insert on table private.registration_readiness_receipts to service_role;

create or replace function private.registration_readiness_edge_ok(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (values
    ('requested', 'evaluating'),
    ('evaluating', 'ready'), ('evaluating', 'blocked'), ('evaluating', 'needs_review'),
    ('evaluating', 'unknown'), ('evaluating', 'stale'), ('evaluating', 'reconciling'),
    ('ready', 'evaluating'), ('blocked', 'evaluating'),
    ('needs_review', 'reconciling'), ('unknown', 'reconciling'), ('stale', 'reconciling'),
    ('reconciling', 'evaluating')
  );
$$;

create or replace function private.registration_readiness_record_json(want_tenant text, want_evaluation text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'tenantId', e.tenant_id,
    'subjectId', e.subject_id,
    'termId', e.term_id,
    'requestedBy', e.requested_by,
    'state', e.state,
    'version', e.version,
    'generation', e.generation,
    'projectionVersion', e.projection_version,
    'createdAt', to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(e.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reconciliationTasks', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', t.task_id, 'generation', t.generation, 'state', t.state,
        'openedAt', to_char(t.opened_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'resolvedAt', case when t.resolved_at is null then null else
          to_char(t.resolved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
      )) order by t.generation, t.task_id)
      from private.registration_readiness_tasks t
      where t.tenant_id = e.tenant_id and t.evaluation_id = e.id
    ), '[]'::jsonb),
    'commandLedger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'idempotencyKey', r.idempotency_key,
        'fingerprint', r.fingerprint,
        'receipt', jsonb_build_object(
          'id', r.idempotency_key, 'status', r.status, 'state', r.state,
          'recordVersion', r.record_version,
          'recordedAt', to_char(r.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'correlationId', r.correlation_id
        ),
        'event', jsonb_build_object(
          'eventType', r.event_type, 'aggregateId', r.evaluation_id,
          'idempotencyKey', r.idempotency_key, 'correlationId', r.correlation_id,
          'payload', r.event_payload
        )
      ) order by r.record_version)
      from private.registration_readiness_receipts r
      where r.tenant_id = e.tenant_id and r.evaluation_id = e.id
    ), '[]'::jsonb)
  ))
  from private.registration_readiness_evaluations e
  where e.tenant_id = want_tenant and e.id = want_evaluation;
$$;

create or replace function public.registration_readiness_get(want_tenant text, want_evaluation text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.registration_readiness_record_json(want_tenant, want_evaluation);
$$;

create or replace function public.registration_readiness_save(
  want_tenant text,
  want_expected_version integer,
  want_fingerprint text,
  want_result jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  rec jsonb := want_result->'record';
  receipt jsonb := want_result->'receipt';
  event jsonb := want_result->'event';
  current private.registration_readiness_evaluations;
  earlier private.registration_readiness_receipts;
  task jsonb;
  evaluation_id text := rec->>'id';
  next_state text := rec->>'state';
  next_version integer := (rec->>'version')::integer;
  next_generation integer := (rec->>'generation')::integer;
  next_projection integer := (rec->>'projectionVersion')::integer;
  key text := receipt->>'id';
  expected_payload jsonb;
  audit_saved boolean;
begin
  if want_tenant is null or rec->>'tenantId' is distinct from want_tenant then
    raise exception 'The readiness tenant does not match the record.' using errcode = 'SC403';
  end if;
  if key is null or length(key) not between 1 and 300 or want_fingerprint is null then
    raise exception 'The readiness idempotency envelope is malformed.' using errcode = '22023';
  end if;
  if want_expected_version is null or want_expected_version < 0 then
    raise exception 'The expected readiness version is malformed.' using errcode = '22023';
  end if;

  -- The row may not exist yet, so a row lock alone cannot serialize two first
  -- deliveries. These transaction locks make concurrent retries converge on
  -- the receipt and make different commands for one aggregate compare versions
  -- in order. Hash collisions only serialize unrelated work; they cannot admit it.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'registration-readiness-key:' || want_tenant || ':' || key, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'registration-readiness-evaluation:' || evaluation_id, 0
  ));

  select * into earlier from private.registration_readiness_receipts r
   where r.tenant_id = want_tenant and r.idempotency_key = key;
  if found then
    if earlier.evaluation_id is distinct from evaluation_id or earlier.fingerprint is distinct from want_fingerprint then
      raise exception 'The readiness idempotency key was reused for another command.' using errcode = 'SC409';
    end if;
    return jsonb_build_object(
      'record', private.registration_readiness_record_json(want_tenant, evaluation_id),
      'receipt', jsonb_build_object(
        'id', earlier.idempotency_key, 'status', earlier.status, 'state', earlier.state,
        'recordVersion', earlier.record_version,
        'recordedAt', to_char(earlier.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'correlationId', earlier.correlation_id
      ),
      'event', jsonb_build_object(
        'eventType', earlier.event_type, 'aggregateId', earlier.evaluation_id,
        'idempotencyKey', earlier.idempotency_key, 'correlationId', earlier.correlation_id,
        'payload', earlier.event_payload
      ),
      'replayed', true
    );
  end if;

  select * into current from private.registration_readiness_evaluations e
   where e.id = evaluation_id for update;

  if not found then
    if want_expected_version <> 0 or next_version <> 1 or next_state <> 'requested'
       or next_generation <> 1 or next_projection is not null then
      raise exception 'A readiness evaluation must begin at requested version 1.' using errcode = 'SC409';
    end if;
    insert into private.registration_readiness_evaluations (
      id, tenant_id, subject_id, term_id, requested_by, state, version, generation,
      projection_version, created_at, updated_at
    ) values (
      evaluation_id, want_tenant, rec->>'subjectId', rec->>'termId', rec->>'requestedBy',
      next_state, next_version, next_generation, next_projection,
      (rec->>'createdAt')::timestamptz, (rec->>'updatedAt')::timestamptz
    );
  else
    if current.tenant_id is distinct from want_tenant then
      raise exception 'No readiness evaluation exists in this tenant.' using errcode = 'SC404';
    end if;
    if current.version <> want_expected_version or next_version <> current.version + 1 then
      raise exception 'The readiness evaluation moved.' using errcode = 'SC409';
    end if;
    if rec->>'subjectId' is distinct from current.subject_id
       or rec->>'termId' is distinct from current.term_id
       or rec->>'requestedBy' is distinct from current.requested_by
       or (rec->>'createdAt')::timestamptz is distinct from current.created_at then
      raise exception 'A readiness evaluation keeps the identity it was created with.' using errcode = 'SC409';
    end if;
    if not private.registration_readiness_edge_ok(current.state, next_state) then
      raise exception 'The readiness evaluation cannot move from % to %.', current.state, next_state using errcode = 'SC409';
    end if;
    if current.state = 'reconciling' and next_state = 'evaluating' then
      if next_generation <> current.generation + 1 then
        raise exception 'A reconciled evaluation starts a new generation.' using errcode = 'SC409';
      end if;
    elsif next_generation <> current.generation then
      raise exception 'Readiness generation changed outside reconciliation.' using errcode = 'SC409';
    end if;
    if next_state in ('ready', 'blocked', 'needs_review', 'unknown', 'stale')
       and (next_projection is null or (current.projection_version is not null and next_projection <= current.projection_version)) then
      raise exception 'An evaluated readiness outcome needs a newer projection.' using errcode = 'SC409';
    end if;
    if next_state not in ('ready', 'blocked', 'needs_review', 'unknown', 'stale')
       and next_projection is distinct from current.projection_version then
      raise exception 'Projection version changes only with an evaluated outcome.' using errcode = 'SC409';
    end if;

    update private.registration_readiness_evaluations set
      state = next_state, version = next_version, generation = next_generation,
      projection_version = next_projection, updated_at = (rec->>'updatedAt')::timestamptz
    where id = evaluation_id and tenant_id = want_tenant;
  end if;

  for task in select value from jsonb_array_elements(coalesce(rec->'reconciliationTasks', '[]'::jsonb)) loop
    insert into private.registration_readiness_tasks (
      tenant_id, evaluation_id, task_id, generation, state, opened_at, resolved_at
    ) values (
      want_tenant, evaluation_id, task->>'id', (task->>'generation')::integer,
      task->>'state', (task->>'openedAt')::timestamptz, (task->>'resolvedAt')::timestamptz
    ) on conflict (tenant_id, task_id) do update set
      state = excluded.state,
      resolved_at = excluded.resolved_at
    where private.registration_readiness_tasks.evaluation_id = excluded.evaluation_id
      and private.registration_readiness_tasks.generation = excluded.generation
      and private.registration_readiness_tasks.opened_at = excluded.opened_at
      and private.registration_readiness_tasks.state = 'open'
      and excluded.state = 'resolved';
  end loop;

  expected_payload := jsonb_build_object(
    'evaluationId', evaluation_id, 'termId', rec->>'termId', 'version', next_version
  );
  if key is null
     or receipt->>'id' is distinct from event->>'idempotencyKey'
     or (receipt->>'recordVersion')::integer is distinct from next_version
     or receipt->>'state' is distinct from next_state
     or receipt->>'correlationId' is distinct from event->>'correlationId'
     or event->>'aggregateId' is distinct from evaluation_id
     or event->>'idempotencyKey' is distinct from key
     or event->'payload' is distinct from expected_payload then
    raise exception 'The readiness receipt or event does not describe the saved record.' using errcode = '22023';
  end if;
  if receipt->>'status' is distinct from (
       case when next_state in ('requested', 'evaluating', 'reconciling') then 'pending' else 'completed' end
     ) or event->>'eventType' is distinct from (
       case
         when next_state = 'requested' then 'registration.readiness_requested'
         when next_state = 'reconciling' then 'registration.readiness_reconciliation_requested'
         else 'registration.readiness_evaluated'
       end
     ) then
    raise exception 'The readiness receipt status or event type does not match the state.' using errcode = '22023';
  end if;

  insert into private.registration_readiness_receipts (
    tenant_id, evaluation_id, idempotency_key, fingerprint, status, state,
    record_version, recorded_at, correlation_id, event_type, event_payload
  ) values (
    want_tenant, evaluation_id, key, want_fingerprint, receipt->>'status', next_state,
    next_version, (receipt->>'recordedAt')::timestamptz, receipt->>'correlationId',
    event->>'eventType', event->'payload'
  );

  audit_saved := private.gateway_write_audit_v2(
    want_tenant, rec->>'requestedBy', 'registration_readiness', event->>'eventType',
    null, receipt->>'correlationId'
  );
  if not audit_saved then raise exception 'The readiness audit row was refused.'; end if;

  perform private.emit_domain_event(
    'registration_readiness_evaluation', evaluation_id, event->>'eventType', 1,
    want_tenant, 'registration-readiness', receipt->>'correlationId', key,
    event->'payload', 'education_record',
    case when event->>'eventType' = 'registration.readiness_evaluated' then 'student_record' else 'audit' end
  );

  return jsonb_build_object(
    'record', private.registration_readiness_record_json(want_tenant, evaluation_id),
    'receipt', receipt,
    'event', event,
    'replayed', false
  );
end $$;

revoke all on function private.registration_readiness_edge_ok(text, text) from public, anon, authenticated;
revoke all on function private.registration_readiness_record_json(text, text) from public, anon, authenticated;
revoke all on function public.registration_readiness_get(text, text) from public, anon, authenticated;
revoke all on function public.registration_readiness_save(text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.registration_readiness_get(text, text) to service_role;
grant execute on function public.registration_readiness_save(text, integer, text, jsonb) to service_role;
