import { describe, expect, it } from 'vitest';
import {
  BADGES,
  BODYFACES,
  FEEDS,
  ICON_SHAPES,
  LABELS,
  LINE_HEIGHTS,
  READING_WIDTHS,
  accentFromHue,
  bodyfaceOf,
  contrast,
  contrastVerdict,
  feedStyleOf,
  hueToHex,
  iconShapeOf,
  lineHeightOf,
  readLook,
  readingWidthOf,
  tokensFor,
} from './look';

/**
 * The controls added after the first look system shipped: a body face separate
 * from the heading face, line height, reading width, icon shape, labels,
 * badges, feed style, and an accent hue with a contrast readout.
 */

describe('a body face chosen separately from the heading', () => {
  it('is a real font stack, not a name', () => {
    // It was fixed in CSS before this, so the typeface picker changed headings
    // only and somebody who found the body text hard to read had nothing to
    // change.
    for (const b of BODYFACES) {
      expect(b.body).toMatch(/,/);
    }
  });

  it('offers the one that exists for this', () => {
    // Atkinson Hyperlegible was designed at the Braille Institute to keep
    // characters apart, and it is the most useful thing this list can offer
    // somebody who is struggling.
    expect(BODYFACES.map((b) => b.id)).toContain('hyperlegible');
    expect(bodyfaceOf('hyperlegible').body).toContain('Atkinson Hyperlegible');
  });

  it('falls back rather than emitting nothing', () => {
    expect(bodyfaceOf('typo').id).toBe(BODYFACES[0].id);
    expect(bodyfaceOf(undefined).body).toBeTruthy();
  });

  it('reaches the page as a token', () => {
    expect(tokensFor({ bodyface: 'serif' })['--font-body']).toContain('Georgia');
  });
});

describe('line height and reading width, which are different complaints', () => {
  it('opens the lines without changing the size', () => {
    // "I cannot see this" and "this is a wall" are two problems, and one
    // slider for both fixes neither properly.
    expect(lineHeightOf('airy')).toBeGreaterThan(lineHeightOf('normal'));
    const airy = tokensFor({ lineHeight: 'airy', textSize: 'normal' });
    const tight = tokensFor({ lineHeight: 'tight', textSize: 'normal' });
    expect(airy['--line-height']).not.toBe(tight['--line-height']);
    expect(airy['--text-scale']).toBe(tight['--text-scale']);
  });

  it('keeps every measure inside the readable range', () => {
    // Past about 75 characters the eye loses the start of the next line on the
    // return sweep. "Full" is the deliberate opt-out.
    for (const w of READING_WIDTHS) {
      if (w.ch === 0) continue;
      expect(w.ch).toBeGreaterThanOrEqual(45);
      expect(w.ch).toBeLessThanOrEqual(85);
    }
  });

  it('says "no cap" as a value a caller can act on', () => {
    expect(readingWidthOf('full')).toBe(0);
    expect(tokensFor({ readingWidth: 'full' })['--reading-width']).toBe('none');
    expect(tokensFor({ readingWidth: 'narrow' })['--reading-width']).toBe('52ch');
  });

  it('defaults to the comfortable measure', () => {
    expect(readingWidthOf(undefined)).toBe(66);
    expect(lineHeightOf(undefined)).toBe(1.55);
  });
});

describe('the smaller switches', () => {
  it('lets the icon have no shape at all', () => {
    expect(iconShapeOf('none').radius).toBeLessThan(0);
    expect(tokensFor({ iconShape: 'none' })['--icon-radius']).toBe('0');
    expect(tokensFor({ iconShape: 'round' })['--icon-radius']).toBe('50%');
  });

  it('has a badge setting that is not just on or off', () => {
    // A badge is a claim on attention. An app that puts one on everything has
    // made them all mean nothing.
    expect(BADGES.map((b) => b.id)).toEqual(['due', 'all', 'none']);
    expect(readLook({}).badges).toBe('due');
  });

  it('keeps tab labels on by default', () => {
    expect(LABELS.map((l) => l.id)).toEqual(['on', 'off']);
    expect(readLook({}).labels).toBe('on');
  });

  it('offers three readings of a day, not three skins', () => {
    expect(FEEDS.map((f) => f.id)).toEqual(['cards', 'rows', 'timeline']);
    expect(feedStyleOf('timeline')).toBe('timeline');
    expect(feedStyleOf('nonsense')).toBe('cards');
  });

  it('gives every choice a blurb, because a label alone does not explain', () => {
    for (const set of [BODYFACES, LINE_HEIGHTS, READING_WIDTHS, ICON_SHAPES, LABELS, BADGES, FEEDS]) {
      for (const opt of set) {
        expect(opt.blurb.length, opt.id).toBeGreaterThan(8);
      }
    }
  });
});

describe('a hue you can drag', () => {
  it('produces a real colour at every angle', () => {
    for (let h = 0; h < 360; h += 15) {
      expect(hueToHex(h, 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('wraps rather than breaking past the ends', () => {
    expect(hueToHex(370, 0.5)).toBe(hueToHex(10, 0.5));
    expect(hueToHex(-10, 0.5)).toBe(hueToHex(350, 0.5));
  });

  it('builds a whole accent, not just the main colour', () => {
    // Section labels are set in `shade`, and a pale metal at 12px on parchment
    // is a heading nobody can read.
    const a = accentFromHue(200, false);
    for (const part of [a.base, a.bright, a.deep, a.shade]) {
      expect(part).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set([a.base, a.bright, a.deep, a.shade]).size).toBe(4);
  });

  it('turns the shade the other way for a light ground', () => {
    expect(accentFromHue(200, true).shade).not.toBe(accentFromHue(200, false).shade);
  });

  it('does not throw away a chosen accent just because the slider was opened', () => {
    // -1 is "none set". 0 would be red.
    expect(readLook({ accent: 'copper' }).hue).toBe(-1);
    expect(readLook({ accent: 'copper', hue: 210 }).hue).toBe(210);
    expect(readLook({ hue: 999 }).hue).toBe(-1);
  });

  it('takes over the accent tokens only when it is set', () => {
    const named = tokensFor({ accent: 'copper' });
    const dragged = tokensFor({ accent: 'copper', hue: 210 });
    expect(dragged['--app-accent']).not.toBe(named['--app-accent']);
    expect(tokensFor({ accent: 'copper', hue: -1 })['--app-accent']).toBe(named['--app-accent']);
  });
});

describe('the contrast check, which is why the slider is safe to offer', () => {
  it('knows the two extremes', () => {
    expect(contrast('#000000', '#ffffff')).toBe(21);
    expect(contrast('#888888', '#888888')).toBe(1);
  });

  it('does not care which way round the colours are given', () => {
    expect(contrast('#123456', '#fefefe')).toBe(contrast('#fefefe', '#123456'));
  });

  it('reads three-digit hex', () => {
    expect(contrast('#000', '#fff')).toBe(21);
  });

  it('says what a number means, in words rather than a standard', () => {
    // A hue picker without a readout is a way to let people make their own app
    // unreadable and then wonder why.
    expect(contrastVerdict(21).ok).toBe(true);
    expect(contrastVerdict(4.6).ok).toBe(true);
    expect(contrastVerdict(3.2).ok).toBe(false);
    expect(contrastVerdict(1.4).label).toBe('Too faint to read');
  });

  it('never uses a standard reference nobody outside the trade knows', () => {
    for (const r of [1, 3, 4.5, 7, 21]) {
      expect(contrastVerdict(r).label).not.toMatch(/WCAG|AA|AAA|:1/);
    }
  });
});
