/**
 * The payment-rail seam: what Semester needs from any regulated rail, and what
 * every rail's events become before Semester reads them.
 *
 * Design: `docs/finance/PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md`. This file is
 * the types and the three small guards that make the design's rules
 * unrepresentable to break; it holds no provider, no I/O and no `Deno.*`, so
 * `app/src/lib/payments/` drives it under vitest.
 *
 * ## The rules the types carry
 *
 * - **No card data crosses.** No input type here has a field that can carry a
 *   card or bank account number. Collection is `createCollectionSession`
 *   (hosted page or hosted field in, token out), never "create a payment
 *   method from these digits".
 * - **Every money command carries an idempotency key** (`IdemKey`), derived
 *   from Semester's own aggregate by `idemKey`, so a retry, a replica and a
 *   replay produce the same key. A command without one is a type error.
 * - **Adapters never throw across the seam.** Every method answers `Result`.
 * - **Unknown is recorded, not guessed.** An event type the normalizer does
 *   not know becomes `other` and changes nothing.
 */

// ---------------------------------------------------------------- results --

export type PaymentErrorCode =
  | 'declined' | 'requires_action' | 'invalid_request' | 'auth_failed'
  | 'rate_limited' | 'unavailable' | 'unknown_outcome' | 'unsupported';

/** A failure, in a vocabulary that never carries input back out. */
export interface PaymentError {
  code: PaymentErrorCode;
  /** A fixed sentence for the code. Never built from a request or a response. */
  message: string;
  /** Whether sending the same command again with the same key is safe and useful. */
  retryable: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PaymentError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

const MESSAGES: Record<PaymentErrorCode, string> = {
  declined: 'The payment was declined.',
  requires_action: 'The payment needs the customer to confirm it.',
  invalid_request: 'The payment request was not valid.',
  auth_failed: 'The payment rail refused Semester’s credentials.',
  rate_limited: 'The payment rail is busy.',
  unavailable: 'The payment rail did not answer.',
  unknown_outcome: 'It is not known whether the payment went through.',
  unsupported: 'This payment rail does not support that.',
};

const RETRYABLE: ReadonlySet<PaymentErrorCode> = new Set(['rate_limited', 'unavailable', 'unknown_outcome']);

/** The one way to build a failure, so no message is ever assembled from input. */
export const fail = (code: PaymentErrorCode): Result<never> => ({
  ok: false, error: { code, message: MESSAGES[code], retryable: RETRYABLE.has(code) },
});

// ------------------------------------------------------------ idempotency --

declare const IDEM: unique symbol;
/** An idempotency key built by `idemKey`. A bare string is not one. */
export type IdemKey = string & { readonly [IDEM]: true };

export type IdemCommand = 'collect' | 'charge' | 'refund' | 'void' | 'evidence' | 'cancel';

const AGGREGATE = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * `<command>:<aggregate>:<attempt>`. The aggregate is Semester's own id (a
 * checkout, an invoice, a refund), never a provider id, so the key survives a
 * change of rail. `attempt` increments only when Semester deliberately retries
 * after a recorded decline.
 */
export function idemKey(command: IdemCommand, aggregateId: string, attempt = 1): IdemKey {
  if (!AGGREGATE.test(aggregateId)) throw new RangeError('An idempotency aggregate id is 1-80 letters, digits, - or _.');
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 999) throw new RangeError('An idempotency attempt is 1-999.');
  return `${command}:${aggregateId}:${attempt}` as IdemKey;
}

// ------------------------------------------------------------- card guard --

/**
 * Whether `text` holds a run of 13-19 digits, with the spaces and hyphens a
 * person types between groups. The same pattern as `PAN` in
 * `app/src/lib/finance/accounts.ts` and `student_account_request_no_pan` in the
 * school-ledger migration (`payments/types.test.ts` holds the three together):
 * nothing Semester stores or sends should be able to carry a card number, even
 * by accident in a note.
 */
export const CARD_NUMBER = /\d(?:[ -]?\d){12,18}/;
export function looksLikeCardNumber(text: string): boolean {
  return CARD_NUMBER.test(text);
}

// ------------------------------------------------------------------ rails --

export type RailKind =
  | 'card' | 'ach' | 'bank_transfer' | 'wire' | 'wallet' | 'invoice_terms' | 'campus_card' | 'financial_aid';

