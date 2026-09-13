import { describe, expect, it } from 'vitest';
import { value } from './calc';
import {
  area,
  asFunction,
  contour,
  draw,
  features,
  fitted,
  HOME,
  meet,
  missing,
  nearest,
  neat,
  readLine,
  scopeOf,
  series,
  slopeAt,
  squared,
  step,
  tickText,
  ticks,
  usable,
  zoomed,
  type Frame,
} from './plot';

/**
 * A graph is read, not computed, so the failures that matter are the ones that
 * look like curves: an asymptote joined up into a vertical line, a circle
 * drawn as an ellipse, a zero reported where there is a pole. Each of those
 * has a test here because each of them is invisible to anybody checking by
 * eye — the picture looks like a picture.
 */

const of = (source: string) => readLine(source);

describe('reading a line of the list', () => {
  it('takes a bare expression for a curve in y', () => {
    const line = of('2x + 3');
    expect(line.kind).toBe('curve');
    if (line.kind === 'curve') expect(line.of).toBe('y');
  });

  it('takes y = and x = for the two directions', () => {
    expect(of('y = x^2')).toMatchObject({ kind: 'curve', of: 'y' });
    expect(of('x = 4')).toMatchObject({ kind: 'curve', of: 'x' });
  });

  it('takes a relation with both letters in it', () => {
    expect(of('x^2 + y^2 = 25').kind).toBe('relation');
  });

  it('takes a definition and a parameter apart', () => {
    expect(of('f(x) = x^2 - 4')).toMatchObject({ kind: 'fun', name: 'f', params: ['x'] });
    expect(of('a = 2')).toMatchObject({ kind: 'value', name: 'a' });
  });

  it('takes a point', () => {
    expect(of('(2, 3)').kind).toBe('point');
  });

  it('leaves a sum’s own counter alone rather than reading it as a relation', () => {
    expect(of('\\sum_{i=1}^{4} i').kind).toBe('curve');
  });

  it('says what it cannot draw rather than drawing something else', () => {
    expect(of('y < x').kind).toBe('fault');
    expect(of('x = = 2').kind).toBe('fault');
    expect(of('y = ').kind).toBe('fault');
    expect(of('   ').kind).toBe('blank');
  });

  it('never throws, whatever is typed at it', () => {
    for (const bad of ['(', '=', 'y=)(', '\\frac{', '[1,', 'y = sin(']) {
      expect(() => readLine(bad)).not.toThrow();
    }
  });
});

describe('the scope a list makes', () => {
  it('gathers parameters and definitions', () => {
    const scope = scopeOf([of('a = 3'), of('f(x) = a x')]);
    expect(scope.vars?.a).toBe(3);
    const f = asFunction(of('y = f(2)'), scope);
    expect(f?.(0)).toBe(6);
  });

  it('lets a line use a parameter written below it', () => {
    const scope = scopeOf([of('f(x) = m x'), of('m = 4')]);
    const f = asFunction(of('y = f(3)'), scope);
    expect(f?.(0)).toBe(12);
  });

  it('names what is still unset, and leaves x and y out of it', () => {
    expect(missing(of('y = m x + c'), {})).toEqual(['m', 'c']);
    expect(missing(of('x^2 + y^2 = r^2'), {})).toEqual(['r']);
    expect(missing(of('y = m x'), scopeOf([of('m = 2')]))).toEqual([]);
  });
});

