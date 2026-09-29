/**
 * Everything that changes a student account, as pure functions.
 *
 * Each takes the account, what is asked, and a context carrying the clock, the
 * gate, the school's settings and who is asking, and returns either the new
 * account with the thing it made, or a refusal — and both carry a sentence
 * saying why. Nothing here reads the network, the database or the clock; the
 * database functions in `20260929320000_student_accounts.sql` make the same
 * decisions against the same rules, and `studentaccount.schema.test.ts` holds
 * the two vocabularies together.
 *
 * ## Idempotency
 *
 * Every write that posts money takes a key. The same key with the same
 * request is a replay and answers `duplicate` with what the first one made;
 * the same key with a different request is refused, because a key reused for
 * something else is a bug somewhere upstream and silently posting either
 * version would hide it.
 */

import { aidKindOf, type AidKind } from '../bill';
import { dateToIso, isoToDate } from '../date';
import { gate, type GateInput } from './gate';
import {
  AWARD_KINDS,
  SAPS,
  VERIFICATIONS,
  activeHold,
  balance,
  disbursedCents,
  reversedCents,
  type Award,
  type Entry,
  type EntryKind,
  type EntrySource,
  type Hold,
  type Intent,
  type Plan,
  type Sap,
  type StudentAccount,
  type Verification,
} from './ledger';

export const CAPABILITIES = {
  /** Post charges, credits and counter payments, reverse entries, refund credit balances, hold, and make payment plans. */
  bursar: 'bursar:post',
  /** Record aid disbursements the institution made, and read aid. Never sets an amount of Semester's own. */
  aid: 'aid:manage',
  /** Read whether a student is held — never why, never an amount. */
  holdRead: 'hold:read',
} as const;

export interface Person {
  id: string;
  /** Capabilities verified over the account's school. Never a role picker. */
  capabilities: readonly string[];
}

/** A person, or one of the two systems that write without a person. */
export type Actor = Person | 'aid_adapter' | 'provider';

export interface Settings {
  /** A balance above this, across every term, may be held. */
  thresholdCents: number;
  /** Days past an instalment's due date before a plan is late. */
  graceDays: number;
}

export interface Ctx {
  now: Date;
  gate: GateInput;
  settings: Settings;
  actor: Actor;
  newId: () => string;
}

export type RefusalCode =
  | 'module_off'
  | 'no_finance_owner'
  | 'finance_seat_vacant'
  | 'forbidden'
  | 'invalid'
  | 'key_reused'
  | 'not_found'
  | 'exceeds_credit'
  | 'exceeds_award'
  | 'not_disbursable'
  | 'already_decided'
  | 'below_threshold'
  | 'nothing_owed'
  | 'exceeds_balance'
  | 'plan_exists'
  | 'already_released'
  | 'stale';

export type Refusal = { ok: false; code: RefusalCode; reason: string };
export type Done<T> = { ok: true; code: 'done' | 'duplicate'; reason: string; account: StudentAccount; value: T };
export type Result<T> = Done<T> | Refusal;

const refuse = (code: RefusalCode, reason: string): Refusal => ({ ok: false, code, reason });

// ── Checks every action shares ────────────────────────────────────────────

function isOn(ctx: Ctx): Refusal | null {
  const g = gate(ctx.gate);
  return g.on ? null : refuse(g.code, g.reason);
}

function holds(ctx: Ctx, capability: string): boolean {
  return typeof ctx.actor === 'object' && ctx.actor.capabilities.includes(capability);
}

export function validCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents > 0;
}

/** `2026FA`, `2027SP`, `2027SU` — the shape course terms use across the schema. */
export function validTerm(term: string): boolean {
  return /^[0-9]{4}(FA|SP|SU)$/.test(term);
}

function validKey(key: string): boolean {
  return key.trim().length >= 1 && key.length <= 200;
}

function validDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && dateToIso(isoToDate(iso)) === iso;
}

function same(a: Entry, b: Omit<Entry, 'id' | 'at' | 'what'>): boolean {
  return a.kind === b.kind && a.cents === b.cents && a.term === b.term && a.source === b.source &&
    a.awardId === b.awardId && a.reverses === b.reverses;
}

