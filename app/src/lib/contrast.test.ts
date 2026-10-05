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
import { ACCENTS, CHART_HUES, GROUNDS, chartFor, errorFor, readLook, tokensFor, warnFor } from './look';

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

  it('is a hundred and sixty-eight of them', () => {
    // Twelve accents and fourteen grounds. I had written "six grounds" in the
    // proposal that led to this test and never counted them, which is why the
    // number is asserted rather than described: adding Industry and Industry
    // Dark moved it from 100 to 132, Bone moved it to 143, and the Semester
    // ground with its indigo accent moved it to 168. Each time the
    // arithmetic below is what said so.
    expect(combos).toHaveLength(168);
    expect(GROUNDS.length * ACCENTS.length).toBe(168);
  });

/**
 * The five stops of `--chrome`, as colours this file can measure.
 *
 * On a dark ground they are literal hex. On a light one they are black at
 * five alphas, so each has to be composited over the panel the control sits
 * on before it means anything — which is why they are built here rather than
 * read off the token: `--chrome` is a gradient string, and `contrast` takes
 * colours.
 *
 * Kept beside the checks that use them so the two cannot drift apart: if the
 * gradient in `lib/look.ts` gains or moves a stop, this list is the thing to
 * change, and the checks follow it.
 */
const CHROME_DARK = ['#f7f8fa', '#c9ced8', '#aeb4c0', '#dfe3ea', '#f4f6f9'];
const CHROME_LIGHT_ALPHAS = [0.86, 0.62, 0.58, 0.78, 0.88];

