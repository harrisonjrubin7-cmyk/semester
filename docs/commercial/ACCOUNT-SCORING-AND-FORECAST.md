# Account Scoring, Stage Exits and Forecast Model

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MODEL — SCORES ARE HYPOTHESES; NO FORECAST PROBABILITY IS APPROVED** |
| Owner | Harrison Rubin — company-side pipeline owner; backup seller, finance reviewer and deal desk unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Reconciles | the two 0–2 rubrics in [`../market-readiness/SALES-QUALIFICATION-SCORECARD.md`](../market-readiness/SALES-QUALIFICATION-SCORECARD.md) and [`../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md`](../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md), which scored different criteria under one name |

## Two scores, one purpose each

The repository had two ten-criterion, 0–2 rubrics that overlap but are not the same list. Neither is replaced. They are now two named scores that answer two different questions at two different times.

| Score | Question | When | Source of criteria | Range |
| --- | --- | --- | --- | --- |
| **Target score** | Which accounts do we approach first? | before any contact, at `target_account` | the targeting plan: urgent milestone; 50–200 cohort fit; champion access; economic buyer; procurement feasibility; manual/read-only fit; timing; evidence value; implementation capacity; reference potential | 0–20 |
| **Qualification score** | Is this opportunity real enough to spend delivery effort on? | from `discovery`, to enter `qualified` | the qualification scorecard, unchanged: urgent milestone; defined cohort; empowered champion; economic buyer; security/privacy/accessibility contacts; budget/procurement path; 30–60 day implementation feasibility; manual/read-only fit; measurable baseline/outcome; conversion decision date | 0–20 |

Both use the same bands, proposed and uncalibrated: **16–20** act now (target: pursue; qualification: qualified, subject to red flags), **11–15** hold or nurture (resolve the named gaps first), **0–10** disqualify or revisit later. The **automatic disqualifiers** of the qualification scorecard apply to both scores and override any total: prohibited high-impact AI; surveillance or individual risk scoring; an unsupported compliance or certification requirement; a required SIS/LMS write before approval; no lawful data authority; no champion; a demand to waive P0/P1; economics below delivery and support cost.

Rules that make a score honest:

- Every point cites an observation with a date and a source (a conversation, a public document, a named introduction). A point is never inferred from an institution's type, size or prestige.
- *Reference potential* orders who to approach. It is not a promise or a request of a reference and never appears in a customer-facing document (CLM-013).
- A score is rewritten when the account enters a new stage and is treated as stale 90 days after its newest cited observation (assumption; the owner may change it).
- Capacity caps the number of active pursuits: pursue the top three target scores at a time, as the targeting plan says, until delivery capacity is measured on a real pilot.
- Never score students or score an institution on student vulnerability, protected class or risk signals (see `MARKET-SEGMENTATION.md`).

## Tiers

| Tier | Meaning | Action |
| --- | --- | --- |
| A | target score 16–20, no disqualifier | pursue, within the capacity cap |
| B | target score 11–15 | discovery only if capacity allows; record the gap that would raise it |
| C | target score 0–10 or a disqualifier | hold; record the reason and the future-contact rule |

## Stage exits for the nine stages `SALES_EXIT` does not gate

`app/src/lib/gtm/stages.ts` codes a gate on seven stages by design: the ones that move money or promise delivery. The other nine are checked by people, against the checklists below, which expand the one-line evidence in [`SALES-PIPELINE-DEFINITIONS.md`](SALES-PIPELINE-DEFINITIONS.md). `stages.test.ts` fails if a stage here or there disappears. An exit is met only when every item is recorded on the opportunity with a date and an owner.

| Stage | Exit checklist |
| --- | --- |
| `target_account` | target score recorded with cited observations; no automatic disqualifier; source is a real warm path or an observed need (never a fabricated relationship); owner assigned |
| `discovery` | an authorized stakeholder met; the problem in their words, the milestone date, the cohort size, the data and integration need and the procurement path recorded (`DISCOVERY-CALL-PLAYBOOK.md`); qualification score computed; next step owned and dated |
| `multi_stakeholder_demo` | demo run from `DEMO-PLAYBOOK.md` on synthetic data only; attendee roles recorded; each stakeholder's top objection and evidence request logged; no statement outside `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`; next step dated |
| `technical_review` | architecture, data-flow and integration questions answered from the RFP library; integration scope stated as manual or read-only; no adapter promised that is not installed; every open question has an owner and a date |
| `security_privacy_accessibility_review` | questionnaire answered from the RFP library and `HECVAT-EVIDENCE-MATRIX.md`, each answer labelled per `PROCUREMENT-QUESTIONNAIRE-PROCESS.md` (implemented, pilot-scoped, planned, not applicable, customer responsibility, gap); exceptions have owners; the reviewer's acceptable prerequisites are written down; a SOC 2, VPAT or penetration-test requirement is recorded as either an accepted prerequisite or a disqualifier |
| `procurement_legal` | proposal accepted into formal review; redline register opened; deal-desk review run with no refusals (`governance/deal-desk.ts`); approvers named for each deviation |
| `implementation` | handoff accepted per [`STAGE-COLLATERAL-AND-HANDOFF.md`](STAGE-COLLATERAL-AND-HANDOFF.md); `pilotReadiness` returns no problems; owners and backups named; tenant created in sandbox data mode |
| `expansion` | separately authorized scope; adjacent cohort has its own readiness check and its own launch-council go; outcomes of the first scope measured against baseline |
| `closed_lost` | reason code, learning and future-contact rule recorded; suppression applied where the contact asked to stop |

