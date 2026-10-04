# Strategy scorecard

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **PROPOSED TARGETS — NO TARGET IN THIS FILE IS SET** |
| Owner | `founder` seat; each metric names its reading owner |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Companion | [`COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md), rendered from `app/src/lib/ops/firstyear.ts` |

## 1. How this relates to the first-year measures

The repository already defines 23 first-year measures in four groups and states: *"No target is set. A target is the founder's decision."* This scorecard keeps that rule. It does three things the measures file does not:

1. Chooses a **north star** and the guardrail that stops it being gamed.
2. Adds a small number of **new** metrics the strategy needs, marked *(new)*.
3. Proposes **targets and tripwires** so that the decision (FD-2026-006) is about a number and not about what to measure.

**A target becomes real only when** a decision file `docs/decisions/D-<pull request number>.md` records it and `target: { value, decision }` is set on the measure in `app/src/lib/ops/firstyear.ts`; `firstyear.test.ts` refuses a target with no decision. A *(new)* metric whose reading needs a new analytics mark goes through D-005 first and lands with its question in `ANALYTICS.md` and its migration in the same pull request. **Nothing in this file starts collecting anything.**

Every number below is labelled **PROPOSED**. Where there is no benchmark, it says so: those figures are hypotheses placed on the table so the review has something to argue with, and they are replaced by the first cohort's own baseline.

### Reading states (no fake success)

A scorecard cell is never blank and never zero by default. The vocabulary is the one in [`INSTITUTIONAL-TRUST-SCORECARD.md`](../INSTITUTIONAL-TRUST-SCORECARD.md) (Green, Yellow, Red, Gray), so that two scorecards never use different words for the same state. **That document stays the detailed catalog for safety, privacy, recovery, accessibility and trust metrics and wins on their definitions; P2, P3, P5 and P6 below are strategy-level read-outs of it, not replacements.** The two additions here are **NO READING** (its Gray, named plainly) and **STALE**.

| State | Meaning | Rule |
| --- | --- | --- |
| **Green** | Reading meets target and its evidence is in date | |
| **Yellow** | Within tolerance of target, or the evidence expires within 30 days | Owner writes a one-line cause and a date |
| **Red** | Crossed the tripwire | Triggers the response in §5 |
| **NO READING** | The metric is `defined` or `instrumented` and no reading was taken | Shown as such. Not zero, not green. This is **Gray** in the institutional trust scorecard |
| **STALE** | The last reading is older than the metric's cadence | Treated as Red for any gate it feeds |

## 2. North star and its guardrail

**North star: Cohort Weekly Action Rate (CWAR) *(new)*.**
Of the students in a consenting cohort of at least 10, the share who in the ISO week completed **at least one planned, source-attributed academic action** (for example marked done a deadline or plan block whose source and freshness Semester shows).

Why this and not "daily active users": it measures the thing the thesis promises, that every part of a student's educational life *works*, rather than attention captured. It is source-attributed, so it cannot be inflated by busywork the product invented. It reports at cohort level only.

| Rule | Why |
| --- | --- |
| Reported only for cohorts of 10 or more (the privacy floor on `main`) | Smaller cells identify people |
| Never computed, shown or exported per student; never used to rank, flag or score an individual | The product refuses individual risk scores; this metric inherits that |
| Paired with the **notification mute/opt-out guardrail** (S8) | A north star that rises through nudging pressure is a failure, not a win |
| A rise in CWAR with a rise in mute rate above its line is reported as **Red** | Ethical-engagement rule ([`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md)) |
| Targets are baseline-relative inside a pilot charter | Each cohort's own pre-pilot baseline is the honest comparator |

**PROPOSED:** instrument by 2027-06-30 (before G2); first reading in week 2 of the first cohort; hypothesis floor of **40% by week 6, sustained to week 26**; Year 3 median across cohorts of **50% or more**. No benchmark exists; the first cohort's baseline replaces this floor.

