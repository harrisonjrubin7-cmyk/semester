import { describe, expect, it } from 'vitest';
import { read } from './calc';
import { readLine, type Frame } from './plot';
import { asOde, rateOf, slopes, spread, through, walk } from './ode';

/**
 * A numerical solver is checked against answers that are known, because a
 * curve that drifts off the true solution still looks like a curve. Every one
 * of these has a closed form somebody can check by hand — which is the point:
 * the app will never print that closed form, so the arithmetic has to be
 * right.
 */

const frame: Frame = { x0: -5, x1: 5, y0: -5, y1: 5 };
const node = (source: string) => {
  const got = read(source);
  if (!got.ok) throw new Error(got.fault);
  return got.node;
};
const band = { low: -1e6, high: 1e6 };

describe('reading it off the list', () => {
  it('takes all three ways of writing a rate', () => {
    expect(readLine("y' = x + y").kind).toBe('ode');
    expect(readLine('dy/dx = x + y').kind).toBe('ode');
    expect(readLine('\\frac{dy}{dx} = x + y').kind).toBe('ode');
  });

  it('takes an initial condition', () => {
    expect(readLine('y(0) = 1').kind).toBe('start');
    expect(readLine('y(-2) = 3')).toMatchObject({ kind: 'start' });
  });

  it('leaves everything else alone', () => {
    expect(readLine('y = x + 1').kind).toBe('curve');
    expect(readLine('f(x) = x^2').kind).toBe('fun');
    expect(readLine('(2, 3)').kind).toBe('point');
  });
});

describe('the walk', () => {
  it('solves the one everybody knows, to ten places', () => {
    // y' = y through (0, 1) is e^x, so the value at x = 1 is e.
    const path = walk(rateOf(node('y'), {}), { x: 0, y: 1 }, 1, 400, band);
    expect(path[path.length - 1].y).toBeCloseTo(Math.E, 10);
  });

  it('solves one whose answer is not an exponential', () => {
    // y' = x through (0, 0) is x²/2.
    const path = walk(rateOf(node('x'), {}), { x: 0, y: 0 }, 3, 200, band);
    expect(path[path.length - 1].y).toBeCloseTo(4.5, 9);
  });

  it('walks backwards as readily as forwards', () => {
    const back = walk(rateOf(node('y'), {}), { x: 0, y: 1 }, -1, 400, band);
    expect(back[back.length - 1].y).toBeCloseTo(1 / Math.E, 10);
  });

  it('stops where the solution does rather than drawing past it', () => {
    // y' = y² through (0, 1) runs to infinity at x = 1 and has nothing after.
    const path = walk(rateOf(node('y^2'), {}), { x: 0, y: 1 }, 3, 600, { low: -1e4, high: 1e4 });
    const last = path[path.length - 1];
    expect(last.x).toBeLessThan(1.2);
    expect(path.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('comes back empty rather than looping when there is nowhere to go', () => {
    expect(walk(rateOf(node('y'), {}), { x: 0, y: 1 }, 0, 10, band)).toEqual([]);
  });
});

describe('the curve through a point', () => {
  const f = rateOf(node('y'), {});

  it('runs both ways across the window, in order', () => {
    const curve = through(f, { x: 0, y: 1 }, frame, 400);
    expect(curve[0].x).toBeCloseTo(frame.x0, 6);
    expect(curve[curve.length - 1].x).toBeGreaterThan(0);
    for (let i = 1; i < curve.length; i += 1) expect(curve[i].x).toBeGreaterThan(curve[i - 1].x);
  });

  it('passes through the point it was given', () => {
    const curve = through(f, { x: 0, y: 1 }, frame, 400);
    const near = curve.reduce((best, p) => (Math.abs(p.x) < Math.abs(best.x) ? p : best));
    expect(near.y).toBeCloseTo(1, 6);
  });

  it('is the true solution all the way along, not only at the start', () => {
    const curve = through(f, { x: 0, y: 1 }, { ...frame, x0: -2, x1: 2 }, 400);
    for (const p of curve) expect(p.y).toBeCloseTo(Math.exp(p.x), 6);
  });
});

describe('the family, and the field under it', () => {
  it('starts one curve per place when nobody said where', () => {
    expect(spread(frame, 9)).toHaveLength(9);
    for (const p of spread(frame, 9)) {
      expect(p.y).toBeGreaterThan(frame.y0);
      expect(p.y).toBeLessThan(frame.y1);
    }
  });

  it('lays a dash at every point, along the slope there', () => {
    const marks = slopes(rateOf(node('0 x + 1'), {}), frame, 6);
    expect(marks).toHaveLength(36);
    for (const [a, b] of marks) {
      // Slope 1 in a square window is a dash at 45°.
      expect((b.y - a.y) / (b.x - a.x)).toBeCloseTo(1, 6);
    }
  });

  it('leaves out a dash where the equation has no value', () => {
    expect(slopes(rateOf(node('1/(x - x)'), {}), frame, 4)).toEqual([]);
  });

  it('draws the field faint and the solutions full, through one mechanism', () => {
    const drawn = asOde(node('y'), [{ x: 0, y: 1 }], {}, frame, 200);
    expect(drawn.shades).toHaveLength(drawn.paths.length);
    expect(new Set(drawn.shades)).toEqual(new Set([0.3, 1]));
    expect(drawn.points).toEqual([{ x: 0, y: 1 }]);
  });

  it('draws the whole family when no starting point was given', () => {
    const one = asOde(node('y'), [{ x: 0, y: 1 }], {}, frame, 200);
    const many = asOde(node('y'), [], {}, frame, 200);
    const solutions = (d: typeof one) => (d.shades ?? []).filter((v) => v === 1).length;
    expect(solutions(one)).toBe(1);
    expect(solutions(many)).toBeGreaterThan(4);
  });
});
