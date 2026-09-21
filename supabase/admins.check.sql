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
--     row is about**. RLS is on and there is no policy at all.
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

  -- ── the floor under the revoke, which nothing above can see ─────────────
  --
  -- Every `refused` in this file is the *grant* talking. The grant is checked
  -- before row-level security, so once `app_admins` is revoked from `anon` and
  -- `authenticated` the statement raises and RLS is never consulted — which
  -- means this file's second claim, "RLS is on and there is no policy at all",
  -- stopped being observable from any role the suite can become.
  --
  -- That is not hypothetical. Planting `create policy … for select using
  -- (true)` on this table leaves **every `refused` assertion above still
  -- passing**, because the grant stops the statement first. Two layers are
  -- claimed and only one was being checked.
  --
  -- So this one is read from the catalogue. It is what says the floor is
  -- still there if the revoke is ever loosened — the day somebody grants
  -- select back, the assertions above turn red, and these say whether there
  -- was anything underneath them.
  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'app_admins' and c.relrowsecurity;
  perform pg_temp.counted('row-level security is on for app_admins', n, 1);

  select count(*) into n
    from pg_policies where schemaname = 'public' and tablename = 'app_admins';
  perform pg_temp.counted('and there is no policy on it at all', n, 0);
end $$;

rollback;
