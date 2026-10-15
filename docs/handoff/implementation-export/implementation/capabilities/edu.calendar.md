# edu.calendar — Calendar

Source-declared design contract, not current implementation proof.

routes: /app/calendar
actors: student
permissions: calendar.edit
records: comms.calendar_events, acad.advising_slots, work.assignments
commands: create_event
events: event.created
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
