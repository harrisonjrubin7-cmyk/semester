# Consume events

> **Type:** how-to · **Audience:** implementers, contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

This page walks through an idempotent consumer of the Semester event envelope and the rule for adding an event type; stop reading if you want Semester to send events to your own system, because nothing sends them today.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The envelope, the catalog, `drainOutbox` and `processOnce` are built and tested. **One producer exists in the repository and one route can run it, but only when a deployment switches it on.** The productivity command service (`app/server/productivity/service.ts`) builds `task.*` and `calendar_event.*` events, and a SQL function in `supabase/migrations/20261004123000_productivity_commands.sql` writes them to `private.domain_outbox_events` in the command's transaction. One route, `app/api/productivity/[...path].ts`, imports that service, and it answers only when a deployment sets `SEMESTER_PRODUCTIVITY=on`; it is off by default. `drainOutbox` has no caller, so nothing publishes what it writes. ADR 0008 says "no producer writes to the outbox yet", which was true when it was written. `packages/platform`, the tenancy kernel, also builds events (`eventFromContext`) and checks the tenant on an outbox (`TenantOutbox`), over the same in-memory store; only build configuration names it outside its own folder. Everything on this page runs against `MemoryOutbox` and `MemoryReceiptLedger`, in memory. `app/src/lib/docs/examples.test.ts` scans the code and fails when anything other than that route mounts the producer, when that route stops checking the switch, or when something calls `drainOutbox`, so this page gets revisited in the same change.

The code is [`examples/event-consumer/consumer.ts`](../../../examples/event-consumer/consumer.ts). Every code block below is copied from the repository byte for byte and held by the test. The decision is [ADR 0008](../../architecture/0008-event-envelope-and-outbox.md). The event catalogue reference is [`docs/reference/EVENTS.md`](../../reference/EVENTS.md).

## 1. Know the envelope

An event is a `SemesterEvent`. The type comes from the catalog, and so do the version, the classification floor and the retention class. The producer supplies the rest.

<!-- from: packages/institution/src/events.ts -->
```ts
export interface SemesterEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  eventVersion: number;
  occurredAt: string;
  producer: string;
  environment: PolicyEnvironment;
  tenantId?: string;
  customerAccountId?: string;
  actor?: { id: string; type: ActorType };
  subject?: { type: string; id: string };
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  dataClassification: ResourceClassification;
  retentionClass: RetentionClass;
  payload: T;
}
```

## 2. Validate before you read the payload

`validateEvent` is the first line of every consumer. It refuses what it should not guess about. The test sends each of these and reads the reason:

| Sent | Refused with |
| --- | --- |
| A type not in the catalog | `unknown event type "advising.appointment_booked"` |
| `grade.posted` at version 2 | `grade.posted is version 1, not 2` |
| An `eventId` that is not a UUID | `eventId is not a UUID` |
| `grade.posted` labelled `public` | `grade.posted is at least education_record` |
| Something that is not an object | `not an object` |
| An event for another tenant | `event is for another tenant` (from `processOnce`, when you pass the tenant) |

A classification may be raised above the type's floor, never lowered. Unknown optional fields inside the payload pass through; unknown event types do not.

This is what a consumer prints for a version it does not know:

<!-- output: event-consumer/refused -->
```json
{
  "outcome": "refused",
  "reason": "grade.posted is version 1, not 2"
}
```

## 3. Build the consumer

`processOnce` does the work in a fixed order: refuse what does not validate, refuse another tenant, skip what this consumer has processed before, run the handler, record the outcome. The example adds one decision of its own: a valid event of a type this consumer does not handle is ignored, with no receipt.

<!-- from: examples/event-consumer/consumer.ts -->
```ts
export function createConsumer(options: {
  name: string;
  tenant: string;
  ledger: ReceiptLedger;
  handlers: Partial<Record<EventType, Handler>>;
}): Consumer {
  return {
    name: options.name,
    async deliver(raw) {
      // A valid event of a type this consumer does not handle is not an error and leaves no receipt.
      const verdict = validateEvent(raw);
      const handler = verdict.ok ? options.handlers[verdict.event.eventType] : undefined;
      if (verdict.ok && !handler) return { outcome: 'ignored', eventType: verdict.event.eventType };
      return processOnce(options.ledger, options.name, raw, handler ?? (() => {}), options.tenant);
    },
  };
}
```

The outcomes are `processed`, `duplicate` (with the earlier outcome), `refused` (with a reason), `failed` (with an error message) and the example's `ignored`.

## 4. Make the handler's own write idempotent

