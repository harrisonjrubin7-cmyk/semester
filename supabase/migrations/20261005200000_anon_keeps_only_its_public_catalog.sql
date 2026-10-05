-- `anon` stops holding table privileges it has no use for.
--
-- Supabase's default privileges grant every privilege on every new table in `public` to `anon`.
-- Until now 32 tables and one view carried that grant (`database/GRANT_ALLOWLIST.md`, measured
-- 2026-10-04), among them `notes`, `tasks`, `messages`, `profiles`, `enrollments` and
-- `family_grants`. Row-level security is the only thing between a signed-out visitor holding the
-- publishable key and those tables, and it holds: every policy on them keys on `auth.uid()` or a
-- helper that answers false for `anon`, and no insert or update policy has a null or literal-true
-- check. So this changes no row anyone can read or write. It removes a grant nothing uses, so that a
-- policy added or edited wrongly later finds a privilege missing instead of a privilege waiting.
--
-- `20261005000000_client_roles_lose_table_ddl_privileges.sql` did the same for TRUNCATE, TRIGGER,
-- REFERENCES and MAINTAIN, on both client roles, and left this open as a decision. D-1304 makes it.
--
-- What `anon` keeps, because a signed-out visitor needs it (the allowlist in
-- `database/GRANT_ALLOWLIST.md`):
--   SELECT  commercial_plans, commercial_prices, commercial_products, entitlement_definitions,
--           plan_entitlements (the pricing catalog), form_publications and its view
--           published_forms (open forms only), schools (the school list)
--   INSERT  form_responses (answering an open form; the check applies)
--
-- `schools` stays readable by `anon` as it is today: the product and counsel question of whether the
-- list should be public with every column is still open and this does not answer it. Its write
-- privileges go, as every other table's.
--
-- `authenticated` is untouched. `service_role` is untouched: it bypasses RLS and is held server-side.
--
-- The default privileges are deliberately not changed: Supabase's defaults still hand a new table's
-- row privileges to `anon`, and `grants.check.sql` requires the local harness to keep modelling that.
-- What stops the next table keeping them is `client-privileges.check.sql`, which fails until the
-- migration that creates it says `revoke all on table ... from anon` (the convention the older
-- migrations follow).
--
-- Rollback: a forward migration that grants the privileges back (the table list is in
-- `database/GRANT_ALLOWLIST.md`). Nothing in the app depends on them: `anon` already reads and
-- writes no row on any of these tables.
--
-- Before applying anywhere that is not this repository's own database, read what `anon` holds there
-- that this does not name (the first query in `database/GRANT_ALLOWLIST.md`): a table created outside
-- a migration would lose its grant too.
--
-- Idempotent, and no `begin` or `commit`, as `docs/developers/HOW-TO-ADD-A-MIGRATION.md` requires.

revoke all on all tables in schema public from anon;

grant select on
  public.commercial_plans, public.commercial_prices, public.commercial_products,
  public.entitlement_definitions, public.plan_entitlements,
  public.form_publications, public.published_forms,
  public.schools
  to anon;
grant insert on public.form_responses to anon;
