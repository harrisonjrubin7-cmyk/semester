import { describe, expect, it } from 'vitest';
import { type CardReview, type Reviews } from './review';
import { inTime, type Test, type Tests } from './intime';
import { whyDue } from './whydue';

const DAY = 86_400_000;
/** A Tuesday at noon, so neither end of the day is in play. */
const NOW = new Date(2026, 8, 15, 12).getTime();
const K = 'econ:abc';

function rec(over: Partial<CardReview> = {}): CardReview {
  return {
    right: 3, wrong: 0, streak: 3, ease: 2.5, interval: 6,
    seen: NOW - 6 * DAY, due: NOW - DAY, ...over,
  };
}

function exam(days: number, kind = 'Midterm'): Tests {
  const at = new Date(2026, 8, 15 + days).getTime();
  const t: Test = { at, kind, days };
  return { econ: t };
}

const why = (reviews: Reviews, tests: Tests = {}) => whyDue(K, 'econ', reviews, tests, NOW);

describe('whyDue', () => {
  it('calls a card with no record, or a record never answered, new', () => {
    expect(why({}).kind).toBe('new');
    expect(why({ [K]: rec({ seen: 0 }) }).kind).toBe('new');
  });

  it('says a test is pulling the card forward, and names the test', () => {
    // Revised a month ago and put away past a midterm six days out.
    const r = { [K]: rec({ seen: NOW - 30 * DAY, due: NOW + 20 * DAY, interval: 45 }) };
    const w = why(r, exam(6));
    expect(w.kind).toBe('test');
    expect(w.says).toContain('midterm in 6 days');
  });

  it('reads the stored record, so a card inTime moved is still explained as moved', () => {
    // The whole reason the module takes the stored reviews: after `inTime`
    // the card is simply due, and the adjusted copy cannot say why.
    const stored = { [K]: rec({ seen: NOW - 30 * DAY, due: NOW + 20 * DAY, interval: 45 }) };
    const adjusted = inTime(stored, exam(6), NOW);
    expect(adjusted[K].due).toBeLessThan(stored[K].due);
    expect(why(stored, exam(6)).kind).toBe('test');
    expect(why(adjusted, exam(6)).kind).not.toBe('test');
  });

  it('does not claim a test when the card comes back before it anyway', () => {
    expect(why({ [K]: rec() }, exam(6)).kind).toBe('due');
  });

  it('ranks a test above everything else that is true of the card', () => {
    // Overdue and a repeat miss as well, and still the test is the reason given.
    const r = { [K]: rec({ seen: NOW - 30 * DAY, due: NOW + 20 * DAY, wrong: 7, streak: 0 }) };
    expect(why(r, exam(3)).kind).toBe('test');
  });

  it('names a card that keeps catching the student ahead of a plain miss', () => {
    const w = why({ [K]: rec({ wrong: 7, streak: 0, due: NOW - DAY }) });
    expect(w.kind).toBe('catching');
    expect(w.says).toContain('7 times');
  });

  it('says a miss brought it back sooner, even when it is not due yet', () => {
    // "Run it again" straight after a miss: due in ten minutes, dealt anyway.
    expect(why({ [K]: rec({ wrong: 1, streak: 0, due: NOW + 10 * 60_000 }) }).kind).toBe('missed');
    expect(why({ [K]: rec({ wrong: 1, streak: 0, due: NOW - DAY }) }).kind).toBe('missed');
  });

  it('counts overdue in calendar days', () => {
    expect(why({ [K]: rec({ due: NOW - 2 * 3_600_000 }) }).says).toMatch(/^Due today/);
    expect(why({ [K]: rec({ due: NOW - DAY }) }).says).toMatch(/^Due 1 day ago/);
    expect(why({ [K]: rec({ due: NOW - 3 * DAY }) }).says).toMatch(/^Due 3 days ago/);
  });

  it('explains a card that is here early rather than letting it look like a mistake', () => {
    expect(why({ [K]: rec({ due: NOW + 2 * 3_600_000 }) }).says).toMatch(/^Not due until later today/);
    expect(why({ [K]: rec({ due: NOW + DAY }) }).says).toMatch(/^Not due until tomorrow/);
    const w = why({ [K]: rec({ due: NOW + 5 * DAY }) });
    expect(w.kind).toBe('early');
    // Pinned whole: "Not due until in 5 days" passed a `toContain` and
    // shipped as far as the screenshot.
    expect(w.says).toMatch(/^Not due for 5 days\. /);
  });

  it('only reads the test for the card’s own course', () => {
    const r = { [K]: rec({ seen: NOW - 30 * DAY, due: NOW + 20 * DAY }) };
    expect(whyDue(K, 'psci', r, exam(6), NOW).kind).toBe('early');
  });
});
