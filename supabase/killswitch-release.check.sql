-- Releasing a platform kill switch needs two approvers (F-1).
--
-- Engaging stays immediate; letting a PLATFORM-wide stop go does not. Before
-- 20261012040000 a `killswitch:engage` holder released it with a direct UPDATE.
--
--   * the direct UPDATE that would release a platform switch reaches no row;
--   * engaging, and re-reasoning an engaged platform switch, still work;
--   * a school-scope switch is still the school's own to release;
--   * a request must name an engaged platform switch and come from a holder;
--   * the switch is released by `console_act` after two approvals, and by
--     nothing else; the executor leaves a console action record;
--   * THE CONTROL: without the migration's policy the direct release goes
--     through, which is how this file was shown to be able to fail.
--
--   How to run it: supabase/check.sh killswitch-release

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

-- The same session with a second factor completed just now: what
-- `private.assert_fresh_mfa()` reads off the JWT.
create or replace function pg_temp.become_mfa(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
      'amr', json_build_array(json_build_object('method', 'totp',
               'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs one statement as `who`, with or without fresh MFA, and returns the
-- error message it drew — or null when it went through. A refusal is
-- asserted on its message, not on the fact of an exception, because "it
-- raised" is also what a typo in the statement looks like.
create or replace function pg_temp.attempt(who uuid, mfa boolean, statement text)
returns text language plpgsql as $$
begin
  if mfa then perform pg_temp.become_mfa(who); else perform pg_temp.become(who); end if;
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.refused_with(what text, got text, expected text)
returns void language plpgsql as $$
begin
  if got is null then
    raise exception 'FAILED: % — it went through', what;
  end if;
  if got not ilike '%' || expected || '%' then
    raise exception 'FAILED: % — refused, but for another reason: %', what, got;
  end if;
  raise notice 'ok  % ("%")', what, got;
end $$;

create or replace function pg_temp.went_through(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

create temp table ids (k text primary key, v text not null);
create or replace function pg_temp.remember(k text, v text) returns void language sql as
  $$ insert into ids values (k, v) on conflict (k) do update set v = excluded.v $$;
create or replace function pg_temp.who(k text) returns uuid language sql stable as
  $$ select v::uuid from ids where ids.k = who.k $$;
create or replace function pg_temp.what(k text) returns text language sql stable as
  $$ select v from ids where ids.k = what.k $$;

-- ── The people, the seats, the tenants ────────────────────────────────────

do $$
declare
  eng uuid; sec uuid; fnd uuid; stranger uuid; uadmin uuid;
  req uuid; n bigint; became text;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('ksr-check', 'Kill switch fixture', array['ksr-check.example'], false);
  eng      := pg_temp.newuser('eng@ksr-check.example', 'ksr-check');
  sec      := pg_temp.newuser('sec@ksr-check.example', 'ksr-check');
  fnd      := pg_temp.newuser('fnd@ksr-check.example', 'ksr-check');
  stranger := pg_temp.newuser('stranger@ksr-check.example', 'ksr-check');
  uadmin   := pg_temp.newuser('uadmin@ksr-check.example', 'ksr-check');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (eng, 'incident_responder', 'platform', '', 'platform'),
    (uadmin, 'university_admin', 'school', 'ksr-check', 'institution'),
    (sec, 'platform_admin', 'platform', '', 'platform'),
    (fnd, 'platform_admin', 'platform', '', 'platform');
  insert into public.council_seat_holder (seat, subject) values
    ('engineering', eng), ('security', sec), ('founder', fnd);

  -- ── Engaging is immediate and direct, platform and school scope ──────────
  perform pg_temp.become(eng);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values (null, 'kill.sharing', true, 'incident INC-1', now());
  perform pg_temp.become(uadmin);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('ksr-check', 'kill.sharing', true, 'school incident', now());
  perform pg_temp.nobody();
  select count(*) into n from public.feature_kill_switch where switch_key = 'kill.sharing' and engaged;
  perform pg_temp.counted('an incident responder engages a platform switch and a school administrator a school switch, directly', n, 2);

  -- ── The direct release reaches nothing, or is refused ────────────────────
  perform pg_temp.become(eng);
  begin
    update public.feature_kill_switch set engaged = false where tenant_id is null and switch_key = 'kill.sharing';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  perform pg_temp.nobody();
  perform pg_temp.counted('a direct UPDATE releasing the platform switch reaches no row — F-1 — THE CONTROL', n, 0);
  select count(*) into n from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.sharing' and engaged;
  perform pg_temp.counted('and the platform switch is still engaged', n, 1);

  perform pg_temp.become(eng);
  update public.feature_kill_switch set reason = 'INC-1, widened' where tenant_id is null and switch_key = 'kill.sharing';
  get diagnostics n = row_count;
  perform pg_temp.nobody();
  perform pg_temp.counted('re-reasoning an engaged platform switch still works', n, 1);

  perform pg_temp.become(uadmin);
  update public.feature_kill_switch set engaged = false where tenant_id = 'ksr-check' and switch_key = 'kill.sharing';
  get diagnostics n = row_count;
  perform pg_temp.nobody();
  perform pg_temp.counted('a school-scope switch is still released directly', n, 1);

  -- ── The request ──────────────────────────────────────────────────────────
  perform pg_temp.refused_with('an account with no killswitch:engage cannot ask',
    pg_temp.attempt(stranger, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'killswitch-release', 'kill.sharing', '{}', 'INC-1 closed', 'INC-1')),
    'do not hold the party');
  perform pg_temp.refused_with('a switch that is not engaged cannot be the target',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'killswitch-release', 'kill.writeback', '{}', 'INC-1 closed', 'INC-1')),
    'must be a platform kill switch that is engaged');
  perform pg_temp.refused_with('a release names no tenant',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'killswitch-release', 'ksr-check', 'kill.sharing', '{}', 'INC-1 closed', 'INC-1')),
    'names no tenant');

  perform pg_temp.become(eng);
  req := public.request_approval('killswitch-release', null, 'kill.sharing', '{}'::jsonb,
                                 'INC-1 closed: root cause fixed in PR 1; re-engage plan in the runbook', 'INC-1');
  perform pg_temp.nobody();
  select count(*) into n from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.sharing' and engaged;
  perform pg_temp.counted('requesting does not release the switch', n, 1);

  -- ── Two approvers, then the executor ─────────────────────────────────────
  perform pg_temp.refused_with('acting before approval is refused',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)), 'not approved');

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'pending' then raise exception 'FAILED: after one approval of a two-person duty the request is %', became; end if;
  raise notice 'ok  one approval of a two-person duty leaves it pending';
  select count(*) into n from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.sharing' and engaged;
  perform pg_temp.counted('and the switch is still engaged', n, 1);

  perform pg_temp.become_mfa(fnd);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'approved' then raise exception 'FAILED: after two approvals the request is %', became; end if;
  raise notice 'ok  the second approval makes it approved';

  perform pg_temp.went_through('the requester acts on the approved release',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)));
  select count(*) into n from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.sharing' and not engaged;
  perform pg_temp.counted('the platform switch is released', n, 1);
  select count(*) into n from public.console_action_record where request_id = req and duty_id = 'killswitch-release';
  perform pg_temp.counted('and a console action record says who did it', n, 1);

  perform pg_temp.refused_with('the same approval cannot release it twice',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)), 'not approved');

  raise notice 'killswitch release: every check passed';
end $$;

rollback;
