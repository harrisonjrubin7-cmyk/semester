-- Semester — the revoke that `revoke … from public` is not.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is idempotent.
--
-- ## The gap this closes, and how it was found
--
-- Every migration here that means "no client may call this" writes
--
--     revoke all on function public.whatever() from public;
--
-- and that spelling is correct as far as it goes. `invites.check.sql` exists
-- partly to prove it: revoking from `anon` and `authenticated` *by name* leaves
-- the PUBLIC grant they inherit completely intact, and the first version of
-- `set_invite_only` did exactly that.
--
-- It is not sufficient on a real project, because Supabase grants functions
-- twice over. `pg_default_acl` for schema `public`, objtype `f`, carries
--
--     {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- so every function created in `public` is **also** granted EXECUTE to those
-- roles explicitly, at creation. A revoke aimed at PUBLIC does not touch an
-- explicit per-role grant. Both spellings are needed, and every file in this
-- directory had only one of them.
--
-- **This was live, not theoretical.** `20260921003300_invites.sql` and
-- `20260921003500_referrals.sql` were applied to the project on 21 September
-- 2026, and `set_invite_only(boolean)` landed with `anon=X` and
-- `authenticated=X` — anybody holding the publishable key that ships in the
-- browser could have turned the pilot's invite gate on, or off. The check
-- suite had a case for precisely that and had been passing it, because
-- `local.stub.sql` granted tables and never functions: the harness could not
-- see the grant that was doing the damage. The stub now sets the same default
-- privileges Supabase does, which turns that case red, and this file is what
-- makes it green again.
--
-- ## Why a separate migration rather than a line in each of the others
--
-- Those two are applied. Editing an applied migration makes the file disagree
-- with the database it was applied to, and `ROLLBACK.md` is a document about
-- how expensive that disagreement already is here. A migration that lands
-- after them says the same thing once, in the place somebody looks when they
-- ask why a function is not callable.
--
-- ## The recurrence, which matters more than the fix
--
-- Nothing stops the next migration adding a `security definer` function and
-- shipping it reachable. `grants.check.sql` is the guard: it asserts the whole
-- allowlist — every function in `public` that a client may call, and no other
-- — so a new one is refused until somebody decides which side it is on.

-- ## Why every revoke below is guarded
--
-- The header promises this file is safe to run again, and on this project it
-- has to be safe to run *early* as well. `20260921003400_access_log.sql` has
-- not been applied to the live database, so two of the functions named below
-- do not exist there — and an unguarded `revoke` on a missing function is an
-- error that aborts the rest of the file. On a fresh project the migrations
-- run in order and all seven exist by the time this runs; on the live one,
-- five do. Both have to work, and the difference must not be something
-- somebody discovers halfway through a dashboard paste.
--
-- So each revoke is applied only if the function is actually there. Re-running
-- this after a missing migration finally lands is what closes the rest, and it
-- costs nothing when there is nothing to close.

do $$
declare
  /*
   * Each entry is a function and the roles that must not reach it.
   *
   *   'anon, authenticated'  — no client may call this at all, where the
   *                            function's own migration has already revoked
   *                            the PUBLIC grant it was created with
   *   'public, anon,
   *    authenticated'        — both spellings, for a function no migration
   *                            here creates. Postgres grants EXECUTE to
   *                            PUBLIC on every new function, so the named
   *                            revoke alone leaves `=X/postgres` behind and
   *                            `anon` still reaches it through PUBLIC — the
   *                            exact inverse of the defect at the top of this
   *                            file, and it was found the same way: by a check
   *                            failing, not by reading
   *   'anon'                 — signed-in only; `authenticated` keeps the grant
   *                            its own migration gave it deliberately
   */
  targets constant text[][] := array[
    -- Trigger functions and internal helpers: reached by the definer
    -- functions, which run as their owner and need no client grant.
    ['public.set_invite_only(boolean)',            'anon, authenticated'],
    ['public.only_invited()',                      'anon, authenticated'],
    ['public.gen_referral_code()',                 'anon, authenticated'],
    ['public.referral_active_days()',              'anon, authenticated'],
    ['public.referral_new_days()',                 'anon, authenticated'],

    -- The same defect in the file that has not been applied yet. Both are
    -- `service_role` helpers and both carry only the PUBLIC spelling.
    -- `read_feed` is the one to look at twice: it takes a bearer token and
    -- returns the timetable it belongs to, so reachable by `anon` it would let
    -- anybody holding the publishable key trade a leaked feed token for its
    -- contents, without the Edge Function that is meant to be the only thing
    -- holding it.
    ['public.note_access(uuid, text, text)',       'anon, authenticated'],
    ['public.read_feed(text, text)',               'anon, authenticated'],

    -- Not this repository's function, and revoked anyway. `rls_auto_enable`
    -- and `touch_updated_at` are installed by the platform and by
    -- `records`, and both are reached by a trigger rather than by a caller —
    -- Postgres checks EXECUTE when a trigger is created, not each time it
    -- fires, so neither needs a client grant to do its job.
    --
    -- `rls_auto_enable` is here because a rebuild from this directory would
    -- otherwise be less safe than production is. Production revoked it on
    -- 7 September, in `history/20260907134823_harden_security_definer_helpers.sql`,
    -- and that file is a record rather than a migration — so the revoke lived
    -- nowhere that a fresh database would run. `grants.check.sql` is what
    -- noticed, the moment `local.stub.sql` started creating the function the
    -- way a real project does.
    ['public.rls_auto_enable()',                   'public, anon, authenticated'],
    ['public.touch_updated_at()',                  'public, anon, authenticated'],

    -- Signed in only. All three also guard `auth.uid() is null` internally,
    -- and that is not made redundant by this: the internal guard decides what
    -- a signed-in *stranger* may learn, this is the outer fence. Two fences,
    -- because the failure of either alone is silent.
    ['public.make_referral_code()',                'anon'],
    ['public.claim_referral(text)',                'anon'],
    ['public.referral_standing()',                 'anon']
  ];
  target text[];
  closed integer := 0;
  absent integer := 0;
begin
  foreach target slice 1 in array targets loop
    if to_regprocedure(target[1]) is null then
      absent := absent + 1;
      continue;
    end if;
    execute format('revoke all on function %s from %s', target[1], target[2]);
    closed := closed + 1;
  end loop;

  raise notice 'function grants: % closed, % not present yet', closed, absent;
end $$;
