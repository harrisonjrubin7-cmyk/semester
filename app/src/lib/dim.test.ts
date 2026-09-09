import { describe, expect, it } from 'vitest';
import { AA_TEXT, contrast, failLine, over, passes, type Check } from './contrast';
import { GROUNDS, tokensFor } from './look';
import { DIMMED_ROW, faintLine, secondLine } from './dim';

/**
 * The audit `contrast.test.ts` runs over the tokens, run over the dimming the
 * components actually apply.
 *
 * The tokens were never the problem. What was missing is that a row can be
 * dimmed a second time by an `opacity` no palette audit can see, and that the
 * product of the two is what a person reads.
 */
describe('a row that is behind you', () => {
  /**
   * The row's own text, at `--app-row-dim`, on every ground the app ships.
   *
   * Held to AA_TEXT and not to AA_LARGE: a ticked deadline's title is 12–15px,
   * and it is the line you read to check you ticked the right thing.
   *
   * This is the check that said one number could not do it. At a flat 0.5 the
   * six dark grounds passed and every light one failed — Parchment at 3.28:1,
   * Industry at 3.13:1 — because dark ink fades faster on a light page. The
   * token carries the ground's own figure instead.
   */
  it('is still readable on every ground', () => {
    const bad: Check[] = [];
    for (const g of GROUNDS) {
      const t = tokensFor({ ground: g.id });
      const alpha = Number(t['--app-row-dim']);
      expect(alpha).toBeGreaterThan(0);
      for (const [name, back] of [
        ['panel', t['--app-panel']],
        ['bg', t['--app-bg']],
      ] as const) {
        bad.push({
          what: `${g.label} · a ticked row on ${name}`,
          ratio: contrast(over(g.fg, back, alpha) ?? '', back) ?? 0,
          needs: AA_TEXT,
        });
      }
    }
    expect(bad.filter((c) => !passes(c)).map(failLine)).toEqual([]);
  });

  /** It is a token, so a screen cannot pick its own number for it again. */
  it('is the token and not a figure', () => {
    expect(DIMMED_ROW).toBe('var(--app-row-dim)');
  });

  /**
   * The bug this file exists for.
   *
   * Five call sites dimmed a row and then dimmed the line inside it again. The
   * measured products were 0.42 × 0.55 = 0.231 and 0.45 × 0.6 = 0.27, which
   * render at 1.9:1 and 2.15:1 — worse than the 3:1 WCAG allows even for large
   * text, on 11px captions.
   */
  it('does not dim its second line a second time', () => {
    expect(secondLine(true)).toEqual({});
    expect(faintLine(true)).toEqual({});

    // What it would have come to, had the two stacked. Kept as arithmetic so
    // the failure is a number rather than a memory.
    for (const g of GROUNDS) {
      const t = tokensFor({ ground: g.id });
      const back = t['--app-bg'];
      const stacked = contrast(over(g.fg, back, Number(t['--app-row-dim']) * 0.55) ?? '', back) ?? 0;
      expect(stacked).toBeLessThan(AA_TEXT);
    }
  });

  /** Outside a dimmed row it is the audited token, not a number picked by eye. */
  it('uses the tokens the palette audit already checks', () => {
    expect(secondLine()).toEqual({ color: 'var(--app-dim)' });
    expect(secondLine(false)).toEqual({ color: 'var(--app-dim)' });
    expect(faintLine()).toEqual({ color: 'var(--app-faint)' });
  });

  /**
   * And so "Increase contrast" reaches it.
   *
   * The setting raises `--app-dim`, `--app-faint` and now `--app-row-dim`. Text
   * dimmed by a hand-written `opacity` is text the setting cannot touch, which
   * is why `secondLine` returns a colour and `DIMMED_ROW` returns a token.
   *
   * Measured before this file existed: with `prefers-contrast: more` on, the
   * tokens rose correctly, no element on Today used any of them, and fourteen
   * were still dimmed by an inline opacity.
   */
  it('rises when the device asks for more contrast', () => {
    for (const g of GROUNDS) {
      const plain = tokensFor({ ground: g.id }, false);
      const loud = tokensFor({ ground: g.id }, true);
      const back = plain['--app-panel'];
      const was = contrast(over(g.fg, back, Number(plain['--app-row-dim'])) ?? '', back) ?? 0;
      const now = contrast(over(g.fg, back, Number(loud['--app-row-dim'])) ?? '', back) ?? 0;
      expect(now).toBeGreaterThanOrEqual(was);
      expect(plain['--app-dim']).not.toBe(loud['--app-dim']);
    }
  });
});
