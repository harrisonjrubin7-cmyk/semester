# Analytics and Metrics Dictionary

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DICTIONARY — DEFINITIONS PROPOSED; PRODUCTION SOURCES/VALUES UNACCEPTED** |
| Owner | Harrison Rubin — company-side metric owner; privacy reviewer, finance/accounting reviewer and backup data steward unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Source | [`../market-readiness/METRICS-AND-ANALYTICS-PLAN.md`](../market-readiness/METRICS-AND-ANALYTICS-PLAN.md) and [`GROWTH-FUNNEL-SPEC.md`](GROWTH-FUNNEL-SPEC.md) |

Every implemented metric must add: metric/event version, purpose/decision, eligible population, numerator/denominator, window/time zone, source/query, identity level, consent/authority, exclusions, late/duplicate handling, privacy threshold, owner, validation, retention/deletion, quality status and approved target. No definition below supplies an observed value.

| Metric | Controlled definition | Current source/evidence boundary |
| --- | --- | --- |
| eligible cohort | participants meeting frozen pilot eligibility and invitation rules | approved roster/cohort required; not repository counts |
| activation rate | approved minimum-setup completions / eligible invited population | invitation delivery/login alone excluded; proposed `student_activated` source unimplemented; the existing course-plus-`studied` report in `ANALYTICS.md` / `supabase/analytics.sql` is a different legacy funnel and must not be published as this rate |
| first-win rate | participants who reach Today, understand one relevant prioritized reversible action, its source/limitations and the relevant help route, then intentionally complete, schedule, snooze or defer it / participants completing approved minimum setup | a full first-week plan is not an extra gate; decision outcomes and coarse comprehension/help checks must be versioned and validated; report setup-to-first-win loss; QA required |
| time to first value | elapsed consented start to first win within a fixed observation window; report completion-time distribution plus incomplete attempts as censored, with censored count/share | exclude tests/support and invalid attempts; timestamps and censoring policy unaccepted |
| Weekly Prepared Action Rate | eligible activated participants completing a weekly plan and ≥1 self-selected relevant next action / eligible activated participants in week | proposed north star; privacy-safe field source absent |
| meaningful retention | prior eligible activated participants with an approved useful action in later window / prior eligible activated participants | raw return/login excluded; cohort/window required |
| support burden | cases by severity plus staffed-hours acknowledgement/resolution and unresolved age per approved population | staffed support system/hours absent |
| core reliability | good eligible critical-flow attempts / eligible attempts, with no-data separate | proposed SLI stream absent; not uptime/SLA |
| pipeline conversion | opportunities entering later controlled stage / opportunities eligible at earlier stage in the stated cohort/window | stage evidence/history absent; never use contacts as opportunities |
| sales cycle | elapsed `qualified` entry to authorized `contracted` or `closed_lost` decision; report distribution and censored open records | uses the implemented GTM vocabulary; no representative outcomes |
| implementation time | accepted charter/contract milestone to customer-accepted launch gate, with pause reasons | no completed customer implementation |
| pilot conversion | pilots reaching authorized annual agreement / pilots with final decision due in cohort | extensions/offboarding separate; no denominator yet |
| contract renewal decision rate | eligible contracts with a final `renewed`, `expanded` or `downgraded` outcome / eligible contracts with any final renewal outcome in the frozen cohort | extensions and unresolved/no-decision records are separately reported and excluded from the final-decision denominator; no customer contract cohort |
| contract churn decision rate | eligible contracts with a final `churned` outcome / eligible contracts with any final renewal outcome in the frozen cohort | never calculate as all contracts that ended; extensions and unresolved/no-decision are separate; no customer contract cohort |
| ARR/MRR/bookings/billings/cash/revenue | **[FINANCE/ACCOUNTING DEFINITIONS AND SOURCES REQUIRED]** | unavailable; never derived from product subscriptions alone |
| CAC/LTV/gross margin/payback | **[FINANCE-APPROVED COST, CUSTOMER, REVENUE AND COHORT POLICY REQUIRED]** | unavailable; no observed cost/revenue cohort |

## Event and reporting rules

Allow only pseudonymous actor where needed, approved tenant/cohort, event/version, coarse object type, timestamp, outcome, correlation ID and authority basis. Exclude free text, academic content, grades, sensitive categories, communications, exact location, secrets and raw tokens. Suppress/combine reports below the approved threshold (current proposal: 10); prevent differencing and log/report access.

Treat unavailable, not applicable, zero and suppressed as distinct states. Never silently change a definition; version it and avoid stitching incompatible series. Preserve validation samples and query hashes, record late data/restatements, and display uncertainty/missingness. Qualitative feedback is labeled self-reported; correlation is not causation.

## Evidence state

**Repository evidence.** Proposed product/pilot/GTM events, metric formulas, privacy rules and commercial structures support this controlled dictionary.

**Operational evidence.** No complete production telemetry, CRM history, finance/accounting source, validated attribution, approved targets or representative outcome series exists.

**Missing test/proof.** Approve purposes/fields/retention/access; implement versioned sources; validate against samples and deletion/withdrawal; reconcile denominators and finance systems; approve targets; operate data-quality and access reviews.

## Claim ceiling

Semester may use these definitions for instrumentation design and report only validated observed measures with definition version, source, population, window and caveats.

## Prohibited claims

Do not publish values, benchmarks, trends, lift, ROI, market traction, product-market fit, customer/revenue metrics or causal outcomes from targets, placeholders, synthetic/demo data or unvalidated event streams.
