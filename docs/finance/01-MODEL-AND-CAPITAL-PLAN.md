# Model and capital plan

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | [`semester-financial-model.xlsx`](semester-financial-model.xlsx) |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Architecture of the model

```
Scenario_Control ─┐ (18 drivers × 7 scenarios, one selector)
Assumptions ──────┤  (inputs by section; basis label on every one; derived values)
Headcount ────────┼─► Costs ─────► Financials ─► Summary ─► Unit_Economics
Revenue ──────────┘     ▲             │            │            Board_Pack
                        └─ drivers ◄──┘            └──────────► Checks
```

| Sheet | Role | Rows that matter |
| --- | --- | --- |
| Scenario_Control | Selector (D3) and the 18 drivers; column K is the active scenario | S-01 to S-18 |
| Assumptions | Every input: value, year values, basis, note; seasonality; derived values | A-001 onward |
| Revenue | Funnel, cohorts, ARR, billings, deferred revenue, collections, receivables, seven streams | 36 monthly columns |
| Costs | Active-user drivers, 12 cost-of-revenue lines, 16 operating-expense lines | 36 monthly columns |
| Headcount | 44 role lines with start month, flex flag, base pay; people cost and counts by function | Role table plus summaries |
| Financials | Income statement, direct cash flow, funding, runway, indirect cross-check | Monthly |
| Summary / Unit_Economics / Board_Pack | Annual and quarterly views, guardrails, board pack with actuals block | Read-only formulas |
| Approval_Matrix / Checks | Proposed authorities and triggers; 21 checks (19 integrity, 2 funding warnings) | Static text / live checks |

Formulas, not pasted values, run everything except `Scenario_Results`. Time runs November to October so each model year contains one full academic start (August-September). Month 1 is November 2026; the fiscal year is an accountant's decision.

## 2. How each revenue stream is built

### Student subscription (direct to student)

Funnel: paid acquisition spend ÷ cost per registration, plus organic registrations (a multiple of the paid ones), shaped by an academic-calendar seasonality index; 50% activate; 6.0%-7.0% of activated students convert to Plus. 65% choose the annual plan. Plus is priced at $7.99 a month or $59 a year (**fact, D-134**), less a blended promotional discount of 8% and with a refund allowance of 3%. Monthly subscribers churn at 8% a month; annual subscribers renew at 55% then 70%. Billing, ratable revenue, deferred revenue and fees are all computed from the same subscriber schedule. Web checkout carries a card fee (2.9% + $0.30); app-store billings (35% of the total) carry a commission and arrive a month later. An optional AI add-on ($4.99 a month) attaches to 3%-8% of subscribers.

### Institutional platform: pilots, Department and Institution licences

Three tiers. A **pilot** is a 26-week design-partner engagement (fee $12,000, about 125 active students, go-live 2 months after signing, 50% convert to an annual agreement; fee is non-recurring and excluded from ARR). A **Department** licence lands at $50,000 ($35,000 platform + 1,500 students × $10). An **Institution** licence lands at $145,000 ($90,000 + 5,000 × $11). Each month's signings go live after a lag (4 and 6 months), land new ARR, are billed annually in advance, and at each anniversary some ARR churns and the survivors expand. One cohort schedule produces ARR, billings, revenue, deferred revenue and logo counts, so they cannot disagree.

```
ARR(t) = ARR(t-1) + new + expansion(1st & 2nd anniversary) − churn(1st & 2nd anniversary)
billings(t) = new(t) + new(t-12)·m1 + new(t-24)·m2        m1 = (1−churn)(1+e1)    m2 = m1·(1−churn)(1+e2)
revenue(t) = ARR(t) ÷ 12                                  deferred(t) = deferred(t-1) + billings − revenue
```

Signed-not-live ACV is tracked as backlog and added to ARR to give contracted ARR (CARR). Seasonality of signings is concentrated March-June for fall go-live.

### Implementation services

A fixed-scope fee per signing ($15,000 pilot, $40,000 Department, $120,000 Institution), billed half at signing and half at go-live, recognized evenly across the implementation window in this model **[REQUIRES QUALIFIED REVIEW]**. Delivery cost is hours (120, 300, 850) × $89 per delivered hour ($62 loaded per available hour ÷ 70% utilization). Pilot conversions carry no second implementation fee (the pilot credit).

### AI usage

Two revenue lines: institution AI credit packs (10%-40% of active institutional students at $2.50 a year) and the student add-on above. Cost is built bottom-up in document 03.

### Marketplace, career/employer, alumni

**Marketplace** (launch month 19, gated on counsel and tax sign-off): GMV = active users × participation × orders × average order $45; Semester books the 15% take rate net and bears processing, disputes and moderation. **Employer partners** (launch month 13): $3,600 a year, 30% annual churn, the same cohort mechanics. **Alumni** module (launch month 13): institution-sponsored only, $15,000 a year for 10%-25% of Institution customers. No sale of student or alumni personal data is modeled or proposed.

### From revenue to cash

Institutional invoices (annual licences, pilots, implementation, employers, alumni, AI credits) are collected on a profile of 5% in month 0, 25% in month 1, 40% in month 2, 25% in month 3, 5% in month 4 with a 1% allowance. Student card receipts arrive immediately; app-store proceeds a month later. Cash is built directly (receipts − payments) and cross-checked against EBITDA + change in deferred revenue − change in receivables; the difference is a live check and is zero. Vendors are assumed paid in the month incurred (no payables float, which is conservative).

