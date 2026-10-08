# Final Value Report

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BLANK REPORT TEMPLATE - NO PILOT HAS RUN, NO VALUE IS CLAIMED** |
| Owner | Harrison Rubin (interim, author; backup unassigned). Customer sponsor and measurement owner: [names] |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: privacy] [REVIEW: counsel] |
| Audience | Customer sponsor and decision maker. It is the customer's record; use outside the customer needs claim-specific written permission |

> Operating document, not legal advice. A final value report is a record of what was measured, not a promise of anything.

Label legend: **[VERIFIED]** proved by path; **[ASSUMPTION]** planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent. Value labels: `ACTUAL`, `ESTIMATE`, `NOT MEASURED`, `SUPPRESSED`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md) | Executive outcome review record | A complete **report structure**, the five-record **pilot-complete checklist** and the claims-permission section | The review is a meeting record; the report is the deliverable |
| [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md) | Decision record and four paths (convert conditionally / extend / pause / stop), universal closeout checklist | Referenced for Part 9; not repeated | n/a |
| [`../../market-readiness/CASE-STUDY-TEMPLATE.md`](../../market-readiness/CASE-STUDY-TEMPLATE.md) | Case-study fields and prohibitions | A case study is derivative of this report and only with permission (Part 10) | Different artifact |
| [`../../commercial/ROI-MODEL-AND-BUSINESS-CASE.md`](../../commercial/ROI-MODEL-AND-BUSINESS-CASE.md), [`ROI_CALCULATOR_INPUTS.md`](ROI_CALCULATOR_INPUTS.md) | Scenario ROI method and inputs | Part 5 uses them | One method |
| [`../../../app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts) | `pilotVerdict`: no signed decision, no outcome; convert/expand blocked by open high-severity issues | The completion checklist mirrors it and adds the other records | Code is authoritative |

## Gate

Applies to a pilot that has run. Today none has; paid pilot NO-GO/RED. Rehearse on synthetic data only, labelled so.

## Pilot-complete checklist **[VERIFIED] rule, [DRAFT] form**

**A pilot's status may be set to `complete` only when ALL FIVE of the following are recorded, each with date, approver and a link. Missing one means the status stays `in_progress` (or `decision_pending`), however good the numbers look.**

| # | Required record | Recorded? | Date | Approver | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | **Activation** - the pilot was activated for the named cohort on authorized paper with the launch council's go (stage `live`) | [ ] | | | |
| 2 | **Workflow completion** - the target workflow's completion measured (M3) with denominator, source label and suppression | [ ] | | | |
| 3 | **Outcome measurement** - all primary metrics (3-5) measured against frozen baselines, with limitations, missingness and censoring | [ ] | | | |
| 4 | **Executive review** - the final value review held with the executive sponsor; this report presented | [ ] | | | |
| 5 | **Conversion decision** - a signed written decision (`convert` / `expand` / `pause` / `stop`) with `signedBy` and `signedAt`; for convert/expand, zero unresolved high-severity security, privacy or policy issues (`pilotVerdict`) | [ ] | | | |

Status values: `not_started`, `in_progress`, `decision_pending`, `complete`. The CRM may set `renewal` only after a signed final verdict with outcomes measured (`SALES_EXIT.renewal`). An unsigned, missing or ambiguous decision is **pending**, not conversion. Vocabulary note: code uses `expand`; the closeout plan says `extend`, which the code does not have **[DECISION OPEN]** (counsel/founder to align).

## Report structure and required evidence **[DRAFT]**

### Part 1. Executive summary
One page: pilot identity, cohort, term, headline per primary metric with `ACTUAL/ESTIMATE` label, guardrail summary, recommendation, decision requested. **Required evidence:** every number traces to Part 4.

### Part 2. Scope as run
Included, excluded, data mode (sandbox/production), integrations (none or approved read-only), changes during the pilot with versions and approvals. **Required evidence:** frozen scope version; change log.

### Part 3. Population and participation
Eligible, invited, activated, active by week; exclusions; denominators; suppression. **Required evidence:** roster aggregate counts reconciled to events.

### Part 4. Results against baseline and target
| Metric | Baseline (frozen, date) | Target [ASSUMPTION] | Result | Num / den | Source label | Interpretation limit |
| --- | --- | --- | --- | --- | --- | --- |

Plus trajectory chart data by week, the **window length** (26 weeks per code or the agreed measurement window) and the explicit statement whether a comparison cohort existed (usually not; then "non-causal"). **Required evidence:** frozen definitions, queries and event versions; raw-to-aggregate reconciliation; sample QA for first-action events.

### Part 5. Business case (customer-owned)
Scenario ROI from [`ROI_CALCULATOR_INPUTS.md`](ROI_CALCULATOR_INPUTS.md): low/base/high, lines not included, customer internal cost included. Labelled **scenario estimate, not a guarantee**. **Required evidence:** customer's own inputs and their finance owner's challenge.

### Part 6. Student and staff experience
Pulse results with response rates (suppress < 10), themes, accessibility feedback, what did not work. **Required evidence:** survey instrument and method.

### Part 7. Safety, trust and operations
Incidents, privacy/accessibility cases, support volumes and response against the written commitment, reliability observations (no uptime inference), open findings and their disposition. **Required evidence:** incident log; support system export (aggregate).

### Part 8. Cost to serve **[INTERNAL section; remove if shared]**
Semester hours, AI/cloud cost, support; compared with planning assumptions. Feeds the company model (the Finance model tab of the operations console and [`../../finance/04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md)).

