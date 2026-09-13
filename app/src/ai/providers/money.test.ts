import { describe, expect, it } from 'vitest';
import { costs } from './campus';
import { DEFAULT_PERSISTED, type State } from '../../state/shape';
import { buildCatalog } from '../../data/catalog';
import type { Aid, Charge, Payment } from '../../lib/bill';
import ECON from '../../data/courses/econ';

/**
 * What the assistant is told about money.
 *
 * `lib/bill.ts` refuses to average a real balance with a hoped-for one, and
 * `bill.test.ts` holds it to that. This is the other end of the same promise:
 * the provider is the one place a model could undo it, by being handed the two
 * figures under one name. These tests hold the two names apart, and hold the
 * account numbers that are not in the state to being absent from the payload.
 */

const NOW = new Date(2026, 8, 10, 9, 0);
const catalog = buildCatalog([ECON]);
const TERM = DEFAULT_PERSISTED.term;

const charge = (over: Partial<Charge> = {}): Charge => ({
  id: 'c1',
  term: TERM,
  what: 'Tuition, 15 hours',
  kind: 'tuition',
  cents: 3_200_000,
  at: 0,
  ...over,
});

const award = (over: Partial<Aid> = {}): Aid => ({
  id: 'a1',
  term: TERM,
  what: 'Need-based grant',
  kind: 'grant',
  cents: 2_000_000,
  pending: false,
  at: 0,
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  term: TERM,
  what: 'Instalment 1',
  cents: 100_000,
  on: '2026-08-25',
  at: 0,
  ...over,
});

const loaded = (over: Partial<State> = {}): State =>
  ({ ...DEFAULT_PERSISTED, courses: [ECON], ...over }) as State;

const look = (over: Partial<State> = {}) =>
  costs({ state: loaded(over), catalog, now: NOW });

describe('with nothing entered', () => {
  it('says so for both halves rather than quoting a zero balance', () => {
    const out = look();
    expect(out?.summary).toContain('no statement entered');
    expect(out?.summary).toContain('nothing recorded out of pocket');
    expect(out?.focus).toBeUndefined();
    expect(out?.visible).toEqual([]);
  });
});

describe('with a statement entered', () => {
  const held = {
    charges: [charge()],
    aid: [award()],
    payments: [] as Payment[],
    plans: { [TERM]: { parts: 5, first: '2026-08-25', everyMonths: 1 } },
  };

  it('leads with what is owed, not with what was charged', () => {
    expect(look(held)?.summary).toContain('$12,000.00 owed');
  });

  it('hands the figures over as figures the assistant can quote', () => {
    const focus = look(held)?.focus as Record<string, unknown>;
    expect(focus.charged).toBe('$32,000.00');
    expect(focus.covered_by_confirmed_aid).toBe('$20,000.00');
    expect(focus.owed).toBe('$12,000.00');
  });

  // The point of the whole file.
  it('keeps a hoped-for balance under a name that cannot be read as owed', () => {
    const focus = look({
      ...held,
      aid: [award(), award({ id: 'a2', cents: 500_000, pending: true })],
    })?.focus as Record<string, unknown>;
    expect(focus.owed).toBe('$12,000.00');
    expect(focus.unconfirmed_aid).toBe('$5,000.00');
    expect(focus.if_pending_aid_lands).toBe('$7,000.00');
  });

  it('says work-study is not credited, in the field name itself', () => {
    const focus = look({
      ...held,
      aid: [award(), award({ id: 'a2', kind: 'work', cents: 250_000 })],
    })?.focus as Record<string, unknown>;
    expect(focus.work_study_paid_to_you_not_the_bill).toBe('$2,500.00');
    expect(focus.owed).toBe('$12,000.00');
  });

  it('names the next payment and its date', () => {
    const focus = look(held)?.focus as Record<string, unknown>;
    expect(focus.next_payment).toBe('$2,400.00');
    expect(focus.next_payment_due).toBe('2026-08-25');
    expect(focus.overdue).toBe(true);
  });

  it('omits a payment it cannot date rather than inventing one', () => {
    const focus = look({ ...held, plans: {} })?.focus as Record<string, unknown>;
    expect(focus.next_payment).toBeUndefined();
    expect(focus.next_payment_due).toBeUndefined();
  });

  it('shows the bill rows when the bill tab is the one on screen', () => {
    const rows = look({ ...held, costsTab: 'bill', payments: [payment()] })?.visible as Record<
      string,
      unknown
    >[];
    expect(rows.map((r) => r.row)).toEqual(['charge', 'aid', 'payment']);
    expect(rows[1].credited_against_the_bill).toBe(true);
    expect(rows[1].confirmed).toBe(true);
  });

  // `visible` means visible: the other tab's rows are not on screen.
  it('shows the out-of-pocket rows when that is the tab on screen', () => {
    const rows = look({ ...held, costsTab: 'out' })?.visible as Record<string, unknown>[];
    expect(rows).toEqual([]);
    expect(look({ ...held, costsTab: 'out' })?.summary).toContain('$12,000.00 owed');
  });

  it('ignores the rows of another term entirely', () => {
    const out = look({ ...held, charges: [charge({ term: '2027SP' })] });
    expect(out?.summary).toContain('$0.00 charged');
  });
});
