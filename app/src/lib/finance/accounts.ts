/**
 * Student accounts: a school's financial record of what each student owes and
 * has paid, kept under the controls the brief of 29 September asks for
 * (`docs/expansion/Replaceability-Migration-Continuity-and-Confidence.pdf`,
 * "financial and ERP capability").
 *
 * ## How the ledger is kept
 *
 * Nobody writes it. Every charge, payment, refund, adjustment, reversal, aid
 * credit and chargeback is a *request*, and the database writes one entry
 * when someone other than its requester approves it
 * (`20260929220000_student_accounts.sql`). Above the school's threshold a
 * refund, adjustment, reversal or aid credit needs an approver holding
 * `finance:approve_high`. Whoever requested or approved a payment does not
 * approve its refund. A closed month takes nothing new; a correction goes in
 * an open month. Entries are append-only for everyone.
 *
 * ## What it never holds
 *
 * Money or a card. Payments are made through the school's hosted payment
 * provider and recorded here by the provider's reference; no column can hold
 * a card number, and the database refuses a run of 13 to 19 digits anywhere a
 * person types. `PAN` is that pattern, held to the migration by the test.
 *
 * ## What is derived
 *
 * Everything else — the balance, its aging, whether a financial hold applies,
 * a period's statement, a payment-plan schedule, a receipt — is computed here
 * from the append-only entries, so it can be reproduced exactly from them.
 */

// ── Vocabularies (each is a check constraint in the migration) ──────────────

export const KINDS = [
  'charge', 'payment', 'refund', 'adjustment_debit', 'adjustment_credit', 'aid_credit', 'reversal', 'chargeback',
] as const;
export type AccountKind = (typeof KINDS)[number];

export const KIND_LABEL: Record<AccountKind, string> = {
  charge: 'Charge',
  payment: 'Payment',
  refund: 'Refund',
  adjustment_debit: 'Adjustment (adds to the balance)',
  adjustment_credit: 'Adjustment (reduces the balance)',
  aid_credit: 'Scholarship, waiver, discount or sponsorship',
  reversal: 'Reversal',
  chargeback: 'Chargeback (a disputed payment returned)',
};

/** +1 adds to what the student owes, −1 reduces it. A reversal takes the opposite of what it reverses. */
export const SIGN: Record<Exclude<AccountKind, 'reversal'>, 1 | -1> = {
  charge: 1,
  payment: -1,
  refund: 1,
  adjustment_debit: 1,
  adjustment_credit: -1,
  aid_credit: -1,
  chargeback: 1,
};

export const CATEGORIES = [
  'tuition', 'fees', 'housing', 'dining', 'books', 'other',
  'scholarship', 'waiver', 'discount', 'sponsorship',
] as const;
export type AccountCategory = (typeof CATEGORIES)[number];

export const AID_CATEGORIES: readonly AccountCategory[] = ['scholarship', 'waiver', 'discount', 'sponsorship'];

/** Kinds recorded from the hosted payment provider, which carry its reference. */
export const PROVIDER_KINDS: readonly AccountKind[] = ['payment', 'refund', 'chargeback'];
/** Kinds that answer an earlier entry. */
export const REFERENCING_KINDS: readonly AccountKind[] = ['refund', 'reversal', 'chargeback'];
/** Kinds that need finance:approve_high above the school's threshold. */
export const HIGH_VALUE_KINDS: readonly AccountKind[] = ['refund', 'adjustment_debit', 'adjustment_credit', 'aid_credit', 'reversal'];

