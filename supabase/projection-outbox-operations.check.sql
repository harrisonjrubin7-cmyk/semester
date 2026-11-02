-- Projection outbox operations (P1-03): claim, settle, bounded failure and
-- approval-bound replay. LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
-- How to run: supabase/check.sh projection-outbox-operations

begin;

create or replace function pg_temp.become(who uuid, mfa boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when mfa then
      json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
        'amr', json_build_array(json_build_object('method', 'totp',
          'timestamp', floor(extract(epoch from now()))::bigint)))::text
    else json_build_object('sub', who::text, 'role', 'authenticated')::text end,
    true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
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
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.attempt(who uuid, mfa boolean, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who, mfa);
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.service(statement text)
returns text language plpgsql as $$
declare result text;
begin
  execute 'set local role service_role';
  execute statement into result;
  execute 'reset role';
  return result;
exception when others then
  execute 'reset role';
  raise;
end $$;

create or replace function pg_temp.event(
  suffix text,
  tenant text default 'proj-ops-a',
  happened timestamptz default now()
)
returns uuid language plpgsql as $$
declare made uuid;
begin
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id,
     producer, correlation_id, idempotency_key, payload, data_classification,
     retention_class, occurred_at)
  values
    ('projection_probe', suffix, 'projection.changed', 1, 'production', tenant,
     'projection-check', 'proj-correlation-' || suffix, suffix,
     jsonb_build_object('id', suffix), 'internal', 'operational', happened)
  returning id into made;
  return made;
end $$;

create temp table ids (key text primary key, value text not null);
create or replace function pg_temp.remember(key text, value text)
returns void language sql as $$
  insert into ids values (key, value) on conflict (key) do update set value = excluded.value
$$;
create or replace function pg_temp.id(want_key text)
returns uuid language sql stable as $$ select value::uuid from ids where ids.key = want_key $$;

insert into public.schools (id, name, email_domains) values
  ('proj-ops-a', 'Projection Operations A', array['proj-ops-a.example']),
  ('proj-ops-b', 'Projection Operations B', array['proj-ops-b.example']);

do $$
declare
  operator uuid := pg_temp.newuser('operator@proj-ops-a.example', 'proj-ops-a');
  stranger uuid := pg_temp.newuser('stranger@proj-ops-a.example', 'proj-ops-a');
begin
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (operator, 'platform_admin', 'platform', '', 'platform');
  insert into public.council_seat_holder (seat, subject)
  values ('engineering', operator);
  perform pg_temp.remember('operator', operator::text);
  perform pg_temp.remember('stranger', stranger::text);
end $$;

-- The private transitions are service-only, and a client cannot turn a grant
-- mistake into direct outbox access.
do $$
declare
  stranger uuid := pg_temp.id('stranger');
  message text;
