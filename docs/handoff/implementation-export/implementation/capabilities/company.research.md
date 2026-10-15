# company.research — Strategy and research

Source-declared design contract, not current implementation proof.

routes: /company/research
actors: researcher
permissions: experiment.edit
records: research.records, research.experiments
commands: record_experiment
events: 
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
