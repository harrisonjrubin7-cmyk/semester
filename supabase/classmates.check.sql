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
-- five synthetic users, walks them through the things a real pair would do,
-- and asserts what each of them is allowed to see. Every check raises on
-- failure, so a clean run is the whole result.
--
--   How to run it: open the SQL Editor, paste this file's CONTENTS — not its
--   path — and run. It creates its own users and rolls the entire thing back
--   at the end, so it leaves nothing behind.
--
--   Run it against an empty database, not against production. It is *safe*
--   anywhere — the rollback sees to that — but it is only *correct* where the
--   rooms it uses are otherwise empty: it counts who is in `2026FA
--   vanderbilt/PSCI 1104`, and one real person enrolled there turns "a member
--   sees both people in their room" into three. That is not a hypothetical.
--   The live project has exactly that enrolment, so this suite fails there for
--   a reason that says nothing about the policies. A preview branch, or a
--   local Postgres built from `migrations/`, is the place for it.
--
-- The one thing it cannot check is the realtime subscription, which is a
-- websocket rather than a policy. Realtime honours the same select policy, so
-- if reading is right here it is right there too — but the delivery itself
-- still wants one real second device before you trust it.

begin;

-- ── Four people ───────────────────────────────────────────────────────────
-- Ana and Ben share a class. Cara is at the university but takes something
-- else. Dan is not at the university at all, and Eve has not confirmed her
-- address — which is now the only one of those four facts the server acts on.

do $$
declare
  ana   uuid := '11111111-1111-1111-1111-111111111111';
  ben   uuid := '22222222-2222-2222-2222-222222222222';
  cara  uuid := '33333333-3333-3333-3333-333333333333';
  dan   uuid := '44444444-4444-4444-4444-444444444444';
  eve   uuid := '55555555-5555-5555-5555-555555555555';
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
    -- Confirmed, at a domain the university does not own. He is the case that
    -- says what the server gate actually is, and it is not the domain.
    (dan,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dan.test@example.com',     now(), now(), now()),
    -- Eve has never clicked the link. She is the gate that is actually left:
    -- since the domain check went, `email_confirmed_at` is the whole of what
    -- `verified_student()` asks, and nothing here tested it until now.
    (eve,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'eve.test@vanderbilt.edu',  null,  now(), now())
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

--
-- Dan's line below asserts a *weakening*, deliberately, and it is worth saying
-- so where somebody reading a red build will look.
--
-- This file used to assert that a confirmed address at another domain was not
-- a student, because `verified_student()` required `@vanderbilt.edu`.
-- `…0300_classmates_schools` removed that on purpose: a per-school domain
-- check inside a row-level-security policy refuses the feature outright to
-- every student at every other university, and the ground rules for school
-- support say never to gate on an email domain. The server now checks that
-- the address is confirmed and stops.
--
-- What that costs is written down in the migration and is not restated
-- cheerfully here: a room used to be people who hold a vanderbilt.edu mailbox
-- and now is people who say they are in the class. The domain check still
-- happens in `eligible()` on the client, which is a courtesy and not a
-- defence — this file has always said the policies are the security.
--
-- So the assertion is inverted rather than deleted. Deleting it would leave
-- nothing to notice if somebody restored the domain gate, and the case is
-- worth pinning in its new direction. It is not a licence to weaken the gate
-- further: restoring server-side strength needs a `schools` table and a
-- `school_id` on `profiles`, so a policy can compare an address against that
-- school's own domains. When that lands, this expectation changes back — per
-- school rather than per Vanderbilt — and that is the change to make, not a
-- quiet loosening somewhere else.
do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  perform pg_temp.check('a confirmed vanderbilt.edu address is a student',
                        private.verified_student(), true);

  perform pg_temp.become('44444444-4444-4444-4444-444444444444');
  perform pg_temp.check('a confirmed address at any other domain is one too — '
                        'the server asks whether the mailbox is confirmed, not whose it is',
                        private.verified_student(), true);
end $$;

-- ── Enrolling ─────────────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ana')
    on conflict (user_id) do update set handle = 'ana';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104')
    on conflict do nothing;

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ben')
    on conflict (user_id) do update set handle = 'ben';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104')
    on conflict do nothing;

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'cara')
    on conflict (user_id) do update set handle = 'cara';
  insert into public.enrollments (user_id, term, code) values (auth.uid(), '2026FA', 'vanderbilt/ECON 1020')
    on conflict do nothing;
