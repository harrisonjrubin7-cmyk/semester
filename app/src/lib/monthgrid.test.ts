import { describe, expect, it } from 'vitest';
import { dayLabel, marksLine, monthLabel, moveBy as real } from './monthgrid';

const mark = (kind: string) => ({ kind });

describe('what is on a day, in words', () => {
  it('says nothing for an empty day', () => {
    expect(marksLine([])).toBe('');
  });

  it('counts and pluralises each kind', () => {
    expect(marksLine([mark('due')])).toBe('1 deadline');
    expect(marksLine([mark('due'), mark('due')])).toBe('2 deadlines');
    expect(marksLine([mark('event')])).toBe('1 campus event');
    expect(marksLine([mark('mine')])).toBe('1 task of your own');
    expect(marksLine([mark('class'), mark('class')])).toBe('2 classes');
  });

  it('always reads the kinds in the same order', () => {
    const a = marksLine([mark('event'), mark('due'), mark('appt')]);
    const b = marksLine([mark('appt'), mark('event'), mark('due')]);
    expect(a).toBe(b);
    expect(a).toBe('1 deadline, 1 appointment, 1 campus event');
  });

  it('names an unknown kind rather than dropping it', () => {
    expect(marksLine([mark('something-new')])).toBe('1 something-new');
  });
});

describe('the sentence a screen reader gets', () => {
  // Tuesday 8 September 2026.
  const tue = new Date(2026, 8, 8);

  it('leads with the weekday and the date', () => {
    expect(dayLabel(tue, [])).toBe('Tuesday 8 September. Nothing on.');
  });

  it('names what is on the day', () => {
    expect(dayLabel(tue, [mark('due'), mark('due'), mark('event')])).toBe(
      'Tuesday 8 September. 2 deadlines, 1 campus event.',
    );
  });

  it('says today, which a sighted user gets from a border', () => {
    expect(dayLabel(tue, [], { today: true })).toBe('Tuesday 8 September. Today. Nothing on.');
  });

  it('says selected, which a sighted user gets from a background', () => {
    expect(dayLabel(tue, [], { selected: true })).toBe(
      'Tuesday 8 September. Selected. Nothing on.',
    );
  });

  it('says both when both are true — they are different facts', () => {
    expect(dayLabel(tue, [mark('due')], { today: true, selected: true })).toBe(
      'Tuesday 8 September. Today. Selected. 1 deadline.',
    );
  });

  it('never carries a fact in colour alone', () => {
    // Every mark kind the grid can draw must have words for it.
    for (const kind of ['due', 'mine', 'appt', 'event', 'feed', 'class']) {
      expect(marksLine([mark(kind)]), kind).not.toBe('');
    }
  });
});

describe('moving with the arrow keys', () => {
  // September 2026: 30 days, and the 1st is a Tuesday. So the first row is
  // short — [_, _, 1..5] — and rows begin on the 6th, 13th, 20th, 27th. A
  // month that begins on a Sunday is the easy case and hides the bug.
  const DAYS = 30;
  const TUE = 2;
  const moveBy = (key: string, day: number, days = DAYS, startsOn = TUE) => real(key, day, days, startsOn);

  it('steps a day at a time across a row', () => {
    expect(moveBy('ArrowRight', 8, DAYS)).toEqual({ day: 9, step: null });
    expect(moveBy('ArrowLeft', 8, DAYS)).toEqual({ day: 7, step: null });
  });

  it('steps a week at a time up and down', () => {
    expect(moveBy('ArrowDown', 8, DAYS)).toEqual({ day: 15, step: null });
    expect(moveBy('ArrowUp', 8, DAYS)).toEqual({ day: 1, step: null });
  });

  it('stops at the edges of the month rather than rolling into the next', () => {
    expect(moveBy('ArrowLeft', 1, DAYS)).toEqual({ day: 1, step: null });
    expect(moveBy('ArrowRight', 30, DAYS)).toEqual({ day: 30, step: null });
    expect(moveBy('ArrowUp', 3, DAYS)).toEqual({ day: 1, step: null });
    expect(moveBy('ArrowDown', 28, DAYS)).toEqual({ day: 30, step: null });
  });

  it('Home and End work on the row, which is what they mean in a grid', () => {
    // The 6th is a Sunday, so 6..12 is a whole row.
    expect(moveBy('Home', 9)).toEqual({ day: 6, step: null });
    expect(moveBy('End', 9)).toEqual({ day: 12, step: null });
    expect(moveBy('Home', 6)).toEqual({ day: 6, step: null });
    expect(moveBy('End', 12)).toEqual({ day: 12, step: null });
  });

  it('Home does not cross the fold on a short first row', () => {
    // The bug this argument exists for: the 6th is a row start, and Home used
    // to walk back to the 1st — a different week entirely.
    expect(moveBy('Home', 6)).toEqual({ day: 6, step: null });
    // Inside the short first row, Home stops at the 1st because the row does.
    expect(moveBy('Home', 3)).toEqual({ day: 1, step: null });
  });

  it('End does not run past the end of a short month', () => {
    // The 27th is a Sunday, so its row would end on the 3rd of October.
    expect(moveBy('End', 29)).toEqual({ day: 30, step: null });
  });

  it('works for a month that does begin on a Sunday', () => {
    // November 2026: 30 days, the 1st a Sunday. Rows are 1..7, 8..14, …
    expect(moveBy('Home', 10, 30, 0)).toEqual({ day: 8, step: null });
    expect(moveBy('End', 10, 30, 0)).toEqual({ day: 14, step: null });
  });

  it('Page Up and Page Down change the month', () => {
    expect(moveBy('PageUp', 8, DAYS)).toEqual({ day: null, step: 'prev' });
    expect(moveBy('PageDown', 8, DAYS)).toEqual({ day: null, step: 'next' });
  });

  it('hands back nothing for a key that is not movement, so it is not swallowed', () => {
    for (const k of ['a', 'Tab', 'Escape', 'Enter', ' ']) expect(moveBy(k, 8, DAYS), k).toBeNull();
  });
});

describe('monthLabel', () => {
  it('names the month being shown', () => {
    expect(monthLabel(2026, 8)).toBe('September 2026');
    expect(monthLabel(2027, 0)).toBe('January 2027');
  });
});
