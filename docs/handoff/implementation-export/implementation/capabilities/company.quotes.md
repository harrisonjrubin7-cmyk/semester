# company.quotes — Commercial approvals

Source-declared design contract, not current implementation proof.

routes: /company/quotes
actors: sales_rep, finance_approver
permissions: quote.create, quote.approve
records: sales.quotes, commerce.price_versions, ctl.action_requests
commands: api.create_quote, approve_quote
events: quote.approved
screen_types: list, detail, edit, review

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
