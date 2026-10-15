# dev.sandbox — Sandbox tenants

Source-declared design contract, not current implementation proof.

routes: /developers/sandbox
actors: approved_developer
permissions: sandbox.create
records: core.institutions
commands: create_sandbox
events: sandbox.created
screen_types: detail

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