describe('sampling', () => {
  const frame: Frame = { x0: -10, x1: 10, y0: -10, y1: 10 };

  it('draws a straight line as one unbroken path', () => {
    const { paths } = draw(of('y = 2x'), {}, frame);
    expect(paths).toHaveLength(1);
    expect(paths[0][0].y).toBeCloseTo(-20, 6);
  });

  it('breaks a curve at its asymptote rather than joining ±∞', () => {
    const { paths } = draw(of('y = 1/x'), {}, frame);
    expect(paths.length).toBeGreaterThan(1);
    // No path may straddle zero, which is the vertical line this exists to stop.
    for (const path of paths) {
      const signs = new Set(path.map((p) => Math.sign(p.x)));
      expect(signs.size).toBe(1);
    }
  });

  it('leaves a gap where there is no value at all', () => {
    const { paths } = draw(of('y = \\sqrt{x}'), {}, frame);
    for (const path of paths) for (const p of path) expect(p.x).toBeGreaterThanOrEqual(-1e-9);
  });

  it('draws one path per member when a parameter is a list', () => {
    const scope = scopeOf([of('a = [1, 2, 3]')]);
    const { paths } = draw(of('y = a x'), scope, frame);
    expect(paths).toHaveLength(3);
  });

  it('draws x = as a vertical line', () => {
    const { paths } = draw(of('x = 4'), {}, frame);
    expect(paths[0].every((p) => Math.abs(p.x - 4) < 1e-9)).toBe(true);
  });

  it('draws a point, and a list of points', () => {
    expect(draw(of('(2, 3)'), {}, frame).points).toEqual([{ x: 2, y: 3 }]);
    expect(draw(of('([1, 2], [3, 4])'), {}, frame).points).toHaveLength(2);
  });

  it('breaks only on a jump that changes sign, not on a steep climb', () => {
    const paths = series((t) => t ** 3, -10, 10, 100, 20);
    expect(paths).toHaveLength(1);
  });
});

describe('relations', () => {
  const frame: Frame = { x0: -10, x1: 10, y0: -10, y1: 10 };

  it('draws a circle at the radius it was given, all the way round', () => {
    const at = (x: number, y: number) => x * x + y * y - 25;
    const segments = contour(at, frame, 80);
    expect(segments.length).toBeGreaterThan(40);
    for (const [a, b] of segments) {
      for (const p of [a, b]) expect(Math.sqrt(p.x * p.x + p.y * p.y)).toBeCloseTo(5, 0.5);
    }
    // Every quadrant, which a half-drawn circle would fail.
    const quadrants = new Set(segments.map(([p]) => `${Math.sign(p.x)}${Math.sign(p.y)}`));
    expect(quadrants.size).toBeGreaterThanOrEqual(4);
  });

  it('draws the relation the app’s own notation writes', () => {
    const { paths } = draw(of('x^2 + y^2 = 2^2'), {}, frame);
    expect(paths.length).toBeGreaterThan(20);
    for (const [p] of paths) expect(Math.sqrt(p.x * p.x + p.y * p.y)).toBeCloseTo(2, 0.5);
  });
});

