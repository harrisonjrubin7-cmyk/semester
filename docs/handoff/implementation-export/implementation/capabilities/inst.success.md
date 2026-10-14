# inst.success — Student success

Source-declared design contract, not current implementation proof.

routes: /institution/success
actors: advisor
permissions: case.work
records: svc.cases, acad.readiness_items, acad.advising_assignments
commands: api.open_case, refer
events: case.opened
screen_types: overview, list, detail

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
