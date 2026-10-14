# public.signup — Signup

Source-declared design contract, not current implementation proof.

routes: /auth/signup, /join
actors: visitor
permissions: account.create
records: core.profiles, growth.consent_records, onboard.assignments
commands: api.assign_journey
events: user.registered
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
