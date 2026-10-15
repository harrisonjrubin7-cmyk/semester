# edu.degree — Degree planning

Source-declared design contract, not current implementation proof.

routes: /app/degree
actors: student, advisor
permissions: plan.edit
records: acad.requirements, acad.programs, acad.degree_evaluations
commands: run_scenario
events: 
screen_types: overview, detail, edit

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
