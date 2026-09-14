import { describe, expect, it } from 'vitest';
import { read } from './calc';
import type { Frame } from './plot';
import {
  EYE,
  MESH,
  PITCH,
  facets,
  floor,
  heightOf,
  heights,
  marks,
  project,
  range,
  turned,
} from './surface';

/**
 * A picture with a camera in it has failures that look like features: a
 * surface drawn inside-out, a peak that is really a pit, a far piece painted
 * over a near one. None of those is visible to somebody checking by eye — they
 * all look like a surface — so each has a test.
 */

const frame: Frame = { x0: -2, x1: 2, y0: -2, y1: 2 };
const of = (source: string) => {
  const got = read(source);
  if (!got.ok) throw new Error(got.fault);
  return heightOf(got.node, {});
};

describe('the heights', () => {
  it('samples the window, corner to corner', () => {
    const zs = heights(of('x + y'), frame, 4);
    expect(zs).toHaveLength(5);
    expect(zs[0][0]).toBeCloseTo(-4, 9);
    expect(zs[4][4]).toBeCloseTo(4, 9);
  });

  it('leaves a hole where the function has no value rather than inventing one', () => {
    const zs = heights(of('\\sqrt{1 - x^2 - y^2}'), frame, 8);
    expect(zs.flat().some((z) => z === null)).toBe(true);
    expect(zs.flat().filter((z) => z !== null).length).toBeGreaterThan(0);
  });

  it('finds the range, and where the extremes are', () => {
    const got = range(heights(of('x^2 + y^2'), frame, 20), frame);
    expect(got.low).toBeCloseTo(0, 6);
    expect(got.high).toBeCloseTo(8, 6);
    expect(got.lowest?.x).toBeCloseTo(0, 6);
    expect(got.lowest?.y).toBeCloseTo(0, 6);
    expect(Math.abs(got.highest?.x ?? 0)).toBeCloseTo(2, 6);
  });

  it('says nothing rather than ±∞ when there is no height anywhere', () => {
    const got = range(heights(of('\\sqrt{-1 - x^2}'), frame, 4), frame);
    expect(got).toMatchObject({ low: 0, high: 0, lowest: null, highest: null });
  });
});

describe('the camera', () => {
  it('puts up on the page up', () => {
    const flat = { yaw: 0, pitch: 0 };
    const low = project({ x: 0, y: 0, z: -1 }, flat);
    const high = project({ x: 0, y: 0, z: 1 }, flat);
    // SVG's y grows downward, so higher is a smaller y.
    expect(high.y).toBeLessThan(low.y);
  });

  it('puts what is further from the eye further away', () => {
    const eye = { yaw: 0, pitch: 0.5 };
    const near = project({ x: 0, y: -1, z: 0 }, eye);
    const far = project({ x: 0, y: 1, z: 0 }, eye);
    expect(far.depth).toBeGreaterThan(near.depth);
  });

  it('turns about the vertical without changing a point on the axis', () => {
    const on = project({ x: 0, y: 0, z: 0.5 }, { yaw: 1.2, pitch: 0.4 });
    const same = project({ x: 0, y: 0, z: 0.5 }, { yaw: -2, pitch: 0.4 });
    expect(on.x).toBeCloseTo(same.x, 9);
    expect(on.y).toBeCloseTo(same.y, 9);
  });

  it('keeps the eye above the floor however far it is dragged', () => {
    expect(turned(EYE, 0, -10).pitch).toBe(PITCH.low);
    expect(turned(EYE, 0, 10).pitch).toBe(PITCH.high);
    expect(turned(EYE, 1, 0).yaw).toBeCloseTo(EYE.yaw + 1, 9);
  });
});

describe('the pieces', () => {
  const zs = heights(of('x^2 - y^2'), frame, 12);
  const { low, high } = range(zs, frame);

  it('makes one piece per square of the mesh', () => {
    expect(facets(zs, frame, low, high, EYE)).toHaveLength(12 * 12);
  });

  it('hands them back furthest first, which is the whole of the hiding', () => {
    const pieces = facets(zs, frame, low, high, EYE);
    for (let i = 1; i < pieces.length; i += 1) {
      expect(pieces[i - 1].depth).toBeGreaterThanOrEqual(pieces[i].depth);
    }
  });

  it('lights a piece by the way it faces, not by where it is', () => {
    const flat = facets(heights(of('0 x + 0 y'), frame, 4), frame, 0, 1, EYE);
    const lights = new Set(flat.map((f) => f.light.toFixed(6)));
    expect(lights.size).toBe(1);
    const slope = facets(heights(of('x^2 - y^2'), frame, 8), frame, low, high, EYE);
    expect(new Set(slope.map((f) => f.light.toFixed(3))).size).toBeGreaterThan(1);
    for (const f of [...flat, ...slope]) {
      expect(f.light).toBeGreaterThanOrEqual(0.3);
      expect(f.light).toBeLessThanOrEqual(1);
    }
  });

  it('places every piece between the lowest and the highest', () => {
    for (const f of facets(zs, frame, low, high, EYE)) {
      expect(f.height).toBeGreaterThanOrEqual(0);
      expect(f.height).toBeLessThanOrEqual(1);
    }
  });

  it('skips a piece with a corner that has no height', () => {
    const dome = heights(of('\\sqrt{1 - x^2 - y^2}'), frame, 16);
    const bounds = range(dome, frame);
    const pieces = facets(dome, frame, bounds.low, bounds.high, EYE);
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThan(16 * 16);
  });

  it('scales a flat surface and a deep one to the same box', () => {
    const tiny = heights(of('0.001 x'), frame, 6);
    const huge = heights(of('10000 x'), frame, 6);
    const small = range(tiny, frame);
    const big = range(huge, frame);
    const a = facets(tiny, frame, small.low, small.high, EYE);
    const b = facets(huge, frame, big.low, big.high, EYE);
    const spread = (fs: typeof a) => {
      const ys = fs.flatMap((f) => f.corners.map((c) => c.y));
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread(a)).toBeCloseTo(spread(b), 6);
  });
});

describe('the box round it', () => {
  it('draws the floor and the one upright that says how tall it is', () => {
    const lines = floor(frame, 0, 4, EYE);
    expect(lines).toHaveLength(5);
  });

  it('names the three directions', () => {
    expect(marks(frame, 0, 4, EYE).map((m) => m.label)).toEqual(['x', 'y', 'z']);
  });

  it('keeps the mesh at a size a phone can draw', () => {
    expect(MESH * MESH).toBeLessThan(2000);
  });
});
