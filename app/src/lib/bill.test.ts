import { describe, expect, it } from 'vitest';
import {
  addMonths,
  billFor,
  nextPayment,
  aidKindOf,
  chargeKindOf,
  forTerm,
  line,
  nextDue,
  owed,
  paid,
  schedule,
  split,
  todo,
  type Aid,
  type Charge,
  type Payment,
  type Held,
  type Plan,
} from './bill';

const TERM = '2026FA';
const NOW = new Date(2026, 8, 10, 9, 0); // 10 September 2026

const charge = (over: Partial<Charge> = {}): Charge => ({
  id: 'c1',
  term: TERM,
  what: 'Tuition, 15 hours',
  kind: 'tuition',
  cents: 3_200_000,
  at: NOW.getTime(),
  ...over,
});

const award = (over: Partial<Aid> = {}): Aid => ({
  id: 'a1',
  term: TERM,
  what: 'Need-based grant',
  kind: 'grant',
  cents: 2_000_000,
  pending: false,
  at: NOW.getTime(),
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  term: TERM,
  what: 'Instalment 1',
  cents: 100_000,
  on: '2026-08-25',
  at: NOW.getTime(),
  ...over,
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  parts: 5,
  first: '2026-08-25',
  everyMonths: 1,
  ...over,
});

describe('the kind tables', () => {
  it('credits grants, scholarships and loans against the statement', () => {
    expect(aidKindOf('grant').credits).toBe(true);
    expect(aidKindOf('scholarship').credits).toBe(true);
    expect(aidKindOf('loan').credits).toBe(true);
  });

  it('does not credit work-study, which is paid to you for hours worked', () => {
    expect(aidKindOf('work').credits).toBe(false);
  });

  it('marks only the loan as repaid', () => {
    expect(AID_REPAID).toEqual(['loan']);
  });

  it('falls back rather than returning undefined for an unknown id', () => {
    expect(aidKindOf('nonsense').id).toBe('other');
    expect(chargeKindOf('nonsense').id).toBe('other');
  });
});

const AID_REPAID = ['grant', 'scholarship', 'loan', 'work', 'other'].filter(
  (k) => aidKindOf(k).repaid,
);

describe('what is owed', () => {
  it('says nothing is entered rather than showing a zero bill', () => {
    const o = owed([], []);
    expect(o.owedCents).toBe(0);
    expect(line(o)).toBe('Nothing off your statement yet.');
  });

  it('subtracts confirmed credited aid from the charges', () => {
    const o = owed([charge()], [award()]);
    expect(o.chargesCents).toBe(3_200_000);
    expect(o.creditedCents).toBe(2_000_000);
    expect(o.owedCents).toBe(1_200_000);
  });

  it('keeps pending aid out of what is owed, and reports it on its own', () => {
    const o = owed([charge()], [award(), award({ id: 'a2', cents: 500_000, pending: true })]);
    expect(o.creditedCents).toBe(2_000_000);
    expect(o.pendingCents).toBe(500_000);
    expect(o.owedCents).toBe(1_200_000);
    expect(o.bestCaseCents).toBe(700_000);
    expect(o.unconfirmed).toHaveLength(1);
  });

  // The mistake this whole file exists for.
  it('does not subtract work-study, which never reaches the statement', () => {
    const o = owed([charge()], [award(), award({ id: 'a2', kind: 'work', cents: 250_000 })]);
    expect(o.earnedCents).toBe(250_000);
    expect(o.owedCents).toBe(1_200_000);
    expect(o.bestCaseCents).toBe(1_200_000);
  });

  it('counts a loan as covering the bill and as borrowed, both', () => {
    const o = owed([charge()], [award({ kind: 'loan', cents: 700_000 })]);
    expect(o.creditedCents).toBe(700_000);
    expect(o.borrowedCents).toBe(700_000);
    expect(o.owedCents).toBe(2_500_000);
  });

  it('does not count a pending loan as borrowed yet', () => {
    const o = owed([charge()], [award({ kind: 'loan', cents: 700_000, pending: true })]);
    expect(o.borrowedCents).toBe(0);
    expect(o.pendingCents).toBe(700_000);
  });

  it('lets the balance go negative, because a refund is a real state', () => {
    const o = owed([charge({ cents: 1_000_000 })], [award({ cents: 1_124_000 })]);
    expect(o.owedCents).toBe(-124_000);
    expect(line(o)).toBe(
      '$1,240.00 more aid than charges — that comes back to you as a refund.',
    );
  });

  it('reads the covered-exactly case as covered rather than as zero owed', () => {
    expect(line(owed([charge({ cents: 500_000 })], [award({ cents: 500_000 })]))).toBe(
      '$5,000.00 charged, covered to the cent.',
    );
  });

  it('names the no-aid case rather than implying aid of zero', () => {
    expect(line(owed([charge({ cents: 500_000 })], []))).toBe(
      '$5,000.00 owed, with no aid entered against it.',
    );
  });

  it('handles aid entered before any charges are', () => {
    expect(line(owed([], [award({ cents: 400_000 })]))).toBe(
      '$4,000.00 in aid, and no charges entered yet.',
    );
  });
});

