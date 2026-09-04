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
