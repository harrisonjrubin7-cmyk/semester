# ops.access — Access administration

Source-declared design contract, not current implementation proof.

routes: /console/access
actors: access_reviewer
permissions: grant.create, grant.revoke
records: ctl.grants, iam.access_reviews
commands: api.grant_capability, api.revoke_grant
events: grant.revoked
screen_types: list, detail, review

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
