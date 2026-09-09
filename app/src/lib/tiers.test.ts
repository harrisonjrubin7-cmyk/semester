import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP, DESKTOP_AT, TABLET_AT, WIDE, tierFor } from './media';

/**
 * The three layouts, and the one thing that can break them silently.
 *
 * The breakpoints exist twice — as constants here, which decide whether the
 * rail is drawn and which chrome the app builds, and as media queries in
 * `styles/app.css`, which decide every width, gutter and column that goes
 * with it. A stylesheet cannot import a constant, so the copies are real and
 * the only question is whether anything notices when they drift.
 *
 * Nothing would. Move the desktop boundary here and not there and the app
 * builds, the tests pass, and between 1180 and whatever the new number is you
 * get the desktop's rail beside the phone's gutters — a layout nobody chose,
 * on a range of widths nobody tests at, on the machine somebody happens to
 * have. So it is asserted instead.
 */
const css = readFileSync(join(__dirname, '..', 'styles', 'app.css'), 'utf8');

describe('the three layouts', () => {
  it('puts a phone, a tablet and a desktop in the right one', () => {
    expect(tierFor(390)).toBe('phone');
    // An iPad mini upright, and the widest phone in landscape.
    expect(tierFor(744)).toBe('phone');
    expect(tierFor(TABLET_AT)).toBe('tablet');
    // An iPad in portrait, and the same iPad in Split View at half a screen.
    expect(tierFor(834)).toBe('tablet');
    expect(tierFor(DESKTOP_AT - 1)).toBe('tablet');
    expect(tierFor(DESKTOP_AT)).toBe('desktop');
    expect(tierFor(1440)).toBe('desktop');
  });

  it('writes the same two numbers into the queries the components read', () => {
    expect(WIDE).toBe(`(min-width: ${TABLET_AT}px)`);
    expect(DESKTOP).toBe(`(min-width: ${DESKTOP_AT}px)`);
  });

  it('agrees with the stylesheet about where each layout starts', () => {
    // Not "contains once": both numbers appear in several queries, and what
    // matters is that no *other* nearby boundary has been introduced beside
    // them — a 1200 or a 768 written into one rule is exactly the drift this
    // is here to catch.
    const widths = [...css.matchAll(/@media[^{]*\(min-width:\s*(\d+)px\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths).toContain(TABLET_AT);
    expect(widths).toContain(DESKTOP_AT);
    for (const w of widths) {
      // 900 is the floating window's own boundary — a desktop *browser* rather
      // than a device — and 1600 the large-monitor step. Both are documented
      // where they are written. Anything else is a fourth layout by accident.
      expect([TABLET_AT, DESKTOP_AT, 900, 1600]).toContain(w);
    }
  });

  it('gives every tier token a phone value before any query changes it', () => {
    // The phone is the base, and it is the layout with no media query of its
    // own — so a token declared only inside the tablet or desktop block is
    // undefined on a phone, and the property it feeds falls back to whatever
    // the browser would have done. Silently, and only on the smallest screen.
    const block = css.slice(css.indexOf('── The three layouts'));
    const base = block.slice(block.indexOf(':root {'), block.indexOf(`@media (min-width: ${TABLET_AT}px)`));
    for (const token of ['--page-pad', '--chrome-pad', '--measure', '--canvas', '--rail-w', '--device-max']) {
      expect(base).toContain(`${token}:`);
    }
  });
});
