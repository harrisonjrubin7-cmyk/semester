# inst.integrations — Institution integrations

Source-declared design contract, not current implementation proof.

routes: /institution/connectors
actors: integration_admin
permissions: integration.configure
records: opsx.integrations, opsx.sync_runs, integ.mappings, integ.sync_errors
commands: configure_integration, api.run_sync
events: sync.completed
screen_types: list, detail, settings, history

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
