import { describe, expect, it } from 'vitest';
import { STEP_MINUTES, clockOf, holdAgainstPan, pointIn, snapMinutes, timeLabel, type GridSpec } from './drag';

/**
 * The arithmetic behind a drop, which is the part that can be wrong invisibly.
 *
 * A drag either lands where the finger was or it does not, and an
 * off-by-one-row drop is an hour — which on a calendar is a missed class. The
 * gesture is not tested here; the numbers it produces are.
 */

// `HourGrid`'s own constants. Written out rather than imported so that
// changing the grid fails this file loudly instead of quietly agreeing with
// itself.
const DAY: GridSpec = { rowPx: 54, gutterPx: 46, startHour: 8, columns: 1 };
const WEEK: GridSpec = { rowPx: 46, gutterPx: 30, startHour: 8, columns: 7 };

const rect = (width = 400, height = 54 * 14) => ({ left: 0, top: 0, width, height });

describe('snapping a time', () => {
  it('rounds to the quarter hour', () => {
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(22)).toBe(15);
    expect(snapMinutes(23)).toBe(30);
    expect(snapMinutes(9 * 60 + 37)).toBe(9 * 60 + 30);
  });

  it('never lands outside the day', () => {
    // Half past eleven at night is a time; five past midnight tomorrow is a
    // different day, and a drag must not change the day by rounding.
    expect(snapMinutes(-30)).toBe(0);
    expect(snapMinutes(24 * 60)).toBe(24 * 60 - STEP_MINUTES);
    expect(snapMinutes(24 * 60 + 90)).toBe(24 * 60 - STEP_MINUTES);
  });
});

describe('a point on the day grid', () => {
  it('reads the top of the grid as the hour it starts at', () => {
    expect(pointIn(DAY, rect(), 200, 0).minutes).toBe(8 * 60);
  });

  it('reads one row down as one hour later', () => {
    expect(pointIn(DAY, rect(), 200, 54).minutes).toBe(9 * 60);
    expect(pointIn(DAY, rect(), 200, 54 * 3).minutes).toBe(11 * 60);
  });

  it('reads half a row as half an hour, snapped', () => {
    expect(pointIn(DAY, rect(), 200, 27).minutes).toBe(8 * 60 + 30);
    // A third of a row is twenty minutes, which snaps to fifteen.
    expect(pointIn(DAY, rect(), 200, 18).minutes).toBe(8 * 60 + 15);
  });

  it('inverts the arithmetic the grid draws with', () => {
    // The grid puts a block at `(at - startHour * 60) / 60 * rowPx`. Reading
    // that back is the whole job of this function, so it is checked as a round
    // trip rather than as a handful of numbers.
    for (const at of [8 * 60, 9 * 60 + 30, 13 * 60 + 15, 17 * 60 + 45]) {
      const top = ((at - DAY.startHour * 60) / 60) * DAY.rowPx;
      expect(pointIn(DAY, rect(), 200, top).minutes).toBe(at);
    }
  });

  it('clamps above and below rather than running off the day', () => {
    // Above the first row is the first hour, not yesterday evening.
    expect(pointIn(DAY, rect(), 200, -400).minutes).toBe(8 * 60);
    // Below the last is the last hour the grid draws.
    const bottom = pointIn(DAY, rect(), 200, 54 * 40).minutes;
    expect(bottom).toBeLessThanOrEqual(24 * 60 - STEP_MINUTES);
    expect(bottom).toBeGreaterThan(8 * 60);
  });

  it('has one column, whatever the x', () => {
    expect(pointIn(DAY, rect(), 0, 0).column).toBe(0);
    expect(pointIn(DAY, rect(), 399, 0).column).toBe(0);
  });
});

