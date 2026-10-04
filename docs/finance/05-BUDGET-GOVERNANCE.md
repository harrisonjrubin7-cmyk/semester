# Budget governance and spending approval matrix

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Extends [`../company/EXPENSE-APPROVAL-POLICY.md`](../company/EXPENSE-APPROVAL-POLICY.md) and [`../company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md`](../company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md); `Approval_Matrix` sheet of [`semester-financial-model.xlsx`](semester-financial-model.xlsx) |
| Effect | **Nothing here is in force until the founder and the governing body adopt it.** The expense policy leaves every dollar threshold blank on purpose; these are proposals to fill the blanks. |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Principles

1. **No one approves their own spend or reimbursement.** Founder expenses are approved by a board designate.
2. **No splitting.** Related purchases are aggregated for the threshold test.
3. **A budget line has one named owner** who is accountable for the plan, the variance and the explanation.
4. **Money moves only through the approval path.** Preparer, approver and releaser are three people wherever the company is large enough, and compensating controls apply where it is not (document 08).
5. **Commitments are decisions about the future.** A contract over twelve months, an auto-renewal or a hire is approved at its full life cost, not its monthly cost.
6. **Reserve before spending.** A CFO-controlled contingency (5% of non-people operating spend in the model) is the only source for unplanned items.
7. **Evidence before release.** Flexible hires are released only when their gate is met.

## 2. Budget structure and owners (Base, $ thousands)

Owners are roles; the repository names no one but the founder. Every line in the model belongs to exactly one owner.

| Owner (role) | Lines | Year 1 | Year 2 | Year 3 |
| --- | --- | ---: | ---: | ---: |
| CTO | R&D people; AI inference; hosting; storage; bandwidth; search; notifications; integrations | 1,657 | 4,620 | 6,485 |
| Head of Sales / CRO | Sales people; commissions; sales tools; channel fees; institutional demand generation and brand | 277 | 1,238 | 2,128 |
| Head of Marketing and Growth | Student growth team; shared marketing leadership; partnerships; paid student acquisition | 110 | 666 | 869 |
| COO / customer-success lead | Customer success, support and trust people; support; implementation delivery; marketplace operations | 129 | 929 | 2,002 |
| Security and privacy lead | Security, compliance and accessibility audits | 85 | 230 | 320 |
| Legal (with outside counsel) | Retainer, contracts, financing costs | 255 | 620 | 590 |
| CFO / Head of Finance | G&A people; accounting; insurance; payment and billing fees; tools, workspace, T&E, onboarding, recruiting, board; bad debt; contingency | 976 | 1,739 | 2,289 |
| **Total** | Cost of revenue plus operating expenses (excludes incident costs) | 3,489 | 10,044 | 14,684 |

The totals tie to the model's cost of revenue plus operating expenses, so no cost is unowned.

## 3. Planning cycle

| Cycle | When | Output | Approver |
| --- | --- | --- | --- |
| Annual plan | September-October, before the model year starts in November | Plan of record: budget by owner, headcount plan, capital plan, guardrails | Board |
| Quarterly reforecast | Within 15 business days of quarter end | Latest estimate; assumptions changed, with dates and reasons | CEO + CFO; Board informed |
| Monthly forecast | Business day 10 after close | Updated 12-month view; variance commentary | CFO |
| 13-week cash forecast | Every week | Receipts by invoice, payroll, vendors, taxes, insurance, financing | CFO |
| Gate review | When a gate evidence pack is submitted | Release or hold of flexible roles | Per gate table below |

Two versions of the budget exist at any time: the **plan of record** (board-approved, never edited) and the **latest estimate** (reforecast monthly). Variance is measured against the plan of record; decisions are made against the latest estimate.

## 4. Spending approval matrix (proposed)

