-- The one table in this schema a stranger is meant to be able to read.
--
-- `public.calendar_feeds` holds a rendered `.ics` that the Edge Function
-- serves to Apple Calendar and Google Calendar, neither of which can sign in.
-- That makes the random token the whole of the authentication, and makes this
-- the row worth checking hardest: the deliberate hole must be exactly the
-- shape it was meant to be and no larger.
--
-- What this covers:
--
--   * The signed-out `anon` role — the role the app's publishable key maps to
--     — can read nothing here. The feed is reachable only through the Edge
--     Function, which holds the service key. If anon could select from this
--     table, every account's calendar would be readable by anyone with the
--     publishable key, which is in the shipped JavaScript.
--   * One account cannot read, publish into, or replace another account's
--     feed, and cannot delete one.
--   * A token is unique across the whole table, so replacing yours can never
--     silently point at somebody else's calendar.
--   * `updated_at` comes from the database. The app says "published 3 hours
--     ago" off it, and a device with a wrong clock must not be able to claim
--     the feed is fresher than it is.
--   * Deleting the account takes the feed with it. A live feed outliving the
--     account that owned it is the worst bug this feature could have.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It makes its own users and rolls everything back
--   at the end, so it leaves nothing behind and is safe against a project with
--   real data in it.
--
-- What it cannot check is the function itself, which is Deno and is reviewed
-- by reading: `supabase/functions/calendar/index.ts`, and the notes in
-- `supabase/CALENDAR-REVIEW.md`.

begin;

do $$
declare
  you       uuid := 'cccccccc-0000-0000-0000-000000000001';
  stranger  uuid := 'dddddddd-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (you,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'feed.you.test@example.edu',      now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'feed.stranger.test@example.edu', now(), now(), now())
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

-- ── You publish a feed ────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('cccccccc-0000-0000-0000-000000000001');

  insert into public.calendar_feeds (user_id, token, body, name, events)
  values (auth.uid(),
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'BEGIN:VCALENDAR' || chr(13) || chr(10) || 'END:VCALENDAR',
          'Semester — Fall 2026', 12)
  on conflict (user_id) do update
    set token = excluded.token, body = excluded.body, name = excluded.name,
        events = excluded.events;

  select count(*) into n from public.calendar_feeds where user_id = auth.uid();
  perform pg_temp.counted('your feed is published', n, 1);
end $$;

-- ── A stranger, signed in to their own account ────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('dddddddd-0000-0000-0000-000000000002');

  select count(*) into n from public.calendar_feeds;
  perform pg_temp.counted('a stranger cannot read your feed', n, 0);

  -- Nor take your token by force. The unique index is what stops two accounts
  -- ever pointing at the same URL.
  begin
    insert into public.calendar_feeds (user_id, token, body)
    values (auth.uid(), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'x');
    raise exception 'FAILED: a stranger claimed your token';
  exception
    when unique_violation then
      raise notice 'ok  a token belongs to one account only';
    when insufficient_privilege then
      raise notice 'ok  a token belongs to one account only';
  end;

  -- Updating yours reports zero rows rather than raising, which is how RLS
  -- fails a write it cannot see: silently, and to nothing.
  update public.calendar_feeds set body = 'replaced' where token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot overwrite your calendar', n, 0);

  delete from public.calendar_feeds;
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot unpublish your calendar', n, 0);
end $$;

-- ── The signed-out role, which is what the shipped key maps to ────────────
--
-- This is the important one. The app's publishable key is in the JavaScript
-- every visitor downloads. If `anon` can select here, every calendar in the
-- project is public.

do $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', null, true);
  set local role anon;

  begin
    select count(*) into n from public.calendar_feeds;
    perform pg_temp.counted('a signed-out visitor reads nothing', n, 0);
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor reads nothing (no grant at all)';
  end;

  begin
    insert into public.calendar_feeds (user_id, token, body)
    values ('cccccccc-0000-0000-0000-000000000001',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'x');
    raise exception 'FAILED: a signed-out visitor published a feed';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot publish one either';
    when unique_violation then
      raise exception 'FAILED: a signed-out visitor got as far as the index';
  end;
end $$;

reset role;

-- ── The timestamp is the database's ───────────────────────────────────────

do $$
declare before timestamptz; after timestamptz;
begin
  perform pg_temp.become('cccccccc-0000-0000-0000-000000000001');

  select updated_at into before from public.calendar_feeds where user_id = auth.uid();

  -- A device claiming the far future. The trigger should overwrite it.
  update public.calendar_feeds
     set body = 'BEGIN:VCALENDAR' || chr(13) || chr(10) || 'END:VCALENDAR',
         updated_at = '2099-01-01'
   where user_id = auth.uid();

  select updated_at into after from public.calendar_feeds where user_id = auth.uid();
  if after > now() then
    raise exception 'FAILED: a device set the feed timestamp to %', after;
  end if;
  if after < before then
    raise exception 'FAILED: publishing moved the timestamp backwards';
  end if;
  raise notice 'ok  the publish time comes from the database, not the device';
end $$;

-- ── Deleting the account takes the feed with it ───────────────────────────

reset role;

do $$
declare n bigint;
begin
  delete from auth.users where id = 'cccccccc-0000-0000-0000-000000000001';
  select count(*) into n from public.calendar_feeds
   where user_id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.counted('a deleted account leaves no live feed behind', n, 0);
end $$;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

-- Nothing is kept.
rollback;
