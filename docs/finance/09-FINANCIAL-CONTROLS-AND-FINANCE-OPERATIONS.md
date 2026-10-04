<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 09. Financial controls and finance operations

| Control | Value |
| --- | --- |
| Status | **DESIGNED CONTROLS: NONE OPERATING; NO COMPLIANCE OR AUDIT CLAIM IS MADE** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has designed financial controls and a finance operating calendar. **Prohibited claims.** Do not claim that financial controls are operating, independently staffed, tested or audited, that payments are live, that invoices are issued, or that revenue is collected or reconciled (`ORDERING-AND-BILLING-OPERATIONS.md`). Nothing here is an assessment against any control framework.

## 1. Objectives and constraints

Objectives: every dollar in is billed on a signed order and applied to an invoice; every dollar out is budgeted, approved and recorded; the books agree with the bank and the billing system every month; the numbers in the board package can be reproduced; and nothing depends on one person's memory.

The binding constraint is the same as in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md): there is one decision-maker. Segregation of duties is therefore built from **people outside the company** (accountant, fractional CFO, board observer), **system controls** (permissions, dual approval in tools, immutable records) and **hard caps**. Where a control cannot be separated, the page says so rather than pretending.

## 2. Structure

| Element | Proposal |
| --- | --- |
| Accounting basis | Accrual; policies per the accountant |
| Chart of accounts | Revenue by stream (student, platform, pilot, implementation, AI add-on, alumni, career, marketplace); deferred revenue; receivables; cost of revenue lines matching the model's buckets (infrastructure, AI, integrations, support, implementation, customer success, payments, marketplace); operating expense by function (engineering and product, security, sales, marketing, legal, insurance, G&A) |
| Dimensions | Segment (student, institution, marketplace), tenant, project, gate, scenario tag, funding tranche |
| Bank | Operating account, payroll account, tax-reserve account, processor payout account; two authorized signers on any account once a second officer exists; dual approval on wires above the matrix threshold |
| Processor | Hosted checkout so Semester never handles card numbers; payout reconciliation to the ledger by transaction |
| Billing | Stripe for consumer subscriptions; an invoicing tool with unique numbering for institutions; both reconciled to the ledger |
| Spend | Company cards per owner with limits; AP in the accounting system; approvals per [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md) |
| Payroll | PEO or payroll provider; payroll register reconciled to the ledger |
| FP&A | `semester-financial-model.xlsx` under version control, with verification output |
| Documents | Access-controlled repository; board data room; signed-contract register tied to the CRM |

## 3. Control matrix

All status "designed, not operating". Test = how the control is checked.

| ID | Risk | Control | Frequency | Owner | Evidence | Test |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | Invoice issued without a signed order | Invoice requires an order record with price-book version and approver | Each invoice | Finance | Order link on invoice | Sample 100% of invoices against orders monthly |
| C-02 | Duplicate or skipped invoice numbers | System-generated sequence; gaps explained | Monthly | Finance | Number sequence report | Reviewer scans for gaps |
| C-03 | Unapproved discount | Deal-desk ladder enforced in quote tool; exceptions logged | Each quote | Deal desk | Approval record | Compare list to net price on all quotes |
| C-04 | Cash not applied or misapplied | Cash application within 2 business days; unapplied cash report | Weekly | Finance | Unapplied cash list | Reviewer ages the report |
| C-05 | Billing system and ledger disagree | Reconcile subscriptions, invoices and processor payouts to the ledger | Monthly | Finance; CPA | Signed reconciliation | CPA re-performs one month a quarter |
| C-06 | Duplicate webhook or event changes balances | Idempotent event application (exists in code: `apply_payment_event`) | Continuous | Engineering | Check tests (`commercial-automation.check.sql`) | Run in CI; replay test |
| C-07 | Refund or credit abuse | Amount thresholds in the matrix; reason code; second approval over threshold | Each | Finance | Approval record | Monthly refund report review |
| C-08 | Payment to a fraudulent vendor | New-vendor onboarding (W-9, security review if data); bank-detail change call-back to a known number | Each | Finance | Vendor file | Quarterly sample |
| C-09 | Unauthorized payment | Payment approval per matrix; bank dual control when available; card limits | Each | Finance | Approval trail | Monthly review of payments over $5,000 |
| C-10 | Unbudgeted commitment | Contract signing authority table; PO or approval before signature | Each | Founder; finance | Approval record | Monthly commitments report vs budget |
| C-11 | Payroll error or ghost employee | Payroll provider runs; register reconciled to HR roster and ledger; new-hire form approved | Each run | Finance | Register, roster | CPA reviews quarterly |
| C-12 | Revenue recorded before it is earned | Accountant's policy applied; no recognition from unsigned, unapproved-price, unaccepted or unverifiable items | Monthly | CPA | Contract memos, schedules | CPA review; auditor later |
| C-13 | Cut-off errors | Close calendar; accrual checklist; subsequent-payments review | Monthly | Finance | Close checklist | Reviewer sign-off |
| C-14 | Deferred revenue and receivables misstated | Roll-forward schedules tied to billing system | Monthly | Finance | Schedules | CPA recompute |
| C-15 | AI vendor invoice does not match usage | Reconcile provider invoices to `private.ai_usage_month` by tenant and model | Monthly | Finance; engineering | Reconciliation | Variance over 5% investigated |
| C-16 | AI spend overrun for a tenant | Per-tenant monthly budget (`private.reserve_ai_budget`); alert at 80% | Continuous | Engineering | Budget table, alerts | Quarterly test of the cap and kill switch |
| C-17 | Tax filing missed | Tax calendar from the adviser; registrations tracker; reminders to two people | Monthly | Finance; tax adviser | Calendar, filings | CPA confirms filed |
| C-18 | Model error reaches the board | Version-controlled model; verification run printed on the pack; reviewer opens changed assumptions | Each pack | Finance | `verify.py` and `independent_check.py` output | Reviewer reperforms headline numbers |
| C-19 | Unauthorized access to finance systems | Least privilege; MFA; quarterly access review; role changes revoke access | Quarterly | Founder | Access review record | Compare users to roster |
| C-20 | Student data in finance reports | Aggregate-only reporting; small-cell suppression; no student identifiers in the ledger or board data room | Each pack | Finance; privacy | Pack checklist | Reviewer scan |
| C-21 | Insurance lapses or is inadequate | Renewal calendar; contract requirements checked at each signature | Quarterly | Finance; broker | Policies, certificates | Broker confirms |
| C-22 | Cash falls below minimum | 13-week forecast; runway triggers in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md) | Weekly | Finance | Forecast | Board sees it quarterly |
| C-23 | Related-party or conflicted spend | Disclosure; board approval | Each | Founder; board | Register | Annual attestation |
| C-24 | Records lost or destroyed early | Retention schedule from counsel and the CPA; legal holds override | Annual | Finance; counsel | Schedule | Spot check |

