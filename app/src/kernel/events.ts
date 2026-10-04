/**
 * What a domain says happened, to whoever cares.
 *
 * In-process only. The server-side envelope, outbox and receipts are in
 * `packages/institution/src/events.ts` (ADR 0008) and nothing here replaces
 * them: an event that must outlive the tab, reach another person or be
 * audited is written through that outbox by a gateway. This is the seam inside
 * the app — a task being completed is a fact the Today read model and the
 * streak counter can both hear without either importing the other.
 *
 * `type` follows the envelope's `domain.past_tense` pattern so that the day an
 * in-process event is promoted to an outbox event, its name does not change.
 */
export interface DomainEvent<P = Record<string, unknown>> {
  /** `<domain>.<what_happened>`, e.g. `tasks.completed`. */
  readonly type: string;
  /** When, by the injected clock. */
  readonly at: number;
  readonly payload: P;
  readonly correlationId?: string;
}

export interface EventSink {
  publish(event: DomainEvent): void;
}

/** Drops everything. The default for a caller that does not care. */
export const nullSink: EventSink = { publish: () => undefined };

/** Keeps what it is given, for a test to read back. */
export class MemorySink implements EventSink {
  readonly events: DomainEvent[] = [];
  publish(event: DomainEvent): void {
    this.events.push(event);
  }
}
