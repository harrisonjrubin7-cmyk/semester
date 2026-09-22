-- ═══════════════════════════════════════════════════════════════════════════
-- `lti_account_untouched()`, redefined where a deploy will see it
--
-- Run once. Idempotent.
--
-- ── Why this file exists rather than another line in the old one ─────────
--
-- `20260921160100_lti_identity.sql` defines `public.lti_account_untouched()`,
-- the check that decides whether a Brightspace launch may attach to an account
-- that already exists. It walks a list of tables and answers false if any of
-- them holds a row for that account. Adding a table to that list is how a new
-- kind of work gets counted.
--
-- **That migration is in `ledger.snapshot`.** Production applied it on 21
-- September. `db push` applies every local migration whose version the ledger
-- does not already have, so editing an applied file changes what a fresh
-- database gets and changes nothing at all about the live one. An applied
-- migration is a record of what ran, not a place to keep the current
-- definition.
--
-- Both instruments here go green through that, and neither is wrong to:
-- `check.sh` builds from empty, so it sees the edited file and the edit works;
-- `rehearse.sh` replays applied migrations over an older snapshot, so it sees
-- it too. Nothing in this repository was in a position to notice, which is why
-- the test at the end of this header matters more than the function does.
--
-- ── What it was missing ──────────────────────────────────────────────────
--
-- Two tables, and the second is the one that found the first.
--
--   `public.feedback` was added to the list inside the applied file by
--   `20260921215800_feedback.sql`'s pull request, for a reason that is exactly
--   right — "somebody who has written out what went wrong with the app has
--   plainly used this account" — and by a means that cannot reach production.
--
--   `public.organization_members` is the same category and arrived the same
--   way: `ltiaccount.test.ts` demanded it the moment `organization_members`
--   joined `OWNED_TABLES`, and following the precedent in that file would have
--   produced a second dead edit.
--
-- Being in an organization is plainly not an untouched account. It is also the
-- sharpest case in the list after `blocks`, and for the same reason: a
-- membership is a row *other people* can see, on a roster, and retiring the
-- account under it would take somebody off a list they are on without anybody
-- deciding to.
--
-- ── The guard ────────────────────────────────────────────────────────────
--
-- `app/src/lib/ltiaccount.test.ts` used to read this function from a hardcoded
-- path, which is half of why the edit above looked right. It now takes the
-- *last* migration in version order that defines the function, because that is
-- the definition Postgres ends up with and the only one a deploy applies. A
-- redefinition in a new file is found; an edit to an applied one is not.
--
-- The list below is the whole list, not a delta. `create or replace` replaces
-- the body outright, so a delta is not a thing this could be.

create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t   record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      -- Created by 20260921230000_organizations.sql, which applies before this
      -- file — so unlike the others this one is not a forward reference and
      -- the `to_regclass` guard below is belt to its braces rather than the
      -- thing making it legal.
      ('public.organization_members', 'user_id')
    ) as x(rel, col)
  loop
    /*
     * The guard the original file explains at length, kept verbatim in
     * substance: a relation named here that does not exist yet is skipped
     * rather than fatal, because `language plpgsql` resolves relations when
     * the statement runs and a `language sql` body would refuse to be created
     * at all. Skipping is safe in the one direction that matters — the danger
     * is answering "untouched" about an account that has work in it, and a
     * relation that does not exist cannot be holding any.
     */
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;

    execute pg_catalog.format('select 1 from %s where %I = $1 limit 1', t.rel, t.col)
      into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

-- The revokes the original file made, restated verbatim in substance.
--
-- `create or replace` keeps a function's ACL, so these change nothing — and
-- that is the reason to write them rather than the reason to leave them out. A
-- reader of this file should be able to see what may call this without opening
-- another one, and the answer is surprising enough to be worth stating: nobody
-- with a browser key. `authenticated` is revoked along with `anon`, because the
-- account this answers about is not the account asking — the launch flow runs
-- it with the service key, from the edge function that validated the launch.
-- `grants.check.sql` sweeps for exactly the mistake of granting it here.
revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid) from anon, authenticated;
