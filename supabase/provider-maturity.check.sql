-- Raising a provider's maturity needs two approvers (F-1).
--
-- Claiming "incremental", "event-driven" or "write-back" about a connector is
-- a statement Semester makes to every school. Before 20261012060000 a
-- `platform:configure` holder made it alone with a direct INSERT or UPDATE.
--
--   * planned / manual / read_only rows are still written directly;
--   * a direct INSERT at a syncing level, or an UPDATE that raises a row to
--     one, is refused; a demotion and an edit at the same level still work;
--   * a request must come from a holder, name a registry row, name a syncing
--     level above the current one, and the row must have both owners;
--   * the row is raised by `console_act` after two approvals, and by nothing
--     else; the executor stamps `last_validated_at` and leaves a console
--     action record;
--   * THE CONTROL: with the guard trigger disabled the same direct raise goes
--     through, which is how this file was shown to be able to fail.
--
--   How to run it: supabase/check.sh provider-maturity

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

-- ── The people, the seats, the providers ──────────────────────────────────

do $$
declare
  eng uuid; sec uuid; prd uuid; stranger uuid;
  req uuid; n bigint; became text; stamped timestamptz; version text;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('pm-check', 'Provider maturity fixture', array['pm-check.example'], false);
  eng      := pg_temp.newuser('eng@pm-check.example', 'pm-check');
  sec      := pg_temp.newuser('sec@pm-check.example', 'pm-check');
  prd      := pg_temp.newuser('prd@pm-check.example', 'pm-check');
  stranger := pg_temp.newuser('stranger@pm-check.example', 'pm-check');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (eng, 'platform_admin', 'platform', '', 'platform'),
    (sec, 'platform_admin', 'platform', '', 'platform'),
    (prd, 'platform_admin', 'platform', '', 'platform');
  insert into public.council_seat_holder (seat, subject) values
    ('engineering', eng), ('security', sec), ('product', prd);

  -- Rows the fixture owns: one owned and planned, one already syncing, one
  -- with no owners.
  insert into public.provider_registry (id, name, maturity, connector_owner, support_owner) values
    ('acme', 'Acme SIS', 'read_only', 'integrations', 'support'),
    ('syncer', 'Syncer', 'planned', 'integrations', 'support'),
    ('orphan', 'Orphan', 'planned', '', '');
  insert into public.provider_registry (id, name, maturity, connector_owner, support_owner, last_validated_at) values
    ('wb', 'Write-back vendor', 'authorized_writeback', 'integrations', 'support', now()),
    ('mid', 'Event-driven vendor', 'event_driven', 'integrations', 'support', now());

  -- ── Low maturities stay direct ───────────────────────────────────────────
  perform pg_temp.went_through('a platform configurer adds a planned provider directly',
    pg_temp.attempt(eng, false,
      $q$insert into public.provider_registry (id, name) values ('newco', 'Newco')$q$));
  perform pg_temp.went_through('and raises a planned row to read_only directly',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'read_only', connector_owner = 'a', support_owner = 'b' where id = 'newco'$q$));

  -- ── The direct raise is refused ──────────────────────────────────────────
  perform pg_temp.refused_with('a direct UPDATE raising a row to incremental is refused — F-1',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'incremental', last_validated_at = now() where id = 'acme'$q$),
    'provider-maturity duty');
  perform pg_temp.refused_with('a direct INSERT at authorized_writeback is refused',
    pg_temp.attempt(eng, false,
      $q$insert into public.provider_registry (id, name, maturity, connector_owner, support_owner, last_validated_at)
         values ('sneak', 'Sneak', 'authorized_writeback', 'a', 'b', now())$q$),
    'provider-maturity duty');
  perform pg_temp.refused_with('raising a syncing row one rung higher is refused too',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'authorized_writeback' where id = 'syncer'$q$ ),
    'Raising a provider');  -- syncer is planned: the first step is already refused
  select count(*) into n from public.provider_registry where id = 'acme' and maturity = 'read_only';
  perform pg_temp.counted('and the row is unchanged', n, 1);

  -- ── Demoting and editing stay direct ─────────────────────────────────────
  perform pg_temp.went_through('editing a write-back row without changing its level works',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set name = 'Write-back vendor (renamed)' where id = 'wb'$q$));
  perform pg_temp.went_through('demoting a write-back row works',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'read_only' where id = 'wb'$q$));
  perform pg_temp.refused_with('and putting it straight back is refused',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'authorized_writeback' where id = 'wb'$q$),
    'provider-maturity duty');

  -- ── THE CONTROL: without the guard the direct raise goes through ─────────
  alter table public.provider_registry disable trigger provider_registry_maturity_guard;
  perform pg_temp.went_through('with the guard disabled the same direct raise succeeds — THE CONTROL',
    pg_temp.attempt(eng, false,
      $q$update public.provider_registry set maturity = 'authorized_writeback' where id = 'wb'$q$));
  alter table public.provider_registry enable trigger provider_registry_maturity_guard;
  update public.provider_registry set maturity = 'read_only' where id = 'wb';

  -- ── The request ──────────────────────────────────────────────────────────
  perform pg_temp.refused_with('an account with no platform:configure cannot ask',
    pg_temp.attempt(stranger, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'acme', '{"maturity":"incremental"}', 'run 1 green', 'PM-1')),
    'do not hold the party');
  perform pg_temp.refused_with('the target must be a registry row',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'nonesuch', '{"maturity":"incremental"}', 'run 1 green', 'PM-1')),
    'must be a provider in the registry');
  perform pg_temp.refused_with('read_only is not a syncing level',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'syncer', '{"maturity":"read_only"}', 'run 1 green', 'PM-1')),
    'must be incremental, event_driven or authorized_writeback');
  perform pg_temp.refused_with('the level must be higher than the current one',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'mid', '{"maturity":"incremental"}', 'run 1 green', 'PM-1')),
    'must be higher than');
  perform pg_temp.refused_with('a provider with no owners cannot be raised',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, null, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'orphan', '{"maturity":"incremental"}', 'run 1 green', 'PM-1')),
    'connector owner and a support owner');
  perform pg_temp.refused_with('a raise names no tenant',
    pg_temp.attempt(eng, false, format(
      'select public.request_approval(%L, %L, %L, %L::jsonb, %L, %L)',
      'provider-maturity', 'pm-check', 'acme', '{"maturity":"incremental"}', 'run 1 green', 'PM-1')),
    'names no tenant');

  perform pg_temp.become(eng);
  req := public.request_approval('provider-maturity', null, 'acme',
                                 '{"maturity":"incremental","compatibility_version":"2026.3"}'::jsonb,
                                 'Validation run 1 green against sandbox 2026.3; owners named in the registry', 'PM-1');
  perform pg_temp.nobody();
  select count(*) into n from public.provider_registry where id = 'acme' and maturity = 'read_only';
  perform pg_temp.counted('requesting does not raise the provider', n, 1);

  -- ── Two approvers, then the executor ─────────────────────────────────────
  perform pg_temp.refused_with('acting before approval is refused',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)), 'not approved');

  perform pg_temp.become_mfa(sec);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'pending' then raise exception 'FAILED: after one approval of a two-person duty the request is %', became; end if;
  raise notice 'ok  one approval of a two-person duty leaves it pending';

  perform pg_temp.become_mfa(prd);
  became := public.decide_approval(req, 'approve');
  perform pg_temp.nobody();
  if became <> 'approved' then raise exception 'FAILED: after two approvals the request is %', became; end if;
  raise notice 'ok  the second approval makes it approved';

  perform pg_temp.went_through('the requester acts on the approved raise',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)));
  select count(*) into n from public.provider_registry where id = 'acme' and maturity = 'incremental';
  perform pg_temp.counted('the provider is raised', n, 1);
  select last_validated_at, compatibility_version into stamped, version from public.provider_registry where id = 'acme';
  if stamped is null or version <> '2026.3' then
    raise exception 'FAILED: the executor should stamp last_validated_at and the compatibility version, got % / %', stamped, version;
  end if;
  raise notice 'ok  and it carries the validation stamp and the tested version';
  select count(*) into n from public.console_action_record where request_id = req and duty_id = 'provider-maturity';
  perform pg_temp.counted('and a console action record says who did it', n, 1);

  perform pg_temp.refused_with('the same approval cannot raise it twice',
    pg_temp.attempt(eng, true, format('select public.console_act(%L)', req)), 'not approved');

  raise notice 'provider maturity: every check passed';
end $$;

rollback;
