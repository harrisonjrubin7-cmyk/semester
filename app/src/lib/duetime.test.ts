import { describe, expect, it } from 'vitest';
import { NO_TIME, dueMinutes, hasTime, readDue } from './duetime';

describe('the wordings the sample syllabi actually use', () => {
  // Every one of these is a real `dueTime` from the four courses in the app.
  it('reads a plain time', () => {
    expect(readDue('11:59 PM')).toBe(23 * 60 + 59);
    expect(readDue('5:00p')).toBe(17 * 60);
  });

  it('reads a time out of a phrase', () => {
    expect(readDue('Before class, 1:15p')).toBe(13 * 60 + 15);
    expect(readDue('In class, 2:45p')).toBe(14 * 60 + 45);
    expect(readDue('Take-home posted 9a Sep 14')).toBe(9 * 60);
  });

  it('leaves a wording with no clock in it alone', () => {
    // Returning midnight for these would put them at the top of a day they
    // do not belong at the top of.
    expect(readDue('In class')).toBeNull();
    expect(readDue('Before class')).toBeNull();
    expect(readDue('Window is Sep 8–17')).toBeNull();
    expect(readDue('Window is Sep 29 – Oct 8')).toBeNull();
  });
});

describe('ranges, where a naive parser goes wrong', () => {
  it('takes the meridiem from the far end of the range', () => {
    // Three in the afternoon, not three in the morning.
    expect(readDue('3:00–5:00 PM')).toBe(15 * 60);
  });

  it('and gets the morning one right too', () => {
    expect(readDue('9:00–11:00 AM')).toBe(9 * 60);
  });

  it('lets a range cross noon', () => {
    // "11:00–1:00 PM" has to start in the morning; there is no other reading.
    expect(readDue('11:00–1:00 PM')).toBe(11 * 60);
  });

  it('takes a hyphen as readily as an en dash', () => {
    expect(readDue('3:00-5:00 PM')).toBe(15 * 60);
  });

  it('is not fooled by a date range', () => {
    expect(readDue('Sep 29 – Oct 8')).toBeNull();
  });
});

describe('the edges of a clock', () => {
  it('gets noon and midnight the right way round', () => {
    expect(readDue('12:00 PM')).toBe(12 * 60);
    expect(readDue('12:30 AM')).toBe(30);
  });

  it('takes a bare 24-hour time, which a form field produces', () => {
    expect(readDue('14:45')).toBe(14 * 60 + 45);
    expect(readDue('09:05')).toBe(9 * 60 + 5);
  });

  it('refuses an hour or a minute that is not one', () => {
    expect(readDue('13:00 PM')).toBeNull();
    expect(readDue('9:75a')).toBeNull();
    expect(readDue('25:00')).toBeNull();
  });

  it('survives an empty wording', () => {
    expect(readDue('')).toBeNull();
    expect(readDue('   ')).toBeNull();
  });

  it('survives no wording at all, which the type says cannot happen', () => {
    // A course syncing in from another device, or from a build before this
    // field existed, arrives without it. This is called from the Header, so
    // the alternative to returning null here is a blank app.
    expect(readDue(undefined as never)).toBeNull();
    expect(readDue(null as never)).toBeNull();
    expect(dueMinutes(undefined as never)).toBe(NO_TIME);
  });
});

describe('sorting a day', () => {
  it('puts an untimed deadline after every timed one', () => {
    // "In class" and "by the end of the week" are things you have all day to
    // do something about; above the 9am lecture is the wrong place for them.
    expect(dueMinutes('In class')).toBe(NO_TIME);
    expect(dueMinutes('11:59 PM')).toBeLessThan(NO_TIME);
  });

  it('orders a day the way it happens', () => {
    const day = ['11:59 PM', 'In class', 'Before class, 1:15p', '9:00–11:00 AM'];
    expect([...day].sort((a, b) => dueMinutes(a) - dueMinutes(b))).toEqual([
      '9:00–11:00 AM',
      'Before class, 1:15p',
      '11:59 PM',
      'In class',
    ]);
  });

  it('says plainly whether a wording named a time', () => {
    expect(hasTime('11:59 PM')).toBe(true);
    expect(hasTime('In class')).toBe(false);
  });
});

