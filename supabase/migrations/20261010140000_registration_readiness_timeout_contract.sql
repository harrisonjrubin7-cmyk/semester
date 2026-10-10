-- Align the already-deployed readiness persistence RPC with the reviewed command contract.
-- This source migration is held: merging main auto-applies it to the canonical Supabase project.
-- It does not activate an evaluator, tenant, provider, or official registration write.
--
-- During a rolling deploy, evaluating accepts both the legacy evaluated event and the new requested event.\n-- Timeout recovery records evaluating -> unknown(reason=evaluator_timeout) without
-- fabricating a source projection, then the ordinary unknown -> reconciling edge.
-- The function remains service-role-only and preserves the existing transaction,
-- advisory locks, tenant checks, CAS, receipts, audit, and outbox behavior.

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
    if current.state = 'evaluating'
       and next_state = 'unknown'
       and event->'payload'->>'reason' = 'evaluator_timeout' then
      if next_projection is distinct from current.projection_version then
        raise exception 'A timed-out readiness evaluation cannot invent a projection.' using errcode = 'SC409';
      end if;
    elsif next_state in ('ready', 'blocked', 'needs_review', 'unknown', 'stale')
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
  if current.state = 'evaluating'
     and next_state = 'unknown'
     and event->'payload'->>'reason' = 'evaluator_timeout' then
    expected_payload := expected_payload || jsonb_build_object('reason', 'evaluator_timeout');
  end if;
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
     ) or (
       next_state = 'evaluating'
       and event->>'eventType' not in ('registration.readiness_requested', 'registration.readiness_evaluated')
     ) or (
       next_state <> 'evaluating'
       and event->>'eventType' is distinct from (
         case
           when next_state = 'requested' then 'registration.readiness_requested'
           when next_state = 'reconciling' then 'registration.readiness_reconciliation_requested'
           else 'registration.readiness_evaluated'
         end
       )
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
