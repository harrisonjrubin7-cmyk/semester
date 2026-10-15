# Founder and board finance reporting package

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | `Board_Pack` and `Summary` sheets of [`semester-financial-model.xlsx`](semester-financial-model.xlsx); extends [`../company/BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md`](../company/BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md) and [`../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md`](../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md) |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Cadence

| Report | Audience | When | Length | Owner |
| --- | --- | --- | --- | --- |
| Weekly cash note | Founder | Monday | Half a page: cash, receipts, payments due, collections, runway | Finance |
| Monthly founder flash | Founder and advisors | Business day 10 | Two pages (section 2) | CFO |
| Quarterly board pack | Board | 15 business days after quarter end, sent 5 days before the meeting | 10-12 pages (section 3) | CEO + CFO |
| Annual plan | Board | October, before the model year starts | Plan of record and capital plan | CEO + CFO |
| Event note | Board | Within 48 hours of a trigger | One page: what happened, exposure, action, decision needed | CEO |

## 2. Monthly founder flash (two pages)

| Block | Content | Source |
| --- | --- | --- |
| 1. Headline | Cash, runway, ARR, net new ARR, burn; one sentence on what changed | Ledger; `Board_Pack` |
| 2. Scorecard | Ten KPIs with plan, actual, variance and RAG (section 4) | Section 4 |
| 3. Bridge | ARR bridge: opening, new, expansion, contraction, churn, closing; signed-not-live backlog | Billing and CRM |
| 4. P&L versus plan | Revenue by stream, gross margin, operating expense by owner, EBITDA | Ledger and plan of record |
| 5. Cash | 13-week forecast; receivables aging; deferred revenue | Bank; billing |
| 6. AI cost | Cost per active user, per task and per tenant against caps; vendor reconciliation | AI gateway; invoices |
| 7. Implementation | Projects, go-live dates, hours versus plan, margin by project | Time records |
| 8. People | Headcount versus plan; gates met or pending; hires in flight | HR; gate checklist |
| 9. Risks and legal queue | Top three risks with triggers; items with counsel, accountant, tax adviser and broker and their status | Risk register; legal queue |
| 10. Decisions | Decisions requested, by whom, by when | Decision log |

## 3. Quarterly board pack

| Page | Content | Model source |
| --- | --- | --- |
| 1 | Executive summary: five lines, RAG scorecard, decisions requested | `Summary`, `Unit_Economics` |
| 2 | Strategy and milestones: progress on gates, pilots, conversions, design-partner status | Operating records |
| 3 | Financial summary: P&L versus plan of record for the quarter and year to date | `Board_Pack` plan and actual blocks |
| 4 | ARR and customer bridge; pipeline and weighted forecast; sales-cycle and conversion data | CRM; `Revenue` |
| 5 | Cash, runway, 13-week forecast, financing plan and triggers | `Financials`, `Approval_Matrix` |
| 6 | Unit economics: CAC, payback, LTV, gross and contribution margin, NRR, burn multiple versus guardrails | `Unit_Economics` |
| 7 | AI economics: cost per task and per user, margin impact, vendor and routing changes | `Costs` |
| 8 | Implementation portfolio and margin; customer health and renewal risk | Time records; health score |
| 9 | People and organization: headcount versus plan, hiring gates, key roles, compensation actions | `Headcount` |
| 10 | Risk register, trigger status, incidents, insurance, and the legal and tax queue | Risk register; document 06 |
| 11 | Controls: close timeliness, reconciliations, exceptions, audit and tax calendar status | Document 08 |
| 12 | Scenario table and what changed in assumptions since last pack, with dates and reasons | `Scenario_Results`; change log |
| Appendix | Assumption register changes, definitions, data lineage | `Assumptions` |

## 4. KPI scorecard and thresholds

RAG thresholds are proposals. Green is at or better than plan; amber is within the band; red is outside it and requires a written explanation and, for the starred rows, a trigger action from document 05.

| KPI | Definition | Amber | Red |
| --- | --- | --- | --- |
| Cash runway* | Cash ÷ trailing three-month burn | Below 12 months | Below 9 months (policy minimum 6) |
| ARR | Live recurring contracts | 5-15% below plan | More than 15% below plan |
| Net new ARR | Closing minus opening ARR | 10-25% below plan | More than 25% below plan |
| Signed-not-live backlog | Signed ACV not yet live | Go-live more than 30 days late on any contract | More than 90 days late |
| Subscription gross margin* | Per document 04 | More than 5 points below plan | Below the floor two months running |
| Implementation margin* | Per document 04 | Below 30% portfolio | Below 20% on any project |
| Burn versus plan | Net burn against plan of record | 5-10% over | More than 10% over |
| AI cost per active user* | AI cost ÷ average active users | 110-125% of plan | Above 125% two months running |
| DSO and aging* | Receivables ÷ invoicing × 90 | 75-90 days | Above 90 days or any receivable over 90 days |
| Pilot conversion | Pilots reaching midpoint that sign annual | Below plan by 10 points | Below plan by 20 points |
| Customer health | Health score per customer-success playbook | Any top-10 customer amber | Any top-10 customer red |
| Hiring versus plan | Heads against plan; gate status | Behind or ahead by 2 | Hire made without its gate |

