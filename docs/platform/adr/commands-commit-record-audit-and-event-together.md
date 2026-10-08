# A command commits the record, its audit row and its event together

**Status:** Accepted. Proven against in-memory repositories; **the Postgres unit of
work does not exist yet** (MIGRATION phase 3–4).

## Decision

Every write enters through `runCommand`, in a fixed order: parse → authorize →
approval gate → idempotency → **one unit of work** (handler + audit row + outbox
events) → `CommandResult`. A denial is audited, then refused. The handler receives
a `Transaction` (a `TenantScope` and `emit()`), not a database. A failure inside
the unit of work discards all three writes and releases the idempotency key.

## Why

[ADR 0008](../../architecture/0008-event-envelope-and-outbox.md) chose the
transactional outbox; this is the rule that makes it bind. The specification's
picture of what never to do — write the record, call several services, assume each
succeeded — is the shape of most notifications in this repository today. There must
be no path on which a grade is posted and nobody was told, or an audit row says
"allowed" about a write that never happened. And the audit's own question —
"which audit event proves the action?" — needs `auditEventId` in the result.

## What it was chosen over

- **Audit and events written by the caller after the handler returns:** rejected —
  a crash between the two is exactly the lost announcement.
- **Database triggers that publish:** rejected in ADR 0008 and again here — a
  trigger that fails fails the student's transaction.
- **A broker with an at-least-once producer:** deferred; the outbox is what makes
  one safe to add later.
- **`runCommand` as the way to skip the prepare → review → commit of institution
  writes:** rejected. Those become two commands (MIGRATION phase 4.3).

## How it is held

`packages/platform/src/reference/reference.test.ts` — create writes one record, one
audit row and one event; a failure after the write rolls all three back and the key
is released; a denial is in the audit log; events carry ids, not content.
`packages/platform/src/gateway/command.test.ts` — the approval gate, the
contract's result shape. The guards were mutation-checked (remove the event emit,
remove the denial audit, remove the tenant check on the outbox: each turns a test red).

## What this constrains

A domain does not write directly to its table, the audit log or the outbox from a
route. A handler that wants to call an external system does it from a consumer, with
an idempotency key of its own. Anything added to the unit of work must roll back
with it.
