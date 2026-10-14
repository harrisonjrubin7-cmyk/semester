# edu.assignments — Assignments

Source-declared design contract, not current implementation proof.

routes: /app/courses/:id/assignments/:aid
actors: student, instructor
permissions: submission.create, extension.request
records: work.assignments, learn.submissions, learn.submission_files
commands: api.submit_work, api.request_extension
events: submission.created, extension.requested
screen_types: list, detail, edit, history

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
