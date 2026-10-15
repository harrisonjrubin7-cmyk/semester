# edu.profile — Identity and profile

Source-declared design contract, not current implementation proof.

routes: /app/profile, /app/settings
actors: student
permissions: profile.edit
records: core.profiles, growth.consent_records
commands: update_profile
events: profile.updated
screen_types: detail, settings

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
