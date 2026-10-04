# 09 · Operational dashboards and leading indicators

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — MOST SOURCES LACK A DENOMINATOR TODAY; EVERY THRESHOLD IS SL0** |
| Owner seat | `operations` (metric dictionary); each metric names its own owner seat |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`COMPANY-FIRST-YEAR-MEASURES`](../../COMPANY-FIRST-YEAR-MEASURES.md), [`MONITORING`](../../../MONITORING.md), [`SLOS-AND-ERROR-BUDGETS`](../../operating-model/SLOS-AND-ERROR-BUDGETS.md), [`SLO-SLI-DRAFT`](../../engineering-operations/SLO-SLI-DRAFT.md), [`CUSTOMER-HEALTH-SCORE`](../../commercial/CUSTOMER-HEALTH-SCORE.md), [`REVENUE-OPERATIONS-DASHBOARD-SPEC`](../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md), [`ANALYTICS-AND-METRICS-DICTIONARY`](../../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md), [`PRODUCT-ANALYTICS-DATA-ETHICS`](../../PRODUCT-ANALYTICS-DATA-ETHICS.md), [`OPERATIONS-CONSOLE-MAP`](../../OPERATIONS-CONSOLE-MAP.md) |
| Claim ceiling | Semester may say it defines the measures it will watch. It may not publish any figure as achieved performance, uptime or outcome until it is measured with an approved denominator and window. |

## Rules for every dashboard

