-- Integration control plane: every boundary the migration claims, walked as
-- the account it is about, and every refusal attempted as the account that
-- should be refused. LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
--   supabase/check.sh integration-control-plane

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
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

-- A statement the database itself (not RLS) must reject, run as the owner.
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

-- ── Every new table has RLS on ────────────────────────────────────────────

do $$
declare n bigint;
begin
  select count(*) into n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     and c.relname in ('feature_kill_switch', 'data_classification_rules', 'integration_connections',
                       'integration_scopes', 'integration_mappings', 'integration_sync_runs',
                       'integration_sync_errors', 'integration_webhook_events',
                       'integration_dead_letter_events', 'source_records', 'source_snapshots',
                       'source_freshness_events', 'canonical_entity_references', 'integration_retention_runs');
  perform pg_temp.counted('new tables without row-level security', n, 0);

  -- And none of them has a policy that is simply `true`.
  select count(*) into n from pg_policies
   where schemaname = 'public'
     and tablename in ('feature_kill_switch', 'data_classification_rules', 'integration_connections',
                       'integration_scopes', 'integration_mappings', 'integration_sync_runs',
                       'integration_sync_errors', 'integration_webhook_events',
                       'integration_dead_letter_events', 'source_records', 'source_snapshots',
                       'source_freshness_events', 'canonical_entity_references', 'integration_retention_runs')
     and (qual = 'true' or with_check = 'true');
  perform pg_temp.counted('new policies that are USING (true)', n, 0);
end $$;

-- ── The walk ──────────────────────────────────────────────────────────────

do $$
declare
  integ uuid; uadmin uuid; student uuid; classmate uuid; integ_b uuid; platform uuid;
  conn uuid; conn_pub text; conn_b uuid; scope_ok uuid; dlq uuid; run uuid;
  n bigint; st text;
