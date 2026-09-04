import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ONB_STEPS } from './misc';

/**
 * The first run is described in three places that must agree.
 *
 * `ONB_STEPS` says how many screens there are, the reducer decides when the
 * run is over from it, and `screens/Onboarding.tsx` writes "Step 3 of 4" on
 * the page and switches its content on `state.onb`. The reducer used to hold
 * its own copy of the count as a literal `>= 2`, so adding a screen would have
 * ended the run one early with the new screen never shown and nothing failing.
 * Read from source rather than mocked, because that is the only version of
 * these that ships.
 */
const onboarding = readFileSync(new URL('../screens/Onboarding.tsx', import.meta.url), 'utf8');
const navigate = readFileSync(new URL('../state/slices/navigate.ts', import.meta.url), 'utf8');

describe('the first run knows how long it is', () => {
  it('numbers every step out of the real total', () => {
    const labels = [...onboarding.matchAll(/Step (\d+) of (\d+)/g)];
    expect(labels.length).toBeGreaterThan(0);
    for (const [, , total] of labels) expect(Number(total)).toBe(ONB_STEPS);
  });

  it('numbers them consecutively, ending at the last', () => {
    // The first screen is the promise and carries the app's name rather than
    // a number, so the labels run from 2.
    const seen = [...onboarding.matchAll(/Step (\d+) of \d+/g)].map((m) => Number(m[1]));
    const want = Array.from({ length: ONB_STEPS - 1 }, (_, i) => i + 2);
    expect(seen).toEqual(want);
  });

  it('renders nothing past the last step', () => {
    const branches = [...onboarding.matchAll(/state\.onb === (\d+)/g)].map((m) => Number(m[1]));
    expect(branches.length).toBeGreaterThan(0);
    expect(Math.max(...branches)).toBeLessThan(ONB_STEPS);
  });

  it('ends the run from the constant, never from a literal', () => {
    // The bug this file exists for. A hardcoded bound here is invisible until
    // somebody adds a screen and it silently never appears.
    expect(navigate).toContain('ONB_STEPS');
    expect(navigate).not.toMatch(/state\.onb >= \d/);
  });
});
