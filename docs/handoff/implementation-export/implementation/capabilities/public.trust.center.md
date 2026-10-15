# public.trust.center — Trust

Source-declared design contract, not current implementation proof.

routes: /trust, /legal, /status
actors: buyer, reviewer
permissions: evidence.request
records: biz.subprocessors, gov.evidence, opsx.incident_updates
commands: request_evidence
events: evidence.requested
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
