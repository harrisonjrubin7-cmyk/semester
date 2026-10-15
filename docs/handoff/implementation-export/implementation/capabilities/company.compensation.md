# company.compensation — Compensation

Source-declared design contract, not current implementation proof.

routes: /company/compensation
actors: people_admin
permissions: compensation.read
records: people.compensation_records
commands: approve_compensation
events: 
screen_types: list, detail, review

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
