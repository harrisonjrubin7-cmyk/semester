/**
 * Paying a student account through a payment provider, behind an adapter.
 *
 * This is kept apart from Semester's own commercial billing
 * (`supabase/functions/_shared/billingwebhook.ts`, `public.payment_events`):
 * that is Semester selling Plus, this is a school collecting tuition, and the
 * two must never share a table, a key or a webhook secret. What is reused is
 * the shape that one proved — verify the signature over the raw body before
 * reading anything, keep the provider's event id as the idempotency key, keep
 * a hash of the body and never the body, and answer a replay with nothing.
 *
 * ## The adapter
 *
 * `PaymentProvider` is what a real provider implements: it verifies a
 * webhook and opens a hosted payment page. Semester never sees a card number
 * or a bank account; the provider's page takes them. No provider is wired to
 * this yet — the interface, the rules below and a test double are what exist.
 *
 * ## What an event may do, in any order
 *
 * Providers deliver at least once and in no promised order. So:
 *
 * - the same event id twice is `duplicate`, and the same id with a different
 *   body is `replay_conflict`, recorded once and never applied twice;
 * - two different events for the same payment (a provider that reports both
 *   the intent and the charge) post one ledger entry, because the ledger key
 *   is the provider's payment id, not the event id;
 * - a failure after a success is `ignored_after_success`: a late "failed" for
 *   an attempt that was retried and succeeded does not un-pay anything;
 * - a refund before its payment is `waiting_for_payment`, and is applied when
 *   the payment arrives, as `posted_and_reversed`;
 * - an amount or currency that is not what the student started is not posted
 *   at all (`amount_mismatch`, `currency_mismatch`), and a payment for an
 *   intent nobody holds is `unknown_intent`. Each is recorded so a bursar can
 *   reconcile it; none is guessed at.
 *
 * Events are applied even when the module has been switched off since the
 * payment started. The money moved at the provider; refusing to record it
 * would lose it, not stop it.
 */

import type { Ctx, Done, Refusal } from './actions';
import { reversedCents, type Entry, type EventKind, type Intent, type Receipt, type StudentAccount } from './ledger';

export interface ProviderEvent {
  provider: string;
  eventId: string;
  kind: EventKind;
  /** Semester's intent id, which the provider carries back as its reference. */
  intentId: string;
  providerPaymentId: string;
  cents: number;
  currency: string;
  /** Epoch ms, as the provider says. Recorded; never used to order anything. */
  occurredAt: number;
  payloadSha256: string;
}

export type Verified = { ok: true; event: ProviderEvent } | { ok: false; reason: string };

export interface PaymentProvider {
  readonly name: string;
  /** Check the signature over the raw body, then parse. A parsed body is never trusted on its own. */
  verify(rawBody: string, headers: Readonly<Record<string, string>>, nowSeconds: number): Verified | Promise<Verified>;
  /** Open the provider's hosted page for an intent. Returns where to send the student. */
  checkout(intent: Intent, who: { tenantId: string; studentId: string }): Promise<{ url: string; providerPaymentId: string }>;
}

export type ApplyOutcome =
  | 'duplicate'
  | 'replay_conflict'
  | 'unknown_intent'
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'posted'
  | 'already_posted'
  | 'failed'
  | 'ignored_after_success'
  | 'waiting_for_payment'
  | 'reversed'
  | 'posted_and_reversed';

export const APPLY_OUTCOMES: readonly ApplyOutcome[] = [
  'duplicate', 'replay_conflict', 'unknown_intent', 'currency_mismatch', 'amount_mismatch', 'posted',
  'already_posted', 'failed', 'ignored_after_success', 'waiting_for_payment', 'reversed', 'posted_and_reversed',
];

export interface Applied {
  outcome: ApplyOutcome;
  receipt: Receipt | null;
}

/** The ledger key for a provider payment: one entry per payment, however many events report it. */
export const paymentKey = (provider: string, providerPaymentId: string) => `provider:${provider}:${providerPaymentId}`;
export const refundKey = (provider: string, eventId: string) => `provider:${provider}:refund:${eventId}`;

const REASONS: Record<ApplyOutcome, string> = {
  duplicate: 'That event was already applied; nothing changed.',
  replay_conflict: 'An event with that id arrived before with a different body. The first is kept; this one is not applied.',
  unknown_intent: 'No payment was started with that reference. Recorded for the bursar to reconcile.',
  currency_mismatch: 'The currency is not the one the payment was started in. Not posted; recorded for the bursar.',
  amount_mismatch: 'The amount is not the one the payment was started for. Not posted; recorded for the bursar.',
  posted: 'Payment posted to the account.',
  already_posted: 'That payment is already on the account under another event; not posted twice.',
  failed: 'The attempt failed. Nothing was posted.',
  ignored_after_success: 'A failure arrived after the payment succeeded; the payment stands.',
  waiting_for_payment: 'A refund arrived before its payment. It is held and applied when the payment arrives.',
  reversed: 'The provider refunded the payment; the payment is reversed on the account.',
  posted_and_reversed: 'Payment posted, and the refund that arrived before it applied.',
};

function withReceipt(account: StudentAccount, event: ProviderEvent, outcome: ApplyOutcome): { account: StudentAccount; applied: Applied } {
  const receipt: Receipt = {
    provider: event.provider, eventId: event.eventId, kind: event.kind, intentId: event.intentId,
    cents: event.cents, payloadSha256: event.payloadSha256, occurredAt: event.occurredAt, outcome,
  };
  return { account: { ...account, receipts: [...account.receipts, receipt] }, applied: { outcome, receipt } };
}

