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

do $$
declare
  you  uuid := 'cccccccc-0000-0000-0000-000000000001';
  mark timestamptz;
  n    bigint;
begin
  perform pg_temp.become(you);

  select max(updated_at) into mark from public.notes where user_id = you;
  perform pg_sleep(0.01);

  insert into public.tasks (user_id, id, data) values (you, 't1', '{"title":"New"}');

  select count(*) into n from public.notes where user_id = you and updated_at > mark;
  perform pg_temp.checkn('nothing unchanged comes back on an incremental pull', n, 0::bigint);

  select count(*) into n from public.tasks where user_id = you and updated_at > mark;
  perform pg_temp.checkn('the new row does', n, 1::bigint);
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

  removed := public.sweep_tombstones('90 days');
  perform pg_temp.check('the sweep removed something', removed > 0, true);

  select count(*) into n from public.tasks where user_id = you and id = 'old-tombstone';
  perform pg_temp.checkn('an old tombstone is gone', n, 0::bigint);

  select count(*) into n from public.tasks where user_id = you and id = 't1';
  perform pg_temp.checkn('a recent one is kept, so a device offline a week still learns', n, 1::bigint);

  select count(*) into n from public.notes where user_id = you and deleted_at is null;
  perform pg_temp.checkn('live rows are untouched by the sweep', n, 2::bigint);
end $$;


-- Nothing above is kept. If you reached here with no exception, every check
-- above printed `ok:` and the schema does what its comments claim.
rollback;