/**
 * Post one entry, idempotently. Every money path below ends here, so there is
 * one place a key is honoured.
 */
function post(account: StudentAccount, ctx: Ctx, want: Omit<Entry, 'id' | 'at'>, reason: string): Result<Entry> {
  const prior = account.entries.find((e) => e.key === want.key);
  if (prior) {
    return same(prior, want)
      ? { ok: true, code: 'duplicate', reason: `Already posted under ${want.key}; nothing new.`, account, value: prior }
      : refuse('key_reused', `The key ${want.key} was used for a different entry, so neither is posted twice.`);
  }
  const entry: Entry = { ...want, id: ctx.newId(), at: ctx.now.getTime() };
  return { ok: true, code: 'done', reason, account: { ...account, entries: [...account.entries, entry] }, value: entry };
}

// ── The bursar ────────────────────────────────────────────────────────────

export interface PostRequest {
  term: string;
  kind: Extract<EntryKind, 'charge' | 'credit' | 'payment'>;
  cents: number;
  what: string;
  key: string;
}

/** A charge, a credit, or a payment taken at the window. Aid and refunds have their own paths. */
export function postEntry(account: StudentAccount, req: PostRequest, ctx: Ctx): Result<Entry> {
  const off = isOn(ctx);
  if (off) return off;
  if (!holds(ctx, CAPABILITIES.bursar)) return refuse('forbidden', 'Posting to a student account needs bursar:post at this school.');
  if (!['charge', 'credit', 'payment'].includes(req.kind)) {
    return refuse('invalid', `A ${req.kind} is not posted by hand; it has its own path.`);
  }
  if (!validTerm(req.term)) return refuse('invalid', `${req.term} is not a term.`);
  if (!validCents(req.cents)) return refuse('invalid', 'An amount is a whole, positive number of cents.');
  if (!req.what.trim() || req.what.length > 200) return refuse('invalid', 'An entry says what it is, in under 200 characters.');
  if (!validKey(req.key)) return refuse('invalid', 'An entry needs an idempotency key.');
  return post(account, ctx, { term: req.term, kind: req.kind, cents: req.cents, what: req.what.trim(), key: req.key, source: 'bursar' },
    `Posted a ${req.kind} of ${req.cents} cents to ${req.term}.`);
}

export interface ReverseRequest {
  entryId: string;
  /** Defaults to what is left of the entry. */
  cents?: number;
  what: string;
  key: string;
}

/**
 * Answer a wrong entry with its opposite. Nothing is edited: the original and
 * the reversal both stay, and a partial reversal can follow another up to the
 * original amount and no further. An aid disbursement is reversed by the aid
 * office or its adapter, never by the bursar — the money is the aid office's.
 */
export function reverseEntry(account: StudentAccount, req: ReverseRequest, ctx: Ctx): Result<Entry> {
  const off = isOn(ctx);
  if (off) return off;
  const original = account.entries.find((e) => e.id === req.entryId);
  if (!original) return refuse('not_found', 'No such entry on this account.');
  if (original.kind === 'reversal') return refuse('invalid', 'A reversal is not reversed; post the entry again instead.');
  const aid = original.kind === 'aid_disbursement';
  const allowed = aid ? holds(ctx, CAPABILITIES.aid) || ctx.actor === 'aid_adapter' : holds(ctx, CAPABILITIES.bursar) || ctx.actor === 'provider';
  if (!allowed) {
    return refuse('forbidden', aid ? 'An aid disbursement is reversed by the financial aid office.' : 'Reversing an entry needs bursar:post at this school.');
  }
  const left = original.cents - reversedCents(original, account.entries);
  const cents = req.cents ?? left;
  if (!validCents(cents)) return refuse('invalid', 'An amount is a whole, positive number of cents.');
  if (!validKey(req.key)) return refuse('invalid', 'A reversal needs an idempotency key.');
  const replay = account.entries.find((e) => e.key === req.key);
  if (!replay && cents > left) {
    return refuse('invalid', `Only ${left} cents of that entry are left to reverse.`);
  }
  const source: EntrySource = ctx.actor === 'provider' ? 'provider' : ctx.actor === 'aid_adapter' ? 'aid_adapter' : aid ? 'aid_office' : 'bursar';
  return post(account, ctx, {
    term: original.term, kind: 'reversal', cents, what: req.what.trim() || `Reverses ${original.what}`, key: req.key,
    source, reverses: original.id, awardId: original.awardId,
  }, `Reversed ${cents} cents of ${original.what}.`);
}

