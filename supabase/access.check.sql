-- The log of who read your rows, which is only worth anything if it is yours.
--
-- `public.access_log` records the two reads in this project that go around
-- row-level security — the calendar feed served to Apple and Google, and the
-- reminder sender run by the scheduler — and shows them to the account they
-- are about. Two properties carry the whole feature and both are checked here:
--
--   * **You can read yours and nobody else's.** An audit log a stranger can
--     read is a second leak wearing the clothes of a fix.
--   * **Nobody can write one through the API.** There is no insert policy, on
--     purpose. If an account could forge rows in its own log it could hide a
--     real fetch in a hundred invented ones, and if it could forge rows in
--     *somebody else's* it could make a student replace a link that was never
--     leaked. The write path is the service key and `note_access`, and that
--     function is revoked from PUBLIC rather than from `anon` and
--     `authenticated` by name — the mistake `invites.check.sql` caught once
--     already, where both roles inherit the grant through PUBLIC and a
--     revoke naming them does nothing.
--
--   How to run it: open the Supabase SQL Editor, paste this file's CONTENTS —
--   not its path — and run. It makes its own users and rolls everything back
--   at the end. Or `supabase/check.sh access`, which runs it against a
--   throwaway cluster with every migration applied.
--
-- Note that `check.sh` performs `grant all on all tables ... to anon,
-- authenticated` after the migrations, imitating Supabase's own default
-- privileges. That is not a weakness in the harness, it is the point: it means
-- the write checks below are proving that **row-level security alone** holds,
-- with the table grants at their most generous. The `revoke` in the migration
-- is the second lock, and a check that relied on it would not notice the first
-- one failing.

begin;

do $$
declare
  you      uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  stranger uuid := 'ffffffff-0000-0000-0000-000000000002';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (you,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'log.you.test@example.edu',      now(), now(), now()),
    (stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'log.stranger.test@example.edu', now(), now(), now())
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

-- ── The service key records two fetches of your calendar ──────────────────

do $$
declare n bigint; h integer;
begin
  set local role service_role;

  perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed', 'apple');
  perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed', 'apple');

  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform pg_temp.counted('two fetches by one client are one row', n, 1);

  select hits into h from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  if h <> 2 then
    raise exception 'FAILED: the second fetch was not counted — hits is %', h;
  end if;
  raise notice 'ok  and the second fetch is counted rather than lost';

  -- A different family is a different row, which is the entire signal: a
  -- browser beside a calendar is what a leaked link looks like.
  perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed', 'browser');
  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform pg_temp.counted('a different kind of client is a separate row', n, 2);
end $$;

reset role;

-- ── A user-agent string cannot be written here, whatever calls it ─────────
--
-- The privacy claim is that this table holds a family and never a string from
-- the wire. That is a check constraint rather than a habit in a function, so
-- it holds against a function written next year by somebody who did not read
-- the header.

do $$
begin
  set local role service_role;
  begin
    perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed',
                               'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    raise exception 'FAILED: a user-agent string was written to the access log';
  exception
    when check_violation then
      raise notice 'ok  a user-agent string is refused by the database';
  end;

  begin
    perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'read_the_lot', 'apple');
    raise exception 'FAILED: an unknown access kind was accepted';
  exception
    when check_violation then
      raise notice 'ok  and so is a kind of access nothing in this project makes';
  end;
end $$;

reset role;

-- ── You can read yours ────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  select count(*) into n from public.access_log;
  perform pg_temp.counted('you can read your own access log', n, 2);
end $$;

-- ── A stranger cannot ─────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become('ffffffff-0000-0000-0000-000000000002');

  select count(*) into n from public.access_log;
  perform pg_temp.counted('a stranger reads none of it', n, 0);

  -- Nor delete it. An access log somebody else can clear is one an attacker
  -- clears on the way out.
  delete from public.access_log;
  get diagnostics n = row_count;
  perform pg_temp.counted('a stranger cannot clear your access log', n, 0);
end $$;

