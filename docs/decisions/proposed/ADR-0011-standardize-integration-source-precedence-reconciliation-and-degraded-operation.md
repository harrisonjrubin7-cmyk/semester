# ADR-0011 · Each field has one declared source of authority; conflicts become reconciliation items; a failing integration degrades to labelled stale data

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Integrations owner |
| Deciders / reviewers | Founder; security owner; pilot school SIS/LMS administrator; counsel (data-processing terms) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (precedence table and labels); Phase 2 (reconciliation and first provider) |
| Related | `docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`; `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`; `docs/SYNC-SIMULATION-SANDBOX.md`; `docs/architecture/0012-legacy-only-through-anti-corruption-layers.md`; `docs/architecture/0001-local-first-with-supabase.md`; `contracts/README.md`; `findings-database.md` #7; `FITNESS_FUNCTIONS.md` #10; ADR-0006, ADR-0009 |
| Supersedes / superseded by | — |

## Context
- Provenance vocabulary exists: `source_label` constrained to `institution_verified`, `imported`, `student_entered`, `estimated`, `needs_review` on the expansion tables (`supabase/migrations/20260926150000_expansion_roles_and_features.sql`); `app/src/intelligence/contracts.ts:EvidenceReference` records origin, authority and verified-at; `app/src/lib/subscribe.ts:STALE_HOURS` for the outbound feed (`docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`).
- Reconciliation, safe fallback states, import validation and duplicate resolution are specified and "Nothing here is built yet" (`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md` opening; waits on #779).
- Control plane exists: composite tenant keys, connection-bound worker, approval, kill switches `kill.integration_sync` and `kill.writeback`, per-tenant scopes (`supabase/migrations/20260927170000_integration_control_plane.sql`; `20260930010000_module_mode.sql:46`); tests `supabase/integration-control-plane.check.sql`, `integration-rls-matrix.check.sql`, `integration-hardening.check.sql`, `integration-quality.check.sql`.
- No real provider has been exercised: adapter registry "holds mocks only" (`definerregister.ts` BRIEF A06); `integration-tick` refuses an adapter that declares a credential (`supabase/functions/integration-tick/index.ts` comment), so no production provider credentials flow; institution gateway not deployed (`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md` EXT-018 BLOCKED).
- `lti` derives tenant from `lti_registration.tenant_id` and only warns when it is null (`supabase/functions/lti/index.ts:192-218, 668-669`).
- Merge today: field-level, later edit wins on one record (`app/src/lib/merge.ts`; `0001`). No institution-versus-student precedence exists.
- Tenant filter in `integration-tick` is in generated `_shared/integration/tick.ts` over the service client (`tenant-boundary-map.md` §4 row 12).

## Problem
When a school system, an import and the student disagree about a value, who wins, what does the person see, and what happens when the school system is down?

## Decision drivers
1. The institution's verified value is never silently overwritten by an import or a student entry.
2. The student's own authored content is never overwritten by a sync.
3. Staleness is visible; no fabricated freshness.
4. A failure or kill switch narrows behaviour; it never widens writes.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Last-write-wins | Simple | Destroyed notes before (`0001`) | Rejected |
| B. Provider always wins | Predictable | Overwrites student-owned data; hides errors | Rejected for student-owned fields |
| C. Student always wins | Respects local-first | Defeats institutional data (deadlines, grades) | Rejected |
| D. Per-field declared authority ladder, conflicts to a review queue, labelled stale reads | Explicit and testable | Needs per-field table | Chosen |

## Decision
**Recommended, unratified; no agent can accept it.**
1. Declare per field class an authority: institution-owned (grades, enrolment, calendar of record) `institution_verified` > `imported` > `student_entered` > `estimated`; student-owned (notes, private tasks) never overwritten by sync.
2. A lower-ranked write against a higher-ranked value does not apply; it creates a reconciliation item with both values and sources, visible to the person and, where relevant, the school.
3. Each shown institutional value carries its `source_label` and last-verified time; past `STALE_HOURS` for its class it is shown as stale with the time, never as current.
4. Degraded operation: provider error, contract mismatch or `kill.integration_sync` yields last-known values with a stale label and no writes; `kill.writeback` blocks outbound writes; both are drilled.
5. Each contract is versioned; a field change must be a superset of the committed schema.
6. Real-provider exercise is a precondition to any Phase 2 "integrated" statement; no claim before.

## Consequences
Positive: no silent overwrite; honest staleness. Negative: reconciliation queue needs an owner; more UI states. Harder: adding a provider without declaring authority.

## Impact
- **Data / tenancy:** items are tenant-scoped; keys composite with tenant.
- **Security:** blocks write amplification during incidents.
- **Privacy:** reconciliation items expose a value to the person who owns it; school visibility is a counsel question.
- **Accessibility:** stale and conflict states perceivable by non-visual users (ADR-0013).
- **Operations (SLO, alert, runbook, support):** freshness SLO per provider (not yet defined); runbook for provider outage.
- **Cost / commercial:** each provider is its own scope; none priced.

## Implementation
1. Authority table in `contracts/` per field class. 2. Apply ladder in `app/src/lib/merge.ts` for institution fields. 3. Build reconciliation item and stale label per `docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`. 4. `integration-contracts.mjs`. 5. First provider on a sandbox (`docs/SYNC-SIMULATION-SANDBOX.md`) before a real school.

## Tests and verification
- `imported` value arrives for a field holding `institution_verified`: not applied, item created (fails today: no ladder).
- Student edits an institution-owned field: stored as `student_entered`, shown as conflict.
- Provider returns 500: reads return last-known labelled stale, zero writes.
- `kill.writeback` engaged: outbound call refused (control exists in control-plane checks).
- Contract: remove a field in a schema change; `integration-contracts` fails.

## Fitness functions
- `integration-contracts` (`scripts/architecture/integration-contracts.mjs`): route in `packages/institution/src/routes.ts` without a contract row; non-superset field change; Phase 2.
- `tenant-boundaries`: integration tables cross-school cases (`integration-rls-matrix.check.sql` exists).
- `release-evidence`: no contract evidence for the candidate.

## Rollback / reversal
Revert the ladder to field-level latest; keep labels. Not cheap after reconciliation items hold decisions people made.

## Open questions
- Authority per field class for the pilot school (needs the school's systems list).
- Staleness thresholds per provider.
- Counsel: data-processing terms with each provider.

## Addenda
(none)
