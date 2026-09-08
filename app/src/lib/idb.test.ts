import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './idb';

/**
 * The one id generator the app has, and the promise it makes.
 *
 * `threads.test.ts` asks for two hundred distinct ids and gets them, which
 * used to be a dice roll: every id in a loop shares a timestamp, so only the
 * noise separated them, and six base36 characters put two hundred draws about
 * one run in a hundred thousand from a collision. It flaked, once, in about a
 * hundred runs — which was the four-character version, before these were
 * unified.
 *
 * The tests below take the dice away. The clock is frozen and the noise is
 * pinned to one value, so anything still distinct is distinct because of the
 * counter and not because it got lucky.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** One millisecond, one random value: everything the noise could give. */
function frozen() {
  vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
}

describe('two ids made in the same millisecond', () => {
  it('differ even when the noise is identical', () => {
    frozen();
    expect(newId()).not.toBe(newId());
  });

  it('are all distinct across a whole import, not just usually', () => {
    // The shape of the case that flaked: a loop inside one tick. With the
    // clock and the noise both pinned, a collision here is a certainty rather
    // than a probability — which is the point.
    frozen();
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });

  it('are distinct across the prefixes too', () => {
    frozen();
    const ids = new Set([newId('t'), newId('snap-'), newId(), newId('t')]);
    expect(ids.size).toBe(4);
  });
});

describe('what the id is made of', () => {
  it('carries the prefix, and nothing when none is asked for', () => {
    expect(newId('t')).toMatch(/^t/);
    expect(newId('snap-')).toMatch(/^snap-/);
    expect(newId()).toMatch(/^[0-9a-z]/);
  });

  it('keeps the noise at its full six characters', () => {
    // The between-tabs case has no counter to lean on — a backup restored
    // from another device lands with a clock of its own — so the randomness
    // is the only defence there and must not be traded away for the counter.
    frozen();
    const noise = newId().split('-')[1].slice(3);
    expect(noise).toHaveLength(6);
  });

  it('still sorts by when it was made', () => {
    // Time first, so a plain string sort is chronological. The counter sits
    // after the timestamp for the same reason.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const early = newId();
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_060_000);
    const late = newId();
    expect([late, early].sort()).toEqual([early, late]);
  });
});
