import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  SHELLS,
  CORNERS,
  DENSITIES,
  GROUNDS,
  SIZES,
  TYPEFACES,
  accent,
  cornersOf,
  MATCH_GROUND,
  resolveCorners,
  densityOf,
  fade,
  ground,
  lookLine,
  readLook,
  scaleOf,
  tokensFor,
  typefaceOf,
} from './look';

/** WCAG relative luminance, for the one thing a theme must not get wrong. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('accent', () => {
  it('falls back to sterling for nothing and for nonsense', () => {
    expect(accent(undefined).id).toBe('sterling');
    expect(accent('chartreuse').id).toBe('sterling');
  });

  it('keeps every accent desaturated — a saturated one turns this into a dashboard', () => {
    for (const a of ACCENTS) {
      const hex = a.base.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      expect(spread, a.label).toBeLessThan(90);
    }
  });

  it('gives every accent a shade readable as text on the light ground', () => {
    // Section labels and kickers are set in --app-accent-deep. A pale metal at
    // 12px on parchment is a heading nobody can read, which is the failure a
    // light theme ships with when it is built by swapping the background.
    const paper = '#f4f1ea';
    for (const a of ACCENTS) {
      expect(contrast(a.shade, paper), `${a.label} shade`).toBeGreaterThan(4.5);
    }
  });

  it('has no two accents sharing an id', () => {
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
  });
});

describe('scaleOf', () => {
  it('is one unless a size was chosen', () => {
    expect(scaleOf(undefined)).toBe(1);
    expect(scaleOf('nonsense')).toBe(1);
    expect(scaleOf('large')).toBeGreaterThan(1);
    expect(scaleOf('compact')).toBeLessThan(1);
  });

  it('rises monotonically through the list, so the order on screen is the order of size', () => {
    const scales = SIZES.map((s) => s.scale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
  });
});

describe('fade', () => {
  it('turns a hex and an alpha into rgba', () => {
    expect(fade('#eceef2', 0.5)).toBe('rgba(236, 238, 242, 0.5)');
  });

  it('understands the short form', () => {
    expect(fade('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('tokensFor', () => {
  it('defines the same tokens for every ground — a half-defined ground is the bug nobody can reproduce', () => {
    const keys = Object.keys(tokensFor({})).sort();
    for (const g of GROUNDS) {
      expect(Object.keys(tokensFor({ ground: g.id })).sort(), g.label).toEqual(keys);
    }
  });

  it('never leaves a token empty or undefined', () => {
    for (const g of GROUNDS) {
      for (const [name, value] of Object.entries(tokensFor({ ground: g.id }))) {
        expect(value, `${g.label} ${name}`).toBeTruthy();
        expect(value, `${g.label} ${name}`).not.toContain('undefined');
      }
    }
  });

  it('inverts the ink on a light ground rather than leaving invisible hairlines', () => {
    const dark = tokensFor({ ground: 'ink' });
    const light = tokensFor({ ground: 'parchment' });
    expect(dark['--app-line']).toContain('236, 238, 242');
    expect(light['--app-line']).toContain('17, 17, 17');
  });

  it('inverts the brushed-metal sweep too, which would otherwise vanish on light', () => {
    expect(tokensFor({ ground: 'parchment' })['--chrome']).toContain('rgba(0,0,0');
    expect(tokensFor({ ground: 'ink' })['--chrome']).toContain('#f7f8fa');
  });

  it('carries the accent through, and darkens it on a light ground', () => {
    expect(tokensFor({ accent: 'brass' })['--app-accent']).toBe('#d8c79a');
    expect(tokensFor({ accent: 'brass', ground: 'parchment' })['--app-accent']).toBe('#6b5c34');
  });

  it('darkens the fill on a light ground too, because a fill still has to be seen', () => {
    // This test used to assert the opposite, under the name "a fill is not
    // read". A fill is not read and it does still have to be visible: on
    // Parchment the pale metals came out at 1.26:1 against the surface behind
    // them, which is a progress meter you cannot find. Caught by
    // `lib/contrast.test.ts`, which checks all hundred combinations.
    for (const g of GROUNDS) {
      const fill = tokensFor({ accent: 'jade', ground: g.id })['--app-accent-fill'];
      expect(fill).toBe(g.light ? '#3d5f52' : '#a8ccbd');
    }
  });

  it('reads text against its own ground at better than 4.5:1, on every ground', () => {
    for (const g of GROUNDS) {
      const t = tokensFor({ ground: g.id });
      expect(contrast(t['--app-fg'], t['--app-bg']), g.label).toBeGreaterThan(4.5);
      expect(contrast(t['--app-accent-deep'], t['--app-bg']), `${g.label} labels`).toBeGreaterThan(
        3,
      );
    }
  });

  it('writes the corners as px, square included', () => {
    expect(tokensFor({ corners: 'square' })['--r-lg']).toBe('0px');
    expect(tokensFor({ corners: 'round' })['--r-lg']).toBe('28px');
  });

  it('carries the chosen heading face and its weight', () => {
    const t = tokensFor({ typeface: 'mono' });
    expect(t['--font-heading']).toContain('monospace');
    expect(t['--font-heading-weight']).toBeTruthy();
  });
});

describe('the option lists', () => {
  it('ends every typeface stack in something the device certainly has', () => {
    for (const t of TYPEFACES) {
      expect(t.heading, t.label).toMatch(/(sans-serif|serif|monospace)$/);
    }
  });

  it('falls back rather than throwing on any id it does not know', () => {
    expect(ground('nope').id).toBe(GROUNDS[0].id);
    expect(typefaceOf('nope').id).toBe(TYPEFACES[0].id);
    expect(densityOf('nope')).toBe(1);
    expect(cornersOf('nope')).toEqual(CORNERS[0].radii);
  });

  it('makes every density a real reduction, never an increase', () => {
    for (const d of DENSITIES) expect(d.scale).toBeLessThanOrEqual(1);
  });
});

describe('readLook', () => {
  it('fills in a look that was never saved', () => {
    const look = readLook(undefined);
    expect(look.ground).toBe('ink');
    // Not 'drawn'. A saved 'drawn' and a never-set corner setting have to stay
    // distinguishable, or a ground can never suggest its own shape — and
    // 'auto' on Ink renders as drawn anyway, so nothing moves for anyone.
    expect(look.corners).toBe(MATCH_GROUND);
    expect(resolveCorners(look.corners, look.ground)).toBe('drawn');
  });

  it('drops a value from a future version rather than writing it through', () => {
    const look = readLook({ ground: 'hologram', typeface: 'runic' });
    expect(look.ground).toBe('ink');
    expect(look.typeface).toBe('condensed');
  });

  it('keeps what it recognises', () => {
    expect(readLook({ accent: 'jade', ground: 'parchment' }).accent).toBe('jade');
  });
});

describe('a ground with an opinion about its corners', () => {
  it('is followed only by somebody who never picked one', () => {
    expect(resolveCorners(MATCH_GROUND, 'industry')).toBe('square');
    expect(resolveCorners(MATCH_GROUND, 'industry-dark')).toBe('square');
    // The whole point of the field: a chosen style survives the ground.
    expect(resolveCorners('round', 'industry')).toBe('round');
    expect(resolveCorners('drawn', 'industry')).toBe('drawn');
  });

  it('is drawn everywhere else, which is what it has always been', () => {
    for (const g of GROUNDS.filter((x) => !x.id.startsWith('industry'))) {
      expect(resolveCorners(MATCH_GROUND, g.id), g.id).toBe('drawn');
    }
  });

  it('reaches the radii, not just the setting', () => {
    expect(tokensFor({ ground: 'industry' })['--r-lg']).toBe('0px');
    expect(tokensFor({ ground: 'industry', corners: 'round' })['--r-lg']).toBe('28px');
    expect(tokensFor({ ground: 'parchment' })['--r-lg']).toBe('10px');
  });

  it('falls back to drawn for a ground that does not exist', () => {
    expect(resolveCorners(MATCH_GROUND, 'hologram')).toBe('drawn');
    expect(resolveCorners(MATCH_GROUND, undefined)).toBe('drawn');
  });
});

describe('lookLine', () => {
  it('names the accent and the ground', () => {
    expect(lookLine({ accent: 'brass', ground: 'parchment' })).toBe('Brass · Parchment');
  });

  it('mentions a typeface or corner only when it is not the default', () => {
    expect(lookLine({ typeface: 'condensed', corners: 'drawn' })).not.toContain('Drawn');
    // And it says what is on screen, not what is stored: Industry resolves to
    // square, so the settings row has to say Square.
    expect(lookLine({ ground: 'industry', corners: MATCH_GROUND })).toContain('Square');
    expect(lookLine({ typeface: 'mono', corners: 'round' })).toContain('Mono');
    expect(lookLine({ typeface: 'mono', corners: 'round' })).toContain('Round');
  });
});

describe('the three layouts', () => {
  it('defaults to drawn, so nobody’s app changes until they choose', () => {
    expect(readLook(undefined).shell).toBe('plain');
    expect(readLook({}).shell).toBe('plain');
  });

  it('keeps a choice it recognises', () => {
    expect(readLook({ shell: 'grouped' }).shell).toBe('grouped');
  });

  it('falls back rather than rendering something that does not exist', () => {
    expect(readLook({ shell: 'nonsense' }).shell).toBe('plain');
  });

  it('offers exactly three, each with a name and a reason', () => {
    // Asserted rather than counted, so a shell added by accident fails here
    // rather than appearing in the picker. Soft is the third.
    expect(SHELLS.map((s) => s.id)).toEqual(['plain', 'grouped', 'soft']);
    for (const s of SHELLS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.blurb.length).toBeGreaterThan(20);
      expect(s.blurb).not.toContain('!');
    }
  });
});
