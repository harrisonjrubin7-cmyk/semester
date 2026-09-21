-- ═══════════════════════════════════════════════════════════════════════════
-- The pin on `profiles.school_id`, which was not one
--
-- Run once. Idempotent: every statement is written so a second run is a no-op.
--
-- ── What 20260921170000_schools.sql meant to do ──────────────────────────
--
-- It added `profiles.school_id` and said, correctly, what the column is worth
-- without a pin:
--
--   "If a student could `update profiles set school_id = 'vanderbilt'`, this
--    column would be a self-declaration and exactly as strong as the client
--    check it replaces — a longer way of writing down what somebody typed.
--    The only way in is `claim_school()` below, which reads the address the
--    server confirmed rather than the one the row claims."
--
-- The reasoning is right and the mechanism does not achieve it. The line was:
--
--   revoke update (school_id) on public.profiles from anon, authenticated;
--
-- ── Why that is a no-op here ─────────────────────────────────────────────
--
-- A column-level REVOKE can only remove a column-level GRANT. It cannot
-- subtract from a table-level one, and `public.profiles` has a table-level
-- grant to both API roles — Supabase's default privileges hand `all on tables`
-- to `anon`, `authenticated` and `service_role` as each table is created, which
-- `local.stub.sql` models precisely because this class of surprise keeps
-- happening. Postgres accepts the statement, warns that no privileges could be
-- revoked, and leaves the ACL untouched:
--
--   tableacl  = {… authenticated=arwdDxt/postgres …}   -- w is UPDATE
--   colacls   = (none)                                 -- nothing was written
--   has_column_privilege('authenticated','profiles','school_id','UPDATE') = t
--
-- So since `20260921170000` landed, any signed-in account has been able to
-- write its own `school_id` directly — which is the exact state that migration
-- was written to prevent. `grants.check.sql` guards EXECUTE on functions and
-- had no reason to look at column privileges on a table.
--
-- ── And the same hole by the other verb ──────────────────────────────────
--
-- INSERT is granted table-level too ('a' in that ACL), and a profile row does
-- not exist until the client makes one: `lib/classmates.ts` creates it with an
-- upsert. Setting the column on the way in needs no update privilege at all,
-- so closing UPDATE alone would have moved the hole rather than shut it.
--
-- ── What actually closes it ──────────────────────────────────────────────
--
-- Drop the table-level grants for the two API roles and hand back an explicit
-- column list. A privilege that is not on the list is one nobody has, which is
-- the opposite default from the one above and the reason this holds.
--
-- `claim_school()` is unaffected: it is `security definer` and runs as its
-- owner, which is the whole design — one legitimate writer, reached through a
-- function that checks the confirmed address, and no other way in.
--
-- Still a column privilege rather than the `refuse_column_change` trigger the
-- groups table uses, for the reason `20260921170000` gave: a definer function
-- cannot step over its own trigger without `alter table … disable trigger`,
-- which is DDL, is not session-local, and would open the column to every other
-- connection for as long as it were off. That argument was always right. Only
-- the statement implementing it was wrong.

-- ── Take the blanket grants back ─────────────────────────────────────────

revoke update on public.profiles from anon, authenticated;
revoke insert on public.profiles from anon, authenticated;

-- ── And return exactly what the client needs ─────────────────────────────
--
-- `handle` and `about` are the fields the profile screen edits, and `user_id`
-- is needed on insert because the row is keyed by it and the upsert sends it.
--
-- `account_role` is on the list on purpose, and it is the one that looks wrong
-- until you read `20260921161500_roles.sql`. It is what an account *says* it
-- is — chosen at sign-up, writable by its owner, and it decides nothing about
-- authorization; it picks which dashboard the app draws. Every value it can
-- hold is one anybody may give themselves, and a check constraint refuses the
-- values that would matter. `app_admins` is what an account *is*, and that is
-- a different table written by the service key alone. Taking `account_role`
-- away here would break sign-up to protect nothing.
--
-- Everything else is deliberately absent:
--
--   school_id   the point of this file
--   created_at  set by its default; a client that could move it could
--               reorder its own history
--   updated_at  set by the `profiles_touch` trigger. A BEFORE trigger writing
--               NEW.updated_at is not subject to the caller's column
--               privileges — the check is against the columns the statement
--               names — so the client does not need it and must not have it.
--
-- One consequence worth stating, because it will surprise somebody: a column
-- added to this table by a future migration is now un-writable by the API
-- roles until it is added to these lists. Default privileges apply to new
-- tables, not to new columns, so the column inherits a table ACL that no
-- longer carries insert or update for `anon` and `authenticated`. That is the
-- safe direction to fail — a missing grant breaks a feature loudly in
-- development, where a surplus one is silent in production — but it is a step
-- whoever adds the column has to take.

grant insert (user_id, handle, about, account_role) on public.profiles to anon, authenticated;
grant update (handle, about, account_role)          on public.profiles to anon, authenticated;

-- SELECT and DELETE are untouched. Both are governed by the row-level policies
-- in `20260901000200_classmates.sql`, which are the right control for "which
-- rows" — this file is only about "which columns", and narrowing a verb this
-- migration has no argument about would be an unreviewed behaviour change
-- riding along with a security fix.

comment on column public.profiles.school_id is
  'The university the server believes this account belongs to. Written only by '
  'public.claim_school(), which checks the confirmed address against that '
  'school''s published domains. Both API roles are off the insert and update '
  'column lists, which is what makes that the only way in — see '
  '20260921211500_pin_profile_school.sql for why the column-level revoke it '
  'replaces did nothing.';
