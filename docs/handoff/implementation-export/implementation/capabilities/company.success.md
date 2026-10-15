# company.success — Customer success

Source-declared design contract, not current implementation proof.

routes: /company/customers, /company/renewals
actors: csm
permissions: health.edit, renewal.plan
records: biz.accounts, biz.pilots, biz.pilot_measures, biz.contracts
commands: api.record_measure
events: renewal.due
screen_types: overview, list, detail

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