export interface RefundRequest {
  term: string;
  cents: number;
  key: string;
}

/**
 * Pay a credit balance back to the student. Never more than the term's credit
 * balance as posted: anticipated aid is not a credit, and refunding against it
 * is refunding money the account does not have.
 */
export function issueRefund(account: StudentAccount, req: RefundRequest, ctx: Ctx): Result<Entry> {
  const off = isOn(ctx);
  if (off) return off;
  if (!holds(ctx, CAPABILITIES.bursar)) return refuse('forbidden', 'Refunding needs bursar:post at this school.');
  if (!validTerm(req.term)) return refuse('invalid', `${req.term} is not a term.`);
  if (!validCents(req.cents)) return refuse('invalid', 'An amount is a whole, positive number of cents.');
  if (!validKey(req.key)) return refuse('invalid', 'A refund needs an idempotency key.');
  const replay = account.entries.find((e) => e.key === req.key);
  const credit = -balance(account.entries, req.term);
  if (!replay && req.cents > credit) {
    return refuse('exceeds_credit', credit > 0
      ? `The credit balance for ${req.term} is ${credit} cents; ${req.cents} is more than that.`
      : `${req.term} has no credit balance to refund.`);
  }
  return post(account, ctx, { term: req.term, kind: 'refund', cents: req.cents, what: 'Refund of credit balance', key: req.key, source: 'bursar' },
    `Refunded ${req.cents} cents of the ${req.term} credit balance.`);
}

/**
 * Hold the account when the balance across every term is over the school's
 * threshold. One hold at a time; asking again while held answers with the
 * hold that is there. The reason is the bursar's words and goes to the
 * student and the bursar only; `holdStatus` is what other offices get.
 */
export function placeHold(account: StudentAccount, req: { reason: string }, ctx: Ctx): Result<Hold> {
  const off = isOn(ctx);
  if (off) return off;
  if (!holds(ctx, CAPABILITIES.bursar)) return refuse('forbidden', 'Placing a hold needs bursar:post at this school.');
  if (!req.reason.trim() || req.reason.length > 500) return refuse('invalid', 'A hold says why, in under 500 characters.');
  const existing = activeHold(account);
  if (existing) return { ok: true, code: 'duplicate', reason: 'The account is already held.', account, value: existing };
  const owed = balance(account.entries);
  if (owed <= ctx.settings.thresholdCents) {
    return refuse('below_threshold', `The balance is ${owed} cents, not over this school's threshold of ${ctx.settings.thresholdCents}.`);
  }
  const hold: Hold = { id: ctx.newId(), reason: req.reason.trim(), balanceCents: owed, thresholdCents: ctx.settings.thresholdCents, placedAt: ctx.now.getTime() };
  return { ok: true, code: 'done', reason: `Held at a balance of ${owed} cents.`, account: { ...account, holds: [...account.holds, hold] }, value: hold };
}

export function releaseHold(account: StudentAccount, req: { holdId: string; reason: string }, ctx: Ctx): Result<Hold> {
  const off = isOn(ctx);
  if (off) return off;
  if (!holds(ctx, CAPABILITIES.bursar)) return refuse('forbidden', 'Releasing a hold needs bursar:post at this school.');
  const hold = account.holds.find((h) => h.id === req.holdId);
  if (!hold) return refuse('not_found', 'No such hold on this account.');
  if (hold.releasedAt !== undefined) return refuse('already_released', 'That hold was already released.');
  if (!req.reason.trim()) return refuse('invalid', 'A release says why.');
  const released: Hold = { ...hold, releasedAt: ctx.now.getTime(), releaseReason: req.reason.trim() };
  return {
    ok: true, code: 'done', reason: 'Released.',
    account: { ...account, holds: account.holds.map((h) => (h.id === hold.id ? released : h)) }, value: released,
  };
}

