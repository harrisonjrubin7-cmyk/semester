-- The registration-readiness durable store (20261009160000).
-- LOCAL/DISPOSABLE DATABASES ONLY; this transaction is always rolled back.
-- How to run it: supabase/check.sh registration-readiness-store

begin;

create or replace function pg_temp.refuses(what text, stmt text, want text default null)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if want is not null and position(lower(want) in lower(sqlerrm || ' ' || sqlstate)) = 0 then
      raise exception 'FAILED: % — refused for the wrong reason: % (%)', what, sqlerrm, sqlstate;
    end if;
    raise notice 'ok  % (refused: %)', what, left(sqlerrm, 70);
    return;
  end;
  raise exception 'FAILED: % — was allowed', what;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.result(
  eid text, tenant text, version integer, state text, generation integer,
  projection integer, key text, correlation text, event_type text,
  updated text, tasks jsonb default '[]'::jsonb
)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'record', jsonb_build_object(
      'id', eid, 'tenantId', tenant, 'subjectId', 'student-1', 'termId', 'fall-2026',
      'requestedBy', 'student-1', 'state', state, 'version', version,
      'generation', generation, 'projectionVersion', projection,
      'createdAt', '2026-10-09T15:00:00.000Z', 'updatedAt', updated,
      'reconciliationTasks', tasks, 'commandLedger', '[]'::jsonb
    ),
    'receipt', jsonb_build_object(
      'id', key,
      'status', case when state in ('requested', 'evaluating', 'reconciling') then 'pending' else 'completed' end,
      'state', state, 'recordVersion', version, 'recordedAt', updated,
      'correlationId', correlation
    ),
    'event', jsonb_build_object(
      'eventType', event_type, 'aggregateId', eid, 'idempotencyKey', key,
      'correlationId', correlation,
      'payload', jsonb_build_object('evaluationId', eid, 'termId', 'fall-2026', 'version', version)
    ),
    'replayed', false
  );
$$;

insert into public.schools (id, name, email_domains) values
  ('readiness-a', 'Readiness A', array['readiness-a.example']),
  ('readiness-b', 'Readiness B', array['readiness-b.example']);

do $$
declare
  t text;
  p text;
  f text;
  saved jsonb;
  tasks jsonb;
