# Phase gate log

**Purpose.** The dated record of each phase gate: the criteria, the evidence, the result and the exceptions. **Status** Phase 0 baseline — evidence-cited, not a readiness claim. A gate result here is a repository-evidence reading; it is not customer, counsel, security-assessor or accessibility-assessor approval, and an agent cannot grant any of those. Result vocabulary: PASS, PASS WITH DATED EXCEPTIONS, NO-GO.

## Gate 0 — baseline, traceability, ADR foundation (2026-10-04)

**Criterion (program).** Every significant product/domain/security/operations boundary has an owner, traceability, a risk classification and a next action.

| Criterion element | Evidence | Reading |
|---|---|---|
| Boundaries enumerated with a classification | 16 tenancy boundaries and the privileged surface (`docs/architecture/tenancy/tenant-boundary-map.md`, `docs/architecture/security/privileged-surface-map.md`); 12 AI invocation paths (`docs/architecture/ai/ai-policy-enforcement-map.md`); 105 capability rows (`docs/program/CAPABILITY_TRACEABILITY_MATRIX.md`); commercial rows (`commercial/READINESS_GAP_MATRIX.md`) | Met |
| Owner | 14 domains keyed to seats (`docs/program/DOMAIN_OWNERSHIP_MATRIX.md`); owners on every ADR and risk are **roles**. One person holds every seat and the backup is unassigned (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`; R-018) | Met as accountability; not as independence |
| Traceability | capability -> UI -> state -> contract -> DB -> policy -> test -> ops, per row, with a label | Met for the 105 rows; per-table RLS/audit for the 50 browser-written tables is not written (R-003) |
| Risk classification | 36 risks, 2 P0, 22 P1 (`docs/program/RISK_REGISTER.md`) | Met |
| Next action | Ordered Phase 1 plan with slice and proof per step (`docs/program/PHASE_1_EXECUTION_BACKLOG.md`) | Met |
| ADR system and backlog | template, review policy, rights, checklist, index, backlog and Proposed ADR-0001..0025 under `docs/decisions/` and `docs/governance/` | Met as drafts; **none accepted** |
| Fitness functions identified | `docs/governance/FITNESS_FUNCTIONS.md`: 20 rows, existing mechanism, CI status, gap; no script created | Met as a map; none implemented |
| Legal queue and public claims | `docs/legal/LEGAL_REVIEW_QUEUE.md`, `PUBLIC_CLAIMS_APPROVAL_REGISTER.md` (15 over-evidence claims), contract and privacy views; counsel is not engaged | Met as a queue |

**Verification run in this session.** `app/src/lib/ops/decisionlog.test.ts`, `app/src/lib/trust/legal-drafts.test.ts` and `app/src/lib/docs/trust-docs.test.ts`: 59 of 59 passed after the changes below. Control: before the changes the three guards failed 8 assertions (the decision-log guard on `docs/decisions/ADR_TEMPLATE.md`; seven on the four new `docs/legal/` files). The full suite, `tsc -b`, lint, `check:university` and `test:shuffle` were **not** run; this change touches only documentation and those two guards' allow-lists.

**Result: PASS WITH DATED EXCEPTIONS.**

| # | Exception | Owner (role) | Expires |
|---|---|---|---|
| E-1 | The audit read the repository and the repo's own catalog-measured documents (`database/*.md`, dated 2026-10-04). Nothing was run against production or a database; no `*.check.sql` or suite was executed for the audit documents. Findings are labelled by what code shows | Chief of staff | Phase 1 step 2 (live catalog read) |
| E-2 | All 25 ADRs are Proposed and unratified; no owner has reviewed one | Founder | 2026-11-04 |
| E-3 | Owners are roles held by one person; no customer seat is identified | Founder | 2026-10-18 |
| E-4 | Coverage gaps: not every top-level directory was read to the same depth (see "Open questions / not verified" in `docs/program/BASELINE_AUDIT.md`) | Chief of staff | 2026-11-04 |
| E-5 | Two existing guards were widened to admit the new documents (`app/src/lib/ops/decisionlog.test.ts` sidecar names; `app/src/lib/trust/legal-drafts.test.ts` four program registers) and four rows were added to `docs/trust/DOCUMENT-MAP.md` | Quality architect | Review at ADR-0001 acceptance |

## Gate 1 — security, tenancy, recovery, platform spine

**Criterion (program).** NO-GO until cross-tenant isolation, AI policy enforcement, restore evidence, grant hardening, privileged-function review, production rollback, staging, audit/outbox coverage and platform gateway adoption pass.

| Element | State on 2026-10-04 | Risk |
|---|---|---|
| Cross-tenant isolation | no per-class negative suite written or run | R-001 (P0) |
| AI policy enforcement | enforced in the institution gateway only; other paths bypass | R-010..R-013 |
| Restore evidence | local logical rehearsal only; live restore/PITR never exercised | R-002 (P0) |
| Grant hardening | reduction proposed, not applied; ~24 anon DML grants | R-007 |
| Privileged-function review | 205 vs 269 definers unreconciled; bodies unreviewed | R-006 |
| Production rollback | documented, never exercised | `ROLLBACK.md`; R-028 |
| Staging | documented, steps never run; IaC unapplied | R-027 |
| Audit/outbox coverage | uneven; outbox has one producer | R-009 |
| Platform gateway adoption | `decide(` has one non-test caller | R-019 |

**Result: NO-GO.** Phase 1 has not started. Nothing in this Phase 0 package changes that reading.

## Later gates
Gates 2–10 are not assessed. No claim of "ready for mass use", "institution-ready", "pilot-ready", "contract-ready", "secure", "accessible", "production-ready" or "replacement-ready" is supported by this evidence, and `docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md` lists the public claims that already exceed it. `GO-NO-GO-DECISION.md` (2026-10-03) remains the standing recommendation: paid pilot NO-GO, broad enterprise NO-GO.
