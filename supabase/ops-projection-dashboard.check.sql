-- ops_projection_dashboard (20261012000000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What it proves
--   * Only console:operate at platform scope reads it: a stranger, a
--     school-scoped operator and a caller with no identity are refused with
--     insufficient_privilege (an error, never an empty answer); anon cannot
--     execute it.
--   * A model with no watermark is `unknown`, never fresh; the same SLO rule
--     `read_tenant_projection` applies gives fresh / stale / failed, and a
--     rebuild in progress is stale. The overall freshness is the worst of them.
--   * events behind, oldest pending age, dead letters and last error are
--     counted from the outbox for the right event type and consumer only, and
--     not from published, dead-lettered, already-received or unrelated events.
--   * The last rebuild and its parity are reported, the latest run winning.
--   * An event payload, an aggregate id, a tenant id and a student's data never
--     appear in what it returns; a very long error is capped.
--   * It reads and writes nothing it should not: it is declared stable and the
--     outbox, receipts, watermarks and rebuild runs are unchanged by a call.
--   * Every active read model has an event-source entry, so a new projection
--     cannot be registered without teaching the dashboard.
--
-- Controls (each probe is shown able to fail)
--   * `fresh` is reachable: a current watermark reads fresh, so the stale and
--     failed readings are not just the only thing the function can say.
--   * A planted active model with no event-source entry reads
--     eventSourceMapped = false with a warning, so the coverage guard can fail.
--   * Planted payload and tenant markers are in the outbox, so their absence
--     from the output is a finding about the function, not an empty fixture.
--   * An unrelated event type and a published event sit pending-looking in the
--     outbox and are not counted.
--
-- What it does not do
--   * It does not run the projector worker or prove one is scheduled.
--   * It does not check the SLO numbers themselves; those are registry data.
--
--   How to run it: supabase/check.sh ops-projection-dashboard

begin;

create or replace function pg_temp.become(who uuid, assurance text default 'aal2')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', assurance)::text, true);
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

create temp table ids (k text primary key, v uuid not null);

-- One call as a user, returned as jsonb, with the role put back.
create or replace function pg_temp.read_as(who uuid, assurance text default 'aal2')
returns jsonb language plpgsql as $$
declare d jsonb;
begin
  perform pg_temp.become(who, assurance);
  select public.ops_projection_dashboard() into d;
  perform pg_temp.nobody();
  return d;
end $$;

create or replace function pg_temp.model(d jsonb, want text)
returns jsonb language sql as $$
  select p from jsonb_array_elements(d -> 'data' -> 'projections') p where p ->> 'projection' = want
$$;

create or replace function pg_temp.expect(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', msg; end if;
end $$;

do $$
declare
  operator uuid := pg_temp.newuser('operator@dashboard.example');
  school_op uuid := pg_temp.newuser('schoolop@dashboard.example');
  stranger uuid := pg_temp.newuser('stranger@dashboard.example');
  student uuid := pg_temp.newuser('zq-dash-student@dashboard.example');
begin
  insert into public.schools (id, name, email_domains)
  values ('zq-dash-tenant', 'Dashboard Tenant', array['dashboard.example']);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator,  'platform_admin',         'platform', '',               'platform'),
    (school_op, 'implementation_manager', 'school',   'zq-dash-tenant', 'platform');
  insert into public.notes (user_id, id, data) values (student, 'n1', '{"title":"zq-dash-student-note"}');
  insert into ids values ('operator', operator), ('school_op', school_op),
                         ('stranger', stranger), ('student', student);
end $$;

-- Privileges and refusals.
do $$
declare who text; denied boolean;
begin
  if has_function_privilege('anon', 'public.ops_projection_dashboard()', 'execute') then
    raise exception 'FAILED: anon can execute the dashboard';
  end if;
  if not has_function_privilege('authenticated', 'public.ops_projection_dashboard()', 'execute') then
    raise exception 'FAILED: signed-in callers cannot reach the dashboard to be refused by it';
  end if;

  foreach who in array array['stranger', 'school_op'] loop
    denied := false;
    begin
      perform pg_temp.read_as((select v from ids where k = who));
    exception when insufficient_privilege then denied := true;
    end;
    perform pg_temp.nobody();
    perform pg_temp.expect(denied, who || ' read the dashboard');
  end loop;

  -- The platform operator's own grant is dormant below aal2 (privileged_role_mfa): refused, not served.
  denied := false;
  begin
    perform pg_temp.read_as((select v from ids where k = 'operator'), 'aal1');
  exception when insufficient_privilege then denied := true;
  end;
  perform pg_temp.nobody();
  perform pg_temp.expect(denied, 'the platform operator read the dashboard at aal1');
  -- ...and the same operator at aal2 is served, so the refusal above is the MFA gate and not a broken fixture.
  perform pg_temp.expect(jsonb_typeof(pg_temp.read_as((select v from ids where k = 'operator')) -> 'data' -> 'projections') = 'array',
    'control: the platform operator at aal2 was not served');

  -- No identity at all: a role with no subject must be refused, not given an empty board.
  denied := false;
  begin
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role authenticated';
    perform public.ops_projection_dashboard();
  exception when insufficient_privilege then denied := true;
  end;
  perform pg_temp.nobody();
  perform pg_temp.expect(denied, 'a caller with no identity read the dashboard');
  raise notice 'ok  anon cannot execute it; a stranger, a school-scoped operator, the platform operator at aal1, and no identity are refused';
end $$;

-- Coverage guard: every active read model has an event-source entry. Control first.
do $$
declare d jsonb; unmapped text;
begin
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(jsonb_array_length(d -> 'data' -> 'projections') >= 2,
    'control: the dashboard returned fewer than the two real read models');

  insert into private.read_model_registry
    (name, version, capability, scope_kind, freshness_slo_seconds, source_tables, redaction_profile, status)
  values ('zz_unmapped_model', 1, 'tenant:configure', 'school', 300, '{}', 'check', 'active');
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect((pg_temp.model(d, 'zz_unmapped_model') ->> 'eventSourceMapped')::boolean is false,
    'control: a planted model with no event source did not read eventSourceMapped = false');
  perform pg_temp.expect(
    exists (select 1 from jsonb_array_elements_text(d -> 'warnings') w where w like 'zz_unmapped_model has no event source mapped%'),
    'control: the unmapped model produced no warning');
  perform pg_temp.expect(pg_temp.model(d, 'zz_unmapped_model') -> 'eventsBehind' = 'null'::jsonb,
    'an unmapped model reported a number for eventsBehind (zero would read as healthy)');
  delete from private.read_model_registry where name = 'zz_unmapped_model';

  d := pg_temp.read_as((select v from ids where k = 'operator'));
  select string_agg(p ->> 'projection', ', ') into unmapped
    from jsonb_array_elements(d -> 'data' -> 'projections') p
   where (p ->> 'eventSourceMapped')::boolean is not true;
  if unmapped is not null then
    raise exception 'FAILED: active read model(s) with no event-source entry in ops_projection_dashboard: %', unmapped;
  end if;
  raise notice 'ok  every active read model has an event source; the guard is shown able to fail';
end $$;

-- From here the two real models are the whole board, so overall readings are deterministic.
update private.read_model_registry set status = 'deprecated'
 where status = 'active' and name not in ('ops_tenant_entitlements', 'ops_tenant_rollout');

-- No watermark: unknown, never fresh.
do $$
declare d jsonb; e jsonb; r jsonb;
begin
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  e := pg_temp.model(d, 'ops_tenant_entitlements');
  r := pg_temp.model(d, 'ops_tenant_rollout');
  perform pg_temp.expect(e ->> 'freshness' = 'unknown' and r ->> 'freshness' = 'unknown',
    'a model with no watermark did not read unknown');
  perform pg_temp.expect(d -> 'meta' ->> 'freshness' = 'unknown', 'overall freshness with no watermark was not unknown');
  perform pg_temp.expect(e ->> 'workerStatus' = 'unknown', 'workerStatus was not unknown');
  perform pg_temp.expect((e ->> 'eventsBehind')::int = 0 and (e ->> 'deadLetters')::int = 0,
    'an empty outbox did not read zero behind and zero dead letters');
  perform pg_temp.expect(
    exists (select 1 from jsonb_array_elements_text(d -> 'warnings') w where w like 'ops_tenant_entitlements has never run%'),
    'no never-run warning for a model with no watermark');
  raise notice 'ok  no watermark reads unknown, overall unknown, with a never-run warning';
end $$;

-- Freshness: fresh is reachable (control), then stale / failed / rebuilding, and the overall is the worst.
do $$
declare d jsonb;
begin
  insert into private.projection_watermark (projection, version, status, last_occurred_at, last_processed_at)
  values ('ops_tenant_entitlements', 1, 'idle', now() - interval '1 minute', now()),
         ('ops_tenant_rollout',      1, 'idle', now() - interval '1 minute', now());
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(pg_temp.model(d, 'ops_tenant_entitlements') ->> 'freshness' = 'fresh'
    and pg_temp.model(d, 'ops_tenant_rollout') ->> 'freshness' = 'fresh'
    and d -> 'meta' ->> 'freshness' = 'fresh',
    'control: current watermarks did not read fresh, so stale and failed prove nothing');

  update private.projection_watermark set last_occurred_at = now() - interval '1 hour'
   where projection = 'ops_tenant_rollout';
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(pg_temp.model(d, 'ops_tenant_rollout') ->> 'freshness' = 'stale'
    and d -> 'meta' ->> 'freshness' = 'stale', 'a watermark past its SLO did not read stale');
  perform pg_temp.expect((pg_temp.model(d, 'ops_tenant_rollout') ->> 'lagSeconds')::int >= 3590,
    'lagSeconds did not reflect an hour-old last event');

  update private.projection_watermark set status = 'failed' where projection = 'ops_tenant_rollout';
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(pg_temp.model(d, 'ops_tenant_rollout') ->> 'freshness' = 'failed'
    and d -> 'meta' ->> 'freshness' = 'failed', 'a failed worker did not read failed, overall failed');

  update private.projection_watermark set status = 'idle', last_occurred_at = now() - interval '1 minute'
   where projection = 'ops_tenant_rollout';
  update private.projection_watermark set status = 'rebuilding' where projection = 'ops_tenant_entitlements';
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(pg_temp.model(d, 'ops_tenant_entitlements') ->> 'freshness' = 'stale'
    and exists (select 1 from jsonb_array_elements_text(d -> 'warnings') w where w like '%is rebuilding%'),
    'a rebuild in progress did not read stale with a rebuilding warning');

  update private.projection_watermark set status = 'idle' where projection = 'ops_tenant_entitlements';
  raise notice 'ok  fresh is reachable; stale, failed and rebuilding read as such; overall is the worst';
end $$;

-- Events behind, dead letters, last error: counted for the right type and consumer only.
do $$
declare d jsonb; e jsonb; r jsonb; whole text; ev uuid; dl uuid;
begin
  -- entitlement.changed: one pending, one pending but already received, one published, one dead-lettered.
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, payload, data_classification, retention_class, occurred_at)
  values
    ('tenant_policy', 'zq-aggregate-1', 'entitlement.changed', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '10 minutes');
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, payload, data_classification, retention_class, occurred_at)
  values
    ('tenant_policy', 'zq-aggregate-2', 'entitlement.changed', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '9 minutes')
  returning id into ev;
  insert into private.domain_event_receipts (consumer, event_id, outcome) values ('ops.tenant-entitlements.v1', ev, 'processed');
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, payload, data_classification, retention_class, occurred_at, published_at)
  values
    ('tenant_policy', 'zq-aggregate-3', 'entitlement.changed', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '8 minutes', now());
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, payload, data_classification, retention_class, occurred_at, dead_lettered_at, last_error)
  values
    ('tenant_policy', 'zq-aggregate-4', 'entitlement.changed', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '7 minutes',
     now() - interval '1 minute', 'tenant entitlement projector transaction failed')
  returning id into dl;
  -- tenant_rollout.changed: one pending. An unrelated type pending too, which must count for neither.
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, payload, data_classification, retention_class, occurred_at)
  values
    ('tenant_rollout', 'zq-aggregate-5', 'tenant_rollout.changed', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '2 minutes'),
    ('approval_request', 'zq-aggregate-6', 'approval.requested', 1, 'production', 'zq-dash-tenant', 'check',
     'corr-0123456789ab', '{"secret":"zq-payload-marker"}', 'internal', 'operational', now() - interval '3 minutes');

  d := pg_temp.read_as((select v from ids where k = 'operator'));
  e := pg_temp.model(d, 'ops_tenant_entitlements');
  r := pg_temp.model(d, 'ops_tenant_rollout');

  perform pg_temp.expect((e ->> 'eventsBehind')::int = 1,
    'entitlements eventsBehind should count only the one pending, un-received, un-published event, got ' || (e ->> 'eventsBehind'));
  perform pg_temp.expect((e ->> 'deadLetters')::int = 1, 'entitlements deadLetters should be 1');
  perform pg_temp.expect(e ->> 'lastError' = 'tenant entitlement projector transaction failed',
    'entitlements lastError was not the stored sanitized error');
  perform pg_temp.expect((e ->> 'oldestPendingSeconds')::int between 590 and 700,
    'oldestPendingSeconds should be about ten minutes, got ' || coalesce(e ->> 'oldestPendingSeconds', 'null'));
  perform pg_temp.expect((r ->> 'eventsBehind')::int = 1 and (r ->> 'deadLetters')::int = 0
    and r -> 'lastError' = 'null'::jsonb,
    'rollout should have one behind, no dead letters and no error (the unrelated event and the entitlement events must not leak in)');

  -- A very long error is capped.
  update private.domain_outbox_events set last_error = repeat('x', 400) where id = dl;
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  perform pg_temp.expect(length(pg_temp.model(d, 'ops_tenant_entitlements') ->> 'lastError') = 200,
    'a long error was not capped at 200 characters');

  -- Nothing sensitive in the whole answer: payload, aggregate ids, tenant id, the student's data.
  whole := d::text;
  perform pg_temp.expect(position('zq-payload-marker' in whole) = 0, 'an event payload appeared in the dashboard');
  perform pg_temp.expect(position('zq-aggregate' in whole) = 0, 'an aggregate id appeared in the dashboard');
  perform pg_temp.expect(position('zq-dash-tenant' in whole) = 0, 'a tenant id appeared in the dashboard');
  perform pg_temp.expect(position('zq-dash-student' in whole) = 0, 'a student marker appeared in the dashboard');
  perform pg_temp.expect(
    (select count(*) from private.domain_outbox_events where payload::text like '%zq-payload-marker%') = 6,
    'control: the planted payload markers are not all in the outbox, so their absence proves nothing');
  raise notice 'ok  events behind, dead letters, last error and oldest pending are counted per type and consumer; long errors are capped; no payload, aggregate, tenant or student data';
