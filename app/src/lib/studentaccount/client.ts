/**
 * The student account's reads and writes, typed, over the account service.
 *
 * Every function here wraps one RPC or one table in
 * `supabase/migrations/20260929320000_student_accounts.sql`, and the database
 * is the authorization: row-level security decides whose ledger a read
 * reaches, and each write function checks the caller's capability, the
 * school's module and its finance owner itself. What this module adds is the
 * shape — rows become the `ledger.ts` records the screen and the pure rules
 * already speak — and one rule: a refusal is thrown in plain words
 * (`plainError`), never returned beside an empty list, so a screen cannot
 * draw "no entries" where the answer was "not allowed".
 *
 * Nothing is cached and nothing reaches browser storage. The balance is never
 * read from anywhere: there is no balance column, and `ledger.ts` derives it
 * from the entries this returns.
 */

import { cloud, cloudConfigured } from '../cloud';
import { forSchool, loadMyCapabilities } from '../capabilities';
import { narrowingAdmits, readNarrowing } from '../featurepolicy';
import { claimedSchoolOrThrow } from '../schoolclaim';
import { formatNumber } from '../locale';
import type { FeatureState } from '../../intelligence/contracts';
import type { AidKind } from '../bill';
import { CAPABILITIES } from './actions';
import { gate, MODULE_FLAG, type GateDecision } from './gate';
import {
  AWARD_KINDS,
  AWARD_STATUSES,
  ENTRY_KINDS,
  SAPS,
  VERIFICATIONS,
  type Award,
  type AwardStatus,
  type Entry,
  type EntryKind,
  type EntrySource,
  type Hold,
  type Intent,
  type IntentStatus,
  type Plan,
  type Sap,
  type StudentAccount,
  type Verification,
} from './ledger';

type Row = Record<string, unknown>;
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const ms = (v: unknown): number => (v == null ? 0 : Date.parse(String(v)) || 0);
const maybeMs = (v: unknown): number | undefined => (v == null ? undefined : Date.parse(String(v)) || undefined);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

// ── Money and words ────────────────────────────────────────────────────────

/** Integer cents, as the reader's locale writes a dollar amount. */
export function cents(n: number): string {
  return formatNumber(n / 100, { style: 'currency', currency: 'USD' });
}

/**
 * A dollar amount a person typed, as integer cents, or null. Commas and a
 * leading `$` are forgiven; more than two decimal places, a negative, or
 * nothing at all is not an amount.
 */
export function readCents(typed: string): number | null {
  const t = typed.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(n) ? n : null;
}

/** The server's refusals, in the words a student or an office reads. */
const PLAIN: readonly [RegExp, string][] = [
  [/not signed in/, 'Sign in to use your student account.'],
  [/student accounts are off at/, 'Your school has not turned on student accounts, so nothing was changed.'],
  [/that needs (\S+) at your school/, 'Your account does not hold the permission this needs at your school, so nothing was changed.'],
  [/idempotency key was used for a different/, 'This clashed with an earlier request. Nothing was changed; start it again.'],
  [/a payment is more than nothing/, 'A payment has to be more than nothing and no more than this term owes.'],
  [/a refund cannot exceed it/, 'A refund cannot be more than the credit balance the ledger shows.'],
  [/not over the threshold/, 'A hold needs a balance over your school’s hold threshold.'],
  [/already has a plan/, 'This term already has a payment plan.'],
  [/owes nothing, so there is nothing to divide/, 'This term owes nothing, so there is nothing to divide into a plan.'],
  [/the financial aid office changes it from here/, 'This award has already been answered. The financial aid office changes it from here.'],
  [/no award of yours/, 'That award is not on your account.'],
  [/no such student at your school/, 'There is no student with that account at your school.'],
  [/no such entry at your school/, 'That entry is not in your school’s ledger.'],
  [/a reversal is not reversed/, 'A reversal cannot itself be reversed. Post the entry again instead.'],
  [/left to reverse/, 'That is more than is left of the entry to reverse.'],
  [/left to disburse/, 'That is more than is left of the award to disburse.'],
  [/not disbursable on the record held/, 'The aid office’s record says this award cannot be disbursed yet.'],
  [/work-study is paid to the student/, 'Work-study is paid to the student for hours worked. It is never disbursed to the account.'],
  [/no open hold with that id/, 'That hold is not open any more.'],
  [/is not posted by hand/, 'That kind of entry has its own path and is not posted by hand.'],
  [/an idempotency key is 1 to 200/, 'The request could not be labelled. Nothing was changed; try again.'],
];

