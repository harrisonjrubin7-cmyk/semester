import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { ACCENTS, GROUNDS, readLook, tokensFor, warnFor } from './look';

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

  it('is a hundred and forty-three of them', () => {
    // Eleven accents and thirteen grounds. I had written "six grounds" in the
    // proposal that led to this test and never counted them, which is why the
    // number is asserted rather than described: adding Industry and Industry
    // Dark moved it from 100 to 132, and Bone moved it to 143. Each time the
    // arithmetic below is what said so.
    expect(combos).toHaveLength(143);
    expect(GROUNDS.length * ACCENTS.length).toBe(143);
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

      /*
       * The soft shell's own pairings.
       *
       * The eight above are the drawn shell's, and they are not enough for a
       * shell that fills pills with the accent, paints a near-black tile on a
       * bone page and puts a progress bar on a translucent track. Each of
       * these was read off `app.css` rather than remembered — the audit is a
       * list of what the stylesheet actually pairs, or it is a list of what
       * somebody thought it paired.
       */

      // The handoff calls this the likely failure, and it would be: white on
      // the accent's `deep` stop is about 2.4:1. It passes because step 1
      // resolved `--app-accent-fill` to `shade` on light grounds, and this is
      // what holds that decision in place.
      {
        what: `${where} · pill and bar text: chrome-ink on accent-fill`,
        ratio: contrast(t['--chrome-ink'], t['--app-accent-fill']) ?? 0,
        needs: AA_TEXT,
      },
      // The dark tile's value, against both ends of its gradient.
      {
        what: `${where} · tile value on the light end of the gradient`,
        ratio: contrast(t['--tile-ink'], t['--tile-top']) ?? 0,
        needs: AA_TEXT,
      },
      {
        what: `${where} · tile value on the dark end of the gradient`,
        ratio: contrast(t['--tile-ink'], t['--tile-bottom']) ?? 0,
        needs: AA_TEXT,
      },
      // Glyphs are read as graphics, not as text.
      {
        what: `${where} · tile glyph on the light end of the gradient`,
        ratio: contrast(t['--tile-glyph'], t['--tile-top']) ?? 0,
        needs: AA_LARGE,
      },
      {
        what: `${where} · tile glyph on the dark end of the gradient`,
        ratio: contrast(t['--tile-glyph'], t['--tile-bottom']) ?? 0,
        needs: AA_LARGE,
      },
      // The stat meter: the fill has to be findable against its own groove.
      {
        what: `${where} · progress fill on its track`,
        ratio: contrast(t['--app-accent-fill'], over(g.fg, panel, g.light ? 0.12 : 0.09) ?? '') ?? 0,
        needs: AA_LARGE,
      },
      /*
       * The quiet caps label, at the size it is actually set.
       *
       * This is the one the audit caught. It was `--app-faint`, the strength
       * held to 3:1 — right for a hairline, wrong for the hero's meta note,
       * the bar's status line and the count under a folder's name, which are
       * all small uppercase *text*. It sat at 3.6–3.8:1 on all hundred and
       * forty-three, so it was not an unlucky pairing; it was the wrong token.
       */
      {
        what: `${where} · quiet caps on panel`,
        ratio: contrast(over(g.fg, panel, g.dimAlpha) ?? '', panel) ?? 0,
        needs: AA_TEXT,
      },
      {
        what: `${where} · the navigation's description line, on the ground`,
        ratio: contrast(over(g.fg, bg, g.dimAlpha) ?? '', bg) ?? 0,
        needs: AA_TEXT,
      },
      // The numbered step's chip, which inverts the ground.
      {
        what: `${where} · step number: ground on ink`,
        ratio: contrast(bg, g.fg) ?? 0,
        needs: AA_TEXT,
      },
      // `.surface-in` sits a panel on the ground, so its text is on the ground.
      {
        what: `${where} · body text on the ground`,
        ratio: contrast(g.fg, bg) ?? 0,
        needs: AA_TEXT,
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

/**
 * The other half of the audit: what the stylesheet actually uses.
 *
 * Everything above checks the tokens `tokensFor` emits. That is most of the
 * job and it is not all of it — a token can pass every ratio in this file
 * while the rule that renders the text names a different one, which is
 * exactly the bug the soft shell's quiet caps had. So these read `app.css`
 * and check that the rules whose colours the audit vouched for are the rules
 * that use them.
 *
 * Deliberately few. A test that pinned every declaration in the sheet would
 * fail on every restyle and teach people to update it without reading it;
 * these are the three pairings where using the wrong token is a contrast
 * failure rather than a preference.
 */
describe('the stylesheet uses the tokens the audit passed', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8');

  /** The declarations inside one rule, by its exact selector. */
  const ruleFor = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, `${selector} is not in app.css`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('sets the quiet caps in dim, not faint', () => {
    // `--app-faint` is held to 3:1, which is a hairline's bar. This is small
    // uppercase text — the hero's meta note, the count under a folder's name —
    // and it was failing on all 143 pairings.
    expect(ruleFor('.soft-caps-quiet')).toContain('var(--app-dim)');
    expect(ruleFor('.soft-caps-quiet')).not.toContain('var(--app-faint)');
  });

  it('fills the pill with the stop white survives on', () => {
    // The handoff's flagged failure: white on the accent's `deep` stop is
    // about 2.4:1. `--app-accent-fill` is `shade` on a light ground, which is
    // where the 4.5:1 above comes from — naming `--app-accent-deep` here
    // would pass every test in this file and fail every reader.
    //
    // `.soft-bar-primary` was the other filled pill and is checked no longer:
    // the bar it sat in is gone from every screen. See `lib/softtop.ts`.
    const body = ruleFor('.pill-soft.is-on');
    expect(body).toContain('var(--app-accent-fill)');
    expect(body).not.toContain('var(--app-accent-deep)');
  });

  it('paints the dark tile from the tile stops rather than the panel', () => {
    const body = ruleFor('.soft-dark');
    expect(body).toContain('var(--tile-top)');
    expect(body).toContain('var(--tile-bottom)');
    expect(body).toContain('var(--tile-ink)');
  });
});

describe('“Increase contrast”, which cannot be done in a media query', () => {
  it('raises the hairlines and the dimmed text', () => {
    // The tokens are written as inline styles on the root element, so a
    // `:root` rule inside `@media (prefers-contrast: more)` would be
    // overridden by the value this function produced. It has to happen here.
    for (const g of GROUNDS) {
      const look = readLook({ ground: g.id } as Parameters<typeof readLook>[0]);
      const plain = tokensFor(look);
      const loud = tokensFor(look, true);
      for (const token of ['--app-dim', '--app-faint', '--app-line', '--app-line-soft', '--app-track']) {
        expect(alphaOf(loud[token]), `${g.id} ${token}`).toBeGreaterThan(alphaOf(plain[token]));
      }
      // Written as a bare number rather than as a colour, so it is read
      // rather than parsed for an alpha. See `lib/dim.ts` on why the one
      // dimming that stays an opacity is still a token.
      expect(Number(loud['--app-row-dim']), `${g.id} --app-row-dim`).toBeGreaterThan(
        Number(plain['--app-row-dim']),
      );
    }
  });

  it('changes nothing else', () => {
    // Not a different theme — the same theme, readable. A ground that changed
    // colour under this setting would be a second design to maintain.
    const base = readLook(undefined);
    const plain = tokensFor(base);
    const loud = tokensFor(base, true);
    const moved = new Set([
      '--app-dim',
      '--app-faint',
      '--app-line',
      '--app-line-top',
      '--app-line-soft',
      '--app-track',
      '--app-row-dim',
    ]);
    for (const [name, value] of Object.entries(plain)) {
      if (moved.has(name)) continue;
      expect(loud[name], name).toBe(value);
    }
  });
});

/** The alpha out of an `rgba(...)`, for the comparison above. */
function alphaOf(token: string): number {
  const m = /rgba?\([^)]*?,\s*([0-9.]+)\s*\)$/.exec(token.trim());
  return m ? Number(m[1]) : 1;
}

/*
 * The one colour in a silver interface, held to the bar on every ground.
 *
 * `--app-warn` marks a deadline that has gone by. It was the last fixed hex
 * in the palette — one mid-tone worn unchanged by all thirteen grounds while
 * every other token is derived per ground — and measured against each
 * ground's own surfaces it was the least legible ink in the app, in the place
 * that most needed reading. It is body text: `Rework` colours a whole line of
 * prose with it, `Walks` a tight office hour.
 *
 *   fog 2.09 · bone 2.53 · paper 2.57 · parchment 2.63 · industry 2.70
 *   industry-dark 3.01 · graphite 3.53
 *
 * Two of those are *dark* grounds, which is why the fix derives rather than
 * swapping one fixed hex for two: a single darker value would have fixed the
 * daylight case and left Graphite and Industry Dark exactly as they were.
 *
 * Held here rather than trusted, so a ground added later cannot quietly do
 * this again — the failure names the ground and the ratio.
 */
describe('the warning colour, on every ground', () => {
  it('is legible as body text wherever it is read', () => {
    const failures: string[] = [];
    for (const g of GROUNDS) {
      const warn = warnFor(g);
      for (const surface of g.ramp) {
        const c = contrast(warn, surface);
        if (c === null) { failures.push(`${g.id}: ${warn} on ${surface} unreadable`); continue; }
        if (c < 4.5) failures.push(`${g.id}: ${warn} on ${surface} is ${c.toFixed(2)}:1`);
      }
    }
    expect(failures, 'WCAG asks 4.5:1 of body text').toEqual([]);
  });

  it('still looks like the colour it was', () => {
    // Guards the above: black on every light ground and white on every dark
    // one would pass the ratio and lose the one colour the app has.
    for (const g of GROUNDS) {
      const warn = warnFor(g);
      const [r, gr, b] = [1, 3, 5].map((i) => parseInt(warn.slice(i, i + 2), 16));
      expect(r, `${g.id}: the warm end should lead`).toBeGreaterThan(gr);
      expect(gr, `${g.id}: still a warm orange-red, not a pure red`).toBeGreaterThan(b);
    }
  });
});

/*
 * The map's attribution link was told apart from the words beside it by
 * colour alone.
 *
 * The link is `--app-dim`, the text either side `--app-faint` — two fades of
 * the same ink, measuring about 1.96:1 against each other. WCAG 1.4.1 asks
 * for 3:1 or a second visual signal, and lifting the colour far enough would
 * make the credit louder than the map it credits. So it is underlined.
 *
 * The `!important` is load-bearing, not a shortcut: `leaflet.css` is imported
 * by the map component and lands after `app.css`, and its own
 * `.leaflet-control-attribution a` rule sets `text-decoration: none` at
 * identical specificity. Without it the underline is applied and then quietly
 * taken away again.
 */
describe('the map credit, which is the licence', () => {
  const css = () => readFileSync('src/styles/app.css', 'utf8');
  const rule = () => {
    const src = css();
    const at = src.indexOf('.leaflet-control-attribution a {');
    expect(at, 'the attribution link rule has moved').toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('}', at));
  };

  it('carries a second signal, since the colour is not one', () => {
    expect(rule()).toMatch(/text-decoration:\s*underline/);
  });

  it('keeps the underline against leaflet’s own rule', () => {
    // Same specificity, loaded later — so this has to win explicitly.
    expect(rule()).toMatch(/text-decoration:\s*underline\s*!important/);
  });
});
