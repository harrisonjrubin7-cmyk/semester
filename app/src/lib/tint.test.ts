import { describe, expect, it } from 'vitest';
import {
  ACCENT_TINT,
  anchorHue,
  hueOf,
  tintAt,
  tintChoices,
  tintsFor,
} from './tint';
import { AA_LARGE, AA_TEXT, contrast, over } from './contrast';
import { ACCENTS, GROUNDS } from './look';

describe('reading a hue off a colour', () => {
  it('finds the primaries where they are', () => {
    expect(hueOf('#ff0000')).toBeCloseTo(0, 1);
    expect(hueOf('#00ff00')).toBeCloseTo(120, 1);
    expect(hueOf('#0000ff')).toBeCloseTo(240, 1);
  });

  it('answers 0 for grey and for anything that is not a colour', () => {
    // Grey has no hue at all. 0 rather than null because this only ever feeds
    // an anchor, and an anchor of red is a palette rather than a crash.
    expect(hueOf('#808080')).toBe(0);
    expect(hueOf('not a colour')).toBe(0);
  });

  it('leans the way each accent leans', () => {
    // The point of anchoring: Brass is warm and Jade is green, and the course
    // palette has to start from where the reader's own accent is.
    expect(anchorHue('brass', -1)).toBeGreaterThan(30);
    expect(anchorHue('brass', -1)).toBeLessThan(60);
    expect(anchorHue('jade', -1)).toBeGreaterThan(120);
    expect(anchorHue('jade', -1)).toBeLessThan(180);
  });

  it('takes a dragged hue over the named accent', () => {
    expect(anchorHue('brass', 300)).toBe(300);
    // -1 is "none dragged", which is not a hue of 0.
    expect(anchorHue('jade', -1)).not.toBe(0);
  });
});

describe('dividing the wheel between the courses', () => {
  it('gives one course the accent itself', () => {
    const one = tintsFor(['econ'], { accent: 'jade', light: false });
    expect(one.econ.hue).toBeCloseTo(anchorHue('jade', -1), 5);
  });

  it('puts two courses opposite each other', () => {
    const two = tintsFor(['bus', 'econ'], { accent: 'jade', light: false });
    const apart = Math.abs(two.bus.hue - two.econ.hue);
    expect(Math.min(apart, 360 - apart)).toBeCloseTo(180, 5);
  });

  it('never gives two courses the same hue', () => {
    for (let n = 1; n <= 12; n += 1) {
      const ids = Array.from({ length: n }, (_, i) => `c${i}`);
      const tints = tintsFor(ids, { accent: 'sterling', light: false });
      expect(new Set(ids.map((id) => tints[id].hue)).size).toBe(n);
    }
  });

  it('separates them as far as the count allows', () => {
    // Five courses is 72° apart, which is what makes them tellable at a glance
    // on a week grid where a block is forty pixels wide.
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const hues = ids.map((id) => tintsFor(ids, { light: false })[id].hue).sort((x, y) => x - y);
    const gaps = hues.map((h, i) => (i === 0 ? h + 360 - hues[hues.length - 1] : h - hues[i - 1]));
    for (const gap of gaps) expect(gap).toBeCloseTo(72, 5);
  });

  it('does not move a course when the list is reordered', () => {
    // The failure this prevents: dragging a course up the list repaints the
    // semester, because a gesture about order was reused as a gesture about
    // colour. See the note in `tint.ts`.
    const one = tintsFor(['econ', 'bus', 'core'], { light: false });
    const other = tintsFor(['core', 'econ', 'bus'], { light: false });
    expect(other.econ.hue).toBe(one.econ.hue);
    expect(other.bus.hue).toBe(one.bus.hue);
  });

  it('keeps a pinned hue exactly as it was given', () => {
    const tints = tintsFor(['econ', 'bus'], { light: false, pinned: { econ: 300 } });
    expect(tints.econ.hue).toBe(300);
    // And the others still divide the wheel rather than avoiding the pin.
    expect(tints.bus.hue).not.toBe(300);
  });

  it('ignores a pin that is not a hue', () => {
    const tints = tintsFor(['econ'], { accent: 'jade', light: false, pinned: { econ: -1 } });
    expect(tints.econ.hue).toBeCloseTo(anchorHue('jade', -1), 5);
  });

  it('is the plain accent for every course when the setting is off', () => {
    const tints = tintsFor(['econ', 'bus'], { light: false, on: false });
    expect(tints.econ).toBe(ACCENT_TINT);
    expect(tints.bus).toBe(ACCENT_TINT);
    // Tokens, not colours: off has to be the app exactly as it was.
    expect(ACCENT_TINT.ink).toBe('var(--app-accent)');
  });

  it('holds no course at all', () => {
    expect(tintsFor([], { light: false })).toEqual({});
  });

  it('counts a repeated id once', () => {
    const tints = tintsFor(['econ', 'econ'], { light: false });
    expect(Object.keys(tints)).toEqual(['econ']);
  });
});

