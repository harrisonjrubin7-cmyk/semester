// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRAIL_KEY, type Visit } from './trail';
import { forgetTrail, recordVisit, trail } from './trail.hook';
import type { Screen } from './types';

/**
 * The trail on the device, and the two things about it that are not the fold.
 *
 * `trail.test.ts` holds the record's rules. What is here is the half that
 * touches the machine: it goes to `localStorage` under a key of its own rather
 * than into the store, and it survives a store that will not take it.
 *
 * The module holds the trail in a module-level variable, on purpose — see its
 * header — so every case here starts by clearing the device *and* the memory of
 * it, in that order.
 */

const places = (list: Visit[]) => list.map((v) => `${v.screen}${v.id ? `/${v.id}` : ''}`);
const saved = () => JSON.parse(localStorage.getItem(TRAIL_KEY) ?? '[]') as Visit[];

/** A copy of the module that has not read the device yet. */
const fresh = async () => {
  vi.resetModules();
  return import('./trail.hook');
};

beforeEach(() => {
  localStorage.clear();
  forgetTrail();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  forgetTrail();
});

describe('the trail, on this device', () => {
  it('is empty before anywhere has been', () => {
    expect(trail()).toEqual([]);
  });

  it('writes a visit through to the device as it records it', () => {
    recordVisit('course' as Screen, 'econ', 1_000);
    expect(places(trail())).toEqual(['course/econ']);
    expect(saved()).toEqual([{ screen: 'course', id: 'econ', at: 1_000 }]);
  });

  /*
   * The point of the key. The account's own save is `semester.v1` and goes to
   * the cloud; this one does not, and a backup restored onto a phone must not
   * bring a desktop's reading history with it.
   */
  it('goes under a key of its own, and not into the account’s save', () => {
    recordVisit('note' as Screen, 'n1', 1_000);
    expect(TRAIL_KEY).toBe('semester.trail.v1');
    expect(localStorage.getItem('semester.v1')).toBeNull();
  });

  /*
   * The load path, which is only reachable on a module that has not looked yet.
   *
   * `forgetTrail` sets the memory to an empty trail rather than to nothing, so
   * it cannot be used to force a re-read — that is right for the app, where a
   * page load is the only time this runs, and it is why this case imports a
   * fresh copy of the module instead of clearing the one above.
   */
  it('reads the device’s copy back the first time anything asks', async () => {
    localStorage.setItem(TRAIL_KEY, JSON.stringify([{ screen: 'home', id: '', at: 2_000 }]));
    const cold = await fresh();
    expect(places(cold.trail())).toEqual(['home']);
  });

  it('empties both halves when it is forgotten', () => {
    recordVisit('course' as Screen, 'econ', 1_000);
    forgetTrail();
    expect(trail()).toEqual([]);
    expect(localStorage.getItem(TRAIL_KEY)).toBeNull();
  });

  /*
   * A private window with site data off, or a full store. The account's save
   * has first claim on the five megabytes, so this is dropped quietly: the
   * trail holds for the session and the app does not fail a navigation over
   * knowing where somebody was on Tuesday.
   */
  it('keeps the trail for the session when the device will not take it', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => recordVisit('course' as Screen, 'econ', 1_000)).not.toThrow();
    expect(places(trail())).toEqual(['course/econ']);
    setItem.mockRestore();
    expect(localStorage.getItem(TRAIL_KEY)).toBeNull();
  });

  it('starts empty rather than throwing when the device will not be read', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    // A cold module, because the first read is the one that loads.
    const cold = await fresh();
    expect(cold.trail()).toEqual([]);
    getItem.mockRestore();
  });
});
