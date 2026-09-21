// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERSISTED, STORAGE_KEY, freshPersisted, loadPersisted, primePersisted } from './shape';
import { LEGACY_TERM, termNow } from '../lib/term';

/**
 * What semester a fresh install thinks it is.
 *
 * It thought Fall 2026, on every day of every year, because `state.term`
 * started as `LEGACY_TERM` — a constant whose own docstring says it is "the
 * term every course saved before terms existed belongs to" and "only ever a
 * fallback". It was doing two jobs: the one it was written for, which it does
 * correctly, and answering "what semester is it" for somebody opening the app
 * for the first time, which is a fact about the day.
 *
 * Measured on the real `loadPersisted` with nothing stored, before the fix:
 *
 *     opened Mon Sep 21 2026 · app says 2026FA · actually 2026FA
 *     opened Wed Feb 03 2027 · app says 2026FA · actually 2027SP
 *     opened Thu Jun 03 2027 · app says 2026FA · actually 2027SU
 *     opened Sun Jan 09 2028 · app says 2026FA · actually 2028SP
 *
 * Right in the week it was written and wrong from January onwards. It is not
 * a label: `screens/Import.tsx` stamps every course it adds with `state.term`
 * and `yearFor` resolves a bare month against that term's own start month, so
 * a September deadline filed under Fall 2026 is a deadline a year in the
 * past — and `components/TermSwitch.tsx` is deliberately absent until there
 * is more than one term, so there is nothing on screen to correct it with.
 *
 * ## The control is the half that must not move
 *
 * The obvious fix is to make the constant itself read the clock, and it is
 * wrong. A *saved* state with no `term` in it was written before terms
 * existed, and its courses really do hold Fall 2026 dates; filing them under
 * today would move every deadline in them by a year, which is the failure
 * `LEGACY_TERM`'s docstring was written to prevent. So the two cases are told
 * apart rather than merged, and both directions are asserted here.
 */

beforeEach(() => {
  localStorage.clear();
  // `loadPersisted` caches its answer in a module-level `primed`, so a test
  // that does not clear it reads whatever the file before it decided.
  primePersisted(null);
});

afterEach(() => {
  vi.useRealTimers();
  primePersisted(null);
});

describe('the term a fresh install starts in', () => {
  it('is the term of the day it is opened, on every one of these days', () => {
    for (const [when, id] of [
      [new Date(2026, 8, 21), '2026FA'],
      [new Date(2027, 1, 3), '2027SP'],
      [new Date(2027, 5, 3), '2027SU'],
      [new Date(2028, 0, 9), '2028SP'],
    ] as const) {
      expect(freshPersisted(when).term).toBe(id);
    }
  });

  it('reaches the app through the real reader, with nothing stored', () => {
    // `freshPersisted` being right is not the claim. The claim is that a
    // fresh install gets it, which is a fact about `loadPersisted`'s empty
    // branch and was the line actually carrying the bug.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 1, 3));
    expect(loadPersisted().term).toBe('2027SP');
  });

  it('control: the constant itself stays the legacy term', () => {
    // Moving this would move every date in every course saved before terms
    // existed. It is the fallback for a saved state, not the answer for a new
    // one, and the fix is that those are now two different questions.
    expect(DEFAULT_PERSISTED.term).toBe(LEGACY_TERM);
  });

  it('control: a saved state with no term is still read as the legacy term', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 1, 3));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, nav: 'tabs' }));
    expect(loadPersisted().term).toBe(LEGACY_TERM);
  });

  it('control: a saved term is never overwritten by the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2028, 0, 9));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, term: '2027SU' }));
    expect(loadPersisted().term).toBe('2027SU');
  });

  it('agrees with the clock rather than with a second copy of the rule', () => {
    const when = new Date(2029, 7, 30);
    expect(freshPersisted(when).term).toBe(termNow(when).id);
  });
});
