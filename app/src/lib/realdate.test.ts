import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dateToIso, realDate, realMonthDay } from './date';
import { parseIcs } from './ics';
import { matchDate } from './capture';
import { fromInputDate } from './edit';

/**
 * A date that is not a date.
 *
 * `new Date(2026, 1, 31)` does not refuse 31 February — it silently returns
 * 3 March — and seven files checked a date by asking whether the day was
 * between 1 and 31 before handing it to exactly that. 31 is a day in October
 * and is not one in April, and a bare range test cannot tell the difference.
 */

const feed = (dtstart: string) =>
  `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1\r\nSUMMARY:Lecture\r\nDTSTART:${dtstart}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const dates = (raw: string) => parseIcs([], feed(raw)).events.map((e) => `${e.date} ${e.time}`);

describe('a subscribed calendar could put a class on a day nobody scheduled', () => {
  /*
   * The one input in this app that comes from a server the student does not
   * control and is refetched without them asking — so a bad row is not a
   * one-off they can correct, it comes back on the next refresh. Each of
   * these was drawn beside the real classes, in the same colour, with nothing
   * to say it had been invented. Measured one at a time against this parser.
   */
  it.each([
    ['20260231', '31 February', '2026-03-03'],
    ['20260001', 'month 00', '2025-12-01'],
    ['20261345', 'month 13, day 45', '2027-02-14'],
    ['20260900', 'day 00', '2026-08-31'],
    ['00000101', 'year 0000', '1900-01-01'],
    ['20260914T990000Z', 'hour 99', '2026-09-18'],
  ])('refuses %s (%s), which used to be drawn as %s', (raw) => {
    expect(dates(raw)).toEqual([]);
  });

  it('still reads every well-formed stamp', () => {
    expect(dates('20260914')).toEqual(['2026-09-14 All day']);
    expect(dates('20260914T140000Z')).toHaveLength(1);
    // The floating form, which a campus feed means to be taken at face value.
    expect(dates('20260914T140000')).toEqual(['2026-09-14 2:00p']);
  });

  it('tells a real leap day from an invented one', () => {
    // The discrimination a range check cannot make, and the reason the check
    // is "build it and read it back" rather than a month-length table.
    expect(dates('20240229')).toEqual(['2024-02-29 All day']);
    expect(dates('20260229')).toEqual([]);
  });
});

describe('realDate', () => {
  it('answers a date that exists and refuses one that does not', () => {
    expect(realDate(2026, 10, 31)).toBeInstanceOf(Date);
    expect(realDate(2026, 4, 31)).toBeNull();
  });

  it('catches the two-digit year, which no range test can', () => {
    // `new Date(26, 0, 1)` is 1926: Date maps 0–99 into the 1900s.
    expect(realDate(26, 1, 1)).toBeNull();
  });

  it('reads a Z stamp back through the UTC getters', () => {
    // Reading a UTC stamp back locally would refuse every correct feed either
    // side of Greenwich, which is what makes this worth a test of its own.
    const d = realDate(2026, 9, 14, { hours: 23, minutes: 0, seconds: 0 }, true);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCHours()).toBe(23);
    expect(realDate(2026, 9, 14, { hours: 99, minutes: 0, seconds: 0 }, true)).toBeNull();
  });

  it('refuses anything that is not a whole number', () => {
    expect(realDate(2026, 9, 14.5)).toBeNull();
    expect(realDate(2026, NaN, 14)).toBeNull();
  });

  describe('on a day whose local midnight never happens', () => {
    /*
     * Havana springs forward at midnight: on 8 March 2026 the clock goes from
     * 23:59 to 01:00, and `new Date(2026, 2, 8)` normalises to 01:00. Checking
     * the calendar on that value asked whether local midnight existed, and
     * refused a real date for the one day a year its own timezone skips it.
     *
     * A zone of its own rather than a third entry in `test:zones`, because
     * this is the only rule that cares and the suite is run twice already.
     * Chicago moves at two in the morning and Kiritimati does not move, so
     * neither of the zones the suite does run in can reach this.
     */
    const held = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'America/Havana';
    });
    afterAll(() => {
      process.env.TZ = held;
    });

    it('is the timezone this test needs, or the test is not testing anything', () => {
      // The guard against a test that passes for the wrong reason: if setting
      // TZ here stopped working, every assertion below would pass on a clock
      // that has no such day.
      expect(new Date(2026, 2, 8, 0, 0, 0).getHours()).toBe(1);
    });

    it('still answers with the date', () => {
      const d = realDate(2026, 3, 8);
      expect(d).toBeInstanceOf(Date);
      expect(dateToIso(d!)).toBe('2026-03-08');
    });

    it('does not send a date typed by hand into the following year', () => {
      // What this cost on the way through `capture.ts`: "March 8" asked in
      // January read as 2027, because this year's had been declared not to
      // exist.
      expect(matchDate('registration on March 8', new Date(2026, 0, 15))?.date).toBe('2026-03-08');
    });

    it('still refuses a day that is not one', () => {
      expect(realDate(2026, 2, 30)).toBeNull();
      expect(realDate(2026, 4, 31)).toBeNull();
    });

    it('still refuses a stated time the clock never reached', () => {
      // Different from refusing the day: 00:30 that night did not happen, and
      // a caller that asked about it is owed the truth.
      expect(realDate(2026, 3, 8, { hours: 0, minutes: 30, seconds: 0 })).toBeNull();
      expect(realDate(2026, 3, 8, { hours: 9, minutes: 30, seconds: 0 })).toBeInstanceOf(Date);
    });
  });
});

describe('realMonthDay, where the year is not known yet', () => {
  it('knows how long each month is', () => {
    expect(realMonthDay(9, 31)).toBe(true); // October has 31
    expect(realMonthDay(3, 31)).toBe(false); // April does not
    expect(realMonthDay(1, 30)).toBe(false); // nor February, ever
  });

  it('allows 29 February, because the term decides the year', () => {
    // The permissive bound is the right way round here: refusing it outright
    // would throw away a real date in every leap year to catch a wrong one in
    // three years out of four.
    expect(realMonthDay(1, 29)).toBe(true);
  });

  it('refuses a month that is not one', () => {
    expect(realMonthDay(-1, 1)).toBe(false);
    expect(realMonthDay(12, 1)).toBe(false);
    expect(realMonthDay(1.5, 1)).toBe(false);
  });
});

describe('the box somebody types into by hand', () => {
  const today = new Date(2026, 8, 9);

  it('no longer files "essay feb 31" on 3 March', () => {
    expect(matchDate('essay feb 31', today)).toBeNull();
  });

  it('still reads a date that exists', () => {
    expect(matchDate('essay feb 20', today)?.date).toBe('2027-02-20');
    // Already past this year, so it means the coming one.
    expect(matchDate('essay sep 20', today)?.date).toBe('2026-09-20');
  });

  it('refuses a slashed date that is not one, and keeps one that is', () => {
    expect(matchDate('due 4/31', today)).toBeNull();
    expect(matchDate('due 4/30', today)?.date).toBe('2027-04-30');
  });

  it('does not roll a year the writer stated into the next one', () => {
    // 29/2/2026 is a typo to refuse, not a date to quietly move to 2027.
    expect(matchDate('due 2/29/2026', today)).toBeNull();
    expect(matchDate('due 2/29/2024', today)?.date).toBe('2024-02-29');
  });
});

describe('the year was in the field and thrown away', () => {
  it('refuses 31 April rather than returning it as 1 May', () => {
    expect(fromInputDate('2026-04-31')).toBeNull();
    expect(fromInputDate('2026-04-30')).toEqual({ month: 3, day: 30 });
  });
});
