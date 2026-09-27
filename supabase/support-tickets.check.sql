-- Support tickets (20260928030000_support_tickets.sql).
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
begin
  ada := pg_temp.newuser('ada@tickets.example');
  ben := pg_temp.newuser('ben@tickets.example');
  agent := pg_temp.newuser('agent@semester.example');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (agent, 'support_agent', 'platform', '', 'platform');

  -- ── Opening a ticket ──────────────────────────────────────────────────

  perform pg_temp.become(ada);
  a11y := public.open_support_ticket('accessibility', 'Drill buttons', 'I cannot reach the buttons with a switch.',
    '{"app_version": "2026.9.27", "device_class": "tablet", "screen": "#/drill"}'::jsonb);
  howto := public.open_support_ticket('how_to', 'Export', 'How do I export my calendar?', '{}'::jsonb);
  reset role;

  select priority, extract(epoch from (first_response_due - created_at)) / 3600 into pri, due_hours
    from public.support_tickets where id = a11y;
  if pri <> 'high' or due_hours <> 24 then raise exception 'FAILED: accessibility is high priority with a 24-hour target (got %, %)', pri, due_hours; end if;
  raise notice 'ok  accessibility is high priority with a 24-hour first-response target';
  select extract(epoch from (first_response_due - created_at)) / 3600 into due_hours from public.support_tickets where id = howto;
  perform pg_temp.counted('a how-to question has a 72-hour target', due_hours::bigint, 72);

  perform pg_temp.must_refuse('context may not carry a key outside the six', ada,
    $q$select public.open_support_ticket('bug', 's', 'b', '{"gpa": "3.1"}'::jsonb)$q$);
  perform pg_temp.must_refuse('nor a value that is not text', ada,
    $q$select public.open_support_ticket('bug', 's', 'b', '{"offline": true}'::jsonb)$q$);
  perform pg_temp.become(ben);
  for i in 1..5 loop
    perform public.open_support_ticket('bug', 'flood ' || i, 'b', '{}'::jsonb);
  end loop;
  reset role;
  perform pg_temp.must_refuse('a sixth ticket in a day is refused', ben,
    $q$select public.open_support_ticket('bug', 'sixth', 'b', '{}'::jsonb)$q$);
  delete from public.support_tickets where student_id = ben;
  perform pg_temp.must_refuse('a signed-out visitor cannot open a ticket', null,
    $q$select public.open_support_ticket('bug', 's', 'b', '{}'::jsonb)$q$);

  -- ── Each student sees only their own ──────────────────────────────────

  perform pg_temp.become(ben);
  select count(*) into n from public.my_support_tickets();
  reset role;
  perform pg_temp.counted('another student sees none of Ada''s tickets', n, 0);
  perform pg_temp.become(ben);
  select count(*) into n from public.my_support_thread(a11y);
  reset role;
  perform pg_temp.counted('nor her thread, by its id', n, 0);
  perform pg_temp.must_refuse('nor reply to it', ben, format('select public.reply_to_my_ticket(%L, %L)', a11y, 'hi'));
  perform pg_temp.must_refuse('nor close it', ben, format('select public.close_my_ticket(%L)', a11y));
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

  perform pg_temp.become(agent);
  perform public.support_reply(a11y, 'Thanks. Which switch software do you use?', 'waiting_on_student');
  reset role;
  select count(*) into n from public.support_tickets where id = a11y and first_responded_at is not null and status = 'waiting_on_student';
  perform pg_temp.counted('a reply stamps the first response and sets the status', n, 1);
  perform pg_temp.must_refuse('support cannot close a ticket for the student', agent,
    format('select public.support_reply(%L, %L, %L)', a11y, 'closing', 'closed'));

  perform pg_temp.become(ada);
  perform public.reply_to_my_ticket(a11y, 'Switch Control on iPad.');
  select count(*) into n from public.my_support_thread(a11y);
  reset role;
  perform pg_temp.counted('the student sees the whole thread, both sides', n, 3);
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

  raise notice 'support tickets: every check passed';
end $$;

rollback;
