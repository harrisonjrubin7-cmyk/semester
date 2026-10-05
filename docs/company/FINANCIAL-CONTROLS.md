# Semester financial controls

> **DRAFT FOR QUALIFIED ACCOUNTING, TAX, AND LEGAL REVIEW. This document is not professional advice and does not establish that any control currently operates.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Founder/finance owner |
| Review frequency | Monthly; annual professional review |
| Approval authority | Founder/authorized governing body |
| Dependencies | Bank/accounting records, authority matrix, expense and procurement policies, approved pricing and contracts |

## Purpose and control objectives

Protect company assets; keep complete, accurate and timely records; authorize commitments; separate approval from payment where practicable; manage fraud, tax and contractual risk; and make cash/runway decisions from reconciled evidence.

## Minimum controls

| Domain | Required control | Operating evidence |
| --- | --- | --- |
| bank/payment access | named accounts, MFA, least privilege, backup recovery, quarterly access review | access-review record |
| authorization | approved thresholds for spend, contracts, refunds, credits, debt and equity | signed authority matrix |
| segregation | requester, approver, payment releaser and reconciler separated where practicable | transaction audit trail |
| close/reconciliation | bank/payment/receivable/payable reconciliation and review | monthly close checklist |
| payee change | independent out-of-band verification | verification record |
| revenue | executed order, invoice, collection and recognition treatment reconciled | contract-to-ledger sample |
| refunds/credits | approved reason, threshold and customer record | refund register |
| payroll/contractors | approved worker, classification, rate, time/deliverable and tax records | payroll/vendor record |
| tax | filing calendar, nexus review, remittance and evidence | professional calendar/receipt |
| forecast | 13-week cash and budget-to-actual review | approved forecast |

## System and data controls

- Finance records reside in an approved access-controlled system, not source code.
- Exported reports carry source, period, preparer, reviewer and reconciliation state.
- Sensitive records use least privilege, retention and legal-hold rules.
- Provider secrets, bank details and personal tax/payroll data never enter the repository.
- Changes to billing, pricing, payment or finance integrations require technical, security, finance and legal review.

## Exceptions and incidents

Suspected fraud, unauthorized payment, duplicate payment, account compromise, material error, missing records or tax issue is escalated immediately. Preserve evidence, restrict access, notify the appropriate bank/provider/professional, assess reporting duties, and record remediation. Do not conceal a variance by changing the plan retroactively.

## Monthly close checklist

- [ ] Bank and payment accounts reconciled.
- [ ] Receivables, payables, refunds, credits and deferred amounts reviewed.
- [ ] Payroll/contractor and vendor records reviewed.
- [ ] Budget, cash and runway updated.
- [ ] Unusual transactions and conflicts reviewed.
- [ ] Tax, insurance, contract and renewal calendar checked.
- [ ] Preparer and independent reviewer recorded.

## Unknowns requiring approval

Entity/accounting method, fiscal year, accounts, signers, thresholds, tax/nexus, payroll, insurance, pricing, revenue recognition, refund and collections treatment, systems, personnel and professional reviewers are **UNKNOWN** until confirmed from controlled records.

## Cannot be completed from source code

Actual accounts, signers, thresholds, transactions, reconciliations, payroll, tax, revenue treatment, systems, staffing and control operation require controlled records and qualified review.