-- ── Nobody writes one through the API, including you ──────────────────────
--
-- There is no insert policy and no update policy on this table. Both of these
-- are running with `grant all` in force, so RLS is the only thing in the way,
-- which is what makes them worth running.

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  begin
    insert into public.access_log (user_id, what, client, hits)
    values (auth.uid(), 'calendar_feed', 'apple', 9999);
    raise exception 'FAILED: an account forged a row in its own access log';
  exception
    when insufficient_privilege then
      raise notice 'ok  you cannot forge a row in your own access log';
  end;

  /*
   * This used to run the update and assert that it changed no rows, which was
   * the right assertion about the wrong fence. `access_log.sql` grants
   * `authenticated` SELECT and DELETE and no UPDATE at all, so on the live
   * project the statement never reaches a policy — it is refused outright.
   *
   * It read as passing here only because `check.sh` used to hand every table
   * privilege back to both client roles after the migrations ran, which put
   * the UPDATE grant back and left row-level security to do a job the grant
   * had already done. With the harness now granting tables the way Supabase
   * does, the refusal is visible, and asserting it is strictly stronger: an
   * audit log whose rows can be rewritten is a log that can be doctored, so
   * "no grant" is the property worth pinning, not "no rows".
   */
  begin
    update public.access_log set hits = 0;
    get diagnostics n = row_count;
    raise exception 'FAILED: an account could rewrite its own access log (% row(s))', n;
  exception
    when insufficient_privilege then
      raise notice 'ok  nor rewrite one';
  end;
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become('ffffffff-0000-0000-0000-000000000002');
  begin
    insert into public.access_log (user_id, what, client, hits)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed', 'browser', 500);
    raise exception 'FAILED: a stranger wrote into your access log';
  exception
    when insufficient_privilege then
      raise notice 'ok  and a stranger cannot write into yours';
  end;
end $$;

-- ── The write function is not reachable by a signed-in account ────────────
--
-- The check that would have caught the `set_invite_only` hole. Revoking from
-- `anon` and `authenticated` by name leaves the grant they inherit through
-- PUBLIC untouched — a REVOKE naming a role removes that role's own grant and
-- not the one it holds as a member of PUBLIC — so the migration revokes from
-- PUBLIC, and this is the test of it.
--
-- ## Why it asks the catalogue rather than making the call
--
-- The first version of this called `note_access` as each role and expected
-- `insufficient_privilege`. It passed. It also passed against a migration
-- revoking from `anon, authenticated` by name, which is the exact hole it was
-- written for — because the call was refused one layer further in. The
-- function is `security invoker`, so its insert runs as the caller, and that
-- insert is blocked by row-level security whether or not the caller was ever
-- allowed to call the function. Two defences, one of them broken, and the
-- error message from the working one is indistinguishable.
--
-- So the grant is read off `pg_proc` directly. `has_function_privilege` is
-- true or false about the thing the migration is actually claiming, and it
-- cannot be satisfied by a second lock holding.

do $$
declare sig text := 'public.note_access(uuid, text, text)';
begin
  if has_function_privilege('authenticated', sig, 'execute') then
    raise exception 'FAILED: authenticated may execute note_access';
  end if;
  raise notice 'ok  a signed-in account may not execute note_access';

  if has_function_privilege('anon', sig, 'execute') then
    raise exception 'FAILED: anon may execute note_access';
  end if;
  raise notice 'ok  nor may a signed-out visitor';

  -- The control. A probe that answered false for every role would pass both
  -- of those against a function nobody can run at all, including the sender.
  if not has_function_privilege('service_role', sig, 'execute') then
    raise exception 'FAILED: service_role cannot execute note_access either — nothing can write the log';
  end if;
  raise notice 'ok  and the service key, which is the only caller, may';
end $$;

-- And the call itself is refused, which is the second lock rather than the
-- first. Worth keeping and worth labelling: it is what still holds on the day
-- somebody grants EXECUTE back.

do $$
begin
  perform pg_temp.become('ffffffff-0000-0000-0000-000000000002');
  begin
    perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'calendar_feed', 'browser');
    raise exception 'FAILED: a signed-in account wrote through note_access';
  exception
    when insufficient_privilege then
      raise notice 'ok  and the write inside it is refused as well';
  end;
end $$;

-- ── A signed-out visitor reads nothing ────────────────────────────────────

do $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', null, true);
  set local role anon;

  begin
    select count(*) into n from public.access_log;
    perform pg_temp.counted('a signed-out visitor reads nothing', n, 0);
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor reads nothing (no grant at all)';
  end;
end $$;

reset role;

-- ── You can clear your own, which is what "delete my account" does ────────

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-000000000001');

  delete from public.access_log where user_id = auth.uid();
  get diagnostics n = row_count;
  perform pg_temp.counted('you can clear your own access log', n, 2);
end $$;

reset role;

-- ── It ages out at ninety days ────────────────────────────────────────────
--
-- The page says ninety days. A retention promise nothing enforces is the kind
-- of claim this project's privacy page exists not to make.

