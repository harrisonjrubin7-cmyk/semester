# inst.services — Services operations

Source-declared design contract, not current implementation proof.

routes: /institution/services
actors: service_specialist
permissions: request.assign
records: svc.service_requests, svc.service_definitions
commands: api.assign_request, api.resolve_request
events: request.resolved
screen_types: list, detail

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
