/**
 * The institution's student account: one ledger per student per term.
 *
 * This is not `lib/bill.ts`. That file reads a statement the *student* types
 * in, and holds four rules about reading one. This is the statement itself, as
 * a bursar and a financial-aid office keep it — and the same four rules hold
 * here, because they are rules about money rather than about who typed it:
 *
 * 1. **Work-study never covers the bill.** An award whose kind does not credit
 *    the statement (`aidKindOf(kind).credits`, the one flag `bill.ts` keeps for
 *    exactly this) cannot be disbursed to the ledger at all — `actions.ts`
 *    refuses it — and is reported beside the balance, never subtracted from it.
 * 2. **Anticipated aid is not money.** An accepted award that has not been
 *    disbursed is shown as anticipated, in its own figure. The balance is the
 *    posted entries and nothing else.
 * 3. **A loan is aid and debt.** `borrowedCents` says how much of what was
 *    disbursed is borrowed.
 * 4. **Instalments add up.** Payment plans are divided by `bill.ts`'s own
 *    `split`, so five instalments of a balance close it to the cent.
 *
 * ## Append-only, and the balance is derived
 *
 * An entry is never edited or deleted. A wrong entry is answered by a
 * `reversal` entry naming it, which carries the opposite sign; the history of
 * what was posted and when always has an answer. The balance is never stored
 * anywhere — not here, not in the database — so it cannot disagree with the
 * entries it is the sum of.
 *
 * ## Signs
 *
 * Every entry holds a positive number of cents; its kind gives the sign.
 * Positive balance is owed by the student; negative is a credit balance the
 * school owes back. A charge raises it; a credit, an aid disbursement and a
 * payment lower it; a refund of a credit balance raises it back toward zero,
 * because the money has left the account.
 *
 * ## What Semester never decides
 *
 * Eligibility and amounts. An award's amount, its verification status and the
 * student's satisfactory-academic-progress standing arrive from the
 * institution's own aid system through an adapter. Semester records what it is
 * told, refuses to record things that contradict what it was told, and shows
 * the result. It computes no award, and no function here takes a need, an
 * income or a grade.
 */

import { AID_KINDS, aidKindOf, nextDue, schedule, type AidKind, type Instalment, type Next, type Payment } from '../bill';

export type EntryKind = 'charge' | 'credit' | 'aid_disbursement' | 'payment' | 'refund' | 'reversal';

export const ENTRY_KINDS: readonly EntryKind[] = ['charge', 'credit', 'aid_disbursement', 'payment', 'refund', 'reversal'];

/** Who posted an entry: a person at an office, the aid adapter, or the payment provider. */
export type EntrySource = 'bursar' | 'aid_office' | 'aid_adapter' | 'provider';

export interface Entry {
  id: string;
  term: string;
  kind: EntryKind;
  /** Positive integer cents. The kind carries the sign. */
  cents: number;
  what: string;
  /** Idempotency key: the same key never posts twice. */
  key: string;
  source: EntrySource;
  /** The award a disbursement is against. */
  awardId?: string;
  /** The entry a reversal answers. */
  reverses?: string;
  /** Epoch ms. */
  at: number;
}

export type AwardStatus = 'offered' | 'accepted' | 'declined' | 'cancelled';
export const AWARD_STATUSES: readonly AwardStatus[] = ['offered', 'accepted', 'declined', 'cancelled'];

/** As the institution's system reports it. `pending` holds disbursement. */
export type Verification = 'not_selected' | 'pending' | 'complete';
export const VERIFICATIONS: readonly Verification[] = ['not_selected', 'pending', 'complete'];

/**
 * Satisfactory academic progress, as the institution's system reports it.
 * `warning` still disburses (a warning term is a federal concept that does);
 * `not_meeting` does not; `unknown` is "not yet reported" and does not either.
 */
export type Sap = 'meeting' | 'warning' | 'not_meeting' | 'unknown';
export const SAPS: readonly Sap[] = ['meeting', 'warning', 'not_meeting', 'unknown'];

export const AWARD_KINDS: readonly AidKind[] = AID_KINDS.map((k) => k.id);

export interface Award {
  id: string;
  term: string;
  /** The institution's own id for the award. The adapter's key. */
  externalRef: string;
  kind: AidKind;
  what: string;
  /** Decided by the institution. Semester never computes it. */
  offeredCents: number;
  status: AwardStatus;
  verification: Verification;
  sap: Sap;
  /**
   * The source's own version of this record. An adapter sync carrying a lower
   * version than the one held is older news arriving late, and is ignored.
   */
  sourceVersion: number;
  decidedAt?: number;
}

export interface Hold {
  id: string;
  /** The bursar's words. Readable by the student and the bursar; never by another office. */
  reason: string;
  balanceCents: number;
  thresholdCents: number;
  placedAt: number;
  releasedAt?: number;
  releaseReason?: string;
}

export interface Plan {
  id: string;
  term: string;
  /** The term balance when the plan was made. */
  totalCents: number;
  parts: number;
  /** ISO date of the first instalment. */
  first: string;
  everyMonths: number;
  key: string;
  createdAt: number;
  cancelledAt?: number;
}