export interface HoldStatus {
  held: boolean;
  /** Which office to go to. Never why, never an amount. */
  office: 'student_accounts' | null;
  since: number | null;
}

/**
 * What the registrar and every other office may know: whether there is a
 * hold, and whose. The type has no field for the reason or the balance, so a
 * caller cannot leak what it was never given.
 */
export function holdStatus(account: StudentAccount, ctx: Pick<Ctx, 'actor'>): Result<HoldStatus> {
  const self = typeof ctx.actor === 'object' && ctx.actor.id === account.studentId;
  const office = typeof ctx.actor === 'object' && (ctx.actor.capabilities.includes(CAPABILITIES.holdRead) || ctx.actor.capabilities.includes(CAPABILITIES.bursar));
  if (!self && !office) return refuse('forbidden', 'Hold status is for the student and offices holding hold:read.');
  const h = activeHold(account);
  return { ok: true, code: 'done', reason: h ? 'Held by Student Accounts.' : 'No hold.', account, value: { held: !!h, office: h ? 'student_accounts' : null, since: h?.placedAt ?? null } };
}

export interface PlanRequest {
  term: string;
  parts: number;
  first: string;
  everyMonths: number;
  key: string;
}

/**
 * A payment plan for what the term owes now. The instalments are not stored:
 * `planView` derives them with `bill.ts`'s `split`, so they always add up to
 * the total, and the plan's late state is derived from the ledger each time.
 */
export function createPlan(account: StudentAccount, req: PlanRequest, ctx: Ctx): Result<Plan> {
  const off = isOn(ctx);
  if (off) return off;
  if (!holds(ctx, CAPABILITIES.bursar)) return refuse('forbidden', 'Making a payment plan needs bursar:post at this school.');
  if (!validTerm(req.term)) return refuse('invalid', `${req.term} is not a term.`);
  if (!Number.isInteger(req.parts) || req.parts < 2 || req.parts > 12) return refuse('invalid', 'A plan has between 2 and 12 instalments.');
  if (!Number.isInteger(req.everyMonths) || req.everyMonths < 1 || req.everyMonths > 3) return refuse('invalid', 'Instalments are 1 to 3 months apart.');
  if (!validDate(req.first)) return refuse('invalid', `${req.first} is not a date.`);
  if (!validKey(req.key)) return refuse('invalid', 'A plan needs an idempotency key.');
  const replay = account.plans.find((p) => p.key === req.key);
  if (replay) {
    return replay.term === req.term && replay.parts === req.parts && replay.first === req.first && replay.everyMonths === req.everyMonths
      ? { ok: true, code: 'duplicate', reason: 'That plan was already made.', account, value: replay }
      : refuse('key_reused', `The key ${req.key} was used for a different plan.`);
  }
  if (account.plans.some((p) => p.term === req.term && p.cancelledAt === undefined)) {
    return refuse('plan_exists', `${req.term} already has a plan.`);
  }
  const owed = balance(account.entries, req.term);
  if (owed <= 0) return refuse('nothing_owed', `${req.term} owes nothing, so there is nothing to divide.`);
  const plan: Plan = { id: ctx.newId(), term: req.term, totalCents: owed, parts: req.parts, first: req.first, everyMonths: req.everyMonths, key: req.key, createdAt: ctx.now.getTime() };
  return { ok: true, code: 'done', reason: `${owed} cents over ${req.parts} instalments from ${req.first}.`, account: { ...account, plans: [...account.plans, plan] }, value: plan };
}

// ── Financial aid ─────────────────────────────────────────────────────────

export interface AwardSync {
  externalRef: string;
  term: string;
  kind: AidKind;
  what: string;
  offeredCents: number;
  verification: Verification;
  sap: Sap;
  sourceVersion: number;
  /** The institution withdrew the award. */
  cancelled?: boolean;
}

