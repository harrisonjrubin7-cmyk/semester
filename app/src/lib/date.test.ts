import { describe, expect, it } from 'vitest';
import {
  dateToIso,
  daysBetween,
  daysInMonth,
  dueLabel,
  isoToDate,
  realDate,
  sameDay,
  shiftIso,
  startOfDay,
} from './date';

/**
 * Dates are where a study app quietly ruins somebody's week. Every case here is
 * one that has bitten a calendar before: the day either side of midnight, the
 * hour either side of a daylight-saving change, and the round trip through the
 * ISO string that goes to storage and comes back.
 */
describe('dateToIso / isoToDate', () => {
  it('round-trips a date through storage unchanged', () => {
    const d = new Date(2026, 8, 3);
    expect(sameDay(isoToDate(dateToIso(d)), d)).toBe(true);
  });

  it('pads single-digit months and days', () => {
    expect(dateToIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('reads an ISO date as local midnight, not UTC', () => {
    // Parsing "2026-09-03" with `new Date()` gives UTC midnight, which is the
    // 2nd in every timezone west of Greenwich. That off-by-one moves a
    // deadline a day earlier for anyone in the Americas.
    const d = isoToDate('2026-09-03');
    expect(d.getDate()).toBe(3);
    expect(d.getMonth()).toBe(8);
    expect(d.getHours()).toBe(0);
  });

  it('survives the last day of a month and of a year', () => {
    for (const d of [new Date(2026, 1, 28), new Date(2026, 11, 31), new Date(2028, 1, 29)]) {
      expect(sameDay(isoToDate(dateToIso(d)), d)).toBe(true);
    }
  });
});

describe('startOfDay / sameDay', () => {
  it('collapses any time on a day to that day', () => {
    const morning = new Date(2026, 8, 3, 0, 1);
    const night = new Date(2026, 8, 3, 23, 59);
    expect(startOfDay(morning).getTime()).toBe(startOfDay(night).getTime());
    expect(sameDay(morning, night)).toBe(true);
  });

  it('does not confuse the same date in different months or years', () => {
    expect(sameDay(new Date(2026, 8, 3), new Date(2026, 9, 3))).toBe(false);
    expect(sameDay(new Date(2026, 8, 3), new Date(2027, 8, 3))).toBe(false);
  });
});

describe('daysBetween', () => {
  it('ignores the time of day', () => {
    const late = new Date(2026, 8, 3, 23, 30);
    const early = new Date(2026, 8, 4, 0, 30);
    expect(daysBetween(late, early)).toBe(1);
  });

  it('is negative for the past and zero for the same day', () => {
    expect(daysBetween(new Date(2026, 8, 4), new Date(2026, 8, 3))).toBe(-1);
    expect(daysBetween(new Date(2026, 8, 3, 9), new Date(2026, 8, 3, 21))).toBe(0);
  });

  it('counts correctly across a month boundary', () => {
    expect(daysBetween(new Date(2026, 8, 30), new Date(2026, 9, 1))).toBe(1);
  });

  it('counts correctly across a daylight-saving change', () => {
    // US DST ends 1 Nov 2026. A naive ms/86400000 gives 0.958 days here and
    // rounds to 1 only by luck; the day either side must still be one apart.
    expect(daysBetween(new Date(2026, 10, 1), new Date(2026, 10, 2))).toBe(1);
    expect(daysBetween(new Date(2026, 2, 8), new Date(2026, 2, 9))).toBe(1);
  });
});

describe('dueLabel', () => {
  const now = new Date(2026, 8, 3, 10, 0);

  it('says Tonight for a midnight deadline landing today', () => {
    expect(dueLabel(new Date(2026, 8, 3), now, '11:59 PM')).toBe('Tonight');
  });

  it('says Today for a daytime deadline landing today', () => {
    expect(dueLabel(new Date(2026, 8, 3), now, '1:15p')).toBe('Today');
  });

  it('names tomorrow and yesterday', () => {
    expect(dueLabel(new Date(2026, 8, 4), now, '1:15p')).toBe('Tomorrow');
    expect(dueLabel(new Date(2026, 8, 2), now, '1:15p')).toBe('Yesterday');
  });

  it('falls back to a dated label further out', () => {
    expect(dueLabel(new Date(2026, 8, 15), now, '1:15p')).toContain('Sep');
  });
});

describe('shiftIso', () => {
  it('moves a day forward and back', () => {
    expect(shiftIso('2026-09-06', 1)).toBe('2026-09-07');
    expect(shiftIso('2026-09-06', -1)).toBe('2026-09-05');
    expect(shiftIso('2026-09-06', 0)).toBe('2026-09-06');
  });

  it('lets the calendar decide what a month end means', () => {
    expect(shiftIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftIso('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIso('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('does not invent a 29th of February in a common year', () => {
    expect(shiftIso('2026-02-28', 1)).toBe('2026-03-01');
    // And does not skip one in a leap year.
    expect(shiftIso('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is its own inverse', () => {
    for (const iso of ['2026-01-31', '2026-02-28', '2026-11-30', '2026-12-31']) {
      expect(shiftIso(shiftIso(iso, 7), -7)).toBe(iso);
    }
  });
});

/**
 * A calendar day is one day, even when it is 23 or 25 hours long.
 *
 * `daysBetween` and `shiftIso` are load-bearing for every countdown in the
 * app — "2 days late", "24d", "the exam is in three weeks" — and both are
 * correct across a clock change only because of how they are written:
 * `daysBetween` rounds rather than truncating, and `shiftIso` moves the date
 * through a `Date` rather than adding milliseconds.
 *
 * Neither of those is obviously load-bearing to somebody tidying up later, so
 * this says it out loud. Written with `Math.floor`, `daysBetween` would call
 * the 8th and the 9th of March the same day, and the 20th of September and
 * the 4th of October thirteen days apart instead of fourteen — inside this
 * app's own Fall term, for anyone in Auckland.
 *
 * These assertions are trivially true in UTC, which has no clock changes, and
 * only bite in a zone that does. CI runs the suite in America/Chicago for
 * exactly that reason; see `.github/workflows/ci.yml`.
 */
describe('across a daylight-saving change', () => {
  const springForward: [Date, Date] = [new Date(2026, 2, 8), new Date(2026, 2, 9)];
  const overTheChange: [Date, Date] = [new Date(2026, 2, 1), new Date(2026, 2, 15)];
  const southernSpring: [Date, Date] = [new Date(2026, 8, 20), new Date(2026, 9, 4)];

  it('counts the short day as a whole day', () => {
    expect(daysBetween(...springForward)).toBe(1);
  });

  it('counts a fortnight containing one as a fortnight', () => {
    expect(daysBetween(...overTheChange)).toBe(14);
    // The same shape in the southern hemisphere, where the change lands in
    // the middle of this app's Fall semester rather than before it.
    expect(daysBetween(...southernSpring)).toBe(14);
  });

  it('is symmetric across one', () => {
    expect(daysBetween(springForward[1], springForward[0])).toBe(-1);
  });

  it('moves a date by whole days rather than by fixed hours', () => {
    expect(shiftIso('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftIso('2026-09-27', 1)).toBe('2026-09-28');
    expect(shiftIso('2026-11-01', 1)).toBe('2026-11-02');
    // And back again, which is where a millisecond-based shift would drift.
    expect(shiftIso(shiftIso('2026-03-01', 14), -14)).toBe('2026-03-01');
    expect(shiftIso(shiftIso('2026-09-20', 14), -14)).toBe('2026-09-20');
  });
});

/**
 * A date that is not a date.
 *
 * Two files checked one by asking whether the day was between 1 and 31, and
 * then handed it to `new Date(year, month, day)` — which does not refuse 31
 * April, it answers 1 May. `lib/generate.ts` was already writing the sentence
 * for the case it was letting through: *its date (3/31) is not a real one*.
 */
describe('whether a day exists', () => {
  it('knows the short months', () => {
    // April, June, September, November — 30 in every year there has been.
    for (const month of [3, 5, 8, 10]) {
      expect(realDate(month, 30), `month ${month} day 30`).toBe(true);
      expect(realDate(month, 31), `month ${month} day 31`).toBe(false);
    }
  });

  it('keeps every day of a 31-day month', () => {
    for (const month of [0, 2, 4, 6, 7, 9, 11]) {
      expect(realDate(month, 31), `month ${month} day 31`).toBe(true);
    }
  });

  it('refuses a February that never happens, whatever the year', () => {
    expect(realDate(1, 30)).toBe(false);
    expect(realDate(1, 31)).toBe(false);
  });

  it('reads the 29th against the year when it is given one', () => {
    expect(realDate(1, 29, 2024)).toBe(true);
    expect(realDate(1, 29, 2027)).toBe(false);
    // The centuries, which is the whole reason the rule is not "every four".
    expect(daysInMonth(1, 1900)).toBe(28);
    expect(daysInMonth(1, 2000)).toBe(29);
  });

  it('keeps the 29th when no year was given', () => {
    // A caller that cannot say which year it is should not be the one to
    // throw away a date that might be real.
    expect(realDate(1, 29)).toBe(true);
    expect(daysInMonth(1)).toBe(29);
  });

  it('refuses a month or a day that is not a whole number in range', () => {
    expect(realDate(-1, 5)).toBe(false);
    expect(realDate(12, 5)).toBe(false);
    expect(realDate(5, 0)).toBe(false);
    expect(realDate(5.5, 5)).toBe(false);
    expect(realDate(5, 2.5)).toBe(false);
    expect(realDate(NaN, 5)).toBe(false);
  });
});
