import { describe, expect, it } from 'vitest';
import { read } from './calc';
import { readLine, type Frame } from './plot';
import { arrows, asArrows, asContours, contours, levels } from './fields';

/**
 * Both of these are pictures somebody reads quantities off — the spacing of
 * contour lines is the steepness, the length of an arrow is the strength — so
 * a scaling that is quietly wrong is a picture that lies while looking right.
 * That is what is tested here, rather than that something was drawn.
 */

const frame: Frame = { x0: -5, x1: 5, y0: -5, y1: 5 };
const node = (source: string) => {
  const got = read(source);
  if (!got.ok) throw new Error(got.fault);
  return got.node;
};

describe('reading a field off the list', () => {
  it('takes a pair with x or y in it as a field', () => {
    expect(readLine('(y, -x)').kind).toBe('field');
    expect(readLine('(x, y)').kind).toBe('field');
  });

  it('leaves a point a point and a path a path', () => {
    expect(readLine('(2, 3)').kind).toBe('point');
    expect(readLine('(\\cos(t), \\sin(t))').kind).toBe('parametric');
  });

  it('gives t the pair when both letters are in it, since that is what was written', () => {
    expect(readLine('(t x, t)').kind).toBe('parametric');
  });
});

describe('the levels of a contour map', () => {
  it('cuts at round numbers, not at the range divided by eight', () => {
    // 0 to 97 asked for eight lines comes back in tens, not in 12.125s.
    expect(levels(0, 97, 8)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(levels(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it('puts a line at zero whenever the range crosses it', () => {
    expect(levels(-8, 8, 8)).toContain(0);
  });

  it('says nothing about a range that is not one', () => {
    expect(levels(3, 3)).toEqual([]);
    expect(levels(NaN, 4)).toEqual([]);
  });
});

describe('the contour map', () => {
  it('draws a level where the function actually reaches it', () => {
    // Every point of the level-25 line of x² + y² is on the circle of radius 5.
    const at = (x: number, y: number) => x * x + y * y;
    const [only] = contours(at, { x0: -6, x1: 6, y0: -6, y1: 6 }, [25], 80);
    expect(only.paths.length).toBeGreaterThan(20);
    for (const [p] of only.paths) expect(Math.hypot(p.x, p.y)).toBeCloseTo(5, 0.5);
  });

  it('draws the saddle at as many levels as it was cut at', () => {
    const { drawn, cuts } = asContours(node('x^2 - y^2'), {}, frame, 6, 40);
    expect(cuts.length).toBeGreaterThan(3);
    expect(drawn.paths.length).toBeGreaterThan(cuts.length);
    expect(drawn.shades).toHaveLength(drawn.paths.length);
  });

  it('draws the zero level at full strength, and the rest below it', () => {
    const map = contours((x: number, y: number) => x + y, frame, [-4, 0, 4], 30);
    expect(map.find((c) => c.level === 0)?.shade).toBe(1);
    for (const c of map) expect(c.shade).toBeLessThanOrEqual(1);
  });
});

describe('the arrows of a field', () => {
  const turning = asArrows(node('-y'), node('x'), {}, frame, 9);

  it('puts one in the middle of each cell of the grid', () => {
    // One short of the grid: the middle cell of an odd grid is centred on the
    // origin, where a rotation is zero, and a zero vector is left out rather
    // than drawn as a speck with no direction.
    expect(turning.arrows).toHaveLength(9 * 9 - 1);
    expect(arrows(() => ({ dx: 1, dy: 1 }), frame, 9)).toHaveLength(9 * 9);
  });

  it('points them the way the field points', () => {
    // A rotation: every arrow is at right angles to its own radius.
    for (const a of turning.arrows ?? []) {
      const mid = { x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2 };
      const along = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
      const dot = mid.x * along.x + mid.y * along.y;
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
  });

  it('scales the longest to fit its own cell, and never past it', () => {
    const cell = (frame.x1 - frame.x0) / 9;
    for (const a of turning.arrows ?? []) {
      expect(Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y)).toBeLessThan(cell);
    }
  });

  it('draws a strong one longer than a weak one, and says so in the ink', () => {
    const list = turning.arrows ?? [];
    const length = (a: (typeof list)[number]) => Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
    const sorted = [...list].sort((a, b) => a.strength - b.strength);
    expect(length(sorted[0])).toBeLessThan(length(sorted[sorted.length - 1]));
    expect(sorted[sorted.length - 1].strength).toBeCloseTo(1, 6);
  });

  it('gives every arrow two barbs, behind its own tip', () => {
    for (const a of turning.arrows ?? []) {
      expect(a.head).toHaveLength(2);
      const reach = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
      for (const barb of a.head) {
        expect(Math.hypot(barb.x - a.to.x, barb.y - a.to.y)).toBeLessThan(reach);
      }
    }
  });

  it('draws nothing where there is nothing to draw', () => {
    expect(arrows(() => ({ dx: 0, dy: 0 }), frame, 6)).toEqual([]);
    expect(arrows(() => ({ dx: NaN, dy: 1 }), frame, 6)).toEqual([]);
  });

  it('draws a uniform field as a uniform grid', () => {
    const flat = arrows(() => ({ dx: 1, dy: 0 }), frame, 5);
    const lengths = new Set(flat.map((a) => Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y).toFixed(9)));
    expect(lengths.size).toBe(1);
  });
});
