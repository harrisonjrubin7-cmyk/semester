import { describe, expect, it } from 'vitest';
import { placeBlock, type Placing } from './hourplace';

/** The week grid's numbers: 46px an hour, 7am to midnight, 15px minimum. */
const week = (over: Partial<Placing>): Placing => ({
  at: 9 * 60,
  minutes: 60,
  startHour: 7,
  endHour: 24,
  rowPx: 46,
  minHeight: 15,
  ...over,
});

const HEIGHT = (24 - 7) * 46;

describe('placing a block on an hour grid', () => {
  it('puts an ordinary block where the arithmetic says', () => {
    const p = placeBlock(week({ at: 9 * 60, minutes: 60 }));
    expect(p.top).toBe(2 * 46 + 1);
    expect(p.height).toBe(46 - 3);
  });

  it('keeps a deadline at 11:59pm inside the grid', () => {
    // The bug this file exists for: the block was drawn at the full height of
    // the grid, which is *past the last row*, and landed on the help text
    // under it.
    const p = placeBlock(week({ at: 23 * 60 + 59, minutes: 50 }));
    expect(p.top + p.height).toBeLessThanOrEqual(HEIGHT);
    expect(p.height).toBeGreaterThanOrEqual(15);
  });

  it('cuts a block that runs past midnight off at the bottom', () => {
    const p = placeBlock(week({ at: 23 * 60, minutes: 180 }));
    expect(p.top).toBe(16 * 46 + 1);
    expect(p.top + p.height).toBeLessThanOrEqual(HEIGHT);
  });

  it('never draws a block shorter than it can be read at', () => {
    const p = placeBlock(week({ at: 10 * 60, minutes: 5 }));
    expect(p.height).toBe(15);
  });

  it('pins a block that starts before the first hour drawn to the top', () => {
    const p = placeBlock(week({ at: 6 * 60, minutes: 60 }));
    expect(p.top).toBe(0);
  });

  it('holds for the day grid, which counts in different pixels', () => {
    const p = placeBlock({
      at: 23 * 60 + 59,
      minutes: 60,
      startHour: 8,
      endHour: 24,
      rowPx: 54,
      minHeight: 22,
    });
    expect(p.top + p.height).toBeLessThanOrEqual((24 - 8) * 54);
    expect(p.height).toBe(22);
  });

  it('leaves nothing hanging out, whatever the hour', () => {
    for (let at = 0; at < 24 * 60; at += 7) {
      for (const minutes of [0, 15, 90, 600]) {
        const p = placeBlock(week({ at, minutes }));
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.top + p.height).toBeLessThanOrEqual(HEIGHT);
      }
    }
  });
});
