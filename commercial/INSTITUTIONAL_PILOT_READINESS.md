# Semester — institutional pilot readiness (Phase 0)

**Date:** 2026-10-04 · **Status:** BASELINE — authorizes no pilot, price, tenant or data · **Controlling:** [`GO-NO-GO-DECISION.md`](../GO-NO-GO-DECISION.md) (paid pilot **NO-GO / RED**; design-partner **GO / GREEN, non-activation only**) · **Executable gates:** `app/src/lib/governance/release-profiles.ts` (`paid-institutional-manual-pilot`, `paid-institutional-pilot`), generated contract `docs/PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md`

> Contract, DPA, privacy, accessibility, security-representation and pricing questions are for qualified counsel and the named assessors. Nothing here is a legal conclusion.

## 1. Pilot baseline in the program vs the repository

The program's baseline is a **proposal**. None of it is approved or encoded.

| Program baseline | Repository state |
| --- | --- |
| Paid pilot $30,000–$45,000 | Finance model $12k + $15k implementation = $27k (`docs/finance/02-…`); `docs/commercial/PRICING-AND-PACKAGING.md`: "[APPROVED FEE OR NO-FEE TERM REQUIRED]"; D-1154 sets minimum ACV pilot $15k in `deal-desk.ts` (proposed default) |
| Defined cohort/department | `docs/pilot/*`, `PILOT-SUCCESS-PLAN` templates; **no cohort** |
| Defined success metrics | `PILOT-SCORECARD`, `docs/COMPANY-FIRST-YEAR-MEASURES.md` templates; no baseline frozen |
| Executive sponsor | **None** (`ops/customer-commitments/README.md`) |
| Implementation charter | `docs/institutional-readiness/PILOT-GOVERNANCE-CHARTER` template |
| Data / integration plan | `docs/migration/01..06`, `docs/INTEGRATION-CONTROL-PLANE.md`; **no adapter** (V) |
| Training, support plan | templates; support unstaffed |
| Security / procurement packet | drafts; HECVAT workbook not filled in; no independent assessment |
| Pilot dashboard | `app/src/lib/governance/*` models; no tenant data |
| Acceptance criteria, conversion plan | `docs/PILOT-TO-ANNUAL-CONVERSION.md` draft |
| Pilot ≤ 6 months, credit ≤ 50% | `deal-desk.ts` `DEAL_POLICY` proposed defaults |

## 2. Product proof required (and its state)

| Proof | State | Evidence | Gap |
| --- | --- | --- | --- |
| Tenant isolation across API/RPC/DB/storage/search/queue/worker/AI | **Built, not proven** | 110 `.check.sql` suites (not run in Phase 0); `gateway.test.ts`; `context.test.ts` | No HTTP-level cross-tenant test on a target; storage test not found (N); FORCE RLS 0 (V) — **G-P1** |
| Roles / capabilities | Built | `role_grants`, `capabilities.check.sql` | Target role test — G-P2 |
| Policy | Partial | PDP in productivity only | G-P3 / PR-05 |
| Audit | Built | chains, gateway journal | Mutable financial tables outside chain |
| **Integrations** | **Absent as connectors** | `ADAPTERS = []`, `adapters = []` (V) | **G-P5 — the largest product gap for a pilot** |
| SSO / SCIM | Built, delegated/gated | `bind_institution_sso_membership`, `scim.ts` (`SEMESTER_SCIM=on`) | No tenant acceptance |
| LTI 1.3 | Built | `functions/lti`, grade passback | No tenant |
| Implementation workflow | Partial | `lib/migration/*`; workflow builder has no executor | G-P6 |
| Source/freshness labels | Built | `Disclosure.tsx`, `SourceBadge` (CLM-018 proposed, not approved) | Brief's vocabulary unchecked (U-03) |
| Staff workspaces | Built | `Console`, registrar, gradebook | No tenant; offboarding operator-only |
| Offboarding / export / exit | Built in DB, no caller | `propose_offboarding` … `restore_school` | **G-C2** wire + drill |
| Governed AI | Gateway only | `intelligence.ts` | Consumer bypass — PR-01 |

## 3. Company proof required (and its state)

| Proof | State | Evidence |
| --- | --- | --- |
| Legal entity able to sign | **Absent** | `LEGAL-REVIEW-QUEUE.md` Q-01 |
| Counsel-approved pilot agreement, MSA/order form, SOW, DPA, student-data addendum | **Drafts** | `docs/legal-drafts/*` (parties `[SEMESTER LEGAL ENTITY]`) |
| Price authority and signing authority | **Absent** | `PRICING-AND-PACKAGING.md`; D-1154 second approver has no matrix entry |
| Tax/accounting/payment controls; insurance | **Absent** | `docs/finance/13-REAL-NUMBERS-INTAKE.md`; `INSURANCE-READINESS-CHECKLIST.md` |
| Security packet + independent assessment + clean DAST | **Absent** | FR-003 |
| Accessibility review/ACR | **Absent** | FR-007 |
| Named support, escalation, on-call | **Absent** | `MONITORING.md` "no rota" |
| Training (admin/faculty/student launch kits) | **Drafts** | `docs/commercial/CUSTOMER-ONBOARDING-PLAYBOOK` |
| Procurement / trust-room flow | **Partial** | `functions/trust-room`, `docs/TRUST-CENTER.md` |
| Named customer sponsor, cohort, UAT, approved data map | **Absent** | FR-002, FR-012 |

## 4. Conversion rule (from `GO-NO-GO-DECISION.md`, unchanged)

A paid institutional pilot is reconsidered **only after** a bounded design-partner engagement has an approved activation record and a measured closeout. The gate list (summarized from the decision and `release-profiles.ts`):

1. Exact-SHA hosted CI + target checks. 2. DAST + independent security assessment, no open P0/P1. 3. Qualified accessibility review. 4. Counsel-approved paper and public policies. 5. Entity, price/signing authority, tax/accounting/payment, insurance decision. 6. Staffed support, monitoring, incident coverage. 7. Restore, rollback, incident, export/deletion, revocation, offboarding **exercised on target**. 8. Named customer scope, data/integration map, UAT. 9. Baseline, outcome and reference authority.

**Phase 0 finding:** items 1–9 are all open. The two **engineering** items that gate a *connected-data* pilot and are not yet scoped anywhere are: **first adapter** (G-P5) and **target-tenant isolation test over HTTP** (G-P1). A *manual-data* pilot (`paid-institutional-manual-pilot`) avoids G-P5 but not G-P1.

## 5. What can be done now with a design partner (GREEN boundary)

Discovery; synthetic demonstrations; evidence exchange (the claims-controlled trust center and questionnaire drafts, with limitations disclosed); conditional scoping; fit/limitation review. **Not**: live data, tenant activation, customer or logo claims, production integrations, a launch promise, payment.

## 6. First three pilot-enabling actions (all outside the build rule except where marked)

1. Engage counsel (Q-00) and form the entity (Q-01).
2. Owner records price authority (`D-<PR#>`).
3. *(S1 gate evidence)* Scope a target-tenant HTTP isolation test (G-P1) in Phase 1 step 7/8.
