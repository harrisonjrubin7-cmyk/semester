-- Reactions, with the second person a reaction needs.
--
-- `…0400_rooms.sql` adds three policies to `message_reactions` and no suite
-- has ever run one of them. They are the same shape as everything else here:
-- each is only ever wrong when somebody else is involved — can a stranger to
-- the class see who laughed, can one person take back another's tap, does a
-- block reach the ornaments as well as the words.
--
-- Five people, one message, and the whole thing rolled back. Run it against an
-- empty database for the reason every file in here gives: it counts rows in
-- `2026FA vanderbilt/BUS 1600`, and a real enrolment there makes the counts
-- wrong without saying anything about the policies. `supabase/check.sh` builds
-- that database; see supabase/README.md.
--
-- Two things in that migration this cannot reach, and both want a second real
-- device rather than a second synthetic account:
--
--   * Presence. Its policies are on `realtime.messages`, which belongs to the
--     Realtime server and does not exist in a bare Postgres at all.
--   * Delivery. Realtime honours the select policy below, so what a subscriber
--     is *allowed* is settled here — but whether the websocket carries it is
--     not a question Postgres can answer.

begin;

-- ── Five people ───────────────────────────────────────────────────────────
-- Ana and Ben share BUS 1600; Ben also takes ECON 1020, which is what lets one
-- check below separate "not in that class" from "that message is not in that
-- room". Cara takes ECON 1020 only. Eve has never confirmed her address.

do $$
declare
  ana  uuid := '11111111-1111-1111-1111-111111111111';
  ben  uuid := '22222222-2222-2222-2222-222222222222';
  cara uuid := '33333333-3333-3333-3333-333333333333';
  eve  uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (ana,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'r.ana.test@vanderbilt.edu',  now(), now(), now()),
    (ben,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'r.ben.test@vanderbilt.edu',  now(), now(), now()),
    (cara, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'r.cara.test@vanderbilt.edu', now(), now(), now()),
    (eve,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'r.eve.test@vanderbilt.edu',  null,  now(), now())
  on conflict (id) do nothing;
end $$;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

-- ── The room ──────────────────────────────────────────────────────────────
-- The codes carry the school, because that is what a room is keyed by — see
-- `…0300_classmates_schools.sql`. A bare `BUS 1600` here would pass the
-- constraint and match nothing, which is the bug this key was introduced with.

do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ana')
    on conflict (user_id) do update set handle = 'ana';
  insert into public.enrollments (user_id, term, code)
    values (auth.uid(), '2026FA', 'vanderbilt/BUS 1600') on conflict do nothing;

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'ben')
    on conflict (user_id) do update set handle = 'ben';
  insert into public.enrollments (user_id, term, code)
    values (auth.uid(), '2026FA', 'vanderbilt/BUS 1600'),
           (auth.uid(), '2026FA', 'vanderbilt/ECON 1020') on conflict do nothing;

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  insert into public.profiles (user_id, handle) values (auth.uid(), 'cara')
    on conflict (user_id) do update set handle = 'cara';
  insert into public.enrollments (user_id, term, code)
    values (auth.uid(), '2026FA', 'vanderbilt/ECON 1020') on conflict do nothing;
end $$;

-- Eve is enrolled from outside the policies on purpose. She cannot join a
-- class herself — `verified_student()` refuses her, and classmates.check.sql
-- asserts exactly that. Putting her in the room anyway is what makes her
-- refusal below say something: with no enrolment, `in_class` would refuse her
-- first and the verified gate would never be reached.
reset role;
insert into public.enrollments (user_id, term, code)
  values ('55555555-5555-5555-5555-555555555555', '2026FA', 'vanderbilt/BUS 1600')
  on conflict do nothing;

-- ── The reaction is its own key ───────────────────────────────────────────
-- Not decoration, and not a restatement of the migration. A delete arrives at
-- the client carrying only the replica identity, and `listenReactions` in
-- `lib/classmates.ts` takes the message, the person and the emoji straight off
-- it to take the face off the screen. Widen this key, or set a replica
-- identity that is narrower than it, and reactions stop disappearing for
-- everybody except the person who took one back — on a screen, with no error.

do $$
declare k text;
begin
  select string_agg(a.attname, ',' order by a.attnum) into k
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = 'public.message_reactions'::regclass and i.indisprimary;
  if k is distinct from 'message_id,user_id,emoji' then
    raise exception 'FAILED: the reaction key is (%), and the client removes one by message, person and emoji', k;
  end if;
  raise notice 'ok  a delete carries the whole reaction: message, person, emoji';

  if (select relreplident from pg_class where oid = 'public.message_reactions'::regclass) not in ('d', 'f') then
    raise exception 'FAILED: replica identity is narrower than the primary key';
  end if;
  raise notice 'ok  the replica identity carries that key';