function done(account: StudentAccount, applied: Applied): Done<Applied> {
  const dup = applied.outcome === 'duplicate' || applied.outcome === 'replay_conflict';
  return { ok: true, code: dup ? 'duplicate' : 'done', reason: REASONS[applied.outcome], account, value: applied };
}

function setIntent(account: StudentAccount, id: string, patch: Partial<Intent>): StudentAccount {
  return { ...account, intents: account.intents.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

function addEntry(account: StudentAccount, ctx: Ctx, want: Omit<Entry, 'id' | 'at'>): { account: StudentAccount; entry: Entry; fresh: boolean } {
  const prior = account.entries.find((e) => e.key === want.key);
  if (prior) return { account, entry: prior, fresh: false };
  const entry: Entry = { ...want, id: ctx.newId(), at: ctx.now.getTime() };
  return { account: { ...account, entries: [...account.entries, entry] }, entry, fresh: true };
}

/** Apply a refund to a posted payment, or say why not. */
function refund(account: StudentAccount, ctx: Ctx, event: ProviderEvent, payment: Entry): { account: StudentAccount; ok: boolean } {
  const left = payment.cents - reversedCents(payment, account.entries);
  const key = refundKey(event.provider, event.eventId);
  if (!account.entries.some((e) => e.key === key) && event.cents > left) return { account, ok: false };
  const r = addEntry(account, ctx, {
    term: payment.term, kind: 'reversal', cents: event.cents, what: 'Refunded by the payment provider', key,
    source: 'provider', reverses: payment.id,
  });
  const fully = reversedCents(payment, r.account.entries) >= payment.cents;
  return { account: fully ? setIntent(r.account, event.intentId, { status: 'refunded' }) : r.account, ok: true };
}

/**
 * Apply one verified provider event. Only the provider path calls this, and
 * only after `PaymentProvider.verify` has passed.
 */
export function applyProviderEvent(account: StudentAccount, event: ProviderEvent, ctx: Ctx): Done<Applied> | Refusal {
  if (ctx.actor !== 'provider') return { ok: false, code: 'forbidden', reason: 'Provider events come from the verified webhook only.' };
  if (!/^[0-9a-f]{64}$/.test(event.payloadSha256) || !event.eventId || !event.provider) {
    return { ok: false, code: 'invalid', reason: 'An event needs a provider, an id and the hash of its body.' };
  }
  if (!Number.isSafeInteger(event.cents) || event.cents <= 0) return { ok: false, code: 'invalid', reason: 'An event amount is a whole, positive number of cents.' };

  const seen = account.receipts.find((r) => r.provider === event.provider && r.eventId === event.eventId);
  if (seen) return done(account, { outcome: seen.payloadSha256 === event.payloadSha256 ? 'duplicate' : 'replay_conflict', receipt: seen });

  const intent = account.intents.find((i) => i.id === event.intentId);
  if (!intent) {
    const r = withReceipt(account, event, 'unknown_intent');
    return done(r.account, r.applied);
  }
  if (event.currency.toLowerCase() !== intent.currency) {
    const r = withReceipt(account, event, 'currency_mismatch');
    return done(r.account, r.applied);
  }

  const key = paymentKey(event.provider, event.providerPaymentId);
  const payment = account.entries.find((e) => e.key === key);

  if (event.kind === 'payment_failed') {
    if (intent.status === 'paid' || intent.status === 'refunded' || payment) {
      const r = withReceipt(account, event, 'ignored_after_success');
      return done(r.account, r.applied);
    }
    const r = withReceipt(setIntent(account, intent.id, { status: 'failed', providerPaymentId: event.providerPaymentId }), event, 'failed');
    return done(r.account, r.applied);
  }

  if (event.kind === 'payment_refunded') {
    if (!payment) {
      const r = withReceipt(account, event, 'waiting_for_payment');
      return done(r.account, r.applied);
    }
    const back = refund(account, ctx, event, payment);
    const r = withReceipt(back.account, event, back.ok ? 'reversed' : 'amount_mismatch');
    return done(r.account, r.applied);
  }

  // payment_succeeded
  if (event.cents !== intent.cents) {
    const r = withReceipt(account, event, 'amount_mismatch');
    return done(r.account, r.applied);
  }
  const posted = addEntry(account, ctx, {
    term: intent.term, kind: 'payment', cents: event.cents, what: `Payment through ${event.provider}`, key, source: 'provider',
  });
  let next = setIntent(posted.account, intent.id, { status: 'paid', providerPaymentId: event.providerPaymentId });
  let outcome: ApplyOutcome = posted.fresh ? 'posted' : 'already_posted';
  const waiting = account.receipts.filter((r) => r.intentId === intent.id && r.kind === 'payment_refunded' && r.outcome === 'waiting_for_payment');
  for (const w of waiting) {
    const back = refund(next, ctx, { ...event, eventId: w.eventId, kind: 'payment_refunded', cents: w.cents }, posted.entry);
    next = back.account;
    if (back.ok && posted.fresh) outcome = 'posted_and_reversed';
  }
  const r = withReceipt(next, event, outcome);
  return done(r.account, r.applied);
}
