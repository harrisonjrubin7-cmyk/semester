-- Where a student is signed in (stream 02): `my_sessions()` lists the caller's
-- own live sessions and `end_my_session()` ends one of them. Every refusal is
-- attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh my-sessions

begin;

-- GoTrue's table is not in the disposable database. Only what the functions
-- read is here, with the real column names (read from production on
-- 6 October 2026).
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet
);

create or replace function pg_temp.become(who uuid, session uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'session_id', session::text)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.listed(who uuid, session uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who, session);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.ended(who uuid, session uuid, target uuid)
returns text language plpgsql as $$
declare r boolean;
begin
  perform pg_temp.become(who, session);
  r := public.end_my_session(target);
  execute 'reset role';
  return r::text;
exception when others then
  execute 'reset role';
  return 'refused: ' || sqlerrm;
end $$;

create or replace function pg_temp.sessions_left(who uuid)
returns bigint language sql as $$ select count(*) from auth.sessions where user_id = who $$;

do $$
declare
  sam uuid; robin uuid;
  here uuid := gen_random_uuid(); phone uuid := gen_random_uuid(); lapsed uuid := gen_random_uuid();
  robins uuid := gen_random_uuid();
  got text;
begin
  sam   := pg_temp.newuser('sam@sessions.example');
  robin := pg_temp.newuser('robin@sessions.example');

  insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, not_after) values
    (here,   sam,   now() - interval '2 days', now() - interval '1 hour',  (now() at time zone 'UTC') - interval '1 hour', 'Mozilla/5.0 (Macintosh) Chrome/130', null),
    (phone,  sam,   now() - interval '5 days', now() - interval '3 days',  null,                                           'Mozilla/5.0 (iPhone) Safari/604', now() + interval '1 day'),
    (lapsed, sam,   now() - interval '9 days', now() - interval '9 days',  null,                                           'Mozilla/5.0 (X11) Firefox/128', now() - interval '1 day'),
    (robins, robin, now() - interval '1 day',  now() - interval '1 day',   null,                                           'Mozilla/5.0 (Windows) Edge/130', null);

  -- Listing -----------------------------------------------------------------
  perform pg_temp.counted('Sam lists their two live sessions, not the expired one',
    pg_temp.listed(sam, here, 'select * from public.my_sessions()'), 2);
  perform pg_temp.counted('exactly one of them is marked as the one asking',
    pg_temp.listed(sam, here, 'select * from public.my_sessions() where is_current'), 1);
  perform pg_temp.counted('the marked one is the session in the token',
    pg_temp.listed(sam, here, 'select * from public.my_sessions() where is_current and id = ''' || here || ''''), 1);
  perform pg_temp.counted('with no session id in the token, none is marked',
    pg_temp.listed(sam, null, 'select * from public.my_sessions() where is_current'), 0);
  perform pg_temp.counted('Robin lists only their own one',
    pg_temp.listed(robin, robins, 'select * from public.my_sessions()'), 1);
  perform pg_temp.counted('CROSS-USER: nothing in Sam''s list is Robin''s',
    pg_temp.listed(sam, here, 'select * from public.my_sessions() where id = ''' || robins || ''''), 0);

  -- A refusal -----------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    execute 'set local role anon';
    perform * from public.my_sessions();
    raise exception 'FAILED: anon could list sessions';
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  the anon role cannot call my_sessions()';
  end;
  begin
    execute 'set local role anon';
    perform public.end_my_session(phone);
    raise exception 'FAILED: anon could end a session';
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  the anon role cannot call end_my_session()';
  end;

  -- Ending ----------------------------------------------------------------------
  got := pg_temp.ended(sam, here, robins);
  if got <> 'false' then raise exception 'FAILED: CROSS-USER: Sam ended Robin''s session (%)', got; end if;
  perform pg_temp.counted('CROSS-USER: Robin''s session is still there', pg_temp.sessions_left(robin), 1);
  raise notice 'ok  somebody else''s session reads as no such session';

  got := pg_temp.ended(sam, here, here);
  if got not like 'refused:%' then raise exception 'FAILED: Sam ended the session they are using (%)', got; end if;
  perform pg_temp.counted('the session in use is refused and kept', pg_temp.sessions_left(sam), 3);

  got := pg_temp.ended(sam, here, gen_random_uuid());
  if got <> 'false' then raise exception 'FAILED: a made-up id was reported ended (%)', got; end if;
  raise notice 'ok  an id that is nobody''s reads as no such session';

  got := pg_temp.ended(sam, here, phone);
  if got <> 'true' then raise exception 'FAILED: control: Sam could not end their own phone (%)', got; end if;
  perform pg_temp.counted('control: Sam''s phone session is gone', pg_temp.sessions_left(sam), 2);
  perform pg_temp.counted('and Sam lists one live session now',
    pg_temp.listed(sam, here, 'select * from public.my_sessions()'), 1);
  perform pg_temp.counted('Robin is unaffected by any of it', pg_temp.sessions_left(robin), 1);

  got := pg_temp.ended(sam, here, phone);
  if got <> 'false' then raise exception 'FAILED: ending it twice should say no such session (%)', got; end if;
  raise notice 'ok  ending it twice reads as no such session';

  -- Signed out ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    execute 'set local role authenticated';
    perform * from public.my_sessions();
    raise exception 'FAILED: a token with no subject could list sessions';
  exception when sqlstate '28000' then
    execute 'reset role';
    raise notice 'ok  a token with no subject is refused';
  end;
end $$;

rollback;
