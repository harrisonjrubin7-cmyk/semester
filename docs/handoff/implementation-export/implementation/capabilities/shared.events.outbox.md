# shared.events.outbox — Events and jobs

Source-declared design contract, not current implementation proof.

routes: (worker)
actors: service_account
permissions: event.publish
records: ctl.outbox
commands: outbox.publish
events: *
screen_types: 

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