// ── Legibility, over every hue and every ground ───────────────────────────
//
// The same arithmetic `contrast.test.ts` runs over the eleven accents, run
// over the whole wheel: a course tint is not chosen from a list, so there is
// no list to check. Five-degree steps across thirteen grounds is 936 tints,
// none of which anybody has looked at.

describe('every tint the app can produce', () => {
  const HUES = Array.from({ length: 72 }, (_, i) => i * 5);

  const failures = (
    needs: number,
    pick: (tint: ReturnType<typeof tintAt>) => string,
    against: (g: (typeof GROUNDS)[number]) => string[],
  ): string[] => {
    const bad: string[] = [];
    for (const g of GROUNDS) {
      for (const hue of HUES) {
        const tint = tintAt(hue, g.light);
        for (const back of against(g)) {
          const ratio = contrast(pick(tint), back) ?? 0;
          if (ratio < needs) bad.push(`${g.label} · ${hue}° · ${ratio.toFixed(2)}:1 against ${back}`);
        }
      }
    }
    return bad;
  };

  it('sets a course code legibly on every surface it is drawn on', () => {
    // A course code is 10px uppercase and tracked out — the smallest text the
    // app sets, so the text bar rather than the large-text one.
    expect(failures(AA_TEXT, (t) => t.ink, (g) => [g.ramp[1], g.ramp[2], g.ramp[3], g.ramp[4]])).toEqual([]);
  });

  it('sets it legibly on its own wash, which is what a chip is', () => {
    const bad: string[] = [];
    for (const g of GROUNDS) {
      for (const hue of HUES) {
        const t = tintAt(hue, g.light);
        for (const surface of [g.ramp[1], g.ramp[2]]) {
          // The wash is translucent, so what decides legibility is the wash
          // composited onto the surface behind it rather than the wash itself.
          const alpha = g.light ? 0.1 : 0.12;
          const back = over(t.fill, surface, alpha) ?? '';
          const ratio = contrast(t.ink, back) ?? 0;
          if (ratio < AA_TEXT) bad.push(`${g.label} · ${hue}° · ${ratio.toFixed(2)}:1 on its own wash`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('leaves a block\u2019s own title legible when the block is washed in it', () => {
    // The hour and week grids fill a class block with its course's wash, so
    // the ground under that block's title is the wash over the panel rather
    // than the panel. Text is text: 4.5:1.
    const bad: string[] = [];
    for (const g of GROUNDS) {
      for (const hue of HUES) {
        const t = tintAt(hue, g.light);
        const back = over(t.fill, g.ramp[2], g.light ? 0.1 : 0.12) ?? '';
        const ratio = contrast(g.fg, back) ?? 0;
        if (ratio < AA_TEXT) bad.push(`${g.label} · ${hue}° · ${ratio.toFixed(2)}:1 for a block's own title`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('draws a mark that can be found without being read', () => {
    // A block's left edge, a dot on the month, the bar under a course card.
    expect(failures(AA_LARGE, (t) => t.fill, (g) => [g.ramp[1], g.ramp[2], g.ramp[3], g.ramp[4]])).toEqual([]);
  });

  it('renders every part as a real colour', () => {
    // A `color-mix()` or an `undefined` would pass every ratio above by being
    // unreadable to the checker rather than by being legible.
    for (const g of GROUNDS) {
      const t = tintAt(200, g.light);
      expect(contrast(t.ink, g.ramp[2])).not.toBeNull();
      expect(contrast(t.fill, g.ramp[2])).not.toBeNull();
      expect(t.wash.startsWith('rgba(')).toBe(true);
      expect(t.edge.startsWith('rgba(')).toBe(true);
    }
  });

  it('turns with the accent rather than ignoring it', () => {
    // The property that keeps the palette the reader's: moving from Sterling
    // to Copper moves every course with it.
    for (const a of ACCENTS) {
      // 'bus' sorts first, so it is the one holding the anchor.
      const tints = tintsFor(['econ', 'bus'], { accent: a.id, light: false });
      expect(tints.bus.hue).toBeCloseTo(anchorHue(a.id, -1), 5);
    }
  });
});

describe('the picker', () => {
  it('offers twelve, starting at the reader’s own accent', () => {
    const choices = tintChoices('brass', -1, false);
    expect(choices).toHaveLength(12);
    expect(choices[0].hue).toBeCloseTo(anchorHue('brass', -1), 5);
    expect(new Set(choices.map((c) => Math.round(c.hue))).size).toBe(12);
  });

  it('draws them for the ground it is asked about', () => {
    const dark = tintChoices('jade', -1, false)[0];
    const light = tintChoices('jade', -1, true)[0];
    expect(dark.ink).not.toBe(light.ink);
  });
});