end $$;

-- Last rebuild and parity: the latest run wins.
do $$
declare d jsonb; e jsonb;
begin
  insert into private.projection_rebuild_run
    (projection, from_version, to_version, mode, status, started_at, finished_at, parity_ok, events_replayed)
  values
    ('ops_tenant_entitlements', 1, 2, 'shadow', 'succeeded', now() - interval '2 days', now() - interval '2 days', true, 10),
    ('ops_tenant_entitlements', 1, 2, 'shadow', 'failed',    now() - interval '1 hour', now() - interval '59 minutes', false, 12);
  d := pg_temp.read_as((select v from ids where k = 'operator'));
  e := pg_temp.model(d, 'ops_tenant_entitlements');
  perform pg_temp.expect(e -> 'lastRebuild' ->> 'status' = 'failed' and (e -> 'lastRebuild' ->> 'parityOk')::boolean is false,
    'the latest rebuild (failed, no parity) was not the one reported');
  perform pg_temp.expect(
    exists (select 1 from jsonb_array_elements_text(d -> 'warnings') w where w like 'ops_tenant_entitlements last rebuild did not match%'),
    'a rebuild without parity produced no warning');
  perform pg_temp.expect(pg_temp.model(d, 'ops_tenant_rollout') -> 'lastRebuild' = 'null'::jsonb,
    'a model that never rebuilt reported a rebuild');
  raise notice 'ok  the latest rebuild and its parity are reported, with a warning when parity failed';
end $$;

-- It is a read: stable, and nothing changes by calling it.
do $$
declare before_counts text; after_counts text;
begin
  perform pg_temp.expect(
    (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'ops_projection_dashboard') = 's',
    'ops_projection_dashboard is not declared stable');
  select (select count(*) from private.domain_outbox_events)::text || '/' ||
         (select count(*) from private.domain_event_receipts) || '/' ||
         (select count(*) from private.projection_watermark) || '/' ||
         (select count(*) from private.projection_rebuild_run) || '/' ||
         (select coalesce(sum(publish_attempts), 0) from private.domain_outbox_events)
    into before_counts;
  perform pg_temp.read_as((select v from ids where k = 'operator'));
  select (select count(*) from private.domain_outbox_events)::text || '/' ||
         (select count(*) from private.domain_event_receipts) || '/' ||
         (select count(*) from private.projection_watermark) || '/' ||
         (select count(*) from private.projection_rebuild_run) || '/' ||
         (select coalesce(sum(publish_attempts), 0) from private.domain_outbox_events)
    into after_counts;
  perform pg_temp.expect(before_counts = after_counts, 'a call changed the outbox, receipts, watermarks or rebuild runs');
  raise notice 'ok  it is stable and changes nothing';
end $$;

rollback;
