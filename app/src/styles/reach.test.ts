import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Reach is not spacing, and a control that buys reach has to own it.
 *
 * Two faults with one shape, both found by running `scripts/targets-sweep.mjs`
 * at Tight for the first time. Every tap-target figure this app had ever
 * printed was taken at Comfortable, and 33 phone controls (36 on desktop) sat
 * under the 24x24 of WCAG 2.5.8 AA the moment the reader asked for a tighter
 * screen.
 *
 *   `FoldHead` in `components/Fold.tsx` pays 6 real pixels of padding for its
 *   reach and hands them straight back as a negative margin, so the box grows
 *   and the layout does not move. Correct, and invisible to the pointer: an
 *   unpositioned button loses the overlap it just created to whatever paints
 *   after it. Measured on Privacy, the heading reached 10.43px down at
 *   Comfortable and 9.09 at Tight — 24.01 of target, then 22.66 — and
 *   `elementFromPoint` on its bottom pad answered with the div below.
 *   `position: relative` fixed every screen but two; Settings and Profile put
 *   a `.blueprint` panel under the heading, which is positioned itself, so
 *   two auto layers tied and document order broke the tie the wrong way.
 *
 *   `.chiprow .btn` and `.seg .btn` in `industry.css` are let out of the 44px
 *   floor `.btn` carries, on a measurement — "a chip at 29px clears the 24x24
 *   AA asks for" — that was taken at one density and true at one density.
 *   Exempted, the box is padding alone, the padding is `--space-2`, and every
 *   space token answers `--density`: 25.2px at Comfortable, 23.8 at Snug,
 *   22.6 at Tight. The four course chips on Update read 23.5 of target.
 *
 * Both are now 0 of 1480 (phone) and 0 of 2082 (desktop) at all three
 * densities. This test cannot measure any of that — it needs a browser, and
 * the browser is the sweep, which is not a CI step. What it holds is the
 * mechanism: that the reach stays in real pixels, that the floor stays a
 * floor, and that the heading keeps the layer it needs to be hit on.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const industry = strip(readFileSync(new URL('./industry.css', import.meta.url), 'utf8'));
const fold = strip(readFileSync(new URL('../components/Fold.tsx', import.meta.url), 'utf8'));

describe('the chips let out of the 44px floor', () => {
  it('still stand on one of 24 real pixels', () => {
    const rule = industry.match(/\.chiprow \.btn,\s*\.seg \.btn \{([^}]*)\}/);
    expect(rule, '.chiprow .btn / .seg .btn no longer share a rule').not.toBeNull();
    const floor = rule![1].match(/min-height:\s*([\d.]+)px/);
    expect(floor, `their floor is not a plain px min-height: ${rule![1].trim()}`).not.toBeNull();
    expect(Number(floor![1]), 'below the 24x24 of WCAG 2.5.8 AA').toBeGreaterThanOrEqual(24);
  });

  it('take that floor in pixels and not in a token that Density would shrink', () => {
    const rule = industry.match(/\.chiprow \.btn,\s*\.seg \.btn \{([^}]*)\}/)![1];
    expect(rule, 'a floor multiplied by --density is not a floor').not.toMatch(
      /var\(--density|var\(--space-|var\(--sp-/,
    );
  });

  /*
   * `.btn-icon` keeps its 0, and that is not an oversight to be corrected on
   * the next reading: it sets width and height outright, so a floor under it
   * decides nothing. The assertion is on the reason, so that removing the
   * reason fails here rather than silently leaving a 0 with no argument.
   */
  it('leave .btn-icon alone, because its box is given outright', () => {
    expect(industry).toMatch(/\.btn-icon \{ min-height: 0; \}/);
    expect(industry).toMatch(/\.btn-icon \{[^}]*width: 36px; height: 36px/);
  });
});

describe('the folding heading', () => {
  /*
   * From the padding that buys the reach to the end of the style object.
   *
   * A function and not a `const` in the describe body, which is what it was.
   * The slice starts at the padding, so a revert that takes the padding away
   * makes `indexOf` return -1 — and an `expect` about that, evaluated where
   * the first version put it, throws while the file is being collected. The
   * whole file errored, no test in it ran, and the one assertion that exists
   * to catch exactly that revert never got to make it. Red either way, but
   * red for the wrong reason is how a guard stops naming its own fault.
   */
  const style = () => {
    const from = fold.indexOf("paddingBlock: '6px'");
    if (from < 0) return '';
    return fold.slice(from, fold.indexOf('}}', from));
  };

  it('pays for its reach in real pixels, both ways', () => {
    expect(style(), "FoldHead's 6px of reach is gone, or is read off a token now").toContain(
      "paddingBlock: '6px'",
    );
    expect(style(), 'the margin must give back exactly what the padding took').toContain(
      "marginBlock: '-6px'",
    );
  });

  it('is hit on the padding it paid for, and not by the panel below it', () => {
    expect(style(), 'without a position the overlap is drawn and not hittable').toContain(
      "position: 'relative'",
    );
    // Not `position` alone: two `z-index: auto` siblings paint in document
    // order, and the panel comes second. Settings and Profile were the two
    // screens that proved it.
    expect(style(), 'a positioned sibling after it wins the tie without a layer').toMatch(
      /zIndex:\s*[1-9]/,
    );
  });
});
