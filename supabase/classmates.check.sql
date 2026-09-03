-- Two people in one room, without needing two people.
--
-- Everything in classmates.sql that matters is a row-level security policy,
-- and a policy can only be wrong in a way you notice when a *second* account
-- is involved: can a stranger read your room, can somebody you blocked still
-- reach you, can a person outside a class post into it. Those questions have
-- never been answered, because answering them meant finding a second human
-- with a Vanderbilt address and a spare afternoon.
--
-- They do not. Postgres will impersonate anybody you like. This script makes
-- four synthetic users, walks them through the things a real pair would do,
-- and asserts what each of them is allowed to see. Every check raises on
-- failure, so a clean run is the whole result.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It creates its own users and rolls the entire
--   thing back at the end, so it leaves nothing behind and is safe against a
--   project with real data in it.
--
-- The one thing it cannot check is the realtime subscription, which is a
-- websocket rather than a policy. Realtime honours the same select policy, so
-- if reading is right here it is right there too — but the delivery itself
-- still wants one real second device before you trust it.

begin;

-- ── Four people ───────────────────────────────────────────────────────────
-- Ana and Ben share a class. Cara is at the university but takes something
-- else. Dan is not at the university at all.

do $$
declare
  ana   uuid := '11111111-1111-1111-1111-111111111111';
  ben   uuid := '22222222-2222-2222-2222-222222222222';
  cara  uuid := '33333333-3333-3333-3333-333333333333';
  dan   uuid := '44444444-4444-4444-4444-444444444444';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (ana,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ana.test@vanderbilt.edu',  now(), now(), now()),
    (ben,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ben.test@vanderbilt.edu',  now(), now(), now()),
    (cara, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cara.test@vanderbilt.edu', now(), now(), now()),
    -- Confirmed, but not a Vanderbilt address: the gate is the domain, not
    -- merely having clicked a link.
    (dan,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dan.test@example.com',     now(), now(), now())
  on conflict (id) do nothing;
end $$;

-- Impersonation. Supabase resolves auth.uid() from this claim, so setting it
-- is exactly what the API does when a request arrives with a token.
create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.check(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

-- ── Who counts as a student ───────────────────────────────────────────────

do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  perform pg_temp.check('a confirmed vanderbilt.edu address is a student',
                        public.verified_student(), true);

  perform pg_temp.become('44444444-4444-4444-4444-444444444444');
  perform pg_temp.check('a confirmed address at another domain is not',
                        public.verified_student(), false);
end $$;

-- ── Enrolling ─────────────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ana')
    on conflict (user_id) do update set handle = 'ana';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'PSCI 1104')
    on conflict do nothing;

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ben')
    on conflict (user_id) do update set handle = 'ben';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'PSCI 1104')
    on conflict do nothing;

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'cara')
    on conflict (user_id) do update set handle = 'cara';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'ECON 1020')
    on conflict do nothing;
end $$;

do $$
declare n bigint;
begin
  -- Dan is not a student, so joining must fail outright rather than quietly
  -- inserting a row nobody can see.
  perform pg_temp.become('44444444-4444-4444-4444-444444444444');
  begin
    insert into public.enrollments (user_id, term, code)
    values (auth.uid(), '2026FA', 'PSCI 1104');
    raise exception 'FAILED: an outsider was allowed to join a class';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  an outsider cannot join a class';
  end;

  -- Ana may not enrol Ben. The policy is on the row, not on the request.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  begin
    insert into public.enrollments (user_id, term, code)
    values ('22222222-2222-2222-2222-222222222222', '2026FA', 'BUS 1600');
    raise exception 'FAILED: one student enrolled another';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  a student cannot enrol somebody else';
  end;

  -- Who is in the room.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('a member sees both people in their room', n, 2);

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('somebody in another class sees nobody in this one', n, 0);

  -- Profiles follow enrollment: a classmate's handle is readable, a
  -- stranger's is not.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.profiles
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.counted('a classmate’s handle is readable', n, 1);

  select count(*) into n from public.profiles
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.counted('a stranger’s handle is not', n, 0);
end $$;

-- ── Messages ──────────────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.messages (user_id, term, code, body)
  values (auth.uid(), '2026FA', 'PSCI 1104', 'Ana: does anyone have Tuesday''s reading?');

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.messages (user_id, term, code, body)
  values (auth.uid(), '2026FA', 'PSCI 1104', 'Ben: posted on Brightspace this morning');

  -- The check the whole feature rests on: Ben's words reach Ana.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('two people in a room see both messages', n, 2);

  -- And do not reach anybody else.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('somebody in another class sees none of them', n, 0);

  -- Posting into a class you are not in.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  begin
    insert into public.messages (user_id, term, code, body)
    values (auth.uid(), '2026FA', 'PSCI 1104', 'Cara: hello from outside');
    raise exception 'FAILED: somebody posted into a class they are not in';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  you cannot post into a class you are not in';
  end;

  -- Posting under somebody else's name.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.messages (user_id, term, code, body)
    values ('11111111-1111-1111-1111-111111111111', '2026FA', 'PSCI 1104', 'not really Ana');
    raise exception 'FAILED: somebody posted as another person';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  you cannot post as somebody else';
  end;

  -- Deleting somebody else's message.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  delete from public.messages
   where user_id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.messages
   where user_id = auth.uid();
  perform pg_temp.counted('your message survives somebody else deleting it', n, 1);

  -- Deleting your own.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  delete from public.messages where user_id = auth.uid();
  select count(*) into n from public.messages where user_id = auth.uid();
  perform pg_temp.counted('you can delete your own', n, 0);

  -- Put it back for the blocking checks.
  insert into public.messages (user_id, term, code, body)
  values (auth.uid(), '2026FA', 'PSCI 1104', 'Ana: back again');
end $$;

-- ── Blocking ──────────────────────────────────────────────────────────────
-- Enforced in the select policy rather than in the client, so a blocked
-- person's words never reach the device at all. This is the check that
-- distinguishes those two implementations.

do $$
declare n bigint;
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('before blocking, Ana sees both', n, 2);

  insert into public.blocks (user_id, blocked)
  values (auth.uid(), '22222222-2222-2222-2222-222222222222')
  on conflict do nothing;

  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('after blocking, Ben’s message is gone from the wire', n, 1);

  -- Blocking is one-directional and private to the blocker.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('Ben still sees the room, and is not told', n, 2);

  select count(*) into n from public.blocks;
  perform pg_temp.counted('Ben cannot read who has blocked him', n, 0);

  -- Unblocking restores it.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  delete from public.blocks where user_id = auth.uid();
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('unblocking brings the messages back', n, 2);
end $$;

-- ── Reports ───────────────────────────────────────────────────────────────
-- Write-only on purpose: anybody verified may file one, and nobody at all can
-- read them back, including the person who filed it.

do $$
declare n bigint;
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.reports (reporter, about, reason, copy)
  values (auth.uid(), '22222222-2222-2222-2222-222222222222', 'test report',
          'Ben: posted on Brightspace this morning');

  select count(*) into n from public.reports;
  perform pg_temp.counted('a report cannot be read back, even by its author', n, 0);
end $$;

-- ── Leaving ───────────────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  delete from public.enrollments where user_id = auth.uid() and code = 'PSCI 1104';

  select count(*) into n from public.messages
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('leaving a class closes the room behind you', n, 0);

  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'PSCI 1104';
  perform pg_temp.counted('and the people still in it see one fewer', n, 1);
end $$;

reset role;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

-- Nothing is kept. Change this to `commit;` only if you want the synthetic
-- users left behind, which you do not.
rollback;
