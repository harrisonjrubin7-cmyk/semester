-- The admin list, and the account_role column that is deliberately not it.
--
-- Two things are being proved here and they are easy to confuse.
--
-- `profiles.account_role` is what an account *says* it is. It is chosen at
-- sign-up, it is writable by its owner, and it decides nothing about
-- authorization — it picks which dashboard the app draws. Every value it can
-- hold is a value anybody may give themselves.
--
-- `public.app_admins` is what an account *is*. It is written by the service
-- key and by nothing else, read by `private.is_app_admin()` and by nothing
-- else, and it is the only thing the administrator dashboard may be guarded
-- by. The distance between those two sentences is the whole file.
--
-- What this covers:
--
--   * `account_role` defaults to `student`, accepts `parent` and `mentor`, and
--     **refuses `admin`** — the value whose absence is the point.
--   * `app_admins` is readable by nobody through the API: not by a signed-out
--     visitor, not by an ordinary account, and **not by the administrator the
--     row is about**. Two separate things refuse it — the relation grant and
--     row-level security — and each is read with the other taken out of the
--     way, because a door with two locks is a door you cannot tell is
--     unlocked by trying the handle.
--   * It is writable by nobody, in all three senses, so there is no in-app
--     route to making yourself one.
--   * `is_app_admin()` lives in `private` and has no twin in `public`. That is
--     not tidiness: PostgREST publishes what `anon` or `authenticated` may
--     execute in `public`, so a copy there would be a URL answering "am I an
--     administrator" — and `grants.check.sql` would fail on it, which is the
--     belt to this file's braces.
--   * It answers true for an admin and false for everybody else, which is the
--     control. A guard that answers false for everyone protects everything and
--     is indistinguishable from a guard that is broken.
--
--   How to run it: supabase/check.sh admins

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

/**
 * A statement the current role must not be allowed to run at all.
 *
 * `pg_temp.counted(..., 0)` was the right assertion while a relation-level
 * revoke could not survive this harness: `check.sh` used to run
 * `grant all on all tables in schema public to anon, authenticated` *after* the
 * migrations, which handed back every privilege a migration had revoked, so the
 * only thing left to observe was row-level security returning no rows.
 *
 * That grant is gone — its own comment in `check.sh` says why, and
 * `local.stub.sql` now sets the table privileges as default privileges before
 * the migrations instead, the way Supabase does. A revoke therefore stands
 * where a suite can read it, which is what #596 set out to make possible.
 *
 * The consequence for this file: `20260921161500_roles.sql` revokes all on
 * `public.app_admins` from `anon` and `authenticated`, so counting that table
 * as either role no longer returns zero — it raises `insufficient_privilege`.
 * The schema is stricter than the assertion was, and the assertion has to catch
 * up rather than the schema loosen. "Cannot read it at all" is a stronger
 * statement than "reads no rows", and it is the one that is now true.
 *
 * Takes the statement as text because a helper cannot wrap an arbitrary one any
 * other way. `raise exception` with no condition name raises `raise_exception`,
 * not `insufficient_privilege`, so the failure path below cannot be swallowed
 * by its own handler.
 */
