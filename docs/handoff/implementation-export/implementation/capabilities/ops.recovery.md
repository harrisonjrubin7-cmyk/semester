# ops.recovery — Recovery

Source-declared design contract, not current implementation proof.

routes: /console/recovery
actors: reliability_engineer
permissions: restore.test
records: ops.backups, ops.restore_exercises
commands: api.record_restore_test
events: restore.tested
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
