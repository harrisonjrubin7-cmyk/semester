import { describe, expect, it } from 'vitest';
import { ENOUGH, asLine, fit, fitLine, saysFit, type Point } from './fit';

const pts = (xs: number[], ys: number[]): Point[] => xs.map((x, i) => ({ x, y: ys[i] }));

describe('the line through the points', () => {
  it('recovers a line the points are exactly on', () => {
    // y = 2x + 1, sampled. Anything that cannot do this is not a regression.
    const f = fit(pts([0, 1, 2, 3], [1, 3, 5, 7]))!;
    expect(f.slope).toBeCloseTo(2, 10);
    expect(f.intercept).toBeCloseTo(1, 10);
    expect(f.r2).toBeCloseTo(1, 10);
    expect(f.n).toBe(4);
  });

  it('recovers a negative slope, which is most of an economics course', () => {
    const f = fit(pts([1, 2, 3, 4], [10, 8, 6, 4]))!;
    expect(f.slope).toBeCloseTo(-2, 10);
    expect(f.intercept).toBeCloseTo(12, 10);
  });

  it('matches the worked answer on a scattered set', () => {
    /*
     * Checked by hand rather than against this implementation, which is the
     * whole point of having the case: x̄ = 3, ȳ = 4.2;
     * Sxy = (-2)(-2.2) + (-1)(-1.2) + 0(0.8) + 1(0.8) + 2(1.8) = 10;
     * Sxx = 4 + 1 + 0 + 1 + 4 = 10; so slope = 1 and intercept = 4.2 - 3 = 1.2.
     */
    const f = fit(pts([1, 2, 3, 4, 5], [2, 3, 5, 5, 6]))!;
    expect(f.slope).toBeCloseTo(1, 10);
    expect(f.intercept).toBeCloseTo(1.2, 10);
  });

  it('reports a fit that is good but not perfect as such', () => {
    const f = fit(pts([1, 2, 3, 4, 5], [2, 3, 5, 5, 6]))!;
    expect(f.r2).toBeGreaterThan(0.85);
    expect(f.r2).toBeLessThan(1);
  });

  it('reports a cloud with no trend as accounting for almost nothing', () => {
    const f = fit(pts([1, 2, 3, 4, 5, 6], [5, 1, 6, 2, 5, 2]))!;
    expect(f.r2).toBeLessThan(0.3);
  });

  it('keeps R² inside nought and one whatever the data does', () => {
    // The upper half of this is not guarded in `fit` and does not need to be:
    // `ssr` and `syy` are both sums of squares, so `1 - ssr/syy ≤ 1` exactly.
    // It is asserted anyway, because that is the sort of thing a later change
    // to the formula would break quietly.
    for (const ys of [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
      [0, 0, 0, 1],
      [1e9, -1e9, 1e9, -1e9],
    ]) {
      const f = fit(pts([1, 2, 3, 4], ys));
      if (!f) continue;
      expect(f.r2, String(ys)).toBeGreaterThanOrEqual(0);
      expect(f.r2, String(ys)).toBeLessThanOrEqual(1);
    }
  });
});

describe('when there is no honest line to draw', () => {
  it('says nothing for two points, however neatly they sit', () => {
    /*
     * Two points define a line exactly, so R² is 1 by construction. Reporting
     * that is a fit with no evidence in it — the app flattering somebody who
     * has plotted two dots.
     */
    expect(fit(pts([1, 2], [3, 5]))).toBeNull();
    expect(ENOUGH).toBe(3);
  });

  it('says nothing for one point or none', () => {
    expect(fit([{ x: 1, y: 1 }])).toBeNull();
    expect(fit([])).toBeNull();
  });

  it('says nothing when every point is on one vertical', () => {
    // The least-squares line of y on x is vertical here: its slope is
    // infinite and there is no honest number to print. A huge finite slope
    // would be a number somebody writes down.
    expect(fit(pts([2, 2, 2, 2], [1, 2, 3, 4]))).toBeNull();
  });

  it('drops points that are not finite before counting them', () => {
    // Three points of which one is NaN is two points, and two points get
    // nothing — the same answer as plotting two, correctly.
    const withNaN = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: Number.NaN, y: 3 },
    ];
    expect(fit(withNaN)).toBeNull();
    expect(fit([...withNaN, { x: 4, y: 4 }])?.n).toBe(3);
  });

  it('drops an infinity, which is what an expression that blew up leaves', () => {
    const f = fit([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: Number.POSITIVE_INFINITY },
      { x: 4, y: 4 },
    ]);
    expect(f?.n).toBe(3);
    expect(f?.slope).toBeCloseTo(1, 10);
  });
});

