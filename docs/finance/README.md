# Semester financial operating model

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Founder request, 2026-10-04 (CFO / SaaS unit-economics brief from the rebuild audit); existing commercial and company documents linked below |
| Claim ceiling | Semester may use this as an internal planning model and as the agenda for conversations with an accountant, tax adviser, counsel, a broker and investors. |
| Prohibited claims | Do not quote, publish or present any number here as a price, forecast, target, ARR, revenue, margin, runway or cash balance of the company. None is evidenced; see Evidence state. |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## What this is

A bottom-up, three-year, month-by-month model of what it costs to build, launch, sell, support and scale Semester, and what that could earn, with every input labelled and every professional question flagged. It covers the seven revenue streams in the rebuild audit (student subscription, institutional platform, implementation services, AI usage, marketplace, career/employer, alumni), the cost lines that make them work, the unit economics that decide whether to keep spending, and the governance, controls and reporting a board expects.

The model is a workbook with live formulas: [`semester-financial-model.xlsx`](semester-financial-model.xlsx). Choose one of nine scenarios in `Scenario_Control!D3` and every sheet recalculates (1 to 7 as analysed below; 8 and 9 hold the revenue motions behind the go/no-go gates, see [`10-GO-NO-GO-GATES.md`](10-GO-NO-GO-GATES.md)). The documents in this folder explain it and carry the parts that are not arithmetic.