export type IntentStatus = 'open' | 'paid' | 'failed' | 'refunded';

/** A payment the student started. The provider's events settle it. */
export interface Intent {
  id: string;
  term: string;
  cents: number;
  currency: 'usd';
  key: string;
  status: IntentStatus;
  providerPaymentId?: string;
  createdAt: number;
}

export type EventKind = 'payment_succeeded' | 'payment_failed' | 'payment_refunded';
export const EVENT_KINDS: readonly EventKind[] = ['payment_succeeded', 'payment_failed', 'payment_refunded'];

/** A provider event as recorded: never the raw body, only its hash. */
export interface Receipt {
  provider: string;
  eventId: string;
  kind: EventKind;
  intentId: string;
  cents: number;
  payloadSha256: string;
  occurredAt: number;
  outcome: string;
}

export interface StudentAccount {
  tenantId: string;
  studentId: string;
  entries: readonly Entry[];
  awards: readonly Award[];
  holds: readonly Hold[];
  plans: readonly Plan[];
  intents: readonly Intent[];
  receipts: readonly Receipt[];
}

export function emptyAccount(tenantId: string, studentId: string): StudentAccount {
  return { tenantId, studentId, entries: [], awards: [], holds: [], plans: [], intents: [], receipts: [] };
}

const BASE_SIGN: Record<Exclude<EntryKind, 'reversal'>, 1 | -1> = {
  charge: 1,
  refund: 1,
  credit: -1,
  aid_disbursement: -1,
  payment: -1,
};

/**
 * What an entry does to the balance, in signed cents.
 *
 * A reversal is the opposite of the entry it names. A reversal naming nothing
 * held — which `actions.ts` never posts — counts as nothing rather than
 * guessing a sign.
 */
export function signed(entry: Entry, all: readonly Entry[]): number {
  if (entry.kind !== 'reversal') return BASE_SIGN[entry.kind] * entry.cents;
  const original = all.find((e) => e.id === entry.reverses);
  if (!original || original.kind === 'reversal') return 0;
  return -BASE_SIGN[original.kind] * entry.cents;
}

/** The balance: the sum of the signed entries, over one term or all of them. */
export function balance(entries: readonly Entry[], term?: string): number {
  return entries.filter((e) => term === undefined || e.term === term).reduce((n, e) => n + signed(e, entries), 0);
}

/** How much of an entry has already been reversed. */
export function reversedCents(entry: Entry, all: readonly Entry[]): number {
  return all.filter((e) => e.kind === 'reversal' && e.reverses === entry.id).reduce((n, e) => n + e.cents, 0);
}

/** Cents disbursed against an award, net of reversals. */
export function disbursedCents(award: Award, entries: readonly Entry[]): number {
  return entries
    .filter((e) => e.kind === 'aid_disbursement' && e.awardId === award.id)
    .reduce((n, e) => n + e.cents - reversedCents(e, entries), 0);
}

export interface AwardView {
  award: Award;
  disbursedCents: number;
  /** Accepted, crediting, and not yet disbursed. Never in the balance. */
  anticipatedCents: number;
  /** Why the rest is not disbursing, when it is not — in the institution's words, never a verdict of Semester's. */
  waitingOn: string | null;
  credits: boolean;
  repaid: boolean;
}

/**
 * Why an accepted award is not disbursing yet, or null when nothing on
 * Semester's copy stands in the way. Each reason names what the institution's
 * system said, so a student reads who can change it.
 */
export function waitingOn(award: Award): string | null {
  const kind = aidKindOf(award.kind);
  if (!kind.credits) return 'Work-study is paid to you for hours worked; it is never credited to this account.';
  if (award.status === 'offered') return 'Waiting for you to accept or decline it.';
  if (award.status !== 'accepted') return `The award is ${award.status}.`;
  if (award.verification === 'pending') return 'The financial aid office says verification is not complete.';
  if (award.sap === 'not_meeting') return 'The financial aid office says satisfactory academic progress is not being met.';
  if (award.sap === 'unknown') return 'The financial aid office has not yet reported academic progress for this term.';
  return null;
}

export function awardView(award: Award, entries: readonly Entry[]): AwardView {
  const kind = aidKindOf(award.kind);
  const disbursed = disbursedCents(award, entries);
  const anticipated = kind.credits && award.status === 'accepted' ? Math.max(0, award.offeredCents - disbursed) : 0;
  return {
    award,
    disbursedCents: disbursed,
    anticipatedCents: anticipated,
    waitingOn: anticipated > 0 || award.status === 'offered' || !kind.credits ? waitingOn(award) : null,
    credits: kind.credits,
    repaid: kind.repaid,
  };
}

export type PlanState = 'settled' | 'on_track' | 'overdue' | 'late' | 'cancelled';

export interface PlanView {
  plan: Plan;
  instalments: Instalment[];
  /** What has come off the term since the plan began: payments, credits, aid. */
  appliedCents: number;
  next: Next | null;
  state: PlanState;
  reason: string;
}

