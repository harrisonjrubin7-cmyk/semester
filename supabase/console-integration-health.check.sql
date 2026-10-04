-- Credential-free, exact-school integration health. LOCAL/DISPOSABLE DATABASE ONLY.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  operator uuid;
  console_only uuid;
  integration_only uuid;
  other_operator uuid;
  mixed_operator uuid;
  healthy uuid;
  degraded uuid;
  stale uuid;
  failed uuid;
  unconfigured uuid;
  demo uuid;
  other_connection uuid;
  failed_run uuid;
  n bigint;
  leaked text;
  denied boolean := false;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('health-north', 'Health North', array['health-north.example'], false),
    ('health-south', 'Health South', array['health-south.example'], false),
    ('health-demo', 'Health Demo', array['health-demo.example'], true);

  operator := pg_temp.newuser('operator@health-north.example', 'health-north');
  console_only := pg_temp.newuser('console@health-north.example', 'health-north');
  integration_only := pg_temp.newuser('integration@health-north.example', 'health-north');
  other_operator := pg_temp.newuser('operator@health-south.example', 'health-south');
  mixed_operator := pg_temp.newuser('mixed@health-north.example', 'health-north');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator, 'platform_admin', 'platform', '', 'platform'),
    (operator, 'integration_admin', 'school', 'health-north', 'platform'),
    (operator, 'integration_admin', 'school', 'health-demo', 'platform'),
    (console_only, 'platform_admin', 'platform', '', 'platform'),
    (integration_only, 'integration_admin', 'school', 'health-north', 'platform'),
    (other_operator, 'platform_admin', 'platform', '', 'platform'),
    (other_operator, 'integration_admin', 'school', 'health-south', 'platform'),
    (mixed_operator, 'platform_admin', 'platform', '', 'platform'),
    (mixed_operator, 'integration_admin', 'school', 'health-north', 'platform'),
    (mixed_operator, 'university_admin', 'school', 'health-south', 'platform');

  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
     freshness_target, last_successful_sync_at, feature_flag_key, credentials_reference, cursor_state)
  values
    ('health-north', 'sis', 'North SIS', 'Healthy SIS', 'healthy', now(), interval '1 hour', now() - interval '10 minutes', 'integration.sis', 'vault:PLANTED_TOKEN', '{"secret":"PLANTED_CURSOR"}')
  returning id into healthy;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
     freshness_target, last_successful_sync_at)
  values ('health-north', 'lms', 'North LMS', 'Degraded LMS', 'degraded', now(), interval '1 hour', now() - interval '15 minutes')
  returning id into degraded;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
     freshness_target, last_successful_sync_at)
  values ('health-north', 'catalog', 'North Catalog', 'Stale Catalog', 'healthy', now(), interval '1 hour', now() - interval '3 hours')
  returning id into stale;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, approved_at,
     freshness_target, last_successful_sync_at)
  values ('health-north', 'identity', 'North Identity', 'Failed Identity', 'error', now(), interval '1 hour', now() - interval '20 minutes')
  returning id into failed;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status)
  values ('health-north', 'advising', 'North Advising', 'Unconfigured Advising', 'disconnected')
  returning id into unconfigured;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status)
  values ('health-demo', 'sis', 'Demo SIS', 'Demo SIS', 'disconnected')
  returning id into demo;
  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status)
  values ('health-south', 'sis', 'South SIS', 'South SIS', 'disconnected')
  returning id into other_connection;

  insert into public.tenant_feature_policy (tenant_id, capability, state, reason, updated_by)
  values ('health-north', 'integration.sis', 'production', 'Approved connector', operator);
  insert into public.integration_source_owners
    (tenant_id, connection_id, owner_name, backup_owner_name, freshness_target_minutes,
     stale_threshold_minutes, escalation, correction_route)
  values ('health-north', healthy, 'Registrar operations', 'Integration operations', 30, 120,
          'Open the integration incident path.', 'Correct at the SIS source.');

  insert into public.integration_sync_runs
    (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at,
     records_received, records_rejected, errors_count, reconciliation_state)
  values ('health-north', healthy, 'scheduled', 'incremental_api', 'succeeded', now() - interval '10 minutes', now() - interval '9 minutes', 10, 0, 0, 'matched');
  insert into public.integration_sync_runs
    (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at,
     records_received, records_rejected, errors_count, reconciliation_state)
  values ('health-north', degraded, 'scheduled', 'incremental_api', 'partial', now() - interval '15 minutes', now() - interval '14 minutes', 10, 1, 1, 'mismatched');
  insert into public.integration_sync_runs
    (tenant_id, connection_id, trigger_type, sync_mode, status, started_at, completed_at,
     records_received, records_rejected, errors_count, reconciliation_state)
  values ('health-north', failed, 'scheduled', 'incremental_api', 'failed', now() - interval '20 minutes', now() - interval '19 minutes', 0, 0, 1, 'pending')
  returning id into failed_run;

  insert into public.integration_sync_errors
    (tenant_id, sync_run_id, connection_id, external_record_reference_redacted,
     error_category, error_code, sanitized_message, severity)
  values ('health-north', failed_run, failed, 'redacted', 'authentication', 'AUTH_REJECTED',
          'PLANTED_PROVIDER_MESSAGE', 'critical');
  insert into public.integration_dead_letter_events
    (tenant_id, connection_id, reason, attempts)
  values ('health-north', degraded, 'Provider unavailable', 5);

  insert into public.approval_request
    (duty_id, requester, tenant_id, target, evidence, ticket, status)
  select 'integration-config', operator, 'health-north', c.public_id,
         'Institution approval, scope, fallback, rollback and expiry recorded.', 'INT-100', 'pending'
    from public.integration_connections c where c.id = stale;

  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(false);
  reset role;
  perform pg_temp.counted('the queue returns only the five exact-school non-demo connectors', n, 5);

  perform pg_temp.become(operator);
  select count(*) into n
    from public.console_integration_health(false) h
   where (h.connection_name, h.health_state) in (
     ('Healthy SIS', 'healthy'), ('Degraded LMS', 'degraded'), ('Stale Catalog', 'stale'),
     ('Failed Identity', 'failed'), ('Unconfigured Advising', 'unconfigured'));
  reset role;
  perform pg_temp.counted('all five declared health states are derived from telemetry', n, 5);

  update public.integration_connections
     set last_successful_sync_at = now() + interval '1 hour'
   where id = healthy;
  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(false) h
   where h.connection_name = 'Healthy SIS'
     and h.health_state = 'failed'
     and h.minutes_since_success is null;
  reset role;
  perform pg_temp.counted('future-dated success evidence fails closed without negative freshness', n, 1);
  update public.integration_connections
     set last_successful_sync_at = now() - interval '10 minutes'
   where id = healthy;

  perform pg_temp.become(mixed_operator);
  select count(*) into n from public.console_integration_health(false) h
   where (h.tenant_id = 'health-north' and h.can_request)
      or (h.tenant_id = 'health-south' and not h.can_request);
  reset role;
  perform pg_temp.counted('configuration request eligibility is bound to each row tenant', n, 6);

  perform pg_temp.become(mixed_operator);
  begin
    perform public.request_approval(
      'integration-config', 'health-south',
      (select c.public_id from public.integration_connections c where c.id = other_connection),
      jsonb_build_object('requested_change', 'configure', 'credential_expiry', (current_date + 30)::text),
      'Institution approval and rollback references.', 'INT-CROSS-TENANT', null
    );
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  if not denied then raise exception 'FAILED: cross-tenant integration approval request was accepted'; end if;
  raise notice 'ok  exact-school integration authority is enforced at the write boundary';

  denied := false;
  perform pg_temp.become(operator);
  begin
    perform public.request_approval(
      'integration-config', 'health-north',
      (select c.public_id from public.integration_connections c where c.id = healthy),
      jsonb_build_object('requested_change', 'arbitrary-operation', 'credential_expiry', (current_date + 30)::text),
      'Institution approval and rollback references.', 'INT-UNSUPPORTED', null
    );
  exception when invalid_parameter_value then denied := true;
  end;
  reset role;
  if not denied then raise exception 'FAILED: unsupported integration change entered the approval queue'; end if;
  raise notice 'ok  integration change kinds are allowlisted at the write boundary';

  denied := false;
  perform pg_temp.become(operator);
  begin
    perform public.request_approval(
      'integration-config', 'health-north',
      (select c.public_id from public.integration_connections c where c.id = healthy),
      jsonb_build_object('requested_change', 'configure', 'credential_expiry', (current_date - 1)::text),
      'Institution approval and rollback references.', 'INT-EXPIRED-CREDENTIAL', null
    );
  exception when invalid_parameter_value then denied := true;
  end;
  reset role;
  if not denied then raise exception 'FAILED: expired credential evidence entered the approval queue'; end if;
  raise notice 'ok  credential-bearing changes require a future expiry at the write boundary';

  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(false) h
   where h.connection_name = 'Healthy SIS' and h.freshness_target_minutes = 30;
  reset role;
  perform pg_temp.counted('source-owner freshness policy overrides the connection fallback', n, 1);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(false) h
   where h.connection_name = 'Stale Catalog'
     and h.configuration_approval_status = 'pending'
     and h.next_safe_action ilike '%unchanged%approval%';
  reset role;
  perform pg_temp.counted('a pending configuration approval is visible but changes nothing', n, 1);
  select count(*) into n from public.integration_connections where id = stale and status = 'healthy';
  perform pg_temp.counted('requesting approval did not mutate connector configuration', n, 1);

  -- Approval evidence is immutable after it is recorded. Replace the fixture
  -- with an already-expired request instead of rewriting its pinned expiry.
  delete from public.approval_request where ticket = 'INT-100';
  perform set_config('request.jwt.claims', '', true);
  insert into public.approval_request
    (duty_id, requester, tenant_id, target, evidence, ticket, status, expires_at)
  select 'integration-config', operator, 'health-north', c.public_id,
         'Institution approval, scope, fallback, rollback and expiry recorded.',
         'INT-EXPIRED', 'pending', now() - interval '1 second'
    from public.integration_connections c where c.id = stale;
  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(false) h
   where h.connection_name = 'Stale Catalog'
     and h.configuration_approval_status = 'expired';
  reset role;
  perform pg_temp.counted('an expired configuration approval is not presented as open', n, 1);

  if not pg_temp.refused(operator, 'select count(*) from public.console_integration_health(true)') then
    raise exception 'FAILED: demo integrations were included without tenant:implement';
  end if;
  raise notice 'ok  demo inclusion needs the separate implementation grant';
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (operator, 'implementation_manager', 'school', 'health-demo', 'platform');
  perform pg_temp.become(operator);
  select count(*) into n from public.console_integration_health(true);
  reset role;
  perform pg_temp.counted('explicit authorized demo inclusion adds only the allowed demo connector', n, 6);

  if not pg_temp.refused(console_only, 'select count(*) from public.console_integration_health(false)') then
    raise exception 'FAILED: console shell alone opened integration health';
  end if;
  if not pg_temp.refused(integration_only, 'select count(*) from public.console_integration_health(false)') then
    raise exception 'FAILED: integration view alone opened the console workspace';
  end if;
  raise notice 'ok  shell-only and domain-only grants fail closed';

  perform pg_temp.become(operator);
  select string_agg(row_to_json(h)::text, '') into leaked from public.console_integration_health(false) h;
  reset role;
  if leaked ~ '(PLANTED_TOKEN|PLANTED_CURSOR|PLANTED_PROVIDER_MESSAGE)' then
    raise exception 'FAILED: a credential, cursor or provider message leaked';
  end if;
  raise notice 'ok  planted credential, cursor and provider message stay server-side';

  select count(*) into n
    from unnest(regexp_split_to_array(
      pg_get_function_result('public.console_integration_health(boolean)'::regprocedure), ', *'
    )) as col
   where col ~* '(credential|token|cursor|payload|external_record|sanitized_message|secret)';
  perform pg_temp.counted('the response contract has no credential or record-content column', n, 0);

  raise notice 'console integration health: every check passed';
end $$;

rollback;
