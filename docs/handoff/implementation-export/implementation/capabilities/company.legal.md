# company.legal — Legal and corporate

Source-declared design contract, not current implementation proof.

routes: /company/legal
actors: legal_operator
permissions: matter.edit
records: legal.entities, legal.matters, docs.documents
commands: open_matter
events: 
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
