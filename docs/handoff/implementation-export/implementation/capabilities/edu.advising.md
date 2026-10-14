# edu.advising — Advising

Source-declared design contract, not current implementation proof.

routes: /app/advising
actors: student, advisor
permissions: appointment.book, note.write
records: acad.advising_assignments, acad.advising_slots, acad.advising_notes
commands: api.book_advising
events: advising.booked
screen_types: overview, detail, edit, history

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
