# Semester GTM KPI Tree and Operating Cadence

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL - DEFINITIONS PROPOSED; NO OBSERVED VALUE, BASELINE OR APPROVED TARGET EXISTS** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: accounting] [REVIEW: privacy] [REVIEW: security]. `[APPROVED]` count: 0 |
| Audience | Internal |
| Parent | [`SEMESTER_MASTER_GTM_PLAYBOOK.md`](SEMESTER_MASTER_GTM_PLAYBOOK.md) section I |

> Operating document, not accounting, tax, privacy or security advice. Where a metric is a finance metric (ARR, MRR, CAC, LTV, margin, runway), its definition is a planning assumption until the founder and a qualified accountant approve a cost, customer, revenue and cohort policy.

Label legend. `[VERIFIED]` a repository path proves it. `[ASSUMPTION]` target, rate or definition pending approval. `[DRAFT]` new content. `[INTERNAL]` not for customers.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`app/src/lib/gtm/kpi.ts`](../../../app/src/lib/gtm/kpi.ts) | 16 `MetricKey` definitions with numerator, denominator, caveat; `ratio()` returns null on an empty denominator; `netRevenueRetention`; `methodology()` export; directional benchmarks; `optOutAlert` | A tree from north star to inputs for ten domains; owners, sources, cadence, targets; the labelling rule | Code is the highest authority and covers only 16 metrics, 9 of which are admissions-marketing metrics for a customer's enrollment funnel |
| [`docs/commercial/ANALYTICS-AND-METRICS-DICTIONARY.md`](../../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md) | 16 controlled definitions (cohort, activation, first-win, time to first value, Weekly Prepared Action Rate, retention, support, reliability, pipeline conversion, sales cycle, implementation time, pilot conversion, renewal/churn decision rates); finance metrics marked unavailable | The same definitions placed in a tree, plus the finance, security, cash and capacity KPIs the founder requires, each labelled [ASSUMPTION] where the dictionary says "finance definitions required" | The dictionary is a flat list with no hierarchy, owner, cadence or target field |
| [`docs/market-readiness/METRIC-DICTIONARY.md`](../../market-readiness/METRIC-DICTIONARY.md), [`docs/COMPANY-FIRST-YEAR-MEASURES.md`](../../COMPANY-FIRST-YEAR-MEASURES.md) | Student and institution measures, 23 measures with state (3 measured, 4 instrumented, 16 defined) and "no target is set" | State per KPI and source; target column never filled without a recorded decision | Generated register; edit the data, not the doc |
| [`docs/commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md`](../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md), [`GROWTH-OPERATING-PLAN.md`](../../gtm/GROWTH-OPERATING-PLAN.md) 12.1 | Dashboard panels D1-D6, cadence | Mapping of KPI -> dashboard -> meeting | |
| [`docs/company/leadership-system/03-okrs-planning-metrics.md`](../../company/leadership-system/03-okrs-planning-metrics.md) | OKR shape, executive scorecard status rules (GREEN/YELLOW/RED/UNKNOWN), QBR agenda | Meeting table specific to GTM | It is company-wide and sets no targets |

## Delta against `kpi.ts` and the metrics dictionary

