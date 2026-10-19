# Mutual Action Plan Template

| Control | Value |
| --- | --- |
| Status | **[DRAFT] TEMPLATE - NON-BINDING. A plan of intended joint work, not a contract, launch approval or delivery commitment** |
| Owner | Harrison Rubin (interim; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] [REVIEW: procurement] |
| Audience | Shared with the customer once filled (the table); the "Internal notes" section and CRM mapping are [INTERNAL] and removed from the shared copy |

> Operating template, not legal advice. Dates are targets until the named owner on each side accepts them.

Label legend: **[VERIFIED]** proved by repository path; **[ASSUMPTION]** planning number or timing; **[DRAFT]** needs review; **[APPROVED]** none here; **[INTERNAL]** not sent as-is.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md`](../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md) | Delivery-side work plan with eleven stages, owner/due/status, exit evidence | A **customer-shared, two-sided** plan from first agreement to conversion decision, with *customer* owner column, blocker column, RAG and escalation | The implementation plan starts at contracting and is Semester's tracker; the MAP spans the sales cycle and is shared |
| [`../../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md`](../../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md), [`../../institutional-readiness/IMPLEMENTATION-RESPONSIBILITY-MATRIX.md`](../../institutional-readiness/IMPLEMENTATION-RESPONSIBILITY-MATRIX.md) | Who is responsible for what (RACI) | Dated deliverables, status and blockers per workstream | RACI is static |
| [`../../institutional-readiness/PILOT-GOVERNANCE-CHARTER.md`](../../institutional-readiness/PILOT-GOVERNANCE-CHARTER.md) | Pilot governance | Not repeated; MAP rows reference it | n/a |
| [`../../commercial/SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md), [`stages.ts`](../../../app/src/lib/gtm/stages.ts) | Stage definitions and exit rules | Mapping from MAP workstreams to stage exits (below) | Keeps one stage vocabulary |
| [`PILOT_PROPOSAL_TEMPLATE.md`](PILOT_PROPOSAL_TEMPLATE.md) | Section 15 refers here | n/a | n/a |

## Gate (what is allowed now versus held)

Source: [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md). **Allowed now:** every workstream may be *planned and agreed*, and the non-activation rows (executive sponsorship, security review, privacy review and DPA drafting, accessibility review, procurement preparation, baseline *definitions*) may proceed. **HELD:** rows that would commit money or live use: contract execution, invoice/payment, live-data configuration, launch comms to students, activation, annual conversion. Mark those `HELD (gate)` in Status until the gate flips; do not set a firm date.

## How to use

One plan per opportunity, opened at `outcome_workshop` and shared with the customer champion. Reviewed in every weekly pilot/revenue review. The customer editing a row is a good sign; a row with no customer owner is not a plan. Remove "Internal notes" before sharing.

**Header:** Customer [Institution] | Pilot [name] | Version [n] | Updated [DATE] | Customer sponsor [name] | Customer champion [name] | Semester owner Harrison Rubin (interim) | Target conversion decision [DATE]

## The plan **[DRAFT]**

Due dates are shown relative to anchors so they survive a shifted start: **K** = kickoff (launch day, only after the launch gate), **E** = pilot end date, **D** = conversion decision date. Replace with calendar dates when owners accept them.

