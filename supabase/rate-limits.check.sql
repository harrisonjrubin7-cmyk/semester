-- Rate limits on the browser's direct writes, and what they must not touch.
--
-- `20260928230000_direct_rate_limits.sql` puts a BEFORE INSERT trigger on
-- every table a signed-in script could flood — class chat, the two report
-- queues, feedback, help requests, mentor requests, community posts and the
-- rest — backed by one sliding-window counter in `private.direct_rate_limit`.
--
-- A limiter can be wrong in two directions and both are asked here. Too loose
-- is the obvious one: the N+1th insert gets through. Too tight is the one that
-- reaches a real person: a second account caught by the first one's count, a
-- window that never ends, a cron job or the service role refused because the
-- JWT claims of the last request were still set. Each check below has a
-- partner that asks the other direction.
--
-- `feedback` (20 an hour) carries the machinery checks, because it has the
-- fewest preconditions — no class, no community, no school. What is proved
-- there is proved for every table, since the trigger function is the same
-- one; the coverage block at the end is what holds the list of tables.
--
--   How to run it: supabase/check.sh rate-limits

begin;

do $$
declare
  ana uuid := '11111111-1111-1111-1111-111111111111';
  ben uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at)
  values
    (ana, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ana.test@vanderbilt.edu', now(), now(), now()),
    (ben, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ben.test@vanderbilt.edu', now(), now(), now())
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

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.check(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  %', what;
end $$;

/** One feedback note from `who`, as whoever is currently the role. */
create or replace function pg_temp.note(who uuid)
returns void language plpgsql as $$
begin
  insert into public.feedback (author, kind, note, route, device)
  values (who, 'idea', 'a note', '/today', 'phone');
end $$;

/**
 * Whether `sql` is refused *by the limiter*. Any other refusal — a policy, a
 * constraint — is a failure here, because "refused" alone would pass on a
 * suite whose fixture had simply stopped being insertable.
 */
create or replace function pg_temp.limited(what text, sql text)
returns void language plpgsql as $$
declare state text; msg text;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
    if state = '54000' and msg like 'You''ve sent a lot in a short time%' then
      raise notice 'ok  %', what;
      return;
    end if;
    raise exception 'FAILED: % — refused, but not by the limit (% %)', what, state, msg;
  end;
  raise exception 'FAILED: % — the write was allowed', what;
end $$;

create or replace function pg_temp.allowed(what text, sql text)
returns void language plpgsql as $$
begin
  execute sql;
  raise notice 'ok  %', what;
exception when others then
  raise exception 'FAILED: % — the write was refused (%)', what, sqlerrm;
end $$;

-- ── Up to the limit, and not one more ─────────────────────────────────────

do $$
declare ana uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform pg_temp.become(ana);
  for i in 1..20 loop
    perform pg_temp.note(ana);
  end loop;
  raise notice 'ok  twenty notes in an hour are accepted';

  perform pg_temp.limited('the twenty-first is refused, with the limit''s own code and words',
    $q$select pg_temp.note('11111111-1111-1111-1111-111111111111')$q$);

  -- And it stays refused: a refusal is not counted, but neither does it reset.
  perform pg_temp.limited('and so is the twenty-second',
    $q$select pg_temp.note('11111111-1111-1111-1111-111111111111')$q$);
end $$;

-- A refused insert rolls its own hit back, so the log holds exactly the
-- twenty that landed. Read as postgres: the table is closed to clients.
do $$
begin
  reset role;
  perform pg_temp.check('the log holds the twenty that landed and not the refusals',
    (select count(*) from private.direct_rate_limit
      where user_id = '11111111-1111-1111-1111-111111111111' and bucket = 'feedback') = 20, true);
  perform pg_temp.check('and the table holds the twenty rows the log says',
    (select count(*) from public.feedback
      where author = '11111111-1111-1111-1111-111111111111') = 20, true);
end $$;

-- ── The control: a second account is not the first one's count ───────────

do $$
declare ben uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform pg_temp.become(ben);
  perform pg_temp.allowed('a second account sends while the first is limited',
    $q$select pg_temp.note('22222222-2222-2222-2222-222222222222')$q$);
end $$;

-- ── The window ends, and it slides ────────────────────────────────────────

do $$
declare ana uuid := '11111111-1111-1111-1111-111111111111';
begin
  reset role;
  -- One hit, the oldest, falls out of the hour. The other nineteen are still
  -- inside it, so exactly one more note is allowed — a fixed window that had
  -- rolled over would allow twenty.
  update private.direct_rate_limit set at = at - interval '61 minutes'
   where id = (select min(id) from private.direct_rate_limit
                where user_id = ana and bucket = 'feedback');

  perform pg_temp.become(ana);
  perform pg_temp.allowed('once the oldest hit is an hour old, one more is allowed',
    $q$select pg_temp.note('11111111-1111-1111-1111-111111111111')$q$);
  perform pg_temp.limited('and only one: the other nineteen are still inside the hour',
    $q$select pg_temp.note('11111111-1111-1111-1111-111111111111')$q$);

  reset role;
  perform pg_temp.check('the expired hit was swept by the call that passed it',
    (select count(*) from private.direct_rate_limit
      where user_id = ana and bucket = 'feedback' and at < now() - interval '1 hour') = 0, true);

  -- The whole hour passes.
  update private.direct_rate_limit set at = at - interval '61 minutes'
   where user_id = ana and bucket = 'feedback';
  perform pg_temp.become(ana);
  perform pg_temp.allowed('after an hour with nothing sent, a note is accepted again',
    $q$select pg_temp.note('11111111-1111-1111-1111-111111111111')$q$);

  reset role;
  perform pg_temp.check('and the log starts over at one',
    (select count(*) from private.direct_rate_limit
      where user_id = ana and bucket = 'feedback') = 1, true);
end $$;

-- ── Somebody else's leftovers are swept, a bounded handful at a time ──────

do $$
declare ben uuid := '22222222-2222-2222-2222-222222222222';
begin
  reset role;
  insert into private.direct_rate_limit (user_id, bucket, at)
  select ben, 'messages', now() - interval '2 days' from generate_series(1, 250);
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  perform pg_temp.note('11111111-1111-1111-1111-111111111111');
  reset role;
  perform pg_temp.check('one call sweeps two hundred day-old hits, not all of them',
    (select count(*) from private.direct_rate_limit
      where user_id = ben and at < now() - interval '1 day') = 50, true);
end $$;

-- ── The table is closed to every client role ──────────────────────────────

do $$
declare
  role_name text;
  priv text;
begin
  reset role;
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach priv in array array['select', 'insert', 'update', 'delete'] loop
      perform pg_temp.check(format('%s may not %s the limiter''s table', role_name, priv),
        has_table_privilege(role_name, 'private.direct_rate_limit', priv), false);
    end loop;
    perform pg_temp.check(format('%s may not call the limiter directly', role_name),
      has_function_privilege(role_name,
        'private.take_direct_rate_limit(uuid, uuid, text, integer, integer)', 'execute'), false);
  end loop;
  perform pg_temp.check('row-level security is on, as a second lock',
    (select relrowsecurity from pg_class where oid = 'private.direct_rate_limit'::regclass), true);
  perform pg_temp.check('and no policy opens it',
    exists (select 1 from pg_policies
             where schemaname = 'private' and tablename = 'direct_rate_limit'), false);
end $$;

-- Asked by behaviour as well as by catalogue: a signed-in user who wants to
-- clear their own count cannot.
do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');
  begin
    delete from private.direct_rate_limit;
    raise exception 'FAILED: a signed-in user deleted from the limiter''s table';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-in user cannot clear their own count';
  end;
  begin
    perform private.take_direct_rate_limit(
      '22222222-2222-2222-2222-222222222222', null, 'feedback', 1, 3600);
    raise exception 'FAILED: a signed-in user spent somebody else''s limit';
  exception when insufficient_privilege then
    raise notice 'ok  nor spend somebody else''s by calling the limiter';
  end;
end $$;

-- ── Not a browser, not limited ────────────────────────────────────────────

do $$
declare ana uuid := '11111111-1111-1111-1111-111111111111';
begin
  -- The service role, even carrying a subject — the role decides, not the sub.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', ana::text, 'role', 'service_role')::text, true);
  execute 'set local role service_role';
  for i in 1..30 loop perform pg_temp.note(ana); end loop;
  raise notice 'ok  the service role inserts thirty notes for a limited account';

  -- Postgres itself, with the last request's claims still set in the
  -- transaction: a cron job or a fixture must not be charged to whoever the
  -- claims happen to name.
  reset role;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', ana::text, 'role', 'authenticated')::text, true);
  for i in 1..30 loop perform pg_temp.note(ana); end loop;
  raise notice 'ok  postgres inserts thirty more, whatever the leftover claims say';

  perform pg_temp.check('and none of the sixty was counted against the account',
    (select count(*) from private.direct_rate_limit
      where user_id = ana and bucket = 'feedback') = 2, true);
end $$;

-- ── A security definer RPC is still the caller ────────────────────────────
--
-- Help requests, mentor requests, community posts and reports all reach their
-- tables through definer functions, where `current_user` is the owner. The
-- limit must still apply, and to the caller: that is why the trigger reads
-- the `role` setting and `auth.uid()` rather than `current_user`.

create or replace function pg_temp.note_through_definer()
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.feedback (author, kind, note, route, device)
  values (auth.uid(), 'idea', 'a note', '/today', 'phone');
end $$;

do $$
declare ben uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform pg_temp.become(ben);
  -- Ben has one note from the control above.
  for i in 1..19 loop perform pg_temp.note_through_definer(); end loop;
  raise notice 'ok  nineteen more through a definer function';
  perform pg_temp.limited('the twenty-first, through the definer function, is refused',
    $q$select pg_temp.note_through_definer()$q$);
end $$;

-- ── Signed out: per form, since there is no account ───────────────────────

do $$
declare
  ana uuid := '11111111-1111-1111-1111-111111111111';
  one uuid := 'f0000000-0000-0000-0000-000000000001';
  two uuid := 'f0000000-0000-0000-0000-000000000002';
begin
  reset role;
  insert into public.forms (id, owner, title) values (one, ana, 'One'), (two, ana, 'Two');

  perform pg_temp.become_anon();
  for i in 1..1000 loop
    insert into public.form_responses (form_id, answers) values (one, '{}');
  end loop;
  raise notice 'ok  a thousand signed-out answers to one form in an hour';
  perform pg_temp.limited('the thousand-and-first is refused',
    format($q$insert into public.form_responses (form_id, answers) values (%L, '{}')$q$, one));
  perform pg_temp.allowed('a different form still takes signed-out answers',
    format($q$insert into public.form_responses (form_id, answers) values (%L, '{}')$q$, two));
end $$;

-- Signed in, form answers count against the account, across forms.
do $$
declare
  ben uuid := '22222222-2222-2222-2222-222222222222';
  two uuid := 'f0000000-0000-0000-0000-000000000002';
begin
  perform pg_temp.become(ben);
  for i in 1..60 loop
    insert into public.form_responses (form_id, answers) values (two, '{}');
  end loop;
  raise notice 'ok  sixty signed-in answers in an hour';
  perform pg_temp.limited('the sixty-first from the same account is refused',
    format($q$insert into public.form_responses (form_id, answers) values (%L, '{}')$q$, two));
end $$;

-- ── Every table the migration names has its trigger ───────────────────────
--
-- The list is the migration's. A trigger dropped by a later migration, or a
-- table renamed out from under it, is a table that quietly stopped being
-- limited — this is where that shows.

do $$
declare
  want text[] := array[
    'communities', 'community_posts', 'community_reports', 'community_sessions',
    'feedback', 'form_responses', 'group_tasks', 'groups', 'help_requests',
    'mentor_requests', 'message_reactions', 'messages', 'opportunities', 'reports'];
  got text[];
begin
  reset role;
  select array_agg(c.relname::text order by c.relname) into got
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and t.tgname = 'zz_rate_limit'
     and t.tgenabled <> 'D'
     and t.tgfoid = 'private.direct_rate_limit_insert()'::regprocedure;
  if got is distinct from want then
    raise exception 'FAILED: rate-limited tables — expected %, got %', want, got;
  end if;
  raise notice 'ok  all % tables carry an enabled rate-limit trigger', cardinality(want);

  -- Each trigger's bucket is its own table's name, so two tables never share
  -- a count by a copy-paste slip.
  perform pg_temp.check('every trigger counts in its own table''s bucket',
    (select bool_and(encode(t.tgargs, 'escape') like c.relname || '\\000%')
       from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where t.tgname = 'zz_rate_limit'), true);
end $$;

rollback;