begin
  insert into public.schools (id, name, email_domains) values
    ('icp-a', 'Integration University', array['icp-a.example']),
    ('icp-b', 'Other University',       array['icp-b.example']);

  integ     := pg_temp.newuser('integ@icp-a.example',  'icp-a');
  uadmin    := pg_temp.newuser('admin@icp-a.example',  'icp-a');
  student   := pg_temp.newuser('student@icp-a.example','icp-a');
  classmate := pg_temp.newuser('mate@icp-a.example',   'icp-a');
  integ_b   := pg_temp.newuser('integ@icp-b.example',  'icp-b');
  platform  := pg_temp.newuser('ops@semester.example', null);  -- an incident responder

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (integ,    'integration_admin', 'school',   'icp-a', 'institution'),
    (uadmin,   'university_admin',  'school',   'icp-a', 'institution'),
    (integ_b,  'integration_admin', 'school',   'icp-b', 'institution'),
    (platform, 'incident_responder','platform', '',      'platform');

  -- Connections -----------------------------------------------------------

  perform pg_temp.expect_allowed('an integration admin adds a connection at their school', integ,
    $q$insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name,
         authentication_type, credentials_reference, owner_account_id)
       values ('icp-a', 'lms', 'Canvas', 'Canvas (sandbox)', 'lti_1_3', 'vault:icp-a/canvas', auth.uid())$q$);
  select id, public_id, status into conn, conn_pub, st from public.integration_connections where tenant_id = 'icp-a';
  if st <> 'disconnected' then raise exception 'FAILED: a new connection is %, not disconnected', st; end if;
  raise notice 'ok  a new connection is born disconnected';

  perform pg_temp.expect_refused('an integration admin adds a connection at another school', integ,
    $q$insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
       values ('icp-b', 'sis', 'Banner', 'Banner')$q$);
  perform pg_temp.expect_refused('a student adds a connection', student,
    $q$insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
       values ('icp-a', 'sis', 'Banner', 'Banner')$q$);
  perform pg_temp.expect_refused('a pasted token as a credential reference', integ,
    -- Built at runtime so no key-shaped literal is committed for scanners.
    format($q$insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, credentials_reference)
       values ('icp-a', 'sis', 'Banner', 'Banner', %L)$q$, 'sk_' || 'live_' || repeat('x', 24)));
  perform pg_temp.expect_refused('reading the credential pointer, even as the integration admin', integ,
    'select credentials_reference from public.integration_connections');
  perform pg_temp.counted('the integration admin reads the rest of the connection',
    pg_temp.seen(integ, 'select id, status, public_id from public.integration_connections'), 1);
  perform pg_temp.expect_refused('setting status directly, bypassing approval', integ,
    format('update public.integration_connections set status = %L where id = %L', 'healthy', conn));
  perform pg_temp.expect_refused('approving one''s own connection by a direct update', integ,
    format('update public.integration_connections set approved_at = now() where id = %L', conn));
  perform pg_temp.expect_rejected('a healthy connection that was never approved',
    format('update public.integration_connections set status = %L where id = %L', 'healthy', conn));
  perform pg_temp.expect_rejected('a write direction that was never approved',
    format('update public.integration_connections set sync_direction = %L where id = %L', 'approved_write', conn));
  perform pg_temp.expect_rejected('a connection ceiling of T4',
    format('update public.integration_connections set data_classification_ceiling = %L where id = %L', 'T4', conn));

  perform pg_temp.counted('another school''s integration admin sees the connection',
    pg_temp.seen(integ_b, 'select 1 from public.integration_connections'), 0);
  perform pg_temp.counted('a student sees the connection',
    pg_temp.seen(student, 'select 1 from public.integration_connections'), 0);

  -- Approval --------------------------------------------------------------

  perform pg_temp.expect_refused('the integration admin approves (they cannot hold integration:approve)', integ,
    format('select public.integration_approve_connection(%L, %L)', conn_pub, 'read'));
  perform pg_temp.expect_allowed('the university admin approves read-only', uadmin,
    format('select public.integration_approve_connection(%L, %L)', conn_pub, 'read'));
  select status into st from public.integration_connections where id = conn;
  perform pg_temp.counted('approval moves a disconnected connection to configuring, not healthy',
    (st = 'configuring')::int, 1);

  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, owner_account_id)
  values ('icp-a', 'career', 'Handshake', 'Handshake', uadmin);
  perform pg_temp.expect_refused('an owner approving their own connection', uadmin,
    $q$select public.integration_approve_connection(
         (select public_id from public.integration_connections where provider_name = 'Handshake'), 'read')$q$);

  -- Scopes ----------------------------------------------------------------

  perform pg_temp.expect_refused('a scope on the never list (grades)', integ,
    format($q$insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
              values ('icp-a', %L, 'scope.lms.grades_read', 'read', 'x')$q$, conn));
  perform pg_temp.expect_refused('a scope on the never list (roster)', integ,
    format($q$insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
              values ('icp-a', %L, 'scope.sis.roster', 'read', 'x')$q$, conn));
  perform pg_temp.expect_allowed('a minimum-data scope is proposed', integ,
    format($q$insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
              values ('icp-a', %L, 'scope.lms.assignment_dates_read', 'read', 'Show due dates on Today')$q$, conn));
  select id into scope_ok from public.integration_scopes where scope_key = 'scope.lms.assignment_dates_read';
  perform pg_temp.expect_refused('a proposer marking their scope approved', integ,
    format('update public.integration_scopes set approved = true where id = %L', scope_ok));
  perform pg_temp.expect_refused('the integration admin approves a scope', integ,
    format('select public.integration_approve_scope(%L)', scope_ok));
  perform pg_temp.expect_allowed('the university admin approves a scope', uadmin,
    format('select public.integration_approve_scope(%L)', scope_ok));
  perform pg_temp.expect_refused('changing a scope after approval', integ,
    format('update public.integration_scopes set purpose = %L where id = %L', 'something else', scope_ok));
  perform pg_temp.expect_rejected('a child row pointing at another tenant''s connection',
    format($q$insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
              values ('icp-b', %L, 'scope.sis.term_read', 'read', 'x')$q$, conn));

  -- Pause and resume ------------------------------------------------------

  perform pg_temp.expect_refused('a university admin pausing (no integration:sync)', uadmin,
    format('select public.integration_set_paused(%L, true, %L)', conn_pub, 'maintenance'));
  perform pg_temp.expect_refused('pausing without a reason', integ,
    format('select public.integration_set_paused(%L, true, %L)', conn_pub, ' '));
  perform pg_temp.expect_refused('another school''s admin pausing', integ_b,
    format('select public.integration_set_paused(%L, true, %L)', conn_pub, 'maintenance'));
  perform pg_temp.expect_allowed('the integration admin pauses', integ,
    format('select public.integration_set_paused(%L, true, %L)', conn_pub, 'maintenance'));
  perform pg_temp.become(integ);
  select public.integration_set_paused(conn_pub, false, 'done') into st;
  reset role;
  perform pg_temp.counted('resume returns to configuring, never straight to healthy', (st = 'configuring')::int, 1);

  -- Worker-written logs ---------------------------------------------------

  insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode, records_received)
  values ('icp-a', conn, 'scheduled', 'incremental_api', 3) returning id into run;
  perform pg_temp.expect_rejected('a run whose counts exceed what was received',
    format($q$insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode,
                records_received, records_created) values ('icp-a', %L, 'manual', 'manual', 1, 2)$q$, conn));
  perform pg_temp.expect_refused('a signed-in account writing a sync run', integ,
    format($q$insert into public.integration_sync_runs (tenant_id, connection_id, trigger_type, sync_mode)
              values ('icp-a', %L, 'manual', 'manual')$q$, conn));
  perform pg_temp.counted('the integration admin reads the run',
    pg_temp.seen(integ, 'select 1 from public.integration_sync_runs'), 1);
  perform pg_temp.counted('a student reads the run',
    pg_temp.seen(student, 'select 1 from public.integration_sync_runs'), 0);
  perform pg_temp.expect_rejected('an error carrying an external id in the clear',
    format($q$insert into public.integration_sync_errors (tenant_id, connection_id, sync_run_id,
                external_record_reference_redacted, error_category, sanitized_message)
              values ('icp-a', %L, %L, 'student 000123456', 'type_mismatch', 'x')$q$, conn, run));

  insert into public.integration_webhook_events (tenant_id, connection_id, event_type, idempotency_key, payload_hash)
  values ('icp-a', conn, 'assignment.updated', 'evt-00000001', 'sha256:' || repeat('a', 64));
  perform pg_temp.expect_rejected('the same webhook delivered twice',
    format($q$insert into public.integration_webhook_events (tenant_id, connection_id, event_type, idempotency_key, payload_hash)
              values ('icp-a', %L, 'assignment.updated', 'evt-00000001', 'sha256:%s')$q$, conn, repeat('a', 64)));

  -- Replay ----------------------------------------------------------------

  insert into public.integration_dead_letter_events (tenant_id, connection_id, sync_run_id, reason, attempts)
  values ('icp-a', conn, run, 'provider_unavailable after 5 attempts', 5) returning id into dlq;
  perform pg_temp.expect_refused('another school''s admin requesting a replay', integ_b,
    format('select public.integration_request_replay(%L, %L)', dlq, 'retry'));
  perform pg_temp.expect_refused('a student requesting a replay', student,
    format('select public.integration_request_replay(%L, %L)', dlq, 'retry'));

  -- Kill switches ---------------------------------------------------------

  perform pg_temp.expect_refused('a university admin engaging a global switch', uadmin,
    $q$insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_by, engaged_at)
       values (null, 'kill.integration_sync', true, 'incident', auth.uid(), now())$q$);
  perform pg_temp.expect_refused('a switch engaged without a reason', platform,
    $q$insert into public.feature_kill_switch (tenant_id, switch_key, engaged)
       values (null, 'kill.integration_sync', true)$q$);
  perform pg_temp.expect_allowed('a platform admin engaging the global sync switch', platform,
    $q$insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_by, engaged_at)
       values (null, 'kill.integration_sync', true, 'incident 42', auth.uid(), now())$q$);
  perform pg_temp.counted('the global switch stops every school',
    (public.kill_switch_engaged('kill.integration_sync', 'icp-b'))::int, 1);
  perform pg_temp.expect_refused('a replay while the global switch is engaged', integ,
    format('select public.integration_request_replay(%L, %L)', dlq, 'retry'));
  update public.feature_kill_switch set engaged = false where tenant_id is null;
  perform pg_temp.expect_allowed('the integration admin requests a replay once released', integ,
    format('select public.integration_request_replay(%L, %L)', dlq, 'provider back'));
  perform pg_temp.expect_allowed('a university admin engaging their own school''s switch', uadmin,
    $q$insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_by, engaged_at)
       values ('icp-a', 'kill.ai_generation', true, 'policy review', auth.uid(), now())$q$);
  perform pg_temp.counted('a school switch stops that school',
    (public.kill_switch_engaged('kill.ai_generation', 'icp-a'))::int, 1);
  perform pg_temp.counted('and not another',
    (public.kill_switch_engaged('kill.ai_generation', 'icp-b'))::int, 0);
  perform pg_temp.expect_refused('a university admin engaging another school''s switch', uadmin,
    $q$insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
       values ('icp-b', 'kill.ai_generation', true, 'x')$q$);

  -- Canonical references: no browsing students ----------------------------

  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
    subject_user_id, connection_id, source_system, source_record_id, source_of_truth, classification, freshness_status)
  values
    ('icp-a', 'enrollment', 'enr-1', student, conn, 'sis', 'ext-1', 'Registrar', 'T3', 'recent'),
    ('icp-a', 'term',       'fa26',  null,    conn, 'sis', 'ext-2', 'Registrar', 'T0', 'live'),
    -- A student's own row at T1: classification alone would let it through,
    -- so only the ownership test keeps it from the admin and the classmate.
    ('icp-a', 'assignment', 'asg-1', student, conn, 'lms', 'ext-3', 'Canvas',    'T1', 'recent');
  perform pg_temp.counted('the integration admin reads a student''s T1 assignment reference',
    pg_temp.seen(integ, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'assignment'$q$), 0);
  perform pg_temp.counted('a classmate reads it',
    pg_temp.seen(classmate, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'assignment'$q$), 0);
  perform pg_temp.counted('its student reads it',
    pg_temp.seen(student, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'assignment'$q$), 1);
  perform pg_temp.counted('a student reads their own enrollment reference',
    pg_temp.seen(student, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'enrollment'$q$), 1);
  perform pg_temp.counted('a classmate reads it',
    pg_temp.seen(classmate, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'enrollment'$q$), 0);
  perform pg_temp.counted('the integration admin reads it',
    pg_temp.seen(integ, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'enrollment'$q$), 0);
  perform pg_temp.counted('the university admin reads it',
    pg_temp.seen(uadmin, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'enrollment'$q$), 0);
  perform pg_temp.counted('the classmate reads the public term',
    pg_temp.seen(classmate, $q$select 1 from public.canonical_entity_references where canonical_entity_type = 'term'$q$), 1);
  perform pg_temp.counted('another school''s admin reads the public term',
    pg_temp.seen(integ_b, 'select 1 from public.canonical_entity_references'), 0);
  -- Two connections to the same product at one school, with a record id in
  -- common. Codex found on #779 that identity ignored the connection, so the
  -- second import overwrote the first connection's row — someone else's
  -- student, if the ids were ordinary ones like `student-1`.
  declare conn2 uuid;
  begin
    insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
    values ('icp-a', 'lms', 'Canvas', 'Canvas (law school)') returning id into conn2;
    insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
      subject_user_id, connection_id, source_system, source_record_id, source_of_truth, classification)
    values ('icp-a', 'enrollment', 'enr-law', classmate, conn2, 'sis', 'ext-1', 'Registrar', 'T3');
    select count(*) into n from public.canonical_entity_references where source_record_id = 'ext-1';
    perform pg_temp.counted('the same external id on two connections is two records', n, 2);
    begin
      insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
        subject_user_id, connection_id, source_system, source_record_id, source_of_truth, classification)
      values ('icp-a', 'enrollment', 'enr-dup', classmate, conn2, 'sis', 'ext-1', 'Registrar', 'T3');
      raise exception 'FAILED: the same record twice on one connection was accepted';
    exception when unique_violation then
      raise notice 'ok  the same record twice on one connection is refused';
    end;
  end;
  -- And removing both of those connections keeps both records, provenance
  -- cleared. Codex found on #808 that `nulls not distinct` made the two
  -- orphans identical, so the second removal failed on the unique index.
  declare c_one uuid; c_two uuid;
  begin
    insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
    values ('icp-a', 'lms', 'Canvas', 'Canvas (nursing)') returning id into c_one;
    insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name)
    values ('icp-a', 'lms', 'Canvas', 'Canvas (music)') returning id into c_two;
    insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
      subject_user_id, connection_id, source_system, source_record_id, source_of_truth, classification)
    values ('icp-a', 'enrollment', 'enr-n', classmate, c_one, 'sis', 'ext-orphan', 'Registrar', 'T3'),
           ('icp-a', 'enrollment', 'enr-m', classmate, c_two, 'sis', 'ext-orphan', 'Registrar', 'T3');
    delete from public.integration_connections where id in (c_one, c_two);
    select count(*) into n from public.canonical_entity_references
     where source_record_id = 'ext-orphan' and connection_id is null;
    perform pg_temp.counted('removing two connections that share a record keeps both, unattached', n, 2);
  end;

  perform pg_temp.expect_rejected('an education record with no owner',
    $q$insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
         source_system, source_record_id, source_of_truth, classification)
       values ('icp-a', 'enrollment', 'enr-x', 'sis', 'ext-x', 'Registrar', 'T3')$q$);
  perform pg_temp.expect_rejected('a T4 canonical reference',
    format($q$insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
         subject_user_id, source_system, source_record_id, source_of_truth, classification)
       values ('icp-a', 'enrollment', 'enr-y', %L, 'sis', 'ext-y', 'Registrar', 'T4')$q$, student));

  -- Classification ceiling ------------------------------------------------

  perform pg_temp.expect_refused('a tenant sending education records to consumer AI', uadmin,
    $q$insert into public.data_classification_rules (tenant_id, classification, allowed_in_semester,
         allowed_in_approved_ai, allowed_in_consumer_ai, allowed_in_external_connector, allowed_in_community, retention_policy)
       values ('icp-a', 'T3', true, true, true, false, false, 'x')$q$);
  perform pg_temp.expect_refused('a tenant loosening T1 into consumer AI', uadmin,
    $q$insert into public.data_classification_rules (tenant_id, classification, allowed_in_semester,
         allowed_in_approved_ai, allowed_in_consumer_ai, allowed_in_external_connector, allowed_in_community, retention_policy)
       values ('icp-a', 'T1', true, true, true, true, false, 'x')$q$);
  perform pg_temp.expect_allowed('a tenant tightening T1 (no AI at all)', uadmin,
    $q$insert into public.data_classification_rules (tenant_id, classification, allowed_in_semester,
         allowed_in_approved_ai, allowed_in_consumer_ai, allowed_in_external_connector, allowed_in_community, retention_policy)
       values ('icp-a', 'T1', true, false, false, true, false, 'one term')$q$);
  perform pg_temp.expect_refused('an integration admin changing classification rules', integ,
    $q$insert into public.data_classification_rules (tenant_id, classification, allowed_in_semester,
         allowed_in_approved_ai, allowed_in_consumer_ai, allowed_in_external_connector, allowed_in_community, retention_policy)
       values ('icp-a', 'T2', true, false, false, false, false, 'x')$q$);

  -- Audit -----------------------------------------------------------------

  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'icp-a' and entity_type = 'integration_connections';
  if n < 3 then raise exception 'FAILED: connection changes left % audit events', n; end if;
  raise notice 'ok  connection changes are audited (%)', n;
  select count(*) into n from public.tenant_policy_audit_event
   where entity_type = 'integration_connections'
     and (new_data ? 'credentials_reference' or old_data ? 'credentials_reference'
          or new_data ? 'cursor_state' or old_data ? 'cursor_state');
  perform pg_temp.counted('audit rows carrying the credential pointer or cursor', n, 0);
  select count(*) into n from public.tenant_policy_audit_event
   where entity_type = 'integration_dead_letter_events' and actor_id = integ;
  perform pg_temp.counted('the replay request is audited against its requester', n, 1);
  select count(*) into n from public.tenant_policy_audit_event
   where entity_type = 'integration_scopes' and actor_id = uadmin and action = 'update';
  perform pg_temp.counted('the scope approval is audited against its approver', n, 1);
  perform pg_temp.counted('another school''s auditor reads these events',
    pg_temp.seen(integ_b, $q$select 1 from public.tenant_policy_audit_event where tenant_id = 'icp-a'$q$), 0);
end $$;

rollback;
