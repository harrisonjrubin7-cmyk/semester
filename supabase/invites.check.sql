-- The gate that decides whether an account can exist at all.
--
-- Every other check in this directory is about what a signed-in person may
-- read. This one is about whether they get to sign in, which makes it the only
-- suite here whose subject is `auth.users` rather than a table of ours.
--
-- What this covers:
--
--   * With the gate off, anybody can make an account. That is the default the
--     migration lands in, and it is checked first because a migration that
--     silently locked out every new sign-up the moment it was applied would be
--     the worst thing in this directory.
--   * With the gate on, an invited address gets in and an uninvited one is
--     refused — in the database, by a trigger, and not in a form that anybody
--     holding the publishable key can skip.
--   * The comparison is case-insensitive in both directions. A list that let
--     `Ada@` through while refusing `ada@` would look like it worked.
--   * The list of addresses is readable by nobody through the API — not by a
--     signed-out visitor and not by a signed-in account — and neither is the
--     switch. Both tables have RLS on and no policy at all.
--   * Turning the gate on does not evict anybody who already has an account.
--   * `set_invite_only` is not callable by the roles the app's key maps to.
--
-- ## What these checks are indifferent to, and why
--
-- Mutating the migration proves which line each check holds, and twelve were
-- run. Nine are caught: dropping the trigger, making the gate always let
-- through, landing the migration with the gate already on, removing either
-- `lower()` (both directions, separately), opening `invites` with a permissive
-- select policy, dropping the RLS on either table, and revoking
-- `set_invite_only` from the two role names instead of from `public`.
--
-- Three are deliberately not caught, and each is the accurate reading rather
-- than a hole:
--
--   **The `revoke all` on either table.** Row-level security is the gate; a
--   grant with no policy matching the row exposes nothing. The revokes are
--   defence in depth against a future blanket grant — `check.sh` itself
--   performs one, imitating Supabase's defaults — so the checks being
--   indifferent says correctly that it is the RLS that must not move.
--
--   **The column default on `invite_only`.** It is never the value that lands,
--   because the `insert` below it names one explicitly. Changing the default
--   changes nothing and the suite is right to shrug; changing the insert is
--   caught at once.
--
-- The one mutation that is caught and matters most is the last of the nine.
-- The first version of this migration revoked `set_invite_only` from `anon`
-- and `authenticated` by name, which reads as correct and is not: Postgres
-- grants EXECUTE to `PUBLIC` by default and both roles are members of it, so
-- the grant they actually inherit was untouched. A signed-out visitor holding
-- nothing but the publishable key could turn the gate off. That is the bug
-- this suite was worth writing for.
--
--   How to run it: supabase/check.sh invites

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
    raise exception 'FAILED: % — expected % row(s), got %', what, want, got;
  end if;
  raise notice 'ok  % (% rows)', what, got;
end $$;

/** Try to make an account; report whether the gate let it through. */
create or replace function pg_temp.joins(address text)
returns boolean language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', address, now(), now(), now());
  return true;
exception
  when check_violation then
    -- The gate's own refusal, which is the answer this function exists for.
    return false;
  when others then
    -- Anything else is a broken test rather than a working gate, and saying so
    -- is why this branch is separate: the first version returned false for
    -- every error, so a mistyped column name reported as "the gate refused an
    -- invited address" five times over.
    raise exception 'FAILED: joining broke for a reason that is not the gate: % (%)', sqlerrm, sqlstate;
end $$;

-- ── The gate is off when the migration lands ──────────────────────────────

do $$
declare gated boolean; got boolean;
begin
  select invite_only into gated from public.access_gate where only_one;
  if gated is not false then
    raise exception 'FAILED: the migration landed with invite-only already on';
  end if;
  raise notice 'ok  the gate is off until somebody turns it on';

  got := pg_temp.joins('gate.off.test@example.edu');
  if not got then
    raise exception 'FAILED: the gate was off and a sign-up was still refused';
  end if;
  raise notice 'ok  with the gate off, anybody can make an account';
end $$;

-- ── With it on, the list decides ──────────────────────────────────────────

