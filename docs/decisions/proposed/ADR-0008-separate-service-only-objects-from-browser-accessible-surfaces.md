# ADR-0008 · Service-only objects are enumerated and kept out of the browser surface; the browser surface is an allowlist

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Database owner |
| Deciders / reviewers | Founder; security owner; product owner and counsel for `schools` visibility |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (allowlists, `anon` revoke); Phase 2 (live diff) |
| Related | `database/DATA_CLASSIFICATION_REGISTER.md`; `database/GRANT_ALLOWLIST.md`; `database/FUNCTION_AUTHORIZATION_MATRIX.md`; `database/proposed/anon_grant_reduction.sql`; `findings-database.md` #5, #6, #13; `docs/architecture/0002-rls-is-the-authorization-boundary.md`; ADR-0004 |
| Supersedes / superseded by | — |

## Context
- Catalog classes (production read 2026-10-04): 354 objects; 77 `service-only` (no SELECT or write grant for `anon` or `authenticated`, reached through definers or the service role); 155 tenant-scoped; 55 relationship-scoped; 46 person-private; 8 parent-scoped; 7 global-public; 4 global-reference; 2 views (`database/DATA_CLASSIFICATION_REGISTER.md`; `app/src/lib/tableclassification.test.ts` guards names, not behaviour).
- `private` schema is not exposed to PostgREST (`supabase/rls-coverage.check.sql` header: "`config.toml` names no extra schemas"); 22 `private` helpers are executable by `anon` because policies on anon-granted tables call them (`database/FUNCTION_AUTHORIZATION_MATRIX.md`).
- Service-only function set is not enumerated: 94 `grant execute ... to service_role` statements (`grep -rhE 'grant execute on function .* to .*service_role' supabase/migrations | wc -l`); `supabase/grants.check.sql` asks about functions a signed-in account can call. The correction in `FUNCTION_AUTHORIZATION_MATRIX.md` shows `purge_financial_records`, `run_dunning`, `apply_payment_event`, `upsert_provider_invoice(_v2)`, `gateway_write_audit_v2` are service-only, verified with `has_function_privilege`.
- `anon` holds privileges on 32 public tables and one view; about 24 are owner-scoped with default full grant incl. TRUNCATE (`database/GRANT_ALLOWLIST.md`). `grants.check.sql` does not guard table privileges (`definerregister.ts` OPEN DR-04).
- `schools` is readable by `anon` with every column: `20260921170000_schools.sql:59` `schools_read` `true`; later columns `enforce_membership`, `edition`, `is_demo`, `email_domains` (`database/GRANT_ALLOWLIST.md` Q1, open).
- `authenticated`: 270 SELECT and 129 write tables; allowlist not written; 16 write-granted tables have no tenant or owner column (`database/TENANT_ISOLATION_MATRIX.md`).
- Code boundary: code under `supabase/functions/` stays out of anything the gateway imports (CLAUDE.md, TS1287 incident on #803; `npm run check:university`).
- Integration category: 6 definers counted browser-callable contrary to the register's "server-only preferred" (`privileged-surface-map.md` §1).

## Problem
How is it made explicit, and checkable, which objects a browser can reach and which only the server can?

## Decision drivers
1. Default is no browser access; each browser grant is a reviewed line.
2. `anon` exposure is limited to the intended public catalog.
3. Reversible and testable on a local PostgreSQL 17 (`supabase/check.sh`).

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Status quo: per-object grants plus RLS | No change | `anon` over-grants; service-only set unlisted | Rejected |
| B. Move service-only objects to a separate `internal` schema and role | Structural separation | Large migration across 77 tables and 94 grants | Deferred |
| C. Keep schemas; add registers and checks for service-only functions/tables and for table privileges of `anon`/`authenticated`; expose `schools` through a view with public columns | Small steps; matches existing guards | Registers need upkeep | Chosen |
| D. Separate database for service-only data | Strongest | Cost, cross-DB consistency | Rejected |

## Decision
**Recommended, unratified; no agent can accept it. The `schools` visibility question is for the product owner and counsel.**
1. Add `database/SERVICE_ONLY_REGISTER.md` (functions and tables), generated from the catalog and compared by a test, as `tableclassification.test.ts` does for tables.
2. Write the `authenticated` allowlist (270/129) from the register; the 16 ownerless write-granted tables are read and classified first.
3. Extend `supabase/grants.check.sql` to table privileges for `anon` and `authenticated`.
4. Apply `anon_grant_reduction.sql` (ADR-0004), keep the intended list (commercial plans/prices/products, entitlement catalog, `form_publications`, `form_responses` INSERT).
5. Replace direct `anon` SELECT on `schools` with a view exposing only the columns the owner approves.
6. A function is in exactly one set: browser-callable (on the allowlist) or service-only (on the register); never both.

## Consequences
Positive: an unreviewed grant fails CI. Negative: registers to maintain; view changes may break unauthenticated school lookup. Harder: new public tables.

## Impact
- **Data / tenancy:** unauthenticated callers stop enumerating customers and claim domains.
- **Security:** removes TRUNCATE exposure (no exploit path found, none tested).
- **Privacy:** customer list disclosure is a counsel question.
- **Accessibility:** none.
- **Operations (SLO, alert, runbook, support):** sign-up flow that reads `schools` must be tested without `anon` columns.
- **Cost / commercial:** none.

## Implementation
1. Registers and test. 2. Allowlist. 3. Check extension. 4. Migration for `anon` revoke and `schools` view, after Q1 answered. 5. Re-test whether `anon` EXECUTE on the 22 private helpers can go.

## Tests and verification
- As `anon`: `select enforce_membership from public.schools` must fail after the change (succeeds today).
- As `authenticated`: `execute public.gateway_write_audit_v2(...)` must fail (control: already service-only).
- Add a scratch migration granting `anon` INSERT on `notes`; the extended `grants.check.sql` must go red.
- Register test: add a service-only function without a row; test red.

## Fitness functions
- `grant-allowlist` (`scripts/architecture/grant-allowlist-live-diff.sh`): live grant not on the allowlist.
- `rls-coverage` (`scripts/architecture/rls-coverage-live.sh`): table without RLS or policy/exception.
- `definer` (`scripts/architecture/definer-count-drift.mjs`): count drift.

## Rollback / reversal
Re-grant; drop the view and restore the policy. Cheap until clients depend on the view shape.

## Open questions
- Product/counsel Q1: is the full school list meant to be public?
- Whether `anon` still needs the 22 private helpers after the revoke.

## Addenda
(none)