| Decision | Initiator | Approver(s) | Required reviews | Threshold or trigger | Record kept |
| --- | --- | --- | --- | --- | --- |
| Budgeted spend, small | Budget owner | Budget owner | None unless it touches data or access (then security/privacy) | Up to $2,500 per item; no splitting | Card/expense record with receipt and budget line |
| Budgeted spend, medium | Budget owner | Budget owner + Finance lead | Security/privacy review if vendor touches student, institutional or payment data | $2,500 to $15,000 | PO or approved invoice in the AP system |
| Budgeted spend, large | Budget owner | CEO + CFO/Finance lead | Vendor risk assessment; counsel for non-standard terms | $15,000 to $75,000 | Signed approval, vendor register entry, contract on file |
| Major commitment | CEO | CEO + CFO + Board (written consent) | Counsel; security; insurance broker where relevant | Above $75,000, or any commitment over 12 months with total above $50,000, or above 3% of cash | Board consent and contract register entry |
| Unbudgeted spend or reallocation | Budget owner | Within one function and up to 5% of its budget: Finance. Across functions or above 5%: CEO + CFO. Above 10% of annual opex: Board | CFO checks runway impact | Any amount not in the approved budget | Reforecast entry with reason |
| Hire inside approved plan | Hiring manager | CEO; Finance confirms the budget line | Compensation band check; recruiter fee approved separately | Role and start month in the headcount plan | Offer approval record |
| Hire outside plan or release of a flexible role | CEO | CEO + CFO; Board if it adds more than $250,000 of annual cost | Gate evidence for flexible roles (see gating milestones) | Any role not in the plan, or a flexible role before its gate is met | Gate checklist signed by CEO and CFO |
| Compensation and equity grants | CEO | Board | Counsel; independent valuation where required | Every grant | Board minutes; cap table update |
| Contractors and statements of work | Budget owner | CFO + Legal | Worker-classification review; IP assignment | SOW above $25,000 or longer than 6 months | SOW, W-9, IP assignment on file |
| Vendor contracts and renewals | Budget owner | Per spend tiers above | Security and privacy for data vendors; counsel for auto-renewal, liability and data terms | Any auto-renewing or multi-year term | Vendor register with renewal date |
| List price, package and entitlement changes | CEO / Product | CEO + CFO | Counsel for consumer terms, renewals and cancellation; tax adviser where it changes taxability | Any change to the price book or free-tier limits | Dated pricing decision; billing config and public page reconciled |
| Discounts and free pilots | Account executive | Up to 10%: AE. Up to 20%: Head of Sales (above the margin floor). Up to 30%: CEO + CFO. Above 30%, below the margin floor, or multi-year price lock: CEO + CFO + Board | Margin floor check by Finance | Discount off the approved price book | Quote with approval trail in the CRM |
| Non-standard contract terms | Account executive | Counsel + CFO + CEO (+ security lead where data or uptime is involved) | Revenue-recognition note from the accountant when terms change payment, refund or acceptance | Termination for convenience, non-appropriation, uncapped or super-cap liability, most-favored pricing, source-code escrow, SLA above 99.9%, data residency, payment terms beyond net 60, acceptance clauses | Deviation log attached to the contract |
| Customer refunds and credits, individual students | Support agent | Agent up to $25; support lead up to $100; Finance up to $1,000; CFO above | App-store refunds follow the store's rules | Per case | Refund register |
| Customer credits and refunds, institutions | Customer success | CFO up to $10,000; CEO + CFO above | Counsel if the contract's termination or SLA terms are in play | Per case; SLA credits calculated by Finance | Credit memo and contract reference |
| Bad-debt write-offs | Finance | CFO up to $5,000; CEO + CFO above; Board informed above $25,000 | Collections history; customer status | Receivable over 120 days or customer insolvency | Write-off memo |
| Payment release | AP preparer | Preparer is not the approver or the releaser. Wires above $25,000 need CEO + CFO | Out-of-band callback for any new payee or bank-detail change | Every payment above $5,000; every payee change | Bank and AP audit trail |
| AI cost controls | CTO | CTO + CFO; add CISO and counsel for a new provider | Model-eval results; data-processing terms | Provider or routing change that moves AI cost per active user by more than 10%, or any new AI vendor | AI system inventory and cost register |
| Per-tenant AI budget changes | Customer success | CFO | Margin check | Any institution above its monthly AI cap or requesting a higher cap | Tenant entitlement record |
| Marketplace take rate, payout rules and launch gate | Partnerships | CEO + CFO + Legal; launch also needs tax adviser sign-off | Consumer-protection, tax, refund and dispute operations review | Any change to take rate or payout terms; launch of a new category | Gate record and counsel memo |
| Public claims about price, savings or ROI | Marketing / Sales | CEO + Legal | Evidence in the public claims register | Every new claim | Claims register entry |
| Equity, debt, SAFE or convertible financing | CEO | Board | Counsel | Every instrument | Board minutes; signed documents |
| Insurance changes | CFO | CEO + CFO | Broker | Any new policy, limit change or cancellation | Policy file; certificate log |
| Revenue-recognition policy, tax elections and filings | Finance | CFO, on the written advice of the qualified accountant or tax adviser | Accountant or tax adviser | Every policy, election and filing | Memo and filing receipt |
| Incident emergency spend | Incident commander | Incident commander up to $50,000 (CEO and CFO told within 24 hours); CEO + CFO above | Counsel directs forensics where privilege matters | Per incident | Incident record with cost log |
| Budget reforecast | Finance | CFO monthly; Board when full-year opex moves more than 10% | None | Monthly close | Versioned forecast |

## 5. Cash and performance triggers (proposed)