do $$
declare n bigint; old date := ((now() at time zone 'utc')::date - 91);
begin
  set local role service_role;

  insert into public.access_log (user_id, day, what, client, hits, last_at)
  values ('eeeeeeee-0000-0000-0000-000000000001', old, 'calendar_feed', 'apple', 3,
          now() - interval '91 days');

  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001' and day = old;
  perform pg_temp.counted('a ninety-one day old entry is there to be aged out', n, 1);

  -- Any write for that account prunes it. No scheduled job to notice has
  -- stopped, which is the trade the migration's comment argues for.
  perform public.note_access('eeeeeeee-0000-0000-0000-000000000001', 'push_send', 'device');

  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001' and day = old;
  perform pg_temp.counted('and it is gone after the next write', n, 0);

  -- The control on that: pruning must take the old row and leave today's.
  -- A `delete` with a wrong comparison would empty the table and pass a check
  -- that only looked for the absence of the old one.
  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform pg_temp.counted('while today''s entry is left alone', n, 1);
end $$;

reset role;

-- ── Serving a feed notes it, and still never returns a user_id ────────────

do $$
declare n bigint; h bigint; got record;
begin
  -- Published the way a feed is really published: by its owner, through RLS.
  perform pg_temp.become('ffffffff-0000-0000-0000-000000000002');
  insert into public.calendar_feeds (user_id, token, body, name, events)
  values (auth.uid(),
          '111111111111111111111111111111111111111111111111',
          'BEGIN:VCALENDAR' || chr(13) || chr(10) || 'END:VCALENDAR', 'Stranger — Fall 2026', 4)
  on conflict (user_id) do nothing;

  reset role;
  set local role service_role;

  select * into got from public.read_feed('111111111111111111111111111111111111111111111111', 'browser');
  if got.body is null or got.name <> 'Stranger — Fall 2026' then
    raise exception 'FAILED: read_feed did not return the feed';
  end if;
  raise notice 'ok  a token serves the feed it belongs to';

  select count(*) into n from public.access_log
   where user_id = 'ffffffff-0000-0000-0000-000000000002' and what = 'calendar_feed';
  perform pg_temp.counted('and the fetch is noted against its owner', n, 1);

  /*
   * The property the calendar function's own header argues for, kept: whose
   * calendar this is never leaves the database. A `select *` would have
   * carried it out if the signature said so, so the signature is what is
   * asserted rather than one call's result.
   */
  select count(*) into n
    from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'read_feed'
     and p.parameter_mode = 'OUT' and p.parameter_name = 'user_id';
  perform pg_temp.counted('and read_feed returns no user_id at all', n, 0);

  -- The control on that: the probe has to be able to see the columns it is
  -- reporting the absence of.
  select count(*) into n
    from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'read_feed'
     and p.parameter_mode = 'OUT';
  perform pg_temp.counted('while the probe can see its three returned columns', n, 3);

  /*
   * An unknown token returns nothing and notes nothing. A row written for a
   * token matching no feed would be an access log anybody could fill, and a
   * student told their link had been fetched from a browser when nothing of
   * the sort happened would replace it for no reason.
   *
   * The family is deliberately one nothing above used. The first version of
   * this asked again for `browser` and counted rows — and passed against a
   * `read_feed` that noted every unknown token against a real account,
   * because the note is an upsert: same account, same day, same family, same
   * row, one higher. Counting rows could not see it. Both are asserted now,
   * a new family so a spurious row has somewhere to appear, and the total
   * hits so a spurious increment does too.
   */
  select sum(hits) into h from public.access_log
   where user_id = 'ffffffff-0000-0000-0000-000000000002' and what = 'calendar_feed';

  perform public.read_feed('222222222222222222222222222222222222222222222222', 'outlook');

  select count(*) into n from public.access_log where what = 'calendar_feed'
     and user_id = 'ffffffff-0000-0000-0000-000000000002';
  perform pg_temp.counted('an unknown token writes no new row', n, 1);

  select sum(hits) into n from public.access_log
   where user_id = 'ffffffff-0000-0000-0000-000000000002' and what = 'calendar_feed';
  perform pg_temp.counted('and does not count against an existing one', n, h);
end $$;

reset role;

do $$
declare sig text := 'public.read_feed(text, text)';
begin
  if has_function_privilege('anon', sig, 'execute') then
    raise exception 'FAILED: anon may execute read_feed — every feed is readable without a token';
  end if;
  if has_function_privilege('authenticated', sig, 'execute') then
    raise exception 'FAILED: authenticated may execute read_feed';
  end if;
  raise notice 'ok  read_feed is reachable by the service key alone';
  if not has_function_privilege('service_role', sig, 'execute') then
    raise exception 'FAILED: service_role cannot execute read_feed — no feed can be served';
  end if;
  raise notice 'ok  and the service key can still serve a feed';
end $$;

-- ── Deleting the account takes the log with it ────────────────────────────

do $$
declare n bigint;
begin
  delete from auth.users where id = 'eeeeeeee-0000-0000-0000-000000000001';
  select count(*) into n from public.access_log
   where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform pg_temp.counted('a deleted account leaves no access log behind', n, 0);
end $$;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;

-- Nothing is kept.
rollback;
