import { describe, expect, it } from 'vitest';
import {
  EVERY,
  defaultUntil,
  describe as describeRepeat,
  everyNamed,
  howMany,
  occurrences,
  occursOn,
  rrule,
  skip,
  type Repeat,
} from './repeat';

/**
 * Something that happens again.
 *
 * The cases here are the ones that produce a plausible wrong answer rather
 * than an obvious one — a rule that eats the day it was made on, a monthly
 * repeat that invents a 3rd of March out of a 31st of January, an exported
 * series that ends a week early because the client read the last day as a
 * timestamp. Each of those looks fine on the screen it was written on and is
 * wrong on somebody's phone.
 */

const until = (iso: string, every: Repeat['every'] = 'weekly'): Repeat => ({ every, until: iso });

describe('the day it starts', () => {
  /*
   * A weekly repeat starting on a Tuesday that did not itself happen on that
   * Tuesday would be a rule that ate the thing it describes. The first day
   * counts whatever the rule says, and whatever `until` says.
   */
  it('always counts, rule or no rule', () => {
    expect(occursOn('2026-09-15', undefined, '2026-09-15')).toBe(true);
    expect(occursOn('2026-09-15', until('2026-01-01'), '2026-09-15')).toBe(true);
  });

  it('is the only day when nothing repeats', () => {
    expect(occursOn('2026-09-15', undefined, '2026-09-22')).toBe(false);
  });

  it('never reaches backwards', () => {
    expect(occursOn('2026-09-15', until('2026-12-11'), '2026-09-08')).toBe(false);
  });
});

describe('the five rules', () => {
  it('names them all, each with a line saying what it means', () => {
    expect(EVERY).toHaveLength(5);
    for (const e of EVERY) expect(e.says.length).toBeGreaterThan(4);
    expect(everyNamed('monthly').label).toBe('Every month');
    expect(everyNamed('nonsense' as never).id).toBe('weekly');
  });

  it('repeats every day', () => {
    expect(occursOn('2026-09-15', until('2026-09-30', 'daily'), '2026-09-16')).toBe(true);
    // A Sunday, which daily includes and weekdays does not.
    expect(occursOn('2026-09-15', until('2026-09-30', 'daily'), '2026-09-20')).toBe(true);
  });

  it('repeats on weekdays only', () => {
    const r = until('2026-09-30', 'weekdays');
    expect(occursOn('2026-09-15', r, '2026-09-18')).toBe(true);
    expect(occursOn('2026-09-15', r, '2026-09-19')).toBe(false);
    expect(occursOn('2026-09-15', r, '2026-09-20')).toBe(false);
    expect(occursOn('2026-09-15', r, '2026-09-21')).toBe(true);
  });

  it('repeats weekly on the same day', () => {
    const r = until('2026-12-11');
    expect(occursOn('2026-09-15', r, '2026-09-22')).toBe(true);
    expect(occursOn('2026-09-15', r, '2026-09-23')).toBe(false);
  });

  it('repeats fortnightly, skipping the week between', () => {
    const r = until('2026-12-11', 'fortnightly');
    expect(occursOn('2026-09-15', r, '2026-09-22')).toBe(false);
    expect(occursOn('2026-09-15', r, '2026-09-29')).toBe(true);
  });

  /*
   * A rule made on the 31st landing on the 3rd of March is the shape of wrong
   * nobody reads as a bug in the rule — they read it as the app inventing an
   * appointment.
   */
  it('repeats monthly, and skips a month with no such date', () => {
    const r = until('2027-06-30', 'monthly');
    expect(occursOn('2027-01-31', r, '2027-02-28')).toBe(false);
    expect(occursOn('2027-01-31', r, '2027-03-03')).toBe(false);
    expect(occursOn('2027-01-31', r, '2027-03-31')).toBe(true);
  });
});

describe('where it stops', () => {
  it('stops on the day it names, and that day counts', () => {
    const r = until('2026-09-29');
    expect(occursOn('2026-09-15', r, '2026-09-29')).toBe(true);
    expect(occursOn('2026-09-15', r, '2026-10-06')).toBe(false);
  });

  /*
   * A rule with no end is the one still putting a shift on a Tuesday two
   * years after the job finished. A malformed `until` reads as "no more than
   * the first", which is the safe direction: one appointment rather than one
   * a day for ever.
   */
  it('shows only the first day when the end is missing or malformed', () => {
    expect(occursOn('2026-09-15', { every: 'daily', until: '' }, '2026-09-16')).toBe(false);
    expect(occursOn('2026-09-15', { every: 'daily', until: 'soon' }, '2026-09-16')).toBe(false);
    expect(occursOn('2026-09-15', { every: 'daily', until: '' }, '2026-09-15')).toBe(true);
  });
});