describe('one term at a time', () => {
  it('filters by term, so a total means one semester', () => {
    const rows = [charge(), charge({ id: 'c2', term: '2027SP' })];
    expect(forTerm(rows, TERM)).toHaveLength(1);
    expect(forTerm(rows, '2027SP')).toHaveLength(1);
    expect(forTerm(rows, '2028FA')).toHaveLength(0);
  });
});

describe('splitting a balance into instalments', () => {
  it('adds back up to the balance exactly, for every number of parts', () => {
    for (let parts = 1; parts <= 12; parts++) {
      for (const cents of [1, 7, 99, 100, 1_843_217, 3_200_001, 999_999_999]) {
        const parts_ = split(cents, parts);
        expect(parts_).toHaveLength(parts);
        expect(parts_.reduce((n, p) => n + p, 0)).toBe(cents);
      }
    }
  });

  it('puts the odd cents on the earliest instalments', () => {
    expect(split(1_843_217, 5)).toEqual([368_644, 368_644, 368_643, 368_643, 368_643]);
  });

  it('never leaves the last instalment the largest', () => {
    const parts = split(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(Math.max(...parts)).toBe(parts[0]);
  });

  it('divides into whole cents and never into fractions', () => {
    for (const part of split(10, 3)) expect(Number.isInteger(part)).toBe(true);
  });

  it('returns nothing for a balance of zero or a credit', () => {
    expect(split(0, 5)).toEqual([]);
    expect(split(-5000, 5)).toEqual([]);
  });

  it('treats a plan of zero or a fraction of a part as paying in full', () => {
    expect(split(1000, 0)).toEqual([1000]);
    expect(split(1000, 1)).toEqual([1000]);
    expect(split(1000, 2.7)).toEqual([500, 500]);
  });
});

describe('a month later', () => {
  it('moves to the same day of the next month', () => {
    expect(addMonths('2026-08-25', 1)).toBe('2026-09-25');
    expect(addMonths('2026-08-25', 4)).toBe('2026-12-25');
  });

  it('crosses the year boundary', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  // setMonth alone turns this into 3 March, which would move a due date.
  it('clamps to the end of a shorter month rather than rolling over', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('leaves the date alone for zero months', () => {
    expect(addMonths('2026-08-25', 0)).toBe('2026-08-25');
  });
});

describe('the schedule', () => {
  it('dates each instalment a month on from the first', () => {
    const rows = schedule(1_843_217, plan());
    expect(rows.map((r) => r.due)).toEqual([
      '2026-08-25',
      '2026-09-25',
      '2026-10-25',
      '2026-11-25',
      '2026-12-25',
    ]);
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.reduce((n, r) => n + r.cents, 0)).toBe(1_843_217);
  });

  it('honours a plan that runs every other month', () => {
    const rows = schedule(90_000, plan({ parts: 3, everyMonths: 2 }));
    expect(rows.map((r) => r.due)).toEqual(['2026-08-25', '2026-10-25', '2026-12-25']);
  });

  it('shows nothing rather than a date it invented, with no first date', () => {
    expect(schedule(1_843_217, plan({ first: '' }))).toEqual([]);
  });

  it('shows nothing where there is nothing to pay', () => {
    expect(schedule(0, plan())).toEqual([]);
    expect(schedule(-50_000, plan())).toEqual([]);
  });

  it('is a single instalment on the due date when paying in full', () => {
    expect(schedule(500_000, plan({ parts: 1 }))).toEqual([
      { n: 1, cents: 500_000, due: '2026-08-25' },
    ]);
  });
});

describe('the next payment due', () => {
  const rows = schedule(1_843_217, plan()); // 368644, 368644, 368643, 368643, 368643

  it('is the first instalment when nothing has been paid', () => {
    const next = nextDue(rows, [], NOW);
    expect(next?.instalment.n).toBe(1);
    expect(next?.shortCents).toBe(368_644);
  });

  it('knows an instalment in the past is overdue, and by how long', () => {
    const next = nextDue(rows, [], NOW);
    expect(next?.overdue).toBe(true);
    expect(next?.daysAway).toBe(-16); // 25 August to 10 September
  });

  it('is not overdue on the day it falls due', () => {
    const next = nextDue(schedule(500_000, plan({ first: '2026-09-10' })), [], NOW);
    expect(next?.daysAway).toBe(0);
    expect(next?.overdue).toBe(false);
  });

  it('moves on once an instalment is settled exactly', () => {
    const next = nextDue(rows, [payment({ cents: 368_644 })], NOW);
    expect(next?.instalment.n).toBe(2);
    expect(next?.shortCents).toBe(368_644);
  });

  it('reports a part-paid instalment as short by the remainder', () => {
    const next = nextDue(rows, [payment({ cents: 100_000 })], NOW);
    expect(next?.instalment.n).toBe(1);
    expect(next?.shortCents).toBe(268_644);
  });

  // A round payment over the instalment amount, which is what people actually do.
  it('spills an overpayment forward rather than losing it', () => {
    const next = nextDue(rows, [payment({ cents: 400_000 })], NOW);
    expect(next?.instalment.n).toBe(2);
    expect(next?.shortCents).toBe(337_288); // 368644 − (400000 − 368644)
  });

  it('adds several payments together before applying them', () => {
    const next = nextDue(
      rows,
      [payment({ cents: 200_000 }), payment({ id: 'p2', cents: 168_644 })],
      NOW,
    );
    expect(next?.instalment.n).toBe(2);
  });

  it('is nothing once the plan is paid off', () => {
    expect(nextDue(rows, [payment({ cents: 1_843_217 })], NOW)).toBeNull();
    expect(nextDue(rows, [payment({ cents: 2_000_000 })], NOW)).toBeNull();
  });

  it('is nothing where there is no schedule to be due against', () => {
    expect(nextDue([], [], NOW)).toBeNull();
  });

  it('totals what has been paid', () => {
    expect(paid([payment({ cents: 100_000 }), payment({ id: 'p2', cents: 23_450 })])).toBe(123_450);
    expect(paid([])).toBe(0);
  });
});

describe('what is worth doing about it', () => {
  it('says nothing when there is nothing to say', () => {
    expect(todo(owed([charge()], [award({ cents: 3_200_000 })]), null)).toEqual([]);
  });

  it('names the figure that is real beside the one that is hoped for', () => {
    const o = owed([charge()], [award(), award({ id: 'a2', cents: 500_000, pending: true })]);
    expect(todo(o, null)[0]).toBe(
      '1 award is still unconfirmed, $5,000.00 of them. Until it lands you owe $12,000.00, not $7,000.00.',
    );
  });

  it('explains work-study rather than just leaving it out of the total', () => {
    const o = owed([charge()], [award({ kind: 'work', cents: 250_000 })]);
    expect(todo(o, null).some((s) => s.includes('paid to you for hours worked'))).toBe(true);
  });

  it('says how much of the cover is borrowed', () => {
    const o = owed([charge()], [award({ kind: 'loan', cents: 700_000 })]);
    expect(todo(o, null).some((s) => s.includes('$7,000.00 of what covers the bill is borrowed'))).toBe(
      true,
    );
  });

  it('reads a late instalment as late, with the consequence', () => {
    const rows = schedule(500_000, plan({ parts: 1, first: '2026-09-09' }));
    const said = todo(owed([charge()], []), nextDue(rows, [], NOW));
    expect(said.some((s) => s.includes('due yesterday'))).toBe(true);
    expect(said.some((s) => s.includes("hold on next term's registration"))).toBe(true);
  });

  it('reads today as today rather than as in zero days', () => {
    const rows = schedule(500_000, plan({ parts: 1, first: '2026-09-10' }));
    expect(todo(owed([], []), nextDue(rows, [], NOW)).some((s) => s.includes('due today'))).toBe(
      true,
    );
  });

  it('counts the days to one that has not come yet', () => {
    const rows = schedule(500_000, plan({ parts: 1, first: '2026-09-11' }));
    expect(todo(owed([], []), nextDue(rows, [], NOW))[0]).toBe(
      'Instalment 1 — $5,000.00 — is due in 1 day.',
    );
  });
});

describe('one term, in one call', () => {
  const held = (over: Partial<Held> = {}): Held => ({
    charges: [charge()],
    aid: [award()],
    payments: [],
    plans: { [TERM]: plan() },
    ...over,
  });

  it('reads the lists, the plan and the clock as one picture', () => {
    const b = billFor(held(), TERM, NOW);
    expect(b.owed.owedCents).toBe(1_200_000);
    expect(b.instalments).toHaveLength(5);
    expect(b.instalments.reduce((n, i) => n + i.cents, 0)).toBe(1_200_000);
    expect(b.next?.instalment.n).toBe(1);
    expect(b.any).toBe(true);
  });

  it('ignores another term entirely', () => {
    const b = billFor(held(), '2027SP', NOW);
    expect(b.owed.chargesCents).toBe(0);
    expect(b.instalments).toEqual([]);
    expect(b.any).toBe(false);
  });

  // `owed` reports a credit honestly as a negative; a schedule of negative
  // instalments is not a thing, and this is the one place that is clamped.
  it('schedules nothing against a credit balance', () => {
    const b = billFor(held({ aid: [award({ cents: 4_000_000 })] }), TERM, NOW);
    expect(b.owed.owedCents).toBe(-800_000);
    expect(b.instalments).toEqual([]);
    expect(b.next).toBeNull();
  });

  it('counts what has been paid against this term only', () => {
    const b = billFor(
      held({ payments: [payment(), payment({ id: 'p2', term: '2027SP', cents: 999 })] }),
      TERM,
      NOW,
    );
    expect(b.paidCents).toBe(100_000);
  });

  it('knows a term holds something even with charges alone', () => {
    expect(billFor(held({ aid: [], plans: {} }), TERM, NOW).any).toBe(true);
    expect(billFor({ charges: [], aid: [], payments: [], plans: {} }, TERM, NOW).any).toBe(false);
  });
});

describe('the next payment, for the reminder and for Today', () => {
  const held: Held = {
    charges: [charge()],
    aid: [award()],
    payments: [],
    plans: { [TERM]: plan() },
  };

  it('is the date and what is still outstanding on it', () => {
    expect(nextPayment(held, TERM, NOW)).toEqual({ due: '2026-08-25', cents: 240_000 });
  });

  it('reports the remainder rather than the instalment, once part of it is paid', () => {
    const part = { ...held, payments: [payment({ cents: 40_000 })] };
    expect(nextPayment(part, TERM, NOW)).toEqual({ due: '2026-08-25', cents: 200_000 });
  });

  it('is nothing once the balance is settled, so nothing fires', () => {
    const done = { ...held, payments: [payment({ cents: 1_200_000 })] };
    expect(nextPayment(done, TERM, NOW)).toBeNull();
  });

  it('is nothing where no date has been entered, rather than a date it invented', () => {
    expect(nextPayment({ ...held, plans: {} }, TERM, NOW)).toBeNull();
  });

  it('is nothing where no bill has been entered at all', () => {
    expect(nextPayment({ charges: [], aid: [], payments: [], plans: {} }, TERM, NOW)).toBeNull();
  });
});