| Topic | Repository | This tree |
| --- | --- | --- |
| Reused unchanged | `student_activation_rate`, `first_meaningful_action_rate`, `workflow_completion_rate`, `pilot_conversion_rate`, `customer_acquisition_cost`, `cac_payback_months`, `net_revenue_retention` (7 of 16) | used with the same numerator and denominator |
| Not used | the nine admissions metrics (`qualified_inquiry_rate`, `inquiry_to_application_rate`, `application_completion_rate`, `yield_rate`, `cost_per_inquiry`, `cost_per_application`, `cost_per_enrolled_student`, `email_ctr`, `click_to_open_rate`) and `DIRECTIONAL_BENCHMARKS` / `EXTERNAL_COST_PER_ENROLLED_REFERENCE` | they serve a customer institution's enrollment marketing in the campaign manager; `ACCOUNT-SCORING-AND-FORECAST.md` says they are not sales benchmarks and never feed forecasts. Benchmarks are never targets |
| Rule adopted from code | `ratio()` returns null for an empty or invalid denominator | an empty cohort has no rate; show "unavailable", never 0% |
| `pilot_conversion_rate` denominator | code: pilots converted to a paid annual contract / **completed pilots** | the dictionary refines it to pilots reaching an authorized annual agreement / pilots with a **final decision due**, with extensions and no-decision reported separately. Adopt the code definition; apply the dictionary's exclusions as reporting rules. A caveat edit to `kpi.ts` is a code change outside this document |
| Absent in code and dictionary | LTV, MRR, ARR, break-even, runway, burn, support, security, health, capacity, pipeline stage conversion | defined below as [ASSUMPTION] pending Finance approval; none computes today |
| Methodology export | `methodology()` states "causal_claim: none" and the attribution model | every KPI table here carries source and caveat; attribution model must be named per dashboard |

## Rules that apply to every KPI [VERIFIED structure] [DRAFT]

### Actual vs forecast vs assumption labelling

| Label | Meaning | Allowed source | Display rule |
| --- | --- | --- | --- |
| `ACTUAL` | observed in a named source, with as-of time, window, cohort, numerator, denominator, sample size | closed books, `gtm_*` tables, validated events, support system | may appear in a board or founder pack |
| `FORECAST` | a model output with scenario named | Finance model tab (name the scenario) | always shows scenario; never beside an actual without the label; never the go/no-go-blind Base scenario for a timing decision (see Finance `10-GO-NO-GO-GATES.md`) |
| `ASSUMPTION` | target, planning input, price, rate or threshold | founder, recorded decision | shown as a target, never as a result |
| `UNAVAILABLE` | no valid source yet | n/a | show "unavailable"; distinct from zero, not applicable and suppressed |

Rules: (1) never backfill an actual from a forecast; (2) a definition change is versioned, not silently applied; (3) cells below the privacy floor (n < 10, [VERIFIED] proposal in the dictionary and growth spec) are suppressed; (4) a rate with an empty denominator is unavailable; (5) a figure with no source is not shown; (6) `UNKNOWN` more than one quarter scores red ([`03-okrs-planning-metrics.md`](../../company/leadership-system/03-okrs-planning-metrics.md)); (7) qualitative feedback is labelled self-reported and non-causal; (8) a target requires a recorded decision (`docs/decisions/D-<PR number>.md`); until then the target column reads "none until baseline" or an `[ASSUMPTION]`.

### Vanity metric exclusions

Views, downloads, followers, impressions, scans, sign-ups-without-activation, logins, time in app, number of meetings held, seats provisioned, and traffic are **diagnostic only, never proof** of pilot value, product value or pipeline health. They may appear in a diagnostics panel labelled "leading / diagnostic". They may not appear in a customer report, a board pack headline, a forecast or a claim (CLM-014). Email opens are inflated by mail privacy protection; prefer clicks and conversions ([`kpi.ts`](../../../app/src/lib/gtm/kpi.ts) caveat).

## The tree [DRAFT]

