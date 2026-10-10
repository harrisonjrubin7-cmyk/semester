-- Integration quality: every boundary 20260928040000_integration_quality.sql
-- claims, walked as the account it is about. LOCAL/DISPOSABLE DATABASES ONLY;
-- always rolled back.
--
--   supabase/check.sh integration-quality

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
end $$;

create or replace function pg_temp.expect_rejected(what text, statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok  % is rejected (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — was accepted', what;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

-- ── RLS on, no policy that is simply true ────────────────────────────────

do $$
declare n bigint;
  quality text[] := array['integration_reconciliation_runs', 'integration_reconciliation_discrepancies',
    'integration_schema_fingerprints', 'integration_schema_drift_events', 'integration_duplicate_candidates',
    'integration_duplicate_resolutions', 'integration_source_owners', 'integration_mapping_versions',
    'provider_registry', 'provider_evidence'];
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relname = any (quality) and not c.relrowsecurity;
  perform pg_temp.counted('new tables without row-level security', n, 0);
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relname = any (quality);
  perform pg_temp.counted('new tables that exist', n, 10);
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = any (quality) and (qual = 'true' or with_check = 'true');
  perform pg_temp.counted('new policies that are USING (true)', n, 0);
end $$;

-- ── The walk ─────────────────────────────────────────────────────────────

do $$
declare
  integ uuid; integ_b uuid; uadmin uuid; student uuid; platform uuid;
  conn uuid; conn_b uuid; run uuid; recon uuid; disc uuid; drift uuid; cand uuid; cand3 uuid; res uuid; ver uuid;
  who uuid; st text; n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('iq-a', 'Quality University', array['iq-a.example']),
    ('iq-b', 'Other University',   array['iq-b.example']);

  integ    := pg_temp.newuser('integ@iq-a.example',   'iq-a');
  integ_b  := pg_temp.newuser('integ@iq-b.example',   'iq-b');
  uadmin   := pg_temp.newuser('admin@iq-a.example',   'iq-a');
  student  := pg_temp.newuser('student@iq-a.example', 'iq-a');
  platform := pg_temp.newuser('ops@semester.example', null);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (integ,    'integration_admin', 'school',   'iq-a', 'institution'),
    (integ_b,  'integration_admin', 'school',   'iq-b', 'institution'),
    (uadmin,   'university_admin',  'school',   'iq-a', 'institution'),
    (platform, 'platform_admin',    'platform', '',     'platform');

  -- The worker's rows (service role, as the owner here).
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
  values ('iq-a', 'sis', 'Mock SIS', 'Mock SIS') returning id into conn;
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
  values ('iq-b', 'sis', 'Mock SIS', 'Mock SIS') returning id into conn_b;
  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode)
  values ('iq-a', conn, 'scheduled', 'batch') returning id into run;
  insert into public.integration_reconciliation_runs (tenant_id, connection_id, sync_run_id, matched, missing_at_source)
  values ('iq-a', conn, run, 40, 1) returning id into recon;
  insert into public.integration_reconciliation_discrepancies (tenant_id, run_id, status, entity_type, reference, detail)
  values ('iq-a', recon, 'missing_at_source', 'section', 'sha256:' || repeat('a', 32), 'held here, no longer listed')
  returning id into disc;

  -- ── What the database itself refuses ────────────────────────────────
  perform pg_temp.expect_rejected('a discrepancy holding a provider id instead of a redacted reference',
    format($q$insert into public.integration_reconciliation_discrepancies (tenant_id, run_id, status, entity_type, reference)
              values ('iq-a', %L, 'mismatch', 'section', 'ECON-1010-01-202710')$q$, recon));
  perform pg_temp.expect_rejected('a run marked clean with a mismatch in it',
    format($q$insert into public.integration_reconciliation_runs (tenant_id, connection_id, mismatch, clean)
              values ('iq-a', %L, 1, true)$q$, conn));
  perform pg_temp.expect_rejected('a breaking unmapped entity',
    format($q$insert into public.integration_schema_drift_events (tenant_id, connection_id, kind, entity, breaking)
              values ('iq-a', %L, 'unmapped_entity', 'requirement', true)$q$, conn));
  perform pg_temp.expect_rejected('a duplicate suggestion that is not a member',
    $q$insert into public.integration_duplicate_candidates (tenant_id, canonical_entity, key_hash, members, suggested_keep)
       values ('iq-a', 'course_section', 'deadbeef', array['c1', 'c2'], 'c9')$q$);
  perform pg_temp.expect_rejected('duplicate matching on an entity with no natural key',
    $q$insert into public.integration_duplicate_candidates (tenant_id, canonical_entity, key_hash, members, suggested_keep)
       values ('iq-a', 'event', 'deadbeef', array['c1', 'c2'], 'c1')$q$);
  perform pg_temp.expect_rejected('a system recorded as the verifier of a certification',
    $q$insert into public.provider_registry (id, name) values ('mock_lms', 'Mock LMS');
       insert into public.provider_evidence (provider_id, kind, what, verified_by_name, verified_at, document)
       values ('mock_lms', 'certification', 'LTI 1.3', 'system', now(), 'doc')$q$);
  perform pg_temp.expect_rejected('a syncing provider with no recorded contract test',
    $q$insert into public.provider_registry (id, name, maturity, connector_owner, support_owner)
       values ('mock_sis', 'Mock SIS', 'incremental', 'Integrations', 'Support')$q$);

  -- ── Reading ─────────────────────────────────────────────────────────
  perform pg_temp.counted('the integration admin reads the reconciliation run',
    pg_temp.seen(integ, 'select 1 from public.integration_reconciliation_runs'), 1);
  perform pg_temp.counted('another school''s integration admin reads it',
    pg_temp.seen(integ_b, 'select 1 from public.integration_reconciliation_runs'), 0);
  perform pg_temp.counted('a student reads it',
    pg_temp.seen(student, 'select 1 from public.integration_reconciliation_discrepancies'), 0);
  perform pg_temp.expect_refused('a student reads the simulation runs', student,
    'select 1 from private.integration_simulation_runs');
  perform pg_temp.expect_refused('the integration admin reads the simulation runs through the API role', integ,
    'select 1 from private.integration_simulation_runs');
  perform pg_temp.counted('the worker, as the service role, can record a simulation run',
    (has_table_privilege('service_role', 'private.integration_simulation_runs', 'INSERT')
     and has_table_privilege('service_role', 'private.integration_simulation_runs', 'SELECT'))::int, 1);
  perform pg_temp.expect_refused('a signed-in account writes a reconciliation run', integ,
    format($q$insert into public.integration_reconciliation_runs (tenant_id, connection_id) values ('iq-a', %L)$q$, conn));

  -- ── Working a discrepancy ───────────────────────────────────────────
  perform pg_temp.expect_refused('suppressing without a reason', integ,
    format($q$update public.integration_reconciliation_discrepancies set workflow_state = 'suppressed' where id = %L$q$, disc));
  perform pg_temp.expect_refused('assigning it to a student', integ,
    format($q$update public.integration_reconciliation_discrepancies set workflow_state = 'assigned', assigned_to = %L where id = %L$q$, student, disc));
  perform pg_temp.expect_refused('rewriting the reference', integ,
    format($q$update public.integration_reconciliation_discrepancies set reference = %L where id = %L$q$, 'sha256:' || repeat('b', 32), disc));
  perform pg_temp.expect_refused('another school''s integration admin resolving it', integ_b,
    format($q$update public.integration_reconciliation_discrepancies set workflow_state = 'resolved' where id = %L$q$, disc));
  perform pg_temp.expect_allowed('the integration admin resolves it', integ,
    format($q$update public.integration_reconciliation_discrepancies set workflow_state = 'resolved' where id = %L$q$, disc));
  select resolved_by into who from public.integration_reconciliation_discrepancies where id = disc;
  perform pg_temp.counted('the resolver is stamped as whoever resolved it', (who = integ)::int, 1);
  perform pg_temp.expect_allowed('reopening it', integ,
    format($q$update public.integration_reconciliation_discrepancies set workflow_state = 'open' where id = %L$q$, disc));
  select count(*) into n from public.integration_reconciliation_discrepancies where id = disc and resolved_by is null and resolved_at is null;
  perform pg_temp.counted('reopening clears who resolved it', n, 1);

  -- ── Drift ───────────────────────────────────────────────────────────
  insert into public.integration_schema_drift_events (tenant_id, connection_id, sync_run_id, kind, entity, field, detail, breaking)
  values ('iq-a', conn, run, 'removed', 'term', 'description', 'no record carries it', true) returning id into drift;
  -- Allowed, but whatever name is sent, the acknowledger recorded is the one who did it.
  perform pg_temp.expect_allowed('acknowledging drift while naming somebody else', integ,
    format($q$update public.integration_schema_drift_events set acknowledged_by = %L where id = %L$q$, uadmin, drift));
  select acknowledged_by into who from public.integration_schema_drift_events where id = drift;
  perform pg_temp.counted('an acknowledgement is stamped as the acknowledger, whatever was sent', (who = integ)::int, 1);
  perform pg_temp.expect_refused('acknowledging it a second time', integ,
    format($q$update public.integration_schema_drift_events set acknowledged_at = now() where id = %L$q$, drift));
  perform pg_temp.expect_refused('changing what the drift was', integ,
    format($q$update public.integration_schema_drift_events set breaking = false where id = %L$q$, drift));

  -- ── Duplicates ──────────────────────────────────────────────────────
  insert into public.integration_duplicate_candidates (tenant_id, canonical_entity, key_hash, members, suggested_keep)
  values ('iq-a', 'course_section', '0a1b2c3d', array['c-new', 'c-old'], 'c-new') returning id into cand;
  perform pg_temp.expect_refused('a resolution keeping a record outside the group', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 'c-other', array['c-old'], '{}')$q$, cand));
  insert into public.integration_duplicate_candidates (tenant_id, canonical_entity, key_hash, members, suggested_keep)
  values ('iq-a', 'course_section', '4e5f6a7b', array['t-1', 't-2', 't-3'], 't-1') returning id into cand3;
  perform pg_temp.expect_refused('a resolution that leaves a member of its group unresolved', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 't-1', array['t-2'], '{}')$q$, cand3));
  perform pg_temp.expect_refused('a resolution that supersedes the record it keeps', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 't-1', array['t-1', 't-2', 't-3'], '{}')$q$, cand3));
  perform pg_temp.expect_refused('a resolution that names a member twice', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 't-1', array['t-2', 't-2', 't-3'], '{}')$q$, cand3));
  perform pg_temp.expect_allowed('a resolution that supersedes every other member', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 't-1', array['t-3', 't-2'], '{}')$q$, cand3));
  perform pg_temp.expect_refused('another school resolving it', integ_b,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 'c-new', array['c-old'], '{}')$q$, cand));
  perform pg_temp.expect_allowed('the integration admin resolves it', integ,
    format($q$insert into public.integration_duplicate_resolutions (tenant_id, candidate_id, kept, superseded, before)
              values ('iq-a', %L, 'c-new', array['c-old'], '{"c-new": null, "c-old": null}')$q$, cand));
  select id, decided_by into res, who from public.integration_duplicate_resolutions where candidate_id = cand;
  perform pg_temp.counted('the decider is stamped', (who = integ)::int, 1);
  perform pg_temp.expect_refused('rewriting a resolution', integ,
    format($q$update public.integration_duplicate_resolutions set reversed_at = now(), kept = 'c-old' where id = %L$q$, res));
  perform pg_temp.expect_refused('deleting a resolution', integ,
    format('delete from public.integration_duplicate_resolutions where id = %L', res));
  perform pg_temp.expect_allowed('reversing it', integ,
    format('update public.integration_duplicate_resolutions set reversed_at = now() where id = %L', res));
  perform pg_temp.expect_refused('reversing it again', integ,
    format('update public.integration_duplicate_resolutions set reversed_at = now() where id = %L', res));

  -- ── Source owners ───────────────────────────────────────────────────
  perform pg_temp.expect_refused('the integration admin names an owner (needs source:approve)', integ,
    format($q$insert into public.integration_source_owners (tenant_id, connection_id, owner_name, backup_owner_name,
                freshness_target_minutes, stale_threshold_minutes, escalation, correction_route)
              values ('iq-a', %L, 'Registrar', 'IT', 60, 120, 'CIO', 'registrar@iq-a.example')$q$, conn));
  perform pg_temp.expect_rejected('a backup owner who is the owner',
    format($q$insert into public.integration_source_owners (tenant_id, connection_id, owner_name, backup_owner_name,
                freshness_target_minutes, stale_threshold_minutes, escalation, correction_route)
              values ('iq-a', %L, 'Registrar', ' registrar ', 60, 120, 'CIO', 'x')$q$, conn));
  perform pg_temp.expect_rejected('a stale threshold sooner than the target',
    format($q$insert into public.integration_source_owners (tenant_id, connection_id, owner_name, backup_owner_name,
                freshness_target_minutes, stale_threshold_minutes, escalation, correction_route)
              values ('iq-a', %L, 'Registrar', 'IT', 60, 30, 'CIO', 'x')$q$, conn));

  -- ── Mapping versions ────────────────────────────────────────────────
  perform pg_temp.expect_allowed('the integration admin proposes a mapping version', integ,
    format($q$insert into public.integration_mapping_versions (tenant_id, connection_id, external_entity_type, mapping_version)
              values ('iq-a', %L, 'term', 2)$q$, conn));
  select id, proposed_by into ver, who from public.integration_mapping_versions where connection_id = conn;
  perform pg_temp.counted('the proposer is stamped', (who = integ)::int, 1);
  perform pg_temp.expect_refused('approving before a simulation', uadmin,
    format($q$update public.integration_mapping_versions set status = 'approved' where id = %L$q$, ver));
  perform pg_temp.expect_allowed('recording a blocked simulation', integ,
    format($q$update public.integration_mapping_versions set simulation_run = 'sim-1', simulation_verdict = 'blocked' where id = %L$q$, ver));
  perform pg_temp.expect_refused('approving after a blocked simulation', uadmin,
    format($q$update public.integration_mapping_versions set status = 'approved' where id = %L$q$, ver));
  -- The approver cannot write a passing simulation in the same statement as the approval.
  perform pg_temp.expect_refused('approving while writing a passing simulation in the same update', uadmin,
    format($q$update public.integration_mapping_versions set status = 'approved', simulation_run = 'sim-forged',
              simulation_verdict = 'ready' where id = %L$q$, ver));
  perform pg_temp.expect_allowed('recording a passing simulation', integ,
    format($q$update public.integration_mapping_versions set simulation_run = 'sim-2', simulation_verdict = 'ready' where id = %L$q$, ver));
  perform pg_temp.expect_refused('the integration admin approving (no integration:approve)', integ,
    format($q$update public.integration_mapping_versions set status = 'approved' where id = %L$q$, ver));
  perform pg_temp.expect_refused('skipping approval straight to live', uadmin,
    format($q$update public.integration_mapping_versions set status = 'live' where id = %L$q$, ver));
  perform pg_temp.expect_allowed('the university admin approves it', uadmin,
    format($q$update public.integration_mapping_versions set status = 'approved' where id = %L$q$, ver));
  select approved_by into who from public.integration_mapping_versions where id = ver;
  perform pg_temp.counted('the approver is stamped', (who = uadmin)::int, 1);
  perform pg_temp.expect_refused('changing the simulation after approval', integ,
    format($q$update public.integration_mapping_versions set simulation_verdict = 'review' where id = %L$q$, ver));
  perform pg_temp.expect_allowed('the university admin makes it live', uadmin,
    format($q$update public.integration_mapping_versions set status = 'live' where id = %L$q$, ver));
  perform pg_temp.expect_refused('a second live version of the same entity', integ,
    format($q$insert into public.integration_mapping_versions (tenant_id, connection_id, external_entity_type, mapping_version, status)
              values ('iq-a', %L, 'term', 3, 'live')$q$, conn));

  -- A proposer who could also approve still may not approve their own.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (integ, 'university_admin', 'school', 'iq-a', 'institution');
  perform pg_temp.expect_allowed('a dual-role admin proposes another version', integ,
    format($q$insert into public.integration_mapping_versions (tenant_id, connection_id, external_entity_type, mapping_version)
              values ('iq-a', %L, 'term', 4)$q$, conn));
  perform pg_temp.expect_allowed('and records its simulation', integ,
    format($q$update public.integration_mapping_versions set simulation_run = 'sim-4', simulation_verdict = 'ready'
              where connection_id = %L and mapping_version = 4$q$, conn));
  perform pg_temp.expect_refused('and approves their own proposal', integ,
    format($q$update public.integration_mapping_versions set status = 'approved'
              where connection_id = %L and mapping_version = 4$q$, conn));

  -- ── The provider registry ───────────────────────────────────────────
  perform pg_temp.counted('a student reads the provider registry',
    pg_temp.seen(student, 'select 1 from public.provider_registry'), 0);
  insert into public.provider_registry (id, name) values ('canvas', 'Canvas');
  perform pg_temp.counted('a student reads the provider registry once a provider exists',
    pg_temp.seen(student, 'select 1 from public.provider_registry'), 1);
  perform pg_temp.expect_refused('a school admin records a certification', uadmin,
    $q$insert into public.provider_evidence (provider_id, kind, what, verified_by_name, verified_at, document)
       values ('canvas', 'certification', 'LTI 1.3', 'A. Person', now(), 'doc')$q$);
  perform pg_temp.expect_allowed('the platform records a certification', platform,
    $q$insert into public.provider_evidence (provider_id, kind, what, verified_by_name, verified_at, document)
       values ('canvas', 'certification', 'LTI 1.3', 'A. Person', now(), 'doc')$q$);
  select recorded_by into who from public.provider_evidence where provider_id = 'canvas';
  perform pg_temp.counted('who recorded the evidence is stamped', (who = platform)::int, 1);
end $$;

rollback;