describe('taking one out', () => {
  it('skips a date the series was told to skip', () => {
    const r = { ...until('2026-12-11'), except: ['2026-09-22'] };
    expect(occursOn('2026-09-15', r, '2026-09-22')).toBe(false);
    expect(occursOn('2026-09-15', r, '2026-09-29')).toBe(true);
  });

  it('adds one without losing the others, and never adds it twice', () => {
    const one = skip(until('2026-12-11'), '2026-09-22');
    const two = skip(one, '2026-10-06');
    expect(two?.except).toEqual(['2026-09-22', '2026-10-06']);
    expect(skip(two, '2026-09-22')?.except).toEqual(['2026-09-22', '2026-10-06']);
  });

  it('leaves a one-off alone', () => {
    expect(skip(undefined, '2026-09-22')).toBeUndefined();
  });
});

describe('listing them', () => {
  it('gives every date in the window, in order', () => {
    const got = occurrences('2026-09-15', until('2026-10-13'), '2026-09-01', '2026-10-31');
    expect(got).toEqual(['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13']);
  });

  it('starts at the series rather than at the window when the window opens earlier', () => {
    expect(occurrences('2026-09-15', until('2026-09-29'), '2026-01-01', '2026-12-31')[0]).toBe(
      '2026-09-15',
    );
  });

  it('counts them, which is what a line under the rule says', () => {
    expect(howMany('2026-09-15', until('2026-10-13'), '2026-12-31')).toBe(5);
    expect(howMany('2026-09-15', undefined, '2026-12-31')).toBe(1);
  });

  /*
   * `occurrences` walks a day at a time, so a hand-edited backup carrying
   * `until: "9999-12-31"` on a daily rule is a three-million-entry array built
   * on the main thread. Bounded instead: far past any answer this app has a
   * use for, and a rule to fix rather than a screen that hangs.
   */
  it('refuses to walk further than any calendar here asks for', () => {
    const got = occurrences('2026-09-15', until('9999-12-31', 'daily'), '2026-09-15', '9999-12-31');
    expect(got.length).toBeLessThan(800);
  });

  it('gives nothing for a window that runs backwards', () => {
    expect(occurrences('2026-09-15', until('2026-12-11'), '2026-10-01', '2026-09-01')).toEqual([]);
  });
});

describe('saying it in words', () => {
  it('reads as a sentence', () => {
    expect(describeRepeat(until('2026-12-11'))).toBe('Every week until 11 December');
    expect(describeRepeat(undefined)).toBe('Once');
  });

  it('offers an end that is roughly right rather than asking a question', () => {
    expect(defaultUntil('2026-09-15', '2026-12-11')).toBe('2026-12-11');
    // Nothing knows about a term: a term's length from the start.
    expect(defaultUntil('2026-09-15')).toBe('2027-01-05');
    // A term that already ended is not an end for something starting now.
    expect(defaultUntil('2026-09-15', '2026-01-01')).toBe('2027-01-05');
  });
});

describe('as an iCalendar rule', () => {
  /*
   * `UNTIL` as a date rather than a UTC timestamp, because `DTSTART` here is a
   * local wall clock and mixing the two is the commonest way an exported
   * series ends on the wrong day — in the direction that drops the last one.
   */
  it('writes a plain date, not a timestamp', () => {
    expect(rrule(until('2026-12-11'))).toBe('FREQ=WEEKLY;UNTIL=20261211');
  });

  /*
   * A weekday rule is a weekly one in iCalendar's vocabulary. Written as
   * FREQ=DAILY it produces an event on Saturday and Sunday in every client.
   */
  it('writes weekdays as a weekly rule with the five days named', () => {
    expect(rrule(until('2026-12-11', 'weekdays'))).toContain('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });

  it('writes every other week as an interval', () => {
    expect(rrule(until('2026-12-11', 'fortnightly'))).toContain('INTERVAL=2');
  });

  it('writes nothing for a one-off or a rule with no end', () => {
    expect(rrule(undefined)).toBe('');
    expect(rrule({ every: 'weekly', until: '' })).toBe('');
  });
});
