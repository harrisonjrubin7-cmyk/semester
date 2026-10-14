# company.implementation — Implementation

Source-declared design contract, not current implementation proof.

routes: /company/implementations/:id
actors: implementation_specialist
permissions: migration.run, acceptance.record
records: impl.migration_batches, impl.acceptance_records, opsx.sync_runs
commands: run_migration, record_acceptance
events: acceptance.recorded
screen_types: detail, review, history

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
