# ops.privacy — Privacy operations

Source-declared design contract, not current implementation proof.

routes: /console/privacy
actors: privacy_operator
permissions: data_request:handle
records: opsx.privacy_requests
commands: api.verify_privacy_identity, api.fulfil_privacy_request
events: privacy.fulfilled
screen_types: list, detail, review, history

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
