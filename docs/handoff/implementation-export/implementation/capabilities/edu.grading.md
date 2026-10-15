# edu.grading — Grading

Source-declared design contract, not current implementation proof.

routes: /app/courses/:id/gradebook
actors: instructor, ta
permissions: grade.provisional, grade.approve
records: work.grades, learn.grade_entries, learn.grade_revisions, learn.feedback
commands: api.record_grade, api.submit_grades_for_approval
events: grades.submitted
screen_types: list, detail, review, history

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
