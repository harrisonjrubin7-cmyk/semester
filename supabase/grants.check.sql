-- Which functions a client may call at all.
--
-- Every other suite here asks what a signed-in account may *read*. This one
-- asks something a policy cannot answer: whether the function is reachable
-- from the browser in the first place. A `security definer` function runs as
-- its owner, so row-level security is not what stops a caller — the EXECUTE
-- grant is the only thing that does, and until this file existed nothing
-- checked it as a whole.
--
-- ## Why it is a whole-schema allowlist and not a list of cases
--
-- The fault it guards against is an omission, and a suite made of cases can
-- only catch the omissions somebody thought of. Supabase grants EXECUTE on
-- every new function in `public` to `anon` and `authenticated` explicitly, as
-- it is created — see `local.stub.sql`, which now models that — so the next
-- migration to add a function ships it **reachable by a signed-out visitor
-- unless its author remembers otherwise**. A list of named cases would stay
-- green through exactly that.
--
-- So the question is asked in the other direction: every function in `public`
-- that a client can call must be one this file names. A new one is a failure
-- until somebody decides which side of the line it belongs on, and writes it
-- down here.
--
-- That is not a hypothetical shape of bug. `20260921002428_invites.sql` was
-- applied to the live project on 21 September 2026 and `set_invite_only`
-- landed with `anon=X`: anybody holding the publishable key could have turned
-- the pilot's invite gate on or off. `20260921144011_function_grants.sql` is
-- the fix; this file is the reason the next one cannot happen quietly.
--
--   How to run it: supabase/check.sh grants

begin;

/**
 * Whether a function came with an extension rather than with this repository.
 *
 * `local.stub.sql` installs pgcrypto into `public`, because a bare Postgres
 * has no `extensions` schema and the suites need `gen_random_uuid()`. A real
 * project puts it in `extensions`, so its forty-odd functions are in `public`
 * *here and nowhere else* — and they arrive with the same default grants
 * everything else does.
 *
 * Reporting them would be the loudest possible false positive: forty names
 * this repository did not write, did not grant and cannot revoke without
 * breaking the extension, printed on every run until somebody stopped reading
 * the output. What is left after this filter is the set this directory is
 * actually responsible for.
 */
create or replace function pg_temp.from_extension(fn oid)
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_depend d
     where d.objid = fn and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
  );
$$;

/**
 * Every function in `public` a given role may execute.
 *
 * `prokind = 'f'` so that aggregates, window functions and procedures are not
 * counted as things a PostgREST client calls, and the identity arguments are
 * included because two overloads are two decisions.
 */
create or replace function pg_temp.callable(who text)
returns text language sql stable as $$
  select string_agg(fn, ', ' order by fn) from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not pg_temp.from_extension(p.oid)
       and has_function_privilege(who, p.oid, 'execute')
  ) t;
$$;

-- ── First, that this harness still models the grant at all ────────────────
--
-- The control for everything below, and without it this is the most
-- comfortable file in the directory: with no default privileges in place, no
-- function is granted to anybody, every sweep below passes, and the suite
-- reports a schema it has proved nothing about. That is the exact shape
-- `CLAUDE.md` keeps finding — a probe answering a narrower question than the
-- one being asked — and here it would be answering *no* question.
--
-- So the first thing checked is the stub, not the schema. If
-- `local.stub.sql` stops setting the default privileges Supabase sets, this
-- goes red and says why, rather than going green and meaning nothing.

do $$
declare modelled boolean;
begin
  select exists (
    select 1 from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public' and d.defaclobjtype = 'f'
       and array_to_string(d.defaclacl, ',') like '%anon=X%'
  ) into modelled;

  if not modelled then
    raise exception 'FAILED: no default EXECUTE grant to anon on functions in public — '
      'local.stub.sql has stopped modelling Supabase, so every check below is vacuous';
  end if;
  raise notice 'ok  the harness grants functions the way Supabase does';
end $$;

-- ── A signed-out visitor reaches nothing ──────────────────────────────────
--
-- The strongest half, and the one that was false in production. `anon` is the
-- role the publishable key maps to, and that key is in the page source of a
-- static site: everybody has it.

do $$
declare reachable text;
begin
  reachable := pg_temp.callable('anon');
  if reachable is not null then
    raise exception 'FAILED: a signed-out visitor can call %', reachable;
  end if;
  raise notice 'ok  no function in public is callable by a signed-out visitor';
end $$;

-- ── A signed-in account reaches only what it is meant to ──────────────────

do $$
declare
  /*
   * The allowlist. Four, and each is a deliberate entry point:
   *   make_referral_code  — mints this account's own code
   *   claim_referral      — records that this account arrived on somebody's
   *   referral_standing   — two integers and a boolean about the caller
   *   adopt_lti_identity  — attaches a Brightspace launch to the caller's own
   *                         account. Callable by a signed-in account *because*
   *                         that is half the security argument: it needs a
   *                         launch ticket the server minted AND a session the
   *                         caller proved, and neither alone will move an
   *                         account. See 20260921160100_lti_identity.sql.
   *
   * Adding a line here is the decision. If a new function needs to be callable
   * it belongs in this array with its own migration granting it; if it does
   * not, the migration revokes it and this array does not change.
   */
  allowed constant text[] := array[
    'adopt_lti_identity(want_ticket text)',
    'claim_referral(given text)',
    'make_referral_code()',
    'referral_standing()'
  ];
  extra text;
  missing text;
begin
  select string_agg(fn, ', ' order by fn) into extra from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not pg_temp.from_extension(p.oid)
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) t where not (t.fn = any(allowed));

  if extra is not null then
    raise exception 'FAILED: a signed-in account can call % — grant it deliberately or revoke it', extra;
  end if;
  raise notice 'ok  a signed-in account can call nothing outside the allowlist';

  /*
   * The control, and it is the half that keeps this file honest. Both checks
   * above pass perfectly against a schema with no functions in it at all, or
   * against a probe whose `has_function_privilege` call has stopped matching
   * anything — which is the failure `CLAUDE.md` keeps finding in this
   * repository's own instruments. So: the allowlist must be reachable too.
   */
  select string_agg(want, ', ' order by want) into missing from unnest(allowed) as want
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = want
        and has_function_privilege('authenticated', p.oid, 'execute')
   );

  if missing is not null then
    raise exception 'FAILED: the allowlist names %, which a signed-in account cannot call', missing;
  end if;
  raise notice 'ok  and can call all four that it should';
end $$;

-- ── The gate's own switch, named because it is the one that was open ──────
--
-- Covered by the sweep above, and written out as well: a check that fails with
-- "a signed-out visitor can call set_invite_only(on_off boolean)" is read at a
-- glance, and this is the function whose exposure would hand a stranger the
-- pilot's front door.

do $$
begin
  if has_function_privilege('anon', 'public.set_invite_only(boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.set_invite_only(boolean)', 'execute') then
    raise exception 'FAILED: the invite gate can be flipped through the API';
  end if;
  raise notice 'ok  the invite gate cannot be flipped through the API';
end $$;

rollback;