```text
ENGINE 1 NORTH STAR: ARR from annual agreements converted from completed pilots   [ASSUMPTION: definition pending Finance]
 |-- Revenue
 |    |-- New ARR (conversions + new)  <- pilot-to-annual conversion rate x pilots with decision due x average annual contract value
 |    |-- NRR (expansion - contraction - churn)  <- expansion cohorts, logo retention
 |    |-- Gross margin  <- hosting, AI inference, support, implementation labour
 |-- Pipeline
 |    |-- qualified pipeline coverage (counts, unweighted)  <- stage conversion x cycle time x accounts entering each stage
 |    |-- accounts scored/qualified  <- warm-path outreach, discovery calls, demos, evidence exchanges
 |-- Customer health (human-reviewed)  <- outcome trajectory, implementation, adoption, reliability, support, sponsor engagement, trust gates
 |-- Delivery capacity  <- active pilots vs cap, implementation hours, support load
 |-- Security  <- open P0/P1, evidence age, review cycle time, claims incidents
 |-- Cash / runway  <- cash balance, net burn, receivables

ENGINE 2 NORTH STAR: Weekly Prepared Action Rate (proposed)
 |-- Activation  <- invited -> activated (consent + minimum setup)
 |-- First meaningful action  <- activated -> first win
 |-- Product adoption  <- weekly meaningful engagement, workflow completion
 |-- Retention  <- Day 7 / Day 30 meaningful return, week-4 retention
 |-- Support  <- contacts per activated user, resolution age
 |-- Guardrails  <- opt-out/deletion, notification disablement, accessibility blockers, P0/P1
 (Student outcomes are cohort aggregates, n >= 10, and become the evidence in the institution's renewal decision.)
```

## 1. Revenue [DRAFT] [REVIEW: accounting]

None of these is computable today: no customer, contract or revenue record exists. Source of truth is the books and signed orders, never product subscriptions alone ([`ANALYTICS-AND-METRICS-DICTIONARY.md`](../../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md)).

| KPI | Definition | Formula (numerator / denominator) | Source system | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| ARR | annualized value of signed agreements in force | sum of annual recurring contract value in force | signed orders; accountant's schedule | Founder / accountant (qualified one unassigned) | monthly | none until baseline |
| MRR | monthly recurring revenue | ARR / 12 + recurring monthly student revenue | books | Founder | monthly | none until baseline |
| New ARR | ARR from agreements newly effective in period, split new / renewal / expansion | sum of new annual value, reported separately by motion | signed orders | Founder | monthly | none until baseline |
| Gross margin | share of revenue left after cost of serving | (revenue - hosting - AI inference - support - implementation cost) / revenue | books | Founder | monthly | none until baseline (Finance guardrail proposal exists; not a target) |
| CAC | cost to acquire a customer | sales and marketing spend / new customers acquired | books + `gtm_accounts` | Founder | quarterly | none until baseline |
| CAC payback (months) | months of gross profit to repay CAC | CAC / monthly gross profit per customer | books | Founder | quarterly | none until baseline |
| LTV | lifetime gross profit of a customer | annual recurring revenue x gross margin / annual logo churn | books + contracts | Founder | quarterly | none until baseline |
| NRR | retention including expansion | (starting recurring revenue + expansion - contraction - churn) / starting recurring revenue (`netRevenueRetention`) | contracts | Founder | quarterly | none until baseline |
| Signed institutions | institutions or departments with a signed agreement carrying a binding commitment | count | [`app/src/lib/ops/commitments.ts`](../../../app/src/lib/ops/commitments.ts) commitment register | Founder | monthly | none until baseline |
| Bookings vs billings vs cash vs recognized revenue | four separate figures; never conflated | per accountant's policy | books | Founder / accountant | monthly | n/a |

Formulas are the founder's, taken verbatim; the two CAC forms match `kpi.ts` ([VERIFIED]). `[REVIEW: accounting]` for revenue-recognition and churn-denominator policy.

## 2. Pipeline [DRAFT]

