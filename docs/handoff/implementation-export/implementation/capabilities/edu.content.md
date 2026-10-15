# edu.content — Learning content

Source-declared design contract, not current implementation proof.

routes: /app/courses/:id/content
actors: student, instructor, course_designer
permissions: content.read, content.publish
records: learn.modules, learn.content_items, comms.files
commands: api.publish_module
events: module.published
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