/**
 * Money that has lowered the balance of the plan's term since the plan began,
 * net of reversals of it. Charges added after the plan do not count against
 * the student's progress on it: they are new debt, not a missed instalment.
 */
export function appliedSince(plan: Plan, entries: readonly Entry[]): number {
  const lowering = new Set<EntryKind>(['credit', 'aid_disbursement', 'payment']);
  let n = 0;
  for (const e of entries) {
    if (e.term !== plan.term || e.at < plan.createdAt) continue;
    if (lowering.has(e.kind)) n += e.cents;
    if (e.kind === 'reversal') {
      const original = entries.find((o) => o.id === e.reverses);
      if (original && lowering.has(original.kind) && original.at >= plan.createdAt) n -= e.cents;
    }
  }
  return Math.max(0, n);
}

/**
 * The plan, its instalments from `bill.ts`, and where the student stands.
 *
 * Money is applied to the earliest instalment first, by `bill.ts`'s `nextDue`,
 * for the reason written there. `overdue` is past the due date and inside the
 * school's grace period; `late` is past it.
 */
export function planView(plan: Plan, entries: readonly Entry[], now: Date, graceDays: number): PlanView {
  const instalments = schedule(plan.totalCents, { parts: plan.parts, first: plan.first, everyMonths: plan.everyMonths });
  const applied = appliedSince(plan, entries);
  if (plan.cancelledAt !== undefined) {
    return { plan, instalments, appliedCents: applied, next: null, state: 'cancelled', reason: 'The plan was cancelled.' };
  }
  const paid: Payment = { id: 'applied', term: plan.term, what: 'applied', cents: applied, on: '', at: 0 };
  const next = nextDue(instalments, [paid], now);
  if (!next) {
    return { plan, instalments, appliedCents: applied, next, state: 'settled', reason: 'Every instalment is covered.' };
  }
  if (!next.overdue) {
    return { plan, instalments, appliedCents: applied, next, state: 'on_track', reason: `Instalment ${next.instalment.n} is due ${next.instalment.due}.` };
  }
  const late = -next.daysAway > graceDays;
  return {
    plan,
    instalments,
    appliedCents: applied,
    next,
    state: late ? 'late' : 'overdue',
    reason: late
      ? `Instalment ${next.instalment.n} was due ${next.instalment.due}, more than ${graceDays} days ago.`
      : `Instalment ${next.instalment.n} was due ${next.instalment.due}; the school allows ${graceDays} days.`,
  };
}

export interface TermSummary {
  term: string;
  chargesCents: number;
  /** Payments, credits and disbursed aid, net of reversals. */
  creditedCents: number;
  refundedCents: number;
  /** Positive: owed. Negative: a credit balance that comes back to the student. */
  balanceCents: number;
  /** Accepted aid not yet disbursed. Never in `balanceCents`. */
  anticipatedCents: number;
  /** What the balance would be if every anticipated award landed. Never averaged with the balance. */
  afterAnticipatedCents: number;
  /** Work-study and other aid paid to the student rather than to the account. Reported, never subtracted. */
  earnedCents: number;
  /** How much of the disbursed aid is borrowed. */
  borrowedCents: number;
  awards: AwardView[];
}

/** One term, from the entries and awards, with every figure kept apart. */
export function termSummary(account: StudentAccount, term: string): TermSummary {
  const entries = account.entries;
  const inTerm = entries.filter((e) => e.term === term);
  let charges = 0;
  let refunded = 0;
  let credited = 0;
  for (const e of inTerm) {
    const s = signed(e, entries);
    const original = e.kind === 'reversal' ? entries.find((o) => o.id === e.reverses) : e;
    const kind = original?.kind;
    if (kind === 'charge') charges += s;
    else if (kind === 'refund') refunded += s;
    else credited -= s;
  }
  const awards = account.awards.filter((a) => a.term === term).map((a) => awardView(a, entries));
  const anticipated = awards.reduce((n, v) => n + v.anticipatedCents, 0);
  const earned = awards
    .filter((v) => !v.credits && v.award.status !== 'declined' && v.award.status !== 'cancelled')
    .reduce((n, v) => n + v.award.offeredCents, 0);
  const borrowed = awards.filter((v) => v.repaid).reduce((n, v) => n + v.disbursedCents, 0);
  const bal = balance(entries, term);
  return {
    term,
    chargesCents: charges,
    creditedCents: credited,
    refundedCents: refunded,
    balanceCents: bal,
    anticipatedCents: anticipated,
    afterAnticipatedCents: bal - anticipated,
    earnedCents: earned,
    borrowedCents: borrowed,
    awards,
  };
}

export function activeHold(account: StudentAccount): Hold | null {
  return account.holds.find((h) => h.releasedAt === undefined) ?? null;
}

/** Every term the account has anything for, in order. */
export function terms(account: StudentAccount): string[] {
  return [...new Set([...account.entries.map((e) => e.term), ...account.awards.map((a) => a.term)])].sort();
}