Stage ids exact from [`stages.ts`](../../../app/src/lib/gtm/stages.ts). No pipeline value, probability or forecast is approved ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)); report counts and unweighted amounts.

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Accounts scored | target accounts with a dated, cited target score | count of `target_account` rows with a score and cited observations | `gtm_accounts` | Founder | weekly | 5 outreach touches/week in weeks 1-4 [ASSUMPTION, plan]; no outcome target |
| Qualified accounts | opportunities in `qualified` or later | count entering `qualified` in period | `gtm_accounts` | Founder | weekly | none until baseline |
| Stage conversion | opportunities that left a stage for `contracted` / opportunities that entered it, by entry-date cohort | numerator / denominator with sample size printed | `gtm_accounts` stage history | Founder | monthly | none until baseline; a stage has no probability until it has an approved minimum sample |
| Sales cycle | elapsed days `qualified` entry to `contracted` or `closed_lost`; median plus censored open | median days, count shown | stage history | Founder | monthly | none until baseline |
| Qualified pipeline coverage | unweighted `qualified`-or-later amount / period target set by Finance | amount / target | `gtm_accounts`, Finance | Founder | monthly | none until baseline |
| Forecast category counts | Commit, Best case, Pipeline, Omitted (by evidence, not seller confidence) | counts | `gtm_accounts` | Founder | weekly | n/a |
| Forecast accuracy | commit at period start / `contracted` in period | ratio with deal count | `gtm_accounts` | Founder | quarterly | none until baseline |
| Pilot proposals issued (non-binding) | proposals delivered at `proposal` stage | count | `gtm_accounts` | Founder | weekly | activity measure only |
| Pilot-to-annual conversion | pilots converted to a paid annual contract / completed pilots (`pilot_conversion_rate`); extensions and no-decision reported separately | numerator / denominator | `gtm_pilots`, contracts | Founder | per cohort | none until baseline; no pilot has run |
| Loss reasons | `closed_lost` with reason code and future-contact rule | count by reason | `gtm_accounts` | Founder | monthly | n/a |
| Overdue decision-log items | unresolved entries past target date, highest risk first (`overdue()` in `pilot.ts`) | count | `gtm_decision_log` | Founder | weekly | 0 high-risk overdue [ASSUMPTION] |

Diagnostic only: website visits, content views, webinar registrations, follower counts.

## 3. Activation [DRAFT] [REVIEW: privacy]

Definitions are [VERIFIED] controlled proposals in [`METRIC-DICTIONARY.md`](../../market-readiness/METRIC-DICTIONARY.md) and the commercial dictionary; the `student_activated` and `student_first_win` events are **unimplemented**, and the existing course-plus-`studied` report in [`ANALYTICS.md`](../../../ANALYTICS.md) is a different legacy funnel that must not be published as this rate.

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Eligible cohort | people validly included in the signed cohort at the cutoff | count from approved roster | customer-approved roster | Product / customer | per cohort | n/a |
| Activation rate (`student_activation_rate`) | eligible invited students completing consent/notice and minimum setup | activated accounts / eligible invited students | proposed `student_activated` event | Product | weekly (pilot) | none until baseline |
| First meaningful action rate (`first_meaningful_action_rate`) | activated users who reach Today, understand one reversible action and its source/limits and the help route, then complete, schedule, snooze or defer it | users completing the defined value event / activated users | proposed `student_first_win` event + sample QA | Product | weekly | none until baseline; playbook UAT figure (80% unaided within 10 minutes) is an unapproved [ASSUMPTION] design goal |
| Time to first value | elapsed consented start to first win in a fixed window; incomplete attempts shown as censored count/share | distribution plus censored share | validated timestamps | Product | weekly | none until baseline |
| Workflow completion rate (`workflow_completion_rate`) | completed core-workflow attempts | completed workflows / users who began the workflow | validated events | Product | weekly | none until baseline |
| Institution activation | tenant configured with owner and backup named, `pilotReadiness` clean | binary per account, then count | `gtm_pilots` | Customer success | per pilot | n/a |

Exclusions: invitation delivery, login, open, demo/sample data, staff-assisted tests. Pilot "student confidence/satisfaction" is a self-reported survey (midpoint and final), non-causal.

## 4. Retention [DRAFT]

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Meaningful retention | prior eligible activated participants with an approved useful action in a later window | retained / prior activated (Day 7, Day 30, week 4) | validated events; `public.activity` for the legacy return figure | Product | weekly | none until baseline |
| Logo retention (renewal decision rate) | contracts with a final renewed/expanded/downgraded outcome | eligible contracts with final renewed, expanded or downgraded / eligible contracts with any final renewal outcome | contracts | Founder | per renewal cohort | none until baseline; no contract has reached term |
| Churn decision rate | contracts with a final churned outcome | final churned / eligible contracts with any final outcome (never all contracts that ended); extensions and unresolved separate | contracts | Founder | per renewal cohort | none until baseline |
| Gross retention | value renewed at term before expansion | renewed value / value up for renewal | contracts | Founder | per renewal cohort | none until baseline |
| NRR | see Revenue | see Revenue | contracts | Founder | quarterly | none until baseline |

