-- Retention, legal hold and health for the integration tables, run as the
-- service role that will call them. LOCAL/DISPOSABLE DATABASES ONLY.
--
--   supabase/check.sh integration-hardening

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.sweep()
returns void language plpgsql as $$
begin
  execute 'set local role service_role';
  perform * from public.integration_retention_sweep();
  execute 'reset role';
end $$;

create or replace function pg_temp.governance(deadline timestamptz)
returns jsonb language sql as $$
  select jsonb_build_object('_governance', jsonb_build_object(
    'sourceStandard', 'test@1', 'sourceOwner', 'Registrar',
    'permittedPurposes', jsonb_build_array('scope.sis.catalog_read'),
    'aiEligibility', 'denied_by_default', 'writeAuthority', 'source-system-only',
    'retrievedAt', now(), 'expiresAt', now() + interval '1 hour',
    'retentionPolicyId', case when deadline is null then 'canonical:tenant-lifetime' else 'integration:test@1' end,
    'retentionExpiresAt', deadline, 'consentPurpose', null)::text);
$$;

do $$
declare live uuid; held uuid; run_old uuid; run_new uuid; src uuid; integ uuid; student uuid; n bigint; s boolean; orphan uuid; hold_id uuid; kind text;
begin
  insert into public.schools (id, name, email_domains) values ('ih-u', 'Hardening University', array['ih-u.example']);
  integ := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (integ, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'integ@ih-u.example', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values (integ, 'integ', 'ih-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (integ, 'integration_admin', 'school', 'ih-u', 'institution');
  student := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ih-u.example', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values (student, 'student', 'ih-u');

  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
    last_successful_sync_at, freshness_target)
  values ('ih-u', 'sis', 'SIS', 'Live', 'healthy', now() - interval '300 days', now() - interval '3 days', interval '1 day')
  returning id into live;
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
    last_successful_sync_at, legal_hold, legal_hold_reason)
  values ('ih-u', 'lms', 'LMS', 'Held', 'healthy', now() - interval '300 days', now() - interval '10 minutes', true, 'Litigation hold 2026-14')
  returning id into held;

  -- Old and new of everything, on both connections.
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at)
  values ('ih-u', live, 'scheduled', 'batch', 'succeeded', now() - interval '200 days', now() - interval '200 days') returning id into run_old;
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at)
  values ('ih-u', live, 'scheduled', 'batch', 'succeeded', now() - interval '1 day', now() - interval '1 day') returning id into run_new;
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at)
  values ('ih-u', held, 'scheduled', 'batch', 'succeeded', now() - interval '200 days', now() - interval '200 days');
  insert into public.integration_sync_errors (tenant_id, sync_run_id, connection_id, error_category, sanitized_message, created_at)
  values ('ih-u', run_old, live, 'unknown', 'old', now() - interval '200 days'),
         ('ih-u', run_new, live, 'unknown', 'new', now() - interval '1 day'),
         ('ih-u', null, live, 'unknown', 'open', now() - interval '2 days');
  insert into public.integration_webhook_events (tenant_id, connection_id, event_type, idempotency_key, payload_hash, processed_at, processing_status)
  values ('ih-u', live, 'x', 'evt-old-00001', 'sha256:' || repeat('a', 64), now() - interval '40 days', 'processed'),
         ('ih-u', live, 'x', 'evt-new-00001', 'sha256:' || repeat('b', 64), now() - interval '1 day', 'processed'),
         ('ih-u', held, 'x', 'evt-held-0001', 'sha256:' || repeat('c', 64), now() - interval '40 days', 'processed');
  insert into public.integration_dead_letter_events (tenant_id, connection_id, reason, resolved_at)
  values ('ih-u', live, 'old resolved', now() - interval '100 days'),
         ('ih-u', live, 'still open', null);
  insert into public.source_records (tenant_id, connection_id, source_type, source_name, source_of_truth)
  values ('ih-u', live, 'connected_institutional', 'Term feed', 'Registrar') returning id into src;
  insert into public.source_snapshots (tenant_id, source_record_id, snapshot_hash, retention_expires_at)
  values ('ih-u', src, 'sha256:' || repeat('d', 64), now() - interval '1 day'),
         ('ih-u', src, 'sha256:' || repeat('e', 64), now() + interval '1 day');
  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, connection_id,
    source_system, source_record_id, source_of_truth, external_deleted_at)
  values ('ih-u', 'term', 't-gone', live, 'SIS', 'g1', 'Registrar', now() - interval '40 days'),
         ('ih-u', 'term', 't-recent', live, 'SIS', 'g2', 'Registrar', now() - interval '5 days'),
         ('ih-u', 'term', 't-live', live, 'SIS', 'g3', 'Registrar', null),
         ('ih-u', 'term', 't-held', held, 'LMS', 'g4', 'LMS', now() - interval '40 days');

  -- Live expiry, future expiry, null clocks, malformed legacy data and holds.
  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, connection_id,
    source_system, source_record_id, source_of_truth, display)
  values ('ih-u', 'term', 'expired-live', live, 'SIS', 'g5', 'Registrar',
           pg_temp.governance(now() - interval '1 day')),
         ('ih-u', 'term', 'unexpired-live', live, 'SIS', 'g6', 'Registrar',
           pg_temp.governance(now() + interval '1 day')),
         ('ih-u', 'term', 'no-clock', live, 'LMS', 'g7', 'LMS',
           pg_temp.governance(null)),
         ('ih-u', 'term', 'legacy-metadata', live, 'SIS', 'g8', 'Registrar',
           jsonb_build_object('_governance', 'legacy non-JSON string')),
         ('ih-u', 'term', 'invalid-clock', live, 'SIS', 'g9', 'Registrar',
           jsonb_build_object('_governance', jsonb_build_object('retentionExpiresAt', 'not-a-timestamp')::text)),
         ('ih-u', 'term', 'expired-held', held, 'SIS', 'g10', 'Registrar',
           pg_temp.governance(now() - interval '1 day'));

  -- The worker is the service role, and the rows it writes take a public id
  -- from a default. Codex found on #779 that the default's function was
  -- executable only by `authenticated`, so every worker run failed opening.
  execute 'set local role service_role';
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode)
  values ('ih-u', live, 'scheduled', 'batch');
  insert into public.source_records (tenant_id, connection_id, source_type, source_name, source_of_truth)
  values ('ih-u', live, 'connected_institutional', 'Worker feed', 'Registrar');
  execute 'reset role';
  raise notice 'ok  the service role opens a run and records a source';
  delete from public.integration_sync_runs where connection_id = live and completed_at is null;
  delete from public.source_records where source_name = 'Worker feed';

  -- Who may call ------------------------------------------------------------
  perform pg_temp.counted('a signed-in account can run the sweep',
    has_function_privilege('authenticated', 'public.integration_retention_sweep()', 'execute')::int, 0);
  perform pg_temp.counted('a signed-in account can read health',
    has_function_privilege('authenticated', 'public.integration_health()', 'execute')::int, 0);
  perform pg_temp.counted('a signed-in account can set a legal hold',
    has_column_privilege('authenticated', 'public.integration_connections', 'legal_hold', 'UPDATE')::int, 0);

  -- Health, before the sweep --------------------------------------------------
  execute 'set local role service_role';
  select h.stale into s from public.integration_health() h where h.connection = (select public_id from public.integration_connections where id = live);
  perform pg_temp.counted('a live connection three days past a one-day target is stale', s::int, 1);
  select h.stale into s from public.integration_health() h where h.connection = (select public_id from public.integration_connections where id = held);
  perform pg_temp.counted('one synced ten minutes ago is not', s::int, 0);
  select h.open_errors into n from public.integration_health() h where h.connection = (select public_id from public.integration_connections where id = live);
  perform pg_temp.counted('open errors are counted', n, 3);
  execute 'reset role';

  -- The sweep ---------------------------------------------------------------
  perform pg_temp.sweep();

  select count(*) into n from public.integration_sync_runs where connection_id = live;
  perform pg_temp.counted('an old run goes and a recent one stays', n, 1);
  select count(*) into n from public.integration_sync_errors where connection_id = live;
  perform pg_temp.counted('old errors go (with their run); recent and open ones stay', n, 2);
  select count(*) into n from public.integration_webhook_events where connection_id = live;
  perform pg_temp.counted('an event processed forty days ago goes', n, 1);
  select count(*) into n from public.integration_dead_letter_events where connection_id = live;
  perform pg_temp.counted('a resolved dead letter goes; an open one never does', n, 1);
  select count(*) into n from public.source_snapshots where source_record_id = src;
  perform pg_temp.counted('an expired snapshot goes', n, 1);
  select count(*) into n from public.canonical_entity_references where connection_id = live;
  perform pg_temp.counted('source tombstones and expired live references go; other live rows stay', n, 6);
  select count(*) into n from public.canonical_entity_references where canonical_entity_id = 'expired-live';
  perform pg_temp.counted('an expired live governance deadline is enforced', n, 0);

  select count(*) into n from public.integration_sync_runs where connection_id = held;
  perform pg_temp.counted('nothing old on a held connection goes: runs', n, 1);
  select count(*) into n from public.integration_webhook_events where connection_id = held;
  perform pg_temp.counted('events', n, 1);
  select count(*) into n from public.canonical_entity_references where connection_id = held;
  perform pg_temp.counted('references, including expired live governance', n, 2);

  select count(*) into n from public.integration_retention_runs where tenant_id = 'ih-u' and connections_held = 1 and runs_deleted = 1 and references_deleted = 2;
  perform pg_temp.counted('the sweep records what it did', n, 1);

  -- The integration admin can read the record of the sweep, nobody else's.
  perform set_config('request.jwt.claims', json_build_object('sub', integ::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.integration_retention_runs;
  execute 'reset role';
  perform pg_temp.counted('the integration admin reads the sweep record', n, 1);
  perform set_config('request.jwt.claims', json_build_object('sub', student::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.integration_retention_runs;
  execute 'reset role';
  perform pg_temp.counted('a student at the same school reads it', n, 0);

  update public.integration_connections set legal_hold = false where id = held;
  perform pg_temp.sweep();
  select count(*) into n from public.canonical_entity_references where connection_id = held;
  perform pg_temp.counted('releasing a hold permits expiry and tombstone deletion', n, 0);
  update public.integration_connections set legal_hold = true where id = held;

  -- A hold needs its reason.
  begin
    update public.integration_connections set legal_hold_reason = null where id = held;
    raise exception 'FAILED: a hold without a reason was accepted';
  exception when check_violation then
    raise notice 'ok  a hold without a reason is refused';
  end;
  -- Central holds protect expiry, independently of the old connection flag.
  perform set_config('request.jwt.claims', '{}', true);
  insert into public.schools (id, name, email_domains) values ('ih-orphan', 'Orphan University', array['ih-orphan.example']);
  for kind in select unnest(array['account', 'tenant', 'platform']) loop
    insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id,
      connection_id, source_system, source_record_id, source_of_truth, display)
    values ('ih-u', 'enrollment', 'held-expiry', student, live, 'SIS', 'held-expiry', 'Registrar',
      pg_temp.governance(now() - interval '1 day')),
      ('ih-orphan', 'term', 'unheld-expiry', null, null, 'SIS', 'unheld-expiry', 'Registrar',
      pg_temp.governance(now() - interval '1 day'));
    insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values (kind, case kind when 'account' then student::text when 'tenant' then 'ih-u' else '' end,
      case when kind = 'platform' then null else 'ih-u' end, 'Retention test', 'rollback-only', integ) returning id into hold_id;
    perform pg_temp.sweep();
    select count(*) into n from public.canonical_entity_references where canonical_entity_id = 'held-expiry';
    perform pg_temp.counted(kind || ' hold preserves expired live evidence', n, 1);
    select count(*) into n from public.canonical_entity_references where canonical_entity_id = 'unheld-expiry';
    perform pg_temp.counted(kind || ' hold only stops its covered scope', n, case when kind = 'platform' then 1 else 0 end);
    update public.legal_holds set released_by = student, release_reason = 'Test matter closed' where id = hold_id;
    perform pg_temp.sweep();
    select count(*) into n from public.canonical_entity_references where canonical_entity_id in ('held-expiry', 'unheld-expiry');
    perform pg_temp.counted('released ' || kind || ' hold permits retention expiry', n, 0);
  end loop;
  -- The last connection can be gone while references and snapshots remain.
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
  values ('ih-orphan', 'sis', 'SIS', 'Last connection') returning id into orphan;
  insert into public.source_records (tenant_id, connection_id, source_type, source_name, source_of_truth)
  values ('ih-orphan', orphan, 'connected_institutional', 'Orphan source', 'Registrar') returning id into src;
  insert into public.source_snapshots (tenant_id, source_record_id, snapshot_hash, retention_expires_at)
  values ('ih-orphan', src, 'sha256:' || repeat('f', 64), now() - interval '1 day');
  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, connection_id,
    source_system, source_record_id, source_of_truth, external_deleted_at, display)
  values ('ih-orphan', 'term', 'orphan-expiry', orphan, 'SIS', 'orphan-expiry', 'Registrar', null,
      pg_temp.governance(now() - interval '1 day')),
    ('ih-orphan', 'term', 'orphan-tombstone', orphan, 'SIS', 'orphan-tombstone', 'Registrar', now() - interval '40 days', '{}'::jsonb);
  update public.integration_connections set legal_hold = true, legal_hold_reason = 'Preserve evidence' where id = orphan;
  begin
    delete from public.integration_connections where id = orphan;
    raise exception 'FAILED: deleting a held connection erased its hold';
  exception when object_in_use then
    raise notice 'ok  a held connection cannot be deleted';
  end;
  perform pg_temp.sweep();
  select count(*) into n from public.canonical_entity_references where connection_id = orphan;
  perform pg_temp.counted('a refused connection deletion preserves held evidence', n, 2);
  update public.integration_connections set legal_hold = false where id = orphan;
  delete from public.integration_connections where id = orphan;
  perform pg_temp.sweep();
  select count(*) into n from public.canonical_entity_references where tenant_id = 'ih-orphan';
  perform pg_temp.counted('expiry and tombstones are swept after the last connection is removed', n, 0);
  select count(*) into n from public.source_snapshots where tenant_id = 'ih-orphan';
  perform pg_temp.counted('orphan source snapshots are also swept', n, 0);
end $$;

rollback;