create or replace function pg_temp.refused(what text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: % — the statement was allowed', what;
exception
  when insufficient_privilege then
    raise notice 'ok  % (refused outright)', what;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
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

do $$
declare
  admin   uuid;
  person  uuid;
  n       bigint;
  role    text;
  says    boolean;
begin
  admin  := pg_temp.newuser('admin@example.com');
  person := pg_temp.newuser('person@vanderbilt.edu');

  -- ── account_role: a statement about yourself ────────────────────────────
  perform pg_temp.become(person);
  insert into public.profiles (user_id, handle) values (person, 'a-person');
  select account_role into role from public.profiles where user_id = person;
  perform pg_temp.said('a new profile is a student', role, 'student');

  update public.profiles set account_role = 'parent' where user_id = person;
  select account_role into role from public.profiles where user_id = person;
  perform pg_temp.said('and may say it is a parent', role, 'parent');

  update public.profiles set account_role = 'mentor' where user_id = person;
  select account_role into role from public.profiles where user_id = person;
  perform pg_temp.said('or a mentor', role, 'mentor');

  -- The value that is not on the list, and the reason the list exists.
  begin
    update public.profiles set account_role = 'admin' where user_id = person;
    raise exception 'FAILED: an account named itself an administrator';
  exception when check_violation then
    raise notice 'ok  but never an administrator';
  end;

  -- Nor by any other spelling.
  begin
    update public.profiles set account_role = 'app_admin' where user_id = person;
    raise exception 'FAILED: an account set an unlisted account_role';
  exception when check_violation then
    raise notice 'ok  and not by another spelling either';
  end;

  -- ── app_admins: a statement about you, by somebody else ─────────────────
  set local role postgres;
  insert into public.app_admins (user_id, note) values (admin, 'founder');

  -- Read by nobody. The third of these is the one worth having: an
  -- administrator reading their own row is the most natural policy to write
  -- and there is deliberately no policy at all.
  perform pg_temp.become_anon();
  perform pg_temp.refused('a signed-out visitor cannot read the admin list',
                          'select count(*) from public.app_admins');

  perform pg_temp.become(person);
  perform pg_temp.refused('nor can an ordinary account',
                          'select count(*) from public.app_admins');

  perform pg_temp.become(admin);
  perform pg_temp.refused('and neither can an administrator, about their own row',
                          'select count(*) from public.app_admins');

  -- The control: the row is really there. Without this, every count above is
  -- zero for the uninteresting reason and the suite proves nothing.
  set local role postgres;
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('while the row exists to the service key', n, 1);

  -- ── The second lock, read with the first one taken off ──────────────────
  --
  -- Everything above is the relation grant. Nothing above is row-level
  -- security — and the comment four paragraphs up, that an administrator
  -- reading their own row is the most natural policy to write and there is
  -- deliberately no policy at all, is the claim nothing now measures. Against
  -- `revoke all`, a self-read policy added tomorrow is refused before it is
  -- ever consulted, and this suite stays green. `a1d79e8` listed exactly that
  -- mutation among the ten it watched go red; it no longer goes red, and
  -- neither does switching row-level security off altogether.
  --
  -- So take the first lock off, on purpose, inside a transaction that rolls
  -- back, and read the second on its own.
  set local role postgres;
  grant select on public.app_admins to authenticated;

  perform pg_temp.become(admin);
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('granted the select, an administrator still reads no row of their own', n, 0);

  perform pg_temp.become(person);
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('and an ordinary account none', n, 0);

  -- The control for that pair, and the reason it is not two lines: a zero is
  -- also exactly what a grant that never took effect looks like. With
  -- row-level security switched off and nothing else changed, the same
  -- account reads the row — so the zeros above are the absence of a policy,
  -- and not the absence of a privilege.
  set local role postgres;
  alter table public.app_admins disable row level security;

  perform pg_temp.become(admin);
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('and reads it the moment row-level security is off', n, 1);

  set local role postgres;
  alter table public.app_admins enable row level security;
  revoke select on public.app_admins from authenticated;

  -- The structural half of the same sentence. The reads above cannot tell a
  -- missing policy from a policy that happens to match no row, and only one
  -- of those is the design.
  select count(*) into n
    from pg_policies where schemaname = 'public' and tablename = 'app_admins';
  perform pg_temp.counted('there is no policy on app_admins at all', n, 0);

  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'app_admins' and c.relrowsecurity;
  perform pg_temp.counted('and row-level security is on, so no policy means no row', n, 1);

  -- Written by nobody.
  perform pg_temp.become(person);
  begin
    insert into public.app_admins (user_id) values (person);
    raise exception 'FAILED: an account made itself an administrator';
  exception when insufficient_privilege then
    raise notice 'ok  an account cannot make itself an administrator';
  end;

  perform pg_temp.refused('nor edit the list',
                          $q$update public.app_admins set note = 'mine now'$q$);

  perform pg_temp.refused('nor remove anybody from it',
                          'delete from public.app_admins');

  perform pg_temp.become(admin);
  perform pg_temp.refused('and an administrator cannot remove anybody either',
                          'delete from public.app_admins');

  -- ── is_app_admin(), and where it lives ──────────────────────────────────
  perform pg_temp.become(admin);
  select private.is_app_admin() into says;
  perform pg_temp.said('is_app_admin is true for an administrator', says::text, 'true');

  perform pg_temp.become(person);
  select private.is_app_admin() into says;
  perform pg_temp.said('and false for an ordinary account', says::text, 'false');

  perform pg_temp.become_anon();
  select private.is_app_admin() into says;
  perform pg_temp.said('and false for a signed-out visitor', says::text, 'false');

  set local role postgres;
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname = 'is_app_admin' and ns.nspname = 'public';
  perform pg_temp.counted('there is no public.is_app_admin for PostgREST to publish', n, 0);

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname = 'is_app_admin' and ns.nspname = 'private';
  perform pg_temp.counted('and exactly one in private', n, 1);
end $$;

rollback;