describe('data far from the origin, where the arithmetic loses its figures', () => {
  it('never reports a negative fit', () => {
    /*
     * Found by probing rather than reasoned about: 400,000 random sets, of
     * which 142 gave an R² below zero, worst −0.00066. The shape that does it
     * is points a long way from the origin with little spread between them —
     * a year column, a timestamp, a price index — where `(p.x - mx)` throws
     * away most of the significant figures and `ssr` lands a hair above `syy`.
     *
     * This is one of the 142, kept verbatim. A negative R² on screen reads as
     * a bug in the student's data rather than in ours.
     */
    const f = fit([
      { x: 1000000000000.0051, y: 1000000000000.1923 },
      { x: 1000000000000.9111, y: 1000000000000.2069 },
      { x: 1000000000000.4977, y: 999999999999.9365 },
    ])!;
    expect(f.r2).toBeGreaterThanOrEqual(0);
  });
});

describe('flat data, which is where the textbook formula divides by nothing', () => {
  it('calls a flat line through flat points a perfect fit, not NaN', () => {
    /*
     * Every y identical means the total sum of squares is zero and the usual
     * `1 - ssr/syy` is 0/0. A flat line through flat data *is* a perfect fit.
     * The alternative found in a lot of code reaches the screen as "R² = NaN"
     * on the most obviously well-fitted data anybody could enter.
     */
    const f = fit(pts([1, 2, 3, 4], [7, 7, 7, 7]))!;
    expect(f.r2).toBe(1);
    expect(Number.isNaN(f.r2)).toBe(false);
    expect(f.slope).toBeCloseTo(0, 10);
    expect(f.intercept).toBeCloseTo(7, 10);
  });
});

describe('how it reads', () => {
  it('writes the equation with a proper sign', () => {
    // `y = 2x + -3` is the giveaway of a string built by concatenation, and it
    // is in a lot of otherwise careful software.
    expect(fitLine({ slope: 2, intercept: -3, r2: 1, n: 5 })).toBe('y = 2x − 3');
    expect(fitLine({ slope: 2, intercept: 3, r2: 1, n: 5 })).toBe('y = 2x + 3');
  });

  it('does not write the one, which nobody writes', () => {
    // Measured on screen: a scatter whose slope came out at one printed
    // `y = 1x + 1.2`.
    expect(fitLine({ slope: 1, intercept: 1.2, r2: 1, n: 5 })).toBe('y = x + 1.2');
    expect(fitLine({ slope: -1, intercept: 1.2, r2: 1, n: 5 })).toBe('y = −x + 1.2');
  });

  it('decides that off the rounded slope, not the raw one', () => {
    // 0.9999999 prints as `1`, so printing `1x` beside it would be the same
    // blemish reached by a longer route.
    expect(fitLine({ slope: 0.9999999, intercept: 0, r2: 1, n: 5 })).toBe('y = x + 0');
  });

  it('writes a flat fit as a number, with no empty x term', () => {
    expect(fitLine({ slope: 0, intercept: 7, r2: 1, n: 5 })).toBe('y = 7');
    expect(fitLine({ slope: 0, intercept: -7, r2: 1, n: 5 })).toBe('y = −7');
  });

  it('rounds to what a person would write down', () => {
    expect(fitLine({ slope: 1.987654, intercept: 0.0723, r2: 1, n: 5 })).toBe('y = 1.988x + 0.072');
  });

  it('does not print a wall of zeroes for a very small or very large number', () => {
    expect(fitLine({ slope: 0.0000123, intercept: 0, r2: 1, n: 5 })).toContain('e-');
    expect(fitLine({ slope: 1.2e9, intercept: 0, r2: 1, n: 5 })).toContain('e+');
  });

  it('quotes the count beside the fit, because they are one claim', () => {
    // "R² = 0.98" over four points and over four hundred are different claims
    // and only one of them is worth quoting.
    expect(saysFit({ slope: 1, intercept: 0, r2: 0.9812, n: 4 })).toBe('R² 0.98 · 4 points');
  });
});

describe('the fitted line as something to draw', () => {
  it('passes through the points it was fitted to', () => {
    const f = fit(pts([0, 1, 2, 3], [1, 3, 5, 7]))!;
    const line = asLine(f);
    expect(line(0)).toBeCloseTo(1, 10);
    expect(line(3)).toBeCloseTo(7, 10);
  });

  it('goes on beyond them, which is what drawing it across a window needs', () => {
    const line = asLine(fit(pts([0, 1, 2, 3], [1, 3, 5, 7]))!);
    expect(line(-10)).toBeCloseTo(-19, 10);
    expect(line(100)).toBeCloseTo(201, 10);
  });
});
