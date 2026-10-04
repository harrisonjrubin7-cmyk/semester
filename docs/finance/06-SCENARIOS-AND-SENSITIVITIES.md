<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 06. Scenarios and sensitivities

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

Eight scenarios share one set of formulas; they differ only in the parameter column on the workbook's `Scenarios` sheet. The mitigation column is not a forecast of what will happen: it shows what the pre-agreed response to a trigger is worth. The full-scope column is not a risk case at all: it prices a staffing proposal made by another part of the executive team.

## Definitions

| Parameter | Conservative | Base | Aggressive | Enterprise-delayed | High AI cost | Incident | Ent.-delayed + gated hiring | Full-scope staffing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Organic student acquisition multiplier | 0.6 | 1 | 1.5 | 1 | 1 | 1 | 1 | 1 |
| Free-to-paid conversion multiplier | 0.8 | 1 | 1.2 | 1 | 1 | 1 | 1 | 1 |
| Churn multiplier (students and institutions) | 1.25 | 1 | 0.85 | 1 | 1 | 1 | 1 | 1 |
| Pilot and direct-deal volume multiplier | 0.6 | 1 | 1.4 | 1 | 1 | 1 | 1 | 1 |
| Pilot-to-annual conversion multiplier | 0.8 | 1 | 1.1 | 0.9 | 1 | 1 | 0.9 | 1 |
| Institutional gates slip by (months) | 2 | 0 | -2 | 6 | 0 | 0 | 6 | 0 |
| Institutional price realization multiplier | 0.95 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Paid acquisition cost multiplier | 1.25 | 1 | 0.85 | 1 | 1 | 1 | 1 | 1 |
| AI unit cost multiplier (price or model-mix shift) | 1 | 1 | 1 | 1 | 2.5 | 1 | 1 | 1 |
| AI usage multiplier (requests per user) | 1 | 1 | 1 | 1 | 1.5 | 1 | 1 | 1 |
| Incident switch (1 = on) | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Delay for gated hires (months) | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| Full-scope staffing switch (1 = include the CTO-pack staffing roles) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

The Incident scenario also loads the cost inputs in the `Incident scenario` group of the Assumptions sheet: forensics, counsel, notification, regulatory response, emergency engineering (about $0.7M in total before service credits), a one-month service credit of 5% of core ARR, a six-point jump in paid-student churn for three months, a 15-point cut to renewal rates for the next twelve months and a 60% cut to new starts for six months. **Insurance recovery is counted as zero** until the broker confirms the policy, retention and exclusions.

## Results

| Metric | Conservative | Base | Aggressive | Ent.-delayed | High AI cost | Incident | Ent.-delayed + gated | Full-scope staffing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Revenue, Year 1 | $0 | $1k | $28k | $0 | $1k | $1k | $0 | $1k |
| Revenue, Year 2 | $227k | $507k | $915k | $167k | $507k | $343k | $167k | $507k |
| Revenue, Year 3 | $1.06M | $2.30M | $4.00M | $1.26M | $2.30M | $2.24M | $1.26M | $2.30M |
| ARR, month 24 | $64k | $163k | $457k | $77k | $163k | $136k | $77k | $163k |
| ARR, month 36 | $532k | $1.53M | $2.82M | $728k | $1.53M | $1.46M | $728k | $1.53M |
| Annual logos, month 36 | 9.2 | 24.4 | 46.0 | 10.9 | 24.4 | 22.9 | 10.9 | 24.4 |
| Gross margin, Year 3 | -69% | 16% | 46% | -45% | 1% | 14% | -20% | 16% |
| Operating result, Year 3 | -$6.38M | -$5.45M | -$4.13M | -$6.25M | -$5.78M | -$5.48M | -$5.82M | -$10.84M |
| Net burn, Year 3 | $6.26M | $5.49M | $3.62M | $6.25M | $5.83M | $5.53M | $5.82M | $10.89M |
| Burn multiple, Year 3 | 13.4x | 4.0x | 1.5x | 9.6x | 4.3x | 4.2x | 8.9x | 8.0x |
| **Peak funding need (months 1-36)** | $13.73M | $12.73M | $10.69M | $13.74M | $13.16M | $13.60M | $12.71M | $22.12M |
| Change in peak funding vs Base | $1.00M | $0 | -$2.03M | $1.01M | $434k | $870k | -$15k | $9.39M |
| Month cash runs out on the illustrative $3M | 14 | 14 | 14 | 14 | 14 | 14 | 15 | 12 |
| Implementation margin, Year 3 | -70% | 21% | 54% | -42% | 21% | 21% | -8% | 21% |
| Implementation utilization, Year 3 | 48% | 108% | 169% | 59% | 108% | 108% | 78% | 108% |
| AI cost / revenue, Year 3 | 12% | 8% | 7% | 11% | 22% | 8% | 11% | 8% |

