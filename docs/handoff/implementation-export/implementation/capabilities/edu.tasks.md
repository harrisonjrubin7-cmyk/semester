# edu.tasks — Tasks and planning

Source-declared design contract, not current implementation proof.

routes: /app/tasks, /app/planner
actors: student
permissions: task.edit
records: work.tasks
commands: create_task, complete_task
events: task.completed
screen_types: list, edit

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
