# Financial controls and finance operations

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Extends [`../company/FINANCIAL-CONTROLS.md`](../company/FINANCIAL-CONTROLS.md); ties to documents 02, 05 and 06 |
| Effect | **No control here operates today.** The existing controls document is explicit that none is established until approved and evidenced; this document specifies the operating design to build and test. |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Finance function by stage

| Stage | Who does the work | Trigger to step up |
| --- | --- | --- |
| Now to first revenue | Founder as approver; outsourced bookkeeper; accountant and tax adviser on retainer; payroll provider | First executed order |
| First pilots to seed | Head of Finance and RevOps (month 10 in the plan); bookkeeper; accountant | Second paying customer or first raise |
| Series A | Controller (month 24 in the plan) and a billing and collections analyst; first financial statement review | Revenue above about $1M a year or a customer or lender asking for reviewed statements |
| Scale | Finance and strategy lead, FP&A analyst, revenue accountant, audit committee | First audit (planned year 3) |

## 2. Systems of record

One system owns each fact. A spreadsheet is a view, never the source (the pricing work already says no uncontrolled spreadsheets as systems of record). Examples are categories of tool, not endorsements; selection is procurement's job and each needs the security and vendor review the company policy requires.

| Fact | System of record | Feeds | Needed by |
| --- | --- | --- | --- |
| Customer, opportunity, contract, quote | CRM | Billing, forecast, board pack | Before the first quote |
| Subscription, invoice, payment, entitlement | Billing system connected to the payment processor and to the commercial core | Ledger, entitlements, collections | Before the first invoice |
| General ledger, accounts payable, bank reconciliation | Cloud accounting system | Statements, tax, audit | Before the first transaction |
| Spend and corporate cards | Expense and card platform with limits and receipts | Ledger | Before the first card |
| Payroll, benefits, contractors | Payroll provider or PEO | Ledger, headcount plan | Before the first hire |
| Equity | Cap-table system | Board pack, 409A | Before the first grant |
| Plan, forecast, scenarios | The financial model, under version control; later a planning tool | Board pack | Now |
| Product usage, AI cost, tenant metering | Warehouse and AI-gateway logs | Unit economics, billing true-up | First pilot |
| Contracts and legal paper | Contract register in the document system | Revenue schedule, renewals | Before the first signature |
| Vendors and security reviews | Vendor register | Procurement, renewals, security | Now |

## 3. Core processes

### Procure-to-pay

| Step | Control |
| --- | --- |
| Need and budget line | Request names the budget line and owner; spend is checked against the approval matrix before commitment |
| Vendor onboarding | Vendor record with W-9, bank verification by call-back, security and privacy review where data is touched, contract term and renewal date |
| Order | PO or signed order; no commitments by card or email above the small-spend threshold |
| Receipt | Receiver confirms goods or services; for contractors, time or deliverable approved by the owner |
| Invoice | Three-way match (order, receipt, invoice); duplicates detected; payee and bank details unchanged unless verified |
| Payment | Preparer, approver and releaser separate; dual authorization above $5,000; wires above $25,000 need CEO and CFO |
| Record | Posted to the right account and period; month-end accrual for unbilled receipts |

### Record-to-report: month-end close calendar

| Business day | Task | Owner | Evidence |
| ---: | --- | --- | --- |
| 1 | Cut-off: bank and processor activity final; payroll posted; accruals identified | Finance | Cut-off checklist |
| 2 | Bank, card and processor reconciliations | Bookkeeper | Signed reconciliations |
| 3 | Receivables and cash application; collections review; refunds and credits posted | Finance | Aging report; refund register |
| 4 | Revenue schedule updated from contracts; deferred revenue roll-forward; entitlement-to-billing reconciliation | Finance + RevOps | Roll-forward; leakage report |
| 5 | Payables, accruals, prepaid and AI/vendor cost reconciliation to invoices | Finance + CTO | AI cost reconciliation |
| 6 | Payroll and contractor review; headcount to plan | Finance + HR | Payroll register |
| 7 | Review of unusual items and manual journals by a second person | Reviewer | Journal approvals |
| 8 | Close; statements prepared; budget-to-actual and variance commentary | Finance | Statements |
| 9 | Founder review; reforecast; 13-week cash update | CEO + CFO | Forecast version |
| 10 | Monthly pack issued; open questions to accountant, counsel or tax adviser logged | CFO | Pack and issue log |