## What each scenario is for

* **Conservative** (acquisition x0.6, conversion x0.8, churn x1.25, pilot volume x0.6, gates two months late): the case the funding plan must survive. Peak need $13.73M; Year 3 revenue $1.06M. The company reaches month 36 with 9 annual logos and a burn multiple of 13x, i.e. spending that the revenue does not justify. It is the argument for gating hires, not for a bigger raise.
* **Base:** peak need $12.73M, month-36 ARR $1.53M, burn multiple 4.0x in Year 3.
* **Aggressive** (gates two months early, volume x1.4, conversion x1.2): peak need $10.69M; month-36 ARR $2.82M. More revenue lowers the funding need by only $2.03M because most cost is fixed headcount; the success case still needs the full capital plan, and its implementation team is at 169% utilization, meaning it must hire faster than the plan.
* **Enterprise-delayed** (every institutional gate slips six months, pilot conversion x0.9, hiring unchanged): peak need $13.74M, $1.01M more than Base, and Year 3 implementation margin -42% because the implementation team is paid while idle (59% utilization).
* **High AI cost** (unit cost x2.5, usage x1.5, no repricing): peak need $13.16M ($434k more); AI rises to 22% of Year 3 revenue and Year 3 gross margin falls to 1%. Smaller than the headline risk in absolute dollars because the user base is small by Year 3; it scales with sponsored students, so it matters more in Year 4 and beyond than the three-year cash view shows.
* **Incident** (SEV-0 in month 14): peak need $13.60M ($870k more than Base). The direct response cost is about $0.7M; the rest is lost and delayed revenue. The cheaper protection is the control set in [09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md) and [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md), plus a cyber policy whose limits and exclusions finance has read.
* **Full-scope staffing** (Base revenue and Base gates; the CTO target-architecture pack's staffing plan, stages S1 to S4, costed in addition to the Base roles): peak need $22.12M, $9.39M more than Base, headcount 70 FTE at month 36 against 40, and a burn multiple of 8.0x because revenue does not change. That pack deliberately leaves compensation and budget to the CFO (`docs/target-architecture/08-ORGANIZATION-AND-MILESTONES.md`: *no compensation or budget figures are asserted*). This is the figure. In the model the gates are inputs, so extra engineering cannot move them; and each month the paid-pilot gate opens earlier is worth only about $384k of funding need, so the extra team would have to bring that gate forward by about 24 months to pay for itself through timing alone. Gate timing is not purely an engineering function (counsel, assessors and the customer set it too), which is why the sequence is worth adopting and the count is worth releasing by tranche.
* **Enterprise-delayed with gated hiring** (same slip, go-to-market and implementation hires wait six months): peak need $12.71M, $1.03M less than the unmitigated delay, and implementation margin recovers to -8%. That is the value of tying those hires to the evidence gates rather than to the calendar.

## Triggers and pre-agreed responses

| Trigger (measured, monthly) | Threshold | Pre-agreed response | Owner |
| --- | --- | --- | --- |
| First paid-pilot gate not open by its planned month | +2 months | Freeze all gated hires; board review of Tranche 2 timing | Founder; board |
| Pilot-to-annual conversion (rolling, 4+ pilots) | below 0.7 x model | Stop new implementation hires; review package and price; extend design-partner learning | Founder; finance |
| Implementation utilization | below 60% for 2 months, or above 120% for 2 months | Re-time implementation hires; fix scope or price | COO / CS lead; finance |
| AI cost / revenue | above 12% for a quarter | Tighten routing and caching; review included allowance; do not reprice mid-term without notice | AI governance board; finance |
| Free-user serving cost / student revenue | above 1.0x | Cut free-tier AI cap; hold paid acquisition at zero | Product; finance |
| Gross logo retention at first renewals | below 85% | Customer-success review of every non-renewal; pause expansion selling | CS lead |
| Cumulative cash need | within 6 months of the funded tranche | Start the next raise only if its gate has opened; otherwise cut to the gated plan | Founder; board |
| SEV-0 / SEV-1 security incident | any | Invoke crisis runbook; legal and insurer notification per policy; hold public claims | Incident commander; counsel |
| Vendor price change | model input moves more than 20% | Re-run the model; decide pass-through or substitute | Finance |

## Sensitivities: what moves the funding need

One variable at a time, Base scenario. Funding need is the deepest cumulative cash trough; negative = less cash needed.

| Variable | Input at its upside value: change in peak need | Input at its downside value: change in peak need | Change in month-36 ARR (upside / downside) |
| --- | ---: | ---: | ---: |
| Paid-pilot gate opens (months) | 3 months earlier (-1.15M) | 6 months later (+0.99M) | +0.64M / -0.78M |
| Engineering, product, security salaries | -15% (-0.85M) | +15% (+0.85M) | +0.00M / +0.00M |
| Payroll burden | 18% (-0.35M) | 30% (+0.70M) | +0.00M / +0.00M |
| Pilot and direct-deal volume | x1.3 (-0.62M) | x0.7 (+0.62M) | +0.42M / -0.42M |
| AI unit cost | x0.5 (-0.08M) | x2 (+0.16M) | +0.00M / +0.00M |
| Institutional price realization / ACV | +20% (-0.13M) | -20% (+0.13M) | +0.24M / -0.24M |
| Organic student signups | x2 (+0.06M) | x0.5 (-0.03M) | +0.04M / -0.02M |
| Pilot-to-annual conversion | +15 pts (-0.04M) | -15 pts (+0.04M) | +0.10M / -0.10M |
| Free-to-paid conversion (Plus) | x2 (-0.04M) | x0.5 (+0.02M) | +0.05M / -0.02M |
| Gross logo renewal rate | 94% (-0.00M) | 80% (+0.01M) | +0.01M / -0.02M |

Three things stand out. The timing of the gates, the engineering salaries and the payroll burden dominate. The student-side variables barely register in a three-year cash view. And no single revenue-side assumption moves the funding need by more than about $617k. One result is counter-intuitive and worth keeping: **doubling organic signups raises the funding need**, because at the Base conversion rate each additional free student costs more to serve than the share who convert returns (see [05](05-UNIT-ECONOMICS-DASHBOARD.md)).

## Levers that reduce the funding need

Each applied alone to Base (the last two combine them):

| Lever | Peak need | Change vs Base | Change in month-36 ARR |
| --- | ---: | ---: | ---: |
| Defer every hire that starts after month 18 by six months | $11.76M | -0.97M | +0.00M |
| Hold engineering and product at the month-13 team (no later engineering hires) | $11.94M | -0.79M | +0.00M |
| Gate the sales, implementation, CS and partnership hires six months behind the evidence gates | $11.70M | -1.03M | +0.00M |
| Keep the paid student-acquisition budget at zero until measured LTV/CAC clears 3 | $12.61M | -0.12M | -0.01M |
| Cap free-tier AI at 4 requests a month (from 10) | $12.69M | -0.04M | +0.00M |
| Halve security / legal / insurance program lines (NOT recommended: shown to size what they cost) | $12.21M | -0.51M | +0.00M |
| Combined: defer late hires, hold engineering at the month-13 team, gate go-to-market hires | $10.32M | -2.41M | +0.00M |
| Combined plus: cut the month-13 engineering and product team from 10 to 8 FTE | $9.35M | -3.38M | +0.00M |

No one lever is large. The combined set takes roughly $2.41M to $3.38M off the $12.73M. The remaining cost is the core engineering, product, security and compliance team, which is the price of the audit's thesis ("every capability native and governed from day one"); a materially smaller number requires a smaller scope sequence than the audit's six increments, which is a product decision, not a finance one. The model's job is to show that the scope decision is the funding decision.
