# ops.integrations — Integration operations

Source-declared design contract, not current implementation proof.

routes: /console/integrations
actors: operator
permissions: integration:view
records: opsx.integrations, opsx.sync_runs, integ.sync_errors
commands: retry_sync
events: sync.completed
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
