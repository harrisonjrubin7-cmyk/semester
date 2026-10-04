/**
 * What a domain says happened.
 *
 * A use case returns the events it caused alongside its value; it does not
 * publish them. Publishing is an adapter's job — today there is none, so events
 * are returned and dropped, which costs nothing and keeps the seam. When the
 * outbox in `packages/institution/src/events.ts` (ADR 0008) takes a producer,
 * an adapter wraps each `DomainEvent` in that envelope; no domain changes.
 *
 * Names are `<domain>.<past_tense_verb>`, matching the envelope's
 * `EVENT_TYPE_PATTERN`, so the mapping is a rename of nothing.
 */
export interface DomainEvent<T extends string = string> {
  type: T;
  /** Epoch ms from the injected clock. */
  at: number;
  /** The aggregate id the event is about. */
  subject: string;
  data?: Readonly<Record<string, string | number | boolean | null>>;
}

/** What a successful command hands back: the new value, what it caused, what it still owes. */
export interface Outcome<T, Ob extends string = string> {
  value: T;
  events: DomainEvent[];
  /** Conditions the policy attached to the permission; the caller must honour them. */
  obligations: readonly Ob[];
}
