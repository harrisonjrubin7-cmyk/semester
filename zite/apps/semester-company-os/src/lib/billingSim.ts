// Billing simulator state machines (context brief §6; design doc §4). Pure; tested in tests/billingSim.test.ts.
// Entitlements follow subscription state, never a browser "payment success" page.
// A failed payment never erases academic records; it changes entitlement state only.

export const QUOTE: Record<string, Record<string, string>> = {
  draft: { review: 'reviewed' }, reviewed: { approve: 'approved', reject: 'rejected' }, approved: { send: 'sent' },
  sent: { accept: 'accepted', reject: 'rejected', expire: 'expired' }, accepted: {}, rejected: {}, expired: {},
};
export const SUBSCRIPTION: Record<string, Record<string, string>> = {
  pending: { start_trial: 'trialing', activate: 'active', cancel: 'cancelled' },
  trialing: { activate: 'active', payment_failed: 'past_due', cancel: 'cancelled' },
  active: { payment_failed: 'past_due', cancel: 'cancelled', end: 'ended' },
  past_due: { payment_succeeded: 'active', grace_expired: 'suspended', cancel: 'cancelled' },
  suspended: { payment_succeeded: 'active', cancel: 'cancelled' },
  cancelled: {}, ended: {},
};
export const INVOICE: Record<string, Record<string, string>> = {
  draft: { issue: 'issued', void: 'voided' }, issued: { pay_partial: 'partially_paid', pay_full: 'paid', due_date_passed: 'overdue', void: 'voided', credit: 'credited' },
  partially_paid: { pay_full: 'paid', due_date_passed: 'overdue', credit: 'credited' }, overdue: { pay_full: 'paid', pay_partial: 'overdue', credit: 'credited' },
  paid: { credit: 'credited' }, voided: {}, credited: {},
};
export const PAYMENT: Record<string, Record<string, string>> = {
  created: { submit: 'pending', cancel: 'cancelled' }, pending: { succeed: 'succeeded', fail: 'failed', cancel: 'cancelled' },
  succeeded: { refund_partial: 'partially_refunded', refund_full: 'refunded' }, partially_refunded: { refund_full: 'refunded' }, failed: {}, cancelled: {}, refunded: {},
};

export type Machine = Record<string, Record<string, string>>;
export function step(machine: Machine, state: string, event: string): { ok: true; state: string } | { ok: false; state: string; error: string } {
  const next = machine[state]?.[event];
  return next ? { ok: true, state: next } : { ok: false, state, error: `“${event}” is not allowed from “${state}”.` };
}

export type Entitlement = 'pending' | 'active' | 'grace' | 'suspended' | 'revoked';
export function entitlementFor(subscription: string): Entitlement {
  return ({ pending: 'pending', trialing: 'active', active: 'active', past_due: 'grace', suspended: 'suspended', cancelled: 'revoked', ended: 'revoked' } as Record<string, Entitlement>)[subscription] ?? 'pending';
}

/** Provider event, as a verified webhook would deliver it. */
export type ProviderEvent = { id: string; type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded' | 'grace.expired' | 'subscription.cancelled'; amount?: number };
export type Ledger = { subscription: string; entitlement: Entitlement; paidMinor: number; refundedMinor: number; processed: string[]; log: string[] };

export const newLedger = (subscription = 'active'): Ledger => ({ subscription, entitlement: entitlementFor(subscription), paidMinor: 0, refundedMinor: 0, processed: [], log: [] });

/** Idempotent: an event id already processed changes nothing (duplicate webhook). Money is in integer minor units. */
export function applyEvent(l: Ledger, e: ProviderEvent): Ledger {
  if (l.processed.includes(e.id)) return { ...l, log: [...l.log, `${e.id}: duplicate ignored`] };
  const map: Record<ProviderEvent['type'], string> = { 'payment.succeeded': 'payment_succeeded', 'payment.failed': 'payment_failed', 'payment.refunded': '', 'grace.expired': 'grace_expired', 'subscription.cancelled': 'cancel' };
  let subscription = l.subscription;
  let paidMinor = l.paidMinor;
  let refundedMinor = l.refundedMinor;
  const amt = Math.round(e.amount ?? 0);
  if (!Number.isInteger(amt) || amt < 0) return { ...l, log: [...l.log, `${e.id}: rejected, bad amount`] };
  if (e.type === 'payment.succeeded') paidMinor += amt;
  if (e.type === 'payment.refunded') {
    if (refundedMinor + amt > paidMinor) return { ...l, log: [...l.log, `${e.id}: rejected, refund exceeds payments`] };
    refundedMinor += amt;
  }
  const ev = map[e.type];
  let note = '';
  if (ev) {
    const r = step(SUBSCRIPTION, subscription, ev);
    if (r.ok) subscription = r.state; else note = ` (subscription unchanged: ${r.error})`;
  }
  return { subscription, entitlement: entitlementFor(subscription), paidMinor, refundedMinor, processed: [...l.processed, e.id], log: [...l.log, `${e.id}: ${e.type} → subscription ${subscription}, entitlement ${entitlementFor(subscription)}${note}`] };
}

/** The five scenarios the brief asks the simulator to demonstrate. */
export const SCENARIOS: { name: string; start: string; events: ProviderEvent[] }[] = [
  { name: 'Duplicate webhook', start: 'active', events: [{ id: 'evt_1', type: 'payment.succeeded', amount: 250000 }, { id: 'evt_1', type: 'payment.succeeded', amount: 250000 }] },
  { name: 'Failed payment and grace period', start: 'active', events: [{ id: 'evt_2', type: 'payment.failed' }, { id: 'evt_3', type: 'grace.expired' }] },
  { name: 'Recovery during grace', start: 'active', events: [{ id: 'evt_4', type: 'payment.failed' }, { id: 'evt_5', type: 'payment.succeeded', amount: 250000 }] },
  { name: 'Refund', start: 'active', events: [{ id: 'evt_6', type: 'payment.succeeded', amount: 250000 }, { id: 'evt_7', type: 'payment.refunded', amount: 50000 }, { id: 'evt_8', type: 'payment.refunded', amount: 999999 }] },
  { name: 'Cancellation', start: 'active', events: [{ id: 'evt_9', type: 'subscription.cancelled' }, { id: 'evt_10', type: 'payment.succeeded', amount: 1000 }] },
];
export const runScenario = (s: (typeof SCENARIOS)[number]) => s.events.reduce(applyEvent, newLedger(s.start));
