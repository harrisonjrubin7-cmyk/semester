/**
 * The line through a scatter, and how much of it the line accounts for.
 *
 * `lib/nav.ts` has advertised "regression" as a thing the maths screen does
 * since search learned about that screen. It did not. The spreadsheet has
 * `SLOPE`, which is the coefficient without the picture, the intercept, the
 * fit or anything to look at — and search sends somebody typing "regression"
 * to a grapher that has never drawn one.
 *
 * Everything needed was already there. A `point` line takes *lists* — see
 * `case 'point'` in `lib/plot.ts`, which pairs `flat(value(x))` against
 * `flat(value(y))` — so `([1,2,3], [2,4.1,5.9])` is already three dots on the
 * screen. What was missing is the line through them.
 *
 * ## Least squares, y on x, and nothing cleverer
 *
 * Ordinary least squares with y regressed on x. Not total least squares, not
 * y-on-x and x-on-y averaged, not anything weighted: this is the line a first
 * econometrics or statistics course means by "the regression line", and it is
 * what the student is being asked to reproduce by hand. A more defensible
 * estimator that disagrees with their problem set is worse than useless here.
 *
 * ## Three points, not two
 *
 * Two points define a line exactly. Fitting them gives R² = 1 by construction,
 * and reporting that is a fit with no evidence in it — the app flattering
 * somebody who has plotted two dots. The floor is three, and below it this
 * says nothing rather than saying something true and empty.
 */

export interface Point {
  x: number;
  y: number;
}

/** The fewest points that make a fit mean anything. See the header. */
export const ENOUGH = 3;

export interface Fit {
  /** The coefficient — how much y moves per unit of x. */
  slope: number;
  /** Where the line meets the y axis. */
  intercept: number;
  /**
   * How much of the variation in y the line accounts for, 0 to 1.
   *
   * Reported because the slope on its own is the half students quote and the
   * half that misleads: a steep line through a cloud is a steep line through a
   * cloud. Not called "R squared" in the type because the screen says that.
   */
  r2: number;
  /** How many points it was fitted to, so the reader can weigh it. */
  n: number;
}

/**
 * The least-squares line through these points, or null when there is not one.
 *
 * Three ways to get nothing back, and each is a real case rather than a
 * defensive shrug:
 *
 *  - **Too few points.** Under `ENOUGH`, per the header.
 *  - **No spread in x.** Every point on one vertical. The least-squares line
 *    of y on x is vertical, its slope is infinite, and there is no honest
 *    number to print — so nothing is printed. Returning a huge slope would be
 *    a number somebody writes down.
 *  - **Nothing finite.** Points can come from an expression that blew up.
 *
 * Non-finite points are dropped before counting, so three points of which one
 * is `NaN` is two points and gets nothing — which is the same answer as
 * plotting two points, and correctly so.
 */
export function fit(points: Point[]): Fit | null {
  const good = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = good.length;
  if (n < ENOUGH) return null;

  const mx = good.reduce((s, p) => s + p.x, 0) / n;
  const my = good.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of good) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  /*
   * R², and the two places the textbook formula misbehaves.
   *
   * **Zero over zero.** `syy` is zero when every y is identical — a perfectly
   * flat scatter. The usual `1 - ssr/syy` is then 0/0. A flat line through
   * flat data is a perfect fit and the honest answer is 1. The alternative
   * found in a lot of code is `NaN`, which reaches the screen as "R² = NaN"
   * on the most obviously well-fitted data anybody could enter.
   *
   * **A small negative.** Points far from the origin with little spread —
   * `x ≈ 1e12` varying in the third decimal, which is what a year column or a
   * timestamp looks like — lose most of their significant figures in
   * `(p.x - mx)`, and `ssr` comes out a hair larger than `syy`. Measured over
   * 400,000 random sets: 142 produced an R² below zero, worst −0.00066. A
   * negative R² on screen reads as a bug in the student's data rather than in
   * the arithmetic, so it is floored.
   *
   * Only floored, not capped. `ssr` and `syy` are both sums of squares, so
   * `ssr/syy ≥ 0` and `1 - ssr/syy ≤ 1` exactly — an upper clamp could never
   * be the clause that decided anything, and the same probe found nothing
   * above 1. A guard that cannot fire is one somebody later trusts.
   */
  let ssr = 0;
  let syy = 0;
  for (const p of good) {
    ssr += (p.y - (slope * p.x + intercept)) ** 2;
    syy += (p.y - my) ** 2;
  }
  const r2 = syy === 0 ? 1 : Math.max(0, 1 - ssr / syy);

  return { slope, intercept, r2, n };
}

/** A number at the precision a person would write it down. */
function said(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 0.001 || abs >= 100_000)) return v.toExponential(2);
  return String(Math.round(v * 1000) / 1000);
}

/**
 * The fitted line as an equation, written the way a person writes one.
 *
 * Three things, each of which is what gives a generated equation away:
 *
 *  - **`y = 2x + -3`.** A string built by concatenation, and it is in a lot of
 *    otherwise careful software. The sign belongs in the operator.
 *  - **`y = 1x + 1.2`.** Nobody writes the one. Measured on screen — that is
 *    exactly what the first version of this printed for a scatter whose slope
 *    came out at one.
 *  - **`y = 0x + 7`.** A flat fit is `y = 7`, and an x term with nothing in it
 *    invites somebody to wonder what they missed.
 *
 * Decided on the *rounded* coefficient rather than the raw one, because the
 * rounded one is what appears: a slope of 0.9999999 prints as `1`, and
 * printing `1x` beside it would be the same blemish arrived at by a longer
 * route.
 */
export function fitLine(f: Fit): string {
  const slope = said(f.slope);
  const term = slope === '1' ? 'x' : slope === '-1' ? '−x' : `${slope}x`;
  const sign = f.intercept < 0 ? '−' : '+';
  const rest = `${sign} ${said(Math.abs(f.intercept))}`;
  if (slope === '0') return `y = ${f.intercept < 0 ? '−' : ''}${said(Math.abs(f.intercept))}`;
  return `y = ${term} ${rest}`;
}

/**
 * The whole reading, for the line under the equation.
 *
 * R² to two figures, which is as many as the data usually supports, and the
 * count beside it — because "R² = 0.98" over four points and over four hundred
 * are different claims and only one of them is worth quoting.
 */
export function saysFit(f: Fit): string {
  return `R² ${f.r2.toFixed(2)} · ${f.n} points`;
}

/** The fitted line as a function, for drawing it across the window. */
export function asLine(f: Fit): (x: number) => number {
  return (x) => f.slope * x + f.intercept;
}
