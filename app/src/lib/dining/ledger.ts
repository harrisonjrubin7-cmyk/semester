/**
 * The campus-card ledger: append-only, and every balance is a sum over it.
 *
 * There is no balance column anywhere — not here, not in
 * `public.dining_ledger`. A balance that is stored is a second statement of a
 * fact the entries already make, and the two can disagree; a balance that is
 * summed cannot. So an order is a debit entry, a cancellation is a credit
 * entry that names the debit it reverses, and nothing is ever edited.
 *
 * Money is integer cents, always. A fractional or non-finite amount is
 * refused rather than rounded: rounding someone's card balance is a decision,
 * and this layer does not make it.
 *
 * `appliesAt` is when an entry counts, which for a swipe is the week it is
 * charged to. A refund carries its debit's `appliesAt`, so an order placed at
 * 23:50 on the last night of a plan week and cancelled at 00:10 gives the
 * swipe back to the week it came out of — not to the new week, where it would
 * be an extra meal the plan never paid for.
 */
import { LEDGER_KEY, no, yes, type Decision } from './decision';
import type { SourceLabel } from '../source';

export const LEDGER_KINDS = ['swipe', 'dining_cents', 'campus_cents'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const LEDGER_REASONS = ['partner_sync', 'order', 'refund', 'donation', 'adjustment'] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];

export interface LedgerEntry {
  id: string;
  tenantId: string;
  studentId: string;
  term: string;
  kind: LedgerKind;
  /** Signed, integer: swipes for `swipe`, cents otherwise. Never zero. */
  delta: number;
  /** When it counts, epoch ms. */
  appliesAt: number;
  /** When it was written, epoch ms. */
  at: number;
  reason: LedgerReason;
  idempotencyKey: string;
  source: SourceLabel;
  /** The order this entry pays for or refunds. */
  orderId?: string;
}

export type Ledger = readonly LedgerEntry[];

/**
 * Campus cash is not a term's money: it stays on the card from one term to
 * the next. Its entries all sit under this one term name.
 */
export const CARD_TERM = 'card';

export interface Account {
  tenantId: string;
  studentId: string;
  term: string;
  kind: LedgerKind;
}

const sameAccount = (e: LedgerEntry, a: Account) =>
  e.tenantId === a.tenantId && e.studentId === a.studentId && e.term === a.term && e.kind === a.kind;

/** The derived balance of one account. */
export function balance(ledger: Ledger, account: Account): number {
  let sum = 0;
  for (const e of ledger) if (sameAccount(e, account)) sum += e.delta;
  return sum;
}

/** Whether two entries are the same intent, so a replay can be answered with the first. */
function sameIntent(a: LedgerEntry, b: LedgerEntry): boolean {
  return (
    a.tenantId === b.tenantId && a.studentId === b.studentId && a.term === b.term && a.kind === b.kind &&
    a.delta === b.delta && a.reason === b.reason && (a.orderId ?? null) === (b.orderId ?? null)
  );
}

export interface Appended {
  ledger: Ledger;
  entry: LedgerEntry;
  /** True when this key was already written and the first entry is returned. */
  replayed: boolean;
}

/**
 * Append one entry. A key already used by the same student at the same school
 * for the same intent returns the first entry and changes nothing; the same
 * key for a different intent is refused, never silently merged.
 *
 * Money accounts may not go below zero. Swipe accounts are checked against the
 * meal plan (`plans.ts`), which knows the allowance; the ledger alone does not.
 */
export function append(ledger: Ledger, entry: LedgerEntry): Decision<Appended> {
  if (!LEDGER_KEY.test(entry.idempotencyKey)) return no('invalid', 'The request key is not one this ledger accepts.');
  if (!Number.isSafeInteger(entry.delta) || entry.delta === 0) {
    return no('invalid', 'An entry moves a whole, non-zero number of cents or swipes.');
  }
  if (!Number.isFinite(entry.appliesAt) || !Number.isFinite(entry.at)) return no('invalid', 'An entry needs a time.');

  const prior = ledger.find(
    (e) => e.tenantId === entry.tenantId && e.studentId === entry.studentId && e.idempotencyKey === entry.idempotencyKey,
  );
  if (prior) {
    if (sameIntent(prior, entry)) return yes({ ledger, entry: prior, replayed: true }, 'Already recorded; nothing changed.');
    return no('idempotency_conflict', 'That request key was already used for something else.');
  }

  if (entry.kind !== 'swipe' && entry.delta < 0) {
    const have = balance(ledger, entry);
    if (have + entry.delta < 0) {
      return no('insufficient_funds', `That needs ${-entry.delta} cents and the balance is ${have}.`);
    }
  }

  const frozen = Object.freeze({ ...entry });
  return yes({ ledger: Object.freeze([...ledger, frozen]), entry: frozen, replayed: false }, 'Recorded.');
}

/** Entries of one account whose `appliesAt` falls in a local-date window, summed by the caller. */
export function entriesFor(ledger: Ledger, account: Account): LedgerEntry[] {
  return ledger.filter((e) => sameAccount(e, account));
}
