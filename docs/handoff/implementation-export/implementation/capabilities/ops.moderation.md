# ops.moderation — Abuse and moderation

Source-declared design contract, not current implementation proof.

routes: /console/moderation
actors: moderator
permissions: report.decide
records: community.reports, community.posts
commands: api.decide_report
events: report.decided
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
