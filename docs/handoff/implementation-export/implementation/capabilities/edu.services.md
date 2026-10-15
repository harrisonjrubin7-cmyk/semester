# edu.services — Campus services

Source-declared design contract, not current implementation proof.

routes: /app/services, /app/services/:id
actors: student
permissions: service_request.create
records: svc.service_definitions, svc.service_requests
commands: api.submit_request
events: request.submitted
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
