import { describe, expect, it } from 'vitest';
import {
  DISCLOSURE_CENTS,
  DISCLOSURE_DAYS,
  NIL_AS_AT,
  NIL_TERMS,
  aggregate,
  businessDaysAfter,
  crossings,
  prompts,
  readNil,
  yearTotal,
  years,
  type NilDeal,
} from './nil';

const deal = (over: Partial<NilDeal> & { date: string; cents: number }): NilDeal => ({
  id: `${over.date}-${over.cents}-${over.counterparty ?? 'x'}`,
  counterparty: 'Local Gym',
  description: 'Two posts and an appearance',
  associated: 'no',
  reported: false,
  ...over,
});

describe('five business days', () => {
  it('skips the weekend rather than counting it', () => {
    // Wed 16 Sep 2026 + 5 weekdays = Wed 23 Sep.
    expect(businessDaysAfter('2026-09-16', 5)).toBe('2026-09-23');
  });

  it('counts from a Friday into the week after', () => {
    // Fri 18 Sep + 5 weekdays = Fri 25 Sep.
    expect(businessDaysAfter('2026-09-18', 5)).toBe('2026-09-25');
  });

  /*
   * A deal agreed on a Saturday is agreed on a Saturday. The count starts
   * from the next weekday either way, and the important property is that it
   * never lands on one.
   */
  it('never lands on a weekend', () => {
    for (const start of ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']) {
      const out = new Date(`${businessDaysAfter(start, DISCLOSURE_DAYS)}T12:00`).getDay();
      expect(out).not.toBe(0);
      expect(out).not.toBe(6);
    }
  });

  it('crosses a month end without arithmetic of its own', () => {
    expect(businessDaysAfter('2026-09-28', 5)).toBe('2026-10-05');
  });
});

