import { describe, expect, it } from 'vitest';
import { byCourse, clock, idFor, meetsLine, readDays, readSchedule, readTime } from './yes';

describe('readDays', () => {
  it('reads the letter pattern YES uses', () => {
    expect(readDays('MWF')).toEqual([1, 3, 5]);
  });

  it('knows R is Thursday and T is Tuesday', () => {
    // The trap: reading "TR" as T-h-u would give Tuesday and Thursday from
    // one day, or worse, Thursday twice.
    expect(readDays('TR')).toEqual([2, 4]);
  });

  it('prefers day words over letters when both could match', () => {
    // "Thursday" contains T, U, R and S — letter-matching it gives four days.
    expect(readDays('Tuesday, Thursday')).toEqual([2, 4]);
    expect(readDays('Mon/Wed')).toEqual([1, 3]);
  });

  it('is empty when there is no day in the text', () => {
    expect(readDays('Buttrick Hall')).toEqual([]);
    expect(readDays('')).toEqual([]);
  });
});

describe('readTime', () => {
  it('reads the forms a schedule is written in', () => {
    expect(readTime('9:10am')).toBe(9 * 60 + 10);
    expect(readTime('1:15 PM')).toBe(13 * 60 + 15);
    expect(readTime('13:15')).toBe(13 * 60 + 15);
  });

  it('gets the two midnight and noon edge cases right', () => {
    expect(readTime('12:30am')).toBe(30);
    expect(readTime('12:30pm')).toBe(12 * 60 + 30);
  });

  it('refuses nonsense rather than returning a wrong minute', () => {
    expect(readTime('99:99')).toBeNull();
    expect(readTime('Buttrick')).toBeNull();
  });
});

describe('clock', () => {
  it('writes the form the rest of the app uses', () => {
    expect(clock(9 * 60 + 10)).toBe('9:10a');
    expect(clock(13 * 60 + 15)).toBe('1:15p');
    expect(clock(12 * 60)).toBe('12:00p');
    expect(clock(0)).toBe('12:00a');
  });
});

describe('readSchedule', () => {
  it('reads a line copied out of a rendered page', () => {
    const [c] = readSchedule('ECON 1020-01 Principles of Macroeconomics MWF 9:10am-10:00am Buttrick Hall 101');
    expect(c.code).toBe('ECON 1020');
    expect(c.section).toBe('01');
    expect(c.days).toEqual([1, 3, 5]);
    expect(c.at).toBe(9 * 60 + 10);
    expect(c.endsAt).toBe(10 * 60);
    expect(c.room).toContain('Buttrick Hall 101');
    expect(c.title).toContain('Principles of Macroeconomics');
  });

  it('reads a line copied out of a table, where the columns are tabs', () => {
    const [c] = readSchedule('PSCI 1104\tIntro to American Government\tTR\t1:15 PM - 2:30 PM\tFurman 114');
    expect(c.code).toBe('PSCI 1104');
    expect(c.days).toEqual([2, 4]);
    expect(c.at).toBe(13 * 60 + 15);
    expect(c.room).toBe('Furman 114');
  });

  it('drops anything that is not a class', () => {
    // A pasted page is mostly navigation. A loose parser files phantom courses.
    const lines = readSchedule(
      [
        'Spring 2027 Registration',
        'Your enrolled classes',
        'ECON 1020 MWF 9:10am-10:00am Buttrick 101',
        'Total hours: 15',
        'CS 1101 — no meeting time listed',
      ].join('\n'),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].code).toBe('ECON 1020');
  });

  it('does not invent a Friday from an F in a building name', () => {
    // Days are read between the code and the time, not across the whole line.
    const [c] = readSchedule('BUS 1600 T 2:00pm-3:15pm Featheringill Hall 134');
    expect(c.days).toEqual([2]);
  });

  it('keeps a lecture and its lab apart', () => {
    const lines = readSchedule(
      ['CHEM 1601 MWF 10:10am-11:00am Stevenson 4327', 'CHEM 1601 R 1:00pm-4:00pm Stevenson 3234'].join(
        '\n',
      ),
    );
    expect(lines).toHaveLength(2);
  });

  it('does not file the same class twice from a repeated line', () => {
    const twice = 'ECON 1020 MWF 9:10am-10:00am Buttrick 101';
    expect(readSchedule(`${twice}\n${twice}`)).toHaveLength(1);
  });

  it('sorts by the first day it meets, then by time', () => {
    const lines = readSchedule(
      ['BUS 1600 R 2:00pm-3:15pm X', 'ECON 1020 M 9:10am-10:00am Y', 'PSCI 1104 M 1:15pm-2:30pm Z'].join(
        '\n',
      ),
    );
    expect(lines.map((l) => l.code)).toEqual(['ECON 1020', 'PSCI 1104', 'BUS 1600']);
  });

  it('copes with an online class that has no room', () => {
    const [c] = readSchedule('CORE 2500 W 3:00pm-4:15pm Online');
    expect(c.room).toBe('Online');
  });

  it('returns nothing for an empty paste rather than throwing', () => {
    expect(readSchedule('')).toEqual([]);
    expect(readSchedule('   \n\n  ')).toEqual([]);
  });
});

describe('meetsLine', () => {
  it('writes the pattern the way a syllabus does', () => {
    const [c] = readSchedule('ECON 1020 MWF 9:10am-10:00am Buttrick 101');
    expect(meetsLine(c)).toBe('MWF · 9:10a–10:00a');
  });
});

describe('byCourse', () => {
  it('folds a lecture and its lab into one course', () => {
    const lines = readSchedule(
      ['CHEM 1601 Gen Chem MWF 10:10am-11:00am Stevenson 4327', 'CHEM 1601 R 1:00pm-4:00pm Stevenson 3234'].join(
        '\n',
      ),
    );
    const grouped = byCourse(lines);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].lines).toHaveLength(2);
    expect(grouped[0].title).toContain('Gen Chem');
  });
});

describe('idFor', () => {
  it('makes an id a course can be keyed by', () => {
    expect(idFor('ECON 1020')).toBe('econ1020');
  });
});