export const REQUEST_STATUSES = ['proposed', 'approved', 'rejected', 'withdrawn'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STUDENT_REF = /^[A-Za-z0-9._-]{1,64}$/;
export const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
/** A card number, as the database refuses it: 13 to 19 digits, spaces or dashes between. */
export const PAN = /\d(?:[ -]?\d){12,18}/;

// ── Rows ────────────────────────────────────────────────────────────────────

export interface AccountRequest {
  id: string;
  tenant_id: string;
  student_ref: string;
  kind: AccountKind;
  category: AccountCategory;
  amount_cents: number;
  description: string;
  reference_entry_id: string | null;
  provider_ref: string;
  effective_on: string;
  status: RequestStatus;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface AccountEntry {
  id: string;
  tenant_id: string;
  student_ref: string;
  kind: AccountKind;
  category: AccountCategory;
  /** Signed: positive adds to what is owed. */
  amount_cents: number;
  description: string;
  reference_entry_id: string | null;
  provider_ref: string;
  effective_on: string;
  period: string;
  request_id: string;
  requested_by: string | null;
  approved_by: string | null;
  high_value: boolean;
  recorded_at: string;
}

export interface FinanceSettings {
  high_value_cents: number;
  hold_after_days: number;
  hold_minimum_cents: number;
}

export const DEFAULT_SETTINGS: FinanceSettings = { high_value_cents: 100_000, hold_after_days: 30, hold_minimum_cents: 10_000 };

export const periodOf = (isoDate: string) => isoDate.slice(0, 7);

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * Cents as dollars, always two places, a minus for a credit balance. Integer
 * arithmetic throughout, and the same text on every device: a ledger's
 * figures are not the reader's locale's to regroup.
 */
export function money(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(Math.trunc(cents));
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/** "12.50" or "1,204" typed by a person, as whole cents, or null. Never a float. */
export function parseCents(typed: string): number | null {
  const s = typed.trim().replace(/[$,\s]/g, '');
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** The signed amount an entry of this kind would carry. */
export function signed(kind: AccountKind, amountCents: number, reversing: AccountEntry | null): number {
  if (kind === 'reversal') return reversing ? -reversing.amount_cents : 0;
  return SIGN[kind] * amountCents;
}

// ── Balance, aging and holds ────────────────────────────────────────────────

export function balance(entries: readonly AccountEntry[], asOf?: string): number {
  return entries.filter((e) => !asOf || e.effective_on <= asOf).reduce((sum, e) => sum + e.amount_cents, 0);
}

const days = (from: string, to: string) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export interface Aging {
  current: number;
  d31_60: number;
  d61_90: number;
  over90: number;
  /** Credits not yet applied to any charge: a negative balance. */
  credit: number;
}

/**
 * The balance by age, first-in first-out: credits pay the oldest debits
 * first, and what is left of each debit is aged from its effective date.
 */
export function aging(entries: readonly AccountEntry[], today: string): Aging {
  const sorted = [...entries].filter((e) => e.effective_on <= today).sort((a, b) =>
    a.effective_on < b.effective_on ? -1 : a.effective_on > b.effective_on ? 1 : a.recorded_at < b.recorded_at ? -1 : 1);
  const debits = sorted.filter((e) => e.amount_cents > 0).map((e) => ({ on: e.effective_on, left: e.amount_cents }));
  let credit = -sorted.filter((e) => e.amount_cents < 0).reduce((s, e) => s + e.amount_cents, 0);
  for (const d of debits) {
    const used = Math.min(d.left, credit);
    d.left -= used;
    credit -= used;
  }
  const out: Aging = { current: 0, d31_60: 0, d61_90: 0, over90: 0, credit };
  for (const d of debits) {
    if (d.left === 0) continue;
    const age = days(d.on, today);
    if (age <= 30) out.current += d.left;
    else if (age <= 60) out.d31_60 += d.left;
    else if (age <= 90) out.d61_90 += d.left;
    else out.over90 += d.left;
  }
  return out;
}

export interface HoldStatus {
  held: boolean;
  /** What is overdue by more than the school's window. */
  overdue_cents: number;
  /** The neutral sentence a student or staff member reads; never an amount in a notification. */
  line: string;
}

/**
 * Whether a financial hold applies: more than the school's minimum is overdue
 * by more than its window. The sentence is the hold card's own — a category
 * and an office, never a balance — because a hold is shown where the amount
 * is not (`integration/school-records.ts`).
 */
export function holdStatus(entries: readonly AccountEntry[], today: string, s: FinanceSettings = DEFAULT_SETTINGS, plan: PlanStanding | null = null): HoldStatus {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - s.hold_after_days * 86_400_000).toISOString().slice(0, 10);
  const now = entries.filter((e) => e.effective_on <= today);
  // Credits pay the oldest debits first, so what is overdue is the old debits
  // less every credit to date — a payment made yesterday counts.
  // More than the window old: a debit exactly that many days old is not yet overdue,
  // as aging keeps day 30 in the current bucket.
  const oldDebits = now.filter((e) => e.amount_cents > 0 && e.effective_on < cutoff).reduce((t, e) => t + e.amount_cents, 0);
  const credits = -now.filter((e) => e.amount_cents < 0).reduce((t, e) => t + e.amount_cents, 0);
  const overdueNow = Math.max(0, oldDebits - credits);
  // An agreed payment plan that is being kept is the arrangement the school
  // made for what is overdue: it lifts the hold. One that is behind does not.
  if (plan && plan.state === 'on_track' && overdueNow >= s.hold_minimum_cents) {
    return { held: false, overdue_cents: overdueNow, line: 'No financial hold — a payment plan is being kept' };
  }
  const held = overdueNow >= s.hold_minimum_cents;
  return {
    held,
    overdue_cents: overdueNow,
    line: held ? 'Action required before you can register — Student Accounts' : 'No financial hold',
  };
}

// ── Statements, receipts and plans ──────────────────────────────────────────

export interface Statement {
  number: string;
  student_ref: string;
  period: string;
  opening_cents: number;
  lines: AccountEntry[];
  closing_cents: number;
}

/**
 * A period's statement: the balance brought forward, every entry effective in
 * the period, and the balance carried. Its number is derived from the student
 * and the period, so the same statement is produced every time.
 */
export function statement(entries: readonly AccountEntry[], studentRef: string, period: string): Statement {
  const mine = entries.filter((e) => e.student_ref === studentRef);
  const before = mine.filter((e) => e.period < period);
  const lines = mine.filter((e) => e.period === period).sort((a, b) => (a.effective_on < b.effective_on ? -1 : a.effective_on > b.effective_on ? 1 : a.recorded_at < b.recorded_at ? -1 : 1));
  const opening = balance(before);
  return { number: `ST-${studentRef}-${period}`, student_ref: studentRef, period, opening_cents: opening, lines, closing_cents: opening + balance(lines) };
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function statementCsv(st: Statement): string {
  const rows = [
    ['Statement', st.number, 'Student', st.student_ref, 'Period', st.period],
    ['Balance brought forward', '', '', '', '', (st.opening_cents / 100).toFixed(2)],
    ['date', 'kind', 'category', 'description', 'reference', 'amount'],
    ...st.lines.map((l) => [l.effective_on, KIND_LABEL[l.kind], l.category, l.description, l.provider_ref || l.id, (l.amount_cents / 100).toFixed(2)]),
    ['Balance carried forward', '', '', '', '', (st.closing_cents / 100).toFixed(2)],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** A receipt for one payment: what the provider received, by its reference. Semester received nothing. */
export function receipt(e: AccountEntry): string[] {
  if (e.kind !== 'payment') throw new Error('A receipt is for a payment');
  return [
    `Receipt for a payment of ${money(-e.amount_cents)}`,
    `Student ${e.student_ref}, received ${e.effective_on}`,
    `Payment provider reference ${e.provider_ref}`,
    `Recorded on your school's student account as entry ${e.id}`,
  ];
}

export interface PlanRules {
  /** The smallest first payment, as a share of the balance, in whole per cent. */
  min_down_percent: number;
  max_installments: number;
  /** A monthly installment below this is not offered. */
  min_installment_cents: number;
}

export const DEFAULT_PLAN: PlanRules = { min_down_percent: 10, max_installments: 6, min_installment_cents: 5_000 };

export interface Installment {
  due_on: string;
  cents: number;
}

const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/**
 * A payment plan for a balance: a first payment of at least the minimum share
 * today, then equal monthly installments, the last absorbing the rounding so
 * the plan sums to the balance to the cent. Refused, with the reason, when
 * the rules do not allow it.
 */
export function paymentPlan(balanceCents: number, installments: number, firstDue: string, rules: PlanRules = DEFAULT_PLAN): { schedule: Installment[] } | { refused: string } {
  if (balanceCents <= 0) return { refused: 'There is nothing owed to spread over a plan.' };
  if (!Number.isInteger(installments) || installments < 2 || installments > rules.max_installments) {
    return { refused: `A plan has between 2 and ${rules.max_installments} payments.` };
  }
  const down = Math.ceil((balanceCents * rules.min_down_percent) / 100);
  const rest = balanceCents - down;
  const each = Math.floor(rest / (installments - 1));
  if (each < Math.max(1, rules.min_installment_cents)) return { refused: `Each monthly payment would be under ${money(rules.min_installment_cents)}; choose fewer payments.` };
  const schedule: Installment[] = [{ due_on: firstDue, cents: down }];
  for (let i = 1; i < installments; i++) schedule.push({ due_on: addMonths(firstDue, i), cents: i === installments - 1 ? rest - each * (installments - 2) : each });
  return { schedule };
}

/** A school's plan rules, as `student_account_settings` holds them, and whether it offers plans at all. */
export interface SchoolPlanRules extends PlanRules {
  offered: boolean;
}

export const DEFAULT_SCHOOL_PLAN: SchoolPlanRules = { ...DEFAULT_PLAN, offered: true };

/** The first payment is due between today and this many days from now (the migration's guard). */
export const PLAN_FIRST_DUE_DAYS = 30;

export const PLAN_STATUSES = ['proposed', 'approved', 'rejected', 'withdrawn', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** A row of `student_payment_plans`, with its schedule. */
export interface PaymentPlanRecord {
  id: string;
  tenant_id: string;
  student_ref: string;
  installments: number;
  first_due: string;
  balance_cents: number;
  status: PlanStatus;
  requested_by: string | null;
  requested_at: string;
  decided_at: string | null;
  decision_note: string;
  cancelled_at: string | null;
  cancel_note: string;
  schedule: Installment[];
}

export type InstallmentState = 'paid' | 'late' | 'due' | 'upcoming';

export interface PlanStanding {
  /** Credited to the account since the plan was asked for: payments, and credits, less refunds. */
  paid_cents: number;
  /** What the schedule says should have been paid by today. */
  due_cents: number;
  behind_cents: number;
  state: 'on_track' | 'behind' | 'complete';
  rows: (Installment & { seq: number; state: InstallmentState })[];
  next: (Installment & { seq: number }) | null;
}

/**
 * Whether an agreed plan is being kept, read from the ledger. Everything
 * credited to the account since the plan was asked for — payments, and aid
 * or adjustments that reduce what is owed, less any refund or chargeback —
 * pays the schedule in order. A payment is late once its date has passed and
 * what was credited does not cover it and every one before it.
 */
export function planStanding(plan: PaymentPlanRecord, entries: readonly AccountEntry[], today: string): PlanStanding {
  const from = plan.requested_at.slice(0, 10);
  const paid = -entries
    .filter((e) => e.effective_on >= from && e.effective_on <= today && e.kind !== 'charge' && e.kind !== 'adjustment_debit')
    .reduce((t, e) => t + e.amount_cents, 0);
  let covered = Math.max(0, paid);
  let due = 0;
  const rows = plan.schedule.map((p, i) => {
    const seq = i + 1;
    if (p.due_on <= today) due += p.cents;
    const full = covered >= p.cents;
    covered = Math.max(0, covered - p.cents);
    const state: InstallmentState = full ? 'paid' : p.due_on < today ? 'late' : p.due_on === today ? 'due' : 'upcoming';
    return { ...p, seq, state };
  });
  const behind = Math.max(0, due - Math.max(0, paid));
  const total = plan.schedule.reduce((t, p) => t + p.cents, 0);
  const next = rows.find((r) => r.state !== 'paid') ?? null;
  return {
    paid_cents: paid,
    due_cents: due,
    behind_cents: behind,
    state: paid >= total ? 'complete' : behind > 0 ? 'behind' : 'on_track',
    rows,
    next: next ? { due_on: next.due_on, cents: next.cents, seq: next.seq } : null,
  };
}

/** The live plan — asked for or agreed — of those given, if any. One at a time, by the database. */
export const livePlan = (plans: readonly PaymentPlanRecord[]) => plans.find((p) => p.status === 'proposed' || p.status === 'approved') ?? null;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** The first-due dates a plan may be asked for with: today to 30 days on. */
export const firstDueRange = (today: string) => ({ min: today, max: iso(Date.parse(`${today}T00:00:00Z`) + PLAN_FIRST_DUE_DAYS * 86_400_000) });

// ── Reconciliation with the payment provider ────────────────────────────────

export interface Settlement {
  provider_ref: string;
  amount_cents: number;
}

export interface ProviderReconciliation {
  provider_total_cents: number;
  ledger_total_cents: number;
  matched: number;
  missing: string[];
  extra: string[];
  differing: { provider_ref: string; provider_cents: number; ledger_cents: number }[];
}

/**
 * The provider's settlement for a period against the ledger's provider-backed
 * entries in it. Amounts are what moved through the provider: a payment
 * positive, a refund or chargeback negative. A reference the provider has and
 * the ledger does not is missing; the other way round is extra.
 */
export function reconcileProvider(settlement: readonly Settlement[], entries: readonly AccountEntry[], period: string): ProviderReconciliation {
  const ledger = new Map<string, number>();
  for (const e of entries) {
    if (e.period !== period || !PROVIDER_KINDS.includes(e.kind)) continue;
    ledger.set(e.provider_ref, (ledger.get(e.provider_ref) ?? 0) - e.amount_cents);
  }
  const provider = new Map<string, number>();
  for (const s of settlement) provider.set(s.provider_ref, (provider.get(s.provider_ref) ?? 0) + s.amount_cents);
  const missing: string[] = [];
  const differing: ProviderReconciliation['differing'] = [];
  let matched = 0;
  for (const [ref, cents] of provider) {
    const l = ledger.get(ref);
    if (l === undefined) missing.push(ref);
    else if (l !== cents) differing.push({ provider_ref: ref, provider_cents: cents, ledger_cents: l });
    else matched += 1;
  }
  const extra = [...ledger.keys()].filter((r) => !provider.has(r));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return { provider_total_cents: sum(provider), ledger_total_cents: sum(ledger), matched, missing, extra, differing };
}

/** A settlement export: provider reference and amount per row, amount in dollars or cents as its header says. */
export function parseSettlement(headers: readonly string[], rows: readonly string[][]): Settlement[] | { refused: string } {
  const h = headers.map((x) => x.trim().toLowerCase());
  const ref = h.findIndex((x) => x === 'provider_ref' || x === 'reference' || x === 'id');
  const cents = h.findIndex((x) => x === 'amount_cents');
  const dollars = h.findIndex((x) => x === 'amount');
  if (ref < 0 || (cents < 0 && dollars < 0)) return { refused: 'The file needs a provider_ref (or reference) column and an amount or amount_cents column.' };
  const out: Settlement[] = [];
  for (const [i, r] of rows.entries()) {
    const raw = (r[cents >= 0 ? cents : dollars] ?? '').trim();
    const neg = raw.startsWith('-');
    const n = cents >= 0 ? (/^-?\d+$/.test(raw) ? Number(raw) : null) : ((c) => (c === null ? null : neg ? -c : c))(parseCents(raw.replace(/^-/, '')));
    if (n === null) return { refused: `Row ${i + 1} has an amount that is not a number.` };
    out.push({ provider_ref: (r[ref] ?? '').trim(), amount_cents: n });
  }
  return out;
}

// ── Proposals, checked before the database is asked ────────────────────────

export interface Proposal {
  student_ref: string;
  kind: AccountKind;
  category: AccountCategory;
  amount_cents: number;
  description: string;
  reference_entry_id: string | null;
  provider_ref: string;
  effective_on: string;
}

/** Already refunded or charged back against a payment, in cents, as a positive number. */
export function returnedAgainst(entries: readonly AccountEntry[], paymentId: string): number {
  return entries.filter((e) => e.reference_entry_id === paymentId && (e.kind === 'refund' || e.kind === 'chargeback')).reduce((s, e) => s + e.amount_cents, 0);
}

export function proposalProblems(p: Proposal, entries: readonly AccountEntry[], closed: readonly string[]): string[] {
  const out: string[] = [];
  if (!STUDENT_REF.test(p.student_ref)) out.push('The student identifier is letters, digits, dots, dashes or underscores.');
  if (!Number.isSafeInteger(p.amount_cents) || p.amount_cents <= 0) out.push('Give an amount greater than zero.');
  if (p.description.trim().length < 3 || p.description.length > 200) out.push('Describe it, in 3 to 200 characters.');
  if (PAN.test(p.description) || PAN.test(p.provider_ref)) out.push('That looks like a card number. Card numbers are never recorded here.');
  const aid = AID_CATEGORIES.includes(p.category);
  if (p.kind === 'aid_credit' && !aid) out.push('An aid credit is a scholarship, waiver, discount or sponsorship.');
  if (p.kind !== 'aid_credit' && p.kind !== 'reversal' && aid) out.push('Scholarships, waivers, discounts and sponsorships are aid credits.');
  if (PROVIDER_KINDS.includes(p.kind) && !p.provider_ref.trim()) out.push('Give the payment provider’s reference.');
  if (!PROVIDER_KINDS.includes(p.kind) && p.provider_ref.trim()) out.push('Only payments, refunds and chargebacks carry a provider reference.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_on)) out.push('Give the date it takes effect.');
  else if (closed.includes(periodOf(p.effective_on))) out.push(`${periodOf(p.effective_on)} is closed; record it in an open month.`);
  const ref = p.reference_entry_id ? entries.find((e) => e.id === p.reference_entry_id) ?? null : null;
  if (REFERENCING_KINDS.includes(p.kind)) {
    if (!ref) out.push('Choose the entry this answers.');
    else if ((p.kind === 'refund' || p.kind === 'chargeback') && ref.kind !== 'payment') out.push('A refund or chargeback answers a payment.');
    else if (p.kind === 'reversal' && ref.kind === 'reversal') out.push('A reversal is not itself reversed; record a new entry.');
    else if (p.kind === 'reversal' && entries.some((e) => e.kind === 'reversal' && e.reference_entry_id === ref.id)) out.push('That entry has already been reversed.');
    else if (p.kind === 'reversal' && p.amount_cents !== Math.abs(ref.amount_cents)) out.push(`A reversal is for the whole entry, ${money(Math.abs(ref.amount_cents))}.`);
    else if ((p.kind === 'refund' || p.kind === 'chargeback') && p.amount_cents > -ref.amount_cents - returnedAgainst(entries, ref.id)) {
      out.push(`At most ${money(-ref.amount_cents - returnedAgainst(entries, ref.id))} of that payment is left to return.`);
    }
  } else if (p.reference_entry_id) out.push('Only refunds, reversals and chargebacks answer an earlier entry.');
  return out;
}

/** Whether approving this needs finance:approve_high, by the database's rule. */
export function needsHighApproval(p: Pick<Proposal, 'kind' | 'amount_cents'>, s: FinanceSettings = DEFAULT_SETTINGS): boolean {
  return HIGH_VALUE_KINDS.includes(p.kind) && p.amount_cents >= s.high_value_cents;
}

/** People who may not approve this request, beyond its own requester: for a refund, whoever put the payment on the ledger. */
export function barredApprovers(p: Pick<Proposal, 'kind' | 'reference_entry_id'>, entries: readonly AccountEntry[]): string[] {
  if (p.kind !== 'refund' && p.kind !== 'reversal' && p.kind !== 'chargeback') return [];
  const ref = entries.find((e) => e.id === p.reference_entry_id);
  return ref ? [ref.requested_by, ref.approved_by].filter((x): x is string => x !== null) : [];
}
