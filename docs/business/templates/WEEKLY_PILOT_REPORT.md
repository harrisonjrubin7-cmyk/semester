# Weekly Pilot Report

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BLANK REPORT TEMPLATE - NO OBSERVED PILOT RESULTS EXIST** |
| Owner | Harrison Rubin (interim, Semester-side author; backup unassigned). Customer reviewer: [name] |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: privacy] |
| Audience | Customer champion and sponsor once a pilot is live; **[INTERNAL]** until then. The "Semester internal addendum" is never shared |

> Operating document, not legal or privacy advice. Reports contain cohort aggregates only; no student-level data.

Label legend: **[VERIFIED]** proved by path; **[ASSUMPTION]** target/planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent. Data-source labels for values: `ACTUAL`, `ESTIMATE`, `NOT MEASURED`, `SUPPRESSED`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md`](../../institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md) | The meeting: decisions, safety, scope/data quality, scorecard, delivery, weekly decision (CONTINUE/CORRECT/PAUSE/STOP/ESCALATE) | A **report document** circulated before it: the eight requested measures with denominators, suppression, actual/estimate labels, support themes, pulse, RAG, decisions-needed | The review is the agenda; the report is the input |
| [`../../commercial/PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md), [`PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md) | Frozen metric definitions, baselines, privacy threshold | Linked; this report only fills them | One definition |
| [`../sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md) metrics M1-M8 | Metric table | Same ids used here | Consistency |
| [`../../commercial/CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md) | Proposed health dimensions; human-reviewed | Not used for scoring here | n/a |

## Gate

A weekly pilot report exists only for a pilot that is **live**, which requires the launch council's go, signed paper and activation, all **HELD** today (paid pilot NO-GO/RED; design-partner work is non-activation). Before activation, this template may be rehearsed on **synthetic data** labelled "REHEARSAL - SYNTHETIC", and its numbers never leave Semester.

## Reporting rules **[DRAFT]**

1. **Definitions frozen before launch** (scorecard version [v]); a change to denominator, source or exclusion is a versioned decision and never silently restates prior weeks.
2. **Denominators are always shown** as `numerator / denominator`.
3. **Suppress any cell where the group has fewer than 10 people** (aggregation floor, [`../../INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md)): print `SUPPRESSED (<10)`, never 0. Also suppress a cell that would let a suppressed cell be derived by subtraction (complementary suppression).
4. **Source label on every value:** `ACTUAL` (measured from a validated source), `ESTIMATE` (sampled or modelled; state method and sample), `NOT MEASURED`, `SUPPRESSED`. Never substitute zero for missing.
5. **Not vanity:** raw logins, page views and invitations sent are not activation or success.
6. Self-report and usage are non-causal; no GPA, retention, graduation or wellbeing inference.
7. Guardrails (privacy, accessibility, safety, integrity, data quality) outrank adoption: a red guardrail is reported first.

## RAG rules **[ASSUMPTION]**

| RAG | Metric rule | Guardrail rule |
| --- | --- | --- |
| Green | At or above the approved weekly trajectory toward target, with source `ACTUAL` | No open incident; no open P0/P1 |
| Amber | Within [10] points of trajectory, or source is `ESTIMATE`, or data gap in the week | Open P2 with owner and date |
| Red | Below trajectory by more than [10] points for two consecutive weeks, or `NOT MEASURED` for two weeks | Any P0/P1, privacy or accessibility incident, unauthorized data, support unstaffed |
| Grey | Suppressed or not yet due | |

Thresholds are placeholders to be agreed with the customer and frozen with the scorecard.

## Report - [Pilot name] - Week [N] of [pilot term], [DATE RANGE]

**Scorecard version:** [v] **Cohort:** [N_c] enrolled in pilot, [N_e] invited **Report author/reviewer:** [..] **Overall RAG:** [G/A/R] **Weekly decision requested:** CONTINUE / CORRECT / PAUSE / STOP / ESCALATE (a weekly review cannot authorize conversion or scope expansion)

### 1. Headline (three lines, plain words)
[What changed this week; what is at risk; what is needed from the customer.]

### 2. Safety and trust first
| Item | Status | Detail (aggregate only) |
| --- | --- | --- |
| Incidents / suspected exposure | [none / n] | [..] |
| Privacy / accessibility / safety cases | [..] | [..] |
| Open P0/P1 | [n] | [..] |
| Scope or data changes | [none / list] | authority: [..] |

### 3. Metrics (frozen definitions; see proposal section 10)

| # | Metric | Numerator / denominator | Value | Baseline | Target [ASSUMPTION] | Trend | Source label | RAG |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Activation | [n / N_e] | [%] | [..] | [..] | [up/flat/down] | [ACTUAL] | [ ] |
| M2 | First meaningful action | [n / activated] (censored: [n]) | | | | | | |
| M3 | Workflow completion | [items done / assigned] | | | | | | |
| M4 | Weekly active use (meaningful action; raw logins excluded) | [n / activated] | | | | | | |
| M5 | Staff time / support friction | [contacts per 100 students] | | | | | [ESTIMATE if sampled] | |
| M6 | Student confidence/satisfaction pulse (midpoint/final, else "not due") | [agree / respondents], response rate [%] | | | | | | |
| M7 | Support issue volume | [issues per 100 students] | | | | | | |
| M8 | Conversion-readiness checklist items met | [met / required] | | | | | | |

Only 3-5 metrics are primary (`pilotReadiness` metric_count); mark which. Show `SUPPRESSED (<10)` where applicable.

### 4. Support themes (aggregate)
| Theme | Count | Change vs prior week | Action / owner |
| --- | ---: | --- | --- |
| [e.g. login problem] | [n or SUPPRESSED] | | |

### 5. Staff time
[Staff-reported hours or sampled minutes; method; `ESTIMATE` unless from a timing sample.]

### 6. Risks and blockers
| Risk / blocker | Owner | Due | Escalation |
| --- | --- | --- | --- |

### 7. Decisions needed from the customer
| Decision | Who | By when | Consequence of delay |
| --- | --- | --- | --- |

### 8. Next week
Planned actions (max five), owners, dates; any scheduled communications; training; review dates (midpoint [DATE], final [DATE]).

### Data-quality note
[Missingness, reconciliation to source, exclusions, denominator changes with version.]

## Semester internal addendum **[INTERNAL]** (never shared)

Capacity this week (hours used by the single founder), cost incurred (AI, cloud, support time), forecast effect, risk register items touched ([`RISK_REGISTER.md`](RISK_REGISTER.md) ids), claims check (nothing here may become a public statement without claim-specific permission, CLM-013/014).

## Evidence state

**Repository evidence. [VERIFIED]** Scorecard, success plan, governance, aggregation floor and `pilotReadiness` exist.

**Operational evidence.** No pilot is live; no report has been produced or reviewed.

**Missing proof.** Validate source queries and suppression with a rehearsal on synthetic data; reconcile raw to aggregate; run the first report with an authorized customer reviewer.

## Claim ceiling

Semester may describe a weekly, suppressed, source-labelled reporting format.

## Prohibited claims

Do not present targets, synthetic entries, invitations, raw logins or incomplete denominators as results; do not show a cell under 10; do not claim adoption, success or impact before approved observed values exist.

## Professional review required

Suppression and student-data handling: [REVIEW: privacy]. Customer-facing wording: [REVIEW: counsel].
