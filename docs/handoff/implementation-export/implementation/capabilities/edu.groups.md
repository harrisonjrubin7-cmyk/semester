# edu.groups — Collaboration

Source-declared design contract, not current implementation proof.

routes: /app/groups, /app/groups/:id
actors: student
permissions: post.create, report.create
records: community.groups, community.members, community.posts, community.reports
commands: api.create_post, api.report
events: post.created, report.filed
screen_types: list, detail, edit

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
