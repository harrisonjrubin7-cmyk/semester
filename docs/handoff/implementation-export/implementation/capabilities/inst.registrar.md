# inst.registrar — Registrar

Source-declared design contract, not current implementation proof.

routes: /institution/records
actors: registrar
permissions: records.read, change.approve
records: acad.enrollments, ctl.action_requests
commands: api.request_action
events: record_change.requested
screen_types: list, detail, review, history

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