describe('the $600 aggregate', () => {
  it('fires on one deal at the threshold exactly', () => {
    const out = crossings([deal({ date: '2026-09-16', cents: DISCLOSURE_CENTS })]);
    expect(out).toHaveLength(1);
    expect(out[0].due).toBe('2026-09-23');
  });

  it('does not fire a cent below it', () => {
    expect(crossings([deal({ date: '2026-09-16', cents: DISCLOSURE_CENTS - 1 })])).toEqual([]);
  });

  /*
   * The case the word "aggregate" exists for, and the one a threshold check
   * on each deal in isolation misses entirely: four payments of $200 from one
   * company, none of which is reportable on its own.
   */
  it('adds several small payments from one payer up across the year', () => {
    const out = crossings([
      deal({ date: '2026-03-01', cents: 20_000 }),
      deal({ date: '2026-05-01', cents: 20_000 }),
      deal({ date: '2026-07-01', cents: 20_000 }),
      deal({ date: '2026-09-01', cents: 20_000 }),
    ]);
    expect(out).toHaveLength(1);
    // The clock runs from the deal that took it over, not from the first.
    expect(out[0].deal.date).toBe('2026-07-01');
    expect(out[0].cents).toBe(60_000);
  });

  it('keeps two payers apart, however much each of them paid', () => {
    const out = crossings([
      deal({ date: '2026-03-01', cents: 50_000, counterparty: 'Local Gym' }),
      deal({ date: '2026-03-02', cents: 50_000, counterparty: 'Car Dealership' }),
    ]);
    expect(out).toEqual([]);
  });

  it('matches a payer whatever case and spacing it was typed in', () => {
    const out = crossings([
      deal({ date: '2026-03-01', cents: 30_000, counterparty: 'Local Gym' }),
      deal({ date: '2026-04-01', cents: 30_000, counterparty: ' local gym ' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('starts the count again in a new calendar year', () => {
    const out = crossings([
      deal({ date: '2026-11-01', cents: 40_000 }),
      deal({ date: '2027-02-01', cents: 40_000 }),
    ]);
    expect(out).toEqual([]);
  });

  /*
   * One crossing per payer per year. The obligation began at the first one,
   * and a second row would read as a second deadline for the same thing.
   */
  it('reports the crossing once, not on every deal after it', () => {
    const out = crossings([
      deal({ date: '2026-03-01', cents: 60_000 }),
      deal({ date: '2026-04-01', cents: 60_000 }),
      deal({ date: '2026-05-01', cents: 60_000 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].deal.date).toBe('2026-03-01');
  });

  it('attributes the crossing by date, not by the order they were typed in', () => {
    const out = crossings([
      deal({ date: '2026-07-01', cents: 40_000 }),
      deal({ date: '2026-03-01', cents: 40_000 }),
    ]);
    expect(out[0].deal.date).toBe('2026-07-01');
  });
});

describe('the totals the screen shows beside it', () => {
  const all = [
    deal({ date: '2026-03-01', cents: 30_000, counterparty: 'Local Gym' }),
    deal({ date: '2026-04-01', cents: 45_000, counterparty: 'Car Dealership' }),
    deal({ date: '2025-04-01', cents: 10_000, counterparty: 'Local Gym' }),
  ];

  it('counts one payer in one year', () => {
    expect(aggregate(all, 'Local Gym', '2026')).toBe(30_000);
  });

  it('counts the plain year total too, so both readings are visible', () => {
    expect(yearTotal(all, '2026')).toBe(75_000);
  });

  it('lists the years there is anything in, most recent first', () => {
    expect(years(all)).toEqual(['2026', '2025']);
  });
});

describe('the prompts, which are questions and never findings', () => {
  const all = [deal({ date: '2026-09-16', cents: 70_000, associated: 'yes' })];

  it('points at a conversation for school-associated money', () => {
    const out = prompts(all[0], all);
    expect(out[0].points).toBe(true);
  });

  /*
   * Unsure points as hard as yes. Somebody who cannot tell whether a payer is
   * connected to their school is exactly the person who should ask, and a
   * check that only caught the confident answer would catch nobody.
   */
  it('points just as hard when the student was not sure', () => {
    const unsure = [deal({ date: '2026-09-16', cents: 10_000, associated: 'unsure' })];
    expect(prompts(unsure[0], unsure)[0].points).toBe(true);
  });

  it('does not point for unconnected money below the threshold', () => {
    const quiet = [deal({ date: '2026-09-16', cents: 10_000, associated: 'no' })];
    expect(prompts(quiet[0], quiet).every((p) => !p.points)).toBe(true);
  });

  /*
   * The wording is the whole of the care taken here. A study app is not
   * entitled to tell somebody their contract is non-compliant, and the
   * difference between "worth asking about" and "this is a violation" is the
   * difference between a prompt and a determination.
   */
  it('never states a verdict, in any of its answers', () => {
    const said = [...prompts(all[0], all).map((p) => `${p.ask} ${p.says}`)].join(' ');
    expect(said).not.toMatch(/violat|non-?compliant|ineligible|not allowed|illegal|prohibited|you must/i);
  });
});

describe('the explainer', () => {
  it('carries a date it was last read, because a stale rule that looks current is the danger', () => {
    expect(NIL_AS_AT).toMatch(/^\d{4}-\d\d-\d\d$/);
  });

  it('gives every term a source and a link, rather than asserting it', () => {
    expect(NIL_TERMS).toHaveLength(4);
    for (const t of NIL_TERMS) {
      expect(t.source.trim()).not.toBe('');
      expect(t.url).toMatch(/^https:\/\//);
      // The half people get wrong is not optional.
      expect(t.careful.trim()).not.toBe('');
    }
  });

  it('paraphrases rather than telling anybody what they are permitted to do', () => {
    const all = NIL_TERMS.map((t) => `${t.plain} ${t.careful}`).join(' ');
    expect(all).not.toMatch(/you are (allowed|permitted|cleared)|this is compliant|you do not need to report/i);
  });
});

describe('reading a stored record', () => {
  const good = {
    version: 1,
    deals: [
      {
        id: 'a',
        date: '2026-09-16',
        counterparty: 'Local Gym',
        cents: 60_000,
        description: 'Two posts',
        associated: 'no',
        reported: false,
      },
    ],
  };

  it('keeps a well-formed record through a round trip', () => {
    expect(readNil(good).deals).toHaveLength(1);
  });

  /*
   * Money is cents as integers, for `lib/cost.ts`'s reason: `19.99 + 0.1` is
   * not 20.09 in binary floating point, and a total out by a cent for no
   * visible reason is what makes somebody stop trusting every other number.
   */
  it('refuses a fractional cent, a bad date and an unknown association', () => {
    expect(() => readNil({ ...good, deals: [{ ...good.deals[0], cents: 600.5 }] })).toThrow();
    expect(() => readNil({ ...good, deals: [{ ...good.deals[0], date: 'September' }] })).toThrow();
    expect(() => readNil({ ...good, deals: [{ ...good.deals[0], associated: 'maybe' }] })).toThrow();
    expect(() => readNil({ ...good, deals: [{ ...good.deals[0], cents: -100 }] })).toThrow();
    expect(() => readNil({ version: 2, deals: [] })).toThrow();
  });

  it('refuses two deals sharing an id, which would make one un-deletable', () => {
    expect(() => readNil({ ...good, deals: [good.deals[0], { ...good.deals[0] }] })).toThrow();
  });
});
