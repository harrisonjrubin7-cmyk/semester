# inst.catalog — Academic catalog

Source-declared design contract, not current implementation proof.

routes: /institution/catalog
actors: program_manager
permissions: catalog.edit
records: acad.courses, acad.programs, acad.requirements
commands: propose_course_change
events: catalog.changed
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
