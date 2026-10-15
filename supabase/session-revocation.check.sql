-- One remote account-session revoke, its durable request receipt, minimized
-- audit/outbox evidence, and the first service-only event consumer.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh session-revocation

begin;

-- GoTrue's session table is absent from the disposable database. Keep this
-- fixture aligned with the columns the repository's session functions use.
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet
);

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

create or replace function pg_temp.revoke_as(
  who uuid, here uuid, target uuid, request_key uuid
)
returns jsonb language plpgsql as $$
declare answer jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', who::text, 'role', 'authenticated', 'session_id', here::text
  )::text, true);
  execute 'set local role authenticated';
  execute 'select jsonb_build_object(''outcome'', outcome, ''occurredAt'', occurred_at)
             from public.revoke_my_session($1, $2)'
    into answer using target, request_key;
  execute 'reset role';
  return answer;
exception when others then
  execute 'reset role';
  raise;
end $$;

create or replace function pg_temp.run_projector(want integer default 25)
returns jsonb language plpgsql as $$
declare answer jsonb;
begin
  execute 'set local role service_role';
  select public.run_account_security_projector(want) into answer;
  execute 'reset role';
  return answer;
exception when others then
  execute 'reset role';
  raise;
end $$;

do $$
declare refused boolean := false;
begin
  perform set_config('request.jwt.claims', '{}'::jsonb::text, true);
  execute 'set local role authenticated';
  begin
    execute 'select * from public.revoke_my_session($1, $2)'
      using gen_random_uuid(), gen_random_uuid();
  exception when sqlstate '28000' then
    refused := true;
  end;
  execute 'reset role';
  if not refused then
    raise exception 'FAILED: an unsigned caller reached the session revoke command';
  end if;
  raise notice 'ok  an unsigned caller cannot invoke the session revoke command';
exception when others then
  execute 'reset role';
  raise;
end $$;

do $$
declare
  sam uuid := pg_temp.newuser('sam@session-revoke.example');
  robin uuid := pg_temp.newuser('robin@session-revoke.example');
  here uuid := gen_random_uuid();
  phone uuid := gen_random_uuid();
  tablet uuid := gen_random_uuid();
  robins uuid := gen_random_uuid();
  missing uuid := gen_random_uuid();
  revoke_key uuid := gen_random_uuid();
  missing_key uuid := gen_random_uuid();
  cross_key uuid := gen_random_uuid();
  current_key uuid := gen_random_uuid();
  no_session_claim_key uuid := gen_random_uuid();
  rollback_key uuid := gen_random_uuid();
  answer jsonb;
  first_answer jsonb;
  event_row private.domain_outbox_events%rowtype;
  projected jsonb;
  malformed uuid;
  account_hash text;
  target_hash text;
