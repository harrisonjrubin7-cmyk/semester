# inst.accommodations — Accommodation operations

Source-declared design contract, not current implementation proof.

routes: /institution/accommodations
actors: accessibility_coordinator
permissions: accommodation.decide
records: svc.accommodation_plans, svc.restricted_cases
commands: api.decide_accommodation
events: accommodation.decided
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