end $$;

-- ── Leaving one ───────────────────────────────────────────────────────────

do $$
declare m uuid; n bigint;
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.messages (user_id, term, code, body)
  values (auth.uid(), '2026FA', 'vanderbilt/BUS 1600', 'Ana: anyone started the case?')
  returning id into m;

  -- Ben, in the class, on a message that is in it.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
  values (m, auth.uid(), '👍', '2026FA', 'vanderbilt/BUS 1600');

  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('a classmate sees the face you left', n, 1);

  -- Tapping the same face twice. The client upserts on this key rather than
  -- counting taps, so the second one has to land on the same row.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
  values (m, auth.uid(), '👍', '2026FA', 'vanderbilt/BUS 1600')
  on conflict (message_id, user_id, emoji) do nothing;
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('the same face twice is one reaction, not two', n, 1);

  -- A different face from the same person is a second reaction.
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
  values (m, auth.uid(), '🎯', '2026FA', 'vanderbilt/BUS 1600');
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('a different face is a second reaction', n, 2);
  delete from public.message_reactions where message_id = m and emoji = '🎯';

  -- Under somebody else's name.
  begin
    insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values (m, '11111111-1111-1111-1111-111111111111', '😂', '2026FA', 'vanderbilt/BUS 1600');
    raise exception 'FAILED: somebody reacted as another person';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  you cannot react as somebody else';
  end;

  -- From outside the class. Cara can see neither the message nor the room.
  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  begin
    insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values (m, auth.uid(), '😂', '2026FA', 'vanderbilt/BUS 1600');
    raise exception 'FAILED: somebody reacted in a class they are not in';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  you cannot react in a class you are not in';
  end;

  -- The clause the migration singles out, on its own. Ben is in ECON 1020, so
  -- `in_class` passes and only the message check can refuse this: a row that
  -- files a BUS 1600 message under a room it was never posted in would
  -- otherwise be readable by everyone in that other class.
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values (m, auth.uid(), '😂', '2026FA', 'vanderbilt/ECON 1020');
    raise exception 'FAILED: a reaction claimed a room its message is not in';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  a reaction cannot claim a room its message is not in';
  end;

  -- Eve is in the room and still is not a student.
  perform pg_temp.become('55555555-5555-5555-5555-555555555555');
  begin
    insert into public.message_reactions (message_id, user_id, emoji, term, code)
    values (m, auth.uid(), '😂', '2026FA', 'vanderbilt/BUS 1600');
    raise exception 'FAILED: an unconfirmed address was allowed to react';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok  an unconfirmed address cannot react';
  end;

  -- ── Reading one ─────────────────────────────────────────────────────────

  perform pg_temp.become('33333333-3333-3333-3333-333333333333');
  select count(*) into n from public.message_reactions;
  perform pg_temp.counted('somebody in another class sees none of them', n, 0);

  -- A block reaches the ornaments too. A name in a "who reacted" list is
  -- still a message from the person you blocked.
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  insert into public.blocks (user_id, blocked)
  values (auth.uid(), '22222222-2222-2222-2222-222222222222') on conflict do nothing;
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('somebody you blocked cannot reach you with a face', n, 0);

  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('being blocked is not being told: he still sees his own', n, 1);

  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  delete from public.blocks where user_id = auth.uid();
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('unblocking brings it back', n, 1);

  -- ── Taking one back ─────────────────────────────────────────────────────

  -- Ana cannot take Ben's back. The delete policy is on the row, so this
  -- removes nothing rather than raising — which is why it is counted after.
  delete from public.message_reactions where message_id = m;
  perform pg_temp.become('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('your reaction survives somebody else deleting it', n, 1);

  -- His own, he may.
  delete from public.message_reactions
   where message_id = m and user_id = auth.uid() and emoji = '👍';
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('you can take your own back', n, 0);

  -- ── And when the message goes ───────────────────────────────────────────
  -- The room redraws from `recent` and `reactionsIn` on the next open, and a
  -- reaction whose message is gone would be a face against nothing.
  insert into public.message_reactions (message_id, user_id, emoji, term, code)
  values (m, auth.uid(), '👍', '2026FA', 'vanderbilt/BUS 1600');
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  delete from public.messages where id = m;
  reset role;
  select count(*) into n from public.message_reactions where message_id = m;
  perform pg_temp.counted('deleting the message takes its reactions with it', n, 0);
end $$;

rollback;