begin
  insert into auth.sessions
    (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip)
  values
    (here, sam, now() - interval '2 days', now() - interval '1 hour',
      (now() at time zone 'UTC') - interval '1 hour',
      'Mozilla/5.0 (Macintosh) Chrome/130 secret-current-agent', '192.0.2.10'),
    (phone, sam, now() - interval '5 days', now() - interval '3 days', null,
      'Mozilla/5.0 (iPhone) Safari/604 secret-phone-agent', '192.0.2.11'),
    (tablet, sam, now() - interval '1 day', now() - interval '2 hours', null,
      'Mozilla/5.0 (iPad) Safari/604 secret-tablet-agent', '192.0.2.12'),
    (robins, robin, now() - interval '1 day', now() - interval '1 hour', null,
      'Mozilla/5.0 (Windows) Edge/130 secret-robin-agent', '192.0.2.13');

  -- If the JWT has no usable session id, the command cannot prove which row
  -- is current and must fail closed instead of risking self-revocation.
  answer := pg_temp.revoke_as(sam, null, phone, no_session_claim_key);
  if answer ->> 'outcome' <> 'refused'
     or not exists (select 1 from auth.sessions where id = phone and user_id = sam)
     or exists (
       select 1 from private.domain_outbox_events
        where idempotency_key = 'session-revoke:' || no_session_claim_key::text
     ) then
    raise exception 'FAILED: a token without a session id did not fail closed (%)', answer;
  end if;
  raise notice 'ok  a token without a session id fails closed';

  -- The current session is protected, and the refusal is a stable receipt.
  answer := pg_temp.revoke_as(sam, here, here, current_key);
  if answer ->> 'outcome' <> 'refused'
     or not exists (select 1 from auth.sessions where id = here and user_id = sam)
     or (select count(*) from private.domain_outbox_events
          where idempotency_key = 'session-revoke:' || current_key::text) <> 0
     or not exists (
       select 1 from public.audit_event
        where correlation_id = 'session-revoke:' || current_key::text
          and action = 'session.revoke' and outcome = 'denied'
          and detail = '{"outcome":"refused"}'::jsonb
     ) then
    raise exception 'FAILED: the current session was not refused with minimized durable evidence (%)', answer;
  end if;
  raise notice 'ok  the current session is protected and records no outbox event';

  -- A successful command changes the source and records exactly one bounded
  -- receipt, audit row, and outbox event in that transaction.
  first_answer := pg_temp.revoke_as(sam, here, phone, revoke_key);
  select * into event_row from private.domain_outbox_events
   where idempotency_key = 'session-revoke:' || revoke_key::text;
  account_hash := event_row.payload ->> 'accountRef';
  target_hash := event_row.aggregate_id;
  if first_answer ->> 'outcome' <> 'revoked'
     or first_answer ->> 'occurredAt' is null
     or exists (select 1 from auth.sessions where id = phone)
     or event_row.id is null
     or event_row.aggregate_type <> 'auth_session'
     or event_row.event_type <> 'identity.session_revoked'
     or event_row.event_version <> 1
     or event_row.tenant_id is not null
     or event_row.producer <> 'account_sessions'
     or event_row.correlation_id <> 'session-revoke:' || revoke_key::text
     or event_row.data_classification <> 'internal'
     or event_row.retention_class <> 'audit'
     or event_row.payload <> jsonb_build_object(
       'accountRef', account_hash,
       'outcome', 'revoked',
       'changedFields', jsonb_build_array('refresh_session')
     )
     or account_hash !~ '^[0-9a-f]{64}$'
     or target_hash !~ '^[0-9a-f]{64}$'
     or event_row::text like '%' || sam::text || '%'
     or event_row::text like '%' || phone::text || '%'
     or event_row::text like '%secret-phone-agent%'
     or event_row::text like '%192.0.2.11%'
     or not exists (
       select 1 from public.audit_event
        where correlation_id = 'session-revoke:' || revoke_key::text
          and action = 'session.revoke' and object_kind = 'auth_session'
          and outcome = 'allowed' and detail = '{"outcome":"revoked"}'::jsonb
          and object_sha256 = target_hash and actor_sha256 = account_hash
     )
     or not exists (
       select 1 from private.session_revocation_command_receipt
        where account_sha256 = account_hash and target_sha256 = target_hash
          and request_key = revoke_key and outcome = 'revoked'
          and event_id = event_row.id
     ) then
    raise exception 'FAILED: a successful revoke did not commit one minimized evidence set (%)', first_answer;
  end if;
  raise notice 'ok  a successful revoke commits one minimized receipt, audit row, and event';

  -- A lost response may replay the request. The original receipt is returned
  -- and nothing consequential is written twice.
  answer := pg_temp.revoke_as(sam, here, phone, revoke_key);
  if answer is distinct from first_answer
     or (select count(*) from private.session_revocation_command_receipt
          where account_sha256 = account_hash and request_key = revoke_key) <> 1
     or (select count(*) from public.audit_event
          where correlation_id = 'session-revoke:' || revoke_key::text) <> 1
     or (select count(*) from private.domain_outbox_events
          where idempotency_key = 'session-revoke:' || revoke_key::text) <> 1 then
    raise exception 'FAILED: replay changed the stable receipt or duplicated evidence (%)', answer;
  end if;
  raise notice 'ok  replay returns the original receipt without duplicate evidence';

  -- A request key is bound to one target. Reusing it cannot move a second
  -- session, and does not append another audit/event under that key.
  answer := pg_temp.revoke_as(sam, here, tablet, revoke_key);
  if answer ->> 'outcome' <> 'refused'
     or not exists (select 1 from auth.sessions where id = tablet and user_id = sam)
     or (select count(*) from public.audit_event
          where correlation_id = 'session-revoke:' || revoke_key::text) <> 1
     or (select count(*) from private.domain_outbox_events
          where idempotency_key = 'session-revoke:' || revoke_key::text) <> 1 then
    raise exception 'FAILED: one request key moved a second target (%)', answer;
  end if;
  raise notice 'ok  a request key is bound to one target';

  -- Missing and another account's session are deliberately the same answer.
  answer := pg_temp.revoke_as(sam, here, missing, missing_key);
  first_answer := pg_temp.revoke_as(sam, here, robins, cross_key);
  if answer ->> 'outcome' <> 'already_ended'
     or first_answer ->> 'outcome' <> 'already_ended'
     or not exists (select 1 from auth.sessions where id = robins and user_id = robin)
     or exists (
       select 1 from private.domain_outbox_events
        where idempotency_key in (
          'session-revoke:' || missing_key::text,
          'session-revoke:' || cross_key::text
        )
     ) then
    raise exception 'FAILED: missing and cross-account targets were distinguishable or changed (%) (%)', answer, first_answer;
  end if;
  raise notice 'ok  a missing and another account''s target are indistinguishable';

  -- A later failure in the source transaction rolls back the session delete
  -- and all three forms of evidence.
  begin
    answer := pg_temp.revoke_as(sam, here, tablet, rollback_key);
    raise exception 'roll back the command' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    null;
  end;
  if not exists (select 1 from auth.sessions where id = tablet and user_id = sam)
     or exists (
       select 1 from private.session_revocation_command_receipt
        where account_sha256 = account_hash and request_key = rollback_key
     )
     or exists (
       select 1 from public.audit_event
        where correlation_id = 'session-revoke:' || rollback_key::text
     )
     or exists (
       select 1 from private.domain_outbox_events
        where idempotency_key = 'session-revoke:' || rollback_key::text
     ) then
    raise exception 'FAILED: a rolled-back command left a source or evidence change';
  end if;
  raise notice 'ok  source, receipt, audit, and outbox roll back together';

  -- The event's first consumer uses the canonical claim/receipt path and
  -- projects pseudonyms only. Running it twice is a no-op.
  projected := pg_temp.run_projector();
  if projected <> jsonb_build_object(
       'claimed', 1, 'processed', 1, 'skipped', 0,
       'retrying', 0, 'deadLettered', 0
     )
     or not exists (
       select 1 from private.account_session_security_projection
        where account_sha256 = account_hash and target_sha256 = target_hash
          and source_event_id = event_row.id and outcome = 'revoked'
     )
     or not exists (
       select 1 from private.domain_event_receipts
        where consumer = 'account-security.session-revocations.v1'
          and event_id = event_row.id and outcome = 'processed'
     )
     or (select count(*) from private.account_session_security_projection) <> 1 then
    raise exception 'FAILED: the bounded first consumer did not settle one event (%)', projected;
  end if;
  if pg_temp.run_projector() <> jsonb_build_object(
       'claimed', 0, 'processed', 0, 'skipped', 0,
       'retrying', 0, 'deadLettered', 0
     ) then
    raise exception 'FAILED: a settled event was projected twice';
  end if;
  raise notice 'ok  the first consumer projects and receipts the event once';

  -- Malformed input is isolated with fixed text; no payload or provider text
  -- is copied into the failure record.
  malformed := private.emit_domain_event(
    'auth_session', repeat('a', 64), 'identity.session_revoked', 1,
    null, 'account_sessions', 'session-revoke-malformed',
    'session-revoke-malformed',
    jsonb_build_object('outcome', 'revoked',
      'changedFields', jsonb_build_array('refresh_session')),
    'internal', 'audit'
  );
  projected := pg_temp.run_projector();
  if projected ->> 'deadLettered' <> '1'
     or exists (
       select 1 from private.account_session_security_projection
        where source_event_id = malformed
     )
     or not exists (
       select 1 from private.domain_outbox_events
        where id = malformed and dead_lettered_at is not null
          and last_error = 'invalid identity.session_revoked version 1 event'
     )
     or not exists (
       select 1 from private.domain_event_receipts
        where consumer = 'account-security.session-revocations.v1'
          and event_id = malformed and outcome = 'failed'
          and last_error = 'invalid identity.session_revoked version 1 event'
     ) then
    raise exception 'FAILED: malformed input was not safely dead-lettered (%)', projected;
  end if;
  raise notice 'ok  malformed input dead-letters with fixed minimized failure text';

  -- Client roles reach only the two public self-service functions.
  if has_table_privilege('anon', 'private.session_revocation_command_receipt', 'select')
     or has_table_privilege('authenticated', 'private.session_revocation_command_receipt', 'select')
     or has_table_privilege('anon', 'private.account_session_security_projection', 'select')
     or has_table_privilege('authenticated', 'private.account_session_security_projection', 'select')
     or has_function_privilege('anon', 'public.revoke_my_session(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.run_account_security_projector(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.run_account_security_projector(integer)', 'execute')
     or has_function_privilege('authenticated', 'private.claim_session_revocation_events(integer)', 'execute')
     or has_function_privilege('authenticated', 'private.apply_session_revocation_event(uuid,uuid)', 'execute') then
    raise exception 'FAILED: a client role reached a private receipt/projector boundary';
  end if;
  if not has_function_privilege('authenticated', 'public.revoke_my_session(uuid,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.run_account_security_projector(integer)', 'execute') then
    raise exception 'FAILED: control — the intended caller cannot reach its function';
  end if;
  raise notice 'ok  only the authenticated self-service command and service projector are reachable';
end $$;

rollback;
