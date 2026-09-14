import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP, DESKTOP_AT, HANDHELD, TABLET_AT, TALL_AT, WIDE, tierFor } from './media';

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

  it('keeps a phone on its side a phone, however wide it is', () => {
    // The widest phone there is, lying down: an iPhone 15 Pro Max is 932pt
    // across in landscape — wider than an iPad mini is upright — and width
    // alone handed it the tablet layout and the rail with it.
    expect(tierFor(932, true)).toBe('phone');
    expect(tierFor(1194, true)).toBe('phone');
    // And the same widths held by anything that is not short: the exception
    // is the pair of conditions, never the width on its own.
    expect(tierFor(932)).toBe('tablet');
    expect(tierFor(1194)).toBe('desktop');
  });

  it('puts the boundary in the gap between a phone and a tablet, not on a device', () => {
    // Nothing that holds a rail is shorter than this on its shortest side,
    // and no phone is taller than it on its shortest side, so the number can
    // move within the gap without a device changing layout underneath it.
    const phonesOnTheirSide = [375, 390, 402, 412, 430];
    const tabletsOnTheirSide = [744, 810, 834, 1024];
    for (const h of phonesOnTheirSide) expect(h).toBeLessThan(TALL_AT);
    for (const h of tabletsOnTheirSide) expect(h).toBeGreaterThanOrEqual(TALL_AT);
  });

  it('agrees with the stylesheet about what a handheld is', () => {
    // The same two copies as the boundaries above, and the same failure if
    // they drift: the components would draw the tab bar while the sheet kept
    // the tablet's gutters and the floating frame around them.
    expect(HANDHELD).toBe(`(max-height: ${TALL_AT - 1}px) and (pointer: coarse)`);
    // Its pair: the same sentence for the rotation where the device is narrow
    // rather than short — an iPad mini upright, an iPad in Split View — which
    // has to move with `TABLET_AT` because that is the band it covers.
    expect(css).toContain(`@media (max-width: ${TABLET_AT - 1}px) and (pointer: coarse)`);
    expect(css).toContain(`@media (max-height: ${TALL_AT - 1}px) and (pointer: coarse)`);
    // Whatever else the sheet does with height, it does not introduce a
    // second short-window boundary beside this one.
    const heights = [...css.matchAll(/@media[^{]*\(max-height:\s*(\d+)px\)/g)].map((m) =>
      Number(m[1]),
    );
    for (const h of heights) expect(h).toBe(TALL_AT - 1);
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
