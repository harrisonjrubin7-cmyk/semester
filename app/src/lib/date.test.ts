import { describe, expect, it } from 'vitest';
import { dateToIso, daysBetween, dueLabel, isoToDate, sameDay, startOfDay } from './date';

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