## Forecast model

No pipeline value, probability, close date or forecast is approved or asserted (`SALES-PIPELINE-DEFINITIONS.md`). The model below is the method, ready to use the day approved inputs exist.

**Categories are defined by evidence, never by seller confidence.**

| Category | Stages and evidence | Counts toward |
| --- | --- | --- |
| Commit | `procurement_legal` or later, deal-desk review with no refusals, a named signer and a date inside the period | a commit total, reported as an unbooked estimate |
| Best case | `proposal` or `pilot_or_implementation_SOW` with sponsor and budget cycle recorded and the review stages complete | upside, never added to commit |
| Pipeline | `qualified` through `security_privacy_accessibility_review` | coverage only |
| Omitted | `target_account`, `discovery`, anything past its next-action date | not forecast |

**Probability.** The approved probability for every stage is **not approved**. Until a stage has an approved minimum number of closed opportunities passing through it, its probability for any weighted figure is **0**, and the forecast is reported as counts and unweighted amounts by category. When a stage qualifies, probability is the measured share of opportunities that entered it and later reached `contracted`, with the sample size printed beside it and the approval recorded by finance and the owner.

| Stage | Approved probability | Sample behind it |
| --- | --- | --- |
| `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review`, `proposal`, `pilot_or_implementation_SOW`, `procurement_legal` | not approved | none |
| `contracted`, `implementation`, `live` | not applicable: a signed or delivered state is not a probability | n/a |
| `renewal`, `expansion` | reported separately; never added to new business | none |
| `closed_lost` | 0 | n/a |

**Measures, once data exists.**

- Stage conversion = opportunities that left a stage for `contracted` ÷ opportunities that entered it, by cohort of entry date.
- Cycle time = median days from stage entry to the next stage, with the count of opportunities behind it.
- Coverage = unweighted `qualified`-or-later amount ÷ the period target, where the target is set by finance, not by this document.
- Weighted pipeline = Σ amount × approved probability, only over stages that have one, labelled a planning estimate.
- Forecast accuracy = commit reported at the start of a period ÷ `contracted` in that period, reported with the number of deals.

Report new business, renewal, expansion and services separately, and never count a pilot and its hypothetical annual conversion twice. The directional email and admissions figures in `app/src/lib/gtm/kpi.ts` (`DIRECTIONAL_BENCHMARKS`, `EXTERNAL_COST_PER_ENROLLED_REFERENCE`) are admissions-marketing references with no cited source; they are not sales benchmarks and never feed this model.

**Cadence.** Weekly: review every commit and best-case opportunity against its evidence, every stale next action, every expired proposal and every missing approver. Monthly: re-score tiers and review loss reasons.

## Fields this adds to the CRM model

`CRM-DATA-MODEL.md` and `REVENUE-OPERATIONS-DASHBOARD-SPEC.md` gain these opportunity fields and one dashboard panel; they carry no personal data beyond what those documents already allow.

| Field | Meaning |
| --- | --- |
| `target_score`, `qualification_score` | the two scores, with the date of the newest cited observation |
| `tier` | A, B or C |
| `forecast_category` | commit, best case, pipeline or omitted, derived from stage and evidence |
| `probability`, `probability_source`, `probability_approved_by` | blank until approved |
| `stage_entered_at`, `next_action`, `next_action_due` | already required; used for staleness |
| `loss_reason`, `future_contact_rule` | required at `closed_lost` |

The panel shows category totals as counts and unweighted amounts, stale items and the approved-probability coverage (how many stages have one).

## Inbound inquiries

A website inquiry from an institution becomes a `target_account` candidate scored with the target score within a response target the owner sets (proposed: two business days, an assumption). An individual student, a press or a partner inquiry is routed to its own motion in [`SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`](SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md), not scored as an institution.

## Evidence state

**Repository evidence.** Two scorecards, the sixteen-stage model with seven coded gates, the deal-desk policy and the CRM and dashboard specifications exist.

**Operational evidence.** No prospect has been scored, no opportunity has moved through a stage, no closed opportunity exists and no forecast has been reviewed. The bands, the 90-day staleness window and the response target are assumptions.

**Missing test/proof.** Score at least ten real accounts, compare scores with discovery outcomes, set a minimum sample per stage with finance, run four weekly forecast reviews and record what the scores got wrong.

## Claim ceiling

Semester may describe these as its internal scoring and forecasting method, with every threshold labelled a hypothesis.

## Prohibited claims

Do not state a pipeline value, win rate, conversion rate, cycle time, forecast, coverage or probability, or call a tier, score or commit a customer, booking, ARR or recognized revenue, until approved inputs and dated records exist.
