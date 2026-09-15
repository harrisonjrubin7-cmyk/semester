import { describe, expect, it } from 'vitest';
import { value } from './calc';
import {
  answered,
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

describe('polar and parametric', () => {
  const frame: Frame = { x0: -10, x1: 10, y0: -10, y1: 10 };
  const fine = { columns: 480, cells: 90, steps: 360, turns: 2 } as const;

  it('takes r = as polar only when the angle is actually in it', () => {
    expect(of('r = 2 + 2\\cos(\\theta)').kind).toBe('polar');
    // The circle example defines r as a plain radius; turning that into a
    // curve would take somebody's slider away from them.
    expect(of('r = 5')).toMatchObject({ kind: 'value', name: 'r' });
  });

  it('takes a pair that mentions t as a curve, and one that does not as a point', () => {
    expect(of('(\\cos(t), \\sin(t))').kind).toBe('parametric');
    expect(of('(2, 3)').kind).toBe('point');
  });

  it('does not ask for a value for the letter it is drawing over', () => {
    expect(missing(of('r = a\\cos(\\theta)'), {})).toEqual(['a']);
    expect(missing(of('(\\cos(t), b\\sin(t))'), {})).toEqual(['b']);
    expect(missing(of('r = 4\\sin(2\\theta)'), {})).toEqual([]);
  });

  it('draws a polar circle where the circle actually is', () => {
    // r = 2cos θ is the circle of radius 1 about (1, 0) — every point on it.
    const { paths } = draw(of('r = 2\\cos(\\theta)'), {}, frame, fine);
    const points = paths.flat();
    expect(points.length).toBeGreaterThan(100);
    for (const p of points) {
      expect(Math.hypot(p.x - 1, p.y)).toBeCloseTo(1, 6);
    }
  });

  it('draws the petals a negative radius puts on the other side', () => {
    const points = draw(of('r = 4\\sin(2\\theta)'), {}, frame, fine).paths.flat();
    // Four petals: one in each quadrant, which only happens if a negative r is
    // drawn opposite rather than dropped.
    const quadrants = new Set(
      points.filter((p) => Math.hypot(p.x, p.y) > 1).map((p) => `${Math.sign(p.x)}${Math.sign(p.y)}`),
    );
    expect(quadrants.size).toBeGreaterThanOrEqual(4);
  });

  it('draws a parametric circle, closed', () => {
    const { paths } = draw(of('(5\\cos(t), 5\\sin(t))'), {}, frame, fine);
    const points = paths.flat();
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(5, 6);
    // It comes back to where it started, which is what "closed" means here.
    const first = points[0];
    const last = points[points.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(0.2);
  });

  it('draws one parametric curve per member of a list', () => {
    const scope = scopeOf([of('a = [1, 2, 3]')]);
    const { paths } = draw(of('(a\\cos(t), a\\sin(t))'), scope, frame, fine);
    expect(paths).toHaveLength(3);
    const radii = paths.map((path) => Math.hypot(path[0].x, path[0].y));
    expect(radii.map((r) => Math.round(r))).toEqual([1, 2, 3]);
  });

  it('draws the whole run, on screen or not, so zooming out finds the rest', () => {
    const small: Frame = { x0: -1, x1: 1, y0: -1, y1: 1 };
    const points = draw(of('(5\\cos(t), 5\\sin(t))'), {}, small, fine).paths.flat();
    expect(points.some((p) => Math.abs(p.x) > 1)).toBe(true);
  });

  it('breaks a polar curve where it has no value rather than joining across it', () => {
    const { paths } = draw(of('r = 1/\\theta'), {}, frame, fine);
    for (const path of paths) for (const p of path) expect(Number.isFinite(p.x)).toBe(true);
  });

  it('turns further when it is asked to', () => {
    const one = draw(of('r = \\theta'), {}, frame, { ...fine, turns: 1 }).paths.flat();
    const six = draw(of('r = \\theta'), {}, frame, { ...fine, turns: 6 }).paths.flat();
    const far = (ps: { x: number; y: number }[]) => Math.max(...ps.map((p) => Math.hypot(p.x, p.y)));
    expect(far(six)).toBeGreaterThan(far(one) * 3);
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

/**
 * The two transform lines, off the same list as everything else.
 *
 * `lib/laplace.test.ts` checks the arithmetic against closed forms. This
 * checks the joint: that `L{…}` is recognised as its own kind rather than read
 * as a letter beside a bracket, that what the picture is drawn from is what
 * the sentence under the line says, and that the step function is not reported
 * as a letter somebody forgot to give a value to.
 */
describe('a Laplace transform on the list', () => {
  it('is its own kind, in every way it is written', () => {
    expect(of('L{t^2}').kind).toBe('transform');
    expect(of('\\mathcal{L}\\{t^2\\}').kind).toBe('transform');
    expect(of('laplace{t^2}').kind).toBe('transform');
    expect(of('L^{-1}{1/s}').kind).toBe('inverse');
    expect(of('L^-1{1/s}').kind).toBe('inverse');
  });

  it('leaves a letter beside a bracket alone', () => {
    expect(of('L (t + 1)').kind).toBe('curve');
    expect(of('y = a(x + 1)').kind).toBe('curve');
  });

  it('says what it comes to, and the letter it is drawn against', () => {
    const got = answered(of('L{t^2}'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toBe('\\frac{2}{s^{3}}');
    expect(got.over).toBe('s');
    expect(got.at(2)).toBeCloseTo(2 / 8, 12);
  });

  it('comes back the other way too', () => {
    const got = answered(of('L^{-1}{1/(s^2 + 4)}'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toBe('0.5\\sin(2t)');
    expect(got.at(1)).toBeCloseTo(Math.sin(2) / 2, 10);
  });

  it('draws the curve the sentence describes, rather than a second one', () => {
    const line = of('L{e^{-t}}');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    const drawn = draw(line, {}, { x0: 1, x1: 5, y0: -2, y1: 2 });
    const points = drawn.paths.flat();
    expect(points.length).toBeGreaterThan(100);
    for (const p of points) expect(p.y).toBeCloseTo(got.at(p.x), 10);
  });

  it('breaks the line at the pole rather than joining the two sides of it', () => {
    const drawn = draw(of('L{e^{2t}}'), {}, { x0: 0, x1: 4, y0: -10, y1: 10 });
    expect(drawn.paths.length).toBeGreaterThan(1);
  });

  it('does not ask for a value for the step function', () => {
    expect(missing(of('L{u(t - 2)}'), {})).toEqual([]);
    expect(missing(of('L{δ(t - 1)}'), {})).toEqual([]);
    expect(missing(of('L{k e^{-t}}'), {})).toEqual(['k']);
  });

  it('says what it could not do rather than drawing nothing and staying quiet', () => {
    const got = answered(of('L{\\ln(t)}'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/ln/);
  });

  it('is nothing to do with any other kind of line', () => {
    expect(answered(of('y = x^2'), {})).toBeNull();
    expect(answered(of("y' = y"), {})).toBeNull();
  });
});

/**
 * A convolution and a transfer function, off the same list.
 *
 * Both are told from ordinary lines by what is written in them rather than by
 * a kind somebody picks first, which is the rule the whole list runs on — and
 * both of those tellings can go wrong quietly, so they are what this pins.
 */
describe('a convolution on the list', () => {
  it('is its own kind rather than a curve that draws nothing', () => {
    expect(of('conv(t, e^{-t})').kind).toBe('convolution');
    expect(of('convolve(1, 1)').kind).toBe('convolution');
  });

  it('says what it comes to, and draws it against t', () => {
    const line = of('conv(t, e^{-t})');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.over).toBe('t');
    expect(got.at(2)).toBeCloseTo(2 - 1 + Math.exp(-2), 9);
    const drawn = draw(line, {}, { x0: 0, x1: 6, y0: -1, y1: 6 });
    for (const p of drawn.paths.flat()) expect(p.y).toBeCloseTo(got.at(p.x), 10);
  });

  it('asks for nothing it supplies itself', () => {
    expect(missing(of('conv(t, e^{-t})'), {})).toEqual([]);
    expect(missing(of('conv(t, k e^{-t})'), {})).toEqual(['k']);
  });
});

describe('a transfer function on the list', () => {
  it('is told from a letter with a value by what is on the right of the =', () => {
    expect(of('H = 1/(s^2 + 0.3s + 1)').kind).toBe('transfer');
    expect(of('H(s) = 1/(s + 1)').kind).toBe('transfer');
    // No s in it, so it is the letter H with a value — and a slider.
    expect(of('H = 4')).toMatchObject({ kind: 'value', name: 'H' });
  });

  it('is read as the impulse response, with what its poles say', () => {
    const got = answered(of('H = 1/(s^2 + 4)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toBe('0.5\\sin(2t)');
    expect(got.over).toBe('t');
    expect(got.note).toMatch(/neither settles nor runs away/);
  });

  it('says it settles when it settles, and runs away when it does', () => {
    const steady = answered(of('H = 1/(s^2 + 0.3s + 1)'), {});
    const away = answered(of('H = 1/(s - 2)'), {});
    if (!steady || 'says' in steady || !away || 'says' in away) throw new Error('no answer');
    expect(steady.note).toMatch(/so it settles/);
    expect(away.note).toMatch(/runs away/);
  });
});

/**
 * The two Fourier lines, off the same list.
 *
 * `lib/fourier.test.ts` checks the arithmetic against coefficients a textbook
 * prints. This checks the joint: that the two are told apart from each other
 * and from everything else by what is written, that the picture is drawn from
 * the same numbers the sentence reports, and that a signal with no transform
 * is refused rather than half-answered.
 */
describe('Fourier on the list', () => {
  it('tells a transform from a series from a letter called F', () => {
    expect(of('F{e^{-2t}}').kind).toBe('spectrum');
    expect(of('\\mathcal{F}\\{e^{-2t}\\}').kind).toBe('spectrum');
    expect(of('fourier(sign(\\sin(t)), 2\\pi)').kind).toBe('harmonics');
    expect(of('F = 4')).toMatchObject({ kind: 'value', name: 'F' });
  });

  it('takes the period, and the count of harmonics where one is given', () => {
    const line = of('fourier(t, 2\\pi, 20)');
    if (line.kind !== 'harmonics') throw new Error('not harmonics');
    expect(line.count).not.toBeNull();
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toMatch(/^20 harmonics/);
    expect(got.over).toBe('t');
  });

  it('says what the series comes to, and draws that same sum', () => {
    const line = of('fourier(sign(\\sin(t)), 2\\pi)');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toMatch(/^1\.27324\\sin\(t\)/);
    const drawn = draw(line, {}, { x0: -6, x1: 6, y0: -2, y1: 2 });
    // Two drawings in one: the wave faint underneath, the sum full over it.
    expect(new Set(drawn.shades)).toEqual(new Set([0.5, 1]));
    const full = drawn.paths.filter((_, i) => drawn.shades?.[i] === 1).flat();
    for (const p of full) expect(p.y).toBeCloseTo(got.at(p.x), 10);
  });

  it('draws a spectrum from the size the sentence is about', () => {
    const line = of('F{e^{-2t}}');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.over).toBe('ω');
    expect(got.latex).toBe('\\frac{1}{i\\omega + 2}');
    const drawn = draw(line, {}, { x0: -8, x1: 8, y0: -1, y1: 1 });
    for (const p of drawn.paths.flat()) expect(p.y).toBeCloseTo(got.at(p.x), 10);
  });

  it('refuses a signal with no transform, on the line rather than silently', () => {
    const got = answered(of('F{\\sin(t)}'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/impulse in frequency/);
  });

  it('asks for the letters it needs and no others', () => {
    expect(missing(of('F{e^{-2t}}'), {})).toEqual([]);
    expect(missing(of('fourier(sign(\\sin(t)), T)'), {})).toEqual(['T']);
    expect(missing(of('fourier(k \\sin(t), 2\\pi)'), {})).toEqual(['k']);
  });

  it('says so rather than guessing at one argument', () => {
    expect(of('fourier(t)')).toMatchObject({ kind: 'fault' });
  });
});

/**
 * The z-transform on the list.
 *
 * `lib/discrete.test.ts` checks the arithmetic against the table. This checks
 * the joint, and one thing that is only true here: the inverse is drawn as
 * points on the integers, because a sequence has no value between them.
 */
describe('a z-transform on the list', () => {
  it('is its own kind, and is not the Fourier one', () => {
    expect(of('Z{0.5^n}').kind).toBe('ztransform');
    expect(of('\\mathcal{Z}\\{0.5^n\\}').kind).toBe('ztransform');
    expect(of('Z^{-1}{z/(z - 0.5)}').kind).toBe('sequence');
    expect(of('F{e^{-2t}}').kind).toBe('spectrum');
    expect(of('Z = 4')).toMatchObject({ kind: 'value', name: 'Z' });
  });

  it('says what it comes to, with what its poles mean', () => {
    const got = answered(of('Z{0.5^n}'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toBe('\\frac{z}{z - 0.5}');
    expect(got.over).toBe('z');
    expect(got.note).toMatch(/inside the unit circle, so it dies away/);
    expect(got.at(2)).toBeCloseTo(2 / 1.5, 10);
  });

  it('draws a sequence as beats with a stem to each, not as a curve', () => {
    const line = of('Z^{-1}{z/((z - 1)(z - 2))}');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.latex).toBe('2^{n} - 1');
    const drawn = draw(line, {}, { x0: -2, x1: 5, y0: -2, y1: 20 });
    // Nothing before n = 0, and one point per whole number after it.
    expect(drawn.points.map((p) => p.x)).toEqual([0, 1, 2, 3, 4, 5]);
    // Numerical roots, so to a handful of places rather than exactly.
    [0, 1, 3, 7, 15, 31].forEach((want, i) => expect(drawn.points[i].y).toBeCloseTo(want, 9));
    // Every path is a stem: two points, from the axis to the value.
    for (const path of drawn.paths) {
      expect(path).toHaveLength(2);
      expect(path[0].y).toBe(0);
      expect(path[0].x).toBe(path[1].x);
    }
  });

  it('asks for the letters it needs and no others', () => {
    expect(missing(of('Z{0.5^n}'), {})).toEqual([]);
    expect(missing(of('Z^{-1}{z/(z - a)}'), {})).toEqual(['a']);
    expect(missing(of('Z{k 0.5^n}'), {})).toEqual(['k']);
  });

  it('says what it could not do rather than drawing nothing quietly', () => {
    const got = answered(of('Z{\\ln(n)}'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/ln/);
  });
});

/**
 * The discrete transform on the list.
 *
 * `lib/fourier.test.ts` checks the arithmetic. This checks the joint, and the
 * one thing only true here: it reads a *list* off the line, which no other
 * kind on this list does.
 */
describe('a discrete transform on the list', () => {
  it('is its own kind, told by its name', () => {
    expect(of('dft([1, 0, -1, 0])').kind).toBe('bins');
    expect(of('fft(\\cos(n), 16)').kind).toBe('bins');
    expect(of('fourier(t, 2\\pi)').kind).toBe('harmonics');
  });

  it('reads the data off the line, and says what is in it', () => {
    const line = of('dft([1, 0, -1, 0, 1, 0, -1, 0])');
    const got = answered(line, {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toBe('8 samples, as the waves in them:');
    expect(got.over).toBe('k');
    expect(got.note).toMatch(/Biggest at k = 2, which is 2 cycles across the 8/);
    // Two cycles across eight samples: bins 2 and 6, at four each.
    expect(got.at(2)).toBeCloseTo(4, 9);
    expect(got.at(6)).toBeCloseTo(4, 9);
    expect(got.at(1)).toBeCloseTo(0, 9);
  });

  it('takes a formula and a count as well as a list', () => {
    const got = answered(of('dft(\\cos(2\\pi n/8), 8)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.at(1)).toBeCloseTo(4, 9);
  });

  it('takes its data from a line above it', () => {
    const lines = [of('a = [3, -1, 4, 1]'), of('dft(a)')];
    const scope = scopeOf(lines);
    const got = answered(lines[1], scope);
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toBe('4 samples, as the waves in them:');
    expect(got.at(0)).toBeCloseTo(7, 9);
  });

  it('draws a bin per sample, as stems from the axis', () => {
    // Four samples is four bins, and the window asking for more gets no more:
    // the transform repeats after N, and drawing the repeat would offer a
    // reading of data nobody gave.
    const drawn = draw(of('dft([1, 0, -1, 0])'), {}, { x0: -1, x1: 6, y0: -1, y1: 4 });
    expect(drawn.points.map((p) => p.x)).toEqual([0, 1, 2, 3]);
    // [1, 0, -1, 0] is one cycle across four samples: bins 1 and 3.
    expect(drawn.points.map((p) => Number(p.y.toFixed(9)))).toEqual([0, 2, 0, 2]);
    for (const path of drawn.paths) {
      expect(path).toHaveLength(2);
      expect(path[0].y).toBe(0);
    }
  });

  it('says what it wants rather than transforming a formula it cannot count', () => {
    const got = answered(of('dft(\\cos(n))'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/wants the data/);
    expect(of('dft()')).toMatchObject({ kind: 'fault' });
  });
});

/**
 * A wavelet on the list.
 *
 * `lib/wavelet.test.ts` checks the arithmetic. This checks the joint, and the
 * one thing peculiar to reading it off a line: the same second argument means
 * a level after a list and a count after a formula, because a list needs no
 * count. That is settled by looking at what is there, and getting it wrong
 * would smooth the wrong amount without saying so.
 */
describe('a wavelet on the list', () => {
  const run = '[1, 1, 2, 1, 1, 9, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2]';

  it('is its own kind, with the filter named by the call', () => {
    expect(of(`wavelet(${run})`).kind).toBe('wavelet');
    expect(of(`haar(${run})`)).toMatchObject({ kind: 'wavelet', filter: { name: 'Haar' } });
    expect(of(`db(${run})`)).toMatchObject({ kind: 'wavelet', filter: { name: 'Daubechies-4' } });
    expect(of(`daubechies(${run})`)).toMatchObject({ kind: 'wavelet', filter: { name: 'Daubechies-4' } });
    // A name in this notation is letters, so `d4` is `d` times `4` and always was.
    expect(of(`d4(${run})`).kind).toBe('curve');
    expect(of(`dft(${run})`).kind).toBe('bins');
  });

  it('reads the second argument as a level after a list', () => {
    const one = answered(of(`wavelet(${run}, 1)`), {});
    const two = answered(of(`wavelet(${run}, 2)`), {});
    if (!one || 'says' in one || !two || 'says' in two) throw new Error('no answer');
    expect(one.lead).toMatch(/smoothed to level 1:$/);
    expect(two.lead).toMatch(/smoothed to level 2:$/);
    // Level 1 is pairs averaged: samples 4 and 5 are 1 and 9, so both become 5.
    expect(one.at(4)).toBeCloseTo(5, 9);
    expect(one.at(5)).toBeCloseTo(5, 9);
    // Level 2 averages fours: 1, 9, 2, 1 becomes 3.25 across all four.
    expect(two.at(4)).toBeCloseTo(3.25, 9);
    expect(two.at(7)).toBeCloseTo(3.25, 9);
  });

  it('reads it as a count after a formula, and the level third', () => {
    const got = answered(of('wavelet(n, 16, 2)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toMatch(/^16 samples over 4 scales, Haar, smoothed to level 2:/);
    // A ramp averaged in fours: 0..3 all become 1.5.
    expect(got.at(0)).toBeCloseTo(1.5, 9);
    expect(got.at(3)).toBeCloseTo(1.5, 9);
  });

  it('says where the wobble is, which is the whole point of it', () => {
    const got = answered(of(`wavelet(${run}, 2)`), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.note).toMatch(/Of the wobble, level 1 holds \d+%/);
    expect(got.note).toMatch(/biggest single one is at level \d+, near sample \d+/);
    // The 9 is at sample 5, and nothing else in the run moves much.
    expect(got.note).toMatch(/near sample [4-7]/);
  });

  it('draws the data as dots and the smoothing as a step through them', () => {
    const drawn = draw(of(`wavelet(${run}, 1)`), {}, { x0: -2, x1: 20, y0: -2, y1: 12 });
    // Sixteen samples and no more, however wide the window is.
    expect(drawn.points).toHaveLength(16);
    expect(drawn.points[5].y).toBe(9);
    // One step path, two points per sample, flat across each.
    expect(drawn.paths).toHaveLength(1);
    expect(drawn.paths[0]).toHaveLength(32);
    expect(drawn.paths[0][10].y).toBeCloseTo(5, 9);
    expect(drawn.paths[0][11].y).toBeCloseTo(5, 9);
  });

  it('refuses a length it cannot halve, and says which lengths it can', () => {
    const got = answered(of('wavelet([1, 2, 3, 4, 5])'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/wants a power of two — 4 or 8, not 5/);
  });

  it('asks for the letters it needs and no others', () => {
    expect(missing(of(`wavelet(${run})`), {})).toEqual([]);
    expect(missing(of('wavelet(k n, 16)'), {})).toEqual(['k']);
    expect(of('wavelet()')).toMatchObject({ kind: 'fault' });
  });
});

/**
 * A Hilbert envelope on the list.
 *
 * `lib/hilbert.test.ts` checks the arithmetic against exact quarter turns.
 * This checks the joint, and the one thing peculiar to the picture: the
 * envelope is drawn both above and below, because it is the size of a wobble
 * and a wobble goes both ways.
 */
describe('a Hilbert envelope on the list', () => {
  it('is its own kind, under any of its names', () => {
    expect(of('hilbert([1, 0, -1, 0])').kind).toBe('envelope');
    expect(of('envelope(\\cos(n), 64)').kind).toBe('envelope');
    expect(of('analytic([1, 0, -1, 0])').kind).toBe('envelope');
    expect(of('dft([1, 0, -1, 0])').kind).toBe('bins');
  });

  it('is flat at the amplitude for a plain wave, and says how fast it turns', () => {
    const got = answered(of('hilbert(3\\cos(2\\pi n/16), 64)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toBe('64 samples, as a wobble inside an envelope:');
    expect(got.over).toBe('n');
    for (const n of [4, 20, 50]) expect(got.at(n)).toBeCloseTo(3, 6);
    // One cycle every sixteen samples is a sixteenth of a cycle a sample.
    expect(got.note).toMatch(/turns at about 0\.0625 cycles a sample/);
  });

  it('follows a fading wobble rather than the wobble itself', () => {
    const got = answered(of('hilbert(e^{-n/40}\\cos(n), 128)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    // The envelope falls away with the decay, and never rises back.
    expect(got.at(10)).toBeGreaterThan(got.at(60));
    expect(got.at(60)).toBeGreaterThan(got.at(100));
    expect(got.note).toMatch(/Loudest at sample \d+/);
  });

  it('draws the data as dots inside an envelope drawn both ways', () => {
    const drawn = draw(of('hilbert([0, 2, 0, -2, 0, 2, 0, -2])'), {}, { x0: -2, x1: 20, y0: -4, y1: 4 });
    expect(drawn.points).toHaveLength(8);
    // Two step paths: the envelope, and its mirror under the axis.
    expect(drawn.paths).toHaveLength(2);
    expect(drawn.paths[0]).toHaveLength(16);
    drawn.paths[0].forEach((p, i) => expect(p.y).toBeCloseTo(-drawn.paths[1][i].y, 12));
    // A wave of amplitude two has an envelope of two.
    for (const p of drawn.paths[0]) expect(p.y).toBeCloseTo(2, 6);
  });

  it('asks for the letters it needs, and for data when it has none', () => {
    expect(missing(of('hilbert([1, 0, -1, 0])'), {})).toEqual([]);
    expect(missing(of('hilbert(k \\cos(n), 64)'), {})).toEqual(['k']);
    const got = answered(of('hilbert(\\cos(n))'), {});
    if (!got || !('says' in got)) throw new Error('that was meant to be refused');
    expect(got.says).toMatch(/wants the data/);
    expect(of('hilbert()')).toMatchObject({ kind: 'fault' });
  });
});

/**
 * A packet tree on the list.
 *
 * `lib/packet.test.ts` checks the bands against the frequencies they claim to
 * hold. This checks the joint, and the thing the whole tree is for: two fast
 * wobbles that the ordinary wavelet transform lumps into one band come out in
 * two different ones here.
 */
describe('a packet tree on the list', () => {
  it('is its own kind, with the filter named by the call', () => {
    expect(of('packet([1, 2, 3, 4, 5, 6, 7, 8], 2)').kind).toBe('packet');
    expect(of('dbpacket([1, 2, 3, 4, 5, 6, 7, 8], 2)')).toMatchObject({
      kind: 'packet',
      filter: { name: 'Daubechies-4' },
    });
    expect(of('wavelet([1, 2, 3, 4, 5, 6, 7, 8], 2)').kind).toBe('wavelet');
  });

  it('puts a wobble in the band whose frequencies it belongs to', () => {
    // 0.3 cycles a sample, at level 3: bands are an eighth of a half each, so
    // band 4 runs from 0.25 to 0.3125.
    const got = answered(of('packet(\\cos(2\\pi 0.3 n), 64, 3)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toBe('64 samples, Haar, in 8 bands of equal width:');
    expect(got.over).toBe('k');
    expect(got.note).toMatch(/^Band 4 holds the most/);
    expect(got.note).toMatch(/0\.25 to 0\.313 cycles a sample/);
  });

  it('tells two fast wobbles apart, which is what the tree is for', () => {
    const near = answered(of('dbpacket(\\cos(2\\pi 0.28 n), 128, 3)'), {});
    const far = answered(of('dbpacket(\\cos(2\\pi 0.47 n), 128, 3)'), {});
    if (!near || 'says' in near || !far || 'says' in far) throw new Error('no answer');
    expect(near.note).toMatch(/^Band 4 holds the most/);
    expect(far.note).toMatch(/^Band 7 holds the most/);
  });

  it('says how compactly the run could be described, which one split cannot', () => {
    const got = answered(of('packet([0, 0, 0, 5, 0, 0, 0, 0], 2)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    // One spike: splitting only spreads it, so the whole run is the best basis.
    expect(got.note).toMatch(/uses 1 band rather than 4/);
  });

  it('draws a stem per band, and no more than there are', () => {
    const drawn = draw(of('packet([1, 2, 3, 4, 5, 6, 7, 8], 2)'), {}, { x0: -2, x1: 12, y0: -1, y1: 2 });
    expect(drawn.points.map((p) => p.x)).toEqual([0, 1, 2, 3]);
    // Shares of one, so they add to one.
    expect(drawn.points.reduce((t, p) => t + p.y, 0)).toBeCloseTo(1, 9);
    for (const path of drawn.paths) expect(path[0].y).toBe(0);
  });

  it('refuses a run it cannot split that many times, and says which way', () => {
    const short = answered(of('packet([1, 2, 3, 4], 3)'), {});
    const odd = answered(of('packet([1, 2, 3, 4, 5], 2)'), {});
    if (!short || !('says' in short) || !odd || !('says' in odd)) throw new Error('meant to be refused');
    expect(short.says).toMatch(/wants 8 samples at least, and there are 4/);
    expect(odd.says).toMatch(/wants a power of two — 4 or 8, not 5/);
  });

  it('asks for the letters it needs and no others', () => {
    expect(missing(of('packet([1, 2, 3, 4], 2)'), {})).toEqual([]);
    expect(missing(of('packet(k \\cos(n), 32, 3)'), {})).toEqual(['k']);
    expect(of('packet()')).toMatchObject({ kind: 'fault' });
  });
});

/**
 * A fractional transform on the list.
 *
 * `lib/fractional.test.ts` checks it is a rotation — that order 1 is the
 * ordinary transform to the last bit, and that turning twice is turning twice
 * as far. This checks the joint, and the one thing a person would type it for:
 * a chirp, which an ordinary spectrum smears across every bin, has an order
 * that gathers it and the reading says which.
 */
describe('a fractional transform on the list', () => {
  it('is its own kind, by any of its names', () => {
    expect(of('frft([1, 2, 3, 4], 0.5)').kind).toBe('fractional');
    expect(of('fractional([1, 2, 3, 4], 0.5)').kind).toBe('fractional');
    expect(of('dft([1, 2, 3, 4])').kind).toBe('bins');
  });

  it('draws the ordinary spectrum at order 1', () => {
    // The same eight samples through `dft` and through `frft(…, 1)`: the sizes
    // match but for the scaling a rotation has to have, which is a root of 8.
    const plain = answered(of('dft([3, -1, 4, 1, -5, 9, 2, 6])'), {});
    const turned = answered(of('frft([3, -1, 4, 1, -5, 9, 2, 6], 1)'), {});
    if (!plain || 'says' in plain || !turned || 'says' in turned) throw new Error('no answer');
    for (let k = 0; k < 8; k += 1) {
      expect(turned.at(k) * Math.sqrt(8)).toBeCloseTo(plain.at(k), 9);
    }
  });

  it('gives the run back at order 0', () => {
    const got = answered(of('frft([3, -1, 4, 1], 0)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.lead).toBe('4 samples, turned 0 of the way round:');
    [3, 1, 4, 1].forEach((size, k) => expect(got.at(k)).toBeCloseTo(size, 9));
  });

  it('finds the order a chirp lines up at, and draws it there when none is asked', () => {
    const got = answered(of('frft(\\cos(0.02 n^2), 64)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    // A chirp is smeared at order 1 and gathered somewhere else; which order
    // is what the reading is for, so the lead and the note agree on it.
    const at = Number(/turned ([\-0-9.]+) of the way/.exec(got.lead)?.[1]);
    const best = Number(/gathers best at order ([\-0-9.]+)/.exec(got.note ?? '')?.[1]);
    expect(at).toBe(best);
    expect(Math.abs(best - 1)).toBeGreaterThan(0.05);
    expect(got.note).toMatch(/so this is a chirp/);
  });

  it('does not call a plain wobble a chirp', () => {
    // A sine gathers best at the ordinary spectrum, and saying it sweeps at
    // order 1 would be a reading that sounds like an answer and is not.
    const got = answered(of('frft(\\cos(2\\pi 0.25 n), 32)'), {});
    if (!got || 'says' in got) throw new Error('no answer');
    expect(got.note).toMatch(/a wobble at a fixed frequency rather than a chirp/);
    expect(got.note).not.toMatch(/is a chirp, and/);
  });

  it('gathers a chirp better at its own order than at the ordinary one', () => {
    const spread = answered(of('frft(\\cos(0.02 n^2), 64, 1)'), {});
    const lined = answered(of('frft(\\cos(0.02 n^2), 64)'), {});
    if (!spread || 'says' in spread || !lined || 'says' in lined) throw new Error('no answer');
    const peak = (a: { at: (k: number) => number }) =>
      Math.max(...Array.from({ length: 64 }, (_, k) => a.at(k)));
    expect(peak(lined)).toBeGreaterThan(peak(spread));
  });

  it('draws a stem per bin, and no more than there are', () => {
    const drawn = draw(of('frft([1, 2, 3, 4], 0.5)'), {}, { x0: -2, x1: 12, y0: -1, y1: 5 });
    expect(drawn.points.map((p) => p.x)).toEqual([0, 1, 2, 3]);
    for (const path of drawn.paths) expect(path[0].y).toBe(0);
  });

  it('refuses a run longer than it can take apart', () => {
    const got = answered(of('frft(\\cos(n), 512)'), {});
    if (!got || !('says' in got)) throw new Error('meant to be refused');
    expect(got.says).toMatch(/256 samples is as many as this does at once, and there are 512/);
  });

  it('asks for the letters it needs and no others', () => {
    expect(missing(of('frft([1, 2, 3, 4], 0.5)'), {})).toEqual([]);
    expect(missing(of('frft(k \\cos(n), 32, 0.5)'), {})).toEqual(['k']);
    expect(of('frft()')).toMatchObject({ kind: 'fault' });
  });
});