export type RailMode = 'live' | 'test';

export interface RailCapabilities {
  /** A provider-hosted page or field produces a token; Semester never sees the number. */
  hostedCollection: boolean;
  authorize: boolean;
  capture: boolean;
  refund: boolean;
  partialRefund: boolean;
  /** The provider can bill on its own schedule (billing mode A). */
  recurring: boolean;
  /** Semester can charge a stored token on its own schedule (billing mode B). */
  offSessionCharge: boolean;
  installments: boolean;
  tax: boolean;
  disputes: boolean;
  disputeEvidenceApi: boolean;
  settlementReport: boolean;
  webhookSigning: 'hmac_sha256_timestamped' | 'none';
}

export interface PaymentRail {
  /** `stripe-live`, `stripe-test`, ... */
  id: string;
  /** `^[a-z][a-z0-9_]{1,29}$`: the same check as `payment_events.provider`. */
  provider: string;
  mode: RailMode;
  status: 'draft' | 'enabled' | 'paused' | 'retired';
  kinds: readonly RailKind[];
  /** Lowercase ISO-3. */
  currencies: readonly string[];
  countries: readonly string[];
  capabilities: RailCapabilities;
  /** Facts about the rail for the console and for counsel; not switches Semester flips. */
  requiresKyc: boolean;
  requiresKyb: boolean;
  externalSettlement: boolean;
}

export const PROVIDER_ID = /^[a-z][a-z0-9_]{1,29}$/;

// ---------------------------------------------------------------- commands --

/** A provider token for a stored payment method. Opaque; never a number. */
export type PaymentToken = string & { readonly __token: true };

export interface CollectionSessionInput {
  idempotencyKey: IdemKey;
  /** Semester's checkout id. */
  checkoutId: string;
  billingAccountRef: string | null;
  returnUrl: string;
  cancelUrl: string;
}
export interface CollectionSession {
  /** A hosted page (stage 1) or a client secret for a hosted field (stage 2). */
  kind: 'hosted_page' | 'hosted_field';
  url: string | null;
  clientSecret: string | null;
  providerSessionRef: string;
}

/** Display-safe fields only: nothing here can reconstruct a card. */
export interface PaymentMethodSummary {
  token: PaymentToken;
  kind: RailKind;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  status: 'active' | 'expired' | 'detached';
}

interface MoneyCommand {
  idempotencyKey: IdemKey;
  /** Integer minor units. */
  amountCents: number;
  /** Lowercase ISO-3. */
  currency: string;
}

export interface ChargeInput extends MoneyCommand { token: PaymentToken; invoiceRef: string; }
export interface ChargeResult { paymentRef: string; status: 'captured' | 'pending' | 'requires_action'; }

export interface AuthorizeInput extends MoneyCommand { token: PaymentToken; invoiceRef: string; }
export interface AuthorizeResult { paymentRef: string; status: 'authorized' | 'requires_action'; }

export interface CaptureInput extends MoneyCommand { paymentRef: string; }
export interface CaptureResult { paymentRef: string; status: 'captured' | 'pending'; }

export interface CancelInput { idempotencyKey: IdemKey; paymentRef: string; }
export interface CancelResult { paymentRef: string; status: 'cancelled'; }

export type RefundReason =
  | 'billing_error' | 'duplicate_charge' | 'service_failure' | 'goodwill' | 'chargeback_prevention' | 'legal_requirement';
/** Never above what was captured less what was already refunded: the caller's policy check, and the adapter's second line. */
export interface RefundInput extends MoneyCommand { paymentRef: string; reason: RefundReason; }
export interface RefundResult { refundRef: string; status: 'succeeded' | 'pending'; }

export interface DisputeEvidenceInput { idempotencyKey: IdemKey; disputeRef: string; itemHashes: readonly string[]; }

export interface SettlementQuery { from: string; to: string; }
export interface SettlementLine {
  providerLineRef: string;
  kind: 'charge' | 'refund' | 'dispute' | 'dispute_reversal' | 'fee' | 'adjustment' | 'payout' | 'reserve';
  providerPaymentRef: string | null;
  grossCents: number; feeCents: number; netCents: number; occurredAt: string;
}
export interface SettlementBatch {
  providerBatchRef: string; currency: string;
  grossCents: number; feeCents: number; netCents: number; paidOutOn: string | null;
  lines: readonly SettlementLine[];
}
export interface SettlementReport { batches: readonly SettlementBatch[]; sourceSha256: string; }

