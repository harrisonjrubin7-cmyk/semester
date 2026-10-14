# company.billing — Company billing

Source-declared design contract, not current implementation proof.

routes: /company/invoices
actors: billing_operator
permissions: invoice.issue, credit.issue
records: cofin.invoices, cofin.invoice_lines, cofin.credits
commands: api.issue_invoice, issue_credit
events: invoice.issued
screen_types: list, detail, edit

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
