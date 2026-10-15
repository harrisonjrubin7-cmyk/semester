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
--   * An open break-glass grant is told as the school-scope capabilities it
--     confers — the same ones `private.has_capability` honours — and a closed
--     or lapsed grant is told nothing. A function that left break-glass out
--     would offer the responder nothing while every policy allowed them.
--   * Nobody is told about anybody else's grants.
--   * A signed-out visitor cannot ask.
--
--   How to run it: supabase/check.sh my-capabilities

begin;

create or replace function pg_temp.become(who uuid, assurance text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated', 'aal', assurance)::text,
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
  admin    uuid;
  lapsed   uuid;
  revoked  uuid;
  student  uuid;
  glass    uuid;
  shut     uuid;
  spent    uuid;
  req      uuid;
  n        bigint;
  want     bigint;
  admin_want bigint;
begin
  mod     := pg_temp.newuser('mod@example.com');
  admin   := pg_temp.newuser('admin@example.com');
  lapsed  := pg_temp.newuser('lapsed@example.com');
  revoked := pg_temp.newuser('revoked@example.com');
  student := pg_temp.newuser('student@vanderbilt.edu');
  glass   := pg_temp.newuser('glass@example.com');
  shut    := pg_temp.newuser('shut@example.com');
  spent   := pg_temp.newuser('spent@example.com');

  insert into public.schools (id, name, email_domains, is_demo)
  values ('mycap-glass-school', 'Break-glass fixture', array['mycap-glass.example'], false);
  insert into public.approval_request (duty_id, requester, tenant_id, evidence, ticket)
  values ('break-glass', glass, 'mycap-glass-school', 'fixture', 'BG-1')
  returning id into req;
  -- One open grant (two capabilities), one closed, one past its expiry (opened
  -- long enough ago for the four-hour rule to hold). Written as operations
  -- would, not through the function: this check is about what is *told*.
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due)
  values (req, glass, 'mycap-glass-school', 'BG-1', 'tenant:configure report:read',
          now() + interval '2 hours', now() + interval '1 day');
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, expires_at, review_due, closed_at)
  values (req, shut, 'mycap-glass-school', 'BG-2', 'tenant:configure',
          now() + interval '2 hours', now() + interval '1 day', now());
  insert into public.break_glass_grant (request_id, subject, tenant_id, ticket, scope, opened_at, expires_at, review_due)
  values (req, spent, 'mycap-glass-school', 'BG-3', 'tenant:configure',
          now() - interval '3 days', now() - interval '3 days' + interval '2 hours', now() - interval '1 day');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mod, 'moderator', 'platform', '', 'platform'),
    (admin, 'platform_admin', 'platform', '', 'platform');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (lapsed, 'moderator', 'platform', '', 'platform', now() - interval '1 day');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (revoked, 'moderator', 'platform', '', 'platform', now() - interval '1 hour');

  select count(*) into want from public.role_capabilities where role = 'moderator';
  select count(*) into admin_want from public.role_capabilities where role = 'platform_admin';

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

  perform pg_temp.become(admin, 'aal1');
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('an aal1 platform_admin is told none of its dormant capabilities', n, 0);
  perform pg_temp.counted('and private.has_capability refuses the same dormant grant',
    (private.has_capability('platform:configure'))::int, 0);
  perform pg_temp.become(admin, 'aal2');
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('an aal2 platform_admin is told exactly its matrix capabilities', n, admin_want);
  perform pg_temp.counted('and private.has_capability honours the same elevated grant',
    (private.has_capability('platform:configure'))::int, 1);

  -- ── The ways a grant stops counting ─────────────────────────────────────
  perform pg_temp.become(lapsed);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('an expired grant tells its holder nothing', n, 0);

  perform pg_temp.become(revoked);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a revoked grant tells its holder nothing', n, 0);

  -- ── Break-glass ─────────────────────────────────────────────────────────
  perform pg_temp.become(glass);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('an open break-glass grant is told as its two capabilities — THE CONTROL for this block', n, 2);
  select count(*) into n from public.my_capabilities()
   where scope_kind = 'school' and scope_id = 'mycap-glass-school'
     and capability in ('tenant:configure', 'report:read');
  perform pg_temp.counted('and they are over exactly the school the grant names', n, 2);
  select count(*) into n from public.my_capabilities() where scope_kind = 'platform';
  perform pg_temp.counted('and nothing over the platform: break-glass widens who, never where', n, 0);
  select count(*) into n from public.my_capabilities() c
   where private.has_capability(c.capability, c.scope_kind, c.scope_id);
  perform pg_temp.counted('every row told is one private.has_capability honours — the two never disagree', n, 2);
  select count(*) into n
    from unnest(array['tenant:configure', 'report:read']) cap
   where private.has_capability(cap, 'school', 'mycap-glass-school')
     and not exists (select 1 from public.my_capabilities() c
                      where c.capability = cap and c.scope_kind = 'school'
                        and c.scope_id = 'mycap-glass-school');
  perform pg_temp.counted('and none it honours is left untold', n, 0);

  perform pg_temp.become(shut);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a closed break-glass grant tells its holder nothing', n, 0);
  perform pg_temp.counted('and private.has_capability does not honour a closed grant either',
    (private.has_capability('tenant:configure', 'school', 'mycap-glass-school'))::int, 0);

  perform pg_temp.become(spent);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('a lapsed break-glass grant tells its holder nothing', n, 0);
  -- Expiry removes access on its own: the grant was never closed, and nothing
  -- rewrites it when its window ends, so only the predicate stops it counting.
  perform pg_temp.counted('and private.has_capability does not honour a grant past its expiry, though it was never closed — T-04',
    (private.has_capability('tenant:configure', 'school', 'mycap-glass-school'))::int, 0);

  -- The control for those two: the open grant is honoured by the same predicate.
  perform pg_temp.become(glass);
  perform pg_temp.counted('while private.has_capability honours the open grant — THE CONTROL for the two cases above',
    (private.has_capability('tenant:configure', 'school', 'mycap-glass-school'))::int, 1);

  perform pg_temp.become(student);
  select count(*) into n from public.my_capabilities();
  perform pg_temp.counted('nobody else is told about the responder''s grant', n, 0);

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
