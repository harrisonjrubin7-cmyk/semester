-- Support tickets (20260928210000_support_tickets.sql).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- Two students and a support agent. Each rule is walked by the account it is
-- about and by one it should stop; every count is read as that account.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_mfa(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object(
      'sub', who::text,
      'role', 'authenticated',
      'aal', 'aal2',
      'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())))
    )::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1) || substr(md5(address), 1, 4));
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

create or replace function pg_temp.must_refuse(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then raise exception 'FAILED: % — it was allowed', what; end if;
  raise notice 'ok  %', what;
end $$;

do $$
declare
  ada uuid;
  ben uuid;
  agent uuid;
  a11y uuid;
  howto uuid;
  n bigint;
  due_hours numeric;
  pri text;
  operation uuid := gen_random_uuid();
  notice_message uuid;
  notice_choice text;
begin
  ada := pg_temp.newuser('ada@tickets.example');
  ben := pg_temp.newuser('ben@tickets.example');
  agent := pg_temp.newuser('agent@semester.example');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (agent, 'support_agent', 'platform', '', 'platform');

  -- ── Opening a ticket ──────────────────────────────────────────────────

  perform pg_temp.become(ada);
  a11y := public.open_support_ticket('accessibility', 'Drill buttons', 'I cannot reach the buttons with a switch.',
    '{"app_version": "2026.9.27", "device_class": "tablet", "screen": "#/drill"}'::jsonb, false);
  howto := public.open_support_ticket('how_to', 'Export', 'How do I export my calendar?', '{}'::jsonb, false);
  perform public.set_support_email_notice(a11y, true);
  reset role;

  select priority, extract(epoch from (first_response_due - created_at)) / 3600 into pri, due_hours
    from public.support_tickets where id = a11y;
  if pri <> 'high' or due_hours <> 24 then raise exception 'FAILED: accessibility is high priority with a 24-hour target (got %, %)', pri, due_hours; end if;
  raise notice 'ok  accessibility is high priority with a 24-hour first-response target';
  select extract(epoch from (first_response_due - created_at)) / 3600 into due_hours from public.support_tickets where id = howto;
  perform pg_temp.counted('a how-to question has a 72-hour target', due_hours::bigint, 72);

  perform pg_temp.must_refuse('context may not carry a key outside the six', ada,
    $q$select public.open_support_ticket('bug', 's', 'b', '{"gpa": "3.1"}'::jsonb, false)$q$);
  perform pg_temp.must_refuse('nor a value that is not text', ada,
    $q$select public.open_support_ticket('bug', 's', 'b', '{"offline": true}'::jsonb, false)$q$);
  perform pg_temp.become(ben);
  for i in 1..5 loop
    perform public.open_support_ticket('bug', 'flood ' || i, 'b', '{}'::jsonb, false);
  end loop;
  reset role;
  perform pg_temp.must_refuse('a sixth ticket in a day is refused', ben,
    $q$select public.open_support_ticket('bug', 'sixth', 'b', '{}'::jsonb, false)$q$);
  delete from public.support_tickets where student_id = ben;
  perform pg_temp.must_refuse('a signed-out visitor cannot open a ticket', null,
    $q$select public.open_support_ticket('bug', 's', 'b', '{}'::jsonb, false)$q$);

  -- ── Each student sees only their own ──────────────────────────────────

  perform pg_temp.become(ben);
  select count(*) into n from public.my_support_tickets();
  reset role;
  perform pg_temp.counted('another student sees none of Ada''s tickets', n, 0);
  perform pg_temp.become(ada);
  select count(*) into n from public.my_support_email_notices() where ticket_id = a11y and enabled;
  reset role;
  perform pg_temp.counted('the student can read the email-notice choice for their own ticket', n, 1);
  perform pg_temp.become(ben);
  select count(*) into n from public.my_support_thread(a11y);
  reset role;
  perform pg_temp.counted('nor her thread, by its id', n, 0);
  perform pg_temp.must_refuse('nor reply to it', ben, format('select public.reply_to_my_ticket(%L, %L)', a11y, 'hi'));
  perform pg_temp.must_refuse('nor close it', ben, format('select public.close_my_ticket(%L)', a11y));
  perform pg_temp.must_refuse('nor change its email-notice choice', ben,
    format('select public.set_support_email_notice(%L, true)', a11y));
  perform pg_temp.must_refuse('the table itself is closed to students', ada, 'select count(*) from public.support_tickets');

  -- ── The queue: capability-gated, priority first, no identity ──────────

  perform pg_temp.must_refuse('a student cannot read the queue', ada, 'select count(*) from public.support_ticket_queue()');
  perform pg_temp.must_refuse('nor a thread through the staff route', ben, format('select count(*) from public.support_ticket_thread(%L)', a11y));

  perform pg_temp.become(agent);
  select count(*) into n from public.support_ticket_queue();
  reset role;
  perform pg_temp.counted('the agent sees both open tickets', n, 2);
  perform pg_temp.become(agent);
  select count(*) into n from (select q.id from public.support_ticket_queue() q limit 1) first
   where first.id = a11y;
  reset role;
  perform pg_temp.counted('with the accessibility ticket first', n, 1);

  select count(*) into n from unnest(regexp_split_to_array(
    pg_get_function_result('public.support_ticket_queue()'::regprocedure) || ',' ||
    pg_get_function_result('public.support_ticket_thread(uuid)'::regprocedure), ',\s*')) as col
   where col ~* '(student|user|email|account|name|handle)';
  perform pg_temp.counted('neither the queue nor the thread has a column that could name the student', n, 0);

  perform pg_temp.become(agent);
  select count(*) into n from public.support_ticket_thread(a11y) where context ? 'device_class';
  reset role;
  perform pg_temp.counted('the agent sees the context the student ticked', n, 1);

  -- ── Replies and the first-response clock ──────────────────────────────

  perform pg_temp.must_refuse('a support reply requires fresh MFA at the database boundary', agent,
    format('select public.support_reply(%L, %L, %L, %L)', a11y, 'stale session', 'waiting_on_student', operation));
  perform pg_temp.become_mfa(agent);
  perform public.support_reply(a11y, 'Thanks. Which switch software do you use?', 'waiting_on_student', operation);
  reset role;
  select count(*) into n from public.support_tickets where id = a11y and first_responded_at is not null and status = 'waiting_on_student';
  perform pg_temp.counted('a reply stamps the first response and sets the status', n, 1);
  select count(*) into n from public.audit_event
   where action = 'support.reply'
     and object_kind = 'support_ticket'
     and object_sha256 = private.role_audit_sha256(a11y::text)
     and actor_sha256 = private.role_audit_sha256(agent::text)
     and actor_kind = 'authenticated'
     and correlation_id ~ '^[0-9a-f]{64}$'
     and detail = '{"next_status":"waiting_on_student","notification_queued":true}'::jsonb;
  perform pg_temp.counted('a reply records its ticket, message and acting agent without support content', n, 1);
  select count(*) into n from public.support_notification_outbox
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null;
  perform pg_temp.counted('the reply commits a durable notification intent in the same transaction', n, 1);
  perform pg_temp.become_mfa(agent);
  perform public.support_reply(a11y, 'Thanks. Which switch software do you use?', 'waiting_on_student', operation);
  reset role;
  select count(*) into n from public.support_ticket_messages
   where ticket_id = a11y and from_side = 'support' and client_operation_id = operation;
  perform pg_temp.counted('retrying one reply operation does not duplicate its message', n, 1);
  select count(*) into n from public.support_notification_outbox where ticket_id = a11y;
  perform pg_temp.counted('retrying one reply operation does not duplicate its email intent', n, 1);
  select message_id into notice_message from public.support_notification_outbox where ticket_id = a11y;
  perform pg_temp.must_refuse('a student cannot claim support-notification work', ada,
    format('select count(*) from public.claim_support_notifications(%L, 1)', notice_message));
  execute 'set local role service_role';
  select count(*) into n from public.claim_support_notifications(notice_message, 1);
  execute 'reset role';
  perform pg_temp.counted('the delivery worker atomically claims the pending notice', n, 1);
  execute 'set local role service_role';
  select count(*) into n from public.claim_support_notifications(notice_message, 1);
  execute 'reset role';
  perform pg_temp.counted('an overlapping worker cannot claim the same notice', n, 0);
  select count(*) into n from public.support_notification_outbox
   where ticket_id = a11y and claim_id is not null and claimed_at is not null;
  perform pg_temp.counted('a claimed notice records one complete ownership pair', n, 1);

  perform pg_temp.become_mfa(agent);
  perform public.support_reply(a11y, 'Second update.', 'waiting_on_student', gen_random_uuid());
  perform public.support_reply(a11y, 'Third update.', 'waiting_on_student', gen_random_uuid());
  reset role;
  -- Test-fixture clock control is intentionally outside the support-agent role;
  -- agents never receive direct access to the notification outbox.
  update public.support_notification_outbox
     set queued_at = now() - interval '2 days'
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null;
  perform pg_temp.become_mfa(agent);
  perform public.support_reply(a11y, 'Fourth update.', 'waiting_on_student', gen_random_uuid());
  reset role;
  select count(*) into n from public.support_notification_outbox where ticket_id = a11y;
  perform pg_temp.counted('aged pending support email still counts toward the three-notice cap', n, 3);
  perform pg_temp.become(ada);
  select public.set_support_email_notice(a11y, false) into notice_choice;
  reset role;
  if notice_choice <> 'off_with_in_flight' then
    raise exception 'FAILED: opting out did not disclose the claimed notice — got %', notice_choice;
  end if;
  raise notice 'ok  opting out discloses the notice already in flight';
  select count(*) into n from public.support_notification_outbox
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null and claim_id is null;
  perform pg_temp.counted('opting out cancels every unclaimed support notice', n, 0);
  select count(*) into n from public.support_notification_outbox
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null and claim_id is not null;
  perform pg_temp.counted('opting out preserves the notice already in flight', n, 1);
  update public.support_notification_outbox
     set attempts = attempts + 1, claim_id = null, claimed_at = null,
         next_attempt_at = now() + interval '2 minutes', last_error = 'provider unavailable'
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null;
  select count(*) into n from public.support_notification_outbox
   where ticket_id = a11y and accepted_at is null and dead_lettered_at is null;
  perform pg_temp.counted('a failed claimed notice is cancelled after the student opted out', n, 0);
  perform pg_temp.become_mfa(agent);
  begin
    perform public.support_reply(a11y, 'closing', 'closed', gen_random_uuid());
    raise exception 'FAILED: support closed a ticket for the student';
  exception when others then
    if position('only the student closes it' in sqlerrm) = 0 then raise; end if;
  end;
  reset role;
  raise notice 'ok  support cannot close a ticket for the student';

  select count(*) into n from pg_catalog.pg_proc p
   where p.oid = 'public.support_reply(uuid,text,text,uuid)'::regprocedure
     and position('private.assert_fresh_mfa()' in p.prosrc) between 1 and position('insert into public.support_ticket_messages' in p.prosrc);
  perform pg_temp.counted('the reply RPC enforces fresh MFA before writing student-visible content', n, 1);

  perform pg_temp.become(ada);
  perform public.reply_to_my_ticket(a11y, 'Switch Control on iPad.');
  select count(*) into n from public.my_support_thread(a11y);
  reset role;
  perform pg_temp.counted('the student sees the whole thread, both sides', n, 6);
  select count(*) into n from public.support_tickets where id = a11y and status = 'open';
  perform pg_temp.counted('a student reply reopens it for support', n, 1);

  perform pg_temp.become(ada);
  perform public.close_my_ticket(howto);
  reset role;
  perform pg_temp.must_refuse('a closed ticket takes no more replies', ada, format('select public.reply_to_my_ticket(%L, %L)', howto, 'wait'));
  perform pg_temp.become(agent);
  select count(*) into n from public.support_ticket_queue();
  reset role;
  perform pg_temp.counted('a closed ticket leaves the queue', n, 1);

  -- ── Deleting an account takes its tickets ─────────────────────────────

  perform pg_temp.become(ada);
  perform public.forget_my_support_tickets();
  reset role;
  select count(*) into n from public.support_tickets where student_id = ada;
  perform pg_temp.counted('forget_my_support_tickets removes the tickets', n, 0);
  select count(*) into n from public.support_ticket_messages;
  perform pg_temp.counted('and their messages', n, 0);

  -- The daily limit is a count followed by an insert. Two sessions cannot
  -- run in one check, so this asks the structural question instead: does the
  -- function take its per-account lock before it counts? Unlocked, concurrent
  -- calls each count the same rows and all of them insert.
  select count(*) into n from pg_catalog.pg_proc p
   where p.oid = 'public.open_support_ticket(text, text, text, jsonb, boolean)'::regprocedure
     and position('pg_advisory_xact_lock' in p.prosrc) between 1 and position('count(*)' in p.prosrc);
  perform pg_temp.counted('the daily limit is counted under a per-account lock', n, 1);
  select count(*) into n from pg_catalog.pg_proc p
   where p.oid = to_regprocedure('public.open_support_ticket(text, text, text, jsonb)');
  perform pg_temp.counted('the legacy ticket-opening overload is removed', n, 0);

  raise notice 'support tickets: every check passed';
end $$;

rollback;