Retention measures usefulness, not compulsion: no streaks, shame notifications or fear urgency ([`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md); `engagement.test.ts`).

## 5. Customer health [DRAFT] [REVIEW: privacy]

No score exists. [`CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md) is canonical (see the playbook section G.2 for the founder's alternative weights). The existing nightly `compute_account_health()` is unavailable/unreviewed and must not supply a color.

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Account review completeness | active accounts with a human-reviewed health narrative in the last 30 days | reviewed accounts / active accounts | CS records | Customer success | monthly | 100% of active accounts [ASSUMPTION] |
| Dimension coverage | health dimensions with a validated source for the account | dimensions with evidence / total dimensions | CS records | Customer success | monthly | n/a; missing is "unavailable", not neutral |
| Open overrides | accounts with an open P0/P1 security, privacy, accessibility, safety, legal/rights, tenant-isolation or integrity issue | count | incident log | Founder | weekly | 0 [ASSUMPTION] |
| Proposed composite (if used) | weighted dimensions per the canonical model | per canonical weights, human reviewed, shown beside components | CS records | Customer success | monthly | none; shadow only |

## 6. Product adoption [DRAFT]

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Weekly Prepared Action Rate (proposed north star, Engine 2) | eligible activated participants completing a weekly plan and at least one self-selected relevant next action | those participants / eligible activated participants in week | privacy-safe field source (absent) | Product | weekly | none until baseline |
| Weekly active use | activated student with at least one meaningful engagement in the week | such students / activated students | validated events; `activity` marks (`opened`) give a legacy WAU | Product | weekly | none until baseline |
| Staff workflow use | staff-console tasks completed in the cohort | count per cohort | tenant audit | Customer success | weekly | n/a |
| Readiness progress (approved checklist aggregate) | aggregate completion of the non-authoritative readiness checklist | completed items / eligible items, aggregate, n >= 10 | approved checklist aggregate | Product | weekly | none until baseline; not official registration status |
| Notification disablement / opt-out rate | opt-outs per delivered message | opt-outs / delivered (`optOutAlert` above 0.1% with 1,000 or more delivered) | `gtm_communication_events` | Growth owner | weekly | review trigger 0.1% (code) |

Ask/AI use is **never measured at individual level** (`ai_usage` forbidden).

## 7. Support [DRAFT]

No staffed support system exists (go/no-go priority 6); every figure is unavailable until one does.

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Support burden | contacts per activated participant by severity | cases / activated participants | support system (absent) | Support (HR interim) | weekly | none until baseline |
| Acknowledgement and resolution | within **published** hours and severities only | resolved within target / cases | support system | Support | weekly | published targets only; no 24/7 |
| Unresolved age | age of open cases | median and max days | support system | Support | weekly | none until baseline |
| Repeat-contact rate | cases from a participant already contacted for the same issue | repeat / cases | support system | Support | monthly | none until baseline |
| Support issue reduction (pilot metric) | change in support contacts for the pilot workflow against a frozen baseline | (baseline rate - pilot rate) / baseline rate, cohort aggregate | support system + baseline | Customer success | midpoint, final | none until baseline; self-reported or counted, non-causal |
| Staff time / friction (pilot metric) | staff-reported time on manual reminders and follow-up | survey or time log, aggregate | customer survey | Customer success | midpoint, final | none until baseline; labelled self-reported |

## 8. Security and trust [DRAFT] [REVIEW: security]

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Open P0/P1 | incidents and findings at P0/P1 | count; time to notice, time to resolve | incident log; [`docs/trust/APM-RUNBOOK.md`](../../trust/APM-RUNBOOK.md) | Security (unassigned; HR interim) | weekly | 0 open launch-blocking [ASSUMPTION, matches go/no-go] |
| Independent assessment status | go/no-go priorities 2-3 | status per blocker (open / scoped / in progress / closed with clean retest) | [`EVIDENCE-REGISTER.md`](../../../EVIDENCE-REGISTER.md) | Founder | weekly | closed before any paid pilot |
| Evidence age | days since each evidence row was last refreshed; expired rows | max age; count expired | evidence register | Security | monthly | no expired evidence in a shared packet [ASSUMPTION] |
| Security-review cycle time | days from a customer's first questionnaire to sign-off | days | `gtm_decision_log` | Security | per review | none until baseline |
| Restore success | restore drills within the recovery objective / drills run | ratio | [`RESTORE.md`](../../../RESTORE.md) records | Engineering | per drill | none until baseline; none run |
| Claims incidents | claims withdrawn or corrected, and hours to correct | count; hours | claims log ([`CLAIM-WITHDRAWAL-RUNBOOK.md`](../../CLAIM-WITHDRAWAL-RUNBOOK.md)) | Claims owner | monthly | 0 reaching a channel [ASSUMPTION, brand strategy] |
| Rights requests | export / deletion requests and clock breaches | count; breaches | rights queue | Privacy (unassigned) | monthly | 0 clock breaches [ASSUMPTION] |

## 9. Cash and runway [DRAFT] [REVIEW: accounting]

Actual cash lives in the books and bank records, never inferred from repository activity ([`docs/finance/README.md`](../../finance/README.md)). Forecast figures come from the Finance model tab (name the scenario).

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Cash balance | month-end cash | bank balance | books | Founder | monthly | n/a |
| Net burn | monthly net cash outflow | cash out - cash in, trailing three-month average [ASSUMPTION] | books | Founder | monthly | none until baseline |
| Runway (months) | months of operation at current net burn | cash balance / average monthly net burn [ASSUMPTION definition] | books | Founder | monthly | minimum-cash policy proposed in the Finance model (six months) [ASSUMPTION; not a decision] |
| Break-even month | first month where cumulative gross profit covers cumulative operating expenses and required cash obligations | per the founder's formula | Finance model, Base scenario (forecast) | Founder | quarterly | n/a; forecast only |
| Receivables and deferred revenue | invoiced unpaid; billed in advance | per accountant | books | Founder | monthly | n/a; no billing operation exists |

## 10. Delivery capacity [DRAFT]

| KPI | Definition | Formula | Source | Owner | Cadence | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Active pursuits vs cap | accounts in active pursuit | count vs cap of 3 until delivery capacity is measured on a real pilot | `gtm_accounts` | Founder | weekly | cap 3 [VERIFIED proposal in `ACCOUNT-SCORING-AND-FORECAST.md`] |
| Active pilots vs cap | pilots in `implementation` or `live` | count vs capacity; cohort 10-200 | `gtm_pilots` | Founder | weekly | n/a |
| Implementation time | accepted charter or contract milestone to customer-accepted launch gate, with pause reasons | calendar days | `gtm_pilots` | Customer success | per pilot | none until baseline; no completed implementation |
| Implementation hours per pilot | staffed hours consumed | sum of logged hours | time log | Customer success | per pilot | none until baseline |
| Support load vs capacity | expected contacts (activated x contacts per activated) vs staffed capacity | `Admit(c) = min(Demand(c), (SupportCapacity - SupportLoad) / ContactsPerActivated(c))` from the growth plan | support system | Growth owner | per 100-250 block | next block opens only if previous block's retention, support and guardrails are within thresholds |
| Seat coverage | critical seats with a named, accepted backup | seats with backup / critical seats | owner matrix | Founder | monthly | 0 critical seats without a backup before activation [ASSUMPTION; go/no-go priority 6] |
| Founder hours | hours per week vs stated capacity | logged hours | time log | Founder | weekly | within stated capacity |

## Meeting cadence [DRAFT]

With one person holding every seat, run one combined weekly operating review and treat the separate rows as agenda blocks until seats are filled. The company's QBR agenda and OKR rules are in [`03-okrs-planning-metrics.md`](../../company/leadership-system/03-okrs-planning-metrics.md); this table is the GTM layer. Time boxes are [ASSUMPTION].

| Meeting | Cadence / length | Owner | Agenda | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| Weekly revenue | weekly, 45 min | Founder (sales owner) | every commit and best-case opportunity against evidence; stale next actions; expired proposals; missing approvers; overdue decision-log items; new scores; capacity cap | `gtm_accounts`, `gtm_decision_log`, pipeline KPIs | updated stages, dated next actions, a one-line pipeline note; no forecast value |
| Weekly product / engineering | weekly, 30 min | Founder (product owner) | activation and first-win events (instrumentation status), friction, release candidate and CI, P0/P1, accessibility blockers | activation and adoption KPIs, CI, incident log | prioritized fixes, instrumentation decisions |
| Weekly customer success | weekly, 30 min (pilot only) | Customer success (founder interim) | frozen-denominator weekly pilot report, guardrails, support queue, open decisions, next owners | weekly pilot report, support KPIs | continue / correct / pause per pilot; weekly report sent to sponsor |
| Weekly growth | weekly, 45 min | Growth owner (founder interim) | D1-D4 dashboards, claims register QA, content calendar, consent and suppression, experiments (biweekly) | growth dashboards, content register | publish / hold decisions; claim corrections |
| Daily glance | daily, 10 min | Growth owner | complaints, accessibility, claims, incidents (D6) | D6 | stop or escalate |
| Monthly finance | monthly, 60 min | Founder with accountant when engaged | cash, burn, runway, CAC, payback, margin, Base vs actual, assumption changes, hiring gates | books, Finance model tab, KPI revenue and cash tables | updated reforecast; labelled actual vs forecast; hiring gate decisions |
| Monthly security and risk | monthly, 60 min | Security owner (unassigned; HR interim) | evidence age and expiry, P0/P1, assessments, subprocessors, retention, claim expiry, rights requests | evidence register, incident log, claims log | renew, close or escalate; claim withdrawals |
| Quarterly strategy / OKR | quarterly, 90 min pre-seed | Founder with advisor | score OKRs; each motion GO / GO WITH CONDITIONS / PAUSE / NO-GO; scorecard exceptions; stop list; next-quarter OKRs and guardrails | quarterly pack | motion decisions as records; reissued go/no-go if material change |

Required discipline: every meeting produces a record; a quarterly review stops something; no meeting waives a customer, counsel, security, privacy, accessibility, insurance, accounting or provider authority.

## Evidence state

**Repository evidence.** `kpi.ts` (16 definitions, 7 reused), the metrics dictionaries, scoring and forecast model, first-year measures (3 measured, 4 instrumented, 16 defined) and OKR rules.

**Operational evidence.** No KPI has an observed value: no customer, pipeline history, validated activation or retention event stream, support system, accounting source or runway figure is evidenced.

**Missing proof.** Approve event definitions and privacy floor; implement and validate `student_activated`, `student_first_win` and the weekly-action source; finance-approved cost/revenue/customer policy; stage history in `gtm_accounts`; support system; baselines before any target.

## Claim ceiling

Semester may use these definitions for instrumentation design and internal review, and may report validated observed measures only with definition version, source, population, window and caveats.

## Prohibited claims

Do not publish values, benchmarks, trends, lift, ROI, traction, product-market fit, customer or revenue metrics, or causal outcomes from targets, placeholders, synthetic or demo data, or unvalidated streams. No vanity metric is evidence.

## Professional review required

[REVIEW: accounting] ARR/MRR/CAC/LTV/margin/runway definitions and churn denominators. [REVIEW: privacy] event fields, privacy floor, aggregate reporting and any health signal. [REVIEW: security] security KPIs and evidence-age policy.
