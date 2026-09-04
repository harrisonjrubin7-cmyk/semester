import { describe, expect, it } from 'vitest';
import {
  cashLine,
  dayLabel,
  forTerm,
  pace,
  paceLine,
  readSwipes,
  staleLine,
  type Balance,
} from './meals';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 15, 12, 0); // 15 October 2026
const ENDS = new Date(2026, 11, 10); // 10 December — 56 days off

const reading = (over: Partial<Balance> = {}): Balance => ({
  id: 'b1',
  at: NOW.getTime(),
  swipes: 112,
  cashCents: 4250,
  diningCents: 0,
  term: '2026FA',
  ...over,
});

describe('reading a swipe count somebody typed', () => {
  it('takes a plain number', () => {
    expect(readSwipes('112')).toBe(112);
    expect(readSwipes(' 41 ')).toBe(41);
    expect(readSwipes('0')).toBe(0);
  });

  it('refuses rather than guessing at zero', () => {
    expect(readSwipes('about forty')).toBeNull();
    expect(readSwipes('')).toBeNull();
    expect(readSwipes('-3')).toBeNull();
    expect(readSwipes('4.5')).toBeNull();
  });
});

describe('what the balance means', () => {
  it('says nothing about a rate from one reading', () => {
    // A single balance is a fact about today. It says nothing about eating.
    const p = pace([reading()], ENDS, NOW);
    expect(p.known).toBe(false);
    expect(p.allowance).toBe(2);
    expect(paceLine(reading(), p)).toMatch(/Log the balance again in a few days/);
  });

  it('reads a rate from two readings far enough apart', () => {
    const readings = [
      reading({ id: 'a', at: NOW.getTime() - 10 * DAY, swipes: 136 }),
      reading({ id: 'b', swipes: 112 }),
    ];
    const p = pace(readings, ENDS, NOW);
    expect(p.known).toBe(true);
    expect(p.rate).toBe(2.4);
  });

  it('ignores two readings a day apart, which is noise', () => {
    // One heavy Saturday would otherwise read as a habit.
    const readings = [
      reading({ id: 'a', at: NOW.getTime() - DAY, swipes: 115 }),
      reading({ id: 'b', swipes: 112 }),
    ];
    expect(pace(readings, ENDS, NOW).known).toBe(false);
  });

  it('names the day the swipes run out', () => {
    const readings = [
      reading({ id: 'a', at: NOW.getTime() - 10 * DAY, swipes: 136 }),
      reading({ id: 'b', swipes: 112 }),
    ];
    const p = pace(readings, ENDS, NOW);
    // 112 at 2.4 a day is 46 days, which lands before the 10th of December.
    expect(p.dry && dayLabel(p.dry)).toBe('Nov 30');
    expect(paceLine(readings[1], p)).toMatch(/runs out on Nov 30/);
  });

  it('says it lasts when it lasts, rather than naming a date past the term', () => {
    const readings = [
      reading({ id: 'a', at: NOW.getTime() - 10 * DAY, swipes: 122 }),
      reading({ id: 'b', swipes: 112 }),
    ];
    const p = pace(readings, ENDS, NOW);
    expect(p.dry).toBeNull();
    expect(paceLine(readings[1], p)).toMatch(/which lasts the term/);
  });

  it('does not read a top-up as eating backwards', () => {
    const readings = [
      reading({ id: 'a', at: NOW.getTime() - 10 * DAY, swipes: 80 }),
      reading({ id: 'b', swipes: 112 }),
    ];
    expect(pace(readings, ENDS, NOW).known).toBe(false);
  });

  it('asks for the term’s end rather than inventing one', () => {
    const p = pace([reading()], null, NOW);
    expect(p.daysLeft).toBe(0);
    expect(paceLine(reading(), p)).toMatch(/Set the term's last day under Term deadlines/);
  });

  it('says so plainly for a plan with no swipes on it', () => {
    const cashOnly = reading({ swipes: -1 });
    expect(paceLine(cashOnly, pace([cashOnly], ENDS, NOW))).toMatch(/No board plan logged/);
  });

  it('says nothing at all with nothing logged', () => {
    expect(paceLine(undefined, pace([], ENDS, NOW))).toBe('Nothing logged yet.');
  });
});

describe('the cash halves', () => {
  it('states each that the plan carries', () => {
    expect(cashLine(reading({ cashCents: 4250, diningCents: 12000 }))).toBe(
      '$42.50 Commodore Cash · $120.00 meal money',
    );
  });

  it('leaves out a balance the plan does not have', () => {
    expect(cashLine(reading({ cashCents: 4250, diningCents: -1 }))).toBe('$42.50 Commodore Cash');
  });
});

describe('how fresh a reading is', () => {
  it('says when it was read', () => {
    expect(staleLine(reading(), NOW)).toBe('Read today.');
    expect(staleLine(reading({ at: NOW.getTime() - DAY }), NOW)).toBe('Read yesterday.');
    expect(staleLine(reading({ at: NOW.getTime() - 4 * DAY }), NOW)).toBe('Read 4 days ago.');
  });

  it('warns when it is old enough to be wrong', () => {
    expect(staleLine(reading({ at: NOW.getTime() - 20 * DAY }), NOW)).toMatch(
      /worth checking the site again/,
    );
  });
});

describe('slicing by term', () => {
  it('takes one term, newest first', () => {
    const all = [
      reading({ id: 'a', at: 1, term: '2026FA' }),
      reading({ id: 'b', at: 2, term: '2026FA' }),
      reading({ id: 'c', at: 3, term: '2027SP' }),
    ];
    expect(forTerm(all, '2026FA').map((r) => r.id)).toEqual(['b', 'a']);
  });
});
