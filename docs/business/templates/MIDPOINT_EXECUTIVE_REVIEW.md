# Midpoint Executive Review

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BLANK REVIEW TEMPLATE - NO PILOT RESULTS EXIST** |
| Owner | Harrison Rubin (interim, Semester presenter; backup unassigned). Customer executive sponsor: [name] |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: privacy] [REVIEW: counsel] |
| Audience | Customer executive sponsor (the one-page section, once approved); the Semester notes are [INTERNAL] |

> Operating document, not legal or privacy advice. The recommendation is a proposal for the sponsor to decide; it is not a conversion, renewal or commitment.

Label legend: **[VERIFIED]** proved by path; **[ASSUMPTION]** planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent. Value labels: `ACTUAL`, `ESTIMATE`, `NOT MEASURED`, `SUPPRESSED`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md) | Controlled blank executive **outcome** review (end-of-pilot), identity block | A **midpoint** (continue/adjust/stop) one-pager aimed at the executive sponsor, a go/adjust/stop recommendation rule and a conversion-readiness checklist | The existing review is the end-of-pilot outcome review; midpoint has different decisions |
| [`../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md) | Decision cadence including a midpoint (correct/pause/stop) | A concrete page and checklist for that step | Playbook is prose |
| [`WEEKLY_PILOT_REPORT.md`](WEEKLY_PILOT_REPORT.md), [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md) | Weekly figures, metric definitions | Midpoint reads *trajectories* from them | n/a |
| [`../../../app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts) | `midpointReviewDate` is required by `pilotReadiness` (`no_midpoint`) | Midpoint is therefore a dated, mandatory event | Code is authoritative |

## Gate

Applies only to a live pilot (launch council go, signed paper, activation), all **HELD** today. Rehearsal on synthetic data is allowed and must be labelled "REHEARSAL - SYNTHETIC".

## Agenda (45-60 minutes) **[DRAFT]**

| Min | Item | Output |
| --- | --- | --- |
| 0-5 | Purpose, scope reminder, what this review can decide (continue / adjust / stop) and what it cannot (conversion, price, scope expansion) | Shared frame |
| 5-15 | Safety, trust, guardrails first: incidents, privacy, accessibility, support capacity | Any stop condition triggered? |
| 15-30 | KPI vs baseline vs target (page below), with denominators, suppression and source labels | Trajectory read |
| 30-38 | Participant voice (pulse, themes), staff burden, support | What students and staff are actually saying |
| 38-45 | Risks, dependencies, customer-side blockers | Owners and dates |
| 45-55 | Recommendation: go / adjust / stop; decisions needed; conversion-readiness checklist | Sponsor decision recorded |
| 55-60 | Actions, owners, dates; confirm final-review and conversion-decision dates | Minutes |

## One-page executive summary **[DRAFT]** (this is what the sponsor receives)

**Pilot:** [name] **Sponsor:** [..] **Period:** [start]-[end]; midpoint at week [n] of [term] **Cohort:** [N_c] (invited [N_e]) **Scorecard version:** [v] **Overall RAG:** [G/A/R]

**Bottom line (three sentences, plain language):** [What is working; what is not; what we recommend and why.]

| Primary metric | Baseline | Target [ASSUMPTION] | Midpoint value | Num / den | Source label | Status vs trajectory |
| --- | --- | --- | --- | --- | --- | --- |
| [M1 Activation] | [..] | [..] | [..] | [n / N] | [ACTUAL] | [On / behind / ahead / not measured / suppressed] |
| [M2..M5 as chosen, 3-5 total] | | | | | | |

Diagnostic (not proof): [raw usage items, if any, labelled as such].

| Guardrail | Stop threshold (signed before launch) | Current | Status |
| --- | --- | --- | --- |
| Privacy incidents | [..] | [..] | |
| Accessibility barriers (P0/P1 open) | [..] | [..] | |
| Support volume per 100 students / response against written commitment | [..] | [..] | |
| Data quality and reconciliation | [..] | [..] | |
| Participant burden / opt-out rate | [..] | [..] | |

**Top risks** (max three, each with owner and date): [..]

**Decisions needed from the sponsor today:** [ ] continue as is [ ] adjust: [what, owner, date] [ ] pause: [..] [ ] stop: [..]

**What this review does not tell you:** outcomes are not yet measured at term level; usage and self-report are non-causal; nothing here predicts retention, graduation or GPA.

## Go / Adjust / Stop recommendation rule **[DRAFT]**

| Recommend | When (all must hold unless stated) |
| --- | --- |
| **Go (continue)** | No guardrail breached; primary metrics at or ahead of trajectory or behind with an explained, owned recovery; data sources `ACTUAL`; customer-side owners engaged; weekly reviews held |
| **Adjust** | One or more primary metrics behind trajectory with a specific, testable change; or a data/definition gap that can be fixed without changing frozen definitions (changes are versioned decisions, not retrofits); or a customer-side dependency late. State the change, its effect on the plan, new date |
| **Stop** | Any guardrail stop threshold breached; unauthorized data; unstaffed support; a P0/P1 unresolved past its date; sponsor or champion withdrew; the pilot cannot be measured. Stop is a legitimate outcome (`PilotDecision` includes `stop`) |

The recommendation is Semester's; the decision is the sponsor's and is recorded with date and name.

## Conversion-readiness checklist **[DRAFT]** (status at midpoint; completed at final review)

Conversion is a separate, later decision; this checklist shows how ready it would be. Code reference: `pilotVerdict` refuses a final result without a signed decision, and convert/expand without zero unresolved high-severity issues.

| # | Item | Met? | Evidence |
| --- | --- | --- | --- |
| 1 | Executive sponsor, champion and decision maker named and engaged | | |
| 2 | Conversion decision date set within -14/+30 days of end (code rule) | | |
| 3 | Baselines captured and frozen for 3-5 primary metrics | | |
| 4 | Primary metrics measured with source `ACTUAL` and denominators | | |
| 5 | Security, privacy, accessibility reviews accepted by the customer; exceptions with expiry | | |
| 6 | No unresolved high-severity issue (needed for convert/expand) | | |
| 7 | Support and implementation staffing for an annual term identified (not unassigned) | | |
| 8 | Annual scope and price discussed under approved paper **[HELD: price not approved; paid pilot NO-GO]** | | |
| 9 | Budget source and procurement path for annual term confirmed | | |
| 10 | Offboarding alternative defined (export, revocation, deletion) | | |
| 11 | Reference/case-study permission **not** assumed; separate, claim-specific (CLM-013/014) | | |

## Semester notes **[INTERNAL]**

Capacity used versus planned; costs incurred (AI, cloud, support); implications for [`RISK_REGISTER.md`](RISK_REGISTER.md); whether the pilot-length decision (26 weeks versus 8-12 weeks) is still open and whether the midpoint date would move.

## Evidence state

**Repository evidence. [VERIFIED]** `pilotReadiness` requires a midpoint date; the weekly and outcome review documents exist.

**Operational evidence.** No pilot, midpoint review or sponsor decision exists.

**Missing proof.** Rehearse on synthetic data; run with a real sponsor; confirm stop thresholds were signed before launch.

## Claim ceiling

Semester may describe a midpoint review with a go/adjust/stop decision by the customer sponsor.

## Prohibited claims

Do not present a midpoint reading as an outcome, a recommendation as a conversion, or any figure as a result before approved observed values exist.

## Professional review required

Student-data handling in the review: [REVIEW: privacy]. Conversion/pricing language: [REVIEW: counsel].
