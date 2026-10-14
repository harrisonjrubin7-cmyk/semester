# company.it — Company IT

Source-declared design contract, not current implementation proof.

routes: /company/it
actors: it_admin
permissions: asset.edit, access.request
records: it.assets, ctl.grants
commands: request_access
events: access.granted
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
