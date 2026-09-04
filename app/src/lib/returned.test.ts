import { describe, expect, it } from 'vitest';
import {
  NO_WINDOW,
  backLine,
  closesOn,
  closing,
  daysLeft,
  newReturned,
  readReturned,
  readWindows,
  stillOpen,
  windowLine,
  windowSummary,
  type RegradeWindow,
} from './returned';

// 4 Sept 2026 is a Friday.
const FRIDAY = new Date(2026, 8, 4, 9, 0);
const back = (at = FRIDAY.getTime(), courseId = 'core') => newReturned('i1', courseId, at);
const week: RegradeWindow = { days: 7, business: false, note: '' };
const fiveBusiness: RegradeWindow = { days: 5, business: true, note: '' };
const on = (d: number) => new Date(2026, 8, d, 9, 0);

describe('when the window shuts', () => {
  it('counts calendar days from the day it came back', () => {
    expect(closesOn(back(), week)?.getDate()).toBe(11);
  });

  it('counts business days over a weekend where the syllabus says so', () => {
    // Friday plus five business days is the following Friday, not Wednesday.
    expect(closesOn(back(), fiveBusiness)?.getDate()).toBe(11);
  });

  it('starts from the return, not from the due date', () => {
    // Which is the whole reason this could not be worked out in advance.
    expect(closesOn(back(on(20).getTime()), week)?.getDate()).toBe(27);
  });

  it('has nothing to say without a recorded window', () => {
    expect(closesOn(back(), NO_WINDOW)).toBeNull();
    expect(daysLeft(back(), NO_WINDOW, FRIDAY)).toBeNull();
  });
});

describe('how long is left', () => {
  it('counts down', () => {
    expect(daysLeft(back(), week, on(4))).toBe(7);
    expect(daysLeft(back(), week, on(10))).toBe(1);
    expect(daysLeft(back(), week, on(11))).toBe(0);
    expect(daysLeft(back(), week, on(13))).toBe(-2);
  });

  it('is open until the last day, and not after it', () => {
    expect(stillOpen(back(), week, on(11))).toBe(true);
    expect(stillOpen(back(), week, on(12))).toBe(false);
  });

  it('stops once it has been raised, without hiding the row', () => {
    expect(stillOpen({ ...back(), raised: true }, week, on(5))).toBe(false);
    expect(windowLine({ ...back(), raised: true }, week, on(5))).toBe('You have raised it.');
  });
});

describe('what the row says', () => {
  it('names the near days rather than counting them', () => {
    expect(windowLine(back(), week, on(10))).toBe('The window closes tomorrow.');
    expect(windowLine(back(), week, on(11))).toBe('The window closes today.');
    expect(windowLine(back(), week, on(6))).toBe('5 days left to raise it.');
  });

  it('says when it has gone', () => {
    expect(windowLine(back(), week, on(14))).toBe('The window closed 3 days ago.');
  });

  it('says the app does not know rather than leaving a blank', () => {
    // A blank reads as "nothing to worry about", and a default of seven days
    // would be wrong quietly and in the dangerous direction.
    const said = windowLine(back(), NO_WINDOW, on(6));
    expect(said).toContain('No window recorded');
    expect(said).toContain('in the syllabus');
  });

  it('never has an opinion about the mark', () => {
    // The consequences of getting that wrong land on the student in a room
    // with their professor.
    for (const when of [on(5), on(11), on(14)]) {
      const said = windowLine({ ...back(), score: '61/100' }, week, when).toLowerCase();
      for (const word of ['low', 'appeal', 'unfair', 'should', 'wrong', 'below']) {
        expect(said).not.toContain(word);
      }
    }
  });
});

describe('the order the open ones come back in', () => {
  it('is soonest to close first, not the order they arrived', () => {
    const older = { ...newReturned('a', 'core', on(1).getTime()) };
    const newer = { ...newReturned('b', 'core', on(4).getTime()) };
    const out = closing([newer, older], () => week, on(6));
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('leaves out what is closed and what has been raised', () => {
    const gone = newReturned('a', 'core', on(1).getTime());
    const raised = { ...newReturned('b', 'core', on(4).getTime()), raised: true };
    expect(closing([gone, raised], () => week, on(20))).toEqual([]);
  });

  it('applies each course’s own window', () => {
    const core = newReturned('a', 'core', on(4).getTime());
    const econ = newReturned('b', 'econ', on(4).getTime());
    const byCourse = (id: string) => (id === 'core' ? week : NO_WINDOW);
    expect(closing([core, econ], byCourse, on(6)).map((r) => r.id)).toEqual(['a']);
  });
});

describe('how much has come back', () => {
  it('says how little a projection is resting on', () => {
    expect(backLine([back(), back()], 11)).toBe('2 of 11 graded pieces back so far.');
    expect(backLine([], 11)).toBe('Nothing marked has come back yet.');
  });

  it('says nothing where there is nothing graded to count against', () => {
    expect(backLine([], 0)).toBe('');
  });
});

describe('the window, written back', () => {
  it('reads the way the syllabus wrote it', () => {
    expect(windowSummary(week)).toBe('7 days.');
    expect(windowSummary(fiveBusiness)).toBe('5 days, business days.');
    expect(windowSummary({ days: 1, business: false, note: '' })).toBe('1 day.');
    expect(windowSummary(NO_WINDOW)).toBe('Not recorded.');
  });
});

describe('reading what was stored', () => {
  it('sorts newest back first', () => {
    const raw = [
      { id: 'a', courseId: 'core', at: on(1).getTime() },
      { id: 'b', courseId: 'core', at: on(9).getTime() },
    ];
    expect(readReturned(raw).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('drops what has no id and fills in what is missing', () => {
    const [r] = readReturned([{ id: 'a' }, { courseId: 'x' }, null]);
    expect(r.at).toBe(0);
    expect(r.score).toBe('');
    expect(r.raised).toBe(false);
    expect(readReturned([{ id: 'a' }, { courseId: 'x' }, null])).toHaveLength(1);
  });

  it('takes a bad window as none, and caps a silly one', () => {
    const w = readWindows({ core: { days: -3 }, econ: { days: 900 }, bus: 'x' });
    expect(w.core.days).toBe(0);
    expect(w.econ.days).toBe(90);
    expect(w.bus).toBeUndefined();
  });

  it('takes anything that is not a list or a map as nothing', () => {
    expect(readReturned(null)).toEqual([]);
    expect(readWindows([1])).toEqual({});
  });
});
