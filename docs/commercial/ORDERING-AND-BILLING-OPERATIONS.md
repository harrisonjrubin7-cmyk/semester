# Ordering and Billing Operations

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PRE-ACTIVATION PROCESS — NO LIVE QUOTE-TO-CASH OPERATION APPROVED** |
| Owner | Harrison Rubin — company-side commercial operations owner; finance operator, signing authority, accountant, tax reviewer and backup unassigned |
| Evidence date | 2026-10-03 at repository revision `9b866db3` |

## Control boundary

Billing/subscription tables, checkout/webhook/cancellation logic and tests are implementation evidence. They do not establish a legal entity/bank/merchant/tax/accounting posture, current price authority, configured production provider, successful collection, reconciled settlement, refund operation or permission to sell. Institutional student-account functionality is separate from Semester's own customer billing and must not be used as its accounting ledger.

## Order-to-cash sequence

1. **Qualify:** verify legal customer, authorized contacts/signers, product scope, delivery feasibility, budget/procurement path, tax/exemption needs, PO/vendor requirements and data/launch prerequisites.
2. **Quote:** use the approved current price book, currency and template; record cohort/term, services, usage, support, taxes, expenses, payment/renewal/cancellation/refund, validity and offboarding. Apply discounts only within written authority.
3. **Review and contract:** commercial, delivery, security/privacy/accessibility, finance/tax and counsel approve exceptions. Separate order signature from launch GO.
4. **Create order:** after signature, record immutable agreement/order version, parties, dates, line items, billing schedule, PO, contacts, tax treatment and evidence links. Enforce segregation between seller/approver where staffing permits; otherwise record the single-person limitation.
5. **Invoice/checkout:** issue only through the approved accounting/billing system with unique numbering and duplicate prevention. No live provider key or customer charge until authority, test mode, webhook, cancellation/refund, access and incident controls are accepted.
6. **Collect and reconcile:** match processor/bank/accounting records to invoices; investigate missing, duplicate, late, disputed or refunded amounts; preserve source references without storing raw card/bank credentials.
7. **Entitle and activate:** commercial status may create entitlement only according to executed scope. It never bypasses named-tenant security, privacy, accessibility, UAT, support or launch approval.
8. **Close:** handle credits/refunds/collections under approved policy; reconcile period records; provide customer documentation; feed qualified accounting review and retain records per approved schedule.

Access to pricing, contracts, provider, invoices, refunds and exports must be least-privilege, logged, reviewed and revoked on role change. Never suspend export/deletion or other non-waivable data-rights handling because payment is late.

## Evidence state

**Repository evidence.** Commercial data structures and billing behavior tests cover idempotency, signed webhooks, cancellation and selected invoice/payment states; pricing and legal drafts define required controls.

**Operational evidence.** No approved production provider/configuration, merchant/bank/accounting/tax setup, issued customer invoice, collected/reconciled payment, exercised refund/dispute, staffed finance role or independent close is evidenced.

**Missing test/proof.** Confirm entity/signing/bank/merchant/tax/accounting authority; approve price/order/invoice/refund/collections policies; configure test then production systems; run quote-to-cash/refund/dispute/reconciliation/access drills; obtain accountant/counsel approval.

## Claim ceiling

Semester may say it has designed and repository-tested selected billing controls while live commercial operations remain inactive/unapproved.

## Prohibited claims

Do not claim payments are live, invoices are issued, revenue is collected/reconciled, taxes are configured, refunds/disputes are operational, financial controls are independently staffed or a signed order authorizes product launch.