## 4. Segregation of duties

| Function | Initiate | Approve | Execute | Record | Reconcile | Today's compensating control |
| --- | --- | --- | --- | --- | --- | --- |
| Customer invoice | Finance | Founder | Finance | Finance | CPA | CPA samples all invoices monthly |
| Vendor payment | Budget owner | Per matrix | Finance | Finance | CPA | Call-back for new bank details; cap |
| Payroll | Finance | Founder | PEO | PEO | CPA | Provider-run payroll |
| Refund or credit | Support | Finance | Finance | Finance | CPA | Cap and monthly report |
| Journal entry | Finance | Reviewer (CPA/fractional CFO) | | | | No manual entry without reviewer |
| Bank account changes | Founder | Board resolution | Bank | | | Dual notification |

## 5. Month-end close calendar (target business days)

| Day | Task | Owner |
| --- | --- | --- |
| BD-1 | Freeze: all invoices dated in the month issued; cut-off reminders to owners | Finance |
| BD+1 | Bank and processor statements pulled; cash application finished | Finance |
| BD+2 | Reconcile bank, processor payouts, billing system to ledger | Finance |
| BD+3 | AR aging and collections review; unapplied cash cleared; AI vendor invoice reconciliation | Finance |
| BD+4 | Payroll register reconciled; accruals (unbilled, bonuses, vendors) | Finance |
| BD+5 | Deferred revenue and receivables roll-forwards; revenue schedule per accountant's policy | Finance; CPA |
| BD+6 | Expense review; budget-versus-actual and variance notes from owners | Finance; owners |
| BD+7 | Close the books; reviewer sign-off | CPA / fractional CFO |
| BD+8 | Management pack; model actuals loaded; forecast refreshed | Finance |
| BD+10 | Pack to founder and board observers | Finance |

## 6. Calendar

| Frequency | Activity |
| --- | --- |
| Daily | Processor and bank alerts; disputes and failed payments queue |
| Weekly | Cash and 13-week forecast; invoices due; approvals pending; operating flash |
| Monthly | Close; reconciliations; AR collections; AI usage reconciliation; pack |
| Quarterly | Board package; reforecast; access review; sales-tax and estimated-tax checks; vendor and insurance review; refund and discount review; price review; control testing sample |
| Annual | Budget and tranche request; tax filings; financial statement review or audit; policy refresh; records retention review; insurance renewal; model re-baseline |

## 7. Systems

Selection criteria, not endorsements: accrual ledger with audit trail and role-based access, integration with the bank and processor, usage-based invoicing capability, revenue schedule support, document attachment per transaction, approval workflows, SOC reports from the vendor, export on exit. Candidates are evaluated with the accountant, because the accountant must be able to work in the ledger. The billing and subscription system of record for consumer plans is the existing `subscriptions` / `invoices` / `dunning_cases` data, with Stripe as processor; it is not the ledger.

## 8. Data lineage for the numbers

| Metric | Source | Owner | Refresh |
| --- | --- | --- | --- |
| Paying subscribers, plan mix, churn | `subscriptions`, processor | Finance | Daily |
| Billings, collections | Invoicing tool, bank, processor | Finance | Daily |
| Recognized revenue, deferred revenue | Ledger under the accountant's policy | CPA / finance | Monthly |
| Active users (free, paying, sponsored) | Analytics marks defined in `ANALYTICS.md`; new marks only through D-005 | Product | Weekly |
| AI tokens and cost | `private.ai_usage_month`, provider invoices | Engineering; finance | Monthly |
| Pipeline and bookings | CRM; signed orders only | Sales | Weekly |
| Implementation hours | Time tracking on projects | Implementation | Weekly |
| Support tickets | Support queue | Support | Weekly |
| Headcount and payroll | HR roster, payroll provider | Finance | Monthly |

## 9. Model governance

The workbook is source-controlled with its generator. A change to an assumption is a commit that states the evidence; `verify.py` must report zero mismatches and `independent_check.py` must pass before a pack is issued; the reviewer opens the Assumptions diff. Actuals replace plan values only when they are real readings; a plan value is never silently overwritten by an estimate. Scenarios are not forecasts and carry that label in the pack.
