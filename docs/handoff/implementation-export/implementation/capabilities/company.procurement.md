# company.procurement — Procurement

Source-declared design contract, not current implementation proof.

routes: /company/procurement
actors: requester, finance_approver
permissions: purchase.request, purchase.approve
records: vend.purchase_orders, vend.vendors
commands: api.request_purchase, api.approve_purchase
events: purchase.approved
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
