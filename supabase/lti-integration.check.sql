-- LTI bound to the integration control plane: the passback gate walked one
-- gate at a time, the pre-binding behaviour kept, and the launch's context
-- recorded only when every condition holds. Run as the Edge Function's
-- service role, which is who calls these. LOCAL/DISPOSABLE DATABASES ONLY.
--
--   supabase/check.sh lti-integration

begin;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.decide(iss text, client text)
returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role service_role';
  select public.lti_passback_decision(iss, client) into r;
  execute 'reset role';
  return r;
end $$;

create or replace function pg_temp.record(iss text, client text, ctx text)
returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role service_role';
  select public.lti_record_context(iss, client, ctx) into r;
  execute 'reset role';
  return r;
end $$;

create or replace function pg_temp.callable_by(who text, fn text)
returns boolean language sql as $$
  select has_function_privilege(who, fn, 'execute');
$$;

do $$
declare conn uuid; conn_pub text; n bigint; st text; last timestamptz;
        approver uuid := gen_random_uuid();
        envelope text; original_stamp timestamptz; refreshed integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (approver, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'admin@lti-a.example', now(), now(), now());
  insert into public.schools (id, name, email_domains) values
    ('lti-a', 'LTI University', array['lti-a.example']),
    ('lti-b', 'Other University', array['lti-b.example']);

  insert into public.lti_platform (issuer, client_id, deployment_id, auth_login_url, jwks_url, name) values
    ('https://legacy.example', 'c-legacy', 'd1', 'https://legacy.example/auth', 'https://legacy.example/jwks', 'Legacy'),
    ('https://bound.example',  'c-bound',  'd1', 'https://bound.example/auth',  'https://bound.example/jwks',  'Bound');

  -- Who may call ------------------------------------------------------------

  perform pg_temp.said('a signed-in account can call the passback gate',
    pg_temp.callable_by('authenticated', 'public.lti_passback_decision(text, text)')::text, 'false');
  perform pg_temp.said('a signed-out visitor can call context recording',
    pg_temp.callable_by('anon', 'public.lti_record_context(text, text, text)')::text, 'false');
  perform pg_temp.said('the service role can call the gate',
    pg_temp.callable_by('service_role', 'public.lti_passback_decision(text, text)')::text, 'true');

  -- Unbound: the behaviour that shipped on 22 September --------------------

  perform pg_temp.said('an unbound registration is refused', pg_temp.decide('https://legacy.example', 'c-legacy'), 'registration-unbound');
  perform pg_temp.said('an unknown registration', pg_temp.decide('https://nobody.example', 'x'), 'no-registration');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values (null, 'kill.writeback', true, 'incident');
  perform pg_temp.said('a global write-back stop reaches an unbound registration too',
    pg_temp.decide('https://legacy.example', 'c-legacy'), 'kill-switch');
  update public.feature_kill_switch set engaged = false where tenant_id is null;
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('lti-a', 'kill.writeback', true, 'school incident');
  perform pg_temp.said('a school''s stop cannot authorize a registration that names no school',
    pg_temp.decide('https://legacy.example', 'c-legacy'), 'registration-unbound');
  delete from public.feature_kill_switch where tenant_id = 'lti-a';
  perform pg_temp.said('and an unbound registration records no context',
    pg_temp.record('https://legacy.example', 'c-legacy', 'course-1'), 'unbound');

  -- Bound: every gate, in order --------------------------------------------

  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, authentication_type, sync_mode)
  values ('lti-a', 'lms', 'Brightspace', 'Brightspace LTI', 'lti_1_3', 'lti_launch')
  returning id, public_id into conn, conn_pub;
  update public.lti_platform set tenant_id = 'lti-a', connection_id = conn where issuer = 'https://bound.example';

  perform pg_temp.said('bound, nothing enabled', pg_temp.decide('https://bound.example', 'c-bound'), 'module-off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('lti-a', 'integration.lms_lti', 'production');
  perform pg_temp.said('module on, passback flag off', pg_temp.decide('https://bound.example', 'c-bound'), 'flag-off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('lti-a', 'writeback.lms_grade_passback', 'preview');
  perform pg_temp.said('passback flag in preview is not production', pg_temp.decide('https://bound.example', 'c-bound'), 'flag-off');
  update public.tenant_feature_policy set state = 'production' where capability = 'writeback.lms_grade_passback';
  perform pg_temp.said('flags on, connection never approved', pg_temp.decide('https://bound.example', 'c-bound'), 'connection-not-approved');
  update public.integration_connections set approved_at = now(), status = 'configuring' where id = conn;
  perform pg_temp.said('approved but still configuring', pg_temp.decide('https://bound.example', 'c-bound'), 'connection-configuring');
  perform pg_temp.said('a launch records the course context', pg_temp.record('https://bound.example', 'c-bound', 'course-1'), 'recorded');
  select status, last_successful_sync_at into st, last from public.integration_connections where id = conn;
  perform pg_temp.said('and that launch earns healthy', st, 'healthy');
  if last is null then raise exception 'FAILED: the launch left no last sync'; end if;
  perform pg_temp.said('healthy but approved read-only', pg_temp.decide('https://bound.example', 'c-bound'), 'connection-read-only');
  update public.integration_connections set sync_direction = 'approved_write' where id = conn;
  perform pg_temp.said('healthy, scope not approved', pg_temp.decide('https://bound.example', 'c-bound'), 'scope-not-approved');
  insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose, approved, approved_by, approved_at, expires_at)
  values ('lti-a', conn, 'scope.lms.score_publish', 'write', 'Practice scores to the instructor''s column', true,
          approver, now(), now() - interval '1 day');
  perform pg_temp.said('an expired scope', pg_temp.decide('https://bound.example', 'c-bound'), 'scope-not-approved');
  update public.integration_scopes set expires_at = null where connection_id = conn;
  perform pg_temp.said('every gate open', pg_temp.decide('https://bound.example', 'c-bound'), 'allowed');

  -- Each stop, one at a time -------------------------------------------------

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('lti-a', 'kill.writeback', true, 'school incident');
  perform pg_temp.said('the school''s write-back stop', pg_temp.decide('https://bound.example', 'c-bound'), 'kill-switch');
  delete from public.feature_kill_switch where tenant_id = 'lti-a';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('lti-b', 'kill.writeback', true, 'their incident');
  perform pg_temp.said('another school''s stop does not apply', pg_temp.decide('https://bound.example', 'c-bound'), 'allowed');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('lti-a', 'kill.connection.' || conn_pub, true, 'this connection');
  perform pg_temp.said('the connection''s own stop', pg_temp.decide('https://bound.example', 'c-bound'), 'kill-switch');
  perform pg_temp.said('which also stops context recording', pg_temp.record('https://bound.example', 'c-bound', 'course-1'), 'kill-switch');
  delete from public.feature_kill_switch where tenant_id = 'lti-a';
  update public.integration_connections set status = 'paused' where id = conn;
  perform pg_temp.said('a paused connection', pg_temp.decide('https://bound.example', 'c-bound'), 'connection-paused');
  perform pg_temp.said('records nothing', pg_temp.record('https://bound.example', 'c-bound', 'course-2'), 'connection-paused');
  update public.integration_connections set status = 'healthy' where id = conn;
  update public.tenant_feature_policy set state = 'off' where capability = 'writeback.lms_grade_passback';
  perform pg_temp.said('turning the flag off is the rollback', pg_temp.decide('https://bound.example', 'c-bound'), 'flag-off');

  -- What the recorded context is -------------------------------------------

  perform pg_temp.said('a second launch of the same course', pg_temp.record('https://bound.example', 'c-bound', 'course-1'), 'recorded');
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and canonical_entity_type = 'lms_context';
  perform pg_temp.said('updates the one reference rather than adding another', n::text, '1');
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and canonical_entity_type = 'lms_context'
     and subject_user_id is null and classification = 'T0' and source_of_truth = 'LMS'
     and freshness_status = 'live' and connection_id = conn;
  perform pg_temp.said('tenant-wide, T0, LMS as source of truth, live, on its connection', n::text, '1');
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and canonical_entity_type = 'lms_context'
     and (display ->> '_governance')::jsonb ->> 'aiEligibility' = 'denied_by_default'
     and (display ->> '_governance')::jsonb ->> 'sourceStandard' = 'LTI 1.3'
     and (display ->> '_governance')::jsonb ->> 'retentionPolicyId' = 'canonical:tenant-lifetime'
     and (display ->> '_governance')::jsonb ->> 'writeAuthority' = 'source-system-only'
     and ((display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz > now();
  perform pg_temp.said('direct LTI writes include governed provenance and expiry', n::text, '1');
  update public.integration_connections set freshness_target = interval '300000 years' where id = conn;
  perform pg_temp.said('an oversized direct LTI freshness interval is bounded', pg_temp.record('https://bound.example', 'c-bound', 'course-1'), 'recorded');
  select count(*) into n from public.canonical_entity_references where tenant_id = 'lti-a' and connection_id = conn
    and ((display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz = now() + interval '365 days';
  perform pg_temp.said('direct LTI freshness never exceeds 365 days', n::text, '1');
  update public.integration_connections set freshness_target = null where id = conn;
  perform pg_temp.said('restore the direct LTI freshness default', pg_temp.record('https://bound.example', 'c-bound', 'course-1'), 'recorded');
  perform pg_temp.said('an empty context is refused', pg_temp.record('https://bound.example', 'c-bound', ' '), 'no-context');

  -- Server-only metadata refresh and batched tombstones ----------------------
  perform pg_temp.said('an account cannot refresh integration governance',
    pg_temp.callable_by('authenticated', 'public.integration_refresh_governance(text, uuid, text, jsonb, timestamptz)')::text, 'false');
  perform pg_temp.said('a visitor cannot tombstone integration references',
    pg_temp.callable_by('anon', 'public.integration_tombstone_references(text, uuid, text, text, text[], timestamptz)')::text, 'false');
  select display ->> '_governance', source_timestamp into envelope, original_stamp
    from public.canonical_entity_references where tenant_id = 'lti-a' and connection_id = conn;
  -- The provider's still-valid 4 KB allowance must not be consumed by metadata.
  update public.canonical_entity_references
     set display = jsonb_build_object('title', repeat('x', 3800), '_governance', envelope)
   where tenant_id = 'lti-a' and connection_id = conn;
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and pg_column_size(display || '{}'::jsonb) > 4096
     and pg_column_size(display - '_governance') <= 4096;
  perform pg_temp.said('a near-limit provider value retains space for governance', n::text, '1');
  select public.integration_refresh_governance('lti-b', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp, 'governance', envelope)), now()) into refreshed;
  perform pg_temp.said('a wrong tenant refreshes nothing', refreshed::text, '0');
  select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp - interval '1 second', 'governance', envelope)), now()) into refreshed;
  perform pg_temp.said('a changed source revision refreshes nothing', refreshed::text, '0');
  select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp, 'governance', envelope)), now()) into refreshed;
  perform pg_temp.said('the confirmed source revision refreshes once', refreshed::text, '1');
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and display ->> 'title' = repeat('x', 3800);
  perform pg_temp.said('metadata refresh preserves stored values', n::text, '1');
  select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp, 'governance', (envelope::jsonb || jsonb_build_object(
        'sourceOwner', 'Replacement authority', 'sourceStandard', 'Replacement@2',
        'permittedPurposes', jsonb_build_array('new-purpose'),
        'retentionPolicyId', 'replacement-policy', 'retentionExpiresAt', now() + interval '10 years',
        'retrievedAt', now() + interval '1 minute', 'expiresAt', now() + interval '10 days'))::text)),
    now() + interval '1 minute') into refreshed;
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and connection_id = conn
     and ((display ->> '_governance')::jsonb - 'retrievedAt' - 'expiresAt')
       = (envelope::jsonb - 'retrievedAt' - 'expiresAt')
     and ((display ->> '_governance')::jsonb ->> 'retrievedAt')::timestamptz = now() + interval '1 minute'
     and ((display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz
       = (envelope::jsonb ->> 'expiresAt')::timestamptz + interval '1 minute';
  perform pg_temp.said('an adapter change cannot relabel unchanged values or extend retention', n::text, '1');
  select display ->> '_governance' into envelope from public.canonical_entity_references
   where tenant_id = 'lti-a' and connection_id = conn;
  update public.integration_connections set freshness_target = interval '1 hour' where id = conn;
  select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp, 'governance', envelope)), now() + interval '2 minutes') into refreshed;
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and connection_id = conn
     and ((display ->> '_governance')::jsonb - 'retrievedAt' - 'expiresAt')
       = (envelope::jsonb - 'retrievedAt' - 'expiresAt')
     and ((display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz = now() + interval '62 minutes';
  perform pg_temp.said('a connection freshness override changes only freshness clocks', n::text, '1');
  select display ->> '_governance' into envelope from public.canonical_entity_references
   where tenant_id = 'lti-a' and connection_id = conn;
  -- Negative/zero targets preserve the stored duration; sub-minute targets floor to one minute.
  for st in select unnest(array['-1 hour', '0 seconds', '30.5 seconds', '300000 years']) loop
    update public.integration_connections set freshness_target = st::interval where id = conn;
    select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
      jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
        'timestamp', original_stamp, 'governance', envelope)), now() + interval '3 minutes') into refreshed;
    select count(*) into n from public.canonical_entity_references
     where tenant_id = 'lti-a' and connection_id = conn
       and ((display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz
         = now() + interval '3 minutes' + case when st = '300000 years' then interval '365 days' when st = '30.5 seconds' then interval '1 minute' else interval '1 hour' end;
    perform pg_temp.said('validated connection freshness target ' || st, n::text, '1');
    select display ->> '_governance' into envelope from public.canonical_entity_references
     where tenant_id = 'lti-a' and connection_id = conn;
  end loop;
  -- A direct refresh never attaches current provenance to legacy mapped values.
  for st in select unnest(array[null, 'legacy string', '{}', '{"retrievedAt":"bad","expiresAt":"bad"}']) loop
    update public.canonical_entity_references set display = jsonb_build_object('title', 'Legacy value', '_governance', st)
     where tenant_id = 'lti-a' and connection_id = conn;
    select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
      jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
        'timestamp', original_stamp, 'governance', envelope)), now()) into refreshed;
    perform pg_temp.said('legacy governance is left for a full provider remap', refreshed::text, '0');
    select count(*) into n from public.canonical_entity_references where tenant_id = 'lti-a' and connection_id = conn
      and display = jsonb_build_object('title', 'Legacy value', '_governance', st);
    perform pg_temp.said('legacy metadata and values were not relabeled', n::text, '1');
  end loop;
  update public.canonical_entity_references set display = jsonb_build_object('title', 'Restored value', '_governance', envelope)
   where tenant_id = 'lti-a' and connection_id = conn;
  select public.integration_tombstone_references('lti-b', conn, 'LTI 1.3 https://bound.example',
    'lms_context', array['course-1'], now()) into refreshed;
  perform pg_temp.said('a wrong tenant tombstones nothing', refreshed::text, '0');
  select public.integration_tombstone_references('lti-a', conn, 'LTI 1.3 https://bound.example',
    'lms_context', array['course-1'], now()) into refreshed;
  perform pg_temp.said('a batch tombstone updates the source revision', refreshed::text, '1');
  select count(*) into n from public.canonical_entity_references
   where tenant_id = 'lti-a' and display = jsonb_build_object('_governance', envelope)
     and external_deleted_at is not null and freshness_status = 'unavailable';
  perform pg_temp.said('a tombstone retains only its own governance envelope', n::text, '1');
  select public.integration_refresh_governance('lti-a', conn, 'LTI 1.3 https://bound.example',
    jsonb_build_array(jsonb_build_object('entity', 'lms_context', 'id', 'course-1',
      'timestamp', original_stamp, 'governance', envelope)), now()) into refreshed;
  perform pg_temp.said('a racing refresh does not revive a tombstone', refreshed::text, '0');

  -- The binding itself -----------------------------------------------------

  begin
    update public.lti_platform set tenant_id = null where issuer = 'https://bound.example';
    raise exception 'FAILED: a connection without a school was accepted';
  exception when check_violation then
    raise notice 'ok  a registration cannot name a connection without its school';
  end;
  begin
    update public.lti_platform set tenant_id = 'lti-b' where issuer = 'https://bound.example';
    raise exception 'FAILED: a registration pointed at another school''s connection';
  exception when foreign_key_violation then
    raise notice 'ok  a registration cannot name another school''s connection';
  end;
end $$;

rollback;
