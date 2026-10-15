# inst.handoffs — Office handoffs

Source-declared design contract, not current implementation proof.

routes: /institution/handoffs
actors: office_staff
permissions: handoffs.work
records: acad.office_handoffs, acad.holds
commands: api.resolve_handoff
events: handoff.resolved
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
