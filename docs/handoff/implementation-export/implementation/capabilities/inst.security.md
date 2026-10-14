# inst.security — Institution security

Source-declared design contract, not current implementation proof.

routes: /institution/identity, /institution/access-reviews
actors: identity_admin
permissions: sso.configure, access_review.run
records: opsx.integrations, ctl.grants, iam.access_reviews
commands: configure_sso, api.run_access_review
events: access_review.completed
screen_types: settings, review

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
