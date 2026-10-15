# edu.wellbeing — Wellbeing and accessibility

Source-declared design contract, not current implementation proof.

routes: /app/support
actors: student
permissions: restricted_case.create
records: svc.restricted_cases, svc.accommodation_plans
commands: api.request_support
events: support.requested
screen_types: overview, edit

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
