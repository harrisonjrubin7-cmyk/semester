# ADR-0004 · Request-path code stops using RLS-bypassing credentials by default, and SECURITY DEFINER ownership and table grants are brought under measured control

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Database owner (with security owner) |
| Deciders / reviewers | Founder; security owner; platform/CI owner |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (measure, anon revoke, forged-id tests); Phase 2 (FORCE RLS per class) |
| Related | `findings-database.md` #3, #4, #5, #13, #15; `database/TENANT_ISOLATION_MATRIX.md`; `database/FUNCTION_AUTHORIZATION_MATRIX.md`; `database/GRANT_ALLOWLIST.md`; `docs/DEFINER-RLS-REGISTER.md`; `docs/architecture/0002-rls-is-the-authorization-boundary.md`; ADR-0002, ADR-0008 |
| Supersedes / superseded by | — (keeps `0002`; adds to it, since `0002` does not address owner or service-role bypass) |

## Context
- RLS is on for 319/319 public and 29/29 private tables; FORCE ROW LEVEL SECURITY on 0; 0 declarations in migrations (`database/TENANT_ISOLATION_MATRIX.md`; `grep -rhiE 'force row level security' supabase/migrations | wc -l` = 0). `supabase/rls-coverage.check.sql` header omits the rule deliberately (definer owner bypass; `private.has_capability` reads `role_grants`).
- Table/definer owner and `rolbypassrls` are not measured: no `relowner` query in `database/schema/inventory.sql` is cited (`tenant-boundary-map.md` §3, "Asserted/UNKNOWN").
- Bypass in practice: 13 of 16 Edge Functions create a client with `SUPABASE_SERVICE_ROLE_KEY` (`privileged-surface-map.md` §2; `grep -c SERVICE_ROLE supabase/functions/*/index.ts`); `productivity-sourcecheck` is the one caller-scoped function. The gateway uses `SEMESTER_AUTH_SERVICE_KEY` (`app/server/institution/runtime.ts:40-49`), absent from `SECRETS.md`.
- Definers: public 269 of 290, private 235 of 336, 0 unpinned `search_path`, 0 PUBLIC EXECUTE; 205 vs 180 authenticated-callable "unreconciled"; 36 with no regex-visible gate, 12 of those not individually read (`database/FUNCTION_AUTHORIZATION_MATRIX.md`). `supabase/definer-sweep.check.sql` cannot detect "right id, wrong owner" (its header).
- `anon` holds full DML incl. TRUNCATE on about 24 owner-scoped tables; fix is `database/proposed/anon_grant_reduction.sql`, unapplied; `supabase/grants.check.sql` guards function EXECUTE, not table privileges (`definerregister.ts` OPEN DR-04).
- 94 `grant execute ... to service_role` statements; no register of the service-only function set (`privileged-surface-map.md` §2).
- `SUPABASE_ACCESS_TOKEN` is account-wide; migrations apply on merge via Branching (`supabase/DEPLOY.md:511`), branch protection not live (`findings-platform.md` #2, #5, #12).

## Problem
Which code may run with RLS-bypassing authority, who owns the objects that bypass, and how is the set kept small and provable?

## Decision drivers
1. A missing predicate on a bypassing path is a cross-tenant read that RLS cannot stop.
2. Measure before forcing: FORCE RLS can break definers that read `role_grants`.
3. No change to production without separate authorization; reversible steps first.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Status quo, document only | Zero risk of breakage | Convention is the control (`findings-database.md` #3) | Rejected |
| B. FORCE RLS on all 354 objects at once | Strongest | Breaks owner-run definers, sweeps (`20260929030000_retention_sweeps.sql`) and cron; no measurement yet | Rejected |
| C. Convert every definer to invoker + views | Removes definer risk | 269+235 functions; large behaviour change | Rejected |
| D. Measure owner/bypass roles, shrink service-role use to a register, FORCE per class where safe, revoke excess `anon` | Incremental, each step testable | Needs the negative suite first (ADR-0002) | Chosen |

## Decision
**Recommended, unratified; no agent can accept it.**
1. Add `relowner` and `rolbypassrls` readings to `database/schema/inventory.sql` and file the result.
2. Where a caller JWT exists, use a caller-scoped client (as `productivity-sourcecheck` does). Service-role use is an enumerated register: function, reason, tables touched, tenant predicate.
3. Per class in `database/DATA_CLASSIFICATION_REGISTER.md`, decide FORCE RLS after the suites pass; start with `person-private` and `tenant-scoped` tables no definer owner needs.
4. Apply `anon_grant_reduction.sql` as a migration after owner decision on `schools` Q1 and the suites; extend `supabase/grants.check.sql` to table privileges for `anon`.
5. Reconcile 205 vs 180; add forged-id tests for admin and sharing definers.
6. Scope the deploy credential or gate `functions.yml` behind an environment reviewer (`infra/policy/exceptions.json`, expires 2026-12-31).

## Consequences
Positive: bypass surface is a list. Negative: FORCE RLS may need owner-role changes; service-role register is upkeep. Harder: quick admin scripts.

## Impact
- **Data / tenancy:** tightens isolation; no schema data change.
- **Security:** reduces blast radius of a leaked service key (it still bypasses everything: `SECRETS.md`).
- **Privacy:** fewer unreviewed read paths.
- **Accessibility:** none.
- **Operations (SLO, alert, runbook, support):** rotation of gateway keys must be logged (`SECRETS.md` rotation log empty).
- **Cost / commercial:** none.

## Implementation
1. Measurement and register first (no DB change). 2. Revoke migration for `anon`, run through `supabase/check.sh`. 3. FORCE migration per class, one class per pull request, each with its own reversal `NO FORCE`. 4. Add `SEMESTER_AUTH_SERVICE_KEY`, `SEMESTER_JOURNAL_KEY` to `SECRETS.md` and `app/src/lib/secrets.test.ts`.

## Tests and verification
- After the `anon` revoke, `anon` `TRUNCATE`/`DELETE` on `notes` must fail; the same statement before the revoke succeeds at grant level (control).
- Extended `grants.check.sql`: grant `anon` DML on a new table in a scratch migration; check must fail.
- FORCE on a class: the stranger-call sweep and retention sweeps still pass; if a definer breaks, the suite names it.
- Service-role register: a new `SERVICE_ROLE_KEY` use not on the register fails a static test.

## Fitness functions
- `grant-allowlist` (`scripts/architecture/grant-allowlist-live-diff.sh`): live grant absent from `grants.check.sql` allowlist.
- `rls-coverage` (`scripts/architecture/rls-coverage-live.sh`): live table without RLS or without policy/exception.
- `definer` (`scripts/architecture/definer-count-drift.mjs`): counts differ among migrations, register, allowlist.
- `workflow-security-policy` and `secrets-and-rotation`: ungated deploy; no rotation row.

## Rollback / reversal
Revoke: re-grant. FORCE: `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY`. Not cheap once code assumes forced policy for owner connections.

## Open questions
- Production table owner and `rolbypassrls` values (unmeasured).
- Whether `schools` should be column-restricted for `anon` (needs product/counsel answer).
- Which of the 25 definers lack register rows.

## Addenda
(none)
