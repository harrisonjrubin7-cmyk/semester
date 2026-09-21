import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DENSITIES } from '../lib/look';

/**
 * The sweep measures every density the app offers, and not a copy of the list.
 *
 * `scripts/targets-sweep.mjs` drives a real browser, so it cannot import
 * `lib/look.ts` — it carries its own `DENSITIES` array instead, and a copied
 * list of settings is a list that goes stale the moment a fourth is added.
 * A density nobody sweeps is a density nothing measures, which is the exact
 * hole this dimension was added to close: the script seeded none at all, so
 * every figure it printed for as long as it existed was a figure about
 * Comfortable, the loosest of the three.
 *
 * Read out of the source for the reason `isolation.test.ts` reads
 * `vite.config.ts`: the fault is the two falling out of step, and that is
 * visible in the text long before it is visible in a run.
 */

const SWEEP = join(process.cwd(), 'scripts/targets-sweep.mjs');

/** The ids and scales the sweep will actually seed, lifted out of its source. */
function inSweep(): { id: string; scale: number }[] {
  const src = readFileSync(SWEEP, 'utf8');
  const block = src.match(/const DENSITIES = \[([\s\S]*?)\];/);
  if (!block) throw new Error('targets-sweep.mjs no longer declares a DENSITIES array');
  return [...block[1].matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*scale:\s*([\d.]+)\s*\}/g)]
    .map((m) => ({ id: m[1], scale: Number(m[3]) }));
}

describe('the target sweep and the app agree on what a density is', () => {
  it('found both lists, so the rest of this means something', () => {
    expect(DENSITIES.length).toBeGreaterThan(1);
    expect(inSweep().length).toBeGreaterThan(1);
  });

  it('sweeps every density the app offers, with the same scale', () => {
    expect(inSweep()).toEqual(DENSITIES.map((d) => ({ id: d.id, scale: d.scale })));
  });

  it('includes the tightest, which is the one that finds things', () => {
    // Named rather than left to the deep-equal above, because this is the
    // case the whole dimension exists for: at Comfortable the app reads 0
    // controls under the AA minimum, and at Tight it does not.
    const tightest = [...DENSITIES].sort((a, b) => a.scale - b.scale)[0];
    expect(inSweep().some((d) => d.id === tightest.id)).toBe(true);
  });

  it('reads the density off the page rather than trusting the seed', () => {
    /*
     * A seed that does not take would run three times, draw Comfortable three
     * times, and print three identical figures under three different
     * headings — which looks exactly like proof that the setting costs
     * nothing. The script reads `--density` back off the root and refuses to
     * measure when it disagrees.
     */
    const src = readFileSync(SWEEP, 'utf8');
    expect(src).toMatch(/getPropertyValue\('--density'\)/);
    expect(src).toMatch(/The seed did not take/);
  });
});