const NETWORK = /fetch|network|timed? ?out|load failed/i;

/**
 * A thrown refusal, in plain words. A request that never got an answer says
 * so, and says that a retry is safe — the retry carries the same key, so the
 * database recognises it rather than posting twice.
 */
export function plainError(message: string | undefined, fallback: string): string {
  const said = (message ?? '').trim();
  if (!said) return fallback;
  if (NETWORK.test(said) && !said.startsWith('semester:')) {
    return 'Your school’s account service did not answer. It may not have gone through; trying again is safe, because the retry is recognised as the same request.';
  }
  for (const [pattern, words] of PLAIN) if (pattern.test(said)) return words;
  const bare = said.replace(/^semester:\s*/, '');
  const sentence = bare.charAt(0).toUpperCase() + bare.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(plainError(error?.message, fallback));
}

// ── Reading rows ───────────────────────────────────────────────────────────

export function readEntry(r: Row): Entry {
  return {
    id: text(r.id),
    term: text(r.term),
    kind: pick<EntryKind>(r.kind, ENTRY_KINDS, 'charge'),
    cents: num(r.cents),
    what: text(r.what),
    key: text(r.idempotency_key),
    source: pick<EntrySource>(r.source, ['bursar', 'aid_office', 'aid_adapter', 'provider'], 'bursar'),
    awardId: r.aid_award_id == null ? undefined : text(r.aid_award_id),
    reverses: r.reverses == null ? undefined : text(r.reverses),
    at: ms(r.posted_at),
  };
}

/** An award, with when the aid system last synced it — the age a student is told. */
export interface AwardRecord extends Award {
  syncedAt: number;
}

export function readAward(r: Row): AwardRecord {
  return {
    id: text(r.id),
    term: text(r.term),
    externalRef: text(r.external_ref),
    kind: pick<AidKind>(r.kind, AWARD_KINDS, 'other'),
    what: text(r.what),
    offeredCents: num(r.offered_cents),
    status: pick<AwardStatus>(r.status, AWARD_STATUSES, 'offered'),
    verification: pick<Verification>(r.verification, VERIFICATIONS, 'pending'),
    sap: pick<Sap>(r.sap, SAPS, 'unknown'),
    sourceVersion: num(r.source_version),
    decidedAt: maybeMs(r.decided_at),
    syncedAt: ms(r.synced_at),
  };
}

export function readHold(r: Row): Hold {
  return {
    id: text(r.id),
    reason: text(r.reason),
    balanceCents: num(r.balance_cents),
    thresholdCents: num(r.threshold_cents),
    placedAt: ms(r.placed_at),
    releasedAt: maybeMs(r.released_at),
    releaseReason: r.release_reason == null ? undefined : text(r.release_reason),
  };
}

export function readPlan(r: Row): Plan {
  return {
    id: text(r.id),
    term: text(r.term),
    totalCents: num(r.total_cents),
    parts: num(r.parts),
    first: text(r.first_due),
    everyMonths: num(r.every_months),
    key: text(r.idempotency_key),
    createdAt: ms(r.created_at),
    cancelledAt: maybeMs(r.cancelled_at),
  };
}

export function readIntent(r: Row): Intent {
  return {
    id: text(r.id),
    term: text(r.term),
    cents: num(r.cents),
    currency: 'usd',
    key: text(r.idempotency_key),
    status: pick<IntentStatus>(r.status, ['open', 'paid', 'failed', 'refunded'], 'open'),
    providerPaymentId: r.provider_payment_id == null ? undefined : text(r.provider_payment_id),
    createdAt: ms(r.created_at),
  };
}

// ── The gate ───────────────────────────────────────────────────────────────

/** What the school has set, as a finance office reads it. A student cannot. */
export interface Settings {
  financeOwner: string | null;
  thresholdCents: number;
  graceDays: number;
  updatedAt: number;
}

/** The late grace a school gets when it has not set one: the column's own default. */
export const DEFAULT_GRACE_DAYS = 10;

/**
 * Whether the screen opens, given what this account can read.
 *
 * `settings` is `undefined` when the account cannot read the school's
 * settings, which is every student: they are the finance offices'. The step
 * that needs them — a named finance owner — is then the database's to say,
 * and it does, on every write (`private.student_accounts_on`). The module
 * state and Semester's own council seat are checked here for everybody.
 */
