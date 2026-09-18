/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast } from '../lib/contrast';

/**
 * The map credit is painted against its own box, not against the ground.
 *
 * `lib/contrast.test.ts` walks the token ramp, and every fade in this app is
 * checked there — every fade that is *on* the ground. This one is not. The
 * OpenStreetMap credit sits in a box over map tiles, and the tiles are
 * filtered the same way whichever of the thirteen grounds is set, so the
 * ground's fades are the wrong instrument for it.
 *
 * It was measured with them anyway, and that is the third time CLAUDE.md's
 * standing warning has come true: a fade measured against the one surface
 * that flatters it. `--app-faint` follows the ground and turns *dark* on a
 * light one, while the box under it was fixed dark and 28% transparent — so
 * on the six light grounds the credit was dark ink composited onto a mid
 * grey. `scripts/contrast-sweep.mjs`, the first time it ever opened `#/maps`,
 * read 1.45:1 on `industry`, 1.50:1 on `fog`, and 3.67:1 on `ink` itself.
 *
 * app.css says why this one is worth a test of its own: *the credit is the
 * licence*. An unreadable attribution is not a nit, it is the condition the
 * tiles are used under.
 *
 * So both ends of the pair are literals, and this is what holds them there.
 * A `var(--app-…)` in either place is the bug coming back, and it is caught
 * here rather than in a sweep nobody runs on a branch.
 */

const CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'app.css'), 'utf8');

/**
 * The body of one rule, by its exact selector.
 *
 * Exact, so `.leaflet-control-attribution` cannot answer with the body of
 * `.leaflet-control-attribution a` — the two set the same property to
 * different values and that is the whole subject of this file.
 */
const body = (selector: string): string | null => {
  const at = CSS.indexOf(`\n${selector} {`);
  if (at < 0) return null;
  const open = CSS.indexOf('{', at);
  const close = CSS.indexOf('}', open);
  return close < 0 ? null : CSS.slice(open + 1, close);
};

/** One property's value inside that rule, as written, without `!important`. */
const declared = (selector: string, prop: string): string | null => {
  const rule = body(selector);
  if (rule === null) return null;
  const value = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;!]+)`).exec(rule);
  return value ? value[1].trim() : null;
};

const BOX = '.leaflet-control-attribution';
const LINK = '.leaflet-control-attribution a';

describe('the OpenStreetMap credit', () => {
  /*
   * Literals first, because the ratios below cannot be computed at all from a
   * token — and a test that skipped what it could not read would go green on
   * exactly the change it exists to stop.
   */
  it('is painted in fixed ink on a fixed box', () => {
    for (const [what, value] of [
      ['box', declared(BOX, 'background')],
      ['words', declared(BOX, 'color')],
      ['link', declared(LINK, 'color')],
    ] as const) {
      expect(value, `the ${what} follows the ground again — see the note in app.css`).toMatch(
        /^#[0-9a-f]{6}$/i,
      );
    }
  });

  /*
   * Opaque, and that is half the fix rather than tidiness: the old box was
   * `rgba(10, 11, 14, 0.72)`, and the 28% that showed through is what made the
   * surface a different colour on a light ground than on a dark one.
   */
  it('sits on a box nothing shows through', () => {
    expect(declared(BOX, 'background')).not.toMatch(/rgba|hsla|transparent/i);
  });

  for (const [what, selector] of [
    ['the words', BOX],
    ['the link', LINK],
  ] as const) {
    it(`reads ${what} at 4.5:1 or better against that box`, () => {
      const box = declared(BOX, 'background');
      const ink = declared(selector, 'color');
      const c = contrast(ink ?? '', box ?? '');
      expect(c, `${ink} on ${box} should be measurable`).not.toBeNull();
      expect(c!).toBeGreaterThanOrEqual(4.5);
    });
  }

  /*
   * And the underline stays. The link and the words are two fades of one ink
   * and measure under 3:1 against each other — 1.71:1 as written, 1.96:1
   * before the pair was pinned — so WCAG 1.4.1's second signal is the only
   * thing telling the link from the sentence it sits in. `leaflet.css` loads
   * after this file and sets `text-decoration: none` at the same specificity,
   * which is why the `!important` is load-bearing and not a shortcut.
   */
  it('keeps the second signal that tells the link apart', () => {
    expect(body(LINK)).toMatch(/text-decoration:\s*underline\s*!important/);
    expect(contrast(declared(LINK, 'color') ?? '', declared(BOX, 'color') ?? '')!).toBeLessThan(3);
  });
});
