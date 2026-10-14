# Native finance — implementation contract
Status: proposed extension; source docs/finance/NATIVE_FINANCIAL_PLATFORM.md lists existing canonical tables and handoff 090, not proof of production deployment.

## Boundaries
Semester owns catalog, price versions, quote/order forms, billing accounts, invoices, subscription/entitlement policy, usage, payment orchestration, native UX, operational ledger, refund controls, dunning, console and reconciliation. A regulated rail handles collection/settlement/payment credentials; statutory accounting remains in accepted accounting books. Product billing, university student accounts and marketplace money flows are separate legal entities/books/authority domains. No raw PAN/CVC in Semester browser stores, servers, logs or AI. Processor-owned capture may live inside Semester UX after PCI/acquirer review; native checkout does not imply homemade card capture or regulatory exemption.

## Reuse data
Extend commercial_products, commercial_plans, commercial_prices, entitlement_definitions, plan_entitlements, billing_accounts, quotes, contracts, subscriptions, invoices, payment_events, credits_refunds, dunning_cases, cancellation_requests, student_account_entries, student_payment_plans, student_account_reconciliations and student_account_closes. Reconcile handoff fin.ledger_accounts/journals/lines, payment_rails/attempts/transitions/provider_events, settlements and refund requests/approvals before adding anything.

## State models
Checkout: draft -> priced -> terms_accepted -> payment_method_tokenized -> submitted -> awaiting_confirmation -> completed/failed/expired. Re-price invalidates acceptance; server calculates amounts; no browser success proves payment.
Payment attempt: created -> requires_method/requires_confirmation/requires_action -> processing -> authorized -> capture_pending -> captured; failed/cancelled/expired/unknown explicit branches. Settlement is a separate per-amount allocation state: pending -> partial -> settled -> reconciled/exception. Refund and dispute are separate aggregates; do not encode a refunded settled payment as if capture never occurred.
Refund: requested -> policy_checked -> awaiting_approval -> approved -> submitted -> processing -> partial/succeeded/failed/unknown. Requester cannot approve where independent review applies. Lock refundable amount against concurrent refunds; fees/chargebacks require accepted accounting policy.
Invoice: draft -> approved -> issued -> open -> partially_paid -> paid; void/writeoff/overdue/disputed separately represented with history. Subscription states and payment-plan states versioned; unpaid access/grace behavior explicitly approved.

## Ledger invariants
Integer minor units and explicit currency/exponent; per-book/currency balance; no cross-currency pseudo-balance; append-only posted journals; correction by linked reversing/replacement entries; pre-post validation plus DB transactional constraints; source event/object uniqueness; materialized balances rebuildable; effective/recorded timestamps distinct. Operational ledger is not asserted GAAP/IFRS-complete without accountant acceptance.

## Webhooks and adapters
Verify exact raw bytes and signature/tolerance; durably dedupe event ID per provider/account; same resource/business transition may require additional semantic dedupe. Enqueue durable handling then acknowledge. Do not order by receipt or coarse created timestamp. Fetch/reconcile authoritative objects for uncertain/out-of-order events. Adapter interface: createAttempt, confirm/getAttempt, capture, cancel, create/getRefund, listSettlements, normalizeVerifiedEvent. Commands carry idempotency, scope, source refs and correlation; retries never imply payment failed.

## Acceptance
Balanced and concurrent journal/refund tests; duplicate/out-of-order webhook; charge timeout after provider success; partial captures/refunds; settlement fees/disputes; entitlement rollback; multi-currency denial; merchant/book isolation; accountant/payment counsel/PCI review; current commercial/customer authority; operated reconcile/restore/incident/support before activation.