| # | Workstream | Customer owner | Semester owner | Deliverable / completion evidence | Due date | Status | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Executive sponsorship | [Sponsor name] | Harrison Rubin (interim) | Sponsor named in writing; agrees decision date and stop/convert criteria; attends midpoint and final | [K-8 weeks] | Not started | |
| 2 | Security review | [Security contact] | Security owner [unassigned] (Harrison Rubin interim) | Questionnaire answered from the RFP library with each answer labelled; customer's written acceptance, exception list with owners; independent-assessment status stated as "not yet" unless it exists | [K-6 weeks] | Not started | Independent security assessment not done (GO-NO-GO #2) |
| 3 | Privacy / data review and DPA | [Privacy officer / registrar] | Harrison Rubin (interim); counsel [unassigned] | Data map approved; minimum-data list; DPA reviewed by counsel on both sides; retention/deletion terms [REVIEW: counsel] [REVIEW: privacy] | [K-6 weeks] | Not started | DPA draft not counsel-approved |
| 4 | Accessibility review | [Accessibility / disability services] | Harrison Rubin (interim); qualified assessor [unassigned] | Customer's accessibility review outcome, known-limitations statement, alternative-path agreed [REVIEW: accessibility] | [K-6 weeks] | Not started | No qualified manual review or VPAT |
| 5 | Procurement / contracting | [Procurement / legal] | Harrison Rubin (interim) | Pilot agreement and any order paper executed by authorized signers on both sides; deal-desk review with no refusals | [K-4 weeks] | HELD (gate) | Paid pilot NO-GO; signing authority, entity, tax, insurance open |
| 6 | Implementation / configuration | [IT / operational champion] | Implementation lead [unassigned] | Tenant configured in sandbox data mode, roles accepted, UAT passed, no open P0/P1 | [K-2 weeks] | HELD (gate) | No staffed implementation lead; no named-tenant UAT |
| 7 | Training and launch comms | [Champion / communications] | Customer success [unassigned] | Operators trained; student invitation wording approved; accessible materials; support route live | [K-1 week] | HELD (gate) | Staffed support not established (GO-NO-GO #6) |
| 8 | Baseline capture | [Customer analyst] | Harrison Rubin (interim) | Baseline values, definitions and queries frozen and versioned for the 3-5 primary metrics | [K-1 week] | Not started | Customer data owner not named |
| 9 | Weekly review | [Champion] | Customer success [unassigned] | Weekly pilot report issued and reviewed each week; decisions logged | [every week from K+1] | HELD (gate) | |
| 10 | Midpoint review | [Sponsor] | Harrison Rubin (interim) | Midpoint executive review held; go/adjust/stop recorded | [K + half of pilot term] | HELD (gate) | |
| 11 | Final value review | [Sponsor, champion] | Harrison Rubin (interim) | Final value report delivered; pilot-complete checklist satisfied | [E] | HELD (gate) | |
| 12 | Conversion decision | [Decision maker] | Harrison Rubin (interim) | Signed written decision: convert / expand / pause / stop (code vocabulary `PilotDecision`), no unresolved high-severity issue for convert/expand | [D] | HELD (gate) | |

Add rows as needed (data/integration approvals, student representative review, finance/PO, communications to minors' guardians). A new row needs both owners.

## Owner defaults and status rules **[DRAFT]**

| Role | Default owner when the plan is first drafted |
| --- | --- |
| Semester executive and commercial owner | Harrison Rubin (interim; single point of failure, backup unassigned) |
| Security owner | Unassigned (Harrison Rubin interim) |
| Implementation lead | Unassigned |
| Customer success | Unassigned |
| Counsel, CPA, insurance broker | Unassigned. Never invent a name; an unassigned professional is itself a blocker on the relevant row |

**Status vocabulary:** `Not started` / `In progress` / `Waiting on customer` / `Waiting on Semester` / `Blocked` / `HELD (gate)` / `Done (evidence linked)` / `Dropped (reason)`. `Done` requires the completion evidence in the deliverable column to be linked, with date and approver. A document existing is not completion.

**RAG rules (proposed [ASSUMPTION]):**

| RAG | Rule |
| --- | --- |
| Green | On or ahead of date with an accepted owner on both sides, no blocker |
| Amber | Due within 5 business days with no completion evidence, or one side's owner has not accepted, or a blocker has an owner and a date |
| Red | Past due; or a blocker has no owner/date; or a gate item (security, privacy, accessibility, legal) has an unresolved P0/P1; or a row has no customer owner |

A `HELD (gate)` row is shown grey with the named gate, never green.

## Escalation **[DRAFT]**

| Trigger | Action | Within |
| --- | --- | --- |
| Row Amber for two consecutive weekly reviews | Owners agree a recovery date in the review | Next review |
| Row Red | Escalate to the customer champion and Harrison Rubin; record in the decision log (category, owner, target date, risk level) | 2 business days |
| Red on a gate item, or sponsor/champion departure, or a blocker needing a decision above the champion | Escalate to the executive sponsor and the Semester founder; decide: re-scope, re-date, pause, or stop | 5 business days |
| Prohibited request (live data before activation, price commitment, claim outside the register) | Stop; do not agree; log; route to counsel | Same day |

## Mapping to CRM stage exit criteria **[VERIFIED]** against [`stages.ts`](../../../app/src/lib/gtm/stages.ts)

| MAP rows complete | Supports exit of / entry to | Rule in code |
| --- | --- | --- |
| 1 (named sponsor and committee roles mapped across 2-5) | `outcome_workshop` | The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor |
| 2, 3, 4 started | `proposal` | Security, privacy and accessibility review started, answered from the RFP library |
| 2-4 and 8 drafted, plan has no `pilotReadiness` problems | `pilot_or_implementation_SOW` | A pilot plan with no readiness problems |
| 5 | `contracted` | Procurement and legal have signed; deal-desk review has no refusals |
| 6, 7 | `implementation` then `live` | Launch council returned go for the first cohort |
| 11, 12 with a signed final verdict | `renewal` | Signed final `pilotVerdict` with outcomes measured |

CRM rule: a stage is not advanced from this plan alone; the exit evidence must be recorded on the opportunity with a date and an owner.

## Internal notes **[INTERNAL]** (remove before sharing)

Forecast category stays Omitted/Pipeline while any row 2-5 is not Done; rows marked `HELD (gate)` are never forecast as revenue. Open founder decision that changes dates: pilot length (26 weeks versus 8-12 weeks, [`PILOT_PROPOSAL_TEMPLATE.md`](PILOT_PROPOSAL_TEMPLATE.md) section 5).

## Evidence state

**Repository evidence. [VERIFIED]** Stage vocabulary, exit rules, pilot readiness and governance documents exist.

**Operational evidence.** No mutual action plan has been agreed with any customer.

**Missing proof.** Run one plan through a real discovery-to-proposal cycle and record which rows the customer never owned.

## Claim ceiling

Semester may describe this as a shared planning tool whose dates are targets.

## Prohibited claims

Do not present a plan row as a commitment, a held row as scheduled, an unassigned role as staffed, or any plan as a signed agreement or approved launch.

## Professional review required

Rows 3 and 5: [REVIEW: counsel] [REVIEW: privacy] [REVIEW: procurement]; row 2: [REVIEW: security]; row 4: [REVIEW: accessibility].
