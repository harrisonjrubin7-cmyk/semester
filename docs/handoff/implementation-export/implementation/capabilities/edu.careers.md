# edu.careers — Career development

Source-declared design contract, not current implementation proof.

routes: /app/careers
actors: student
permissions: application.submit
records: career.positions, career.applications, career.artifacts
commands: apply
events: application.submitted
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
