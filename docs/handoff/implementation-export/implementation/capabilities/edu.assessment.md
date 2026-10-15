# edu.assessment — Assessment

Source-declared design contract, not current implementation proof.

routes: /app/assess/:id, /app/courses/:id/authoring
actors: student, instructor
permissions: attempt.create, assessment.author
records: learn.assessments, learn.assessment_attempts, learn.rubrics
commands: api.start_attempt, api.submit_attempt
events: attempt.submitted
screen_types: detail, edit, review

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