do $$
declare got boolean;
begin
  perform public.set_invite_only(true);

  insert into public.invites (email, note) values ('invited.test@example.edu', 'pilot')
    on conflict (email) do nothing;

  got := pg_temp.joins('invited.test@example.edu');
  if not got then
    raise exception 'FAILED: somebody on the list was refused';
  end if;
  raise notice 'ok  an invited address gets in';

  got := pg_temp.joins('uninvited.test@example.edu');
  if got then
    raise exception 'FAILED: an uninvited address made an account';
  end if;
  raise notice 'ok  an uninvited address is refused, in the database';
end $$;

-- ── Case, in both directions ──────────────────────────────────────────────

do $$
declare got boolean;
begin
  -- Listed lower, typed upper.
  insert into public.invites (email) values ('lower.listed.test@example.edu')
    on conflict (email) do nothing;
  got := pg_temp.joins('Lower.Listed.TEST@example.edu');
  if not got then
    raise exception 'FAILED: a listed address was refused because of its case';
  end if;
  raise notice 'ok  a listed address gets in whatever case it is typed in';

  -- Listed upper, typed lower. The other direction, because one lower() call
  -- covers one of these and a suite testing only the first would pass with
  -- half the comparison gone.
  insert into public.invites (email) values ('UPPER.LISTED.TEST@example.edu')
    on conflict (email) do nothing;
  got := pg_temp.joins('upper.listed.test@example.edu');
  if not got then
    raise exception 'FAILED: an address listed in upper case could not be matched';
  end if;
  raise notice 'ok  and however it was written on the list';
end $$;

-- ── Nobody can read the list through the API ──────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become_anon();
  begin
    select count(*) into n from public.invites;
    perform pg_temp.counted('a signed-out visitor reads no invites', n, 0);
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out visitor cannot read the invite list (no grant)';
  end;
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become('eeeeeeee-0000-0000-0000-00000000f001');
  begin
    select count(*) into n from public.invites;
    perform pg_temp.counted('a signed-in account reads no invites', n, 0);
  exception when insufficient_privilege then
    raise notice 'ok  a signed-in account cannot read the invite list (no grant)';
  end;
end $$;

do $$
declare n bigint;
begin
  perform pg_temp.become_anon();
  begin
    select count(*) into n from public.access_gate;
    perform pg_temp.counted('a signed-out visitor reads no gate state', n, 0);
  exception when insufficient_privilege then
    raise notice 'ok  the switch is not readable either (no grant)';
  end;
end $$;

-- The control on all three above: the rows are genuinely there to be missed.
-- Without this, an empty table would pass every one of them.
do $$
declare n bigint;
begin
  reset role;
  select count(*) into n from public.invites;
  if n < 3 then
    raise exception 'FAILED: the invite list is empty, so the reads above proved nothing';
  end if;
  raise notice 'ok  and there were % invites there to be hidden', n;
end $$;

-- ── The switch is not the app's to flip ───────────────────────────────────

do $$
declare got boolean;
begin
  perform pg_temp.become_anon();
  begin
    perform public.set_invite_only(false);
    raise exception 'FAILED: a signed-out visitor turned the gate off';
  exception
    when insufficient_privilege then
      raise notice 'ok  a signed-out visitor cannot turn the gate off';
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
      raise notice 'ok  a signed-out visitor cannot turn the gate off (%)', sqlstate;
  end;
  reset role;
end $$;

-- ── Turning it on evicts nobody ───────────────────────────────────────────

do $$
declare n bigint;
begin
  reset role;
  -- The account made in the very first block, before the gate went on, and
  -- never invited.
  select count(*) into n from auth.users where email = 'gate.off.test@example.edu';
  perform pg_temp.counted('an account made before the gate survives it', n, 1);
end $$;

-- ── And the gate can be opened again ──────────────────────────────────────

do $$
declare got boolean;
begin
  reset role;
  perform public.set_invite_only(false);
  got := pg_temp.joins('after.the.pilot.test@example.edu');
  if not got then
    raise exception 'FAILED: the gate could not be opened again';
  end if;
  raise notice 'ok  the pilot can end';
end $$;

rollback;
