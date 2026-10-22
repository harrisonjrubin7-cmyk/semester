# Finance and accounting operations

_Semester business operations · 2026-10-05 · Source: uploads/Show the finance and accounting operations section.pdf. **Accounting, tax, legal, insurance, privacy, security, accessibility and compliance content needs qualified professional review before use.**_

> Every customer promise connects to a financial owner, delivery owner, support process, security/privacy control, product capability and evidence trail.

## Questions the system must answer any time

- How much cash do we have, and how long is the runway?
- What is committed revenue, and what is actually collected?
- Which contracts and pilots are profitable; what does each customer cost to serve?
- What is the margin impact of AI and infrastructure?
- What can we afford to hire or build next?

## Console: /ops/finance

- Cash, runway, revenue dashboards and revenue forecast
- P&L, balance sheet, cash-flow views; budget vs actual
- Expense categories, vendor spend, payroll and contractor forecast
- Unit economics, customer profitability, AI cost and cloud cost dashboards
- Pricing calculator, discount approvals, finance risk alerts
- Collections/dunning, invoices, payment reconciliation
- Tax calendar, insurance tracker, board finance pack, forecast scenarios

## Data model (commercial and billing state only)

Accounting periods, accounts, journal-entry references, bank accounts, cash snapshots, budgets, forecast scenarios, revenue and expense plans, cost centers, customers, contracts, orders, subscriptions, invoices and lines, payments, credits/refunds, dunning cases, vendor contracts, purchase orders, expenses, payroll and contractor costs, cloud costs, AI costs, security/compliance costs, reporting snapshots.

**The product database tracks quotes, orders, subscriptions, invoices, entitlements, payment events, dunning and profitability. It is not the statutory ledger.** The ledger lives in accounting software designed with the accountant; /ops shows it embedded.

## Revenue streams

Paid pilots; implementation fees; annual platform licenses (per enrolled student); premium support; AI usage overages; Student Premium; department, enterprise and multi-campus plans; marketplace commissions; partner revenue; professional, training and migration services.

## Planning prices (assumptions, not published)

| Item | Planning price |
| --- | --- |
| Student workspace | Free at participating schools |
| Student Premium | $8.99 / month or $69 / year |
| Institution platform | $18 per enrolled student per year, $30,000 annual minimum |
| AI overage | $30 per 1,000 governed requests |
| Implementation | $35,000–$150,000 one-time (waived or credited for the first pilots) |
| Premium support | 15% of annual platform fee, $15,000 minimum |
| Marketplace / partner commission | 12%, optional and separate from core viability |

## Quote-to-cash

Quote → pricing exception check → approval if required → order form accepted → contract active → invoice → payment collected and reconciled → entitlement granted → revenue recognized/reviewed → renewal tracked → expansion, cancellation or dunning → profitability reviewed.

## Controls

| Action | Required control |
| --- | --- |
| Create draft quote | Revenue operations role |
| Approve discount | Deal desk by margin/ACV threshold (founder until a deal desk exists) |
| Send final quote | Revenue approval |
| Change commercial plan | Approval + entitlement impact review |
| Issue credit/refund | Finance approval + invoice/payment reference |
| Write off receivable | Finance + executive approval above threshold |
| Change billing account | Verified customer authority |
| Change bank/payment settings | Strong authentication + finance approval |
| Publish forecast | Finance owner review |
| Board/investor reporting | Founder/finance approval |
| Create vendor commitment | Budget owner approval |

## KPIs

Cash, burn, runway, committed ARR, recognized revenue, collected cash, MRR, ARR, pilot/implementation/expansion revenue, gross and contribution margin, AI and cloud cost per active user, support cost per customer, implementation cost per pilot, CAC, payback, LTV sensitivity, gross retention, NRR, ACV, sales cycle, invoice aging, collections rate, dunning recovery, budget variance, headcount cost, revenue per employee.

## Monthly close

Calendar opens → invoices reviewed → payments reconciled → vendor invoices recorded → payroll and contractor costs recorded → cloud and AI costs allocated → expenses categorized → deferred revenue reviewed → P&L → balance sheet → cash flow → forecast variance explained → runway updated → executive review → board/investor summary.

## Processes

| Process | Trigger | Owner | System of record | Approval | Output | KPI | Failure → escalation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Monthly close | Calendar day 5 | Founder + bookkeeper | Ledger | Founder | Close pack | Close on time | Late → founder same week |
| Invoice | Order form signed / milestone | Founder | /ops invoices | — | Invoice sent | DSO | Unpaid 30 days → dunning |
| Discount | Quote below list | Founder | /ops quotes | Founder | Approved quote | Avg discount | Below floor → reject |
| Refund/credit | Customer request | Founder | /ops payments | Finance | Credit note | Refund rate | Dispute → counsel |

## Status and gaps

- Have: docs/run/Finance Model.html, docs/grow/GTM Plan.html, ui_kits/ops finance console.
- Gaps (P0): bank account, ledger and chart of accounts with the accountant, tax registrations, invoice the pilot. (P1): AI cost allocation, customer profitability, 36-month model.