// ------------------------------------------------------------------ events --

/** An inbound event whose signature, age and environment have been checked. */
export interface VerifiedProviderEvent {
  provider: string;
  eventId: string;
  type: string;
  /** ISO time the provider says the event happened. */
  occurredAt: string;
  livemode: boolean;
  /** The provider's own object, untouched; read only by `normalize`. */
  object: Record<string, unknown>;
  /** SHA-256 of the exact bytes that were verified. */
  payloadSha256: string;
}

export type VerifyOutcome =
  | { ok: true; value: VerifiedProviderEvent }
  | { ok: false; refusal: WebhookRefusal };

export type WebhookRefusal = 'missing' | 'stale' | 'mismatch' | 'not_json' | 'not_an_event' | 'wrong_environment';

export interface WebhookRequest {
  /** The body exactly as received, never re-serialized. */
  rawBody: string;
  headers: Headers;
  /** Seconds since the epoch. */
  nowSeconds: number;
}

/** An invoice's state at the moment an event reported it. */
export interface InvoiceSnapshot {
  invoiceRef: string;
  subscriptionRef: string;
  status: 'draft' | 'open' | 'paid';
  subtotalCents: number | null;
  taxCents: number | null;
  currency: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  /** Lifecycle rank so an older state never overwrites a newer one: 0 finalization failed, 1 payment failed, 2 paid. */
  rank: 0 | 1 | 2;
  amountCents: number | null;
}

interface EventBase { provider: string; eventId: string; occurredAt: string; payloadSha256: string; }

export type NormalizedPaymentEvent =
  | (EventBase & { type: 'checkout.completed'; checkoutId: string; subscriptionRef: string | null; customerRef: string | null })
  | (EventBase & {
      type: 'subscription.synced'; subscriptionRef: string;
      status: 'trialing' | 'active' | 'past_due' | 'grace' | 'canceled' | 'ended';
      periodStart: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean | null;
    })
  | (EventBase & { type: 'payment.captured'; amountCents: number | null; invoice: InvoiceSnapshot | null })
  | (EventBase & { type: 'payment.failed'; amountCents: number | null; invoice: InvoiceSnapshot | null })
  | (EventBase & { type: 'tax.location_required'; amountCents: number | null; invoice: InvoiceSnapshot | null })
  | (EventBase & { type: 'refund.succeeded'; amountCents: number | null })
  | (EventBase & { type: 'dispute.opened'; amountCents: number | null })
  | (EventBase & { type: 'other'; providerType: string; amountCents: number | null; invoice: InvoiceSnapshot | null });

export type NormalizedEventType = NormalizedPaymentEvent['type'];

// ----------------------------------------------------------------- adapter --

export interface PaymentProviderAdapter {
  readonly rail: PaymentRail;

  // Collection: no card data in, a token out.
  createCollectionSession(i: CollectionSessionInput): Promise<Result<CollectionSession>>;
  getPaymentMethod(i: { token: PaymentToken }): Promise<Result<PaymentMethodSummary>>;
  detachPaymentMethod(i: { token: PaymentToken; idempotencyKey: IdemKey }): Promise<Result<void>>;

  // Money commands. Every one carries an idempotency key.
  charge(i: ChargeInput): Promise<Result<ChargeResult>>;
  authorize(i: AuthorizeInput): Promise<Result<AuthorizeResult>>;
  capture(i: CaptureInput): Promise<Result<CaptureResult>>;
  cancel(i: CancelInput): Promise<Result<CancelResult>>;
  refund(i: RefundInput): Promise<Result<RefundResult>>;
  submitDisputeEvidence(i: DisputeEvidenceInput): Promise<Result<void>>;

  // Reads.
  getSettlement(i: SettlementQuery): Promise<Result<SettlementReport>>;

  // Inbound. `verifyWebhook` authenticates before it parses; `normalize` is pure.
  verifyWebhook(i: WebhookRequest): Promise<VerifyOutcome>;
  normalize(e: VerifiedProviderEvent): NormalizedPaymentEvent[];
}
