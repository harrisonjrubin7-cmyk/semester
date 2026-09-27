-- The permission matrix, walked table by table rather than case by case.
--
-- The other integration suites prove particular boundaries with particular
-- rows. This one seeds one row in every school-bound integration table and
-- asks every table the same three questions as four accounts: what can you
-- see, can you change it, can you delete it. A table added later and left out
-- of the list below is the gap this cannot see, so the list is also checked
-- against the catalog. LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
--   supabase/check.sh integration-rls-matrix

begin;

create or replace function pg_temp.as_user(who uuid)
returns void language plpgsql as $$
begin
  if who is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

-- Rows visible, or -1 if the table cannot be read at all.
create or replace function pg_temp.visible(who uuid, tbl text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_user(who);
  execute format('select count(*) from public.%I', tbl) into n;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

-- Rows changed by a statement, or -1 if it was refused outright.
create or replace function pg_temp.changed(who uuid, statement text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.as_user(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

do $$
declare
  student uuid; other uuid; integ uuid; integ_b uuid;
  conn uuid; run uuid; evt uuid; src uuid; recon uuid; cand uuid;
  tbl text; want_student bigint; got bigint; failures text[] := '{}';
  -- Every school-bound table the integration work added, with how many of
  -- the seeded rows a student at the same school should see.
  matrix constant jsonb := '{
    "integration_connections": 0, "integration_scopes": 0, "integration_mappings": 0,
    "integration_sync_runs": 0, "integration_sync_errors": 0, "integration_webhook_events": 0,
    "integration_dead_letter_events": 0, "integration_retention_runs": 0,
    "source_records": 0, "source_snapshots": 0, "source_freshness_events": 1,
    "canonical_entity_references": 0, "feature_kill_switch": 1,
    "integration_reconciliation_runs": 0, "integration_reconciliation_discrepancies": 0,
    "integration_schema_fingerprints": 0, "integration_schema_drift_events": 0,
    "integration_duplicate_candidates": 0, "integration_duplicate_resolutions": 0,
    "integration_source_owners": 0, "integration_mapping_versions": 0
  }';
begin
  insert into public.schools (id, name, email_domains) values
    ('mx-a', 'Matrix A', array['mx-a.example']), ('mx-b', 'Matrix B', array['mx-b.example']);
  student := pg_temp.newuser('student@mx-a.example', 'mx-a');
  other   := pg_temp.newuser('other@mx-a.example', 'mx-a');
  integ   := pg_temp.newuser('integ@mx-a.example', 'mx-a');
  integ_b := pg_temp.newuser('integ@mx-b.example', 'mx-b');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (integ, 'integration_admin', 'school', 'mx-a', 'institution'),
    (integ_b, 'integration_admin', 'school', 'mx-b', 'institution');

  -- One row in each, at school A. The canonical reference belongs to another
  -- student; the source record is T2, so neither is the student's to read.
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, approved_at, status)
  values ('mx-a', 'sis', 'SIS', 'SIS', now(), 'healthy') returning id into conn;
  insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
  values ('mx-a', conn, 'scope.sis.term_read', 'read', 'terms');
  insert into public.integration_mappings (tenant_id, connection_id, external_entity_type, canonical_entity_type, external_field, canonical_field)
  values ('mx-a', conn, 'term', 'term', 'code', 'code');
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode) values ('mx-a', conn, 'manual', 'manual') returning id into run;
  insert into public.integration_sync_errors (tenant_id, sync_run_id, connection_id, error_category, sanitized_message)
  values ('mx-a', run, conn, 'unknown', 'x');
  insert into public.integration_webhook_events (tenant_id, connection_id, event_type, idempotency_key, payload_hash)
  values ('mx-a', conn, 'x', 'evt-matrix-1', 'sha256:' || repeat('f', 64)) returning id into evt;
  insert into public.integration_dead_letter_events (tenant_id, connection_id, webhook_event_id, reason) values ('mx-a', conn, evt, 'x');
  insert into public.integration_retention_runs (tenant_id) values ('mx-a');
  insert into public.source_records (tenant_id, connection_id, source_type, source_name, source_of_truth, classification)
  values ('mx-a', conn, 'connected_institutional', 'Feed', 'Registrar', 'T2') returning id into src;
  insert into public.source_snapshots (tenant_id, source_record_id, snapshot_hash) values ('mx-a', src, 'sha256:' || repeat('0', 64));
  insert into public.source_freshness_events (tenant_id, source_record_id, freshness_status) values ('mx-a', src, 'live');
  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id, connection_id,
    source_system, source_record_id, source_of_truth, classification)
  values ('mx-a', 'enrollment', 'e1', other, conn, 'SIS', 'x1', 'Registrar', 'T3');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('mx-a', 'kill.ai_generation', false, '');
  -- Integration quality (20260928040000): one row in each, as the worker writes them.
  insert into public.integration_reconciliation_runs (tenant_id, connection_id, sync_run_id) values ('mx-a', conn, run)
  returning id into recon;
  insert into public.integration_reconciliation_discrepancies (tenant_id, run_id, status, entity_type, reference)
  values ('mx-a', recon, 'stale', 'term', 'sha256:' || repeat('c', 32));
  insert into public.integration_schema_fingerprints (tenant_id, connection_id, fingerprint) values ('mx-a', conn, '0badcafe');
  insert into public.integration_schema_drift_events (tenant_id, connection_id, kind, entity, field)
  values ('mx-a', conn, 'added', 'term', 'term_name');
  insert into public.integration_duplicate_candidates (tenant_id, canonical_entity, key_hash, members, suggested_keep)
  values ('mx-a', 'term', '12345678', array['t1', 't2'], 't1') returning id into cand;
  insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
  values ('mx-a', cand, 't1', array['t2'], '{}');
  insert into public.integration_source_owners (tenant_id, connection_id, owner_name, backup_owner_name,
    freshness_target_minutes, stale_threshold_minutes, escalation, correction_route)
  values ('mx-a', conn, 'Registrar', 'IT', 60, 120, 'CIO', 'registrar@mx-a.example');
  insert into public.integration_mapping_versions (tenant_id, connection_id, external_entity_type, mapping_version)
  values ('mx-a', conn, 'term', 2);

  -- The list above is every school-bound table the integration migrations create.
  select count(*) into got from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r'
     and (c.relname like 'integration\_%' or c.relname like 'source\_%'
          or c.relname in ('canonical_entity_references', 'feature_kill_switch'))
     and not matrix ? c.relname;
  if got <> 0 then raise exception 'FAILED: % integration table(s) are missing from the matrix', got; end if;
  raise notice 'ok  the matrix covers every integration table';

  for tbl, want_student in select key, value::bigint from jsonb_each_text(matrix) loop
    got := pg_temp.visible(null, tbl);
    if got > 0 then failures := failures || format('anon reads %s (%s)', tbl, got); end if;
    got := pg_temp.visible(student, tbl);
    if got <> want_student then failures := failures || format('student reads %s: %s, want %s', tbl, got, want_student); end if;
    got := pg_temp.visible(integ_b, tbl);
    if got > 0 then failures := failures || format('another school''s admin reads %s (%s)', tbl, got); end if;

    foreach got in array array[
      pg_temp.changed(null,    format('update public.%I set tenant_id = tenant_id', tbl)),
      pg_temp.changed(student, format('update public.%I set tenant_id = tenant_id', tbl)),
      pg_temp.changed(integ_b, format('update public.%I set tenant_id = tenant_id', tbl)),
      pg_temp.changed(integ,   format('update public.%I set tenant_id = ''mx-b''', tbl)),
      pg_temp.changed(null,    format('delete from public.%I', tbl)),
      pg_temp.changed(student, format('delete from public.%I', tbl)),
      pg_temp.changed(integ_b, format('delete from public.%I', tbl))
    ] loop
      if got > 0 then failures := failures || format('a write to %s went through (%s rows)', tbl, got); end if;
    end loop;
  end loop;

  if array_length(failures, 1) > 0 then
    raise exception 'FAILED: %', array_to_string(failures, '; ');
  end if;
  raise notice 'ok  21 tables × 4 accounts: reads as the matrix says, and no cross-account write lands';

  -- The school's own integration admin sees every row but cannot delete the
  -- worker's logs or move anything to another school.
  foreach tbl in array array['integration_sync_runs', 'integration_sync_errors', 'integration_webhook_events',
                             'integration_dead_letter_events', 'integration_retention_runs'] loop
    if pg_temp.visible(integ, tbl) <> 1 then raise exception 'FAILED: the integration admin cannot read %', tbl; end if;
    if pg_temp.changed(integ, format('delete from public.%I', tbl)) > 0 then
      raise exception 'FAILED: the integration admin deleted from %', tbl;
    end if;
  end loop;
  raise notice 'ok  the integration admin reads the worker''s logs and cannot delete them';
end $$;

rollback;
