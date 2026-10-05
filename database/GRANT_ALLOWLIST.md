# Browser grant allowlist: `anon`

Measured 2026-10-04. `anon` holds privileges on **32 public tables** and 1 view. Rows are protected by policy, not by grant.

## Intended public access (keep)
| Object | Grant | Policy |
|---|---|---|
| commercial_plans, commercial_prices, commercial_products | SELECT | active / currently-effective rows only |
| entitlement_definitions, plan_entitlements | SELECT | `true` (catalog) |
| form_publications (+ view `published_forms`) | SELECT | open forms only |
| form_responses | INSERT | check applies; read/delete limited to form owner |
| schools | SELECT | `schools_read` = `true`. **Q1 (product/counsel): is the full school list, with every column, meant to be public to unauthenticated callers?** |

## Over-granted (owner-scoped tables with the Supabase default full grant)
appointments, blocks, calendar_feeds, courses, enrollments, family_grants, group_members, group_tasks, groups, message_reactions, messages, notes, organization_members, organizations, profiles, push_devices, push_queue, referral_codes, referrals, reports, sittings, state, tasks, usage (+ `schools` write privileges).

Each carries DELETE, INSERT, UPDATE, SELECT, TRUNCATE, TRIGGER, REFERENCES (some a subset). Their policies key on `auth.uid()` or capability helpers, which deny `anon`, so no row access was found. **TRUNCATE is not governed by RLS.** PostgREST does not expose it, so I found no exploit path; I did not test one. It is a defence-in-depth gap, severity **P2**.

Verified false alarm, recorded so nobody re-raises it: INSERT policies showed `true` only because a null USING was coalesced. Query 3 finds no insert/update policy with a null or literal-true `WITH CHECK` on any anon-insertable table.

## Step 1, in the repository (D-1304); not yet applied to production
`supabase/migrations/20261005200000_anon_keeps_only_its_public_catalog.sql` revokes every `anon` privilege on every `public` table and view, then grants back exactly the allowlist above (SELECT on the pricing catalog, `form_publications`, `published_forms` and `schools`; INSERT on `form_responses`). `proposed/anon_grant_reduction.sql` is superseded by it and left for the record. `supabase/client-privileges.check.sql` holds the result: `anon` has a row privilege only on the allowlist, and a table added by a later migration fails the suite until that migration revokes Supabase's default from `anon`. Q1 is not answered here: `schools` stays readable by `anon`, as it is, pending product and counsel.

Nothing in the app relied on the dropped privileges: every policy on these tables answered a signed-out caller with zero rows, so a screen that read one before sign-in got nothing and now gets a permission error instead. Five suites asserted exactly that ("a signed-out visitor sees none") and now accept the refusal as well as the empty answer (`family`, `organizations`, `referrals`, `reports`, `rls-coverage`); the assertion that `anon` gets no row is unchanged.

**Before applying to production**, read what `anon` holds there that this migration does not name: a table created outside a migration would lose its grant too. Applying it is the owner's step; reversal is a forward migration that grants the privileges back.

The 22 `private` helper functions executable by `anon` (`classmate`, `in_class`, `has_capability`, `is_app_admin`, ...) exist because policies on anon-granted tables call them. After the revoke, re-test whether that EXECUTE can also go.

## Step 2a, applied to production on 2026-10-05
`supabase/migrations/20261005000000_client_roles_lose_table_ddl_privileges.sql` revokes `TRUNCATE`, `TRIGGER`, `REFERENCES` (and `MAINTAIN` on Postgres 17) from `anon` and `authenticated` on every `public` table and from the default privileges for new ones; it touches no row privilege. `supabase/client-privileges.check.sql` holds it (five checks, including a planted-grant control and a check that SELECT, INSERT, UPDATE and DELETE are still held). A live read on 2026-10-04 found these four held by **both** roles on 25 tables, not `anon` alone. The owner authorized applying it, and it was applied to production on 2026-10-05 by running the statements and writing the ledger row `20261005000000` by hand (no pending migration sat below it). Read before and after: `TRUNCATE`/`TRIGGER`/`REFERENCES` holders by `anon` and `authenticated` on `public` went 150 to 0, `MAINTAIN` holders 50 to 0, and the SELECT, INSERT, UPDATE and DELETE grant counts were unchanged (306, 133, 105, 113). Not covered: default privileges for tables created by `supabase_admin` in `public` still grant all eight privileges to both roles (the migration role cannot change another role's defaults), and the Supabase-managed `storage` and `graphql` schemas. Rollback is a forward migration that grants the four back.

## Not done
`authenticated`: 270 SELECT and 129 write tables. Allowlist not written.
