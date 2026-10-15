# edu.housing — Campus housing

Source-declared design contract, not current implementation proof.

routes: /app/campus, /app/campus/maintenance
actors: student
permissions: housing.apply
records: housing.applications, housing.assignments, housing.rooms, housing.maintenance_requests
commands: api.apply_housing, api.request_maintenance
events: maintenance.requested
screen_types: overview, detail, edit

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
