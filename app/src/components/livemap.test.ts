import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The timers the map sets, and whether it takes them back.
 *
 * Leaflet measures its container on creation, and this one is often still
 * laying out, so the effect that builds the map schedules `invalidateSize` a
 * tick later. It did not clear it. Unmount inside those sixty milliseconds —
 * tap Maps and change your mind, which people do and which every sweep of
 * these screens does dozens of times — and the timer fires after `m.remove()`
 * has taken the container away:
 *
 *     TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
 *
 * Uncaught, with nothing visibly wrong, because the map has already gone. That
 * is why it survived: it shows up as an error and never as a symptom. But
 * `components/Watching.tsx` listens on `window` for precisely this and files
 * it as a fault, so the app reported itself broken for the ordinary act of
 * leaving a page early. Measured on the 228-screen sweep before the fix: one
 * such error in every one of the twelve shell × navigation combinations.
 *
 * A source-level guard rather than a rendered one, because reproducing it
 * needs a real Leaflet against a real container and a sixty-millisecond race,
 * and what actually went wrong is visible in the text: a `setTimeout` whose
 * handle nothing keeps.
 */
const source = readFileSync(new URL('./LiveMap.tsx', import.meta.url), 'utf8');

describe('the map cleans up after itself', () => {
  it('keeps a handle on every timer it sets', () => {
    // `setTimeout(` with nothing assigning it is one nobody can cancel.
    const loose = source
      .split('\n')
      .filter((line) => /(?<![=(]\s*)\bsetTimeout\(/.test(line) && !/=\s*setTimeout\(/.test(line));
    expect(loose, `unassigned setTimeout: ${loose.join(' | ')}`).toEqual([]);
  });

  it('clears as many timers as it sets', () => {
    const set = source.match(/=\s*setTimeout\(/g) ?? [];
    const cleared = source.match(/clearTimeout\(/g) ?? [];
    expect(set.length).toBeGreaterThan(0);
    expect(cleared.length).toBeGreaterThanOrEqual(set.length);
  });

  it('clears the one the map is built with, in the same effect that removes it', () => {
    // The specific regression: the creation effect's cleanup has to do both,
    // and it is the pairing rather than the presence that matters.
    const cleanup = /return \(\) => \{([\s\S]*?)\n    \};/.exec(source)?.[1] ?? '';
    expect(cleanup).toMatch(/clearTimeout\(/);
    expect(cleanup).toMatch(/\.remove\(\)/);
  });
});
