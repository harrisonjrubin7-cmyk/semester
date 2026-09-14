-- Does `records.sql` do what it says?
--
-- Run this AFTER `records.sql`, and before letting any client depend on it.
-- Open the Supabase SQL Editor, paste this file's CONTENTS — not its path —
-- and run. It makes its own users and rolls the whole thing back at the end,
-- so it leaves nothing behind and is safe against a project with real data.
--
-- What it covers:
--
--   * A deletion is a fact the other device can read. This is the entire
--     point: a soft-deleted row is still there, marked, so a second device
--     learns the note is gone rather than helpfully putting it back. See
--     `app/src/lib/resurrect.test.ts` for the client-side half of the bug.
--   * `updated_at` comes from the database on every write, and a client
--     cannot set it. Last-write-wins is only trustworthy if the clock is not
--     the device's — a phone set five minutes fast must not be able to
--     declare itself the future.
--   * A pull for "everything since" really does exclude what has not changed,
--     which is what makes this cheaper than the blob rather than only more
--     correct.
--   * Row-level security holds on all four new tables: a stranger can neither
--     read your notes nor write into them. Checked per table rather than once,
--     because a policy loop that silently skipped one is exactly the mistake
--     that would not show up until it mattered.
--   * The tombstone sweep removes old deletions and leaves live rows and
--     recent deletions alone.

begin;

-- ── One student with two devices, and a stranger ──────────────────────────

do $$
declare
  you       uuid := 'cccccccc-0000-0000-0000-000000000001';
  stranger  uuid := 'dddddddd-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (you,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'records.you.test@example.invalid',      now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'records.stranger.test@example.invalid', now(), now(), now())
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
    raise exception 'FAILED: % (got %, wanted %)', what, got, want;
  end if;
  raise notice 'ok: %', what;
end $$;