### Treasury

Operating cash in insured, accessible accounts; a documented limit on the balance in any one institution; a short list of permitted instruments approved by the board; weekly cash review; two bank-account signers with dual authorization above the payment threshold; no personal accounts for company money. Where to hold balances above deposit-insurance limits is a question for the accountant and banker (Q-35).

### Payroll and contractors

Approved offer and band before payroll set-up; classification review for every contractor (Q-18); payroll register reviewed by someone who does not run payroll; changes to pay or bank details verified out-of-band; equity grants only on board approval.

### Tax and compliance calendar

One calendar owned by the CFO and maintained with the tax adviser: payroll tax deposits and filings, sales-tax registration and returns once nexus is established (Q-16), information returns for contractors and, if relevant, marketplace payees (Q-19), annual entity filings and franchise taxes (Q-21), insurance renewals, vendor and contract renewals, and board and equity events. Each item has an owner, a due date and a proof-of-filing record.

### Collections

Weekly aging review; cadence at day 30, 45, 60, 75 and 90 (document 02); executive sponsor escalation at day 60; payment-plan or credit decisions per the approval matrix; write-offs only by memo. Target: DSO under 75 days and no receivable older than 90 days without an escalation record.

### AI and usage cost control

The AI gateway tags every request with tenant, feature and model. Finance receives a weekly dashboard (cost per active user, cost per task, spend by tenant against its cap and by model) and reconciles to the vendor invoice monthly. Alerts at 50%, 80% and 100% of each tenant's cap and of the company's monthly AI budget. Emergency throttling by the CTO or SRE is allowed immediately, with the CFO told within 24 hours.

## 4. Key controls

| ID | Objective | Control | Frequency | Owner | Evidence |
| --- | --- | --- | --- | --- | --- |
| FC-01 | Bank and payment access | Named users, MFA, least privilege, quarterly access review | Quarterly | CFO | Access-review record |
| FC-02 | Authority | Approval matrix adopted by the board and enforced in the expense, billing and AP systems | Continuous; annual review | CEO + Board | Signed matrix; system configuration export |
| FC-03 | Segregation of duties | Requester, approver, payment releaser and reconciler are different people (compensating review where the team is too small) | Continuous | CFO | Transaction audit trail |
| FC-04 | Payee and bank-detail change | Call-back to a known number before any change | Each change | Finance | Verification record |
| FC-05 | Purchase approval | Spend above the threshold has a PO or signed order before commitment | Each purchase | Budget owner | PO log |
| FC-06 | Quote and discount | Quote checked against price book and discount authority | Each quote | RevOps + Finance | CRM approval trail |
| FC-07 | Contract terms | Non-standard terms logged and approved before signature | Each contract | Counsel + CFO | Deviation log |
| FC-08 | Order-to-invoice | Invoice generated from the order schedule; first invoice per customer reviewed by a second person | Each invoice | Finance | Invoice register |
| FC-09 | Entitlement-to-billing | Active entitlements reconciled to paid orders and usage to caps | Nightly; monthly review | RevOps + Finance | Leakage report |
| FC-10 | Cash application | Payments matched to invoices; unmatched cash cleared in two days | Weekly | Finance | Unapplied-cash report |
| FC-11 | Bank reconciliation | Every bank, card and processor account reconciled and reviewed by a second person | Monthly (weekly for processor) | Bookkeeper + CFO | Signed reconciliations |
| FC-12 | Revenue schedule | Schedule agrees to contract; changes need a memo | Monthly | Finance + accountant | Contract-to-ledger sample |
| FC-13 | Refunds and credits | Reason code, approval per matrix, register | Each item; monthly review | Finance | Refund register |
| FC-14 | Journals | Manual journals approved by a second person; no entries to closed periods | Each journal | CFO | Journal approvals |
| FC-15 | Payroll | Payroll register reviewed against the approved plan and offers | Each run | CFO | Reviewed register |
| FC-16 | AI spend | Tenant caps, budget alerts, monthly vendor reconciliation | Daily; monthly | CTO + Finance | Dashboard and reconciliation |
| FC-17 | Vendor management | Vendor register with security review, contract, renewal date; review before renewal | Quarterly | CFO + CISO | Vendor register |
| FC-18 | Forecast | 13-week cash and monthly reforecast; variance commentary | Weekly; monthly | CFO | Forecast versions |
| FC-19 | Tax calendar | Filings and remittances tracked to proof | Monthly check | CFO + tax adviser | Filing receipts |
| FC-20 | Insurance | Limits match contract promises; certificates current | Quarterly | CFO + broker | Certificate log |
| FC-21 | Fraud and anomaly | Duplicate-payment and unusual-vendor checks; whistleblower route to the board designate | Monthly | CFO | Exception log |
| FC-22 | Close | Close checklist signed by preparer and reviewer | Monthly | CFO | Checklist |
| FC-23 | Data access to finance records | Finance data in the approved system only; no bank, payroll, tax or personal data in the repository | Continuous; quarterly review | CFO + CISO | Access review; repository scan |
| FC-24 | Change to billing, pricing or payment configuration | Technical, security, finance and legal review before release | Each change | CTO + CFO | Change record |
| FC-25 | Record retention | Finance and contract records kept per the approved schedule and legal holds | Annual | CFO + counsel | Retention schedule |

