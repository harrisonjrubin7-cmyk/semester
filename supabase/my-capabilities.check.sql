-- Who the app is told holds which capability — `public.my_capabilities()`.
--
-- The function (20260928010000) answers one question for the caller only:
-- which (capability, scope) pairs do I hold right now? It must agree with
-- `private.has_capability`, the predicate every policy asks, or a screen will
-- offer something a policy then refuses — or hide something it would allow.
--
-- What this covers, as four accounts:
--
--   * A student with no grants is told nothing.
--   * A moderator is told **exactly** the moderator row of the matrix — no
--     more, no less. This is THE CONTROL: a function that told everybody
--     nothing would pass the three "is told nothing" cases below.
--   * An expired grant and a revoked grant both vanish, the two ways a grant
--     stops counting.
--   * Nobody is told about anybody else's grants.
--   * A signed-out visitor cannot ask.
--
--   How to run it: supabase/check.sh my-capabilities

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
  mod      uuid;
  lapsed   uuid;
  revoked  uuid;
  student  uuid;
  n        bigint;
  want     bigint;
begin
  mod     := pg_temp.newuser('mod@example.com');
  lapsed  := pg_temp.newuser('lapsed@example.com');
  revoked := pg_temp.newuser('revoked@example.com');
  student := pg_temp.newuser('student@vanderbilt.edu');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mod, 'moderator', 'platform', '', 'platform');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (lapsed, 'moderator', 'platform', '', 'platform', now() - interval '1 day');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (revoked, 'moderator', 'platform', '', 'platform', now() - interval '1 hour');

  select count(*) into want from public.role_capabilities where role = 'moderator';

  -- ── The control ─────────────────────────────────────────────────────────
  perform pg_temp.become(mod);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a moderator is told as many capabilities as the matrix gives moderator — THE CONTROL', n, want);
  select count(*) into n from public.my_capabilities() c
   where c.scope_kind = 'platform' and c.scope_id = ''
     and c.capability in (select capability from public.role_capabilities where role = 'moderator');
  perform pg_temp.counted('and they are exactly those, over the platform', n, want);
  select count(*) into n from public.my_capabilities() where capability = 'report:read';
  perform pg_temp.counted('including report:read, which the report queue gates on', n, 1);

  -- ── The ways a grant stops counting ─────────────────────────────────────
  perform pg_temp.become(lapsed);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('an expired grant tells its holder nothing', n, 0);

  perform pg_temp.become(revoked);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a revoked grant tells its holder nothing', n, 0);

  -- ── Nobody else's ───────────────────────────────────────────────────────
  perform pg_temp.become(student);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a student with no grants is told nothing — not the moderator''s', n, 0);

  -- ── Signed out ──────────────────────────────────────────────────────────
  perform pg_temp.become_anon();
  begin
    perform public.my_capabilities();
    raise exception 'FAILED: a signed-out visitor could ask for capabilities';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out visitor cannot ask';
  end;
end $$;

rollback;
