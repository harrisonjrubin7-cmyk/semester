import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLOOR,
  NO_CONTRACT,
  claimedHours,
  dayCapacity,
  insideFloor,
  insideRest,
  newRest,
  over,
  readContract,
  readFloor,
  readRest,
  takenLine,
  verdict,
  weekCapacity,
  type Floor,
  type Rest,
} from './rest';
import type { Window } from './windows';

const AT = 1_788_000_000_000;
const FLOOR: Floor = { from: 23 * 60, to: 7 * 60, on: true };

const win = (days: number[], from: number, to: number): Window =>
  ({ id: `w${from}`, days, from, to, label: '' }) as Window;

const rest = (days: number[], from: number, to: number, label = 'Dinner'): Rest =>
  newRest({ days, from, to, label }, AT);

describe('the floor, which wraps midnight', () => {
  it('counts the part of an evening that falls after it', () => {
    // 20:00–01:00 is two hours past an eleven o'clock floor.
    expect(insideFloor(20 * 60, 25 * 60, FLOOR)).toBe(0 + 120);
  });

  it('counts a morning before it ends', () => {
    // 06:00–09:00 is one hour inside a floor that lifts at seven.
    expect(insideFloor(6 * 60, 9 * 60, FLOOR)).toBe(60);
  });

  it('counts nothing in the middle of the day', () => {
    expect(insideFloor(10 * 60, 16 * 60, FLOOR)).toBe(0);
  });

  it('counts nothing at all when it is switched off', () => {
    expect(insideFloor(1 * 60, 5 * 60, { ...FLOOR, on: false })).toBe(0);
  });

  it('handles a floor that does not wrap', () => {
    const nap: Floor = { from: 13 * 60, to: 14 * 60, on: true };
    expect(insideFloor(12 * 60, 15 * 60, nap)).toBe(60);
  });
});

describe('protected blocks', () => {
  it('come out of the day like the floor does', () => {
    expect(insideRest(17 * 60, 22 * 60, 1, [rest([1], 18 * 60, 19 * 60)])).toBe(60);
  });

  it('are ignored on a day they are not on', () => {
    expect(insideRest(17 * 60, 22 * 60, 2, [rest([1], 18 * 60, 19 * 60)])).toBe(0);
  });
});

describe('a day, after everything comes out', () => {
  it('reports what was taken rather than folding it in', () => {
    // "You have nine hours" and "you have fourteen, four after midnight and
    // one is dinner" are different statements and only the second can be
    // argued with.
    const d = dayCapacity([win([1], 18 * 60, 25 * 60)], 1, FLOOR, [rest([1], 19 * 60, 20 * 60)]);
    expect(d.claimed).toBe(7);
    expect(d.slept).toBe(2);
    expect(d.kept).toBe(1);
    expect(d.real).toBe(4);
  });

  it('does not deduct protected time inside the floor twice', () => {
    // A nine o'clock dinner on a day whose floor starts at eleven is one hour
    // gone, not two.
    const d = dayCapacity([win([1], 18 * 60, 25 * 60)], 1, FLOOR, [rest([1], 23 * 60, 24 * 60)]);
    expect(d.slept).toBe(2);
    expect(d.kept).toBe(0);
    expect(d.real).toBe(5);
  });

  it('never goes below nothing', () => {
    const d = dayCapacity([win([1], 23 * 60, 24 * 60)], 1, FLOOR, [rest([1], 23 * 60, 24 * 60)]);
    expect(d.real).toBe(0);
  });
});