| File | What it answers | Brief item |
| --- | --- | --- |
| [`semester-financial-model.xlsx`](semester-financial-model.xlsx) | The model: assumptions, revenue, costs, headcount, financials, unit economics, scenarios, board pack, approval matrix, integrity checks | 1, 5, 8 |
| [`01-MODEL-AND-CAPITAL-PLAN.md`](01-MODEL-AND-CAPITAL-PLAN.md) | How the model works, base-case results, capital required, validation, what is not modeled | 1 |
| [`02-PRICING-PACKAGING-ENTITLEMENTS.md`](02-PRICING-PACKAGING-ENTITLEMENTS.md) | Package ladder, entitlements, metering, discounts and floors, billing and collections design | 2, 3 |
| [`03-COST-MODEL.md`](03-COST-MODEL.md) | Every cost line, its driver, its per-unit cost and its cost-of-revenue or operating-expense home | 4 |
| [`04-UNIT-ECONOMICS.md`](04-UNIT-ECONOMICS.md) | Metric definitions, results, guardrails and what has to be true | 5 |
| [`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) | Budget structure, spending approval matrix, triggers, hiring gates | 6 |
| [`06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md`](06-CONTRACT-FINANCE-AND-ADVISOR-ROUTING.md) | What a customer contract must say financially, invoice flow, and every tax, accounting, marketplace and legal question routed to the right professional | 3, 7 |
| [`07-SCENARIOS-AND-SENSITIVITY.md`](07-SCENARIOS-AND-SENSITIVITY.md) | Six requested scenarios plus a gated plan, results, sensitivities and responses | 8 |
| [`08-FINANCE-CONTROLS-AND-OPERATIONS.md`](08-FINANCE-CONTROLS-AND-OPERATIONS.md) | Systems, processes, close calendar, control list, segregation of duties, 90-day setup plan | 9 |
| [`09-BOARD-REPORTING-PACKAGE.md`](09-BOARD-REPORTING-PACKAGE.md) | Founder flash, quarterly board pack, KPI definitions, decision log | 10 |
| [`10-GO-NO-GO-GATES.md`](10-GO-NO-GO-GATES.md) | The model with every revenue motion behind its go/no-go gate (scenarios 8 and 9), the gate inputs, and the guard that re-proves every scenario | 1, 8 |
| [`assumption-register.md`](assumption-register.md) | All inputs with value, basis, and who validates | 1 |

## What the model says (Base scenario)

| $ thousands | Year 1 (Nov-26 to Oct-27) | Year 2 | Year 3 | 3-year |
| --- | ---: | ---: | ---: | ---: |
| Revenue | 159 | 1,386 | 4,717 | 6,262 |
| Gross profit | (118) | 40 | 1,693 | 1,616 |
| Gross margin | -74% | 3% | 36% |  |
| EBITDA | (3,330) | (8,657) | (9,967) | (21,954) |
| Operating cash flow (net burn) | (3,304) | (8,458) | (9,372) | (21,134) |
| ARR, end of year | 117 | 1,245 | 4,339 |  |
| Headcount, end of year | 25 | 44 | 50 |  |
| Cash, end of year (with assumed rounds) | 1,196 | 6,738 | 6,366 |  |

Base is the assumptions as entered, with staged hiring: every role in the plan, flexible roles released on schedule. It is a hypothesis about what the audit's full-scope thesis costs, not a prediction of what will happen. All nine scenarios (8 and 9 hold the revenue motions behind `GO-NO-GO-DECISION.md`; Base books revenue that decision does not yet authorize, and scenario 8 shows what that costs, see [10](10-GO-NO-GO-GATES.md)):

| Scenario | Revenue Y3 | ARR end Y3 | Gross margin Y3 | EBITDA Y3 | Peak funding need | Lowest cash with assumed rounds | Months below 6-month cash policy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Conservative | 1,925 | 1,527 | -6% | (11,358) | 22,240 | 1,750 | 2 |
| Base | 4,717 | 4,339 | 36% | (9,967) | 21,134 | 1,196 | 3 |
| Aggressive | 7,153 | 6,894 | 46% | (9,494) | 20,504 | 1,158 | 3 |
| Enterprise-delayed | 2,750 | 2,535 | 15% | (10,897) | 21,404 | 1,754 | 1 |
| High-AI-cost | 4,717 | 4,339 | 27% | (10,375) | 21,672 | 1,180 | 3 |
| Incident-cost | 3,727 | 3,248 | 25% | (10,023) | 23,221 | 1,133 | 7 |
| Gated plan (CFO rec.) | 4,216 | 3,878 | 37% | (8,820) | 16,219 | 2,081 | 0 |
| Go/no-go gates, hiring unchanged (8) | 3,207 | 2,954 | 20% | (10,950) | 22,902 | 1,136 | 3 |
| Go/no-go gates + gated hiring (9) | 3,207 | 2,954 | 25% | (9,536) | 17,568 | 2,030 | 0 |

## What the CFO concludes

1. **The capital need is real and the pace of hiring decides it.** In Base the cumulative operating cash outflow peaks at **$21.1M** over 36 months before any financing. The three assumed rounds ($4.5M at month 1, $14.0M at month 13, $9.0M at month 26) cover it and leave $6.4M at month 36, but cash sits below the six-month minimum-cash policy for **3 months** before the second round lands. The gated plan (flexible roles released nine months later, behind milestones) cuts the peak to **$16.2M** and never breaches the policy. Delaying flexible hires by only three months saves $1.8M.
2. **Institutions, not students, carry the business.** By year 3 institutional platform fees and implementation are 80% of revenue; student subscriptions are 4%. A paid student subscriber earns about $5.09 a month net with a 75% unit gross margin, but fully loaded acquisition cost is $156-$225 against a lifetime value of about $74: LTV to CAC of 0.33x to 0.47x. Paid student acquisition is therefore capped at $30,000-$150,000 a year and treated as an adoption channel, not a profit engine, until conversion and price improve. The guardrail trigger (payback above 12 months for two quarters pauses paid spend) is already tripped in the model, so the budget is deliberately small.
3. **Margin is thin until scale, and the reasons are specific.** Year-3 subscription gross margin is 36% against a 70% steady-state guardrail. Fixed customer-success, hosting, integration and support costs are spread over only 38 live institutions. The levers, in order: per-student price and platform fee (a 10% price-realization change moves Year-3 ARR by $0.3M), AI allowance and routing, and customer-success leverage (the plan holds ARR per CSM above $1M before a new CSM is released).
4. **AI cost is the swing factor in margin, not in cash.** Inference is 6% of Year-3 revenue in Base. If usage doubles and vendor prices rise 50% with no price change, Year-3 subscription gross margin falls from 36% to 22% and the peak need rises by $0.5M. The design answer is metering: institutions get a capped included allowance (12 tasks per active student per month in the model) and buy credit packs above it; students get hard caps, never surprise bills; routing keeps 75% of tasks on the smallest model.
5. **Institutional volume and timing dominate everything else.** Forty percent more direct institutional logos adds $1.3M of Year-3 ARR and lowers the peak need by $1.2M. A three-month slip in enterprise signings costs $0.9M of Year-3 ARR and adds $0.8M to the peak need. Sales-cycle discipline and pilot-to-annual conversion (50% assumed) are the numbers to measure first.
6. **Implementation is profitable by design but needs real capacity.** The model delivers implementation at 35% margin, which meets the 30% guardrail only because scope is fixed and productized. Peak implied delivery capacity reaches about 14 full-time equivalents in Year 3 (partners and contractors, not payroll), and a 25% hours overrun adds $0.4M to the peak need.
7. **Cash timing is a financing risk even when revenue is fine.** Annual-in-advance billing builds $2.3M of deferred revenue by Year 3, but public institutions pay slowly: receivables are $1.5M and one month of extra collection delay adds $0.7M to the peak need. Contract terms (net 45, annual in advance, no non-appropriation surprises) are worth real money; see document 06.
8. **The model refuses to claim what the repository cannot support.** No company cash, revenue, customer, price or cost is evidenced in the repository. Only 4 inputs rest on repository documents: Plus at $7.99 a month or $59 a year and the 26-week pilot (D-134), and the pilot's size and implementation time (the pilot offer). Everything else is a labelled hypothesis or proposal, and 40 questions are routed to a qualified professional.

## Decisions the founder needs to make

| # | Decision | Why it matters | Where |
| ---: | --- | --- | --- |
| 1 | Accept, change or reject each **PROPOSED** price and package | No price book is approved; quotes cannot be issued without one | Assumptions sections 2-4; document 02 |
| 2 | Enter real opening cash and pre-seed funding | Cash is a placeholder of $0 | Assumptions A-002 |
| 3 | Choose between the staged plan (Base) and the gated plan | Sets the capital to raise and the milestones for each hire | Scenario 7; document 05 |
| 4 | Set founder compensation and the flexible-role list | Board decision; model uses placeholders ($90k, $130k) | Headcount sheet |
| 5 | Adopt, change or reject the proposed approval thresholds | The expense policy leaves every threshold blank | Document 05 |
| 6 | Appoint an accountant, tax adviser and counsel, and a broker | 40 questions wait on them (document 06) | Document 06, section 6 |
| 7 | Record guardrails as targets (or not) | The repository sets no targets; a target is the founder's recorded decision | Unit_Economics column G |
| 8 | Decide whether paid student acquisition continues past the first campus cohort | Loaded CAC exceeds LTV in every year | Document 04 |
| 9 | Choose the financing path and timing | Raise timing drives the months below the cash policy | Assumptions section 9 |
| 10 | Select finance systems and a close owner | Controls in document 08 need a system of record | Document 08 |

## How this relates to what is already in the repository

This work extends, and does not replace, the controlled documents below. Where they leave a value blank, this model proposes one for decision; where they state a rule, this model follows it.

| Existing document | What it says | What this adds |
| --- | --- | --- |
| [`../commercial/PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md) | No approved price book; quotes carry placeholders; unknown inputs stay placeholders | A proposed ladder, floors and discount authority, all marked PROPOSED |
| [`../company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md`](../company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md) | A blank 13-week and monthly template; never infer cash from the repository | A populated three-year model and a trigger register; the opening position is still blank |
| [`../company/EXPENSE-APPROVAL-POLICY.md`](../company/EXPENSE-APPROVAL-POLICY.md) | Approval matrix with intentionally blank dollar thresholds | Proposed thresholds and an approval matrix covering contracts, hiring, discounts, AI, refunds, payments |
| [`../company/FINANCIAL-CONTROLS.md`](../company/FINANCIAL-CONTROLS.md) | Minimum controls and monthly close checklist | A control list with owners and evidence, a close calendar, segregation of duties, systems |
| [`../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md) | Facts for the accountant; no recognition conclusion | Semester-specific questions for the accountant (document 06); the model recognizes revenue only as a labelled assumption |
| [`../commercial/ORDERING-AND-BILLING-OPERATIONS.md`](../commercial/ORDERING-AND-BILLING-OPERATIONS.md) | Order and billing operations | Quote-to-cash flow with financial controls and entitlement reconciliation |
| [`../company/TAX-AND-ACCOUNTING-READINESS-CHECKLIST.md`](../company/TAX-AND-ACCOUNTING-READINESS-CHECKLIST.md) | Readiness checklist | Tax and marketplace issue list routed by professional |
| [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md) | Plans, subscriptions, entitlements, dunning in the schema | Entitlement and metering mapping for the proposed SKUs |
| [`../COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md) | Measures defined; no target set | Financial measures defined here follow it: guardrails are proposals, not targets |