1. **No data is not green.** A window with no eligible events is **no data**, shown as such, never healthy ([`SLO-SLI-DRAFT`](../../engineering-operations/SLO-SLI-DRAFT.md)). A missing denominator is a finding.
2. **Every tile shows** the window, the numerator and denominator (or *n*), the source, and when it last refreshed.
3. **Small cells are suppressed.** Any cohort metric over fewer than ten people is not shown ([the pilot rule](../../PAID-PILOT-FRAMEWORK.md)).
4. **No metric scores an individual student.** No risk scores, early alerts, or per-student rankings; outcomes are cohort aggregates. This is a pilot rule and a product principle.
5. **Product analytics are privacy-minimized** and follow the [analytics ethics page](../../PRODUCT-ANALYTICS-DATA-ETHICS.md); an operations metric never justifies collecting more.
6. **Status is never colour alone.** Each state carries a word and a shape; each chart has a text alternative and a data table.
7. **A red metric has an owner and a first action** ([below](#from-red-to-action)). A red with no action is an unowned risk.
8. **Definitions change by pull request**, with a decision file, so a metric's history stays comparable.
9. **Thresholds are proposals (SL0)** until measured; a threshold that is missed for four consecutive weeks triggers a decision, not a quiet edit.
10. **Snapshots** for the weekly review are taken Monday at a fixed time so the room reads the same numbers.

## Instrumentation state, honestly

| Source | Exists today | Missing for an SL1 reading |
| --- | --- | --- |
| Hourly production smoke and public status | Yes (shell, module, stylesheet, database edge) | Workflow-level correctness; named-person alert delivery |
| Rollout state and evidence tables | Yes (state machine, evidence, history) | A named tenant to populate them |
| Pilot tables (plans, metrics, outcomes) | Yes (platform scope) | A pilot |
| Student-account ledger | Yes (append-only, reconciliation, close) | Live accounts |
| Incident notices | Yes (recorded and validated) | Real incidents |
| Support tickets and access grants | Yes (queue, grants, audit) | Staffed channel, real volume |
| Product events | Taxonomy and privacy design | Approved event definitions; denominator |
| Error-budget calculation | Yes (integer math, burn rates, tests) | An accepted field event stream |
| Vendor, risk, claims registers | Yes (documents) | A current owner and review dates |

A metric whose source is missing is displayed as **no data** and listed on the instrumentation backlog with an owner.

## Colours, thresholds and review

**Green** inside target; **Amber** outside target but inside the escalation band; **Red** outside the band or any hard-gate failure. The Green and Red columns are given; Amber is everything between. A hard gate (marked **G**) is red at any breach.

## D1 Executive scorecard

One page; every row links to its source dashboard. Read at the weekly operating review.

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1.01 | Weekly progress actions per active student | Count of actions in the approved list (task completed on time, study session of at least 15 minutes, submission with receipt, plan reviewed) ÷ active students, per week | Leading | Product events | `product` | Rising, or at baseline | Down 20% for 3 weeks |
| D1.02 | Critical-journey SLO attainment | Journeys meeting objective ÷ journeys with data | Lagging | D5 | `engineering` | All with data | Any journey below its objective for 2 windows |
| D1.03 | Open P0 and P1 (incidents, cases, S1 defects) | Count | Leading | Case, incident, defect trackers | `operations` | 0 (**G** for any launch) | Any, for a tenant in launch window |
| D1.04 | Tenants by health | Tenants Green, Amber, Red by [health score](../../commercial/CUSTOMER-HEALTH-SCORE.md) | Leading | Health record | `success` | No Red | Any Red above 2 weeks |
| D1.05 | Risk acceptances expiring within 14 days | Count | Leading | Acceptance log | `founder` | 0 unreviewed | Any expired unfixed |
| D1.06 | Claims awaiting a decision | Count; oldest age | Leading | Claims register | `founder` | Oldest at most 10 business days | Any claim in use without approval (**G**) |
| D1.07 | Cash runway | Cash ÷ trailing average monthly net burn | Lagging | Finance | `finance` | Policy minimum | Below policy minimum |
| D1.08 | Decision aging | Class 1 and 2 decisions open past their speed | Leading | Decision register | `founder` | 0 | More than 2 |
| D1.09 | Founder operations hours | Hours per week on delivery, support and incident | Leading | D9 | `founder` | At or below the stage budget | Above 1.5 times budget for 4 weeks |
| D1.10 | Process bus factor | Critical processes with at least two able people ÷ critical processes | Leading | D9 | `operations` | 100% at Stage 1 | Below 50% |
| D1.11 | Net revenue retention | (Starting recurring revenue + expansion − contraction − churn) ÷ starting recurring revenue | Lagging | Finance | `finance` | Above 100% | Below 90% |
| D1.12 | Stage and triggers | Current stage; hiring triggers fired and unmet | Leading | [11](11-founder-to-team-transition.md#hiring-triggers) | `founder` | No unmet fired trigger | A trigger fired and unmet for over one quarter |

## D2 Revenue and pipeline

Pre-revenue, most read *no data*; they exist so the habit forms before the numbers do.

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D2.01 | Opportunities with named sponsor and champion | Qualified opportunities with both named ÷ qualified | Leading | CRM | `founder` | 100% | Any in proposal without them |
| D2.02 | Pipeline coverage | Weighted pipeline for the quarter ÷ target | Leading | CRM | `founder` | At least 3× unweighted | Below 1.5× |
| D2.03 | Stage conversion and cycle | Share advancing; median days per stage | Lagging | CRM | `founder` | Stable | Cycle doubles |
| D2.04 | Deal-desk exceptions | Deals outside policy ÷ deals | Leading | Deal desk | `finance` | 0 unapproved | Any unapproved |
| D2.05 | Security questionnaire turnaround | Business days from receipt to answer | Leading | Procurement log | `security` | At most 10 | Above 20 |
| D2.06 | Pilot-to-annual conversion | Pilots converting ÷ pilots decided | Lagging | Pilot verdicts | `founder` | Measured | Below plan for 2 cohorts |
| D2.07 | Proposals with counsel items open | Count | Leading | Legal queue | `privacy` | 0 at signature | Any signed with open items (**G**) |
| D2.08 | Reference permissions held | Written permissions in force | Leading | Reference register | `success` | Measured | Any claim without permission (**G**) |

## D3 Implementation and adoption

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D3.01 | Time to launch gate | Days from kickoff to the council decision | Lagging | Rollout history | `success` | At most 60 (standard scope) | Above 90 |
| D3.02 | Gate adherence | Phases exited with all evidence ÷ phases exited | Leading | Rollout evidence | `success` | 100% (**G**) | Any exit without evidence |
| D3.03 | Rework | Phases re-entered after a failed gate | Leading | Phase log | `success` | At most 1 per tenant | 2 or more |
| D3.04 | Open P1 UAT defects | Count | Leading | Defect list | `engineering` | 0 at launch (**G**) | Any at gate |
| D3.05 | Weekly status delivered | Weeks delivered ÷ weeks in implementation | Leading | Status record | `success` | 100% | 2 missed |
| D3.06 | Readiness score | [Tenant score](10-tenant-launch-risk-and-readiness.md#the-readiness-scorecard) | Leading | Scorecard | `success` | At least 85 and no hard-gate fail | Below 70 or any hard-gate fail |
| D3.07 | Sponsor and champion in place | Both named seats currently held | Leading | Charter | `success` | Both | Either vacant |
| D3.08 | Activation rate | Cohort members completing first value ÷ invited | Leading | Product events | `product` | Per charter target | Under half of target at week 4 |
| D3.09 | Median time to first value | Median minutes or days to first value | Leading | Product events | `product` | At or below charter target | Rising 2 weeks |
| D3.10 | Habitual share | Cohort members using the core workflow in 4 of 6 weeks ÷ cohort | Lagging | Product events | `success` | Per charter | Falling 3 weeks |
| D3.11 | Customer self-sufficiency | Cases closed by the customer's own desk ÷ cases from that tenant | Leading | Case system | `success` | Rising to at least 70% | Flat below 40% after week 8 |
| D3.12 | Reconciliation pass rate | Passing reconciliations ÷ reconciliations | Leading | Integration | `data` | 100% (**G** for write) | Any unresolved mismatch |
| D3.13 | Training completion | Required roles trained ÷ required roles | Leading | Training record | `success` | 100% at launch (**G**) | Any role untrained at launch |
| D3.14 | Outcome against baseline | Pilot measure versus frozen baseline (n of at least 10) | Lagging | Pilot metrics | `success` | Improving, with a stated reason | Worse, or baseline not frozen |
| D3.15 | Hypercare exit on time | Exit test met by planned date | Leading | Hypercare log | `operations` | Yes | Slipping past 4 weeks |

## D4 Support and quality

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D4.01 | Contact rate | Cases ÷ active users ÷ 100, monthly | Leading | Case system | `operations` | Within plan | 2× plan |
| D4.02 | Acknowledgement attainment | Cases acknowledged in target ÷ cases, by priority ([SL-SUP-01 to 04](04-support-operating-model.md#support)) | Lagging | Case system | `operations` | At least 95% | Below 85% |
| D4.03 | Update attainment | Updates inside cadence ÷ open case-intervals | Lagging | Case system | `operations` | At least 95% | Below 85% |
| D4.04 | Resolution attainment | Resolved in target ÷ resolved | Lagging | Case system | `operations` | At least 90% | Below 80% |
| D4.05 | Oldest open case | Age by priority | Leading | Case system | `operations` | P0 none; P1 under 1 day; P2 under 3 days | Any P0 open without a mitigation; P1 above 2 days |
| D4.06 | First-contact resolution | Resolved on first reply ÷ resolved (individual track, excluding P0 and P1) | Lagging | Case system | `operations` | At least 60% | Below 40% |
| D4.07 | Reopen rate | Reopened ÷ resolved | Lagging | Case system | `operations` | At most 8% | Above 15% |
| D4.08 | Repeat contact | Third contact on one issue ÷ cases | Leading | Case system | `operations` | At most 3% | Above 8% |
| D4.09 | Escalation rate | Cases at L3 or L4 ÷ cases | Leading | Case system | `operations` | At most 10% | Above 20% |
| D4.10 | Satisfaction | Satisfied ÷ responses (cohorts of 10 or more) | Lagging | Survey | `operations` | At least 85% | Below 70% |
| D4.11 | QA score | Mean score of sampled cases; **gate failures** counted separately | Leading | QA sample | `operations` | At least 85 and 0 gate failures | Any gate failure (**G**) |
| D4.12 | Privacy, safety, accessibility queue age | Oldest open by queue | Leading | Case system | `privacy`, `trust`, `accessibility` | Inside SL | Any past SL |
| D4.13 | Deflection | Help views not becoming cases ÷ help views, by topic | Leading | Product events | `operations` | Rising | Falling after a release |
| D4.14 | Top causes | Top five categories and their share | Leading | Case system | `operations` | Each with a plan | A top cause with no article or ticket |

## D5 Reliability and incidents

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D5.01 | SLO attainment by journey | Good ÷ eligible events in window ([`SLO-SLI-DRAFT`](../../engineering-operations/SLO-SLI-DRAFT.md)) | Lagging | Event stream | `engineering` | At or above objective | Below objective |
| D5.02 | Error-budget burn | Rate of consumption of the budget | Leading | Error-budget calc | `engineering` | Under 1× | Over 2× (freeze changes on the journey) |
| D5.03 | Synthetic probe pass | Probes passed ÷ probes | Leading | Hourly smoke | `engineering` | 100% | Any failure unexplained 1 hour |
| D5.04 | Incidents by severity | Count by SEV and flag | Lagging | Incident record | `operations` | None SEV1 | Any SEV1 |
| D5.05 | Time to detect, declare, mitigate, recover | Medians and maxima | Lagging | Incident record | `operations` | Inside [SL-INC-01](04-support-operating-model.md#incidents-security-privacy-accessibility) | Declaration over target |
| D5.06 | Notice timeliness | Notices inside target ÷ notices | Lagging | Notice record | `operations` | 100% | Any missed |
| D5.07 | Recurrence | Incidents sharing a root cause in 90 days | Leading | Review record | `engineering` | 0 | 2 or more |
| D5.08 | Action closure | Corrective actions closed by due date ÷ due | Leading | Action tracker | `operations` | At least 90% | Below 70% |
| D5.09 | Review timeliness | SEV1 and SEV2 reviews inside 5 business days ÷ reviews | Lagging | Review record | `operations` | 100% | Any late |
| D5.10 | Connector health | Counts by state: healthy, delayed, degraded, failed, reconciliation mismatch, disabled | Leading | Integration | `data` | All healthy or deliberately disabled | Any failed or mismatch past 4 hours |
| D5.11 | Source freshness | p95 age of synced data per source against its contract | Leading | Integration | `data` | Inside contract | Beyond contract for 2 syncs |
| D5.12 | Change failure rate | Changes causing SEV1 to SEV3 or rollback ÷ changes | Lagging | Change record | `engineering` | At most 10% | Above 20% |
| D5.13 | Freeze violations | Changes inside a tenant freeze without approval | Leading | Change calendar | `operations` | 0 | Any (**G**) |
| D5.14 | Last verified restore | Days since a timed restore of a real provider backup | Leading | Restore log | `engineering` | At most 90 | Never done, or above 180 |
| D5.15 | Pager test | Acknowledged in target ÷ pages tested (from Stage 1) | Leading | Rota log | `operations` | 100% | Any unacknowledged |

## D6 Security, privacy, accessibility and AI

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D6.01 | Open vulnerabilities by age | Exploitable, by severity, against [SL-SEC-02](04-support-operating-model.md#incidents-security-privacy-accessibility) | Leading | Vulnerability tracker | `security` | None past target | Any critical past 7 days |
| D6.02 | Privileged access recertification | Grants re-justified ÷ grants, quarterly | Leading | Access log | `security` | 100% | Any grant without a reason |
| D6.03 | Isolation test pass | Cross-tenant tests passing ÷ tests; includes support tools and AI retrieval | Leading | Test run | `engineering` | 100% (**G**) | Any failure |
| D6.04 | Independent assurance state | Status of pen-test or review, with dates | Leading | Evidence register | `security` | Current | Expired or none for a pilot |
| D6.05 | Data-rights requests | Open count; oldest age against [SL-PRV-01](04-support-operating-model.md#incidents-security-privacy-accessibility) | Leading | Request record | `privacy` | Inside SL | Any past the legal deadline counsel sets (**G**) |
| D6.06 | Consent revocation propagation | Time from revocation to access removed | Leading | Audit events | `privacy` | Inside design target | Any access after revocation |
| D6.07 | Policy-decision denial anomaly | Denials per 1,000 decisions against baseline | Leading | Policy log | `security` | Within band | Spike without a release cause |
| D6.08 | Critical journeys with current manual accessibility test | Journeys tested in the last 6 months ÷ critical journeys | Leading | A11y register | `accessibility` | 100% | Below 80% |
| D6.09 | Open accessibility barriers | Count by severity and age | Leading | Barrier record | `accessibility` | None blocker past SL | Any blocker past 5 days |
| D6.10 | AI evaluation pass | Eval suites passing ÷ suites, per route and tier | Leading | Eval run | `product` | 100% before release (**G**) | Any failing route live |
| D6.11 | AI incidents and human overrides | Count; overrides ÷ AI actions proposed | Leading | AI log | `product` | None; stable | Any `AI` flag incident |
| D6.12 | AI cost per successful outcome | AI cost ÷ quality-qualified completed tasks | Leading | Cost, AI log | `finance` | At or below plan | Above 1.5× plan |
| D6.13 | Claims past review date | Count | Leading | Claims register | `founder` | 0 | Any in use |
| D6.14 | Vendor reviews overdue | Count | Leading | Vendor register | `operations` | 0 | Any V1 overdue |

## D7 Trust, marketplace and partners

Read as *no data* until a surface is open. The capacity gate in [08](08-marketplace-partner-trust-fulfillment.md#capacity-gate) means a surface opens only when these can be met.

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D7.01 | Reports per 100 active users | Reports ÷ active users ÷ 100 | Leading | T&S case | `trust` | Measured | Spike without a cause |
| D7.02 | Time to triage | Report to provisional priority, by priority | Lagging | T&S case | `trust` | Inside [SL-TS-01](04-support-operating-model.md#delivery-success-trust-and-partners) | Over target |
| D7.03 | Oldest open report | Age by priority | Leading | T&S case | `trust` | Inside SL | Any P0 or P1 without a protection applied |
| D7.04 | Appeal overturn rate | Reversed ÷ decided | Lagging | T&S case | `trust` | At most 15% | Above 25% |
| D7.05 | Calibration score | Mean on control items per moderator | Leading | Calibration log | `trust` | Above threshold | A moderator below threshold still on queue |
| D7.06 | Provider decisions | Median days to decision | Lagging | Provider record | `trust` | At most 10 business days | Above 20 |
| D7.07 | Dispute rate | Disputes ÷ orders, per provider | Leading | Dispute record | `finance` | At most 2% | Above 5% |
| D7.08 | Non-fulfilment rate | Unfulfilled in window ÷ orders | Leading | Order record | `trust` | At most 3% | Above 6% |
| D7.09 | Dispute decision time | Complete evidence to decision | Lagging | Dispute record | `finance` | At most 10 business days | Above 20 |
| D7.10 | Partner scorecards | Dimensions green ÷ dimensions, per partner | Leading | Partner record | `founder` | At least 70% | Any red on compliance or claims discipline |

## D8 Finance and unit economics

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D8.01 | Gross margin | (Revenue − hosting, AI, support and service-delivery cost) ÷ revenue | Lagging | Finance | `finance` | At or above plan | Below plan for a quarter |
| D8.02 | Cost per active user | Hosting, AI, storage, messaging, support, per active user per month | Leading | Finance, cost data | `finance` | At or below plan | Above 1.25× plan |
| D8.03 | Services margin | (Fixed implementation price − delivery cost) ÷ price | Lagging | Finance | `finance` | At or above plan | Negative |
| D8.04 | CAC and payback | Fully loaded acquisition spend ÷ new customers; months to recover | Lagging | Finance | `finance` | At or below plan | Above 1.5× plan |
| D8.05 | Budget variance | Actual ÷ budget by line | Leading | Finance | `finance` | Within 10% | Above 20% |
| D8.06 | Collections | Days sales outstanding; failed-payment rate | Lagging | Billing | `finance` | Within terms | Past terms by 30 days |
| D8.07 | Entitlement leakage | Active entitlements without a paid order or approved credit | Leading | Billing, tenant config | `finance` | 0 | Any |
| D8.08 | Vendor spend against forecast | Actual ÷ forecast | Leading | Vendor register | `finance` | Within 10% | Above 20% two months |
| D8.09 | Ledger close | Months closed on time with a passing reconciliation | Lagging | Ledger | `finance` | 100% | Any month closed without |

## D9 People, capacity and transition

| ID | Metric | Definition | Type | Source | Owner | Green | Red |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D9.01 | Founder time on operations | Hours per week, by process | Leading | Time log | `founder` | At or below stage budget | Above 1.5× for 4 weeks |
| D9.02 | Bus factor | Able people per critical process | Leading | Transfer record | `operations` | At least 2 (**G** from Stage 1) | Any process at 1 |
| D9.03 | Transfers on the ladder | Processes at each level of the [ladder](11-founder-to-team-transition.md#the-transfer-ladder) | Leading | Transfer record | `operations` | Moving up | Stalled 2 months |
| D9.04 | Fresh-hands pass rate | Runbook runs passed unaided ÷ runs | Leading | Runbook headers | `operations` | At least 80% | Below 50% |
| D9.05 | Certification currency | Required certifications current ÷ required | Leading | Training record | `operations` | 100% (**G** for sensitive access) | Any lapsed with access |
| D9.06 | On-call load | Pages per person per week; night interruptions | Leading | Rota log | `operations` | At most the policy cap | Above for 3 weeks |
| D9.07 | Triggers fired | Hiring triggers fired and unmet | Leading | [11](11-founder-to-team-transition.md#hiring-triggers) | `founder` | None unmet | Fired over one quarter |
| D9.08 | Cadence adherence | Forums held ÷ planned | Leading | [01](01-operating-cadence.md) | `operations` | At least 95% | Two weekly reviews missed |

## Leading indicators and what they predict

A lagging metric tells you what happened. These tell you what is about to.

| Early signal | Predicts | Action when it moves |
| --- | --- | --- |
| Champion or sponsor leaves or goes silent for two weeks (D3.07) | Renewal and adoption risk | `success` meets the sponsor within a week; names a replacement; a renewal-risk review |
| Weekly active share falls for two weeks (D3.10) | Churn | Workflow review with the champion; enablement action |
| Median time to first value rises (D3.09) | An onboarding or product defect | Reproduce the first-win path; fix before the next cohort |
| Reconciliation exceptions rise (D3.12, D5.10) | A data-quality incident | Pause dependent automation; engage the customer's IT |
| Error-budget burn above 2× (D5.02) | An SLO miss | Freeze changes on the journey; fix reliability first |
| Support contact rate for a feature rises after a release (D4.01, D4.14) | A release-quality issue | Review the release; article, macro or fix |
| QA score dips or gate failures appear (D4.11) | An incident or a privacy event | Coaching and process review the same week |
| Repeat contact rises (D4.08) | An unfixed problem | Open a problem record |
| Runbooks past review or never exercised (D9.04) | Slow recovery | Exercise before the next peak |
| Un-recertified privileged access (D6.02) | Insider or credential risk | Revoke until re-justified |
| Claims in use past review (D6.13) | A misstatement | Withdraw until approved |
| AI cost per outcome drifts up (D6.12) | A margin problem | Route or model review |
| Pager acknowledgement time drifts (D5.15) | A coverage gap | Rota fix before it matters |
| Hypercare exit slipping (D3.15) | Launch risk | Hold the next launch step |
| Accessibility barrier age rising (D6.09) | Compliance exposure and harm | Escalate to product |
| Sponsor meeting skipped twice | Executive disengagement | Founder call within a week |
| Disputes or non-fulfilment trending up for a provider (D7.07, D7.08) | Harm to students | Early review; warning |
| Bus factor falls (D9.02) | Key-person risk | Transfer plan this week |

## From red to action

A red tile triggers the first action of its owner seat within the stated time. If the owner does not act, the weekly review treats the miss as an incident of process.

| Condition | First action | Within |
| --- | --- | --- |
| Hard gate (**G**) breach | Stop the affected motion; tell the council | Same day |
| Customer-facing red | Contact the tenant's named contact with a plan | 1 business day |
| Reliability red | Declare an incident if criteria are met; else freeze changes | At once |
| Trust red (privacy, safety, accessibility) | The domain owner takes the case | Same business day |
| Money red | Finance reviews; the founder informed | 3 business days |
| People red | A transfer or hiring decision on the agenda | Next weekly review |

## Related

[01 Cadence](01-operating-cadence.md) · [04 Service-level catalog](04-support-operating-model.md#service-level-catalog) · [10 Readiness](10-tenant-launch-risk-and-readiness.md) · [11 Transition](11-founder-to-team-transition.md)