/**
 * The institution's aid system says what an award is. Only the adapter writes
 * this — no person at Semester or the school types an amount into it — and a
 * sync older than the one held is dropped, so a batch that arrives late
 * cannot roll an award back.
 */
export function syncAward(account: StudentAccount, req: AwardSync, ctx: Ctx): Result<Award> {
  const off = isOn(ctx);
  if (off) return off;
  if (ctx.actor !== 'aid_adapter') return refuse('forbidden', 'Awards come from the institution’s aid system, through its adapter, and nowhere else.');
  if (!req.externalRef.trim()) return refuse('invalid', 'An award needs the institution’s id for it.');
  if (!validTerm(req.term)) return refuse('invalid', `${req.term} is not a term.`);
  if (!AWARD_KINDS.includes(req.kind)) return refuse('invalid', `${req.kind} is not a kind of aid.`);
  if (!Number.isSafeInteger(req.offeredCents) || req.offeredCents < 0) return refuse('invalid', 'An award amount is a whole number of cents.');
  if (!VERIFICATIONS.includes(req.verification) || !SAPS.includes(req.sap)) return refuse('invalid', 'Unknown verification or progress state.');
  if (!Number.isSafeInteger(req.sourceVersion) || req.sourceVersion < 1) return refuse('invalid', 'A sync carries the source’s version.');
  const held = account.awards.find((a) => a.externalRef === req.externalRef);
  if (held && req.sourceVersion < held.sourceVersion) {
    return refuse('stale', `Version ${req.sourceVersion} is older than the ${held.sourceVersion} already held; ignored.`);
  }
  if (held && req.sourceVersion === held.sourceVersion) {
    return { ok: true, code: 'duplicate', reason: 'That version is already held.', account, value: held };
  }
  if (held && held.term !== req.term) return refuse('invalid', 'An award does not move between terms; the source should cancel it and offer another.');
  const status = req.cancelled ? 'cancelled' : held ? held.status : 'offered';
  const award: Award = {
    id: held?.id ?? ctx.newId(), term: req.term, externalRef: req.externalRef, kind: req.kind, what: req.what.trim() || aidKindOf(req.kind).label,
    offeredCents: req.offeredCents, status, verification: req.verification, sap: req.sap, sourceVersion: req.sourceVersion,
    decidedAt: held?.decidedAt,
  };
  const disbursed = held ? disbursedCents(held, account.entries) : 0;
  const note = disbursed > award.offeredCents ? ` More (${disbursed} cents) has been disbursed than the new amount; the aid office reconciles it.` : '';
  return {
    ok: true, code: 'done', reason: (held ? `Updated to version ${req.sourceVersion}.` : 'Offered.') + note,
    account: { ...account, awards: held ? account.awards.map((a) => (a.id === held.id ? award : a)) : [...account.awards, award] }, value: award,
  };
}

/** The student accepts or declines one award. Once, and only their own. */
export function respondToAward(account: StudentAccount, req: { awardId: string; accept: boolean }, ctx: Ctx): Result<Award> {
  const off = isOn(ctx);
  if (off) return off;
  if (typeof ctx.actor !== 'object' || ctx.actor.id !== account.studentId) {
    return refuse('forbidden', 'Only the student accepts or declines their own aid.');
  }
  const award = account.awards.find((a) => a.id === req.awardId);
  if (!award) return refuse('not_found', 'No such award on this account.');
  const want = req.accept ? 'accepted' : 'declined';
  if (award.status === want) return { ok: true, code: 'duplicate', reason: `Already ${want}.`, account, value: award };
  if (award.status !== 'offered') return refuse('already_decided', `The award is ${award.status}; the financial aid office changes it from here.`);
  const decided: Award = { ...award, status: want, decidedAt: ctx.now.getTime() };
  return { ok: true, code: 'done', reason: `${want[0].toUpperCase()}${want.slice(1)}.`, account: { ...account, awards: account.awards.map((a) => (a.id === award.id ? decided : a)) }, value: decided };
}