## 3. Base-case results

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

Revenue by stream, $ thousands:

| Stream | Year 1 | Year 2 | Year 3 | 3-year |
| --- | ---: | ---: | ---: | ---: |
| 1. Student subscription | 14 | 72 | 184 | 270 |
| 2. Institutional platform (incl. pilots) | 53 | 462 | 1,972 | 2,487 |
| 3. Implementation services | 91 | 712 | 1,801 | 2,605 |
| 4. AI usage | 1 | 12 | 74 | 86 |
| 5. Marketplace (net) | - | 10 | 122 | 132 |
| 6. Career / employer | - | 117 | 540 | 657 |
| 7. Alumni | - | 2 | 24 | 26 |
| **Total revenue** | 159 | 1,386 | 4,717 | 6,262 |

Position at year end, $ thousands: ARR 117 / 1,245 / 4,339; contracted ARR 127 / 1,546 / 5,179; deferred revenue 88 / 741 / 2,339; receivables 61 / 512 / 1,511.

## 4. Capital plan

Cumulative operating cash flow before any financing bottoms out at **$21.1M**. The model tests funding adequacy with three placeholder rounds. Raise timing matters more than raise size: cash falls to $1.2M in month 12 (about 2.6 months of burn) before the second round and to $6.0M in month 25 before the third.

| Round (placeholder) | Month | Amount | Purpose |
| --- | ---: | ---: | --- |
| Pre-seed / seed | 1 | $4,500,000 | Core platform, first design partners, first pilots |
| Series A | 13 | $14,000,000 | Scale go-to-market and academic-core build once pilots convert |
| Series B / extension | 26 | $9,000,000 | Enterprise scale and marketplace; or a bridge if conversion is slow |

**Reading it.** The plan is financeable only if the second round closes while pilots are still converting, with roughly 6 months of cash in hand, not when cash is already short. Base breaches that policy for 3 months. The gated plan (document 05) releases flexible hires only when milestones are met and needs $16.2M instead of $21.1M. Neither plan is a promise of any financing; terms, instruments and dilution are for the board and counsel **[REQUIRES QUALIFIED REVIEW]**.

Quarterly cash and runway, Base:

| $ thousands | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Q11 | Q12 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cash, end of quarter | 4,075 | 3,471 | 2,578 | 1,196 | 12,901 | 10,909 | 8,803 | 6,738 | 13,117 | 10,646 | 8,202 | 6,366 |
| Operating cash flow | (425) | (604) | (893) | (1,382) | (2,295) | (1,992) | (2,106) | (2,065) | (2,621) | (2,471) | (2,444) | (1,836) |
| Runway (months) | 28.8 | 17.2 | 8.7 | 2.6 | 16.9 | 16.4 | 12.5 | 9.8 | 15.0 | 12.9 | 10.1 | 10.4 |

## 5. Validation performed

The repository's standard is that a guard that has never failed is not known to be a guard. So:

1. **Independent re-implementation.** Department, Institution and pilot ARR, revenue and billings, and the student subscriber and revenue schedule, were recomputed from the raw inputs in a separate cohort-by-cohort program (a different algorithm from the workbook's roll-forward). All ten compared series matched the workbook to the cent.
2. **Cash reconciliation.** Direct-method cash equals the indirect method in all 36 months in all seven scenarios (live check, tolerance $1).
3. **Fault injection.** A $5,000 error in one month's cash payments turned the cash-reconciliation check red; removing Department billings turned the deferred-revenue check red; setting the collection profile to 110% turned that check red. Each was restored.
4. **Snapshot integrity.** `Scenario_Results` carries a check that the pasted row for the active scenario equals the live model.
5. **Zero formula errors** across 11,705 formulas after full recalculation.

This proves the arithmetic does what the design says. It does not prove any assumption is true.

## 6. What the model does not do

| Not modeled | Why it matters | Who decides |
| --- | --- | --- |
| Income tax, net operating losses, credits for research and experimentation | Cash taxes and incentives change runway; losses may carry forward | Tax adviser |
| Capitalization of internal-use software and of sales commissions | Moves cost between periods; EBITDA here expenses both | Accountant |
| Stock-based compensation, 409A valuations, option pool | Non-cash expense; dilution | Accountant, counsel |
| Sales, use and VAT/GST on subscriptions and marketplace sales | Collected and remitted, not revenue, but affects price and compliance | Tax adviser |
| Payables float, prepaid expenses, accrued payroll timing | Working-capital timing (model assumes pay-as-incurred) | Accountant |
| Interest income on cash, debt, venture debt covenants | Financing cost and income | Founder, counsel |
| Grants, cloud and AI-vendor credits | Upside not assumed | Founder |
| Foreign currency and international entities | US-first is assumed | Tax adviser |
| Multi-year prepayments and multi-year price escalators | Cash and ARR quality | Founder, accountant |
| Discounts below list in Base | Only the scenario ACV multiplier moves price realization | Founder |

## Cannot be completed from source code

Prices, customers, costs, rounds, compensation, tax and accounting treatment and every approval need controlled records and qualified review.