create or replace function pg_temp.checkn(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % (got %, wanted %)', what, got, want;
  end if;
  raise notice 'ok: % (%)', what, got;
end $$;


-- ── The phone writes three notes, then deletes one ────────────────────────

do $$
declare
  you uuid := 'cccccccc-0000-0000-0000-000000000001';
  n   bigint;
  live_updated timestamptz;
  after_touch  timestamptz;
begin
  perform pg_temp.become(you);

  insert into public.notes (user_id, id, data) values
    (you, 'n1', '{"title":"Kept"}'),
    (you, 'n2', '{"title":"Also kept"}'),
    (you, 'n3', '{"title":"Deleted on the phone"}');

  -- The deletion, as the app will do it: a mark, not a removal.
  update public.notes set deleted_at = now() where user_id = you and id = 'n3';

  -- The laptop pulls everything. It must SEE the deleted row, because that is
  -- how it learns to drop its own copy. A hard delete is indistinguishable
  -- from a row that never existed, which is the ambiguity that makes
  -- deletions resurrect.
  select count(*) into n from public.notes where user_id = you;
  perform pg_temp.checkn('a deleted note is still readable, so the other device learns of it', n, 3::bigint);

  select count(*) into n from public.notes where user_id = you and deleted_at is null;
  perform pg_temp.checkn('two of them are live', n, 2::bigint);

  select count(*) into n from public.notes where user_id = you and deleted_at is not null;
  perform pg_temp.checkn('one of them is a tombstone', n, 1::bigint);

  -- ── The clock belongs to the server ──────────────────────────────────
  --
  -- A client sets `updated_at` to next year. The trigger must overwrite it.
  update public.notes set data = '{"title":"Edited"}', updated_at = now() + interval '365 days'
   where user_id = you and id = 'n1';
  select updated_at into live_updated from public.notes where user_id = you and id = 'n1';
  perform pg_temp.check('a device cannot set updated_at into the future',
                        live_updated > now() + interval '1 day', false);

  -- And it moves on a real write.
  select updated_at into after_touch from public.notes where user_id = you and id = 'n2';
  perform pg_temp.check('an untouched row keeps its timestamp',
                        after_touch <= live_updated, true);
end $$;


-- ── A pull for "everything since" ─────────────────────────────────────────
--
-- What a device does on waking: ask for every row whose `updated_at` is newer
-- than the moment it last synced.
--
-- This block used to take a mark, sleep ten milliseconds, write a row, and
-- expect the new row to sort after the mark. It could not ever pass, and the
-- reason is worth keeping rather than quietly deleting. `touch_updated_at`
-- stamps rows with `now()`, and `now()` is the time the *transaction* began.
-- It does not move while the transaction runs. So every row this file writes
-- carries the same instant, and `pg_sleep` advances the wall clock without
-- advancing the one the rows are stamped from. The assertion was asking the
-- database to tell apart two rows it had, correctly, recorded as simultaneous.
--
-- Two writes in one transaction being simultaneous is right rather than a
-- thing to work around, which is why the fix is here and not in the trigger. A
-- transaction is one instant; nothing in the app depends on ordering within
-- one, because each device write is its own transaction and a later
-- transaction gets a later `now()`.
--
-- So the contract is asserted against marks this block controls, on either
-- side of the transaction's own instant — and the invariant that defeated the
-- old version is pinned as a check of its own, so that reintroducing the sleep
-- fails loudly instead of looking reasonable.

do $$
declare
  you   uuid := 'cccccccc-0000-0000-0000-000000000001';
  began timestamptz;
  n     bigint;
begin
  perform pg_temp.become(you);

  began := now();
  insert into public.tasks (user_id, id, data) values (you, 't1', '{"title":"New"}');

  perform pg_sleep(0.01);
  perform pg_temp.check('the clock rows are stamped from does not move inside a transaction',
                        now() = began, true);

  -- A device whose last sync predates this transaction asks for everything
  -- since, and is given the notes and the task.
  select count(*) into n from public.notes
   where user_id = you and updated_at > began - interval '1 second';
  perform pg_temp.checkn('an incremental pull returns every note written since the mark', n, 3::bigint);

  select count(*) into n from public.tasks
   where user_id = you and updated_at > began - interval '1 second';
  perform pg_temp.checkn('and the task written with them', n, 1::bigint);

  -- A device already current asks again and is given nothing, rather than the
  -- whole account back on every wake.
  select count(*) into n from public.notes where user_id = you and updated_at > began;
  perform pg_temp.checkn('a device already up to date pulls no notes', n, 0::bigint);

  select count(*) into n from public.tasks where user_id = you and updated_at > began;
  perform pg_temp.checkn('and no tasks', n, 0::bigint);
end $$;


-- ── The stranger, per table ───────────────────────────────────────────────

do $$
declare
  you      uuid := 'cccccccc-0000-0000-0000-000000000001';
  stranger uuid := 'dddddddd-0000-0000-0000-000000000002';
  t        text;
  n        bigint;
  wrote    boolean;
begin
  perform pg_temp.become(you);
  insert into public.appointments (user_id, id, data) values (you, 'a1', '{"title":"Office hours"}');
  insert into public.sittings     (user_id, id, data) values (you, 's1', '{"pct":72}');

  perform pg_temp.become(stranger);

  -- Checked per table rather than once. A policy loop that silently skipped
  -- one is exactly the mistake that would not show up until it mattered.
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings']
  loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.checkn(format('a stranger reads no rows from %s', t), n, 0::bigint);

    begin
      execute format(
        'insert into public.%I (user_id, id, data) values ($1, ''intruder'', ''{}'')', t)
        using you;
      wrote := true;
    exception when others then
      wrote := false;
    end;
    perform pg_temp.check(format('a stranger cannot write into your %s', t), wrote, false);
  end loop;
end $$;


-- ── Sweeping old tombstones ───────────────────────────────────────────────

do $$
declare
  you uuid := 'cccccccc-0000-0000-0000-000000000001';
  n   bigint;
  removed integer;
begin
  perform pg_temp.become(you);

  -- One deleted long ago, one deleted just now.
  insert into public.tasks (user_id, id, data, deleted_at)
  values (you, 'old-tombstone', '{}', now() - interval '200 days');

  update public.tasks set deleted_at = now() where user_id = you and id = 't1';

  -- A student cannot run the sweep, and that is the point of it being
  -- revoked. `records.sql` takes EXECUTE away from anon and authenticated
  -- deliberately — it is a maintenance job for whoever operates the project,
  -- and a function that deletes rows in bulk is not something a signed-in
  -- device should be able to call. This file used to call it *as* a student
  -- and so never exercised the rule; it asserts it now.
  begin
    removed := public.sweep_tombstones('90 days');
    raise exception 'FAILED: a signed-in student ran the tombstone sweep';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-in student cannot run the tombstone sweep';
  end;

  -- The operator can. `reset role` drops back to whoever is running this
  -- file, which is who runs the sweep in life: a scheduled job or a person in
  -- the SQL Editor, not a device.
  reset role;
  removed := public.sweep_tombstones('90 days');
  perform pg_temp.check('the sweep removed something', removed > 0, true);
  perform pg_temp.become(you);

  select count(*) into n from public.tasks where user_id = you and id = 'old-tombstone';
  perform pg_temp.checkn('an old tombstone is gone', n, 0::bigint);

  select count(*) into n from public.tasks where user_id = you and id = 't1';
  perform pg_temp.checkn('a recent one is kept, so a device offline a week still learns', n, 1::bigint);

  select count(*) into n from public.notes where user_id = you and deleted_at is null;
  perform pg_temp.checkn('live rows are untouched by the sweep', n, 2::bigint);
end $$;


-- Nothing above is kept. Every check raises on failure, so reaching this line
-- is the result — said out loud rather than left to be inferred from the
-- absence of an error, which is how the other four suites in this directory
-- end and how somebody skimming a long log decides it went well.
do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

rollback;
