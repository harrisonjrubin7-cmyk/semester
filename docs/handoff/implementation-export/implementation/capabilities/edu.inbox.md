# edu.inbox — Communications

Source-declared design contract, not current implementation proof.

routes: /app/inbox, /app/inbox/:thread
actors: student, instructor, advisor
permissions: message.send
records: comms.threads, comms.participants, comms.messages
commands: api.send_message
events: message.sent
screen_types: list, detail

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
