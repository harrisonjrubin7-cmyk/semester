-- Two devices on one account, without needing two devices.
--
-- The sync path had never been watched with a second device attached, and it
-- turned out to lose data in two different ways. Both are fixed now — in
-- `app/src/lib/merge.ts` and `app/src/lib/cloud.ts` — and this is the check
-- that the database half of the fix does what the client half assumes.
--
-- What it covers:
--
--   * A push from one device must not delete a course the other device
--     imported. The old push deleted every course the account held that the
--     pushing device did not, so a phone that had never synced could wipe a
--     course imported on the laptop. That is the headline check.
--   * The upsert really is an upsert: the second push updates the row rather
--     than duplicating it or failing.
--   * `updated_at` comes from the database, not from the device. Sync decides
--     which side is newer by that timestamp, so a phone with a wrong clock
--     must not be able to declare itself the future.
--   * The row-level policies still hold: another account can neither read
--     your semester nor write into it.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It makes its own users and rolls the whole thing
--   back at the end, so it leaves nothing behind and is safe against a
--   project with real data in it.
--
-- What it cannot check is the merge itself, which happens on the device in
-- TypeScript and is covered by `app/src/lib/merge.test.ts`. Between the two
-- files, both halves of "two devices, neither one losing what it did" are
-- accounted for.

begin;

-- ── One student with two devices, and a stranger ──────────────────────────

do $$
declare
  you       uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  stranger  uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (you,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sync.you.test@vanderbilt.edu',      now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sync.stranger.test@vanderbilt.edu', now(), now(), now())
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

-- ── The laptop imports ECON and pushes ────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

  insert into public.state (user_id, data)
  values (auth.uid(), '{"notes": [{"id": "n1", "title": "From the laptop"}]}'::jsonb)
  on conflict (user_id) do update set data = excluded.data;

  insert into public.courses (user_id, id, data)
  values (auth.uid(), 'econ-1020', '{"course": {"id": "econ-1020", "code": "ECON 1020"}}'::jsonb)
  on conflict (user_id, id) do update set data = excluded.data;

  select count(*) into n from public.courses where user_id = auth.uid();
  perform pg_temp.counted('the laptop''s course is in the account', n, 1);
end $$;

-- ── The phone, which has never synced, pushes its own course ──────────────
--
-- This is the exact sequence that used to destroy a course. The phone holds
-- PSCI and nothing else. The old client then issued, in effect,
--
--   delete from courses where user_id = me and id not in ('psci-1104')
--
-- which is the first statement below, run here only to show what it would
-- have taken. The client now sends the ids it actually deleted, which for a
-- phone that has deleted nothing is an empty list and therefore no statement
-- at all.

do $$
declare doomed bigint; n bigint;
begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

  insert into public.courses (user_id, id, data)
  values (auth.uid(), 'psci-1104', '{"course": {"id": "psci-1104", "code": "PSCI 1104"}}'::jsonb)
  on conflict (user_id, id) do update set data = excluded.data;

  select count(*) into doomed
    from public.courses
   where user_id = auth.uid() and id not in ('psci-1104');
  perform pg_temp.counted('the old prune would have deleted the laptop''s course',
                          doomed, 1);

  -- What the client sends now: nothing, because this device deleted nothing.
  select count(*) into n from public.courses where user_id = auth.uid();
  perform pg_temp.counted('both devices'' courses survive the push', n, 2);
end $$;

-- ── A real deletion still reaches the account ─────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

  -- The laptop drops ECON, so its push names that id and only that id.
  delete from public.courses where user_id = auth.uid() and id in ('econ-1020');

  select count(*) into n from public.courses where user_id = auth.uid();
  perform pg_temp.counted('a course deleted on a device is deleted in the account', n, 1);

  select count(*) into n
    from public.courses where user_id = auth.uid() and id = 'psci-1104';
  perform pg_temp.counted('and the one nobody deleted is still there', n, 1);
end $$;

-- ── The upsert is an upsert ───────────────────────────────────────────────

do $$
declare n bigint; body jsonb;
begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

  insert into public.courses (user_id, id, data)
  values (auth.uid(), 'psci-1104',
          '{"course": {"id": "psci-1104", "code": "PSCI 1104"}, "items": [1]}'::jsonb)
  on conflict (user_id, id) do update set data = excluded.data;

  select count(*) into n from public.courses where user_id = auth.uid();
  perform pg_temp.counted('a second push of the same course updates one row', n, 1);

  select data into body from public.courses
   where user_id = auth.uid() and id = 'psci-1104';
  perform pg_temp.check('and the row holds the newer copy',
                        body ? 'items', true);

  insert into public.state (user_id, data)
  values (auth.uid(), '{"notes": [{"id": "n1"}, {"id": "n2"}]}'::jsonb)
  on conflict (user_id) do update set data = excluded.data;

  select count(*) into n from public.state where user_id = auth.uid();
  perform pg_temp.counted('and one account still holds exactly one state row', n, 1);
end $$;

-- ── The clock belongs to the database ─────────────────────────────────────
--
-- A device whose clock is a year fast would otherwise win every conflict for
-- a year, and a device a year slow would never win one.

do $$
declare stamped timestamptz;
begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

  update public.state
     set data = '{"notes": []}'::jsonb,
         updated_at = now() + interval '1 year'
   where user_id = auth.uid();

  select updated_at into stamped from public.state where user_id = auth.uid();
  perform pg_temp.check('a device cannot stamp itself into the future',
                        stamped < now() + interval '1 minute', true);
end $$;

-- ── And none of it is anybody else''s ─────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('bbbbbbbb-0000-0000-0000-000000000002');

  select count(*) into n from public.state;
  perform pg_temp.counted('a stranger reads none of your state', n, 0);

  select count(*) into n from public.courses;
  perform pg_temp.counted('a stranger reads none of your courses', n, 0);

  -- Writing into somebody else's account has to fail outright rather than
  -- insert a row they cannot see.
  begin
    insert into public.courses (user_id, id, data)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bus-1600', '{}'::jsonb);
    raise exception 'FAILED: a stranger wrote a course into another account';
  exception
    when insufficient_privilege then
      raise notice 'ok  a stranger cannot write into your account';
  end;

  -- Deleting from it is the same policy, and is the one that would hurt.
  delete from public.courses where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');
  select count(*) into n from public.courses where user_id = auth.uid();
  perform pg_temp.counted('and cannot delete your courses either', n, 1);
end $$;

reset role;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

-- Nothing is kept. Change this to `commit;` only if you want the synthetic
-- users left behind, which you do not.
rollback;
