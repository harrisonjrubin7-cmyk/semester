# Unit-economics dashboard

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | `Unit_Economics` sheet of [`semester-financial-model.xlsx`](semester-financial-model.xlsx); measures defined consistently with [`../COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md) |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Definitions, exactly as the model computes them

| Metric | Definition | Decision it informs |
| --- | --- | --- |
| Student CAC (paid) | Paid student acquisition spend ÷ new paid subscribers in the year | Whether paid spend can continue |
| Student CAC (fully loaded) | (Paid spend + student growth team cost + 50% of shared marketing leadership + 50% of brand spend) ÷ new paid subscribers | True cost of a paying student |
| Student LTV | Net monthly revenue per paid subscriber × unit gross margin × expected paid lifetime (monthly-plan churn, annual-plan renewals, three-year cap) | Price, plan mix, retention work |
| Student CAC payback | Fully loaded CAC ÷ (net monthly revenue × unit gross margin), in months | Channel viability (guardrail 12 months) |
| Institutional CAC | Institutional S&M cost (sales team, half of shared marketing and brand, programs, tools, commissions, channel fees) ÷ new paying logos live in the year, including pilot conversions | Sales efficiency |
| Institutional CAC payback | CAC ÷ (average ACV landed × subscription gross margin ÷ 12) | Capital efficiency (guardrail 24 months) |
| Gross margin | (Revenue − cost of revenue) ÷ revenue. Subscription gross margin removes implementation revenue and delivery cost | Pricing and cost-to-serve |
| Contribution margin | Revenue − cost of revenue − commissions − channel fees − paid student acquisition | Whether growth spend earns its keep |
| Churn | Student: monthly (monthly plan) and annual renewal. Institutional: annual logo churn at each anniversary | Product necessity |
| Net revenue retention (NRR) | (ARR at start of year + expansion − churn) ÷ ARR at start of year, Department and Institution cohorts | Account growth (guardrail 100%) |
| Gross revenue retention (GRR) | (ARR at start of year − churn) ÷ ARR at start of year | Product necessity (guardrail 85%) |
| Burn | Operating cash outflow in the period, before financing | Funding need |
| Burn multiple | Net burn ÷ net new ARR | Efficiency of growth spend (guardrail 2.5x) |
| Runway | Cash ÷ trailing three-month average burn | Financing timing (policy 6 months minimum) |
| Implementation margin | (Implementation revenue − delivery cost) ÷ implementation revenue | Scope and pricing of services (guardrail 30%) |
| AI cost per successful outcome | AI cost ÷ quality-qualified completed AI tasks. **Not computed here** because quality-qualified outcomes are not yet instrumented; the model reports cost per task and AI as a share of revenue | AI pricing and routing |

Cut-off rules: ARR counts only recurring contracts that are live (signed-not-live is reported separately as contracted ARR); pilot fees, implementation and marketplace revenue are not ARR; CAC uses same-year cost and same-year customers (a lag-adjusted view needs actual sales-cycle data); LTV carries no expansion credit for institutions and caps lifetime at seven years.

## 2. Base-case dashboard

**Growth and margin**

| Metric | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Revenue ($k) | 159 | 1,386 | 4,717 |
| ARR, end of year ($k) | 117 | 1,245 | 4,339 |
| ARR growth | n/a | 966% | 249% |
| Gross margin | -74% | 3% | 36% |
| Subscription gross margin | -215% | -30% | 36% |
| Implementation margin | 31% | 34% | 35% |
| Contribution margin ($k) | (155) | (153) | 1,263 |
| Contribution margin % | -97% | -11% | 27% |

**Student subscription**

| Metric | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| New paid subscribers | 562 | 1,950 | 3,675 |
| Paid CAC | $53 | $46 | $41 |
| Fully loaded CAC | $178 | $225 | $156 |
| Net revenue per paid subscriber per month | $5.20 | $5.14 | $5.09 |
| Unit gross margin | 75% | 75% | 75% |
| LTV | $76 | $75 | $74 |
| LTV : fully loaded CAC | 0.43x | 0.33x | 0.47x |
| CAC payback (months) | 45 | 58 | 41 |
| Cost of one free active user per month | $0.40 | $0.41 | $0.42 |

**Institutional**

| Metric | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Pilots signed | 4 | 10 | 14 |
| New paying logos live | 1.3 | 10.8 | 27.4 |
| Average ACV landed | $64,710 | $72,888 | $78,413 |
| Institutional CAC per new logo | $222,357 | $117,204 | $77,236 |
| CAC payback (months) | n/m | n/m | 32 |
| LTV : CAC | n/m | n/m | 2.6x |
| Net revenue retention | n/a | 106% | 108% |
| Gross revenue retention | n/a | 89% | 90% |
| Annual logo churn (ARR-weighted) | 11% | 10% | 10% |

**Cash efficiency**

| Metric | Year 1 | Year 2 | Year 3 |
| --- | ---: | ---: | ---: |
| Net burn ($k) | 3,304 | 8,458 | 9,372 |
| Net new ARR ($k) | 117 | 1,128 | 3,094 |
| Burn multiple | 28.3x | 7.5x | 3.0x |
| Cash, end of year ($k) | 1,196 | 6,738 | 6,366 |
| Runway at year end (months) | 2.6 | 9.8 | 10.4 |
| Revenue per average FTE ($k) | 15 | 38 | 96 |

**Guardrails (steady-state thresholds proposed for the founder; the repository sets no targets)**

| Guardrail | Direction | Threshold | Year 3 value | Status |
| --- | --- | ---: | ---: | --- |
| Subscription gross margin | >= | 70% | 36% | NOT MET |
| Implementation margin | >= | 30% | 35% | MET |
| Student LTV : CAC | >= | 3.0x | 0.5x | NOT MET |
| Student CAC payback | <= | 12 months | 41 months | NOT MET |
| Institutional CAC payback | <= | 24 months | 32 months | NOT MET |
| Institutional LTV : CAC | >= | 3.0x | 2.6x | NOT MET |
| Net revenue retention | >= | 100% | 108% | MET |
| Gross revenue retention | >= | 85% | 90% | MET |
| Burn multiple | <= | 2.5x | 3.0x | NOT MET |
| Runway at year end | >= | 12 months | 10 months | NOT MET |

## 3. What the dashboard says

1. **A paying student does not earn back a fully loaded acquisition cost.** Net revenue per paid subscriber is about $5.09 a month with a 75% unit gross margin and a 19-month expected life: LTV about $74. Loaded CAC is $156 in year 3, so LTV to CAC is 0.47x. To reach 3x at today's price and retention, loaded CAC would have to fall to about $25; to reach 3x at today's CAC, LTV would have to be about $469, six times today's, which price alone cannot do. The conclusion is not that students are unimportant: they are the adoption engine for institutions. It is that student growth must be mostly organic, ambassador-led and institution-sponsored, and paid acquisition must stay small until conversion rises.
2. **Institutional economics are close, not yet there.** Year-3 loaded CAC is $77,236 per new paying logo against an average landed ACV of $78,413; with a 36% subscription gross margin and 10% annual churn the LTV is about $200,235, or 2.6x CAC. Two levers close the gap: subscription gross margin (each 10 points adds roughly $54,889 of LTV per logo) and CAC. Retention is already healthy (NRR 108%, GRR 90%), so expansion and conversion matter more than churn.
3. **Gross margin is early-stage margin.** Year-3 subscription gross margin is 36%; the 70% guardrail is a steady-state threshold. The trigger that matters is direction: the rule in document 05 acts when margin falls more than 5 points below the plan of record for two consecutive months, and the model's margin rises from -30% in year 2 to 36% in year 3 as fixed cost spreads over more institutions.
4. **Burn multiple of 3.0x in year 3** is acceptable only because year 2 (7.5x) and year 1 are build years. A Series A investor will look at pilot conversion, ACV and sales-cycle evidence long before this ratio.

## 4. How to measure each metric from real data

| Metric | Source of truth | Rule | Owner | Frequency |
| --- | --- | --- | --- | --- |
| ARR, NRR, GRR, logo churn | Billing system joined to the CRM contract record | Only live, signed recurring contracts; renewals by order date | RevOps + Finance | Monthly |
| CAC (institutional) | CRM stages and the ledger | Fully loaded S&M; report same-year and sales-cycle-lagged views | Finance | Quarterly |
| CAC and conversion (student) | Product analytics and the processor | Cohort by first-use month; paid only after a payment event | Growth + Finance | Monthly |
| Gross margin | Ledger with cost-of-revenue accounts mapped as in document 03 | Accountant approves classification | Finance | Monthly |
| AI cost per task and per tenant | AI gateway usage records joined to vendor invoices | Reconcile monthly; flag variance above 5% | CTO + Finance | Weekly dashboard, monthly reconciliation |
| Implementation margin | Time records and SOW by project | Hours by project; contractor invoices tied to SOW | COO/CS + Finance | Monthly |
| Burn and runway | Bank and ledger | Trailing three-month average; 13-week cash forecast | Finance | Weekly cash, monthly pack |
| Support contact rate | Help desk | Contacts per 100 active users | Support lead | Monthly |

The existing [analytics and metrics dictionary](../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md) and [revenue operations dashboard spec](../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md) remain the product and RevOps references; the definitions here are the finance views and should be reconciled to them when the first real reading exists.

## Cannot be completed from source code

Every reading requires real customers, billing and ledger data. Until then these are modeled values, not measurements.
