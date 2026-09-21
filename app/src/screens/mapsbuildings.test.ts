import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The map screen hands `roomStop` the buildings the school published.
 *
 * `lib/arrive.test.ts` proves what `roomStop` does with a buildings list, and
 * would go on passing with every one of its assertions green if this screen
 * stopped passing one — the parameter defaults to empty, so the feature would
 * fail silently and completely. That is precisely the state this change was
 * made to end: `buildings` was accepted by the pack reader, validated to two
 * thousand rows, typed in `lib/school.ts` and documented in
 * `docs/SCHOOL_DATA_PACK.md`, and read by no screen at all. A partner could
 * send a campus and the app would put none of it on a map.
 *
 * So the wiring is asserted rather than the behaviour, because the wiring is
 * the half that has already been missing once.
 *
 * Read out of the source, for the reason `styles/sweepdensity.test.ts` reads
 * the sweep's source: the fault is two things falling out of step, and that is
 * visible in the text long before it is visible in a run.
 */
const source = readFileSync(new URL('./Maps.tsx', import.meta.url), 'utf8');

/** Comments blanked, so prose naming a field is not read as code. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('the map and the school it is a map of', () => {
  it('reads the buildings off the resolved school', () => {
    expect(code, 'the screen no longer takes `school` from the store').toMatch(
      /const \{[^}]*\bschool\b[^}]*\} = useStore\(\)/,
    );
    expect(code, 'the screen no longer reads the published buildings').toMatch(
      /school\.data\.buildings/,
    );
  });

  it('passes them to roomStop, which is the only place they can do anything', () => {
    const call = /roomStop\(([^)]*)\)/.exec(code);
    expect(call, 'the screen no longer calls roomStop').not.toBeNull();
    const args = call![1].split(',').map((a) => a.trim());
    // places, then the school's list, then the per-stop extras. The order is
    // the precedence: a place you saved wins, and `arrive.ts` depends on being
    // handed them in that order.
    const places = args.indexOf('places');
    const sent = args.findIndex((a) => /buildings|sent/.test(a));
    expect(places, 'roomStop is no longer given your saved places').toBeGreaterThanOrEqual(0);
    expect(sent, 'roomStop is no longer given the school buildings').toBeGreaterThan(places);
  });

  it('falls back to an empty list rather than to undefined', () => {
    // `school.data.buildings` is optional in the type. Without the `?? []` the
    // screen would hand `undefined` past a defaulted parameter, which is fine
    // today and is one refactor away from not being.
    expect(code).toMatch(/school\.data\.buildings \?\? \[\]/);
  });
});
