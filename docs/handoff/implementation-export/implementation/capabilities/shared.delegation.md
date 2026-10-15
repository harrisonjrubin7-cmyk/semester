# shared.delegation — Authorization

Source-declared design contract, not current implementation proof.

routes: /app/settings/sharing
actors: student
permissions: delegation.grant
records: core.delegations
commands: api.grant_delegation, api.revoke_delegation
events: delegation.granted, delegation.revoked
screen_types: list, edit, history

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
