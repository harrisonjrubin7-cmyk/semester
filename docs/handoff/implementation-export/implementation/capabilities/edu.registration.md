# edu.registration — Registration readiness

Source-declared design contract, not current implementation proof.

routes: /app/registration
actors: student
permissions: readiness.read, blocker.route
records: acad.readiness_items, acad.holds, acad.office_handoffs, acad.terms
commands: api.route_blocker
events: readiness.routed
screen_types: overview, detail, history

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