Delivery is at least once, so every consumer eventually sees an event twice. The ledger covers the second delivery. It does not cover a handler that wrote to an outside system and then failed, or crashed before the receipt was written: the receipt is recorded after the handler returns, so that event is offered again and the handler runs again.

So give the outside system a key it can dedupe on. The event carries one:

<!-- from: examples/event-consumer/consumer.ts -->
```ts
      'grade.posted': async (event) => {
        const studentId = event.subject?.id;
        if (!studentId) throw new Error('grade.posted has no subject'); // recorded as failed, offered again
        const key = event.idempotencyKey ?? event.eventId;
        await deps.notifier.send(key, studentId, `A grade was posted for ${String(event.payload.assignment ?? 'an assignment')}.`);
      },
```

In the test the mail service is down for the first pass and up for the second. The handler runs four times for two events, and each student gets one message, because the notifier dedupes on the key.

## 5. Drain the outbox, retry, dead-letter

The publisher half offers each pending row to every consumer. If any consumer fails or refuses, the row fails.

<!-- from: examples/event-consumer/consumer.ts -->
```ts
export function publishToConsumers(outbox: OutboxStore, consumers: Consumer[], options?: DrainOptions): Promise<DrainReport> {
  return drainOutbox(
    outbox,
    async (event) => {
      for (const consumer of consumers) {
        const result = await consumer.deliver(event);
        if (result.outcome === 'failed') throw new Error(`${consumer.name} failed: ${result.error}`);
        if (result.outcome === 'refused') throw new Error(`${consumer.name} refused: ${result.reason}`);
      }
    },
    options,
  );
}
```

`drainOutbox` does the bookkeeping. A throw is recorded on the row with its attempt count. The default is 5 attempts (`maxAttempts`) and 100 rows per pass (`batch`). After the last attempt the row is parked with `deadLetteredAt` for an operator and is never offered again. The error kept is the message only, cut to 500 characters, never the payload.

A row whose first pass fails and whose second succeeds. The consumers that already succeeded see the retry as a duplicate:

<!-- output: event-consumer/drain -->
```json
[
  {
    "published": 0,
    "failed": 1,
    "deadLettered": 0
  },
  {
    "published": 1,
    "failed": 0,
    "deadLettered": 0
  },
  {
    "published": 0,
    "failed": 0,
    "deadLettered": 0
  }
]
```

A poison event, one no consumer will ever accept, is the other case. With `maxAttempts: 3` the test shows it failing on passes one and two, parked on pass three with the last reason as `lastError`, and absent from pass four. A good event in the same batch is delivered once.

## 6. Add an event type and its first consumer

ADR 0008 states the rule:

<!-- from: docs/architecture/0008-event-envelope-and-outbox.md -->
```md
A producer adds its type to `EVENT_TYPES` in the same change as its first
consumer. A consumer is idempotent, verifies the tenant, records a receipt,
and never writes to an external system without an idempotency key of its
own. A retention sweep for both tables is owed before any producer writes to
them in production; `RETENTION.md` says so.
```

The catalog says the same where you edit it:

<!-- from: packages/institution/src/events.ts -->
```ts
 * classification and retention class its payload is held to. A consumer that
 * receives a type not in this list refuses it; a producer that wants a new
 * one adds it here, in the same change as the first consumer.
```

A catalog row is one line. This is how `grade.posted` is declared:

<!-- from: packages/institution/src/events.ts -->
```ts
  'grade.posted': spec(1, 'education_record', 'student_record'),
```

To add a type, in one change:

1. Add a row to `EVENT_TYPES` in `packages/institution/src/events.ts`: the name as `<domain>.<name>` in lowercase with underscores, the version `1`, the lowest classification the payload may carry, and a retention class. `events.test.ts` holds the name shape equal to the database constraint.
2. Write the consumer's handler, as in section 4, and its tests: a valid event, a redelivery, a wrong version, another tenant.
3. Use `makeEvent` to build events in the producer's tests. It stamps version, classification and retention from the catalog, so they cannot be stamped wrong.
4. Do not mount a producer in production yet. The ADR owes a retention sweep for both tables first. The one producer that exists, the productivity command service, is the pattern to follow: it builds events with `makeEvent` and hands them to a SQL function that writes them in the command's transaction.

The example's test shows step 1 from the other side: `advising.appointment_booked` is refused today as an unknown type, and stays refused until a row for it lands.

## Try it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "event-consumer"
```

## Next

- [ADR 0008](../../architecture/0008-event-envelope-and-outbox.md) for why the envelope and the outbox are shaped this way.
- [`docs/reference/EVENTS.md`](../../reference/EVENTS.md) for the catalogue.
- [Which integration path do I want?](which-integration-path.md)
