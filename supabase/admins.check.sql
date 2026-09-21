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
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('a signed-out visitor reads no admin rows', n, 0);

  perform pg_temp.become(person);
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('an ordinary account reads none', n, 0);

  perform pg_temp.become(admin);
  select count(*) into n from public.app_admins;
  perform pg_temp.counted('and an administrator cannot read their own row', n, 0);

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

  update public.app_admins set note = 'mine now';
  get diagnostics n = row_count;
  perform pg_temp.counted('nor edit the list', n, 0);

  delete from public.app_admins;
  get diagnostics n = row_count;
  perform pg_temp.counted('nor remove anybody from it', n, 0);

  perform pg_temp.become(admin);
  delete from public.app_admins;
  get diagnostics n = row_count;
  perform pg_temp.counted('and neither can an administrator', n, 0);

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
