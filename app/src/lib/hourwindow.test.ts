import { describe, expect, it } from 'vitest';
import { MIN_HOURS, hourWindow } from './hourwindow';

/**
 * The hours a day draws, and the two bugs that were in the old sum.
 *
 * Both were about a floor: the end of the window was held at six in the
 * evening whatever the day held, so a quiet day drew rows of nothing, and the
 * hour line was tested against a window that had never been told what the hour
 * was, so it disappeared for the whole evening.
 */
const at = (h: number, m = 0) => h * 60 + m;
const block = (h: number, m: number, minutes = 50) => ({ at: at(h, m), minutes });

describe('the window a day draws', () => {
  it("is the day's own, with an hour of padding either side", () => {
    // Nine until quarter past two, so eight until four.
    const { lo, hi } = hourWindow([block(9, 0), block(13, 0, 75)]);
    expect(lo).toBe(8);
    expect(hi).toBe(16);
  });

  it('does not draw an evening that has nothing in it', () => {
    // One nine o'clock class. The old sum floored the end at six and drew
    // twelve rows for it; eleven of them were ruled lines and nothing else.
    const { lo, hi } = hourWindow([block(9, 5)]);
    expect(hi - lo).toBe(MIN_HOURS);
    expect(hi).toBeLessThan(18);
  });

  it('never draws so few rows that the grid stops reading as a day', () => {
    for (const hour of [7, 9, 12, 15, 21]) {
      const { lo, hi } = hourWindow([block(hour, 0)]);
      expect(hi - lo).toBeGreaterThanOrEqual(MIN_HOURS);
    }
  });

  it('gives the short day its room at the end rather than before breakfast', () => {
    const { lo, hi } = hourWindow([block(9, 0)]);
    // Padded to 8–10, then widened towards the evening first.
    expect(lo).toBe(7);
    expect(hi).toBe(13);
  });

  it('stretches to hold a long day whole', () => {
    const { lo, hi } = hourWindow([block(8, 0), block(21, 30, 90)]);
    expect(lo).toBe(7);
    expect(hi).toBe(24);
  });

  it('stays inside the day at either end', () => {
    expect(hourWindow([block(0, 15)]).lo).toBe(0);
    expect(hourWindow([block(23, 30, 60)]).hi).toBe(24);
  });
});

describe('the hour it is now', () => {
  it('is part of the window, so the marker always has somewhere to land', () => {
    // Eight in the evening on a day whose only class was at nine. This is the
    // case that drew no marker at all: the window ran to seven, the guard on
    // the marker asked whether now fell inside it, and it did not.
    const { lo, hi } = hourWindow([block(9, 5)], at(20, 3));
    expect(lo * 60).toBeLessThanOrEqual(at(20, 3));
    expect(hi * 60).toBeGreaterThanOrEqual(at(20, 3));
  });

  it('holds the marker whatever the hour, and whatever is on', () => {
    for (let h = 0; h < 24; h++) {
      const { lo, hi } = hourWindow([block(9, 5), block(14, 15)], at(h, 30));
      expect(at(h, 30)).toBeGreaterThanOrEqual(lo * 60);
      expect(at(h, 30)).toBeLessThanOrEqual(hi * 60);
    }
  });

  it('opens the empty morning on the hour it is', () => {
    const { lo, hi } = hourWindow([], at(15, 0));
    expect(lo).toBeLessThanOrEqual(15);
    expect(hi).toBeGreaterThanOrEqual(15);
    expect(hi - lo).toBeGreaterThanOrEqual(MIN_HOURS);
  });

  it('belongs to today alone: another day is drawn from its own blocks', () => {
    // The same class, on a Thursday three weeks out. Stretching that grid to
    // this afternoon would draw an hour with nothing to do with the day shown.
    const today = hourWindow([block(9, 5)], at(20, 3));
    const other = hourWindow([block(9, 5)], null);
    expect(other.hi).toBeLessThan(today.hi);
    expect(other.hi - other.lo).toBe(MIN_HOURS);
  });

  it('does not shrink a day that already runs past the hour', () => {
    const { hi } = hourWindow([block(8, 0), block(21, 0, 60)], at(9, 0));
    expect(hi).toBe(23);
  });
});

describe('a day with nothing on it and no hour', () => {
  it('answers with a working morning rather than a hairline', () => {
    const { lo, hi } = hourWindow([]);
    expect(hi - lo).toBe(MIN_HOURS);
    expect(lo).toBe(8);
  });
});