begin
  if has_function_privilege('anon', 'private.claim_domain_events(text,integer)', 'execute')
     or has_function_privilege('authenticated', 'private.claim_domain_events(text,integer)', 'execute')
     or has_function_privilege('authenticated', 'private.complete_domain_event(text,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'private.fail_domain_event(text,uuid,uuid,text,boolean)', 'execute') then
    raise exception 'FAILED: a client role can execute a worker transition';
  end if;
  if not has_function_privilege('service_role', 'private.claim_domain_events(text,integer)', 'execute') then
    raise exception 'FAILED: control — service_role cannot claim events';
  end if;
  message := pg_temp.attempt(stranger, false, $q$select private.claim_domain_events('ops.projector', 1)$q$);
  if message not ilike '%permission denied%' then
    raise exception 'FAILED: a signed-in account was not refused by the private claim function (%)', message;
  end if;
  raise notice 'ok  worker transitions are executable only by service_role';
end $$;

-- Claim order, due-time exclusion, active-lease exclusion, stale recovery and
-- the hard batch bound.
do $$
declare
  first_id uuid := pg_temp.event('first', happened => now() - interval '10 minutes');
  stale_id uuid := pg_temp.event('stale', happened => now() - interval '9 minutes');
  active_id uuid := pg_temp.event('active', happened => now() - interval '8 minutes');
  future_id uuid := pg_temp.event('future', happened => now() - interval '7 minutes');
  claimed private.domain_outbox_events%rowtype;
  old_claim uuid := gen_random_uuid();
  message text;
  n integer;
begin
  update private.domain_outbox_events set claim_id = old_claim, claimed_at = now() - interval '6 minutes'
   where id = stale_id;
  update private.domain_outbox_events set claim_id = gen_random_uuid(), claimed_at = now()
   where id = active_id;
  update private.domain_outbox_events set next_attempt_at = now() + interval '1 hour'
   where id = future_id;

  execute 'set local role service_role';
  select * into claimed from private.claim_domain_events('ops.projector', 1);
  execute 'reset role';
  if claimed.id is distinct from first_id or claimed.claim_id is null or claimed.claimed_at is null then
    raise exception 'FAILED: the oldest due unclaimed event was not claimed (%)', claimed.id;
  end if;
  perform pg_temp.remember('first', first_id::text);
  perform pg_temp.remember('first_claim', claimed.claim_id::text);

  execute 'set local role service_role';
  select * into claimed from private.claim_domain_events('ops.projector', 1);
  execute 'reset role';
  if claimed.id is distinct from stale_id or claimed.claim_id is null or claimed.claim_id = old_claim then
    raise exception 'FAILED: the stale lease was not recovered with a new claim (%)', claimed;
  end if;
  select count(*) into n from private.domain_outbox_events
   where id in (active_id, future_id) and claim_id is not null;
  if n <> 1 then
    raise exception 'FAILED: an active or not-yet-due event was claimed';
  end if;

  begin
    perform private.claim_domain_events('ops.projector', 101);
    raise exception 'FAILED: a claim over the batch bound was accepted';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok  claims are ordered, bounded, due-only and recover stale leases';
end $$;

-- Completion requires the exact claim, writes one receipt atomically, and is
-- idempotent on a repeated response.
do $$
declare
  ev uuid := pg_temp.id('first');
  claim_id uuid := pg_temp.id('first_claim');
  completed boolean;
  message text;
  n integer;
begin
  begin
    perform pg_temp.service(format(
      'select private.complete_domain_event(%L, %L, %L, %L)::text',
      'ops.projector', ev, gen_random_uuid(), 'processed'));
    raise exception 'FAILED: a wrong claim completed an event';
  exception when sqlstate '40001' then null;
  end;

  completed := pg_temp.service(format(
    'select private.complete_domain_event(%L, %L, %L, %L)::text',
    'ops.projector', ev, claim_id, 'processed'))::boolean;
  if not completed then raise exception 'FAILED: the held event was not completed'; end if;
  completed := pg_temp.service(format(
    'select private.complete_domain_event(%L, %L, %L, %L)::text',
    'ops.projector', ev, claim_id, 'processed'))::boolean;
  if completed then raise exception 'FAILED: a repeated completion reported a second transition'; end if;
  select count(*) into n from private.domain_event_receipts r
   where r.consumer = 'ops.projector' and r.event_id = ev and r.outcome = 'processed';
  if n <> 1 or (select e.published_at is null from private.domain_outbox_events e where e.id = ev) then
    raise exception 'FAILED: completion did not atomically publish and receipt the event';
  end if;
  raise notice 'ok  completion is claim-bound, atomic and idempotent';
end $$;

-- Retry is delayed and bounded; attempt eight dead-letters and records one
-- failed receipt. Error text is trimmed and capped before storage.
do $$
declare
  ev uuid := pg_temp.event('failure', happened => now() - interval '1 minute');
  claimed private.domain_outbox_events%rowtype;
  result jsonb;
  n integer;
begin
  execute 'set local role service_role';
  select * into claimed from private.claim_domain_events('ops.projector', 1);
  result := private.fail_domain_event('ops.projector', claimed.id, claimed.claim_id, ' transient ', true);
  execute 'reset role';
  if claimed.id is distinct from ev or result ->> 'state' <> 'retry'
     or (select e.next_attempt_at <= now() from private.domain_outbox_events e where e.id = ev)
     or (select e.last_error from private.domain_outbox_events e where e.id = ev) <> 'transient' then
    raise exception 'FAILED: the retry was not delayed with a sanitized error (%)', result;
  end if;

  update private.domain_outbox_events e
     set publish_attempts = 7, next_attempt_at = now() - interval '1 second'
   where e.id = ev;
  execute 'set local role service_role';
  select * into claimed from private.claim_domain_events('ops.projector', 1);
  result := private.fail_domain_event('ops.projector', claimed.id, claimed.claim_id, repeat('x', 700), true);
  execute 'reset role';
  select count(*) into n from private.domain_event_receipts r
   where r.consumer = 'ops.projector' and r.event_id = ev and r.outcome = 'failed';
  if result ->> 'state' <> 'dead_letter' or n <> 1
     or (select dead_lettered_at is null or length(last_error) <> 500
           from private.domain_outbox_events e where e.id = ev) then
    raise exception 'FAILED: attempt eight did not dead-letter once with a bounded error (%)', result;
  end if;
  perform pg_temp.remember('dead', ev::text);
  raise notice 'ok  retry has a future due time and attempt eight dead-letters with one failed receipt';
end $$;

-- Requests are structurally bound before approval. Execution additionally
-- needs capability, fresh MFA, the exact approved target, and a live dead
-- letter; the audit row precedes the reset and a repeated call is a no-op.
do $$
declare
  operator uuid := pg_temp.id('operator');
  stranger uuid := pg_temp.id('stranger');
  ev uuid := pg_temp.id('dead');
  approval uuid := gen_random_uuid();
  wrong uuid := gen_random_uuid();
  result jsonb;
  message text;
  n integer;
begin
  begin
    insert into public.approval_request
      (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, decided_at)
    values
      (wrong, 'projection-replay', operator, 'proj-ops-a', 'domain-event:' || ev,
       jsonb_build_object('event_id', ev, 'consumer', 'ops.projector'),
       'Missing the version and rollback plan', 'OPS-REPLAY-0', 'approved', now());
    raise exception 'FAILED: an ambiguous replay request was accepted';
  exception when sqlstate '22023' then null;
  end;

  insert into public.approval_request
    (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, decided_at)
  values
    (approval, 'projection-replay', operator, 'proj-ops-a', 'domain-event:' || ev,
     jsonb_build_object('event_id', ev, 'consumer', 'ops.projector',
                        'projector_version', 'ops-projector@1',
                        'rollback_plan', 'Pause the worker and restore the dead letter.'),
     'Cause repaired and payload checked against projector version 1.',
     'OPS-REPLAY-1', 'approved', now());

  message := pg_temp.attempt(stranger, true, format(
    'select public.replay_domain_event(%L, %L, %L)', ev, 'ops.projector', approval));
  if message not ilike '%console:operate%' then
    raise exception 'FAILED: an account without console:operate was not refused (%)', message;
  end if;
  message := pg_temp.attempt(operator, false, format(
    'select public.replay_domain_event(%L, %L, %L)', ev, 'ops.projector', approval));
  -- Privileged-role capability projection now hides console:operate at AAL1,
  -- so the request may fail at the capability gate before the function's own
  -- freshness check. Both are fail-closed denials of the same unauthenticated
  -- replay; a null message would mean the replay actually ran.
  if message is null or (message not ilike '%Fresh MFA%' and message not ilike '%console:operate%') then
    raise exception 'FAILED: replay without fresh MFA was not refused (%)', message;
  end if;
  message := pg_temp.attempt(operator, true, format(
    'select public.replay_domain_event(%L, %L, %L)', ev, 'another.projector', approval));
  if message not ilike '%does not bind%' then
    raise exception 'FAILED: approval was reused for another consumer (%)', message;
  end if;

  perform pg_temp.become(operator, true);
  result := public.replay_domain_event(ev, 'ops.projector', approval, 'projection-replay-check-1');
  perform pg_temp.nobody();
  if not (result ->> 'replayed')::boolean
     or (select dead_lettered_at is not null or publish_attempts <> 0 or next_attempt_at is null
           from private.domain_outbox_events e where e.id = ev)
     or (select status from public.approval_request where id = approval) <> 'executed' then
    raise exception 'FAILED: approved replay did not reset the event and consume approval (%)', result;
  end if;
  select count(*) into n from private.console_audit_event
   where action = 'projection.replayed' and target = ev::text
     and correlation_id = 'projection-replay-check-1';
  if n <> 1 then raise exception 'FAILED: replay audit event was not written'; end if;
  if (select r.outcome from private.domain_event_receipts r
       where r.consumer = 'ops.projector' and r.event_id = ev) <> 'failed' then
    raise exception 'FAILED: replay erased the idempotency receipt instead of preserving its key';
  end if;

  perform pg_temp.become(operator, true);
  result := public.replay_domain_event(ev, 'ops.projector', approval);
  perform pg_temp.nobody();
  if (result ->> 'replayed')::boolean or result ->> 'status' <> 'already_executed' then
    raise exception 'FAILED: repeated replay was not an idempotent no-op (%)', result;
  end if;
  raise notice 'ok  replay is structurally bound, capability/MFA/approval gated, audited and idempotent';
end $$;

-- The same approved shape fails closed if the immutable audit writer cannot
-- append: no delivery state or approval status changes.
do $$
declare
  operator uuid := pg_temp.id('operator');
  ev uuid := pg_temp.event('audit-fail');
  claim_id uuid;
  approval uuid := gen_random_uuid();
  message text;
begin
  update private.domain_outbox_events e
     set publish_attempts = 8, dead_lettered_at = now(), last_error = 'terminal'
   where e.id = ev;
  insert into public.approval_request
    (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, decided_at)
  values
    (approval, 'projection-replay', operator, 'proj-ops-a', 'domain-event:' || ev,
     jsonb_build_object('event_id', ev, 'consumer', 'ops.projector',
                        'projector_version', 'ops-projector@1', 'rollback_plan', 'Keep the worker paused.'),
     'Cause repaired.', 'OPS-REPLAY-2', 'approved', now());

  revoke insert on private.console_audit_event from semester_audit_writer;
  message := pg_temp.attempt(operator, true, format(
    'select public.replay_domain_event(%L, %L, %L)', ev, 'ops.projector', approval));
  grant insert on private.console_audit_event to semester_audit_writer;
  if message is null then raise exception 'FAILED: replay ran while audit append was unavailable'; end if;
  if (select e.dead_lettered_at is null from private.domain_outbox_events e where e.id = ev)
     or (select status from public.approval_request where id = approval) <> 'approved' then
    raise exception 'FAILED: replay state changed after its audit write failed';
  end if;
  raise notice 'ok  an audit failure leaves both the event and approval unchanged';
end $$;

rollback;
