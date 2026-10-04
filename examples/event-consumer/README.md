# Example: event consumer

> **Type:** reference · **Audience:** implementers, contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

An idempotent consumer of the Semester event envelope, for developers who add or react to events; stop reading if you want to receive events from Semester in another system, which nothing sends today.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The envelope, the catalog, `drainOutbox` and `processOnce` exist and are tested. **One producer exists and nothing runs it**: the productivity command service writes `task.*` and `calendar_event.*` events to the outbox from a SQL function, but nothing outside `app/server/productivity/` imports it and `drainOutbox` has no caller. `packages/platform`, the tenancy kernel, also builds events and checks the tenant on an outbox, over the same in-memory store, and is likewise not imported by anything that runs. This example therefore runs against the in-memory `MemoryOutbox` and `MemoryReceiptLedger`. ADR 0008 says "no producer writes to the outbox yet" ([`docs/architecture/0008-event-envelope-and-outbox.md`](../../docs/architecture/0008-event-envelope-and-outbox.md)), which was true when it was written. The test fails when a mount or a publisher appears.

## What is here

| File | Purpose |
| --- | --- |
| [`consumer.ts`](consumer.ts) | `createConsumer`, `gradeNotifier` (the first consumer of `grade.posted`), and `publishToConsumers`. |

## What it shows

- Validating an envelope before reading the payload: unknown type, wrong version, malformed id, wrong tenant and a classification below the type's floor are all refused.
- Processing an event once per consumer, and treating a redelivery as a duplicate.
- A handler that fails: the failure is recorded, the event is offered again, and the handler's own write is made safe with the event's idempotency key.
- A poison event: retried, then parked after `maxAttempts` for an operator.
- A valid event of a type the consumer does not handle: ignored, with no receipt.
- The rule for adding an event type: the type goes into `EVENT_TYPES` in the same change as its first consumer.

## Run it and read it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "event-consumer"
```

Walk-through: [Consume events](../../docs/guides/integrations/event-consumer.md).