## 3. The scorecard

Columns: **ID**, metric (the bold name is the exact first-year measure name where one exists), reading state today, owner seat, cadence, then PROPOSED targets by year and the red line. "Seats" are launch-council seats, not people.

### 3.1 Students

| ID | Metric | State today | Owner | Cadence | Y1 (to 2027-09-30) | Y2 | Y3 | Red line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | **CWAR** *(new)* (north star, §2) | NO READING; needs a mark (D-005) | `product` | Weekly in a cohort; monthly pooled | Instrument by 2027-06-30; floor 40% by week 6 | At or above each charter's baseline plus the sponsor-agreed margin | Median across cohorts 50% or more | Below baseline for 4 consecutive weeks |
| S2 | **Active users** | measured (`supabase/analytics.sql`) | `product` | Weekly | 30 invited students onboarded by 2027-03-31 with at least half weekly-active in weeks 3 to 8; 100 invited by 2027-06-30; cohort 1 of 50 to 200 enrolled | 500 enrolled seats | 5,000 enrolled seats (floor 2,000; stretch 10,000) | Weekly-active under 25% of enrolled for 3 weeks |
| S3 | **Meaningful actions completed** | measured (`ANALYTICS.md`) | `product` | Weekly | 50% or more of arrivals activate within 7 days | 60% | 65% | Under 35% for a cohort of 10 or more |
| S4 | **Return rate** | measured (`supabase/analytics.sql`) | `product` | Monthly | 30% or more at 28 to 34 days (hypothesis, no benchmark) | 40% | 45% | Under 20% after two product iterations (falsifies B1) |
| S5 | **Path clarity score** | defined (Month 2 usability study) | `product` | Per study | 70% or more can say what to do next this week and why | 75% | 80% | Under 50% |
| S6 | **Trust/source comprehension** | defined (Month 2 study) | `trust` | Per study | 80% or more correctly say where a fact came from and whether the school confirmed it | 85% | 90% | Under 65% |
| S7 | **Accessibility task success** | instrumented (`app/scripts/accessibility-smoke.mjs`); person-based reading is the Month 1 baseline | `accessibility` | Quarterly | Baseline by 2027-02-28; 90% or more unaided success on critical journeys by 2027-05-31; no journey without an operable path | 95% | 95% or more, every critical journey | Any critical journey with no operable assistive-technology path |
| S8 | **Notification mute/opt-out rate** *(new, guardrail)* | NO READING; needs a mark | `trust` | Monthly | Baseline; investigate above 20% of active students muting all nudges within 14 days | Same | Same | Above 30% |
| S9 | **Sourced-fact accuracy (AI)** *(new)* | NO READING; offline evaluation harness exists ([`AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md)) | `product`, with the AI safety advisor | Per release | 98% or more of deadline and date facts match their source; zero uncited policy statements in sourced mode (threshold confirmed by the AI safety advisor) | Same | Same | Any wrong deadline traced to AI output in a live cohort |

### 3.2 Institutions

| ID | Metric | State today | Owner | Cadence | Y1 | Y2 | Y3 | Red line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I1 | **Qualified discovery conversations** *(new)*: at least 10 inside Vanderbilt, the rest practitioner interviews rather than sales calls (`DECISIONS.md` §1) | NO READING; a discovery log | `founder` | Weekly | 25 cumulative by 2027-03-31; 50 by 2027-09-30 | 40 more | 40 more | Under 10 by 2027-01-31 |
| I2 | **Scored qualification scorecards** *(new)* | NO READING | `founder` | Monthly | 8 by 2027-03-31; 15 by 2027-09-30 | 15 more | 15 more | None scored by 2027-02-28 |
| I3 | **Signed departments/institutions** | instrumented (`app/src/lib/ops/commitments.ts`), empty | `founder` | Monthly | 1 charter with a binding commitment by 2027-06-30 | 3 units live, at least 1 annual agreement | 6 agreements across 2 or more institutions (floor 4, stretch 12) | No charter by 2027-08-31 |
| I4 | **Implementation time** | defined (`PILOT-TO-PRODUCTION.md`) | `success` | Per deployment | Cohort 1: 90 days or fewer from charter to go-live (the baseline reading) | Cohort 3: 45 days or fewer | 30 days or fewer | More than 2x the previous cohort |
| I5 | **Pilot-to-annual conversion** | defined | `founder` | Per pilot; always reported as counts | First cohort's decision recorded | 1 of the first cohort (counts, n is small) | 50% or more of pilots reaching midpoint | A pilot closes with no signed decision |
| I6 | **Renewal rate** | defined; no agreement has a term | `success` | At each term | None expected | None expected | 85% or more by count of agreements reaching term | Below 70% |
| I7 | **Expansion rate** | defined | `success` | Quarterly | None | First expansion discussed | 1 or more expansion (a unit, package or module) by 2029-03-31 | None across all institutions after 18 months of service |
| I8 | **Security-review cycle time** | defined (HECVAT evidence inventory, Month 2) | `security` | Per review | First review: baseline | 90 days or fewer | 45 days or fewer, falling across three reviews | A repeat request for evidence already supplied |
| I9 | **Referenceable institutions** *(new)* | NO READING | `founder` | Quarterly | 0 (no reference claim) | 1 by 2028-06-30, with claim-specific written permission | 2 by 2029-09-30 | Any customer named without permission |

### 3.3 Platform and trust

| ID | Metric | State today | Owner | Cadence | Y1 | Y2 | Y3 | Red line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Critical journey SLO** | instrumented (`app/src/lib/governance/error-budgets.ts`); targets only, no availability history | `operations` | Monthly | Readings for every journey for 3 consecutive months before G2; no figure quoted as achieved before then | Attain the objectives in [`SLOS-AND-ERROR-BUDGETS.md`](../operating-model/SLOS-AND-ERROR-BUDGETS.md) | Same | Error budget exhausted: feature work stops for that journey |
| P2 | **P0/P1 incidents** | defined; no incident log yet | `operations` | Monthly | Zero cross-tenant exposures, ever; each P0 or P1 reviewed within 5 business days | Same | Same | Any cross-tenant exposure or confirmed breach: activation paused, counsel engaged the same day |
| P3 | **Restore success** | defined; no drill run (`RESTORE.md`) | `operations` | Quarterly | First independent-witnessed drill by 2027-03-31 | Quarterly, 100% within objective | Same | A failed drill blocks activation until a clean repeat |
| P4 | **Integration freshness** | instrumented (`app/src/lib/integration/catalog.ts`); no connector live for a customer | `data` | Monthly | Starts when the first connector is live | 95% or more of syncs meet their freshness class (hypothesis) | Same, per connector | Under 85% for a connector |
| P5 | **Accessibility blocker rate** | defined (`WCAG-UI-AUDIT-SCORECARD.md`) | `accessibility` | Quarterly | Zero open blocking findings at G2 | Zero at every release | Same | Any blocker open at release |
| P6 | **Evidence currency** *(new)* | partly measured: [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md) enforces expiry | `security` | Monthly | Every artifact the Trust Center cites is in date; those expiring within 90 days are listed | Same | Same | A cited artifact past its date |
| P7 | **Claims discipline** *(new)* | measurable by audit against the claims register | `privacy` | Monthly | Zero external claims outside [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | Same | Same | Any claim outside the register: withdrawn within 24 hours, logged |
| P8 | **Support responsiveness** *(new)* | NO READING; support not staffed | `success` | Weekly in a cohort | Baseline in cohort 1; thresholds set with the support runbook once a rota exists | Median first response and resolution by severity within the committed times | Same | Any severity commitment missed twice in a month |
| P9 | **P0/P1 risk burn-down** *(new)* | measurable today: 6 P0 (FR-001 to FR-006) and 6 P1 (FR-007 to FR-012) open at `LAUNCH-RISK-REGISTER.md` v0.2 | `founder` | Weekly | P0 to 0 by G2 (2027-07-31) | P1 to 0 by G3 (2028-03-31) | No new P0 or P1 left open past its gate | A P0 added and not owned within 7 days |

### 3.4 Business

Dollar figures are **illustrative**. No price book exists (A-08), so revenue targets are stated as agreement counts times an illustrative annual contract value of $60k to $120k, and become dollar targets only after FD-2026-007.

| ID | Metric | State today | Owner | Cadence | Y1 | Y2 | Y3 | Red line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | **ARR/MRR** | defined (financial workspace, not the repository) | `finance` | Monthly | $0 expected; no fee before G3 unless counsel and finance approve a design-partner fee | 1 to 3 agreements; illustrative exit ARR $0.06M to $0.36M | 6 agreements; illustrative $0.36M to $0.72M (floor 4: $0.24M to $0.48M; stretch 12: $0.72M to $1.44M) | Behind the floor by two quarters |
| B2 | **Gross retention** | defined | `finance` | At each term | None | None | 90% or more | Below 85% |
| B3 | **Net retention** | defined | `finance` | At each term | None | None | 100% or more | Below 90% (triggers a strategic review) |
| B4 | **Gross margin** | defined | `finance` | Quarterly from first revenue | Reported once there is revenue | Subscription and services reported separately | Subscription margin 65% or more (hypothesis) | Below 40% with no path |
| B5 | **CAC payback** | defined | `finance` | Quarterly from first sale | None | Baseline | 24 months or fewer (hypothesis) | Above 36 months |
| B6 | **Runway** | defined (financial workspace) | `finance` | Monthly | 12 months or more after the first raise; rules in [`BOARD-MEMO.md`](BOARD-MEMO.md) §6.4 | Same | Same | Under 9 months |
| B7 | **AI cost per active student-month** *(new)* | NO READING; AI cost controls exist in [`COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md) | `engineering` | Monthly | Baseline in the invitation cohort; cap set in FD-2026-010 | Within the cap | Within the cap | Cap exceeded for 2 months |
| B8 | **Services share of revenue** *(new)* | NO READING | `finance` | Quarterly | Not applicable | 60% or less | 40% or less (productisation proof) | Above 70% in Year 3 |

### 3.5 Learning velocity

| ID | Metric | State today | Owner | Cadence | Y1 | Y2 | Y3 | Red line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | **Decision timeliness** *(new)* | measurable from [`FOUNDER-DECISION-LOG.md`](FOUNDER-DECISION-LOG.md) | `founder` | Monthly | 90% or more of decisions made by their decide-by date | Same | Same | Any decision overdue by more than 14 days: escalated to the advisory board |
| L2 | **Bet falsifiers read on time** *(new)* | measurable from [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md) §2 | `founder` | Per bet date | B1 to B5 each read on their date and the outcome recorded, including when the answer is bad | Same | Same | A bet whose test date passes unread |

## 4. Year 1 operating targets by quarter

PROPOSED. Each line is a deliverable with an evidence artifact; the full milestone table with owners is [`THREE-YEAR-STRATEGY.md`](THREE-YEAR-STRATEGY.md) §5.

| Quarter | Operating targets | Reading to check |
| --- | --- | --- |
| **Q1: Oct to Dec 2026** | Strategy adopted (2026-10-18). Standing funding rule recorded (2026-10-11). IP determination in hand and entity status confirmed (2026-12-15). Authorized candidate frozen with hosted CI green (2026-12-15). Advisors engaged (2026-12-31). Quotes received for security, accessibility and counsel, replacing A-06 | P9, L1 |
| **Q2: Jan to Mar 2027** | 25 qualified conversations, 8 scorecards (2027-03-31). Independent restore drill and incident exercise (2027-03-31). Backups named for each company-side seat (2027-03-31). G1 reached (2027-03-31). Usability study run (Month 2 proof). First hire started (about 2027-03-01) | I1, I2, P3, S5, S6, S2 |
| **Q3: Apr to Jun 2027** | Independent security assessment with clean rescan, target isolation test, accessibility report and ACR (2027-05-31). Pre-seed closed or lean path chosen (2027-05-31). Vanderbilt-first tripwire review (2027-05-31). One charter signed (2027-06-30). CWAR instrumented (2027-06-30). 100 invited students | P9, S1, S7, I3, S2 |
| **Q4: Jul to Sep 2027** | UAT and baseline signed (2027-07-15). Support rota live. G2 verdict (2027-07-31). First cohort live (2027-09-15). Bet B1 and B2 read (2027-06-30, 2027-09-30) | P1, P9, L2, I4 |

## 5. Red-line responses

A Red reading is a trigger, not a note. Each response names who acts and by when, and is recorded in the decision log.

| Trigger | Response | Owner | Within |
| --- | --- | --- | --- |
| Any cross-tenant exposure or confirmed breach (P2) | Pause activation for affected tenants; incident commander engaged; counsel engaged; customer communications per contract | `operations`, `privacy` | Same day |
| A claim outside the register (P7) | Withdraw; log; root cause | `privacy` | 24 hours |
| Failed restore drill (P3) | Block activation; fix; repeat the drill | `operations` | Fix plan in 5 business days |
| Return rate under the line after two iterations (S4) | Run the B1 falsifier review with advisors: change the wedge or the product, not the target | `product`, `founder` | 30 days |
| CWAR up while mute rate above its line (S1, S8) | Treat as a failure; roll back the nudging change | `product`, `trust` | 7 days |
| Net retention under 90% (B3) | Strategic review before further hiring | `founder`, advisory board | 30 days |
| Runway under 9 months (B6) | Rules in [`BOARD-MEMO.md`](BOARD-MEMO.md) §6.4 | `founder`, `finance` | Per rule |
| A decision overdue 14 days (L1) | Escalate to the advisory board | `founder` | 14 days |
| A STALE reading feeding a gate | Treat as Red for the gate | The gate's owner | Immediate |

## 6. Review cadence

Every meeting writes something down; a meeting with no output is cancelled (`docs/operating-model/OPERATING-RHYTHM.md`).

| Cadence | Forum | Inputs | Output | Decides |
| --- | --- | --- | --- | --- |
| Weekly (60 min) | Founder plus whoever holds a seat that week | I1, I2, P9, S2, S3, in-cohort CWAR and P8, risk movements | Top three items with owners; decision-log entries | Operational priorities |
| Monthly (90 min) | Scorecard review, with advisors invited | Every metric above; NO READING and STALE listed first; evidence expiring in 90 days; claims audit | Scorecard snapshot (what is Green, Yellow, Red, NO READING); decisions | Whether any tripwire fired; resource moves |
| Quarterly (half day) | Strategy refresh and portfolio review | Scorecard, risk register re-rating, bet falsifiers due, runway | One-page strategy memo ([`BOARD-MEMO.md`](BOARD-MEMO.md) refreshed); build/partner/integrate/defer/decline/sunset decisions | Strategy changes (each needs a decision-log entry) |
| Gate review | At G0 to G4 | The gate's evidence pack | Recorded verdict | Whether the gate opens |
| Annual (September) | Reset | Year's scorecard, moat review ([`MOAT-PLAN.md`](MOAT-PLAN.md)), risk re-rating | Next three-year memo | Targets for the next year (each as a `D-<n>` record) |

**Retirement rule.** A metric that has been NO READING for two consecutive quarters with no funded plan to instrument it is retired from the scorecard by decision, not left to rot as a permanent grey cell.
