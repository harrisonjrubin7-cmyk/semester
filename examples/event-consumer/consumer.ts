// An idempotent consumer of the Semester event envelope. Node 22, no dependencies.
// Run through its test: cd app && npx vitest run src/lib/docs/examples.test.ts
import {
  drainOutbox,
  processOnce,
  validateEvent,
  type DrainOptions,
  type DrainReport,
  type EventType,
  type OutboxStore,
  type ProcessReport,
  type ReceiptLedger,
  type SemesterEvent,
} from '../../packages/institution/src/events.ts';

export type Handler = (event: SemesterEvent) => Promise<void> | void;
export type Delivery = ProcessReport | { outcome: 'ignored'; eventType: EventType };

export interface Consumer {
  name: string;
  deliver(raw: unknown): Promise<Delivery>;
}

/**
 * A consumer is a name, a tenant, a receipt ledger and one handler per event
 * type it cares about. Everything else is `processOnce`: it validates the
 * envelope, refuses another tenant, skips an event this consumer has already
 * processed, and records the outcome.
 */
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

/** The outside world a handler writes to. `key` is what makes its write safe to repeat. */
export interface Notifier {
  send(key: string, studentId: string, text: string): Promise<void> | void;
}

/**
 * The first consumer of `grade.posted`. The handler's own write is
 * idempotent too: the notifier is given the event's idempotency key, so a
 * retry after a failure cannot tell a student twice.
 */
export function gradeNotifier(deps: { tenant: string; ledger: ReceiptLedger; notifier: Notifier }): Consumer {
  return createConsumer({
    name: 'grade-notifier',
    tenant: deps.tenant,
    ledger: deps.ledger,
    handlers: {
      'grade.posted': async (event) => {
        const studentId = event.subject?.id;
        if (!studentId) throw new Error('grade.posted has no subject'); // recorded as failed, offered again
        const key = event.idempotencyKey ?? event.eventId;
        await deps.notifier.send(key, studentId, `A grade was posted for ${String(event.payload.assignment ?? 'an assignment')}.`);
      },
    },
  });
}

/**
 * The publisher half: one pass over the outbox, offering each pending row to
 * every consumer. A consumer that fails or refuses makes the row fail, so the
 * outbox retries it, counts the attempt, and after `maxAttempts` parks it
 * for an operator. Consumers that already succeeded see the retry as a
 * duplicate and do nothing.
 */
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