describe('a point on the week grid', () => {
  const r = rect(400, 46 * 14);
  const usable = 400 - WEEK.gutterPx;

  it('puts the left edge of the days in the first column', () => {
    expect(pointIn(WEEK, r, WEEK.gutterPx, 0).column).toBe(0);
    expect(pointIn(WEEK, r, WEEK.gutterPx + 1, 0).column).toBe(0);
  });

  it('puts the right edge in the last, never past it', () => {
    expect(pointIn(WEEK, r, 399, 0).column).toBe(6);
    expect(pointIn(WEEK, r, 100_000, 0).column).toBe(6);
  });

  it('divides the days evenly', () => {
    for (let c = 0; c < 7; c += 1) {
      const middle = WEEK.gutterPx + (usable / 7) * (c + 0.5);
      expect(pointIn(WEEK, r, middle, 0).column, `column ${c}`).toBe(c);
    }
  });

  it('reads the gutter as the first day rather than as a column below zero', () => {
    // The time column is not a day. A drop on it is a drop on Monday, which is
    // the nearest true answer; a negative column would be a crash.
    expect(pointIn(WEEK, r, 0, 0).column).toBe(0);
  });

  it('reads its own row height, not the day grid’s', () => {
    expect(pointIn(WEEK, r, 200, 46).minutes).toBe(9 * 60);
  });
});

describe('writing a time back out', () => {
  it('matches how the grids already write one', () => {
    expect(clockOf(9 * 60)).toBe('9');
    expect(clockOf(9 * 60 + 30)).toBe('9:30');
    expect(clockOf(12 * 60)).toBe('12');
    expect(clockOf(13 * 60 + 15)).toBe('1:15');
    expect(clockOf(0)).toBe('12');
  });

  it('says which half of the day, where a time stands on its own', () => {
    expect(timeLabel(9 * 60)).toBe('9a');
    expect(timeLabel(13 * 60 + 15)).toBe('1:15p');
    expect(timeLabel(12 * 60)).toBe('12p');
    expect(timeLabel(0)).toBe('12a');
  });
});

describe('keeping the browser from panning mid-drag', () => {
  /**
   * The rule that was wrong for a whole release.
   *
   * `touch-action: none` on the held element does not do this: the browser
   * decides whether a touch is a pan when the finger lands, and the class is
   * only set once the hold has already fired. What the drag actually did on a
   * phone was `pointerdown, pointermove, pointercancel` — and every check
   * driven with a mouse passed, because a mouse never goes through that
   * arbitration at all.
   *
   * So the two things worth holding are the two that were got wrong: that the
   * listener can prevent anything, and that it does not shout at a pan the
   * browser has already committed to.
   */
  const spy = () => {
    const calls: { type: string; opts: unknown }[] = [];
    let handler: ((e: Event) => void) | null = null;
    const target = {
      addEventListener: (type: string, fn: (e: Event) => void, opts: unknown) => {
        calls.push({ type, opts });
        handler = fn;
      },
      removeEventListener: (type: string) => {
        calls.push({ type: `off:${type}`, opts: null });
        handler = null;
      },
    };
    return { target, calls, fire: (e: Event) => handler?.(e) };
  };

  it('registers for touchmove, and non-passively', () => {
    // A passive listener cannot call preventDefault, so a passive one here is
    // the same as no listener at all — and it fails silently.
    const { target, calls } = spy();
    holdAgainstPan(target as never);
    expect(calls[0].type).toBe('touchmove');
    expect(calls[0].opts).toEqual({ passive: false });
  });

  it('prevents a touchmove the browser will still listen to', () => {
    const { target, fire } = spy();
    holdAgainstPan(target as never);
    let prevented = false;
    fire({ cancelable: true, preventDefault: () => { prevented = true; } } as unknown as Event);
    expect(prevented).toBe(true);
  });

  it('leaves an uncancelable one alone', () => {
    // Once a pan is under way its touchmoves cannot be prevented, and calling
    // preventDefault on one is a console warning and nothing else.
    const { target, fire } = spy();
    holdAgainstPan(target as never);
    let prevented = false;
    fire({ cancelable: false, preventDefault: () => { prevented = true; } } as unknown as Event);
    expect(prevented).toBe(false);
  });

  it('takes the listener off again, so a flick still scrolls', () => {
    const { target, calls } = spy();
    holdAgainstPan(target as never)();
    expect(calls.map((c) => c.type)).toEqual(['touchmove', 'off:touchmove']);
  });
});
