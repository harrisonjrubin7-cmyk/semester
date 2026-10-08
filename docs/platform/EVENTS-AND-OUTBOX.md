# Event schema and the outbox pattern

The envelope, the type catalogue, the outbox tables and the consumer rule are
**already on main** in `packages/institution/src/events.ts`
([ADR 0008](../architecture/0008-event-envelope-and-outbox.md)). This page does
not restate them; it records what the platform adds and the rules for producers
and consumers that the audit's service contract requires.

## The envelope (existing)

`SemesterEvent`: `eventId` (UUID), `eventType` + `eventVersion` from the
`EVENT_TYPES` catalogue, `occurredAt`, `producer`, `environment`, `tenantId`,
`customerAccountId?`, `actor`, `subject`, `correlationId`, `causationId?`,
`idempotencyKey?`, `dataClassification` (may be raised above the type's floor,
never lowered), `retentionClass`, `payload`.

## What the platform adds

1. **`eventFromContext(ctx, draft, deps)`** stamps tenant, actor, correlation id,
   idempotency key and environment from the `RequestContext`. A producer supplies
   only what it alone knows (type, subject, payload); it cannot label an event with
   a tenant it is not acting for.
2. **`TenantOutbox`** is bound to one tenant for the life of a transaction and
   refuses an append whose event carries a different tenant, or that fails
   `validateEvent`. `transactionFor(ctx, …)` hands this to every command handler as
   `tx.emit()`.
3. **The write is the unit of work.** `runCommand` writes the record, the audit row
   and the outbox events in **one transaction** (`gateway/command.ts`). There is no
   path on which a grade is posted and nobody was told, or an audit row says
   "allowed" about a write that never happened. A handler failure discards all
   three (proven by `reference.test.ts`).
4. **`consumeForTenant`** and **`drainPartition`**: a consumer that serves one
   tenant's partition validates the envelope, refuses an event for another tenant
   (`wrong_tenant`), skips what it has processed (receipt ledger), and runs the
   handler. A wrong-tenant or malformed message is **dead-lettered with the
   reason, never handled**.
5. **`MemoryTenantQueue`** shows the shape: partitioned by tenant, producing into
   the wrong partition refused at the source.

## Rules

**Producers**

- Add the type to `EVENT_TYPES` **in the same change as its first consumer** (the
  catalogue refuses an unknown type).
- Payloads carry **ids, not content**. The consumer loads the record through its
  own tenant scope. A leaked queue message then discloses nothing. (`reference/
  tasks.ts` shows this: the event has `taskId`; the title is fetched by the indexer.)
- Never publish from outside the unit of work that made the thing true.
- Raise `dataClassification` when the payload is more sensitive than the type's
  floor; never lower it.

**Consumers**

- Idempotent: at-least-once is the only delivery there is. The receipt ledger makes
  a second delivery a no-op; a handler's external writes must be idempotent in
  their own right (keyed on the event's `idempotencyKey`) or not made from a
  consumer.
- Verify the tenant on the way **out** of the queue.
- Never write to an external system without an idempotency key of your own.
- A failing handler is recorded as failed and offered the event again; after the
  publisher's attempt limit the row is parked for an operator
  ([`OPERATIONS.md`](OPERATIONS.md) → dead letters).

## Event taxonomy (from the audit's service contract)

| Category | Examples | Retention class |
| --- | --- | --- |
| Domain | course enrolled, task completed, submission created, grade posted | per domain (`student_record` / `operational`) |
| Audit | role changed, grade amended, support access granted, data exported | `audit` — also the hash-chained `platform.audit_event` |
| Security | login failed, MFA enrolled, suspicious session, abuse blocked | `audit` |
| Integration | sync began, mapping failed, reconciliation discrepancy | `operational` / `audit` |
| AI | retrieval, policy decision, model invoked, override applied | `audit` / `operational` |
| Product analytics | feature used, funnel progressed | privacy-minimised aggregates only |
| Operational | deployment, alert, rollback, incident state | `operational` |

The catalogue in `events.ts` holds the domain, audit/security, integration and AI types; analytics events go through
`TenantAnalytics` (pseudonymised, redacted) rather than the domain outbox, and
operational events are the incident tooling's.

## Audit rows are not events, and not duplicated

The audit row says *who did what to what, with what outcome and under which
policy*; the event says *a thing became true, tell the others*. Both are written
in the same transaction; they share the correlation id and the idempotency key,
which is how "which audit row proves this event" is answered.

## Not done

- The production-gated productivity command path and the tenant feature-policy
  trigger write bounded events. One manually invoked projector endpoint can
  apply `entitlement.changed` in batches of at most 25, but it is dormant
  without its dedicated secret and has no scheduler. No publisher runs.
- A **retention sweep** for `private.domain_outbox_events` and
  `domain_event_receipts` is owed before any producer writes to them in
  production (`RETENTION.md`).
- No broker. The outbox is what makes one safe to add; revisit at the first tenant
  whose event rate makes polling the bottleneck, **with the measurement**.
