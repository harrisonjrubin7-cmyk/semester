import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DRAWN_AT, SIZES, scaleFrom, scaleOf } from '../lib/look';

/**
 * The browser's own font size reaches the app.
 *
 * Raising the default font size is how a great many people with low vision
 * read the web — more often than zoom, because it leaves layouts alone and
 * only makes the words bigger. This app set the root to a flat `16 * scale`
 * px, which does not ignore that setting so much as *overwrite* it: driven
 * against Chromium with its default raised from 16 to 24, the app came out
 * pixel for pixel identical, root forced back to 16 and body text 12px either
 * way. Every other site they had made bigger; this one quietly undid it.
 *
 * The root is a percentage of the inherited size now, and `--text-scale` —
 * which the six type tokens and about twelve hundred inline sizes all
 * multiply through — is read back from what that produced.
 */
describe('the text scale', () => {
  it('is 1 on the root the design was drawn against, so nothing moves by default', () => {
    // The condition for a change this wide being safe: at the default it is
    // arithmetically the same number that was there before.
    expect(scaleFrom(DRAWN_AT)).toBe(1);
    expect(DRAWN_AT).toBe(16);
  });

  it('follows the browser up and down', () => {
    expect(scaleFrom(24)).toBe(1.5);
    expect(scaleFrom(20)).toBe(1.25);
    expect(scaleFrom(12)).toBe(0.75);
  });

  it('does not divide by a root of nothing', () => {
    // `parseFloat` of a missing computed style is NaN, and a NaN scale would
    // blank every font size in the app at once.
    expect(scaleFrom(0)).toBe(1);
    expect(scaleFrom(Number.NaN)).toBe(1);
  });

  it('composes with the app’s own setting rather than replacing it', () => {
    // 24px browser × Largest is 28.3px of root, not 18.9.
    const largest = scaleOf('largest');
    expect(largest).toBeGreaterThan(1);
    expect(scaleFrom(24 * largest)).toBeCloseTo(1.77, 2);
  });

  it('still offers the four sizes it always did', () => {
    expect(SIZES.map((s) => s.id)).toEqual(['compact', 'normal', 'large', 'largest']);
  });
});

describe('the root font size', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('is a percentage of what the browser was already using', () => {
    // `${16 * scale}px` is the shape of the bug: an absolute size on <html>
    // replaces the user's, a percentage multiplies it.
    expect(app).toMatch(/root\.style\.fontSize = `\$\{scale \* 100\}%`/);
    expect(app, 'an absolute root font size overwrites the setting').not.toMatch(
      /root\.style\.fontSize = `\$\{\d+ \* scale\}px`/,
    );
  });

  it('reads back what that produced, so the px sizes follow it', () => {
    // The root font size alone reaches only what is written in rem, and this
    // app writes px nearly everywhere.
    expect(app).toMatch(/getComputedStyle\(root\)\.fontSize/);
    expect(app).toMatch(/setProperty\('--text-scale', String\(scaleFrom\(/);
  });
});

/**
 * And the month grid cannot push a day off the screen.
 *
 * A grid's `1fr` is `minmax(auto, 1fr)`, and that `auto` floor is the column's
 * *content* width — so at a large enough type size seven columns of two-digit
 * numerals stopped fitting and the grid grew wider than the page, which clips
 * it. Measured at 320px with a 24px browser font at Largest: the Saturday
 * column, all four of its dates, gone off the right-hand edge with no way to
 * scroll to them.
 *
 * That was always latent; capping the effective scale at 1.18 is what hid it.
 * `minmax(0, 1fr)` lets a column be narrower than its numeral, which costs
 * nothing at any size that fits and is the difference between a tight cell and
 * a missing day at the sizes that do not.
 */
describe('the month grid', () => {
  const cal = readFileSync('src/screens/Calendar.tsx', 'utf8');

  it('lets its columns shrink rather than shoving one off the edge', () => {
    const grids = [...cal.matchAll(/gridTemplateColumns: '(repeat\(7[^']*)'/g)].map((m) => m[1]);
    expect(grids.length, 'the weekday row and the grid itself').toBeGreaterThanOrEqual(2);
    for (const g of grids) expect(g, 'a 1fr column cannot shrink below its content').toContain('minmax(0');
  });
});
