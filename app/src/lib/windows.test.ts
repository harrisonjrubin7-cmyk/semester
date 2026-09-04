import { describe, expect, it } from 'vitest';
import {
  SUGGESTED,
  WAKING_HOURS,
  basisLine,
  daysLine,
  freeOn,
  hoursAWeek,
  hoursOn,
  spanLine,
  tidy,
  weekShape,
  type Window,
} from './windows';

const win = (over: Partial<Window> = {}): Window => ({
  id: 'w1',
  label: 'Weekday evenings',
  days: [1, 2, 3, 4],
  from: 19 * 60,
  to: 23 * 60,
  ...over,
});

describe('what a window offers', () => {
  it('counts its hours on a day it runs', () => {
    expect(hoursOn([win()], 2)).toBe(4);
  });

  it('offers nothing on a day it does not', () => {
    expect(hoursOn([win()], 6)).toBe(0);
  });

  it('adds two windows falling on the same day', () => {
    const morning = win({ id: 'w2', days: [2], from: 8 * 60, to: 11 * 60 });
    expect(hoursOn([win(), morning], 2)).toBe(7);
  });

  it('counts a week across every day each window runs', () => {
    expect(hoursAWeek([win()])).toBe(16);
  });
});

describe('what is actually free', () => {
  it('takes what is promised out of the window', () => {
    expect(freeOn([win()], 2, 1.5)).toBe(2.5);
  });

  it('never goes below zero, however much is promised', () => {
    expect(freeOn([win()], 2, 9)).toBe(0);
  });

  it('offers nothing on a day with no window, whatever the day is like', () => {
    expect(freeOn([win()], 6, 0)).toBe(0);
  });

  it('falls back to the sixteen-hour day when nobody has set one', () => {
    expect(freeOn([], 2, 4)).toBe(WAKING_HOURS - 4);
  });
});

describe('a week', () => {
  const promised = [0, 2, 2, 2, 2, 0, 0]; // Sunday first

  it('adds the days up', () => {
    // Four evenings of four hours, two promised out of each.
    expect(weekShape([win()], promised).free).toBe(8);
  });

  it('says what the week could offer before anything was promised', () => {
    expect(weekShape([win()], promised).offered).toBe(16);
  });

  it('is honest about resting on a default', () => {
    const shape = weekShape([], promised);
    expect(shape.fromWindows).toBe(false);
    expect(shape.offered).toBe(WAKING_HOURS * 7);
    expect(basisLine(shape)).toMatch(/default rather than a fact/);
  });

  it('says where the figure came from when it came from you', () => {
    expect(basisLine(weekShape([win()], promised))).toMatch(/hours you said you work/);
  });
});

describe('saying it on screen', () => {
  it('reads a run of days as a range', () => {
    expect(daysLine([1, 2, 3, 4])).toBe('Mon–Thu');
  });

  it('names a single day', () => {
    expect(daysLine([0])).toBe('Sun');
  });

  it('does not pretend the week wraps', () => {
    // Saturday and Sunday are days 6 and 0, and calling that "Sat–Sun" would
    // be describing a range that runs backwards through the week.
    expect(daysLine([0, 6])).toBe('Sun, Sat');
  });

  it('says every day rather than listing seven', () => {
    expect(daysLine([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  });

  it('handles the empty case', () => {
    expect(daysLine([])).toBe('no days');
  });

  it('writes a span the way a person does', () => {
    expect(spanLine(win())).toBe('7:00p – 11:00p');
    expect(spanLine(win({ from: 8 * 60 + 30, to: 12 * 60 }))).toBe('8:30a – 12:00p');
    expect(spanLine(win({ from: 0, to: 60 }))).toBe('12:00a – 1:00a');
  });
});

describe('tidying one up', () => {
  it('sorts and de-duplicates the days', () => {
    expect(tidy(win({ days: [4, 1, 1, 2] }))?.days).toEqual([1, 2, 4]);
  });

  it('refuses one that runs backwards', () => {
    expect(tidy(win({ from: 23 * 60, to: 19 * 60 }))).toBeNull();
  });

  it('refuses one with no days', () => {
    expect(tidy(win({ days: [] }))).toBeNull();
  });

  it('refuses one of no length', () => {
    expect(tidy(win({ from: 600, to: 600 }))).toBeNull();
  });

  it('drops a day that is not a day', () => {
    expect(tidy(win({ days: [1, 9] }))?.days).toEqual([1]);
  });
});

describe('what is suggested', () => {
  it('offers a few plausible answers rather than a blank field', () => {
    expect(SUGGESTED.length).toBeGreaterThanOrEqual(3);
    expect(SUGGESTED.every((s) => tidy({ ...s, id: 'x' }) !== null)).toBe(true);
  });
});