describe('the readings', () => {
  const frame: Frame = { x0: -10, x1: 10, y0: -10, y1: 10 };
  const f = (x: number) => x * x - 4;

  it('finds both zeros of a parabola, and its dip', () => {
    const found = features(f, frame);
    const zeros = found.filter((s) => s.kind === 'zero').map((s) => s.x);
    expect(zeros).toHaveLength(2);
    expect(zeros[0]).toBeCloseTo(-2, 6);
    expect(zeros[1]).toBeCloseTo(2, 6);
    const dip = found.find((s) => s.kind === 'dip');
    expect(dip?.x).toBeCloseTo(0, 5);
    expect(dip?.y).toBeCloseTo(-4, 6);
  });

  it('does not call a pole a zero', () => {
    const zeros = features((x) => 1 / x, frame).filter((s) => s.kind === 'zero');
    expect(zeros).toHaveLength(0);
  });

  it('finds where supply meets demand', () => {
    const demand = (x: number) => 20 - 2 * x;
    const supply = (x: number) => 2 + x;
    const met = meet(demand, supply, frame);
    expect(met).toHaveLength(1);
    expect(met[0].x).toBeCloseTo(6, 6);
    expect(met[0].y).toBeCloseTo(8, 6);
  });

  it('integrates what an economics course asks it to', () => {
    expect(area((x) => x * x, 0, 3)).toBeCloseTo(9, 6);
    // Consumer surplus under a linear demand curve, priced at 4: ½ × 8 × 8.
    expect(area((x) => 12 - x - 4, 0, 8)).toBeCloseTo(32, 6);
  });

  it('signs the area under the axis rather than counting it twice', () => {
    expect(area((x) => x, -1, 1)).toBeCloseTo(0, 9);
  });

  it('reads a slope off a curve without being given a derivative', () => {
    expect(slopeAt(f, 3)).toBeCloseTo(6, 4);
    expect(slopeAt(Math.sin, 0)).toBeCloseTo(1, 4);
  });

  it('reports a reading at the precision it was actually measured to', () => {
    expect(neat(-1.44560289665e-20, 20)).toBe(0);
    expect(neat(-9.42477796077, 20)).toBe(-9.42478);
    expect(neat(0.0000015, 20)).toBe(0);
    expect(neat(1234.5678, 2000)).toBe(1234.57);
    expect(neat(NaN, 20)).toBeNaN();
  });

  it('lands a trace on the nearest sample', () => {
    const paths = [[{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }]];
    expect(nearest(paths, { x: 1.9, y: 3.5 }, { x: 1, y: 1 })).toEqual({ x: 2, y: 4 });
    expect(nearest([], { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('the window', () => {
  it('picks gridlines a person would have picked', () => {
    expect(step(20, 10)).toBe(2);
    expect(step(1, 10)).toBe(0.1);
    expect(step(0, 10)).toBe(1);
    expect(ticks(-2, 2, 4)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('labels them at the precision their own gap deserves', () => {
    expect(tickText(0, 1)).toBe('0');
    expect(tickText(0.5, 0.5)).toBe('0.5');
    expect(tickText(2, 1)).toBe('2');
    expect(tickText(1e6, 1e5)).toContain('e');
  });

  it('never asks for more gridlines than there are pixels', () => {
    expect(ticks(1e9, 1e9 + 1e-6, 10).length).toBeLessThan(500);
  });

  it('zooms about a point and keeps it where it was', () => {
    const closer = zoomed(HOME, 0.5, { x: 5, y: 5 });
    expect(closer.x1 - closer.x0).toBeCloseTo(10, 9);
    // The point under the finger stays under the finger: same fraction across.
    const before = (5 - HOME.x0) / (HOME.x1 - HOME.x0);
    const after = (5 - closer.x0) / (closer.x1 - closer.x0);
    expect(after).toBeCloseTo(before, 9);
  });

  it('stretches the window to the shape of the box, so a circle is round', () => {
    const shaped = squared({ x0: -10, x1: 10, y0: -10, y1: 10 }, 400, 200);
    expect(shaped.y1 - shaped.y0).toBeCloseTo(10, 9);
    expect((shaped.x1 - shaped.x0) / 400).toBeCloseTo((shaped.y1 - shaped.y0) / 200, 9);
  });

  it('fits the window to what is drawn, so a small curve is not a flat line', () => {
    const drawn = draw(of('y = 0.4 e^{-x^2/2}'), {}, HOME);
    const fit = fitted(HOME, [drawn]);
    expect(fit.y1).toBeGreaterThan(0.4);
    expect(fit.y1).toBeLessThan(0.6);
    expect(fit.x0).toBe(HOME.x0);
  });

  it('leaves the window alone when there is nothing on it', () => {
    expect(fitted(HOME, [])).toEqual(HOME);
    expect(fitted(HOME, [{ paths: [], points: [] }])).toEqual(HOME);
  });

  it('gives a flat line a window rather than a line', () => {
    const fit = fitted(HOME, [draw(of('y = 3'), {}, HOME)]);
    expect(fit.y1).toBeGreaterThan(3);
    expect(fit.y0).toBeLessThan(3);
  });

  it('knows a window that has collapsed', () => {
    expect(usable(HOME)).toBe(true);
    expect(usable({ x0: 1, x1: 1, y0: 0, y1: 1 })).toBe(false);
    expect(usable({ x0: 0, x1: NaN, y0: 0, y1: 1 })).toBe(false);
  });
});

describe('what the graph and the renderer agree on', () => {
  it('reads the same notation lib/maths.ts draws', () => {
    // The elasticity formula's own shape, as a curve: same source, both ways.
    const line = of('y = \\frac{\\Delta Q}{\\Delta P}');
    expect(line.kind).toBe('curve');
    expect(missing(line, {})).toEqual(['ΔQ', 'ΔP']);
  });

  it('works a value out of the tree the plot draws from', () => {
    const line = of('y = x^2');
    if (line.kind !== 'curve') throw new Error('not a curve');
    expect(value(line.body, { vars: { x: 3 } })).toBe(9);
  });
});