/**
 * Record aid the institution disbursed. The amount is the institution's; what
 * Semester checks is only that its own copy agrees the award can be paid:
 * accepted, crediting, verification not pending, progress reported and not
 * failing, and no more than was offered. A disbursement that contradicts the
 * copy is refused with the reason, so the copy is corrected from the source
 * first rather than drifting from it.
 */
export function disburseAid(account: StudentAccount, req: { awardId: string; cents: number; key: string }, ctx: Ctx): Result<Entry> {
  const off = isOn(ctx);
  if (off) return off;
  if (!(holds(ctx, CAPABILITIES.aid) || ctx.actor === 'aid_adapter')) return refuse('forbidden', 'Aid disbursements are recorded by the financial aid office or its system.');
  const award = account.awards.find((a) => a.id === req.awardId);
  if (!award) return refuse('not_found', 'No such award on this account.');
  if (!validCents(req.cents)) return refuse('invalid', 'An amount is a whole, positive number of cents.');
  if (!validKey(req.key)) return refuse('invalid', 'A disbursement needs an idempotency key.');
  const replay = account.entries.find((e) => e.key === req.key);
  if (!replay) {
    if (!aidKindOf(award.kind).credits) {
      return refuse('not_disbursable', 'Work-study is paid to the student for hours worked. It never reduces the balance, so it is never disbursed to the account.');
    }
    const blocked = award.status !== 'accepted' || award.verification === 'pending' || award.sap === 'not_meeting' || award.sap === 'unknown';
    if (blocked) return refuse('not_disbursable', `Not disbursable on the record held: ${award.status === 'offered' ? 'the student has not accepted it' : award.status !== 'accepted' ? `it is ${award.status}` : award.verification === 'pending' ? 'verification is pending' : 'academic progress is not reported as met'}.`);
    const left = award.offeredCents - disbursedCents(award, account.entries);
    if (req.cents > left) return refuse('exceeds_award', `Only ${left} cents of the ${award.offeredCents} offered are left to disburse.`);
  }
  return post(account, ctx, {
    term: award.term, kind: 'aid_disbursement', cents: req.cents, what: award.what, key: req.key,
    source: ctx.actor === 'aid_adapter' ? 'aid_adapter' : 'aid_office', awardId: award.id,
  }, `Disbursed ${req.cents} cents of ${award.what}.`);
}

// ── Paying ────────────────────────────────────────────────────────────────

/**
 * The student starts paying. Nothing is charged here: this records what they
 * mean to pay, and the provider's own page takes the card. The provider's
 * events settle it (`payments.ts`).
 */
export function startPayment(account: StudentAccount, req: { term: string; cents: number; key: string }, ctx: Ctx): Result<Intent> {
  const off = isOn(ctx);
  if (off) return off;
  if (typeof ctx.actor !== 'object' || ctx.actor.id !== account.studentId) return refuse('forbidden', 'A student pays their own account.');
  if (!validTerm(req.term)) return refuse('invalid', `${req.term} is not a term.`);
  if (!validCents(req.cents)) return refuse('invalid', 'An amount is a whole, positive number of cents.');
  if (!validKey(req.key)) return refuse('invalid', 'A payment needs an idempotency key.');
  const replay = account.intents.find((i) => i.key === req.key);
  if (replay) {
    return replay.term === req.term && replay.cents === req.cents
      ? { ok: true, code: 'duplicate', reason: 'That payment was already started.', account, value: replay }
      : refuse('key_reused', `The key ${req.key} was used for a different payment.`);
  }
  const owed = balance(account.entries, req.term);
  if (owed <= 0) return refuse('nothing_owed', `${req.term} owes nothing.`);
  if (req.cents > owed) return refuse('exceeds_balance', `${req.term} owes ${owed} cents; ${req.cents} is more than that.`);
  const intent: Intent = { id: ctx.newId(), term: req.term, cents: req.cents, currency: 'usd', key: req.key, status: 'open', createdAt: ctx.now.getTime() };
  return { ok: true, code: 'done', reason: `Started a payment of ${req.cents} cents; the provider's page takes it from here.`, account: { ...account, intents: [...account.intents, intent] }, value: intent };
}

