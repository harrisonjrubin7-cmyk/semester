# shared.identity.sessions — Identity

Source-declared design contract, not current implementation proof.

routes: /app/settings/sessions
actors: any
permissions: session.revoke
records: onboard.devices, onboard.push_tokens
commands: api.revoke_device
events: device.revoked
screen_types: list, settings

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