begin
  -- The three stores and two entry points are unreachable from a browser.
  foreach t in array array[
    'registration_readiness_evaluations',
    'registration_readiness_tasks',
    'registration_readiness_receipts'
  ] loop
    perform pg_temp.counted(t || ' has row level security', (
      select relrowsecurity::int from pg_class where oid = ('private.' || t)::regclass
    ), 1);
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      perform pg_temp.counted(t || ': anon holds no ' || p,
        (select has_table_privilege('anon', 'private.' || t, p)::int), 0);
      perform pg_temp.counted(t || ': authenticated holds no ' || p,
        (select has_table_privilege('authenticated', 'private.' || t, p)::int), 0);
    end loop;
  end loop;
  foreach f in array array[
    'registration_readiness_get(text,text)',
    'registration_readiness_save(text,integer,text,jsonb)'
  ] loop
    perform pg_temp.counted(f || ': anon cannot run it',
      (select has_function_privilege('anon', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': authenticated cannot run it',
      (select has_function_privilege('authenticated', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': service role can run it',
      (select has_function_privilege('service_role', 'public.' || f, 'execute')::int), 1);
  end loop;

  saved := public.registration_readiness_save(
    'readiness-a', 0, '["requested"]',
    pg_temp.result('eval-1', 'readiness-a', 1, 'requested', 1, null,
      'request-1', 'request-01234567', 'registration.readiness_requested',
      '2026-10-09T15:00:00.000Z')
  );
  perform pg_temp.counted('the initial evaluation was stored',
    (select count(*) from private.registration_readiness_evaluations where id = 'eval-1'), 1);
  perform pg_temp.counted('its receipt was stored',
    (select count(*) from private.registration_readiness_receipts where evaluation_id = 'eval-1'), 1);
  perform pg_temp.counted('its audit evidence was stored',
    (select count(*) from private.gateway_audit where tenant_id = 'readiness-a' and correlation_id = 'request-01234567'), 1);
  perform pg_temp.counted('its outbox event was stored',
    (select count(*) from private.domain_outbox_events where aggregate_id = 'eval-1'), 1);
  perform pg_temp.counted('a save reports that it is not a replay', ((saved->>'replayed')::boolean)::int, 0);

  saved := public.registration_readiness_save(
    'readiness-a', 0, '["requested"]',
    pg_temp.result('eval-1', 'readiness-a', 1, 'requested', 1, null,
      'request-1', 'request-01234567', 'registration.readiness_requested',
      '2026-10-09T15:00:00.000Z')
  );
  perform pg_temp.counted('an exact replay reports replayed', ((saved->>'replayed')::boolean)::int, 1);
  perform pg_temp.counted('an exact replay wrote no second receipt',
    (select count(*) from private.registration_readiness_receipts where evaluation_id = 'eval-1'), 1);
  perform pg_temp.counted('an exact replay wrote no second outbox event',
    (select count(*) from private.domain_outbox_events where aggregate_id = 'eval-1'), 1);

  perform pg_temp.refuses('an idempotency key reused for another command', format(
    'select public.registration_readiness_save(%L, 0, %L, %L::jsonb)',
    'readiness-a', '["other"]', pg_temp.result('eval-1', 'readiness-a', 1, 'requested', 1, null,
      'request-1', 'request-01234567', 'registration.readiness_requested',
      '2026-10-09T15:00:00.000Z')::text
  ), 'SC409');

  perform pg_temp.counted('another tenant cannot read the evaluation',
    (public.registration_readiness_get('readiness-b', 'eval-1') is null)::int, 1);
  perform pg_temp.refuses('another tenant cannot update the evaluation', format(
    'select public.registration_readiness_save(%L, 1, %L, %L::jsonb)',
    'readiness-b', '["evaluating",null]', pg_temp.result('eval-1', 'readiness-b', 2, 'evaluating', 1, null,
      'other-1', 'request-11234567', 'registration.readiness_evaluated',
      '2026-10-09T15:01:00.000Z')::text
  ), 'SC404');

  perform public.registration_readiness_save(
    'readiness-a', 1, '["evaluating",null]',
    pg_temp.result('eval-1', 'readiness-a', 2, 'evaluating', 1, null,
      'evaluate-1', 'request-21234567', 'registration.readiness_evaluated',
      '2026-10-09T15:01:00.000Z')
  );
  perform pg_temp.refuses('reconciliation requires a completed evaluation outcome', format(
    'select public.registration_readiness_save(%L, 2, %L, %L::jsonb)',
    'readiness-a', '["reconciling",null]', pg_temp.result(
      'eval-1', 'readiness-a', 3, 'reconciling', 1, null,
      'reconcile-too-early', 'request-22234567', 'registration.readiness_reconciliation_requested',
      '2026-10-09T15:01:30.000Z'
    )::text
  ), 'cannot move');
  perform pg_temp.counted('the refused reconciliation did not move the aggregate',
    (select version from private.registration_readiness_evaluations where id = 'eval-1'), 2);
  perform pg_temp.refuses('a stale aggregate version', format(
    'select public.registration_readiness_save(%L, 1, %L, %L::jsonb)',
    'readiness-a', '["ready",1]', pg_temp.result('eval-1', 'readiness-a', 3, 'ready', 1, 1,
      'outcome-stale', 'request-31234567', 'registration.readiness_evaluated',
      '2026-10-09T15:02:00.000Z')::text
  ), 'SC409');
  perform pg_temp.counted('the stale command did not move the aggregate',
    (select version from private.registration_readiness_evaluations where id = 'eval-1'), 2);

  perform public.registration_readiness_save(
    'readiness-a', 2, '["unknown",1]',
    pg_temp.result('eval-1', 'readiness-a', 3, 'unknown', 1, 1,
      'outcome-1', 'request-41234567', 'registration.readiness_evaluated',
      '2026-10-09T15:02:00.000Z')
  );
  tasks := jsonb_build_array(jsonb_build_object(
    'id', 'eval-1:reconcile:1', 'generation', 1, 'state', 'open',
    'openedAt', '2026-10-09T15:03:00.000Z'
  ));
  perform public.registration_readiness_save(
    'readiness-a', 3, '["reconciling",null]',
    pg_temp.result('eval-1', 'readiness-a', 4, 'reconciling', 1, 1,
      'reconcile-1', 'request-51234567', 'registration.readiness_reconciliation_requested',
      '2026-10-09T15:03:00.000Z', tasks)
  );
  perform pg_temp.counted('reconciliation opened one tenant-bound task',
    (select count(*) from private.registration_readiness_tasks
      where tenant_id = 'readiness-a' and evaluation_id = 'eval-1' and state = 'open'), 1);

  tasks := jsonb_build_array(jsonb_build_object(
    'id', 'eval-1:reconcile:1', 'generation', 1, 'state', 'resolved',
    'openedAt', '2026-10-09T15:03:00.000Z', 'resolvedAt', '2026-10-09T15:04:00.000Z'
  ));
  perform public.registration_readiness_save(
    'readiness-a', 4, '["evaluating",null]',
    pg_temp.result('eval-1', 'readiness-a', 5, 'evaluating', 2, 1,
      'evaluate-2', 'request-61234567', 'registration.readiness_evaluated',
      '2026-10-09T15:04:00.000Z', tasks)
  );
  perform pg_temp.counted('the next generation resolved the task',
    (select count(*) from private.registration_readiness_tasks
      where tenant_id = 'readiness-a' and evaluation_id = 'eval-1' and state = 'resolved'), 1);
  perform pg_temp.counted('the aggregate entered generation two',
    (select generation from private.registration_readiness_evaluations where id = 'eval-1'), 2);

  -- The aggregate insert happens before event validation inside the function.
  -- A malformed descriptor must still roll the whole statement back.
  perform pg_temp.refuses('an invalid event rolls back the aggregate too', format(
    'select public.registration_readiness_save(%L, 0, %L, %L::jsonb)',
    'readiness-a', '["requested"]',
    jsonb_set(
      pg_temp.result('eval-atomic', 'readiness-a', 1, 'requested', 1, null,
        'atomic-1', 'request-71234567', 'registration.readiness_requested',
        '2026-10-09T15:00:00.000Z'),
      '{event,payload,version}', '99'::jsonb
    )::text
  ), 'does not describe');
  perform pg_temp.counted('the failed event left no aggregate',
    (select count(*) from private.registration_readiness_evaluations where id = 'eval-atomic'), 0);
  perform pg_temp.counted('the failed event left no receipt',
    (select count(*) from private.registration_readiness_receipts where evaluation_id = 'eval-atomic'), 0);

  -- Control: the refusal probe must itself fail on an allowed statement.
  begin
    perform pg_temp.refuses('control: an allowed statement', 'select 1');
    raise exception 'probe broken: allowed statement passed as refused';
  exception when others then
    if sqlerrm not like 'FAILED: control: an allowed statement%' then raise; end if;
    raise notice 'ok  control: the refusal probe fails on an allowed statement';
  end;
end $$;

rollback;
