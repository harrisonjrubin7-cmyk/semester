<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 04. Three-year financial model (Base scenario)

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

Month 1 is January 2027. Everything below is the **Base** scenario of [`semester-financial-model.xlsx`](semester-financial-model.xlsx); the other seven scenarios are in [06](06-SCENARIOS-AND-SENSITIVITIES.md). The workbook recalculates; this page does not.

## The shape of the plan is set by the gates, not by the sales plan

[`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) (3 Oct 2026) holds three revenue motions at NO-GO today: paid or broad individual acquisition, paid institutional pilots, and broad enterprise sale. Only invitation-only unpaid validation and non-activation design-partner work are authorized. A model that books Plus sales or paid pilots from month 2 would contradict the repository's own controlling decision, so every revenue line here sits behind a gate, and the gate month is an input (tagged `DECIDE`) that the founder, not the model, owns.

| Gate | What it unlocks | Base month | Evidence the repository requires first |
| --- | --- | ---: | --- |
| G0 Invitation-only unpaid validation | Free signups at 25% of trend, one named cohort | 1 | Conditional GO (priorities 1, 3, 4; 6-7 before supported activation) |
| G1 Design-partner pilot activated (unpaid) | First live tenant, no fee, 26 weeks | 5 and 8 | Priorities 1-8 closed: immutable candidate, DAST, accessibility review, counsel, entity/tax/insurance, support rota, restore drills, named customer scope |
| G2 Paid institutional pilot | Pilot fees, implementation fees, pilot-to-annual conversion | 12 | G1 pilot has an approved activation record and a measured closeout; priorities 1-9 |
| G3 Broad / paid individual acquisition | Plus checkout for new subscribers, paid acquisition test budget | 13 | Every invitation-validation gate plus a separate broad-rollout decision by founder, counsel, product, security, privacy, accessibility, support, operations |
| G4 Direct annual sales (no pilot first) | Direct department / campus contracts | 22 | First pilot-to-annual conversions evidenced |
| G5 System tier / broad enterprise | System-tier pilots and contracts | 26 | Repeated successful deployments and independent assurance |

First revenue of any kind in Base: **month 12**. Year 1 is a pre-revenue build-and-prove year by construction.

## Annual profit and loss ($ thousands)

| $k | Year 1 (2027) | Year 2 (2028) | Year 3 (2029) |
| --- | ---: | ---: | ---: |
| Student subscriptions | 0 | 7 | 34 |
| Pilot software (paid) | 0 | 150 | 445 |
| Institutional platform subscriptions | 1 | 68 | 528 |
| Implementation services | 0 | 278 | 1,125 |
| AI capacity add-on | 0 | 4 | 53 |
| Alumni module | 0 | 0 | 6 |
| Career / employer | 0 | 0 | 93 |
| Marketplace (net take rate) | 0 | 0 | 17 |
| **Total revenue** | **1** | **507** | **2,302** |
| Cost of revenue: student subscriptions (variable) | 4 | 44 | 106 |
| Cost of revenue: institutional platform (variable cost, integrations, customer success) | 6 | 106 | 378 |
| Cost of revenue: platform infrastructure, AI evaluation, support team (fixed) | 97 | 280 | 526 |
| Cost of revenue: implementation team | 102 | 437 | 885 |
| Cost of revenue: marketplace | 0 | 0 | 43 |
| **Gross profit** | **(207)** | **(360)** | **365** |
| Engineering and product | 1,091 | 1,932 | 2,193 |
| Security and privacy | 210 | 353 | 418 |
| Sales and partnerships | 84 | 504 | 981 |
| Marketing | 139 | 420 | 601 |
| Legal | 95 | 112 | 155 |
| Insurance | 41 | 70 | 120 |
| G&A (leadership, finance, people, tools, contingency) | 587 | 1,047 | 1,343 |
| **Total operating expenses** | **2,247** | **4,437** | **5,811** |
| **Operating result (EBITDA)** | **(2,454)** | **(4,798)** | **(5,445)** |

Gross margin: n/m / -71.0% / 15.9%. Gross margin is low early because the support, implementation and fixed-infrastructure costs exist before the revenue does; "n/m" means revenue is too small for the ratio to mean anything. No income tax, depreciation, capitalized software or financing cost is modeled (questions for the CPA and tax adviser are in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md)).

## Where the money goes

| $k | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Total payroll (all functions, burdened) | 1,647 | 3,802 | 5,187 |
| Total cost (cost of revenue + operating expenses) | 2,456 | 5,305 | 7,747 |
| Payroll as a share of total cost | 67% | 72% | 67% |
| Headcount at year end (FTE) | 18.4 | 31.4 | 40.4 |
| AI inference + evaluation | 27 | 68 | 182 |
| Infrastructure (variable + fixed) | 50 | 127 | 253 |
| Security, legal, insurance, accounting programs | 302 | 451 | 661 |

Payroll is about two-thirds of all cost in every year, so the funding need follows the hiring plan more closely than it follows any single revenue assumption other than the timing of the gates (sensitivities in [06](06-SCENARIOS-AND-SENSITIVITIES.md)). That is why the budget is governed by gates in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md).

## ARR, customers, cash, quarter by quarter

| Quarter end | ARR student $k | ARR institutional $k | ARR total $k | Annual logos | Pilots running | Paying students | Free active | Sponsored students | FTE | Cumulative burn $k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 2027 | 0 | 0 | 0 | 0.0 | 0.0 | 0 | 548 | 0 | 5.4 | 339 |
| Q2 2027 | 0 | 0 | 0 | 0.0 | 1.0 | 0 | 747 | 210 | 10.4 | 884 |
| Q3 2027 | 0 | 0 | 0 | 0.0 | 2.0 | 0 | 1,545 | 1,085 | 14.4 | 1,587 |
| Q4 2027 | 0 | 16 | 16 | 0.6 | 1.0 | 0 | 1,806 | 1,235 | 18.4 | 2,456 |
| Q1 2028 | 2 | 61 | 63 | 1.2 | 1.0 | 28 | 7,042 | 2,070 | 23.4 | 3,586 |
| Q2 2028 | 6 | 61 | 66 | 1.2 | 3.0 | 84 | 9,072 | 3,155 | 25.4 | 4,670 |
| Q3 2028 | 10 | 77 | 88 | 1.7 | 5.0 | 154 | 14,816 | 4,540 | 28.4 | 5,902 |
| Q4 2028 | 17 | 146 | 163 | 3.6 | 6.0 | 257 | 16,506 | 6,732 | 31.4 | 7,236 |
| Q1 2029 | 25 | 342 | 366 | 7.0 | 7.0 | 366 | 20,386 | 11,587 | 34.4 | 8,701 |
| Q2 2029 | 32 | 573 | 605 | 11.4 | 10.0 | 478 | 20,482 | 21,247 | 37.4 | 10,065 |
| Q3 2029 | 39 | 847 | 886 | 16.3 | 11.0 | 587 | 26,551 | 27,811 | 40.4 | 11,320 |
| Q4 2029 | 48 | 1,479 | 1,528 | 24.4 | 12.0 | 720 | 27,288 | 46,690 | 40.4 | 12,727 |

Counts of institutions are expected values (fractions appear because pipeline volumes are multiplied by scenario factors). "Sponsored students" are active users whose access an institution pays for; they carry cost but no consumer revenue.

## Cash, receivables and deferred revenue

| $k | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Cash collected | 0 | 524 | 2,256 |
| Operating cash flow | (2,456) | (4,780) | (5,491) |
| Net burn | 2,456 | 4,780 | 5,491 |
| Cumulative cash need at year end | 2,456 | 7,236 | 12,727 |
| Deferred revenue at year end (billed, not yet recognized) | 15 | 120 | 1,013 |
| Receivables at year end (net of reserve) | 16 | 98 | 1,007 |

**Peak funding need, months 1-36: $12.73M.** The model deliberately has no funding round in it: the honest number is the deepest cumulative cash trough, and the opening-capital cell in the workbook is an illustrative placeholder used only to show a cash-out month.

## Capital in tranches, released by gate

| Tranche | Funds | Cash needed in the period | Cumulative |
| --- | --- | ---: | ---: |
| Tranche 1 | Through month 12: invitation-only validation, design-partner pilot activated and closed out, paid-pilot decision taken | $2.46M | $2.46M |
| Tranche 2 | Through month 24: first paid pilots, first annual conversions, direct-sales gate | $4.78M | $7.24M |
| Tranche 3 | Through month 36: repeated deployments; enterprise gate decision | $5.49M | $12.73M |

Add a cushion of six months of the then-current burn at each close (about $1.57M after Tranche 1, $2.57M after Tranche 2, $2.66M after Tranche 3), so that no tranche is spent to zero before the next gate has been decided. The release conditions are in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md).

## Known limits of the model

* **Pipeline is not capacity-linked.** Pilot and direct-deal volumes are inputs, not a function of the number of account executives. Deferring sales hires therefore saves cost without reducing modeled revenue; treat those savings as an upper bound and read the utilization and "starts per sales FTE" ratios before relying on them.
* **Expected values, not distributions.** Institutional counts are fractional expectations; the scenarios bracket the range but there is no probability weighting.
* **Revenue recognition is a planning proxy** (ratable subscriptions, pilots and add-ons; services over three months). The accountant decides the real policy; billed, collected, entitled, delivered and recognized amounts are kept apart in the workbook (Billings, Cash collected, Deferred revenue) for that reason.
* **Linear infrastructure costs.** Per-user costs scale linearly; real vendor plans step. Fixed platform cost is a flat allowance by year.
* **Collection lag is fixed at two months**; bad debt is a flat share of invoiced billings.
* **No inflation, price escalators, multi-currency, income tax, depreciation, capitalized software, equity or financing costs.**
* **Marketplace revenue is shown net (take rate);** gross-versus-net presentation is an accountant determination.
* **One cost of capital is not assumed;** the opening-capital cell is illustrative.

## How to check this page

* `python3 docs/finance/model/verify.py` recalculates the workbook in LibreOffice and compares about 55,000 model cells in all eight scenarios with an independent Python run; it must report zero mismatches and every in-workbook check OK.
* `python3 docs/finance/model/independent_check.py` re-derives the student funnel and the Department tier with plain loops (no shared code with the model rows) and asserts they agree, including that no revenue is booked before the first gate.
* Both checks were run against a deliberately corrupted workbook / an off-by-one lag and failed, as a guard must.
