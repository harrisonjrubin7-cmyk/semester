# shared.identity.signin — Identity

Source-declared design contract, not current implementation proof.

routes: /auth/signin, /auth/mfa, /auth/recover
actors: any
permissions: session.create
records: auth.users, onboard.devices
commands: sign_in, verify_mfa
events: session.started
screen_types: edit

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
