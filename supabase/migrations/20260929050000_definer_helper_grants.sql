-- Semester — the definer helpers nothing needs to call, and the one helper a
-- policy calls whose grant was never written down.
--
-- Safe to run again; every statement is a revoke or a grant.
--
-- `published_forms` was the other half of this work and landed separately in
-- 20260929000000_published_forms_invoker.sql (#906). What follows is what that
-- migration did not cover: the grants on `security definer` helpers in
-- `private`.

-- ── `form_open`, which had never been given an explicit grant ────────────
--
-- The insert policy on `form_responses` is `to anon, authenticated` and calls
-- this, so both roles must be able to execute it. They could — through the
-- PUBLIC grant every new function gets, which `forms.sql` never revoked. It
-- was the one `security definer` function in `private` still riding on that,
-- and so the one whose grant nobody had written down or decided. This writes
-- it down: both roles, because the policy names both, and PUBLIC — which also
-- covers every role nobody has thought of — no longer.
revoke all on function private.form_open(uuid) from public;
grant execute on function private.form_open(uuid) to anon, authenticated;

-- ── 2. Definer helpers that only other definer functions call ────────────
--
-- Every `security definer` function in `private` that `anon` or
-- `authenticated` could execute was read against three questions, on an
-- empty cluster built from this directory:
--
--   * does a row-level security policy call it? A policy is evaluated as the
--     querying role, so its functions must stay executable by that role —
--     thirty of the thirty-six are these, and none of them is touched here;
--   * does a function that is *not* security definer call it? An invoker
--     function — a trigger especially — runs as whoever fired it, so its
--     callees need the same grant. `gtm_reviews_outstanding` is the one:
--     `private.gtm_campaign_guard` is an invoker trigger on `gtm_campaigns`;
--   * or is it only ever called from inside another definer function, which
--     runs as the owner and needs nobody else's grant?
--
-- These four are the third kind. Each was granted to the client roles when it
-- was written, as a precaution rather than a need, and nothing outside a
-- definer body calls any of them — not a policy, not a view, not an invoker
-- function, not `app/src`, not an edge function. `private` is not exposed to
-- PostgREST, so today none of them is reachable from a browser either; this
-- is the second lock, for the day an exposed invoker function or a new schema
-- setting makes one reachable.
--
--   answers_for(uuid)   — whether the caller answers a help destination;
--                         called by answer_help_request, help_inbox and
--                         open_help_request, all definer
--   org_readable(uuid)  — the read policy on organizations, restated for the
--                         definer functions that cannot see policies; called
--                         by apply_to_organization and follow_organization
--   org_standing(uuid)  — the caller's standing in one organization; same two
--   group_room(uuid)    — which class a group is in, for *any* group id. Its
--                         own migration names it as the one that "would have
--                         mattered most": an enumeration away from a map of
--                         who studies what. It has no caller at all now.
--
-- `same_school(uuid)` is deliberately left granted. No policy calls it yet,
-- and `tenancy.check.sql` exercises it as a signed-in account because it is
-- the helper the classmate policies are written to adopt when they tighten —
-- revoking it now would be a trap laid for that migration.
revoke all on function private.answers_for(uuid)  from public, anon, authenticated;
revoke all on function private.org_readable(uuid) from public, anon, authenticated;
revoke all on function private.org_standing(uuid) from public, anon, authenticated;
revoke all on function private.group_room(uuid)   from public, anon, authenticated;


-- ── 3. What this file does not do: change the default ───────────────────
--
-- The obvious third step is `alter default privileges revoke execute on
-- functions from public`, so that a function created from now on starts with
-- no grant at all. (It has to be the global form: Postgres's PUBLIC EXECUTE is
-- a built-in global default, and an `in schema` statement can only add to a
-- global default, never take away from one.)
--
-- It was written, and measured, and taken out. With it in place, `check.sh`
-- with the second pass failed three of the eight suites it was run with —
-- forms, tenancy and groups — on "permission denied for function become" and
-- "… counted": the `pg_temp` helpers those suites create as `postgres` and
-- then call as `authenticated`. The harness could be taught to grant them,
-- but the failure is the point. The default is global, per creating role and
-- not per schema, and on the live project that role is also the one the SQL
-- Editor runs as; changing it changes every function anybody creates there,
-- for every schema, and not only the ones this file is about.
--
-- The guarantee it was reaching for is had another way, the way `public` has
-- had it since 21 September: `grants.check.sql` now fails any definer
-- function outside `public` that a client role can execute unless a policy or
-- a view calls it, or it is named there with a reason. A new helper arrives
-- with PUBLIC's grant exactly as before — and CI refuses it until its
-- migration revokes it or somebody writes down why it needs to stay.
