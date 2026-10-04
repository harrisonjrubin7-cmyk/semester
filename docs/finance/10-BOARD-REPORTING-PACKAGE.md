<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 10. Founder and board finance reporting package

| Control | Value |
| --- | --- |
| Status | **TEMPLATE WITH PLAN COLUMNS RENDERED; ACTUALS NOT YET REPORTED** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

The package exists so the same numbers, defined the same way, reach the founder every week and the board every quarter, and so that a decision request always arrives with the metric that triggers it. The plan columns come from the Base scenario; the actual columns are blank because no actual exists. *The first real reading replaces the plan, it does not average with it.*

## Cadence

| Report | Audience | When | Owner | Source |
| --- | --- | --- | --- | --- |
| Weekly operating flash (one screen) | Founder, leads | Monday | Finance operator | Bank, Stripe, CRM, support queue |
| Monthly close and management pack | Founder; board observers | Business day 10 | Finance operator, reviewed by CPA | Ledger after reconciliation ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) |
| Quarterly board package | Board | 10 days before the meeting | Founder with finance | Monthly packs plus forecast refresh |
| Annual budget and tranche request | Board | Q4 | Founder | Model re-baselined with actuals |
| Ad hoc: trigger breach | Founder, board chair | Within 2 business days | Finance operator | [06](06-SCENARIOS-AND-SENSITIVITIES.md) trigger table |

## Page 1: financial snapshot (plan from Base, actual to be reported)

| Metric | Plan Y1 | Plan Y2 | Plan Y3 | Actual to date |
| --- | ---: | ---: | ---: | --- |
| Revenue ($k) | 1 | 507 | 2,302 | [not yet reported] |
| ARR at year end ($k) | 16 | 163 | 1,528 | [not yet reported] |
| Gross margin | n/m | -71.0% | 15.9% | [not yet reported] |
| Net burn ($k) | 2,456 | 4,780 | 5,491 | [not yet reported] |
| Cumulative cash need ($k) | 2,456 | 7,236 | 12,727 | [not yet reported] |
| Cash balance ($k) | n/a | n/a | n/a | [not yet reported] |
| Runway (months at trailing 3-month net burn) | n/a | n/a | n/a | [not yet reported] |
| Annual logos at year end | 0.6 | 3.6 | 24.4 | [not yet reported] |
| Paying students at year end | 0 | 257 | 720 | [not yet reported] |
| Headcount (FTE) | 18.4 | 31.4 | 40.4 | [not yet reported] |

## Quarterly board package: contents

1. **Decisions requested** (first page, one line each): the decision, the metric or gate that triggers it, the amount and the owner. Examples: release the next capital tranche; open or hold a gate; approve a price book version; approve an insurance program; engage or change an adviser.
2. **Financial snapshot** (above) with plan, forecast, actual and variance for the quarter and year to date.
3. **Cash and runway**: opening and closing cash, net burn, runway, the funded tranche and distance to the next gate, 13-week cash forecast, accounts receivable aging, deferred revenue, and any covenant or investor-right dates.
4. **Pipeline and bookings**: qualified pipeline by stage and gate, signed orders (signed only; a proposal is not a booking), pilot status, conversion evidence, renewal calendar with notice dates.
5. **Unit-economics dashboard** (the [05](05-UNIT-ECONOMICS-DASHBOARD.md) table with actuals): CAC and payback by segment, gross margin, contribution margin, churn, net revenue retention, implementation margin and utilization, AI cost per active user and as a share of revenue, burn multiple.
6. **Scenario page**: the plan against Conservative and Enterprise-delayed, current trigger status, and the response pre-agreed for any trigger breached ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).
7. **Budget versus actual by function** with the approved-exception log ([07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md)): who approved what above their limit.
8. **Gate status**: for each of G0 to G5, the GO-NO-GO priorities closed, open, and the evidence date; this is the page that releases or holds the gated hires.
9. **Risk and compliance finance items**: insurance status and renewals, open items routed to counsel, CPA and tax adviser ([08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md)), vendor price changes, incidents and their cost, AI spend versus tenant budgets.
10. **Appendix**: assumption register changes since last quarter (`01`), model version and verification result (`verify.py` and `independent_check.py` output), reconciliation of the management pack to the ledger.

## Founder weekly flash: one screen

Cash and 13-week forecast; net burn versus plan; invoices due and overdue; Stripe payouts and disputes; open quotes and their approval state; pilots by phase; implementation hours logged versus planned; AI spend by tenant versus budget; support tickets per 100 users and oldest open; trigger lights from the [06](06-SCENARIOS-AND-SENSITIVITIES.md) table; spend approvals pending.

## Rules for the package

* **One definition.** Metric formulas are those in [05](05-UNIT-ECONOMICS-DASHBOARD.md) and `docs/commercial/ANALYTICS-AND-METRICS-DICTIONARY.md`; a change to a definition is a dated decision with the history restated.
* **Source of truth.** Cash from the bank, billings from the billing system, revenue from the ledger after the accountant's policy, usage from the metered tables. Where two disagree the package shows both and the reconciling item.
* **Signed orders only** count as bookings; ARR and MRR are not reported externally until the accountant approves the definitions (`REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`: *do not publish revenue, ARR/MRR, deferred revenue, margin or audit conclusions without approved accounting records*).
* **Nothing in the package is a public or investor claim** until it passes the claims register. Forecast and plan columns carry the label "planning model".
* **Confidentiality.** Board materials may contain customer names, contract terms and personnel data; distribute through the access-controlled data room, not email attachments; keep an access log.
* **Student data never appears.** Only aggregates; small-cell suppression applies to any cohort count under the minimum the privacy review sets.
* **The model version** (git revision, workbook hash, verification output) is printed on page 1 of every package so the numbers can be reproduced.

## What the first package should contain on the day it is first produced

The first real package will have no revenue. It should therefore show: cash and spend against the Tranche 1 plan, gate status G0 to G2 with the open GO-NO-GO priorities, the design-partner pipeline (conversations, scoped pilots, evidence exchanged), time-tracked implementation hours from any activated pilot, the first vendor and adviser quotes against the assumption register, and the decisions the board is asked to take next.