export function screenGate(
  moduleState: FeatureState,
  settings: Settings | null | undefined,
  admitted: boolean,
  councilHolder?: string | null,
): GateDecision {
  const financeOwner = settings === undefined ? 'held by the school' : (settings?.financeOwner ?? null);
  return gate({ moduleState, financeOwner, admitted, ...(councilHolder === undefined ? {} : { councilFinanceHolder: councilHolder }) });
}

export interface AccountContext {
  userId: string;
  school: string;
  moduleState: FeatureState;
  /** Undefined when this account cannot read them. */
  settings: Settings | undefined;
  /** Capabilities verified over this school, from `my_capabilities`. */
  capabilities: string[];
  decision: GateDecision;
}

export type Opening =
  | { kind: 'no_service' }
  | { kind: 'signed_out' }
  | { kind: 'no_school' }
  | { kind: 'ready'; context: AccountContext };

/**
 * Who is asking, at which school, with what — and whether the module is on.
 * A failed read throws: "off" is a claim about the school, and a dropped
 * request is not evidence of it.
 */
export async function openAccount(): Promise<Opening> {
  if (!cloudConfigured) return { kind: 'no_service' };
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return { kind: 'signed_out' };
  const school = await claimedSchoolOrThrow();
  if (!school) return { kind: 'no_school' };
  const [{ data: state, error }, grants, { data: settingsRows, error: settingsError }, narrowing] = await Promise.all([
    db.rpc('feature_state', { want_capability: MODULE_FLAG, want_tenant: school }),
    loadMyCapabilities(),
    db.from('student_account_settings').select('finance_owner,hold_threshold_cents,late_grace_days,updated_at').eq('tenant_id', school),
    // The school's role and cohort limits on the module, and which the caller
    // holds. Unread throws: a student pilot never reads as open to everyone.
    readNarrowing(db, MODULE_FLAG, school).catch(() => null),
  ]);
  if (error) fail(error, 'Could not read whether your school has student accounts on.');
  if (!narrowing) fail(null, 'Could not read who student accounts are open to at your school.');
  const capabilities = forSchool(grants, school);
  const office = capabilities.includes(CAPABILITIES.bursar) || capabilities.includes(CAPABILITIES.aid) || capabilities.includes('tenant:configure');
  // Row-level security answers a student with no rows, not an error; only an
  // office's empty answer means the school has not configured anything.
  let settings: Settings | undefined;
  if (office && !settingsError) {
    const r = rows(settingsRows)[0];
    settings = r
      ? { financeOwner: r.finance_owner == null ? null : text(r.finance_owner), thresholdCents: num(r.hold_threshold_cents), graceDays: num(r.late_grace_days), updatedAt: ms(r.updated_at) }
      : { financeOwner: null, thresholdCents: 0, graceDays: DEFAULT_GRACE_DAYS, updatedAt: 0 };
  }
  const moduleState = (typeof state === 'string' ? state : 'off') as FeatureState;
  // The offices are not limited by a student pilot, as in the database
  // (`private.student_accounts_staff` is not narrowed).
  const staff = capabilities.includes(CAPABILITIES.bursar) || capabilities.includes(CAPABILITIES.aid);
  const admitted = staff || narrowingAdmits(narrowing);
  return {
    kind: 'ready',
    context: { userId, school, moduleState, settings, capabilities, decision: screenGate(moduleState, settings, admitted) },
  };
}

// ── Reading an account ─────────────────────────────────────────────────────

export interface LoadedAccount extends StudentAccount {
  awards: AwardRecord[];
}

/**
 * One student's account, as far as this caller may read it: their own, for a
 * student; any at the school, for the bursar. The aid office reads the awards
 * and the aid entries only, which is what row-level security returns it.
 */
export async function loadAccount(studentId: string, school: string): Promise<LoadedAccount> {
  const db = await cloud();
  const by = (table: string, order: string) => db.from(table).select('*').eq('student_id', studentId).order(order);
  const [entries, awards, holds, plans, intents] = await Promise.all([
    by('student_ledger_entries', 'posted_at'),
    by('student_aid_awards', 'term'),
    by('student_account_holds', 'placed_at'),
    by('student_payment_plans', 'created_at'),
    by('student_payment_intents', 'created_at'),
  ]);
  for (const r of [entries, awards, holds, plans, intents]) if (r.error) fail(r.error, 'Could not read the account.');
  return {
    tenantId: school,
    studentId,
    entries: rows(entries.data).map(readEntry),
    awards: rows(awards.data).map(readAward),
    holds: rows(holds.data).map(readHold),
    plans: rows(plans.data).map(readPlan),
    intents: rows(intents.data).map(readIntent),
    receipts: [],
  };
}

