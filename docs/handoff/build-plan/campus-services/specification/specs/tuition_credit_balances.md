# Native tuition, payment and credit-balance specification
Status: proposed implementation contract; qualified bursar/aid/accounting/legal approval needed. Statutory books/payment rails separate from native operational ledger.

## Rates and charges
Version rate schedule by institution/program/campus/term/payment period, residency where authorized, credit band/flat/per-credit basis, course/lab fees, housing/dining, deposits, waivers, sponsor terms and approved late/installment fees. Decimal/rational calculation with accepted rounding/exponent; no float monetary math. Pin inputs/rule/effective time/source/explanation. Reassessment posts delta, never overwrites historical charge.

## Account and allocation
Posted charges/credits distinct from anticipated aid, processing payments, disputed amounts, payable-now/installments and credit obligations. Payment allocations retain payer/source restrictions, charge refs, unallocated remainder and reallocation history. Negative total account balance alone does not establish Title IV credit balance.

## Plans and payer access
Accepted plan terms/version, eligible principal, schedule/fees/grace/auto-debit authorization, modification/default/aid-allocation and hold effects. Payer can pay narrowly authorized amount without grades/other student records. Expiring revocable statement/plan access independently granted and logged. AI explains accepted terms, cannot create eligibility, financial exception or aid decision.

## Payments
Adapter create/getAttempt, capture/confirm, cancel, create/getRefund, settlements and verified normalized event. Tokenized approved provider capture; no PAN/CVC in Semester stores/logs/prompts. Server amount/currency; provider-account scoped idempotency. Signature verification on raw bytes, durable event+semantic dedupe. created -> action_required -> processing -> confirmed/failed/cancelled/unknown; settlement and journal states separate.
Provider success + ledger failure retries posting only, not charge. Payment posted + hold update failure keeps funds posted and queues fresh authorized hold evaluation. Browser redirect does not establish payment. Uncertain external outcome reconciled before retry. Pending refund is outstanding obligation, not completed return.

## Credit obligations
Separate ordinary overpayment; tuition-policy refund; housing/dining credit; Title IV credit balance; withdrawal/R2T4; sponsor credit; dispute reversal. Classification pins approved calculation/recipient/timing, qualifying source funds/charges and applicable authorization. Current reviewed rules—not one generic refund formula.
For ordinary applicable Title IV credit-balance timing, absent valid hold authorization: no later than 14 calendar days after creation when created after classes begin; or 14 days after first day of class when created beforehand. Authorization cancellation triggers separate deadline from receipt of cancellation. Case-specific recipients, program/period constraints, holding authorizations and R2T4 restrictions require qualified review. Reference helper only computes simplified standard dates, not eligibility or full statutory decision.
Record obligation amount, qualifying calculation/version, creation/classes dates, recipient, authorization/revocation, deadline/basis, disbursement attempt/status, reconciliation and responsible officer. classify -> deadline -> review/approve -> dispatch -> reconcile delivery -> close. Rejected transfer stays open; no close on provider request acceptance alone.

## Consoles
Account command center; rate/assessment; charge/credit; payment/settlement; plans; credit/refund obligations; office-owned holds; sponsor billing; disputes/collections; aid reconciliation; period close/accounting; audit/regulatory evidence.

## Acceptance
Rate rounding/bands; reassessment; aid pending vs posted; source-constrained allocations; duplicate/out-of-order events; success timeout; concurrent refunds; payment-posting failure; hold denial; payer revocation; Title IV classification/deadline/recipient/hold/revocation; separate withdrawal policy; failed refund delivery; multi-book/tenant isolation; close/correction and restore.
