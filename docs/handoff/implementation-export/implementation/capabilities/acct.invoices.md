# acct.invoices — Billing

Source-declared design contract, not current implementation proof.

routes: /account/invoices
actors: billing_admin
permissions: invoice.read, invoice.pay
records: cofin.invoices, cofin.payments
commands: pay_invoice
events: invoice.paid
screen_types: list, detail

## Acceptance
- authorized complete job loop
- tenant/object negative access
- expiry/revocation enforcement
- source authority and freshness
- approval target/payload/version binding
- idempotent durable command
- outbox replay/reconciliation
- seven data-region states
- manual accessibility review
- exact-target deployment and applicable authority acceptance

Reconcile existing code and authority before adding or applying schemas. Production activation disabled.