| Trigger | Threshold | Action | Authority |
| --- | --- | --- | --- |
| Runway below 12 months at normalized burn | Cash ÷ trailing 3-month burn < 12 | Start financing preparation; board told at the next meeting | CEO + CFO |
| Runway below 9 months | < 9 | Freeze unplanned hires and discretionary spend; close all flexible-role gates | CEO + CFO; Board informed |
| Runway below 6 months (minimum-cash policy) | < 6 | CFO delivers a cost-reduction plan to the board within 10 business days; vendor and scope cuts | Board |
| Runway below 3 months | < 3 | Activate the continuity plan; board decides among bridge, sale, or orderly wind-down | Board |
| Monthly spend variance | More than 10% or $25,000 over budget on a line | Written explanation within 5 business days; reforecast | Budget owner + CFO |
| AI cost per active user | More than 125% of plan for 2 consecutive months | Routing and caching review; consider tenant caps | CTO + CFO |
| Student paid-acquisition payback | CAC payback above 12 months (loaded) for 2 consecutive quarters | Pause paid student acquisition spend until fixed | CEO + CFO |
| Subscription gross margin | More than 5 points below the plan of record for 2 consecutive months (and below 70% once the plan reaches it) | Pricing and cost review; no new discounts | CFO |
| Implementation margin | Below 20% on any project, or portfolio below 30% | Re-scope, change order, or stop-work review | COO/CS lead + CFO |
| Collections | DSO above 75 days, or any receivable older than 90 days | Escalate to executive sponsor; hold new work if contract allows | CFO + CS lead |
| Revenue leakage | Any active entitlement without a paid order, or usage above contract cap | Reconcile within 5 business days; correct entitlement or bill | Finance + RevOps |

These tie to the model: the minimum-cash policy is 6 months, and the Base scenario breaches it for 3 months before the second round, so the first three triggers would already have fired in the plan. That is the argument for the gated plan below.

## 6. Gating milestones for flexible hires (the gated plan)

| Roles released | Gate | Release authority |
| --- | --- | --- |
| Mobile and offline engineers; accessibility lead; QA | At least 1 signed design-partner agreement and the web core passing the critical-journey tests | CEO + CTO |
| Integration engineers; solutions engineer #1 | At least 2 pilots live and one named SIS/LMS integration scoped with a customer | CEO + CRO |
| Privacy and compliance lead; security/GRC engineer | First institutional contract in legal review that requires a DPA or security questionnaire | CEO + CFO |
| Wave 2 engineers; learning scientist | Seed-round close plus 3 pilots with measured activation | CEO + CTO + CFO |
| AEs #2 to #4; SDRs; second solutions engineer | Pipeline coverage of at least 3x next-two-quarter new-ACV plan, and the first AE ramped to quota | CRO + CFO |
| Customer success managers #2 and #3 | ARR per CSM above $1.0M or implementation backlog above 4 projects per implementer | COO/CS lead + CFO |
| Marketplace and employer sales; community manager | Launch gates for those products signed off by counsel and the tax adviser | CEO + Legal |
| Engineering manager; wave 3 engineers; controller | Series A closed | Board |

Applied to the model (scenario 7: flexible roles nine months later, with 10% less volume to reflect lost capacity): peak funding need falls from $21.1M to **$16.2M**, lowest cash with the assumed rounds rises from $1.2M to $2.1M, months below the cash policy fall from 3 to 0, and Year-3 revenue is $4.2M instead of $4.7M. The gate is the cheapest insurance in the plan.

## 7. Contingency, transfers and variances

- **Contingency.** 5% of non-people operating spend, held by the CFO. Drawing on it needs the CFO and the budget owner and is logged with a reason.
- **Transfers.** Within a function up to 5%: budget owner and Finance. Across functions or above 5%: CEO and CFO. Above 10% of annual operating expense: board.
- **Variance.** Any line more than 10% or $25,000 over budget gets a written explanation within five business days and a reforecast.
- **Year-end.** Unspent budget does not roll over automatically; owners request carry-forward with a reason.

## 8. Conflicts, related parties and exceptions

Related-party transactions (including founder-owned vendors, family employment or loans) are disclosed to the board before commitment and reviewed by an independent approver. Exceptions follow the repository's [policy exception process](../company/POLICY-EXCEPTION-PROCESS.md): reason, amount, approver, risk, duration and corrective action. An exception cannot override law, contract, sanctions or anti-bribery duties, or a required independent review.

## 9. Revisiting thresholds

Thresholds are sized for a seed-stage company with a few people. They are revisited at each financing: at Series A roughly double the amounts, add a board audit and finance committee, and require independent review of payment release above the new threshold.

## Cannot be completed from source code

Budget owners, thresholds, approvers, bank mandates and board composition require the founder's decision and counsel and accountant review.
