import { describe, expect, it } from 'vitest';
import {
  AA_LARGE,
  AA_TEXT,
  contrast,
  failLine,
  luminance,
  over,
  passes,
  rgbOf,
  type Check,
} from './contrast';
import { ACCENTS, GROUNDS, tokensFor } from './look';

describe('the arithmetic', () => {
  it('reads both hex forms', () => {
    expect(rgbOf('#ffffff')).toEqual([255, 255, 255]);
    expect(rgbOf('#fff')).toEqual([255, 255, 255]);
    expect(rgbOf('336699')).toEqual([51, 102, 153]);
    expect(rgbOf('not a colour')).toBeNull();
    expect(rgbOf('#12345')).toBeNull();
  });

  it('puts black at 0 and white at 1', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('gives the extremes WCAG defines', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('does not depend on which colour is named first', () => {
    expect(contrast('#1a1a1a', '#dddddd')).toBe(contrast('#dddddd', '#1a1a1a'));
  });

  it('is null rather than a bad ratio when a value is not a colour', () => {
    // A missing token and an illegible one need different things done, and
    // rounding the first into the second hides a real fault.
    expect(contrast('#000', 'var(--something)')).toBeNull();
  });

  it('agrees with a figure computed by hand', () => {
    // #767676 on white is the canonical 4.54:1 — the darkest grey that passes
    // AA for body text, quoted in every accessibility guide.
    expect(contrast('#767676', '#ffffff')!).toBeCloseTo(4.54, 1);
  });
});

describe('a colour blended over its background', () => {
  it('composites at the alpha given', () => {
    expect(over('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(over('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(over('#ffffff', '#000000', 0)).toBe('#000000');
  });

  it('is what actually decides legibility for translucent text', () => {
    // White at 42% on near-black is not white. Measuring the unblended value
    // would pass text that is unreadable on screen.
    const faint = over('#eceef2', '#12141a', 0.42)!;
    expect(contrast(faint, '#12141a')!).toBeLessThan(contrast('#eceef2', '#12141a')!);
  });
});

// ── The palette itself ────────────────────────────────────────────────────
//
// Ten accents × ten grounds. The four sample courses have only ever been
// looked at in one or two of these; the other ninety-odd have never been seen
// by anybody, which is exactly why they need checking by arithmetic.

describe('every combination the app will wear', () => {
  const combos = GROUNDS.flatMap((g) => ACCENTS.map((a) => ({ g, a })));

  it('is a hundred of them', () => {
    // Ten accents and ten grounds. I had written "six grounds" in the
    // proposal that led to this test and never counted them.
    expect(combos).toHaveLength(100);
    expect(GROUNDS.length * ACCENTS.length).toBe(100);
  });

  /** The checks one pairing has to survive. */
  const checksFor = (accentId: string, groundId: string): Check[] => {
    const t = tokensFor({ accent: accentId, ground: groundId });
    const g = GROUNDS.find((x) => x.id === groundId)!;
    const a = ACCENTS.find((x) => x.id === accentId)!;
    const where = `${a.label} on ${g.label}`;

    const panel = t['--app-panel'];
    const bg = t['--app-bg'];

    return [
      // Section labels and kickers: small uppercase text.
      { what: `${where} · accent-deep on panel`, ratio: contrast(t['--app-accent-deep'], panel) ?? 0, needs: AA_TEXT },
      { what: `${where} · accent-deep on bg`, ratio: contrast(t['--app-accent-deep'], bg) ?? 0, needs: AA_TEXT },
      // Figures and the active tab: larger text.
      { what: `${where} · accent on bg`, ratio: contrast(t['--app-accent'], bg) ?? 0, needs: AA_LARGE },
      { what: `${where} · accent on panel`, ratio: contrast(t['--app-accent'], panel) ?? 0, needs: AA_LARGE },
      // A dot, a bar, a meter: meaning without being read.
      { what: `${where} · accent-fill on bg`, ratio: contrast(t['--app-accent-fill'], bg) ?? 0, needs: AA_LARGE },
      // The ground's own text, at all three strengths, on its own panel.
      { what: `${where} · fg on panel`, ratio: contrast(g.fg, panel) ?? 0, needs: AA_TEXT },
      {
        what: `${where} · dim text on panel`,
        ratio: contrast(over(g.fg, panel, g.dimAlpha) ?? '', panel) ?? 0,
        needs: AA_TEXT,
      },
      {
        what: `${where} · faint text on panel`,
        ratio: contrast(over(g.fg, panel, g.faintAlpha) ?? '', panel) ?? 0,
        needs: AA_LARGE,
      },
    ];
  };

  it('renders every token as a real colour', () => {
    // A token that comes out as `undefined` or a `color-mix()` the checker
    // cannot read would silently pass every ratio below.
    const unreadable: string[] = [];
    for (const { g, a } of combos) {
      for (const c of checksFor(a.id, g.id)) {
        if (c.ratio === 0) unreadable.push(c.what);
      }
    }
    expect(unreadable).toEqual([]);
  });

  it('is legible in all of them', () => {
    // The failure this exists to catch: a pairing nobody has looked at that
    // sets section labels at 2.4:1 and ships, findable only by the one person
    // who chose it — who has no way to know it is a bug and not a design.
    const failures: string[] = [];
    for (const { g, a } of combos) {
      for (const c of checksFor(a.id, g.id)) {
        if (!passes(c)) failures.push(failLine(c));
      }
    }
    expect(failures).toEqual([]);
  });
});
