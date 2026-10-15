# ops.database — Database operations

Source-declared design contract, not current implementation proof.

routes: /console/database
actors: reliability_engineer
permissions: repair.request
records: ops.migrations, ops.repair_requests
commands: api.request_repair
events: repair.completed
screen_types: list, review

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
