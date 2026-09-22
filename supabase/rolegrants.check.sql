-- The role grants, and the two locks that make them mean something.
--
-- `public.role_grants` is what an account *is* allowed to do, for the nineteen
-- roles that are not `student`. `profiles.account_role` is what an account
-- *says* it is, and `admins.check.sql` is the file about that distinction.
-- This one is about the half that grants something, and everything below
-- follows from one sentence: a permission its subject can write is not a
-- permission.
--
-- What this covers:
--
--   * The vocabulary refuses what is not on it — including `admin`, the value
--     `account_role` also refuses, for the same reason and in a different way.
--   * A platform role is scoped to nothing and every other role is scoped to
--     something, refused in both directions, because half of that equivalence
--     is nonsense that would type-check.
--   * A person reads their own grants and **nobody else's**, and a signed-out
--     visitor reads none — with the control that the reads work at all, since
--     a zero is also what a broken query looks like.
--   * It is writable by nobody, in all three verbs, and **each lock is read
--     with the other taken out of the way**: a door with two locks is a door
--     you cannot tell is unlocked by trying the handle. The two locks do not
--     behave alike, which is the thing worth knowing here — the relation
--     revoke refuses outright, while row-level security lets the update and
--     the delete run and match nothing. Only the insert raises.
--   * `private.holds_role()` answers true for a live grant and false for a
--     revoked one, an expired one, the wrong scope, the wrong kind, a role not
--     held, and **the same question asked by somebody else**. The true is the
--     control: a predicate that answers false for everyone protects everything
--     and is indistinguishable from one that is broken.
--   * It lives in `private` and has no twin in `public`, for the reason
--     `is_app_admin()` does — PostgREST publishes what clients may execute in
--     `public`, so a copy there would be a URL answering "is this person a
--     moderator".
--
--   How to run it: supabase/check.sh rolegrants

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

