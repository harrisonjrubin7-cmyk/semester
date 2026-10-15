# ADR-0002 · The tenant is derived from verified membership in one place and never accepted from a client or a query convention

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Platform security architect (tenancy) |
| Deciders / reviewers | Founder; database owner; security owner; counsel (support-access scope) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate: "no cross-tenant test failures, no unclassified table" (`database/TENANT_ISOLATION_MATRIX.md` "What this is not") |
| Related | `docs/architecture/tenancy/tenant-boundary-map.md` §2, §4; `findings-database.md` #1, #3, #7, #8; `docs/architecture/0002-rls-is-the-authorization-boundary.md`; `docs/architecture/0005-multi-campus-scoping.md`; `docs/platform/adr/tenant-is-derived-never-submitted.md`; ADR-0003, ADR-0004 |
| Supersedes / superseded by | — (extends `docs/architecture/0005`; leaves `0002` intact) |

## Context
- Vocabulary: "school" (`profiles.school_id`, `role_grants.scope_id` with `scope_kind='school'`) in older tables, "tenant"/"institution" in the gateway and newest tables; 151 foreign keys reference `public.schools` (`tenant-boundary-map.md` §1; `supabase/migrations/20260921170000_schools.sql`).
- There are two live, independent derivations. Path A (browser to RLS): `profiles.school_id` set by `claim_school()` or an approved request, with staff authority from `role_grants` via `private.has_capability(cap,'school',tenant_id)` (`20260922012000_capabilities.sql`). Path B (gateway): token, then `institution_membership`, then `app/server/institution/context.ts:contextFor`; the client `X-Tenant-Id` is only compared (`tenant_mismatch`). Path C, `app.tenant_id()` per transaction, is design only: `grep -rn 'app.tenant_id' supabase/migrations` returns 0 (`docs/platform/ISOLATION.md`).
- Path B then queries as service role and filters by convention: `.eq('tenant_id', identity.institutionId)` in `app/server/institution/intelligence-repository.ts` (lines 79, 85 and others), `membership.ts`, `postgres-journal.ts`, `postgres-scim.ts`. RLS cannot catch a missing `.eq`; no structural test requires it (`findings-database.md` #3).
- Tenant lifecycle is hard-coded: `context.ts` sets tenant state `active` ("no tenant lifecycle yet") (`findings-database.md` #7).
- Membership enforcement is a per-school switch, default false, rooms only (`20260930185000_school_membership_enforcement.sql`; `findings-database.md` #2).
- Support and review capabilities are checked at platform scope: `supabase/functions/support-reply-notify/index.ts:mayAnswer`; `20260928032000_community.sql:private.media_read_allowed` (`findings-database.md` #8).
- 155 of 354 objects are `tenant-scoped` by rule, 19 read by a person (`database/DATA_CLASSIFICATION_REGISTER.md`); no cross-tenant negative suite exists (`database/README.md`).

## Problem
Which single derivation of "which school is this request for, and is this person a member" does every server-side path use, and how is a path that skips it made impossible to merge?

## Decision drivers
1. A request in school A cannot read or write school B on any path (Phase 1 gate), shown by a test, not asserted.
2. One definition of membership, so a deprovision (SCIM revokes `role_grants`, `20260930210000_deprovision_revokes_grants.sql`) takes effect on every path.
3. No dependence on a developer remembering `.eq('tenant_id', ...)`.
4. Cost: do not require a platform rewrite before the pilot.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep two derivations, add tests | Cheapest | Convention remains the control on the service path | Rejected as end state; used as Phase 1 floor |
| B. Gateway-only: all tenant data via `/api/institution` | One path | Gateway deployment is not evidenced (`EXT-018` BLOCKED); retires direct RLS which `0002` calls the strongest part | Rejected |
| C. Transaction GUC `app.tenant_id` + FORCE RLS everywhere (`docs/platform/ISOLATION.md`) | RLS then catches a missing filter | 0 adopters; needs ADR-0004 owner/FORCE work; adapter does not exist | Deferred to Phase 2 evaluation |
| D. Database-per-school | Hard boundary | Cost, migration of 354 objects, cross-school roles (`role_grants` span schools) | Rejected |

## Decision
**Recommended, unratified; no agent can accept it.**
1. Tenant identity comes only from membership rows (`profiles.school_id` / `institution_membership` / `role_grants`), resolved server-side into one `TenantContext`; a client-supplied tenant is compared, never used.
2. Every service-role query over a `tenant-scoped` table goes through a repository helper that takes a `TenantContext`; a bare `.from('<tenant table>')` in `app/server/**` or `supabase/functions/**` fails a structural test.
3. The founder names the pilot path (direct RLS or gateway) so the other is not claimed (`findings-database.md` #7).
4. Support and review capabilities become school-scoped, or the platform scope is recorded as intended and gated by `support_access_grant`.
5. Evaluate Path C after ADR-0004; do not claim platform isolation until adapters pass `isolationCases` against real services.

## Consequences
Positive: a missing filter becomes a failing test. Negative: refactor of the gateway repositories and 13 Edge Functions that hold the service key (`privileged-surface-map.md` §2). Harder: ad-hoc service-role scripts.

## Impact
- **Data / tenancy:** defines the boundary; classes in `database/schema/table-classification.json` drive test generation.
- **Security:** removes convention-only control on service-role paths; platform-scope support is a counsel question.
- **Privacy:** support reads across schools need counsel review (FERPA-style access is a question for counsel, not a finding).
- **Accessibility:** none.
- **Operations (SLO, alert, runbook, support):** tenant lifecycle states (`active`, suspended, offboarded) must exist before the gateway serves a real tenant.
- **Cost / commercial:** none until multi-school.

## Implementation
1. Add `app/src/lib/tenantquery.test.ts` (structural, style of `src/rootunmount.test.ts`): list each `.from(` on a tenant-scoped table under `app/server/**`, `supabase/functions/**`; require a tenant predicate or the helper; keep a dated exempt list.
2. Generate `supabase/tenant-negative.check.sql` from `table-classification.json`: seed two schools, four roles, assert no cross-school see/mutate/delete; it joins the `*.check.sql` glob (`ci.yml:497`).
3. Introduce `TenantContext` and the helper in `app/server/institution/`; migrate `intelligence-repository.ts`, then the rest.
4. Decide the support-scope question; migration only after authorization.

## Tests and verification
- Structural test: delete one `.eq('tenant_id', ...)` in `intelligence-repository.ts`; it must go red; restore.
- Negative suite: a school-B user selects/updates/deletes a school-A row in each `tenant-scoped` table; any success fails. Control: a table known to be public-by-design (`commercial_plans`) must read.
- Gateway: tenant A token with `X-Tenant-Id: B` returns `tenant_mismatch`; token for a deprovisioned member is refused.
- Support: an agent with school-A capability opens a school-B ticket; must refuse once scoped.

## Fitness functions
- `tenant-boundaries` (`scripts/architecture/tenant-boundaries-map.mjs`): TI-nn with no check, or a table with `school_id`/`scope_id` and no cross-school case in any `*.check.sql`; CI `build`.
- `rls-coverage` (`scripts/architecture/rls-coverage-live.sh`): live table with RLS off or no policy and no exception.
- `policy-gateway adoption` (`scripts/architecture/policy-adoption.mjs`): see ADR-0003.

## Rollback / reversal
Helper and structural test are removable per file. Reversal stops being cheap once policies or Edge Functions depend on `app.tenant_id` (Path C) or on school-scoped support capabilities.

## Open questions
- Which path serves the pilot (founder decision).
- Whether a person with roles over several schools needs a per-request active-school selection.
- Table owner and `rolbypassrls` of production roles are not measured (`tenant-boundary-map.md` §3).

## Addenda
(none)
