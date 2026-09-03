import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  CORNERS,
  DENSITIES,
  GROUNDS,
  SIZES,
  TYPEFACES,
  accent,
  cornersOf,
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

  it('keeps the accent bright as a fill on every ground — a fill is not read', () => {
    for (const g of GROUNDS) {
      expect(tokensFor({ accent: 'jade', ground: g.id })['--app-accent-fill']).toBe('#a8ccbd');
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
    expect(look.corners).toBe('drawn');
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

describe('lookLine', () => {
  it('names the accent and the ground', () => {
    expect(lookLine({ accent: 'brass', ground: 'parchment' })).toBe('Brass · Parchment');
  });

  it('mentions a typeface or corner only when it is not the default', () => {
    expect(lookLine({ typeface: 'condensed', corners: 'drawn' })).not.toContain('Drawn');
    expect(lookLine({ typeface: 'mono', corners: 'round' })).toContain('Mono');
    expect(lookLine({ typeface: 'mono', corners: 'round' })).toContain('Round');
  });
});