create or replace function pg_temp.answered(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

/**
 * A statement the current role must not be allowed to run at all.
 *
 * Both a missing relation privilege and a row-level security refusal raise
 * `insufficient_privilege` (42501), which is what lets one helper read both
 * locks. `raise exception` with no condition name raises `raise_exception`
 * rather than `insufficient_privilege`, so the failure path cannot be
 * swallowed by its own handler.
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

/** A statement the *schema* must refuse, whoever runs it. */
create or replace function pg_temp.invalid(what text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: % — the row was accepted', what;
exception
  when check_violation or unique_violation or not_null_violation then
    raise notice 'ok  % (rejected)', what;
end $$;

/**
 * A statement the current role may run, that must change nothing.
 *
 * This is the assertion row-level security actually supports for UPDATE and
 * DELETE, and getting it wrong is how this file was first written. With no
 * policy for those verbs, Postgres does not raise: the rows simply do not
 * match, the statement succeeds, and `ROW_COUNT` is zero. Only INSERT raises
 * `insufficient_privilege`, because there is a row to check and no policy that
 * permits it.
 *
 * So the two locks on this table refuse in two different ways, and a reader
 * who assumes otherwise will write a policy test that passes for the wrong
 * reason. The relation revoke refuses outright. Row-level security makes the
 * write match nothing. Both close the door; only one of them slams.
 */
create or replace function pg_temp.untouched(what text, stmt text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAILED: % — it changed % row(s)', what, n;
  end if;
  raise notice 'ok  % (ran, changed nothing)', what;
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
  officer uuid;
  other   uuid;
  n       bigint;
  answer  boolean;
begin
  officer := pg_temp.newuser('officer@rolegrants.test');
  other   := pg_temp.newuser('other@rolegrants.test');

  -- ── The vocabulary, and the shape of a scope ────────────────────────────

  perform pg_temp.invalid(
    'a role that is not on the list is refused',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'wizard', 'platform', '', 'platform')$f$, officer));

  -- The parallel worth having: `account_role` refuses `admin` because an
  -- account that could name itself an administrator is one. This refuses it
  -- too, for a different reason — the role that means it here is
  -- `platform_admin`, and a near-miss spelling that silently inserted would be
  -- a grant no predicate ever matches.
  perform pg_temp.invalid(
    'and so is `admin`, which is spelled platform_admin here',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'admin', 'platform', '', 'platform')$f$, officer));

  perform pg_temp.invalid(
    'a platform role carrying a scope id is refused',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'platform_admin', 'platform', 'finance-club', 'platform')$f$, officer));

  perform pg_temp.invalid(
    'and a scoped role carrying none is refused too',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'organization_admin', 'organization', '', 'platform')$f$, officer));

  perform pg_temp.invalid(
    'an unknown scope kind is refused',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'faculty', 'galaxy', 'milky-way', 'institution')$f$, officer));

  perform pg_temp.invalid(
    'and a provenance nobody vouches for',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'tutor', 'course', 'vanderbilt/ECON 1020', 'vibes')$f$, officer));

  -- ── The rows the rest of the file reads ────────────────────────────────

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (officer, 'organization_officer', 'organization', 'finance-club', 'self');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at)
  values (officer, 'organization_admin', 'organization', 'finance-club', 'platform', now());

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at)
  values (officer, 'teaching_assistant', 'course', 'vanderbilt/ECON 1020', 'institution',
          now() - interval '1 day');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (other, 'organization_officer', 'organization', 'consulting-club', 'self');

  perform pg_temp.invalid(
    'the same role over the same scope twice is refused',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'organization_officer', 'organization', 'finance-club', 'platform')$f$,
           officer));

  -- ── Reading ────────────────────────────────────────────────────────────

  perform pg_temp.become(officer);
  select count(*) into n from public.role_grants;
  -- Three of the four rows are theirs, revoked and expired included: the
  -- policy is about whose row it is, and liveness is the predicate's job. A
  -- person who cannot see that a grant was revoked cannot be told why a
  -- workspace disappeared.
  perform pg_temp.counted('a person reads their own three grants', n, 3);

  select count(*) into n from public.role_grants where subject <> officer;
  perform pg_temp.counted('and none of anybody else''s', n, 0);

  perform pg_temp.become(other);
  select count(*) into n from public.role_grants;
  perform pg_temp.counted('the other account reads only its own one', n, 1);

  perform pg_temp.become_anon();
  perform pg_temp.refused('a signed-out visitor cannot read the table at all',
                          'select count(*) from public.role_grants');

  -- The control for those three. A zero is also what a query against the wrong
  -- table looks like, so with row-level security off and nothing else changed
  -- the same account reads every row — which says the numbers above are the
  -- policy, not an accident.
  set local role postgres;
  alter table public.role_grants disable row level security;

  perform pg_temp.become(officer);
  select count(*) into n from public.role_grants;
  perform pg_temp.counted('and reads all four the moment row-level security is off', n, 4);

  set local role postgres;
  alter table public.role_grants enable row level security;

  -- ── Writing: the outer lock ────────────────────────────────────────────

  perform pg_temp.become(officer);
  perform pg_temp.refused('a person cannot grant themselves a role',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'platform_admin', 'platform', '', 'self')$f$, officer));
  perform pg_temp.refused('nor promote the grant they already hold',
    $f$update public.role_grants set role = 'organization_admin'$f$);
  perform pg_temp.refused('nor delete one that was revoked',
    $f$delete from public.role_grants$f$);

  -- ── Writing: the inner lock, with the outer one taken off ───────────────
  --
  -- Hand back exactly the privileges the migration revoked and try again. The
  -- writes still have to fail to change anything, because there is no write
  -- policy at all — and that is the half that still holds if a later migration
  -- restores a grant by accident, which is how `published_forms` came to be
  -- deletable by `anon` on the live project.
  --
  -- The three assertions are not the same assertion, and the difference is the
  -- one `pg_temp.untouched` exists for: the insert raises, the update and the
  -- delete succeed against nothing. Writing all three as `refused` is how this
  -- file first read, and the suite caught it.
  set local role postgres;
  grant insert, update, delete on public.role_grants to authenticated;

  perform pg_temp.become(officer);
  perform pg_temp.refused('granted the insert, row-level security still refuses it',
    format($f$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
             values (%L, 'moderator', 'platform', '', 'self')$f$, officer));
  perform pg_temp.untouched('granted the update, it matches no row',
    $f$update public.role_grants set provenance = 'platform'$f$);
  perform pg_temp.untouched('granted the delete, it matches no row',
    $f$delete from public.role_grants$f$);

  -- The control for that trio: with the privilege given *and* row-level
  -- security off, the insert lands. So the three refusals above are the missing
  -- policy rather than a constraint, a typo in the statement, or a role that
  -- was never really assumed.
  set local role postgres;
  alter table public.role_grants disable row level security;

  perform pg_temp.become(officer);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (officer, 'moderator', 'platform', '', 'self');
  select count(*) into n from public.role_grants where role = 'moderator';
  perform pg_temp.counted('and lands as soon as row-level security is off', n, 1);

  set local role postgres;
  delete from public.role_grants where role = 'moderator';
  alter table public.role_grants enable row level security;
  revoke insert, update, delete on public.role_grants from authenticated;

  -- The structural half. The refusals cannot tell a missing write policy from
  -- one that happens to match nothing, and only one of those is the design.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'role_grants'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  perform pg_temp.counted('there is no write policy on role_grants at all', n, 0);

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'role_grants' and cmd = 'SELECT';
  perform pg_temp.counted('and exactly one that reads', n, 1);

  -- ── The predicate ──────────────────────────────────────────────────────

  perform pg_temp.become(officer);

  select private.holds_role('organization_officer', 'organization', 'finance-club') into answer;
  perform pg_temp.answered('the officer holds the role they were granted', answer, true);

  select private.holds_role('organization_officer', 'organization', 'consulting-club') into answer;
  perform pg_temp.answered('and not over the club somebody else runs', answer, false);

  select private.holds_role('organization_officer', 'course', 'finance-club') into answer;
  perform pg_temp.answered('nor with the same id read as a different kind of thing', answer, false);

  select private.holds_role('organization_member', 'organization', 'finance-club') into answer;
  perform pg_temp.answered('nor a role they were never granted', answer, false);

  select private.holds_role('organization_admin', 'organization', 'finance-club') into answer;
  perform pg_temp.answered('a revoked grant is not held', answer, false);

  select private.holds_role('teaching_assistant', 'course', 'vanderbilt/ECON 1020') into answer;
  perform pg_temp.answered('an expired grant is not held', answer, false);

  select private.holds_role('platform_admin') into answer;
  perform pg_temp.answered('and the default scope is the platform, which they are not on',
                           answer, false);

  -- The control that it reads the caller rather than the table: the same call,
  -- by the account that does hold that one.
  perform pg_temp.become(other);
  select private.holds_role('organization_officer', 'organization', 'consulting-club') into answer;
  perform pg_temp.answered('the other account holds theirs', answer, true);
  select private.holds_role('organization_officer', 'organization', 'finance-club') into answer;
  perform pg_temp.answered('and not the first account''s', answer, false);

  perform pg_temp.become_anon();
  select private.holds_role('organization_officer', 'organization', 'finance-club') into answer;
  perform pg_temp.answered('a signed-out visitor holds nothing', answer, false);

  -- ── Where it lives ─────────────────────────────────────────────────────

  set local role postgres;

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'private' and p.proname = 'holds_role';
  perform pg_temp.counted('holds_role is in private', n, 1);

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'holds_role';
  perform pg_temp.counted('and has no twin in public, which PostgREST would publish', n, 0);

  -- Definer is what lets the predicate see past the select policy, and the
  -- pinned path is what stops the caller choosing what `public` means inside
  -- it — `20260907134823_harden_security_definer_helpers.sql` is the file that
  -- argument comes from. Matched as a prefix over `proconfig`, which is the
  -- idiom `activity.check.sql` uses, because the stored setting is
  -- `search_path=` followed by the value.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'private' and p.proname = 'holds_role'
     and p.prosecdef
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c);
  perform pg_temp.counted('definer, with the search path pinned', n, 1);

  raise notice 'role_grants: every check passed';
end $$;

rollback;
