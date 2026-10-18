import { describe, expect, it } from 'vitest';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import { MAX_EFFORT_MINUTES, effortLine, readEffort, setEffort } from './effort';

const blank = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

describe('readEffort', () => {
  it('keeps whole positive minutes and drops everything it cannot trust', () => {
    expect(
      readEffort({
        a: 45,
        b: 12.6,
        zero: 0,
        negative: -5,
        text: '30',
        nan: Number.NaN,
        huge: MAX_EFFORT_MINUTES + 1,
        limit: MAX_EFFORT_MINUTES,
      }),
    ).toEqual({ a: 45, b: 13, limit: MAX_EFFORT_MINUTES });
  });

  it('reads anything that is not a plain object as empty, which is how an old save looks', () => {
    expect(readEffort(undefined)).toEqual({});
    expect(readEffort(null)).toEqual({});
    expect(readEffort([30])).toEqual({});
    expect(readEffort('30')).toEqual({});
  });
});

describe('setEffort', () => {
  it('stores a rounded value under the item id and leaves every other key alone', () => {
    expect(setEffort({ other: 10 }, 'paper', 37.4)).toEqual({ other: 10, paper: 37 });
  });

  it('clamps into the stored range rather than writing something the reader would refuse', () => {
    expect(setEffort({}, 'paper', 0)).toEqual({ paper: 1 });
    expect(setEffort({}, 'paper', 999_999)).toEqual({ paper: MAX_EFFORT_MINUTES });
  });

  it('clears on null, and clearing an absent item returns the same map', () => {
    const map = { paper: 60 };
    expect(setEffort(map, 'paper', null)).toEqual({});
    const empty = {};
    expect(setEffort(empty, 'paper', null)).toBe(empty);
  });

  it('refuses a non-finite number by keeping the map as it was', () => {
    const map = { paper: 60 };
    expect(setEffort(map, 'paper', Number.NaN)).toBe(map);
    expect(setEffort(map, 'paper', Number.POSITIVE_INFINITY)).toBe(map);
  });

  it('returns the same map when the stored value would not change', () => {
    const map = { paper: 60 };
    expect(setEffort(map, 'paper', 60)).toBe(map);
  });
});

describe('the reducer carries the estimate', () => {
  it('writes through setEffort and clears on null', () => {
    const set = reducer(blank(), { type: 'setEffort', id: 'paper', minutes: 90 });
    expect(set.effort).toEqual({ paper: 90 });
    const cleared = reducer(set, { type: 'setEffort', id: 'paper', minutes: null });
    expect(cleared.effort).toEqual({});
  });

  it('does not touch finished or started state', () => {
    const before = reducer(blank(), { type: 'toggleStarted', id: 'paper' });
    const after = reducer(before, { type: 'setEffort', id: 'paper', minutes: 30 });
    expect(after.started).toEqual(before.started);
    expect(after.done).toEqual(before.done);
  });
});

describe('effortLine', () => {
  it('names which figure is the student’s and which is inferred', () => {
    expect(effortLine(45, 60)).toBe('You expect this to take 45 min. Your pace in this course says about 60 min.');
  });

  it('says so when only one figure exists', () => {
    expect(effortLine(45, null)).toBe('You expect this to take 45 min.');
    expect(effortLine(undefined, 60)).toBe(
      'Your pace in this course says about 60 min. You have not given your own estimate.',
    );
  });

  it('is empty with nothing to compare, so the caller can omit the line', () => {
    expect(effortLine(undefined, null)).toBe('');
  });
});
