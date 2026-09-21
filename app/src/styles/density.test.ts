import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The Density setting reaches the stylesheets, and keeps reaching them.
 *
 * Comfortable / Snug / Tight works by putting `--density` on the root for the
 * spacing tokens to multiply by. A token that drops the multiplier does not
 * fail anywhere — it goes on resolving to a perfectly good number, and the
 * setting silently stops working at every site that reads it. There is no
 * screen that looks broken and no test that goes red; the only symptom is that
 * Tight moves less than it says it does.
 *
 * That is what had happened. `industry.css` defines the design system's own
 * scale, `--space-1` through `--space-8`, and spends it on every button, card,
 * row and table in the system underneath; all six steps were plain px, so 21
 * call sites answered nothing. Measured across five screens at 420x900, the
 * elements carrying the system's component classes moved 0.8821 of their
 * Comfortable size at Tight where everything else moved 0.8048 — they shrank
 * only as much as the `app.css` rules reaching them did.
 *
 * So both halves are pinned here: the tokens carry the multiplier, and the
 * sheets do not grow new spacing that goes around them.
 */
const sheet = (f: string) =>
  readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
    // A comment may quote a number this file would otherwise read as code.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('the spacing tokens', () => {
  it.each([
    ['app.css', '--sp-', 7],
    ['industry.css', '--space-', 6],
  ])('in %s all multiply by --density', (file, prefix, count) => {
    const defs = [...sheet(file).matchAll(
      new RegExp(`^\\s*(${prefix}\\d+)\\s*:\\s*([^;]+);`, 'gm'),
    )];
    expect(defs.length, `${prefix}* steps found in ${file}`).toBe(count);
    for (const [, name, value] of defs) {
      expect(value, `${name} no longer answers the Density setting`).toContain(
        'var(--density',
      );
    }
  });
});

/*
 * And the sheets do not route around them.
 *
 * A count rather than a rule, for the same reason `styles/budget.ts` is a
 * count: each number may shrink and may not grow. `features.css` carried 125
 * of these when this was written and carries none now, so its line is a floor
 * holding a finished sheet rather than a budget for an unfinished one.
 *
 * `app.css`'s eight are the ones where scaling is the bug, and they are listed
 * rather than tolerated:
 *
 *   `.sr-only`'s `margin: -1px`      the clip idiom, not spacing
 *   a `100dvh` centring margin       answers the viewport, not the setting
 *   three `env(safe-area-*)` insets  answer the device's own chrome
 *   `.leaflet-popup-content`         third-party geometry this sheet matches
 *   `.rib-tab`'s -1px and 1px        overlaps a border that is 1px at every
 *                                    density, so the overlap must be too
 *
 * `industry.css`'s `.blueprint > .corner` is not among them: its offsets are
 * `top`/`left`, which place an ornament rather than space content, and this
 * counts the spacing properties only.
 */
const SPACING =
  /(?:^|[;{}])\s*(padding|margin|gap|row-gap|column-gap)((?:-(?:top|right|bottom|left|inline|block))?(?:-(?:start|end))?)\s*:\s*([^;}]+)/g;

const unscaled = (file: string) =>
  [...sheet(file).matchAll(SPACING)]
    .filter(([, , , value]) => /\d+(?:\.\d+)?px/.test(value))
    .filter(([, , , value]) => !/var\(--density|var\(--sp-|var\(--space-/.test(value))
    .map(([, prop, side, value]) => `${prop}${side}: ${value.trim()}`);

describe('spacing written past the tokens', () => {
  it.each([
    ['app.css', 8],
    ['industry.css', 0],
    ['features.css', 0],
  ])('%s holds no more than its %i', (file, allowed) => {
    const found = unscaled(file);
    expect(
      found.length,
      `${file} spacing that ignores Density:\n  ${found.join('\n  ')}`,
    ).toBeLessThanOrEqual(allowed);
  });

  /*
   * `scroll-margin-top` is not in that count and must not be: it offsets where
   * `scrollIntoView` stops so the focus ring clears the frosted header, and it
   * lays out nothing. Two earlier versions of this pattern matched it on the
   * `-margin` tail, along with `border-left` on `left` — which is how a probe
   * reports work that is not there.
   */
  it('counts spacing properties and not the things that merely end in one', () => {
    const decoys = `.a { scroll-margin-top: 96px; border-left: 1px solid red; }`;
    expect([...decoys.matchAll(SPACING)]).toHaveLength(0);
  });
});
