# edu.family — Family and guardian access

Source-declared design contract, not current implementation proof.

routes: /family, /app/settings/sharing
actors: student, guardian
permissions: delegation.grant
records: core.delegations, core.delegation_scopes
commands: api.grant_delegation, api.revoke_delegation
events: delegation.granted
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
