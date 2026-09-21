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


/**
 * The map nobody can use is withdrawn, and not merely covered.
 *
 * When no tile arrives, this file paints a panel over the map at a z-index of
 * 1200 — deliberately over Leaflet's own furniture, "so nothing offers to zoom
 * in on nothing". That stops a pointer and stops nothing else. The targets
 * sweep reported four controls on the maps screen answering nowhere inside
 * their own box, and they were the four under that panel: the host, the two
 * zoom links and the attribution link. Tabbing the screen in a real browser
 * reached every one of them — opaque panel above, four live controls below.
 * Measured: eight stops over two passes before, zero after, and taking the
 * attribute off again in the same page brought the same four straight back.
 *
 * So the pairing is what is asserted, not the presence. `inert` on a different
 * condition from the panel is the fault in a new place — withdrawn with
 * nothing said, or said with nothing withdrawn — and it would look right in
 * review either way.
 *
 * The sweep's half is here rather than beside the sweep's other tests because
 * it is the same fix: an inert control is not a target, the script had no way
 * to know that, and a run where the app withdraws a control and the instrument
 * still counts it reports a failure that is the author doing the right thing.
 * Splitting the pair across two files is how one half gets deleted alone.
 */
describe('the map that cannot be used', () => {
  /** What the panel is drawn on, taken from the source rather than assumed. */
  const condition = (): string => {
    const m = /\{(\w+) && \(/.exec(source);
    expect(m, 'the blank panel is no longer rendered on a bare condition').not.toBeNull();
    return m![1];
  };

  it('is rendered over, on a condition this test can name', () => {
    expect(condition()).toBe('blank');
    expect(source).toMatch(/The map itself needs a connection\./);
  });

  it('is withdrawn on that same condition, not merely painted over', () => {
    expect(
      source,
      'the host takes inert from something other than the panel condition',
    ).toContain(`inert={${condition()}}`);
  });

  it('is withdrawn on the host, which is what holds Leaflet and its controls', () => {
    // Between `ref={host}` and the end of that element's props. On the wrapper
    // instead, inert would swallow the panel's own text along with the map.
    const el = source.slice(source.indexOf('ref={host}'), source.indexOf('{blank &&'));
    expect(el).toContain('inert={blank}');
  });

  it('is skipped by the sweep, which would otherwise fail it for being right', () => {
    const sweep = readFileSync(new URL('../../scripts/targets-sweep.mjs', import.meta.url), 'utf8');
    expect(sweep, 'the sweep no longer knows what inert means').toMatch(
      /const live = \(el\) => !el\.closest\('\[inert\]'\)/,
    );
    // Both control loops, or the census and the measurement disagree.
    expect(sweep.match(/!seen\(el\) \|\| !live\(el\)/g) ?? []).toHaveLength(2);
  });
});