describe('twelve, which does not sort where it is written', () => {
  /*
   * Whether a range crosses noon was decided by comparing the two hours as
   * numerals, and on a clock face twelve comes before one rather than after
   * eleven. Every range with a twelve at either end was read twelve hours out,
   * in whichever direction the numeral misled.
   */
  const at = (h: number, m = 0) => h * 60 + m;

  it('starts at noon where the range starts at twelve', () => {
    expect(readDue('12:00–2:00 PM')).toBe(at(12));
    expect(readDue('12:30–1:30 PM')).toBe(at(12, 30));
    expect(readDue('12:45–2:15 PM')).toBe(at(12, 45));
    expect(readDue('12:00–12:30 PM')).toBe(at(12));
  });

  it('stays in the morning where the range ends at twelve', () => {
    // An ordinary morning exam window. Read as ten at night, because ten is
    // less than twelve as a numeral.
    expect(readDue('10:00–12:00 PM')).toBe(at(10));
    expect(readDue('11:30–12:30 PM')).toBe(at(11, 30));
    expect(readDue('11:59–12:30 PM')).toBe(at(11, 59));
  });

  it('leaves the ranges that were already right exactly as they were', () => {
    expect(readDue('3:00–5:00 PM')).toBe(at(15));
    expect(readDue('9:00–11:00 AM')).toBe(at(9));
    expect(readDue('11:00–1:00 PM')).toBe(at(11));
    expect(readDue('1:00–2:00 PM')).toBe(at(13));
    expect(readDue('12:00–3:00 AM')).toBe(at(0));
  });

  it('reads twelve on its own the way it always did', () => {
    expect(readDue('12:00 PM')).toBe(at(12));
    expect(readDue('12:00 AM')).toBe(at(0));
    expect(readDue('12p')).toBe(at(12));
    expect(readDue('12a')).toBe(at(0));
  });
});

describe('noon and midnight, said in words', () => {
  it('reads noon', () => {
    // A syllabus says it as readily as it says a figure, and the app read it
    // as no time at all: "due by noon" sorted below a deadline at five, and
    // the screen said no hour was stated when one plainly was.
    expect(readDue('due by noon')).toBe(12 * 60);
    expect(readDue('Noon')).toBe(12 * 60);
    expect(readDue('12 noon')).toBe(12 * 60);
    expect(hasTime('due by noon')).toBe(true);
  });

  it('takes the figure over the word, where a wording has both', () => {
    // Read any earlier than last and this one gets worse than it was.
    expect(readDue('10:30 to noon')).toBe(10 * 60 + 30);
    expect(readDue('9:00 AM to noon')).toBe(9 * 60);
    expect(readDue('noon, or 2:15p')).toBe(14 * 60 + 15);
    expect(readDue('12:00 noon')).toBe(12 * 60);
  });

  it('leaves midnight unread, which is the answer and not a gap', () => {
    /*
     * "Due Friday at midnight" is written to mean the end of Friday and reads
     * literally as its start. Either figure would be a guess and one of them
     * is a whole day early, so it falls to NO_TIME and sorts to the end of its
     * day — which is what the wording means.
     */
    expect(readDue('midnight')).toBeNull();
    expect(readDue('Due at midnight')).toBeNull();
    expect(dueMinutes('Due at midnight')).toBe(NO_TIME);
  });

  it('does not find noon inside a word that merely contains it', () => {
    expect(readDue('afternoon')).toBeNull();
    expect(readDue('Noonan Hall')).toBeNull();
    expect(readDue('Room 12')).toBeNull();
  });
});