/**
 * The students an office can see anything for, newest activity first: the
 * ones with a ledger entry or an award at the school. An office picks one
 * from here or types an account id; there is no directory of names, because
 * the finance tables hold none and this screen asks for nothing more.
 */
export async function loadStudentsSeen(): Promise<string[]> {
  const db = await cloud();
  const [entries, awards] = await Promise.all([
    db.from('student_ledger_entries').select('student_id,posted_at').order('posted_at', { ascending: false }).limit(500),
    db.from('student_aid_awards').select('student_id,synced_at').order('synced_at', { ascending: false }).limit(500),
  ]);
  if (entries.error) fail(entries.error, 'Could not read the school’s ledger.');
  if (awards.error) fail(awards.error, 'Could not read the school’s awards.');
  return [...new Set([...rows(entries.data), ...rows(awards.data)].map((r) => text(r.student_id)).filter(Boolean))];
}

// ── The student's writes ───────────────────────────────────────────────────

/** Accept or decline one of your own offered awards. Answers the status it now has. */
export async function respondToAward(awardId: string, accept: boolean): Promise<AwardStatus> {
  const db = await cloud();
  const { data, error } = await db.rpc('respond_to_aid_award', { want_award: awardId, want_accept: accept });
  if (error) fail(error, 'Your answer was not recorded.');
  return pick<AwardStatus>(data, AWARD_STATUSES, accept ? 'accepted' : 'declined');
}

/**
 * Start paying toward a term. Nothing is charged here: the provider's page
 * takes the card, and its events settle the payment. The same key and amount
 * return the first payment's id.
 */
export async function startPayment(term: string, amountCents: number, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('start_student_payment', { want_term: term, want_cents: amountCents, want_key: key });
  if (error) fail(error, 'The payment was not started.');
  return text(data);
}

// ── The bursar's writes ────────────────────────────────────────────────────

export type PostKind = 'charge' | 'credit' | 'payment';

export async function postEntry(studentId: string, term: string, kind: PostKind, amountCents: number, what: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('post_student_ledger_entry', {
    want_student: studentId, want_term: term, want_kind: kind, want_cents: amountCents, want_what: what, want_key: key,
  });
  if (error) fail(error, 'The entry was not posted.');
  return text(data);
}

/** Reverse an entry, in whole (`amountCents` null) or in part. */
export async function reverseEntry(entryId: string, amountCents: number | null, what: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('reverse_student_ledger_entry', {
    want_entry: entryId, want_cents: amountCents, want_what: what, want_key: key,
  });
  if (error) fail(error, 'The entry was not reversed.');
  return text(data);
}

export async function refundCredit(studentId: string, term: string, amountCents: number, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('refund_student_credit', { want_student: studentId, want_term: term, want_cents: amountCents, want_key: key });
  if (error) fail(error, 'The refund was not recorded.');
  return text(data);
}

export async function placeHold(studentId: string, reason: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('place_student_hold', { want_student: studentId, want_reason: reason });
  if (error) fail(error, 'The hold was not placed.');
  return text(data);
}

export async function releaseHold(holdId: string, reason: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('release_student_hold', { want_hold: holdId, want_reason: reason });
  if (error) fail(error, 'The hold was not released.');
  return text(data);
}

export async function createPlan(studentId: string, term: string, parts: number, first: string, everyMonths: number, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('create_student_payment_plan', {
    want_student: studentId, want_term: term, want_parts: parts, want_first: first, want_every_months: everyMonths, want_key: key,
  });
  if (error) fail(error, 'The payment plan was not made.');
  return text(data);
}

// ── The aid office's write ─────────────────────────────────────────────────

/** Record a disbursement the institution's aid system made. Semester sets no amount of its own. */
export async function recordDisbursement(awardId: string, amountCents: number, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('record_aid_disbursement', { want_award: awardId, want_cents: amountCents, want_key: key });
  if (error) fail(error, 'The disbursement was not recorded.');
  return text(data);
}
