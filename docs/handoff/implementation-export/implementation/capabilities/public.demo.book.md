# public.demo.book — Demonstrations

Source-declared design contract, not current implementation proof.

routes: /demo, /demo/tour
actors: prospect
permissions: demo.request
records: growth.leads, biz.opportunities
commands: api.submit_lead
events: demo.requested
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