## Maintaining the model

- **Change an assumption:** edit the blue cell in `Assumptions` (or `Scenario_Control`, `Headcount`), then confirm `Checks` says ALL PASS.
- **Switch scenario:** `Scenario_Control!D3` takes 1-7.
- **Refresh the scenario snapshot** (`Scenario_Results` holds pasted values and will say so when stale): for each scenario 1-7, set `D3`, then copy these cells into row 4+scenario of `Scenario_Results`.

| Snapshot column | Source cell after choosing the scenario |
| --- | --- |
| Revenue Y1, Y2, Y3 | `Summary` row *Total revenue*, columns C, D, E |
| ARR end Y3 · Gross margin Y3 · Subscription GM Y3 | `Summary` rows *ARR*, *Gross margin*, *Subscription gross margin*, column E |
| EBITDA Y1, Y2, Y3 | `Summary` row *EBITDA*, columns C, D, E |
| Peak funding need | `Unit_Economics` row *Peak cumulative funding need*, column E |
| Lowest month-end cash · Months below policy | `Checks` column B of the two WARNING rows |
| Cash end Y3 · Headcount end Y3 | `Summary` rows *Cash, end of year* and *Headcount*, column E |
| Burn multiple Y3 · Institutional NRR Y3 | `Unit_Economics` rows *Burn multiple* and *Net revenue retention*, column E |

- **When actuals exist:** the closed books and bank records become the source of truth. Enter actuals in the `Board_Pack` actual rows, reforecast monthly, and keep dated versions of the workbook. Never infer cash, revenue or runway from repository activity.
- **Documents in this folder** quote numbers from the workbook as of the evidence date. Re-read the workbook when an assumption changes.

## Evidence state

**Repository evidence.** Product, commercial, company and control documents exist; Plus is priced at $7.99 a month or $59 a year (D-134) and every pilot runs 26 weeks. The billing code and schema for plans, subscriptions and entitlements exist and are not connected to a payment processor.

**Operational evidence.** No approved price book, budget, bank balance, executed contract, paying customer, measured cost, delivery baseline, accounting policy or financing term is evidenced.

**Missing test/proof.** Validate each hypothesis against first-cohort and pilot data; replace vendor list prices with contracted rates; obtain accountant, tax adviser, counsel and broker input; reconcile the model to the books once they exist.

## Cannot be completed from source code

Cash, accounts, prices, customers, costs, rounds, compensation, tax and accounting positions, insurance terms and approvals require controlled records and qualified review.