### Part 9. Decision and next steps
Recommendation and the **conversion-readiness checklist** from [`MIDPOINT_EXECUTIVE_REVIEW.md`](MIDPOINT_EXECUTIVE_REVIEW.md) completed. Paths: [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md). Any annual proposal is a **new transaction**: new scope, price (`[PRICE TO BE CONFIRMED]`), terms, readiness and activation. **Required evidence:** the signed decision.

### Part 10. Lessons and limitations
What we would change; what the data cannot show; open items.

## Claims-permission section **[VERIFIED] rules**

Outcomes, quotes, logos, names and references are **not** Semester's to use. Each requires **claim-specific written permission** from the institution (and any individual quoted), recorded against [`../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md):

| Claim | Register row | Today | Needed |
| --- | --- | --- | --- |
| Named institution/customer, logo, quote, endorsement, live pilot, case study | **CLM-013** PROHIBITED TODAY | No executed permission | Rights-holder and Legal/Privacy/Communications approval for the exact wording, channel and term |
| GPA, retention, graduation, wellbeing, time savings, ROI, efficiency outcomes | **CLM-014** PROHIBITED TODAY | No approved baseline or complete measured result | Customer/data authority, Product/Analytics, Finance as applicable and Legal approval |

| Permission record | Value |
| --- | --- |
| Exact wording approved | [..] |
| Channel(s) and term | [..] |
| Who granted it (name, authority) / date | [..] |
| Revocation process | [..] |
| Consent for any quote (separately from the institution) | [..] |

Default: **no permission granted**. The report's existence does not grant it. Use [`../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md`](../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md) and [`../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md) as drafts only.

## Evidence state

**Repository evidence. [VERIFIED]** `pilotVerdict`, stage exits, claim register rows CLM-013/014 and the closeout plan exist.

**Operational evidence.** No pilot has run; there is no baseline, result, decision or permission.

**Missing proof.** One pilot run through all five records; a customer finance owner challenging Part 5; a permission process exercised.

## Claim ceiling

Semester may describe the report's structure and its rule that a pilot is complete only when five records exist.

## Prohibited claims

Do not state or imply a customer, pilot result, case study, outcome, time saving, ROI or reference. Do not set status `complete` on fewer than five records.

## Professional review required

Student data and thresholds: [REVIEW: privacy]. Permission and conversion language: [REVIEW: counsel].
