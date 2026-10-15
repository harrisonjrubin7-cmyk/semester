# ops.config — Product configuration

Source-declared design contract, not current implementation proof.

routes: /console/flags
actors: release_manager
permissions: flag.edit
records: core.institutions, commerce.entitlements, ops.feature_flags
commands: api.set_flag
events: flag.changed
screen_types: list, settings, history

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