describe('the week', () => {
  const windows = [win([1, 2, 3, 4, 5], 18 * 60, 24 * 60), win([0, 6], 10 * 60, 18 * 60)];

  it('adds the days up and keeps the parts separate', () => {
    const c = weekCapacity(windows, FLOOR, [rest([1, 2, 3, 4, 5], 18 * 60, 19 * 60)]);
    expect(c.claimed).toBe(46);
    expect(c.slept).toBe(5);
    expect(c.kept).toBe(5);
    expect(c.real).toBe(36);
  });

  it('says what came out, in one line', () => {
    const said = takenLine(weekCapacity(windows, FLOOR, [rest([1], 18 * 60, 19 * 60)]));
    expect(said).toContain('sleep floor');
    expect(said).toContain('kept for yourself');
  });

  it('says nothing when nothing came out', () => {
    expect(takenLine(weekCapacity(windows, { ...FLOOR, on: false }, []))).toBe('');
  });

  it('counts the hours the windows claimed before anything came out', () => {
    expect(claimedHours(windows)).toBe(46);
  });
});

describe('the verdict, said on Monday', () => {
  const windows = [win([1, 2, 3, 4, 5], 18 * 60, 22 * 60)];
  const c = weekCapacity(windows, { ...DEFAULT_FLOOR, on: false }, []);

  it('says plainly when a week does not fit', () => {
    // A plan that requires nineteen hours out of eleven is not a plan, and
    // calling it "ambitious" wastes the one chance to say so.
    const said = verdict(30, c, NO_CONTRACT);
    expect(said).toContain('10 over');
    expect(said).toContain('not a scheduling problem');
    expect(over(30, c, NO_CONTRACT)).toBe(true);
  });

  it('measures against the contract where one is set, and says which', () => {
    const said = verdict(15, c, { hours: 12, at: AT });
    expect(said).toContain('12 hours a week you said school gets');
    expect(over(15, c, { hours: 12, at: AT })).toBe(true);
  });

  it('does not let a contract larger than the week invent hours', () => {
    expect(verdict(15, c, { hours: 40, at: AT })).toContain('20 hours your windows leave');
  });

  it('says a week fits when it does', () => {
    expect(verdict(10, c, NO_CONTRACT)).toContain('It fits, with 10 spare');
    expect(over(10, c, NO_CONTRACT)).toBe(false);
  });

  it('never encourages', () => {
    const said = `${verdict(30, c, NO_CONTRACT)} ${verdict(5, c, NO_CONTRACT)}`.toLowerCase();
    for (const word of ['ambitious', 'you can', 'doable', 'push', 'great']) {
      expect(said).not.toContain(word);
    }
  });

  it('says there is nothing to measure against without windows', () => {
    const none = weekCapacity([], DEFAULT_FLOOR, []);
    expect(verdict(10, none, NO_CONTRACT)).toContain('No working hours set');
    expect(over(10, none, NO_CONTRACT)).toBe(false);
  });

  it('says there is nothing to set against it with nothing timed', () => {
    expect(verdict(0, c, NO_CONTRACT)).toContain('no figure to set against');
  });
});

describe('reading what was stored', () => {
  it('defaults the floor to off rather than on', () => {
    // Turning a constraint on for somebody who never asked for it is the
    // fastest way to have it turned off for good.
    expect(readFloor(undefined).on).toBe(false);
    expect(DEFAULT_FLOOR.on).toBe(false);
  });

  it('falls back on a sane floor from rubbish', () => {
    const f = readFloor({ from: -5, to: 'late', on: true });
    expect(f.from).toBe(DEFAULT_FLOOR.from);
    expect(f.to).toBe(DEFAULT_FLOOR.to);
    expect(f.on).toBe(true);
  });

  it('caps a silly contract and treats a missing one as none', () => {
    expect(readContract({ hours: 900 }).hours).toBe(120);
    expect(readContract({ hours: -3 }).hours).toBe(0);
    expect(readContract(null)).toEqual(NO_CONTRACT);
  });

  it('takes anything that is not a list of blocks as nothing', () => {
    expect(readRest('x')).toEqual([]);
    expect(readRest([{ id: 'a' }])[0].days).toEqual([]);
  });

  it('tidies the days a block is on', () => {
    expect(newRest({ days: [3, 1, 1, 9] }, AT).days).toEqual([1, 3]);
  });
});
