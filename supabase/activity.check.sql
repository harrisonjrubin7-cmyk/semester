-- The pilot's three figures: what the ping may write, and what it may not.
--
-- `20260921151000_activity.sql` is a table of three columns and one function,
-- and almost everything that can go wrong with it is a privacy failure or a
-- forged number rather than an arithmetic one. So this suite is mostly about
-- two questions:
--
--   * Can a caller write a row that is not about itself, or about a day that
--     is not today? Both would be silent — a forged row looks exactly like a
--     real one — and both would make every figure in `ANALYTICS.md` a claim
--     about a browser rather than about a student.
--   * Can a caller read, change or delete somebody else's? The table is a
--     record of when a named person was awake and at their desk, which is
--     worth being as careful with as the access log it is modelled on.
--
-- What this covers:
--
--   * A ping writes one row per mark, dated today, for the calling account.
--   * Pinging again the same day adds nothing, whatever order the marks are
--     in and however many times it is called.
--   * A mark this schema does not know is dropped and the rest still land.
--   * The table takes no insert and no update through the API, from anybody:
--     not a stranger, not the account the row is about.
--   * An account reads its own rows and nobody else's.
--   * An account deletes its own rows and cannot delete another's.
--   * `note_activity` is not callable signed out, and `anon` reads nothing.
--   * Deleting the auth user takes the rows with it.
--   * The 400-day clock drops what is older, keeps what is not, and touches
--     no other account's rows.
--
-- ## What these checks are indifferent to, and why
--
-- Mutating the migration proves which line each check holds, and fourteen
-- mutations were run against this file as it stands. **Eleven are caught:**
-- removing the select policy, widening it to `using (true)`, removing the
-- delete policy, adding an insert policy, adding an update policy, granting
-- `note_activity` to `anon`, giving it a `who uuid` parameter, giving it an
-- `on_day date` parameter, dropping `on conflict do nothing`, removing the
-- unknown-mark filter, and dropping the prune.
--
-- **Three are not, and only one of them is a gap.**
--
-- *Deleting `alter table public.activity enable row level security` changes
-- nothing*, and that was measured rather than reasoned: the mutation was run
-- with a probe reading `pg_class.relrowsecurity` straight after the table is
-- created, and it came back true. Production has an event trigger,
-- `ensure_rls`, that enables row-level security on every table created in
-- `public`, and `local.stub.sql` reproduces it so the harness matches. The
-- line stays in the migration because a table whose security depends on an
-- event trigger nobody reading the file can see is a table that will one day
-- be created somewhere that trigger is not — but no suite run against a
-- database that has the trigger can tell the two apart, and pretending
-- otherwise would be the same "green tick for the wrong question" this
-- repository keeps finding in its own instruments.
--
-- *Widening the delete policy to `using (true)` changes nothing either*, for
-- the mechanism `referrals.check.sql` measured and wrote up: a
-- `DELETE ... WHERE` scans the rows it filters, row-level security applies the
-- SELECT policy to that scan, and the select policy already confines the scan
-- to your own rows. It is the second of two locks, and a suite reaching the
-- table through the API cannot see which one held.
--
-- *Dropping the `check` on `mark` changes nothing, and neither does dropping
-- the function'''s filter — but dropping both goes red.* The two defend each
-- other, which is why each is invisible on its own: with the filter in place
-- nothing unknown ever reaches the constraint, and with the constraint in
-- place an unfiltered insert is refused. The double mutation was run and the
-- unknown-mark block caught it. So the closed vocabulary is guarded, and what
-- this suite cannot say is which half is guarding it on any given day.
--
-- The one genuine gap is the constraint'''s real purpose, which is a row
-- written *around* the function — by hand, in the dashboard, which is how ten
-- migrations''' worth of this schema got there. Nothing reachable through the
-- API can test that, because nothing reachable through the API can write a
-- row that way.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

/**
 * A row dated whenever the test needs it.
 *
 * As superuser, because that is the point: nothing reachable through the API
 * can write a row for another day, and this suite has to be able to in order
 * to check the clock at all. If this ever stops needing `reset role`, the
 * check two blocks down has stopped being true.
 */
create or replace function pg_temp.backdated(who uuid, mark text, d date)
returns void language plpgsql as $$
begin
  insert into public.activity (user_id, day, mark) values (who, d, mark)
    on conflict do nothing;
end $$;

-- ── The shape of the function, which is where the design lives ───────────
--
-- Everything below this block goes through `note_activity(text[])` and so can
-- only test what that signature allows. The signature *is* the guarantee: a
-- caller cannot name an account or a date because there is nowhere to put
-- one. A later version that grew a `who uuid default null` parameter would
-- pass every runtime check in this file — each of them would go on calling it
-- with one argument and getting the right answer — and would hand the whole
-- table to anybody holding the publishable key.
--
-- So it is checked structurally, out of the catalogs, for the reason
-- `CLAUDE.md` gives about `rootunmount.test.ts`: a structural check cannot be
-- fooled by a path the test happened not to take.

do $$
declare args text; def boolean; cfg text[];
begin
  reset role;
  select pg_get_function_arguments(p.oid), p.prosecdef, p.proconfig
    into args, def, cfg
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'note_activity';

  if args is null then
    raise exception 'FAILED: public.note_activity does not exist — has it moved?';
  end if;
  if args <> 'marks text[]' then
    raise exception 'FAILED: note_activity takes (%), and the only thing a caller may supply is which marks', args;
  end if;
  raise notice 'ok  note_activity takes marks and nothing else (%)', args;

  -- Definer is what lets the table have no write policy. Dropping it would
  -- turn every ping into a refusal, which the blocks below would catch — but
  -- they would report it as an insert failure, and this says what it is.
  if not def then
    raise exception 'FAILED: note_activity is not security definer, so the table needs a write policy';
  end if;
  raise notice 'ok  note_activity is security definer';

  if cfg is null or not ('search_path=' = any(select left(c, 12) from unnest(cfg) c)) then
    raise exception 'FAILED: note_activity has no search_path set, which harden_security_definer_helpers exists about';
  end if;
  raise notice 'ok  note_activity pins its search_path (%)', array_to_string(cfg, ', ');
end $$;

-- ── One ping, and what it writes ──────────────────────────────────────────

do $$
declare a uuid; n bigint; d date;
begin
  reset role;
  a := pg_temp.newuser('activity.one.test@example.edu');

  perform pg_temp.become(a);
  perform public.note_activity(array['opened', 'course']);
  reset role;

  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('a ping writes one row per mark', n, 2);

  select distinct day into d from public.activity where user_id = a;
  if d <> (now() at time zone 'utc')::date then
    raise exception 'FAILED: the row is dated %, and today is %', d, (now() at time zone 'utc')::date;
  end if;
  raise notice 'ok  the row is dated today, in UTC (%)', d;

  -- Twice, and in the other order, and with a repeat inside one call. All of
  -- it is the same two rows: the app pings whenever its derived set changes,
  -- which on a busy evening is several times, and a table that grew a row
  -- each time would make "days active" a count of renders.
  perform pg_temp.become(a);
  perform public.note_activity(array['course', 'opened']);
  perform public.note_activity(array['opened', 'opened', 'opened']);
  reset role;

  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('pinging again the same day adds nothing', n, 2);
end $$;

-- ── A mark this schema has not heard of ───────────────────────────────────
--
-- The failure this is about is a deploy order, not an attack: the app can
-- ship a fourth mark before the migration that knows it. What must not happen
-- is the whole statement failing, because then the two marks that were fine
-- go missing too and the figures show a cliff no student caused.
--
-- This tests the filter in `note_activity`, not the column's `check`. See the
-- header for why the `check` is unreachable from here and why it stays anyway.

do $$
declare a uuid; n bigint;
begin
  reset role;
  a := pg_temp.newuser('activity.unknown.test@example.edu');

  perform pg_temp.become(a);
  perform public.note_activity(array['opened', 'asked_the_assistant', 'studied']);
  reset role;

  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('an unknown mark is dropped and the known ones land', n, 2);

  select count(*) into n from public.activity
   where user_id = a and mark = 'asked_the_assistant';
  perform pg_temp.counted('and the unknown mark is not in the table', n, 0);
end $$;

-- ── The account and the day are the database's ────────────────────────────
--
-- There is no parameter for either, which is the design, so what is checked
-- here is that there is no *other* way in: no insert policy and no update
-- policy, for anybody, about anybody.

do $$
declare a uuid; b uuid; n bigint; msg text;
begin
  reset role;
  a := pg_temp.newuser('activity.writer.test@example.edu');
  b := pg_temp.newuser('activity.victim.test@example.edu');

  -- Your own row, through the API. Refused: there is no insert policy at all,
  -- so even the account the row would be about cannot write one — which is
  -- what stops a client choosing its own dates.
  perform pg_temp.become(a);
  begin
    insert into public.activity (user_id, day, mark)
    values (a, (now() at time zone 'utc')::date, 'studied');
    raise exception 'FAILED: an account inserted a row about itself';
  exception
    when insufficient_privilege then
      raise notice 'ok  an account cannot insert its own activity row';
  end;

  -- Somebody else's, backdated. Same refusal, and it is worth checking
  -- separately: an insert policy added later would very likely be written
  -- `with check (auth.uid() = user_id)`, which stops this one and not the one
  -- above.
  begin
    insert into public.activity (user_id, day, mark)
    values (b, '2020-01-01', 'studied');
    raise exception 'FAILED: an account inserted a row about another account';
  exception
    when insufficient_privilege then
      raise notice 'ok  an account cannot insert a row about another account';
  end;
  reset role;

  -- Now a real row, and the update path over it.
  perform pg_temp.become(a);
  perform public.note_activity(array['opened']);
  reset role;

  perform pg_temp.become(a);
  update public.activity set day = '2020-01-01' where user_id = a;
  reset role;

  select count(*) into n from public.activity where user_id = a and day = '2020-01-01';
  perform pg_temp.counted('an account cannot move its own row to another day', n, 0);
  select count(*) into n from public.activity
   where user_id = a and day = (now() at time zone 'utc')::date;
  perform pg_temp.counted('and the row is still where the database put it', n, 1);
end $$;

-- ── Reading, which is the half this table shares with the access log ──────

do $$
declare a uuid; b uuid; n bigint;
begin
  reset role;
  a := pg_temp.newuser('activity.mine.test@example.edu');
  b := pg_temp.newuser('activity.theirs.test@example.edu');

  perform pg_temp.become(a);
  perform public.note_activity(array['opened', 'course', 'studied']);
  reset role;
  perform pg_temp.become(b);
  perform public.note_activity(array['opened']);
  reset role;

  perform pg_temp.become(a);
  select count(*) into n from public.activity;
  perform pg_temp.counted('an account sees its own three rows and no others', n, 3);
  select count(*) into n from public.activity where user_id = b;
  perform pg_temp.counted('and asking for the other account by id returns nothing', n, 0);
  reset role;

  -- Signed out sees nothing at all, which is not the same statement: `anon`
  -- has no grant on this table and no policy matches it either, and a change
  -- that restored the grant would be caught here rather than in a month.
  perform pg_temp.become_anon();
  begin
    select count(*) into n from public.activity;
    perform pg_temp.counted('a signed-out visitor sees nothing', n, 0);
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot read the table at all';
  end;
  reset role;
end $$;

-- ── Deleting: your own, and only your own ─────────────────────────────────

do $$
declare a uuid; b uuid; n bigint;
begin
  reset role;
  a := pg_temp.newuser('activity.clear.test@example.edu');
  b := pg_temp.newuser('activity.keep.test@example.edu');

  perform pg_temp.become(a);
  perform public.note_activity(array['opened', 'course']);
  reset role;
  perform pg_temp.become(b);
  perform public.note_activity(array['opened', 'course']);
  reset role;

  -- What "Delete my account" does: a delete by user_id from the browser.
  perform pg_temp.become(a);
  delete from public.activity where user_id = a;
  reset role;

  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('an account can clear its own activity', n, 0);
  select count(*) into n from public.activity where user_id = b;
  perform pg_temp.counted('and the other account still has its rows', n, 2);

  -- Aimed at the other account. Nothing is removed, and no error is raised —
  -- the select policy confines the scan, which is the mechanism the header
  -- says this suite cannot distinguish from the delete policy.
  perform pg_temp.become(a);
  delete from public.activity where user_id = b;
  reset role;
  select count(*) into n from public.activity where user_id = b;
  perform pg_temp.counted('and a delete aimed at it removes nothing', n, 2);
end $$;

-- ── Signed out, the function is not there ─────────────────────────────────

do $$
declare n bigint;
begin
  reset role;
  perform pg_temp.become_anon();
  begin
    perform public.note_activity(array['opened']);
    raise exception 'FAILED: a signed-out visitor called note_activity';
  exception
    when insufficient_privilege then
      raise notice 'ok  note_activity is not callable signed out';
  end;
  reset role;
end $$;

-- ── Deleting the account takes the rows ───────────────────────────────────
--
-- The cascade, rather than the button. `deleteEverything` in `lib/cloud.ts`
-- clears the rows itself because a browser cannot delete an auth user — but
-- the day somebody is removed by hand in the dashboard, this is what decides
-- whether their record of being awake at 2am survives them.

do $$
declare a uuid; n bigint;
begin
  reset role;
  a := pg_temp.newuser('activity.cascade.test@example.edu');
  perform pg_temp.become(a);
  perform public.note_activity(array['opened', 'course', 'studied']);
  reset role;

  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('rows exist before the account is removed', n, 3);

  delete from auth.users where id = a;
  select count(*) into n from public.activity where user_id = a;
  perform pg_temp.counted('and none after', n, 0);
end $$;

-- ── The clock ─────────────────────────────────────────────────────────────

do $$
declare a uuid; b uuid; n bigint; today date := (now() at time zone 'utc')::date;
begin
  reset role;
  a := pg_temp.newuser('activity.old.test@example.edu');
  b := pg_temp.newuser('activity.bystander.test@example.edu');

  perform pg_temp.backdated(a, 'opened', today - 401);
  perform pg_temp.backdated(a, 'opened', today - 400);
  perform pg_temp.backdated(a, 'opened', today - 399);
  perform pg_temp.backdated(b, 'opened', today - 401);

  perform pg_temp.become(a);
  perform public.note_activity(array['opened']);
  reset role;

  select count(*) into n from public.activity where user_id = a and day = today - 401;
  perform pg_temp.counted('a row older than 400 days is dropped on the next ping', n, 0);
  -- The boundary, written out: `day < today - 400` keeps the row exactly 400
  -- days old. A change to `<=` would be a decision, and this is what makes it
  -- one rather than a typo nobody sees.
  select count(*) into n from public.activity where user_id = a and day = today - 400;
  perform pg_temp.counted('the row exactly 400 days old is kept', n, 1);
  select count(*) into n from public.activity where user_id = a and day = today - 399;
  perform pg_temp.counted('and so is a newer one', n, 1);

  -- The prune runs on the account being written and nothing else. A prune
  -- written without its `user_id` filter would clear the whole table on every
  -- ping, and every cohort older than a year with it.
  select count(*) into n from public.activity where user_id = b and day = today - 401;
  perform pg_temp.counted('another account''s old rows are untouched', n, 1);
end $$;

-- ── The arithmetic the three figures are made of ──────────────────────────
--
-- The queries in `supabase/analytics.sql` decide what the pilot is told about
-- itself, and until this block existed nobody had run them against a
-- population whose answer was known in advance. A retention query that is
-- wrong does not error — it returns a number, and the number is believed.
--
-- The expressions below are the ones in that file. They are a second copy,
-- which is a cost: `activity.test.ts` pins the distinguishing fragment of
-- each against the file, for the reason `referral.test.ts` gives about two
-- sides that cannot import from each other. If you change a window here,
-- change it there, and that test is what says so.
--
-- The population is four accounts, built so that each trap in those queries
-- has something to catch:
--
--   A  arrived 60 days ago, had a course and had studied inside the week,
--      and was back on day 30. Activated, and retained.
--   B  arrived the same day, added a course on day 10 — outside the window —
--      and never studied. Not activated, not retained.
--   C  arrived the same day, did everything on day one, and came back on
--      day 40. Activated, and **not** retained: day 40 is past the band.
--   D  arrived three days ago. In neither cohort at all, and the reason it is
--      here is that both queries read as plausible with it counted.

do $$
declare
  a uuid; b uuid; c uuid; d uuid;
  today date := (now() at time zone 'utc')::date;
  day0 date := today - 60;
  arrived bigint; course bigint; studied bigint; activated bigint; retained bigint;
  active_week bigint;
begin
  reset role;
  -- The rows below are only about these four, and the suite runs inside one
  -- transaction that is rolled back, so the aggregates are over them alone.
  delete from public.activity;

  a := pg_temp.newuser('activity.sums.a.test@example.edu');
  b := pg_temp.newuser('activity.sums.b.test@example.edu');
  c := pg_temp.newuser('activity.sums.c.test@example.edu');
  d := pg_temp.newuser('activity.sums.d.test@example.edu');

  perform pg_temp.backdated(a, 'opened', day0);
  perform pg_temp.backdated(a, 'course', day0 + 2);
  perform pg_temp.backdated(a, 'studied', day0 + 5);
  perform pg_temp.backdated(a, 'opened', day0 + 30);

  perform pg_temp.backdated(b, 'opened', day0);
  perform pg_temp.backdated(b, 'course', day0 + 10);

  perform pg_temp.backdated(c, 'opened', day0);
  perform pg_temp.backdated(c, 'course', day0);
  perform pg_temp.backdated(c, 'studied', day0);
  perform pg_temp.backdated(c, 'opened', day0 + 40);

  perform pg_temp.backdated(d, 'opened', today - 3);
  perform pg_temp.backdated(d, 'opened', today);
  perform pg_temp.backdated(d, 'course', today - 3);
  perform pg_temp.backdated(d, 'studied', today - 3);

  -- Activation, over the cohort that is old enough to be asked.
  with first_seen as (
    select user_id, min(day) as f_day0 from public.activity
     where mark = 'opened' group by user_id
  ), reached as (
    select user_id, mark, min(day) as at from public.activity group by user_id, mark
  )
  select count(*),
         count(*) filter (where ch.at <= f.f_day0 + 7),
         count(*) filter (where st.at <= f.f_day0 + 7),
         count(*) filter (where ch.at <= f.f_day0 + 7 and st.at <= f.f_day0 + 7)
    into arrived, course, studied, activated
    from first_seen f
    left join reached ch on ch.user_id = f.user_id and ch.mark = 'course'
    left join reached st on st.user_id = f.user_id and st.mark = 'studied'
   where f.f_day0 <= today - 7;

  perform pg_temp.counted('activation counts the cohort old enough to be asked', arrived, 3);
  perform pg_temp.counted('and a course added on day 10 is outside the window', course, 2);
  perform pg_temp.counted('and studying inside the window counts', studied, 2);
  perform pg_temp.counted('and activation is both, inside the window', activated, 2);

  -- Retention, over the cohort whose band has finished.
  with first_seen as (
    select user_id, min(day) as f_day0 from public.activity
     where mark = 'opened' group by user_id
  )
  select count(*) filter (where exists (
           select 1 from public.activity x
            where x.user_id = f.user_id and x.mark = 'opened'
              and x.day between f.f_day0 + 28 and f.f_day0 + 34))
    into retained
    from first_seen f
   where f.f_day0 <= today - 34;

  -- One of the three, and which one is the point: A came back on day 30 and
  -- C on day 40. A band that had been written `>= day0 + 28` with no upper
  -- bound would say two, and would go on saying two for every account that
  -- ever returns, which is a retention figure that cannot fall.
  perform pg_temp.counted('retention counts the return inside the band and not the one past it', retained, 1);

  /*
   * Weekly active use, twice: the week everybody arrived, and this one.
   *
   * The first is the check that matters and the second is why it is written
   * this way. The first draft asked only about "this week" and expected one,
   * which passed on a Monday and would have failed every Thursday — `today -
   * 3` is in the previous week for four days out of seven, and a suite that
   * is green on the day it is written and red on Thursday is worse than no
   * suite. Both arrivals below are now dated relative to a week boundary
   * rather than to the day this ran.
   */
  select count(distinct user_id) into active_week
    from public.activity
   where mark = 'opened'
     and date_trunc('week', day) = date_trunc('week', day0::timestamp);
  perform pg_temp.counted('weekly active use counts the three who arrived that week', active_week, 3);

  select count(distinct user_id) into active_week
    from public.activity
   where mark = 'opened'
     and date_trunc('week', day) = date_trunc('week', today::timestamp);
  -- One: the newest account, which opened it again today. A and C were last
  -- seen thirty and forty days ago and must not be in a *weekly* figure.
  perform pg_temp.counted('and only the account that opened it this week', active_week, 1);
end $$;

rollback;
