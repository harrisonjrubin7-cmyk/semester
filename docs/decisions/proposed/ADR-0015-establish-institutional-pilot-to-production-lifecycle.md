# ADR-0015 · A school moves from pilot to production only through enforced, evidence-bound lifecycle gates

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Head of institutional programs / pilot owner (founder until another is named) |
| Deciders / reviewers | Founder; security owner; privacy owner; customer sponsor (per pilot); counsel for contract and data-role items (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate "no pilot without tenant-isolation negative suite and named rollback"; Phase 2 gate for multi-school activation |
| Related | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](../../operating-model/PILOT-TO-PRODUCTION.md); [`docs/PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md); [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md); D-134; ADR-0016, ADR-0017, ADR-0018; [`tenant-boundary-map.md`](../../architecture/tenancy/tenant-boundary-map.md) |
| Supersedes / superseded by | — |

> **Counsel required.** Pilot agreement, MSA/order form, DPA, student-data addendum, FERPA school-official role and security representations: `LEGAL_REVIEW_QUEUE.md` Q-03, Q-04, Q-05, Q-07; `CONTRACT_REVIEW_CHECKLIST.md`. No row has counsel assigned (Q-00).

## Context
- A lifecycle exists as data: `supabase/migrations/20260928050000_tenant_rollout.sql` (directory, requested, claimed, security review, sandbox/UAT, pilot read-only, pilot write-enabled, production limited, production active, expansion; paused, suspended, offboarded, archived) with exit gates in `app/src/lib/governance/rollout.ts`; the human copy is `docs/operating-model/PILOT-TO-PRODUCTION.md`, held by `docs.test.ts`. Check suite: `supabase/tenant-rollout.check.sql`.
- Pilot terms are enforced in app and database: `app/src/lib/gtm/pilot.ts` (`PILOT_WEEKS = 26`, `pilotReadiness`, `pilotDataMode`, `pilotVerdict` refusing `convert`/`expand` with a high-severity issue open); `supabase/migrations/20260929140000_gtm_pilot_26_weeks.sql`.
- Release profiles say `individual-scale` is `not-ready`, rollout `held` (`docs/PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md`, source `app/src/lib/governance/release-profiles.ts`).
- Gates a pilot would lean on are not evidenced: no cross-tenant negative suite (`database/TENANT_ISOLATION_MATRIX.md`; findings-database #1, P0); `enforce_membership` default false for every school (`20260930185000_school_membership_enforcement.sql`; #2); gateway tenant hard-coded `active` and deployment unproven (`app/server/institution/context.ts`; #7); live restore never exercised (`RESTORE.md`; findings-platform #1, P0); no live branch protection (findings-platform #2); one operator and no backup (#7).
- Offboarding is a procedure: `20260930200000_school_offboarding.sql` (proposed, approved, access_disabled, export_verified, archived, restored), `supabase/school-offboarding.check.sql`.
- Commercial: pilot is $27,000 in the repo (D-134 line in `docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`) while the program target is $30-45k (see ADR-0016).

## Problem
Which gates, in what order, must be evidenced (not merely documented) before a school's tenant may move to each lifecycle state, and what stops the move when evidence is missing or expired?

## Decision drivers
1. Gate state changes must be refused by the database, not by a person remembering a document (the tracker was "a document; nothing" enforced it, per the migration header).
2. Evidence is dated and expires; a stale drill blocks the next state.
3. A pilot is bounded: data mode (sandbox vs production), 26 weeks, named exit and rollback.
4. Reuse `rollout.ts`, `pilot.ts`, `school_offboarding`; add no parallel tracker.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Keep the lifecycle as tracker plus checklists | Exists today | Gate bypass possible; no evidence binding | Not chosen |
| B. Per-pilot bespoke gates in each order form | Flexible per customer | Contract-by-contract drift; counsel load | Not chosen |
| C. One gate set bound to the existing states, each gate naming a required evidence kind and expiry, enforced in the transition function | Uses existing tables | Requires evidence register in DB or generated check | **Recommended** |
| D. No pilots; production-only after full assurance | Lowest exposure | No learning; contradicts the repository's pilot posture (D-134) | Not chosen |

## Decision
**Recommended, unratified.** (1) Entering `pilot read-only` requires: tenant-isolation negative suite green for the pilot's table classes; `enforce_membership` reviewed through `school_enforcement_readiness()` and a recorded decision; backup operator named; restore drill completed on a second project with a non-author witness; signed pilot agreement and DPA (counsel required). (2) Entering `pilot write-enabled` additionally requires: named rollback for the school's writes, an audit reference on every sensitive mutation the pilot uses (ADR-0019), AI tier approvals for each enabled path (ADR-0014), and a support path (ADR-0020). (3) `production limited` and above require 26-week outcome verdict via `pilotVerdict`, an incident tabletop with the sponsor (ADR-0018) and the SLA row closed or expressly excluded in the order (counsel required). (4) A gate's evidence expires (proposed: 90 days for drills, 30 days for tenant-isolation run); an expired gate blocks the next transition and offers `paused`. (5) Pilot terms (26 weeks, price, data mode) are read from the price book in ADR-0016, not copied. This is not ratified.

## Consequences
Positive: a pilot cannot start on a promise. Negative: Phase 1 work (negative suite, restore drill, backup operator) now precedes the first pilot; pipeline timing slips. Harder: giving a design partner early write access.

## Impact
- **Data / tenancy:** transitions are tenant-keyed; pilot data mode separates sandbox from production rows.
- **Security:** isolation and restore evidence are preconditions.
- **Privacy:** production data only after DPA and role determination (counsel required: Q-04).
- **Accessibility:** pilot gate lists accessibility evidence status; no claim is made here (Q-06).
- **Operations (SLO, alert, runbook, support):** pilots need an alert route that reaches a human (findings-platform #3).
- **Cost / commercial:** gates add cost to a pilot priced at $27,000 today; commercial reconciliation is in ADR-0016.

## Implementation
1. Define evidence kinds per gate in `app/src/lib/governance/rollout.ts`; add a SQL guard in the rollout transition function (new migration, roll forward only).
2. Add `school_enforcement_readiness()` result to the gate record.
3. Wire `pilot.ts` readiness to the same gate set; keep `docs/operating-model/PILOT-TO-PRODUCTION.md` generated from data (`npm run registers`).
4. Run Phase 1 blockers (negative suite, restore drill) before first transition.

## Tests and verification
- `supabase/tenant-rollout-evidence.check.sql` (proposed): moving a school to `pilot read-only` with no negative-suite evidence is refused; fails against today's function. Control: move with evidence succeeds.
- Expired drill evidence blocks `pilot write-enabled` (clock set 91 days later).
- `app/src/lib/gtm/pilot.test.ts`: a pilot of 27 weeks is refused (exists; confirm).
- Revert-the-fix check: drop the guard and watch the first test go red, then restore.

## Fitness functions
- `tenant-boundaries` (#5): negative suite green is a gate input; `scripts/architecture/tenant-boundaries.sh`.
- `restore-drill-freshness` (#17): fails if no dated drill within 90 days; `scripts/architecture/restore-drill-freshness.mjs`.
- `release-evidence` (#11): fails a transition citing expired evidence.
- `branch-protection-readback` (#13): live ruleset readback is a gate input.

## Rollback / reversal
A school can be `paused` or `offboarded` (restorable until `archived`, per `school_offboarding`). Un-writing production data written during a pilot is not cheap after write-enable; this is why write-enable has the stricter gate.

## Open questions
Whether any school is already past `claimed` in production (not inspected); who is backup operator; whether the gateway or direct-RLS path is the pilot path.

## Addenda
None.
