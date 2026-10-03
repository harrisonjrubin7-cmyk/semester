# Renewal and Expansion Playbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAYBOOK — NO RENEWAL, EXPANSION OR ANNUAL CONVERSION EVIDENCED** |
| Owner | Harrison Rubin — company-side renewal owner; finance, delivery, success, counsel and customer approvers unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Source | [`../market-readiness/RENEWAL-PLAYBOOK.md`](../market-readiness/RENEWAL-PLAYBOOK.md) |

## Set the decision before launch

Record contract end/notice/renewal terms, decision date, approving stakeholders, evidence requirements, annual-scope hypothesis, approved pricing method, implementation/support/capacity needs, security/privacy/accessibility review triggers, data disposition and clean offboarding alternative. No auto-renewal, expansion assumption, logo/reference use or continuing data access outside explicit approved terms.

## Decision cadence

1. **Ongoing:** maintain accepted scope, delivery/guardrails, issues/changes, billing status, customer decisions and offboarding readiness; do not manufacture urgency or conceal limitations.
2. **Midpoint:** review observed outcome trajectory with caveats, implementation completion, reliability/recovery, support/delivery cost, trust/accessibility/rights issues, sponsor/champion continuity, integration burden and repeatability. Choose correct/pause/stop actions early.
3. **Pre-decision:** reconcile contract notice dates, decision authority, customer evidence, total cost/capacity, price approval, open risks, target changes and required new reviews/UAT.
4. **Final:** present results and missingness, incidents/rights, unresolved risk, proposed adjacent annual/expansion scope, responsibilities, support, price/order and offboarding alternative. Customer and Semester record renew, expand, narrow, stop or offboard. A narrow extension is not a final renewal outcome in the current schema: keep the renewal opportunity at an appropriate non-`decided` stage with outcome `pending`; preserve the signed extension end/decision date, purpose, price, scope and risk in the contract/decision record; and set `renewal_date` to the new written term end minus 120 days because that field represents the next review-opening date, not the term end. Report extensions separately from both final outcomes and unresolved no-decision records.
5. **Execute:** renewal/expansion requires authorized order/change, capacity, risk review, implementation plan and launch gate for new scope. Otherwise complete export/revocation/deletion/retention/transition and confirmation.

Convert only when value is accepted by the customer, required evidence and P0/P1 closure exist, delivery/support capacity is credible, price/economics and paper are approved, and scope is adjacent/supportable. A narrow extension needs written purpose/dates/price/risks, remains `pending` until a representable final outcome is authorized, and cannot defer a failing guardrail indefinitely.

## Evidence state

**Repository evidence.** Pilot scorecard, health, implementation, pricing, commercial, support and offboarding controls define required decision inputs.

**Operational evidence.** No customer contract cohort, renewal decision, approved annual price/scope, observed retention/expansion, repeatability evidence or staffed renewal operation exists.

**Missing test/proof.** Operate one pilot through final decision; reconcile finance/delivery/outcomes/risks; approve annual or exit terms; obtain customer authority; execute renewal/expansion gates or complete verified offboarding.

## Claim ceiling

Semester may use this playbook to plan a transparent customer renewal/expansion or offboarding decision.

## Prohibited claims

Do not claim retention, renewal, expansion, annual conversion, reference rights, recurring revenue or customer value from a proposed scope, ongoing discussion, extension or unsigned order.