end $$;

do $$
declare n bigint;
begin
  -- Dan can join, and that is the cost of the change written out as a row.
  --
  -- He used to be refused here because his address is not `@vanderbilt.edu`.
  -- `…0300_classmates_schools` gave that up deliberately — see the note above
  -- his fixture — so the honest assertion is that he gets in. Into his own
  -- school's room, not Ana's: the room key carries the school, so a confirmed
  -- stranger joining `rice-university/HIST 1010` tells us the gate opened
  -- without disturbing what anybody sees in `vanderbilt/PSCI 1104`.
  perform pg_temp.become('44444444-4444-4444-4444-444444444444');
  insert into public.enrollments (user_id, term, code)
  values (auth.uid(), '2026FA', 'rice-university/HIST 1010');
  select count(*) into n from public.enrollments
   where user_id = auth.uid() and code = 'rice-university/HIST 1010';
  perform pg_temp.counted('a confirmed address at any domain can join a class', n, 1);

  -- Eve cannot, and this is the gate that is left. If this line ever passes
  -- for the wrong reason the feature is open to anybody who can type an
  -- address, confirmed or not.
  perform pg_temp.become('55555555-5555-5555-5555-555555555555');
  begin
    insert into public.enrollments (user_id, term, code)
    values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104');
    raise exception 'FAILED: an unconfirmed address was allowed to join a class';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  an unconfirmed address cannot join a class';
  end;

  -- Ana may not enrol Ben. The policy is on the row, not on the request.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  begin
    insert into public.enrollments (user_id, term, code)
    values ('22222222-2222-2222-2222-222222222222', '2026FA', 'vanderbilt/BUS 1600');
    raise exception 'FAILED: one student enrolled another';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  a student cannot enrol somebody else';
  end;

  -- Who is in the room.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('a member sees both people in their room', n, 2);

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
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
  values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104', 'Ana: does anyone have Tuesday''s reading?');

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.messages (user_id, term, code, body)
  values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104', 'Ben: posted on Brightspace this morning');

  -- The check the whole feature rests on: Ben's words reach Ana.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('two people in a room see both messages', n, 2);

  -- And do not reach anybody else.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('somebody in another class sees none of them', n, 0);

  -- Posting into a class you are not in.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  begin
    insert into public.messages (user_id, term, code, body)
    values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104', 'Cara: hello from outside');
    raise exception 'FAILED: somebody posted into a class they are not in';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  you cannot post into a class you are not in';
  end;

  -- Posting under somebody else's name.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.messages (user_id, term, code, body)
    values ('11111111-1111-1111-1111-111111111111', '2026FA', 'vanderbilt/PSCI 1104', 'not really Ana');
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
  values (auth.uid(), '2026FA', 'vanderbilt/PSCI 1104', 'Ana: back again');
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
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('before blocking, Ana sees both', n, 2);

  insert into public.blocks (user_id, blocked)
  values (auth.uid(), '22222222-2222-2222-2222-222222222222')
  on conflict do nothing;

  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('after blocking, Ben’s message is gone from the wire', n, 1);

  -- Blocking is one-directional and private to the blocker.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('Ben still sees the room, and is not told', n, 2);

  select count(*) into n from public.blocks;
  perform pg_temp.counted('Ben cannot read who has blocked him', n, 0);

  -- Unblocking restores it.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  delete from public.blocks where user_id = auth.uid();
  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
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
  delete from public.enrollments where user_id = auth.uid() and code = 'vanderbilt/PSCI 1104';

  select count(*) into n from public.messages
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('leaving a class closes the room behind you', n, 0);

  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.enrollments
   where term = '2026FA' and code = 'vanderbilt/PSCI 1104';
  perform pg_temp.counted('and the people still in it see one fewer', n, 1);
end $$;

reset role;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

-- Nothing is kept. Change this to `commit;` only if you want the synthetic
-- users left behind, which you do not.
rollback;
