# Weekly Revenue Review

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BLANK REVIEW TEMPLATE - NO PIPELINE VALUE, FORECAST OR REVENUE IS ASSERTED** |
| Owner | Harrison Rubin (interim, review chair; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] |
| Audience | **[INTERNAL]** only. Never shared with a prospect or customer |

> Operating document, not accounting or financial advice. A forecast here is an unbooked estimate; nothing is revenue until finance and counsel say so.

Label legend: **[VERIFIED]** proved by repository path; **[ASSUMPTION]** planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md`](../../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md) | Eight-item executive agenda (safety, funnel, pilot, individual funnel, evidence, finance, priorities) | A **revenue-motion** scorecard (activity through proposal), forecast-by-category table, held-stage list, decision-log fields and rules | The executive review is broad and prose; this is the weekly sales-motion instrument |
| [`../../commercial/ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) | Forecast categories (Commit / Best case / Pipeline / Omitted), "no approved probability", measures | Reused unchanged; adds a **Held** line | Single source for categories |
| [`../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md`](../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md), [`SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md) | Dashboard panels, stage definitions | The meeting that reads them | n/a |
| [`../../institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md`](../../institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md), [`WEEKLY_PILOT_REPORT.md`](WEEKLY_PILOT_REPORT.md) | Review of a running pilot | Different object: pre-contract sales motion | A pilot review must not mix with sales forecast |

## Gate

Per [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md): discovery, synthetic demos, evidence exchange and conditional scoping are the only live motions. Anything at or past a price quote, order form, invoice, payment, live data or activation is **HELD**, listed in its own line, and **never forecast as revenue**.

## Rules **[DRAFT]**

1. **No vanity metrics as progress.** Followers, page views, downloads, impressions, email opens and raw logins may appear only in a "diagnostic - not proof" footnote. Progress means accounts moved forward by a recorded stage exit (`SALES_EXIT` in [`stages.ts`](../../../app/src/lib/gtm/stages.ts)).
2. **Held stages never count as revenue.** The paid institutional pilot is NO-GO/RED; a proposal or `procurement_legal` item is shown but its forecast category is Pipeline or Best case at most, and a line whose next step would be payment or live data is shown under **Held**.
3. **Categories by evidence, not confidence** (Commit, Best case, Pipeline, Omitted). No stage probability is approved; report counts and unweighted amounts. Amounts are `[PRICE TO BE CONFIRMED]` until a price is approved, so the amount column is normally "price pending".
4. **Same stage names as the code**: `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review`, `proposal`, `pilot_or_implementation_SOW`, `procurement_legal`, `contracted`, `implementation`, `live`, `renewal`, `expansion`, `closed_lost`.
5. "No change" and "none this week" are recorded explicitly; a blank is not a zero.
6. Each commitment has one owner and one date.

## Agenda (45 minutes) **[DRAFT]**

| Min | Item | Output |
| --- | --- | --- |
| 0-5 | Last week's commitments: done / not done / why | Closed or carried with reason |
| 5-15 | Scorecard (below) read as counts with deltas | Anything off-plan named |
| 15-25 | Each account at `qualified` or later: stage, gate evidence, next action and date, blocker | Stale items (next action overdue) listed |
| 25-32 | Forecast by category and **Held** list | Nothing moved up a category without evidence |
| 32-38 | Blockers, escalations, capacity (hours available vs. committed; single-founder load) | Decisions needed |
| 38-45 | Next-week commits (max five) and decision log | Owners and dates |

## Scorecard - week [N], [DATE RANGE] **[INTERNAL]**

All values are counts of recorded CRM events. Target column is **[ASSUMPTION]** until calibrated; blank until set.

| Measure | This week | Last week | 4-week total | Target [ASSUMPTION] | Note / evidence link |
| --- | ---: | ---: | ---: | ---: | --- |
| Accounts researched (target score recorded) | | | | | |
| Accounts contacted (first touch sent) | | | | | |
| Replies (human, any) | | | | | |
| Meetings booked | | | | | |
| Meetings held (discovery calls) | | | | | |
| Qualified opportunities (`SALES_EXIT.qualified` met) | | | | | |
| Demos held (synthetic data) | | | | | |
| Design sessions held | | | | | |
| Proposals sent (non-binding drafts) | | | | | |
| Pilot/SOW drafts under review (`pilot_or_implementation_SOW`) | | | | | |
| Procurement/legal reviews open | | | | | |
| **Held-stage items** (would require payment, live data, activation, conversion) | | | | n/a | Never revenue; list below |
| Closed lost (with reason code) | | | | | |
| Stale next actions (overdue) | | | | 0 | |

Conversion ratios (reply/contact, meeting/reply, qualified/meeting) are computed only when the denominator is at least 10 and are labelled with that denominator. Below that, show counts only.

## Forecast by category **[INTERNAL]**

| Category | Definition (from ACCOUNT-SCORING) | Accounts | Unweighted amount | Evidence check done this week? |
| --- | --- | ---: | --- | --- |
| Commit | `procurement_legal` or later, deal-desk review with no refusals, named signer, date inside the period | [ ] | price pending | [ ] |
| Best case | `proposal` or `pilot_or_implementation_SOW`, sponsor and budget cycle recorded, reviews complete | [ ] | price pending | [ ] |
| Pipeline | `qualified` through `security_privacy_accessibility_review` | [ ] | price pending | [ ] |
| Omitted | `target_account`, `discovery`, anything past its next-action date | [ ] | not forecast | n/a |
| **Held** | Any item whose next step is held by GO-NO-GO (payment, live data, activation, annual conversion, reference) | [ ] | **excluded from all totals** | [ ] |

Report new business, renewal, expansion and services separately; never count a pilot and its hypothetical annual conversion twice. Forecast accuracy and weighted pipeline are not reported until approved probabilities and a minimum sample exist.

## Blockers and next-week commits

| # | Blocker / commit | Account | Owner | Due | Escalation needed? |
| --- | --- | --- | --- | --- | --- |
| 1 | [..] | [..] | Harrison Rubin (interim) | [DATE] | [Y/N] |

## Decision log fields

| Field | Content |
| --- | --- |
| ID | RR-[week]-[n] |
| Date / chair | |
| Decision (one sentence) | |
| Category | pricing / scope / pilot length / claims / legal / security / privacy / accessibility / capacity / account |
| Account (if any) | |
| Options considered | |
| Evidence linked | (a decision with no evidence is "opinion" and is marked so) |
| Owner / due date | |
| Reversibility | reversible / one-way |
| Needs professional review? | [REVIEW: counsel] etc. |
| Recorded as `D-<pull request number>`? | Decisions of lasting effect (price, pilot length) open a pull request and take its number (see root CLAUDE.md) |

Standing open decisions to carry until closed: pilot length (26 weeks per code versus 8-12 weeks assumption); individual price (D-134 / D-1154 / assumption conflict); institutional price book (none approved); the paid-pilot gate.

## Evidence state

**Repository evidence. [VERIFIED]** Stage vocabulary, forecast categories and claim limits exist at the cited paths.

**Operational evidence.** No account has moved through a stage, no forecast has been reviewed and no weekly review has been run.

**Missing proof.** Run four consecutive reviews and record what the categories got wrong.

## Claim ceiling

Internal use only. No figure here may leave Semester as a metric.

## Prohibited claims

Do not report pipeline value, bookings, ARR, win rate or recognized revenue as facts; do not count held items; do not describe an account as a customer before `contracted`.

## Professional review required

Forecast and revenue wording: [REVIEW: accounting]. Pricing decisions: [REVIEW: counsel] [REVIEW: tax].