A control is not operating until it has produced its evidence once and a second person has reviewed it. Until then the status of every row is *designed, not operating*.

## 5. Segregation of duties

| Duty | Founder / CEO | CFO / Head of Finance | Bookkeeper / AP | Budget owner | Board designate |
| --- | --- | --- | --- | --- | --- |
| Request spend | Yes | Yes | No | Yes | No |
| Approve spend | Above threshold | Medium and above | No | Small | Founder's own expenses |
| Create or change a vendor or payee | No | Approve | Prepare | No | No |
| Release payment | Co-sign large | Release | Prepare | No | No |
| Reconcile bank | No | Review | Prepare | No | No |
| Create invoice | No | Review | Prepare (RevOps) | No | No |
| Approve credit or refund | Large | Medium | No | No | No |
| Post manual journal | No | Approve | Prepare | No | No |
| Change pricing or entitlement rules | Approve | Approve | No | Propose | No |

Where one person must hold two roles at the start, the compensating control is a documented review by the accountant or the board designate within five business days.

## 6. Finance operations metrics

| Measure | Target (proposed) | Why |
| --- | --- | --- |
| Close completed | Business day 10 | Timely decisions |
| Unreconciled items older than 30 days | None | Control health |
| DSO | Under 75 days | Cash |
| Receivables older than 90 days | None without an escalation | Cash and credit risk |
| Invoices issued within 2 business days of trigger | 98% | Cash |
| Entitlement-to-billing exceptions open more than 5 days | None | Revenue leakage |
| Forecast error on 13-week cash (week 4) | Within 10% | Planning quality |
| Manual journals as a share of entries | Falling | Automation and risk |

## 7. First 90 days of finance setup

| Days | Deliverable | Owner |
| --- | --- | --- |
| 0-14 | Open business banking with two signers and dual authorization; engage an accountant, tax adviser, counsel and broker (document 06); adopt the approval matrix for the interim | Founder |
| 0-30 | Set up the accounting system and chart of accounts mapped to the cost-of-revenue and operating lines in document 03; card platform with limits; payroll provider; vendor register | Founder + bookkeeper |
| 15-45 | Approve the price book decision for the first design partner; build the quote and order-form templates; contract register; CRM stages | Founder + counsel |
| 30-60 | Billing system connected to the processor sandbox; invoice template; collections cadence; entitlement reconciliation designed; first close dry run on test data | Founder + RevOps |
| 45-75 | Insurance bound at the limits first customers will ask for; vendor security reviews for cloud, AI and payment vendors | Founder + broker |
| 60-90 | First monthly pack and 13-week cash forecast; first control evidence reviewed; board or advisor update using the template | Founder + accountant |

## Cannot be completed from source code

Accounts, signers, systems, thresholds, staff and every operating record require the founder's decisions and qualified professionals.
