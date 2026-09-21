-- What a student said was wrong, and what the database refuses to keep.
--
-- `public.feedback` exists so that "something is broken" does not have to be
-- an email. The app supplies the context — which screen, which device class,
-- which build — because a person who has just hit a bug should not have to.
--
-- ## The half this file is actually for
--
-- Most of this directory asks who may read whose rows, and there is some of
-- that below. But the interesting risk here is not a leak between accounts: it
-- is the app writing something into a report that the student never meant to
-- send, and nobody noticing because the field is called `route` and looks
-- harmless.
--
-- `app/src/lib/feedback.ts` reduces a route to a shape — `/course/:id`, never
-- `/course/greek-orthodox-theology-seminar` — and its own tests hold it to
-- that across a dozen hostile inputs. Those tests prove the client is careful
-- today. They prove nothing about the next caller.
--
-- So the constraints are the rule and this file is what says so. Every check
-- below that tries to write a raw route, a user-agent or an unlisted kind is
-- asking the same question: **is this a property of the database, or a promise
-- about a function?** `access_log` asked it first and answered it the same
-- way.
--
--   How to run it: supabase/check.sh feedback

begin;

-- ── Two people ────────────────────────────────────────────────────────────

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

create or replace function pg_temp.check(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  %', what;
end $$;

/**
 * Whether a write is refused.
 *
 * Every constraint check below is "this must not be storable", and the way to
 * ask that is to try it and expect to be thrown out. A check that merely
 * asserted the constraint *exists* would pass on a constraint that matches
 * nothing.
 */
create or replace function pg_temp.refused(what text, sql text)
returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok  %', what;
    return;
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

-- ── The route is a shape, and the column is what makes that true ──────────

do $$
declare ana uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform pg_temp.become(ana);

  perform pg_temp.allowed('a screen alone is a route shape',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a', '/today', 'phone')$q$);

  perform pg_temp.allowed('a screen with an id standing in for the rest',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a', '/course/:id', 'phone')$q$);

  perform pg_temp.allowed('the shape for a route it could not read',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a', '/other', 'phone')$q$);

  -- The whole reason this table has a regex on a text column. A course id is
  -- whatever the syllabus was called, and this is the write that would carry
  -- one.
  perform pg_temp.refused('a real course id cannot be stored as a route',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a',
               '/course/greek-orthodox-theology-seminar', 'phone')$q$);

  perform pg_temp.refused('a query string cannot be stored as a route',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a',
               '/classmates?room=vanderbilt/ECON 1020', 'phone')$q$);

  perform pg_temp.refused('a full address cannot be stored as a route',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a',
               'https://example.com/semester/#/today', 'phone')$q$);

  perform pg_temp.refused('a second id cannot be smuggled past the first',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a',
               '/course/:id/econ', 'phone')$q$);
end $$;

-- ── The device is a class, never a fingerprint ────────────────────────────

do $$
begin
  perform pg_temp.become('11111111-1111-1111-1111-111111111111');

  perform pg_temp.refused('a user-agent cannot be stored as a device',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a', '/today',
               'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')$q$);

  perform pg_temp.refused('an unlisted kind cannot be stored',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'urgent', 'a', '/today', 'phone')$q$);

  perform pg_temp.refused('an empty note cannot be stored',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', '   ', '/today', 'phone')$q$);

  perform pg_temp.refused('a note past the column cannot be stored',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', repeat('x', 2001),
               '/today', 'phone')$q$);

  perform pg_temp.refused('the version field cannot become somewhere to put something else',
    $q$insert into public.feedback (author, kind, note, route, device, version)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'a', '/today', 'phone',
               repeat('y', 41))$q$);
end $$;

-- ── Whose report is whose ─────────────────────────────────────────────────

do $$
declare
  ana uuid := '11111111-1111-1111-1111-111111111111';
  ben uuid := '22222222-2222-2222-2222-222222222222';
  seen bigint;
begin
  perform pg_temp.become(ben);

  perform pg_temp.refused('you cannot send feedback as somebody else',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('11111111-1111-1111-1111-111111111111', 'bug', 'not mine', '/today', 'phone')$q$);

  perform pg_temp.allowed('you can send feedback as yourself',
    $q$insert into public.feedback (author, kind, note, route, device)
       values ('22222222-2222-2222-2222-222222222222', 'confusing', 'bens', '/grades', 'desktop')$q$);

  select count(*) into seen from public.feedback;
  -- Ana wrote three above; Ben must see only his own.
  perform pg_temp.check('you read your own reports and nobody else''s', seen = 1, true);

  perform pg_temp.become(ana);
  select count(*) into seen from public.feedback;
  perform pg_temp.check('and the other account reads only theirs', seen = 3, true);
end $$;

-- ── What the API may do at all ────────────────────────────────────────────

do $$
begin
  reset role;

  perform pg_temp.check('row-level security is on',
    (select relrowsecurity from pg_class where oid = 'public.feedback'::regclass), true);

  perform pg_temp.check('a signed-out visitor cannot read feedback',
    has_table_privilege('anon', 'public.feedback', 'select'), false);
  perform pg_temp.check('a signed-out visitor cannot write feedback',
    has_table_privilege('anon', 'public.feedback', 'insert'), false);

  perform pg_temp.check('a signed-in account may insert',
    has_table_privilege('authenticated', 'public.feedback', 'insert'), true);
  perform pg_temp.check('a signed-in account may select',
    has_table_privilege('authenticated', 'public.feedback', 'select'), true);
  perform pg_temp.check('a signed-in account may delete, so account deletion clears it',
    has_table_privilege('authenticated', 'public.feedback', 'delete'), true);

  -- A report is a thing that was said at a moment. There is no update policy
  -- and no update grant, so it cannot be rewritten after the fact.
  perform pg_temp.check('nobody may rewrite a report through the API',
    has_table_privilege('authenticated', 'public.feedback', 'update'), false);

  perform pg_temp.check('no update policy exists either',
    exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'feedback' and cmd = 'UPDATE'), false);

  -- The control for the three privilege checks above: they all pass on a
  -- table that does not exist, because `has_table_privilege` would have
  -- thrown — but a typo'd name in a `select 1 from pg_policies` would not.
  perform pg_temp.check('and the policies this file is about are really there',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'feedback') = 3, true);
end $$;

rollback;