function chromeStops(g: (typeof GROUNDS)[number], panel: string): string[] {
  return g.light
    ? CHROME_LIGHT_ALPHAS.map((a) => over('#000000', panel, a) ?? '')
    : CHROME_DARK;
}

  /** The checks one pairing has to survive. */
  const checksFor = (accentId: string, groundId: string): Check[] => {
    const t = tokensFor({ accent: accentId, ground: groundId });
    const g = GROUNDS.find((x) => x.id === groundId)!;
    const a = ACCENTS.find((x) => x.id === accentId)!;
    const where = `${a.label} on ${g.label}`;

    const panel = t['--app-panel'];
    const bg = t['--app-bg'];
    /** A surface with `--app-accent-wash` painted over it, as the app does. */
    const washed = (surface: string): string =>
      over(g.light ? a.shade : a.base, surface, g.light ? 0.1 : 0.12) ?? surface;

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

      /*
       * The two faded strengths, on every surface rather than on the panel.
       *
       * This was `panel` alone for both, and the panel is not where either is
       * weakest — a fade of the foreground has least to work with on the
       * *darkest* surface a light ground has, which is the void, two steps
       * below the panel. So the check passed on the one surface and the app
       * drew the other.
       *
       * It showed up twice, and both times the palette moved without the
       * check moving. Dim ink on Bone was 4.70:1 on the void against 5.88 on
       * the panel — over its bar, but the panel figure was the one on record
       * and it was half a point flattering; raised in #379. Faint ink was
       * worse: actually under its own 3:1 bar on five grounds — Parchment
       * 2.90, Paper 2.93, Bone 2.88, Fog 2.86 and Industry Dark 2.99 — with
       * every one of them passing here; raised in #391.
       *
       * So the dim rung below is not a failure this caught. It is the same
       * fade on the same surfaces, held at the figure it actually draws
       * rather than the one it sampled best on.
       *
       * Industry Dark is why it walks the whole ramp rather than adding the
       * void to the panel: its ramp inverts, so its weakest surface is the
       * near-white raise at the top, not the void at the bottom. Sampling any
       * one surface is the bug; sampling two is the bug with better odds.
       */
      ...g.ramp.flatMap((surface, i) => [
        {
          what: `${where} · dim text on ramp ${i}`,
          ratio: contrast(over(g.fg, surface, g.dimAlpha) ?? '', surface) ?? 0,
          needs: AA_TEXT,
        },
        {
          what: `${where} · faint text on ramp ${i}`,
          ratio: contrast(over(g.fg, surface, g.faintAlpha) ?? '', surface) ?? 0,
          needs: AA_LARGE,
        },
      ]),

      /*
       * Accent-deep on the two surfaces a journey card paints, not only on
       * the page and the panel.
       *
       * `.journey-reason` is set in `--app-accent-deep`. The card rests on
       * `--app-hero` and, hovered or focused, moves to `--app-raise`. The
       * pairs above measure accent-deep on `--app-bg` and `--app-panel` and so
       * could not see either: the browser sweep found it at 3.96:1 on
       * Industry Dark, hovered, against the 4.5 that every other place this
       * token is used is held to. Measured across all accents, the raise also
       * fails on Graphite. Industry Dark's ramp inverts, so its raise is the
       * lightest step; Graphite's is the step nearest the accent's own value.
       */
      {
        what: `${where} · accent-deep on hero (a journey card at rest)`,
        ratio: contrast(t['--app-accent-deep'], t['--app-hero']) ?? 0,
        needs: AA_TEXT,
      },
      // Accent-deep does not reach 4.5 on the raise on Graphite (4.20 to 4.48)
      // or Industry Dark (3.59 to 3.96), so a hovered or focused card sets its
      // reason in the ground's full-strength ink instead
      // (`.journey-card:hover .journey-reason` in app.css). The ink is what this
      // pins; a hover rule that fell back to accent-deep would be caught by the
      // browser sweep, not here, because it is a stylesheet fact.
      {
        what: `${where} · fg on raise (a journey card's reason, hovered or focused)`,
        ratio: contrast(g.fg, t['--app-raise']) ?? 0,
        needs: AA_TEXT,
      },

      /*
       * The accent read against its own wash.
       *
       * `--app-accent-wash` is the accent itself at a tenth or an eighth
       * (`fade(a.shade, 0.1)` on a light ground, `fade(a.base, 0.12)` on a
       * dark one), and `.device .tag-accent` sets `--app-accent` *on* that
       * wash — so the text and the surface behind it are drawn from one
       * colour, and whether that is readable is the wash's alpha arguing with
       * the accent's own contrast.
       *
       * The eight above measure the accent against the panel and the ground.
       * They cannot see this one: the washed surface is composited at paint
       * time and is not a token, so a token-against-token audit passes it
       * while a browser draws 4.14:1. Found by measuring what Chromium
       * actually painted, on grounds this test had covered for months.
       */
      {
        what: `${where} · accent-deep on the accent wash over panel`,
        ratio: contrast(t['--app-accent-deep'], washed(panel)) ?? 0,
        needs: AA_TEXT,
      },
      {
        what: `${where} · a tag's accent text on the accent wash over panel`,
        ratio: contrast(t['--app-accent'], washed(panel)) ?? 0,
        needs: AA_TEXT,
      },
      {
        what: `${where} · a tag's accent text on the accent wash over the ground`,
        ratio: contrast(t['--app-accent'], washed(bg)) ?? 0,
        needs: AA_TEXT,
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

      /*
       * `--chrome-ink` against the gradient it is named for, at every stop.
       *
       * This file already checks a gradient at both ends — the tile's value,
       * two checks down — and `--chrome` was the one that never got it,
       * although `lib/look.ts` says plainly what the token is for: "text
       * sitting ON the brushed metal — the primary button, an active chip."
       * The pairing below tests that ink against `--app-accent-fill`, which
       * is the pill and the bar, not the button.
       *
       * The stop at 52% is the glint, the lightest band of the sweep, and on
       * the five light grounds it met the label at 3.72 to 4.17. The primary
       * button is 14px at weight 600 — not large text under any reading of
       * the rule — so 4.5 is the bar and the band missed it. The
       * `text-shadow` on `.btn-primary` was doing work the colours were not.
       *
       * Every stop rather than the ends, because on the light branch the
       * lightest stop is in the middle: checking the ends would have passed
       * at .86 and .88 and never looked at the .58 between them.
       */
      ...chromeStops(g, panel).map((stop, i) => ({
        what: `${where} · chrome-ink on chrome stop ${i + 1}`,
        ratio: contrast(t['--chrome-ink'], stop) ?? 0,
        needs: AA_TEXT,
      })),
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
 * A shadow is a surface, and on a light ground it is a surface over text.
 *
 * Every ratio above is a colour against a *token*. `--glow` is not a colour
 * and names no surface, so nothing here could have caught what it did: its
 * third layer is a 34px blur of half-black under the primary button, which on
 * a dark ground is black on near-black and on a light one is a grey wash
 * reaching about forty-eight pixels down, over whatever text comes next.
 *
 * `scripts/paint.mjs` found it, because it samples the screenshot rather than
 * compositing the style tree. On Fog, `#/pathway`'s "Where you stand" measured
 * 3.72:1 and `#/sources`' "Nothing yet" 4.27:1, both needing 4.5 — and both
 * are `--app-accent-deep`, which this file holds to 4.5:1 and which passes,
 * because it was measured against `--app-bg` and the text was not sitting on
 * `--app-bg`.
 *
 * That is `CLAUDE.md`'s warning arriving from a direction it does not list.
 * It says to measure a fade against every surface a ground has rather than
 * the one that flatters it; this was a fade measured against a surface that
 * is not in the ramp at all, because a shadow is not in the ramp.
 *
 * What is pinned here is the property that makes the fix a fix rather than a
 * number somebody nudged: the cast half is the ground's, the way
 * `--shadow-soft-out` beside it already was. A regression would be somebody
 * writing one shadow for thirteen grounds again, and it would look reasonable
 * in the diff.
 */
describe('the primary button\'s glow', () => {
  /** The three layers, as `[inset-ring, contact, cast]`. */
  const layers = (glow: string): string[] => glow.split(/,(?![^(]*\))/).map((l) => l.trim());

  it('is a different shadow on a light ground and a dark one', () => {
    const light = GROUNDS.filter((g) => g.light);
    const dark = GROUNDS.filter((g) => !g.light);
    expect(light.length, 'no light grounds to check').toBeGreaterThan(0);
    expect(dark.length, 'no dark grounds to check').toBeGreaterThan(0);

    const onLight = new Set(light.map((g) => tokensFor({ ground: g.id })['--glow']));
    const onDark = new Set(dark.map((g) => tokensFor({ ground: g.id })['--glow']));
    for (const l of onLight) expect(onDark.has(l), 'a light ground wears the dark glow').toBe(false);
  });

  /*
   * And the layer that does it is the one that reaches.
   *
   * The ring and the contact shadow are the button's own edge — 1px and a 6px
   * blur — and neither gets past it. The cast half is the only one that lands
   * on the next paragraph, so it is the only one this can be about; pinning
   * the whole string would fail on any restyle and teach the next person to
   * update the number without reading why it is there.
   */
  it('casts a light ground\'s shadow at an alpha that does not print on the text below', () => {
    for (const g of GROUNDS.filter((x) => x.light)) {
      const cast = layers(tokensFor({ ground: g.id })['--glow']).at(-1)!;
      const alpha = Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(cast)?.[1] ?? '1');
      expect(alpha, `${g.id}: the cast half is ${cast}`).toBeLessThanOrEqual(0.16);
    }
  });

  it('leaves every dark ground exactly as it was', () => {
    // The measurement that prompted this found nothing on Ink, so nothing on a
    // dark ground had any reason to move. Written out, because "I only changed
    // the light branch" is the kind of claim a ternary makes easy to get wrong.
    const was =
      '0 0 0 1px rgba(212, 217, 226, 0.2), 0 2px 6px rgba(0, 0, 0, 0.5), 0 14px 34px rgba(0, 0, 0, 0.45)';
    for (const g of GROUNDS.filter((x) => !x.light)) {
      expect(tokensFor({ ground: g.id })['--glow'], g.id).toBe(was);
    }
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

  /*
   * The same call, for the rest of the text that was making it.
   *
   * `.soft-caps-quiet` above was found by an audit over the tokens. These four
   * were found by measuring what a browser actually painted, across all seven
   * navigations and a light ground as well as a dark one — which is why they
   * outlived the token audit: every one of them is text whose ground only
   * exists once the app is running.
   *
   * Ratios at `--app-faint`, worst of the two grounds measured:
   *   the foot line under the search home   2.90:1
   *   a tab that is not the current one     2.98:1
   *   both placeholders                     3.03:1
   */
  it('sets the foot line and both placeholders in dim, not faint', () => {
    for (const selector of ['.deskhome-foot', '.device .input::placeholder', '.desktop-input::placeholder']) {
      expect(ruleFor(selector), selector).toContain('var(--app-dim)');
      expect(ruleFor(selector), selector).not.toContain('var(--app-faint)');
    }
  });

  /*
   * The front door's search placeholder, which was invisible.
   *
   * `.deskhome-field` inverts, and this line named `--app-dim` — `--app-fg`
   * faded — on a surface that *is* `--app-fg`. 0.00:1 on all thirteen. Both
   * halves are asserted: that the rule no longer reaches for the page's dim,
   * and that what it reaches for instead is readable on every ground, since
   * the first without the second would pass for any colour at all.
   */
  it('dims the search placeholder against the field, not against the page', () => {
    expect(ruleFor('.deskhome-box-say')).not.toContain('var(--app-dim)');
    expect(ruleFor('.deskhome-box-say')).toContain('var(--app-void)');
    const bad: Check[] = [];
    for (const g of GROUNDS) {
      const t = tokensFor({ ground: g.id });
      const field = t['--app-fg'];
      bad.push({
        what: `${g.label} · the search placeholder on the inverted field`,
        ratio: contrast(over(t['--app-void'], field, 0.7) ?? '', field) ?? 0,
        needs: AA_TEXT,
      });
    }
    expect(bad.filter((c) => !passes(c)).map(failLine)).toEqual([]);
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
      // Not a dimming that gets stronger like the rest of this list — the
      // assistant's button stops fading altogether. It is the one token here
      // whose job under this setting is to switch a rendering off rather than
      // to raise it. See `lib/look.ts` where it is written.
      '--app-passing',
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

const hueOf = (hex: string): number => {
  const [r, g, b] = (rgbOf(hex) ?? [0, 0, 0]).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: string, b: string) => {
  const d = Math.abs(hueOf(a) - hueOf(b));
  return Math.min(d, 360 - d);
};
const rgbDistance = (a: string, b: string) => {
  const [x, y] = [rgbOf(a)!, rgbOf(b)!];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// DD-006. The error ink was the warning ink, so "possible conflict" and "this
// failed" were one colour. It is a rung above now, and every property that
// makes it one is held here, on every ground and every surface the ground has.
describe('the error colour, on every ground', () => {
  it('is legible as body text on every surface, and higher than the warning is asked to be', () => {
    const failures: string[] = [];
    for (const g of GROUNDS) {
      const err = errorFor(g);
      for (const surface of g.ramp) {
        const c = contrast(err, surface);
        if (c === null || c < 6) failures.push(`${g.id}: ${err} on ${surface} is ${c?.toFixed(2)}:1`);
      }
    }
    expect(failures, 'the error rung is held to 6:1, the warning to 4.5:1').toEqual([]);
  });

  it('is never the warning colour, and is redder than it', () => {
    for (const g of GROUNDS) {
      expect(errorFor(g), g.id).not.toBe(warnFor(g));
      // Hue 350 against 14: the error sits on the crimson side of the warning.
      const e = hueOf(errorFor(g));
      const w = hueOf(warnFor(g));
      const eErr = e > 180 ? e - 360 : e;
      expect(eErr, `${g.id}: error ${errorFor(g)} should lead warn ${warnFor(g)} into red`).toBeLessThan(w);
      expect(hueGap(errorFor(g), warnFor(g)), `${g.id}: too near the warning to be a rung`).toBeGreaterThanOrEqual(12);
    }
  });

  it('is what the shared status components draw a danger tone with', () => {
    // A review found `unity.css` grouped `[data-tone='danger']` with attention,
    // so the token above existed and nothing drew it. Any rule that selects the
    // danger tone or the error panel must reach for a danger token, never the
    // attention one.
    const css = readFileSync(join(__dirname, '../styles/unity.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
    const danger = rules.filter((r) => /data-tone='danger'|\.state-error\b|data-state='failed'/.test(r.sel));
    // Layout-only rules (`.state-error` shares one with its siblings) set no
    // status colour and are not the point; a rule that does must use danger's.
    const painting = danger.filter((r) => /--status-/.test(r.body));
    expect(painting.length, 'the danger rules that set a colour are there to be checked').toBeGreaterThanOrEqual(3);
    for (const r of painting) {
      expect(r.body, r.sel).not.toMatch(/--status-attention/);
      expect(r.body, r.sel).toMatch(/--status-danger/);
    }
    // And the pair that stayed attention did not lose it.
    const offline = rules.find((r) => r.sel === '.state-offline' && /status-attention/.test(r.body));
    expect(offline, '.state-offline stays on the attention rung').toBeTruthy();
  });

  it('is what the danger status paints with', () => {
    const tokens = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--status-danger:\s*var\(--app-error\)/);
    expect(tokens).toMatch(/--status-attention:\s*var\(--app-warn\)/);
    const t = tokensFor({}, false);
    expect(t['--app-error']).toBe(errorFor(GROUNDS[0]));
    expect(t['--app-error']).not.toBe(t['--app-warn']);
  });
});

// The chart series. A bar or a line is a graphic, so the bar is WCAG 1.4.11's
// 3:1 (not 4.5:1), but it is measured the way CLAUDE.md asks the faint rung to
// be: against every surface the ground has, not the one that flatters it.
describe('the chart series, on every ground', () => {
  it('has five, and the stylesheet root carries all five', () => {
    expect(CHART_HUES).toHaveLength(5);
    for (const g of GROUNDS) {
      const series = chartFor(g);
      expect(series, g.id).toHaveLength(5);
      const t = tokensFor({ ground: g.id }, false);
      series.forEach((hex, i) => expect(t[`--chart-${i + 1}`], `${g.id} --chart-${i + 1}`).toBe(hex));
    }
  });

  it('clears 3:1 on every surface of every ground', () => {
    const failures: string[] = [];
    for (const g of GROUNDS) {
      chartFor(g).forEach((hex, i) => {
        for (const surface of g.ramp) {
          const c = contrast(hex, surface);
          if (c === null || c < 3) failures.push(`${g.id}: series ${i + 1} ${hex} on ${surface} is ${c?.toFixed(2)}:1`);
        }
      });
    }
    expect(failures, 'WCAG 1.4.11 asks 3:1 of a graphical object').toEqual([]);
  });

  it('keeps the five apart from each other, and from the error colour', () => {
    const failures: string[] = [];
    for (const g of GROUNDS) {
      const series = chartFor(g);
      for (let i = 0; i < series.length; i += 1) {
        for (let j = i + 1; j < series.length; j += 1) {
          if (rgbDistance(series[i], series[j]) < 60) failures.push(`${g.id}: series ${i + 1} and ${j + 1} are ${rgbDistance(series[i], series[j]).toFixed(0)} apart`);
        }
        // Red is the error's. A series in it would read as a failure.
        if (hueGap(series[i], errorFor(g)) < 40) failures.push(`${g.id}: series ${i + 1} ${series[i]} reads as the error ${errorFor(g)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives neighbouring series different luminance, for the reader who cannot tell the hues apart', () => {
    const failures: string[] = [];
    for (const g of GROUNDS) {
      const series = chartFor(g);
      for (let i = 0; i + 1 < series.length; i += 1) {
        const c = contrast(series[i], series[i + 1]);
        if (c === null || c < 1.12) failures.push(`${g.id}: series ${i + 1} and ${i + 2} differ by ${c?.toFixed(2)}:1 in luminance`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('names the source roles from series, so a chart and its badge agree', () => {
    const css = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');
    const role = (name: string) => new RegExp(`${name}:\\s*var\\((--[a-z0-9-]+)\\)`).exec(css)?.[1];
    expect(role('--chart-verified')).toBe('--chart-2');
    expect(role('--chart-estimated')).toBe('--chart-3');
    expect(role('--chart-stale')).toBe('--app-error');
    expect(role('--chart-student-entered')).toBe('--chart-4');
    // Four roles, four colours, on every ground.
    for (const g of GROUNDS) {
      const s = chartFor(g);
      const four = [s[1], s[2], errorFor(g), s[3]];
      expect(new Set(four).size, g.id).toBe(4);
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

/**
 * A journey card's reason, hovered or focused.
 *
 * `.journey-reason` is accent-deep, which the audit holds to 4.5:1 on the
 * page and the panel. A hovered card moves to `--app-raise`, and there
 * accent-deep fails on Graphite and Industry Dark. The stylesheet answers that
 * by setting the reason in the ground's own ink on hover and focus. That is a
 * fact about `app.css`, not about a token, so this reads the stylesheet: it
 * works out from the palette whether the override is needed, and if it is, the
 * rule has to be there. If the palette is ever fixed so that accent-deep holds
 * on the raise everywhere, the override stops being demanded and can go.
 */
describe('a journey card hovered or focused', () => {
  const failing = GROUNDS.flatMap((g) =>
    ACCENTS.filter((a) => {
      const t = tokensFor({ accent: a.id, ground: g.id });
      return (contrast(t['--app-accent-deep'], t['--app-raise']) ?? 0) < AA_TEXT;
    }).map((a) => `${a.label} on ${g.label}`),
  );
  const css = () => readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names the pairings that need the override, so the list is not a belief', () => {
    expect(failing).toContain('Sterling on Industry Dark');
    expect(failing.some((f) => f.endsWith('on Graphite'))).toBe(true);
    expect(failing.every((f) => /on (Graphite|Industry Dark)$/.test(f))).toBe(true);
  });

  it('sets the reason in full-strength ink when accent-deep does not hold on the raise', () => {
    const src = css();
    const at = src.indexOf('.journey-card:hover .journey-reason');
    expect(failing.length, 'if this is 0 the override is no longer needed').toBeGreaterThan(0);
    expect(at, 'the hover override for .journey-reason is missing from app.css').toBeGreaterThan(-1);
    const rule = src.slice(at, src.indexOf('}', at));
    expect(rule).toContain('.journey-card:focus-visible .journey-reason');
    expect(rule).toMatch(/color:\s*var\(--app-fg\)/);
  });
});