## 5. What the first pack would have shown (Base plan, quarterly)

This is the plan the first actual quarters would be compared with. The workbook's `Board_Pack` sheet holds it live with actual and variance rows for Finance to fill from the closed books. Plan numbers are hypotheses.

$ thousands unless stated.

|  | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Q11 | Q12 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Revenue | 7 | 29 | 59 | 64 | 105 | 251 | 470 | 560 | 643 | 940 | 1,441 | 1,692 |
| Gross margin | -445% | -80% | -16% | -84% | -72% | -12% | 7% | 20% | 23% | 30% | 37% | 44% |
| EBITDA | (424) | (600) | (890) | (1,415) | (2,338) | (2,019) | (2,087) | (2,212) | (2,901) | (2,601) | (2,327) | (2,138) |
| Operating cash flow | (425) | (604) | (893) | (1,382) | (2,295) | (1,992) | (2,106) | (2,065) | (2,621) | (2,471) | (2,444) | (1,836) |
| Cash, end of quarter | 4,075 | 3,471 | 2,578 | 1,196 | 12,901 | 10,909 | 8,803 | 6,738 | 13,117 | 10,646 | 8,202 | 6,366 |
| ARR, end of quarter | 7 | 17 | 44 | 117 | 273 | 433 | 721 | 1,245 | 1,873 | 2,341 | 3,077 | 4,339 |
| Net new ARR | 7 | 11 | 26 | 73 | 156 | 160 | 289 | 524 | 628 | 468 | 736 | 1,262 |
| Pilots signed | 0.7 | 1.3 | 1.5 | 0.5 | 1.7 | 3.3 | 3.8 | 1.2 | 2.3 | 4.7 | 5.2 | 1.8 |
| New paying logos live | 0.0 | 0.1 | 0.4 | 0.8 | 1.0 | 1.3 | 3.1 | 5.4 | 4.4 | 3.8 | 7.2 | 12.1 |
| Paid subscribers | 101 | 198 | 254 | 510 | 799 | 1,079 | 1,230 | 2,021 | 2,446 | 2,863 | 3,071 | 4,371 |
| Headcount | 3 | 9 | 15 | 25 | 32 | 36 | 40 | 44 | 48 | 50 | 50 | 50 |
| Runway (months) | 28.8 | 17.2 | 8.7 | 2.6 | 16.9 | 16.4 | 12.5 | 9.8 | 15.0 | 12.9 | 10.1 | 10.4 |
| DSO (days) | 69 | 66 | 63 | 60 | 61 | 62 | 61 | 61 | 59 | 61 | 61 | 62 |

## 6. Reporting rules

1. **One source per number.** Actuals come from the closed ledger and bank; ARR from billing joined to the CRM; usage from the warehouse. Nothing is typed into a slide.
2. **Plan versus latest estimate.** Variance is against the plan of record; the latest estimate shows where the company now expects to land.
3. **Label every number** as actual, committed, forecast or scenario. Never present modeled values as actuals.
4. **Commentary explains, it does not excuse.** Every red item has a cause, an owner, an action and a date.
5. **Change log.** Every assumption changed since the last pack is listed with the date, the reason and the effect.
6. **Revenue language.** Until the accountant approves a policy, report billings, ARR and contracted ARR, and call recognized revenue only what the accountant has signed off.
7. **Legal and tax items** are listed with their status and owner, never summarized as conclusions.
8. **Confidentiality.** Packs go to named recipients through the data room; no financial detail goes into the repository beyond this planning model (no bank, payroll, tax or personal data).

## 7. Decision log format

| Field | Content |
| --- | --- |
| Decision | One sentence |
| Date and decider | Who decided, under which authority row of the matrix |
| Options considered | At least two, with the recommended one first |
| Criteria and evidence | Numbers from the model or the books, with the version used |
| Financial effect | Effect on peak funding need, runway and ARR |
| Review date | When it will be re-examined |

Product and platform decisions continue to be recorded as `docs/decisions/D-<pull request number>.md`. Finance decisions that change the plan of record are recorded the same way once they are taken by the founder or the board.

## 8. Questions a board or investor will ask, and where the answer is

| Question | Answer lives in |
| --- | --- |
| How much cash do you need and when? | Document 01 section 4; `Financials`; `Checks` funding warnings |
| What happens if the enterprise sales cycle is a quarter slower? | Document 07 (enterprise-delayed; sensitivity) |
| Why does a student not pay back their acquisition cost, and what do you do about it? | Document 04 section 3 |
| How exposed are you to AI vendor pricing? | Document 03 section 3; document 07 (high-AI-cost) |
| Who can spend what, and who checks? | Document 05; document 08 |
| Which numbers are facts? | README of this folder and the assumption register: four inputs are facts; the rest are labelled hypotheses or proposals |
| What would you cut first? | Document 05 gates: flexible hires, then paid acquisition, then discretionary programs |
| What legal, tax and accounting questions are open? | Document 06: 40 questions with owners |

## Cannot be completed from source code

Actual results, board composition, meeting dates and distribution lists require the company's records and governing body.
