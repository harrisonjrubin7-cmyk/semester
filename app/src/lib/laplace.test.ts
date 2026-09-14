import { describe, expect, it } from 'vitest';
import { read } from './calc';
import { rateOf, second, walk } from './ode';
import {
  at,
  atS,
  exactly,
  forward,
  inverse,
  latexFn,
  latexTransform,
  linearOde,
  poleText,
  poles,
  readFn,
  readRat,
  transferOf,
  transform,
  type Transform,
} from './laplace';

/**
 * A transform is checked against the table, and the table is checked against
 * the integral it comes from — by a second method, not by eye.
 *
 * Every forward answer here is compared with the closed form a textbook
 * prints, at values of s nobody used to build it. Every inverse is compared
 * with the function it should be, at times nobody used to build it. And the
 * solved equations are checked twice: against their own closed forms, and
 * against `lib/ode.ts`, which solves the same equation by walking it and knows
 * nothing about any of this. Two methods agreeing to nine places is the only
 * evidence worth having that either is right.
 */

const node = (source: string) => {
  const got = read(source);
  if (!got.ok) throw new Error(`${source}: ${got.fault}`);
  return got.node;
};

const got = <T,>(r: { ok: true; it: T } | { ok: false; fault: string }): T => {
  if (!r.ok) throw new Error(r.fault);
  return r.it;
};

const fault = (r: { ok: boolean; fault?: string }): string => {
  if (r.ok) throw new Error('that was meant to be refused');
  return r.fault ?? '';
};

/** A transform agrees with a formula where it is asked, not where it was built. */
const agrees = (rat: Transform, f: (s: number) => number, ss = [0.7, 1.3, 2.2, 4.5, 9]) => {
  for (const s of ss) expect(atS(rat, s)).toBeCloseTo(f(s), 9);
};

const L = (source: string) => got(transform(node(source)));
const back = (source: string) => got(inverse(got(readRat(node(source)))));

describe('the table, forwards', () => {
  it('takes the four rows everybody memorises', () => {
    agrees(L('1'), (s) => 1 / s);
    agrees(L('t'), (s) => 1 / s ** 2);
    agrees(L('t^2'), (s) => 2 / s ** 3);
    agrees(L('t^5'), (s) => 120 / s ** 6);
  });

  it('takes an exponential, and a number to a power of t', () => {
    agrees(L('e^{-2t}'), (s) => 1 / (s + 2));
    agrees(L('3e^{0.5t}'), (s) => 3 / (s - 0.5));
    agrees(L('2^t'), (s) => 1 / (s - Math.LN2));
  });

  it('takes a wave', () => {
    agrees(L('\\sin(3t)'), (s) => 3 / (s ** 2 + 9));
    agrees(L('\\cos(3t)'), (s) => s / (s ** 2 + 9));
    agrees(L('\\sinh(2t)'), (s) => 2 / (s ** 2 - 4));
    agrees(L('\\cosh(2t)'), (s) => s / (s ** 2 - 4));
  });

  it('takes the two shifting rules, which are the whole of the method', () => {
    // First shift: e^{at}f(t) moves the transform along s.
    agrees(L('t e^{-t}'), (s) => 1 / (s + 1) ** 2);
    agrees(L('e^{-t}\\cos(2t)'), (s) => (s + 1) / ((s + 1) ** 2 + 4));
    agrees(L('e^{-t}\\sin(2t)'), (s) => 2 / ((s + 1) ** 2 + 4));
    // Multiplying by t, which is differentiating the transform.
    agrees(L('t\\sin(2t)'), (s) => (4 * s) / (s ** 2 + 4) ** 2);
    agrees(L('t\\cos(2t)'), (s) => (s ** 2 - 4) / (s ** 2 + 4) ** 2);
    agrees(L('t^2 e^{-3t}'), (s) => 2 / (s + 3) ** 3);
  });

  it('takes a step and an impulse — the second shift', () => {
    agrees(L('u(t - 2)'), (s) => Math.exp(-2 * s) / s);
    agrees(L('δ(t - 1)'), (s) => Math.exp(-s));
    agrees(L('3δ(t)'), () => 3);
  });

  it('writes a delayed function from its own start, not from zero', () => {
    // L{t·u(t−2)} is not e^{-2s}/s²: the ramp is two high when it switches on.
    agrees(L('t u(t - 2)'), (s) => Math.exp(-2 * s) * (1 / s ** 2 + 2 / s));
    agrees(L('e^{-t} u(t - 1)'), (s) => (Math.exp(-1) * Math.exp(-s)) / (s + 1));
  });

  it('is linear, which is the only property it is used for', () => {
    agrees(L('3t^2 - 2e^{-t} + 5'), (s) => 6 / s ** 3 - 2 / (s + 1) + 5 / s);
  });

  it('puts a sum over the smallest denominator that holds it', () => {
    // Two terms over s³, not one over s⁵: a common denominator is not a product.
    const rat = L('t^2 + t');
    expect(rat).toHaveLength(1);
    expect(rat[0].den).toHaveLength(4);
    agrees(rat, (s) => 2 / s ** 3 + 1 / s ** 2);
  });

  it('multiplies two waves into the sum they are', () => {
    agrees(L('\\cos(2t)\\cos(3t)'), (s) => 0.5 * (s / (s ** 2 + 1)) + 0.5 * (s / (s ** 2 + 25)));
    agrees(L('\\sin(t)^2'), (s) => 0.5 / s - 0.5 * (s / (s ** 2 + 4)));
  });

  it('takes a phase, because a phase is a sum of the two waves', () => {
    const phase = 0.6;
    agrees(L('\\sin(2t + 0.6)'), (s) => (Math.cos(phase) * 2 + Math.sin(phase) * s) / (s ** 2 + 4));
  });
});

describe('the table, backwards', () => {
  const same = (fn: ReturnType<typeof back>, f: (t: number) => number, ts = [0.2, 0.9, 1.7, 3.3]) => {
    for (const t of ts) expect(at(fn, t)).toBeCloseTo(f(t), 8);
  };

  it('comes back from the rows it went out on', () => {
    same(back('1/s'), () => 1);
    same(back('2/s^3'), (t) => t ** 2);
    same(back('1/(s + 2)'), (t) => Math.exp(-2 * t));
    same(back('1/(s^2 + 4)'), (t) => Math.sin(2 * t) / 2);
    same(back('s/(s^2 + 4)'), (t) => Math.cos(2 * t));
  });

  it('splits a fraction into the pieces it is a sum of', () => {
    // 1/((s+1)(s+2)) = 1/(s+1) − 1/(s+2).
    same(back('1/((s + 1)(s + 2))'), (t) => Math.exp(-t) - Math.exp(-2 * t));
    same(back('(2s + 3)/(s^2 + 3s + 2)'), (t) => Math.exp(-t) + Math.exp(-2 * t));
  });

  it('gets a repeated root right, which is where the easy method fails', () => {
    same(back('1/(s + 1)^3'), (t) => (t ** 2 * Math.exp(-t)) / 2);
    same(back('1/(s^2 (s + 1))'), (t) => t - 1 + Math.exp(-t));
    same(back('1/(s (s + 2)^2)'), (t) => 0.25 - 0.25 * Math.exp(-2 * t) - 0.5 * t * Math.exp(-2 * t));
  });

  it('gets a repeated pair of complex roots right', () => {
    // 1/(s²+1)² = (sin t − t cos t)/2.
    same(back('1/(s^2 + 1)^2'), (t) => (Math.sin(t) - t * Math.cos(t)) / 2);
  });

  it('comes back from a damped oscillation', () => {
    same(back('1/(s^2 + 2s + 5)'), (t) => (Math.exp(-t) * Math.sin(2 * t)) / 2);
  });

  it('comes back from a delay as a function that is nothing until it starts', () => {
    const fn = back('e^{-2s}/s');
    expect(at(fn, 1)).toBe(0);
    expect(at(fn, 3)).toBeCloseTo(1, 9);
    const ramp = back('e^{-1s}/s^2');
    expect(at(ramp, 0.5)).toBe(0);
    expect(at(ramp, 4)).toBeCloseTo(3, 9);
  });

  it('gives back an impulse where the fraction is top-heavy, rather than a curve', () => {
    const fn = got(inverse(got(readRat(node('(s + 2)/(s + 1)')))));
    expect(fn.impulses).toEqual([{ c: 1, at: 0 }]);
    expect(at(fn, 2)).toBeCloseTo(Math.exp(-2), 9);
  });

  it('goes out and comes back as what it started as', () => {
    for (const source of ['t^2 e^{-t}', '\\sin(3t)', '4 - t + e^{-2t}', 't\\cos(t)']) {
      const there = got(transform(node(source)));
      const home = got(inverse(there));
      const f = got(readFn(node(source), 't'));
      for (const t of [0.3, 1.1, 2.6]) expect(at(home, t)).toBeCloseTo(at(f, t), 7);
    }
  });
});

describe('what it refuses, and says', () => {
  it('names the function it has no row for', () => {
    expect(fault(transform(node('\\ln(t)')))).toMatch(/ln/);
    expect(fault(transform(node('\\tan(t)')))).toMatch(/tan/);
  });

  it('refuses to divide by something with t in it', () => {
    expect(fault(transform(node('1/t')))).toMatch(/Dividing/);
  });

  it('refuses a letter with no value rather than treating it as zero', () => {
    expect(fault(transform(node('k e^{-t}')))).toMatch(/k has no value/);
    expect(got(transform(node('k e^{-t}'), 't', { vars: { k: 3 } }))).toHaveLength(1);
  });

  it('refuses a transform that would grow', () => {
    expect(fault(readRat(node('e^{2s}/s')))).toMatch(/cannot grow/);
  });

  it('says so rather than drawing the slope of an impulse', () => {
    expect(fault(inverse(got(readRat(node('s^2/(s + 1)')))))).toMatch(/impulse/);
  });
});

describe('reading an equation off the list', () => {
  const scope = {};
  it('reads the coefficients off whatever shape they were written in', () => {
    expect(got(linearOde(node('-4y'), 'x', scope))).toMatchObject({ a: -4, b: 0 });
    expect(got(linearOde(node("-y - 0.15 y'"), 'x', scope))).toMatchObject({ a: -1, b: -0.15 });
    expect(got(linearOde(node("-(y + 3y')/2"), 'x', scope))).toMatchObject({ a: -0.5, b: -1.5 });
  });

  it('separates the forcing from the equation', () => {
    const it = got(linearOde(node("-y - 0.2y' + \\sin(x)"), 'x', scope));
    expect(it.a).toBeCloseTo(-1, 12);
    expect(it.b).toBeCloseTo(-0.2, 12);
    agrees(forward(got(readFn(it.force, 'x'))), (s) => 1 / (s ** 2 + 1));
  });

  it('refuses one that is not straight in y rather than solving it wrongly', () => {
    expect(fault(linearOde(node('0.6 y (1 - y/40)'), 'x', scope))).toMatch(/straight/);
    expect(fault(linearOde(node('y^2'), 'x', scope))).toMatch(/straight/);
  });
});

describe('solving one exactly', () => {
  const solve = (body: string, order: 1 | 2, y0: number, v0 = 0) =>
    got(exactly({ body: node(body), of: 'x', order, y0, v0, scope: {} }));

  it('solves the one everybody knows', () => {
    const fn = solve('y', 1, 1);
    for (const t of [0, 0.5, 1, 2.3]) expect(at(fn, t)).toBeCloseTo(Math.exp(t), 9);
    expect(latexFn(fn, 'x')).toBe('e^{x}');
  });

  it('solves a spring as the cosine it is', () => {
    const fn = solve('-4y', 2, 1, 0);
    for (const t of [0, 0.4, 1.9, 5.2]) expect(at(fn, t)).toBeCloseTo(Math.cos(2 * t), 9);
    expect(latexFn(fn, 'x')).toBe('\\cos(2x)');
  });

  it('carries a starting speed into the answer', () => {
    // y'' = -4y from y(0) = 0, y'(0) = 6 is 3 sin 2t.
    const fn = solve('-4y', 2, 0, 6);
    for (const t of [0.3, 1.2, 4]) expect(at(fn, t)).toBeCloseTo(3 * Math.sin(2 * t), 9);
  });

  it('solves a forced equation, which is where the method earns its keep', () => {
    // y' = -y + 1 from 0 is 1 − e^{-t}.
    const fn = solve('-y + 1', 1, 0);
    for (const t of [0.2, 1.5, 4]) expect(at(fn, t)).toBeCloseTo(1 - Math.exp(-t), 9);
  });

  it('solves one driven at its own frequency, and shows the growth that causes', () => {
    // y'' = -y + sin x from rest is (sin t − t cos t)/2 — resonance.
    const fn = solve('-y + \\sin(x)', 2, 0, 0);
    for (const t of [0.5, 2.2, 6]) expect(at(fn, t)).toBeCloseTo((Math.sin(t) - t * Math.cos(t)) / 2, 7);
  });

  it('agrees with the curve the app walks, which is the check that matters', () => {
    // Two methods that share no code: this one transforms and inverts, and
    // `lib/ode.ts` takes four thousand Runge–Kutta steps. Agreeing to six
    // places is the evidence; either alone is an assertion.
    const spring = got(exactly({ body: node("-y - 0.15 y'"), of: 'x', order: 2, y0: 4, v0: 0, scope: {} }));
    const walked = second((_x, y, v) => -y - 0.15 * v, { x: 0, y: 4, v: 0 }, { x0: 0, x1: 12, y0: -9, y1: 9 }, 4000);
    expect(walked.length).toBeGreaterThan(200);
    for (const p of walked.filter((_, i) => i % 313 === 0)) expect(at(spring, p.x)).toBeCloseTo(p.y, 6);

    const cooling = got(exactly({ body: node('-0.5y + 2'), of: 'x', order: 1, y0: 1, v0: 0, scope: {} }));
    const path = walk(rateOf(node('-0.5y + 2'), {}), { x: 0, y: 1 }, 6, 3000, { low: -1e6, high: 1e6 });
    for (const p of path.filter((_, i) => i % 401 === 0)) expect(at(cooling, p.x)).toBeCloseTo(p.y, 7);
  });

  it('refuses when the conditions do not make it linear', () => {
    expect(fault(exactly({ body: node('y^2'), of: 'x', order: 1, y0: 1, v0: 0, scope: {} }))).toMatch(/straight/);
  });
});

describe('writing it down', () => {
  it('writes a transform as the fraction it is', () => {
    expect(latexTransform(L('t^2'))).toBe('\\frac{2}{s^{3}}');
    expect(latexTransform(L('\\sin(3t)'))).toBe('\\frac{3}{s^{2} + 9}');
    expect(latexTransform(L('e^{-2t}'))).toBe('\\frac{1}{s + 2}');
    expect(latexTransform(L('u(t - 2)'))).toBe('e^{-2s}\\frac{1}{s}');
    expect(latexTransform(L('δ(t - 1)'))).toBe('e^{-1s}1');
  });

  it('writes a function of t the way somebody would', () => {
    expect(latexFn(got(inverse(L('t^2 e^{-t}'))))).toBe('t^{2}e^{-t}');
    expect(latexFn(back('1/(s^2 + 4)'))).toBe('0.5\\sin(2t)');
    expect(latexFn(back('1/((s + 1)(s + 2))'))).toBe('e^{-t} - e^{-2t}');
    expect(latexFn(back('1/(s(s + 2)^2)'))).toBe('0.25 - 0.5te^{-2t} - 0.25e^{-2t}');
  });

  it('writes a delayed answer with the step that switches it on', () => {
    expect(latexFn(back('e^{-2s}/s'))).toBe('1\\,u(t - 2)');
  });

  it('writes nothing as nothing rather than as an empty string', () => {
    expect(latexFn({ terms: [], impulses: [] })).toBe('0');
  });
});

describe('the denominator, as it was built rather than as it multiplies out', () => {
  it('keeps a repeated factor whole', () => {
    expect(latexTransform(L('t^2 e^{-t}'))).toBe('\\frac{2}{(s + 1)^{3}}');
    expect(latexTransform(L('t e^{2t}'))).toBe('\\frac{1}{(s - 2)^{2}}');
    expect(latexTransform(L('t^3'))).toBe('\\frac{6}{s^{4}}');
  });

  it('keeps two different factors apart', () => {
    expect(latexTransform(L('1 + e^{-t}'))).toBe('\\frac{2s + 1}{s(s + 1)}');
  });

  it('leaves a single plain factor without brackets round it', () => {
    expect(latexTransform(L('e^{-2t}'))).toBe('\\frac{1}{s + 2}');
    expect(latexTransform(L('\\sin(3t)'))).toBe('\\frac{3}{s^{2} + 9}');
  });
});

/**
 * Convolution, against integrals somebody can do by hand.
 *
 * The convolution theorem is worth having because the integral is awkward and
 * the product is not — which is exactly why an answer got the easy way has to
 * be checked against the hard one. Every case here has a closed form worked
 * from `∫₀ᵗ f(τ)g(t − τ) dτ`, and the last one is checked against the integral
 * itself, worked numerically by Simpson's rule in the test rather than in the
 * app, so the two methods share nothing.
 */
describe('convolution', () => {
  const same = (source: string, f: (t: number) => number, ts = [0.3, 1.2, 2.8]) => {
    const fn = got(readFn(node(source), 't'));
    for (const t of ts) expect(at(fn, t)).toBeCloseTo(f(t), 8);
  };

  it('convolves two constants into the ramp it is', () => {
    // ∫₀ᵗ 1 dτ = t, and no t is written anywhere in it.
    same('conv(1, 1)', (t) => t);
    same('conv(2, 3)', (t) => 6 * t);
  });

  it('does the one every textbook sets, and writes it the way the textbook does', () => {
    // ∫₀ᵗ τ e^{-(t-τ)} dτ = t - 1 + e^{-t}.
    same('conv(t, e^{-t})', (t) => t - 1 + Math.exp(-t));
    expect(latexFn(got(readFn(node('conv(t, e^{-t})'), 't')))).toBe('t - 1 + e^{-t}');
  });

  it('convolves two waves, where the answer is not a wave', () => {
    // sin t * sin t = (sin t − t cos t)/2.
    same('conv(\\sin(t), \\sin(t))', (t) => (Math.sin(t) - t * Math.cos(t)) / 2);
  });

  it('leaves a function alone when convolved with an impulse', () => {
    same('conv(δ(t), e^{-2t})', (t) => Math.exp(-2 * t));
    same('conv(δ(t - 1), 1)', (t) => (t >= 1 ? 1 : 0), [0.5, 1.5, 3]);
  });

  it('adds the delays, because a thing switched on later starts later', () => {
    const fn = got(readFn(node('conv(u(t - 2), u(t - 3))'), 't'));
    expect(at(fn, 4)).toBe(0);
    expect(at(fn, 8)).toBeCloseTo(3, 8);
  });

  it('is a product once it is transformed, which is the theorem', () => {
    agrees(L('conv(t, e^{-t})'), (s) => (1 / s ** 2) * (1 / (s + 1)));
    agrees(L('conv(\\sin(2t), e^{-t})'), (s) => (2 / (s ** 2 + 4)) * (1 / (s + 1)));
  });

  it('agrees with the integral it is defined as', () => {
    // Simpson's rule over ∫₀ᵗ f(τ)g(t − τ) dτ, worked here rather than in the
    // app: if the two agree the app is not being checked against itself.
    const f = (x: number) => x * Math.exp(-x);
    const g = (x: number) => Math.cos(2 * x);
    const integral = (t: number) => {
      const n = 2000;
      const h = t / n;
      let out = f(0) * g(t) + f(t) * g(0);
      for (let i = 1; i < n; i += 1) out += (i % 2 ? 4 : 2) * f(i * h) * g(t - i * h);
      return (out * h) / 3;
    };
    const fn = got(readFn(node('conv(t e^{-t}, \\cos(2t))'), 't'));
    for (const t of [0.7, 1.9, 3.4]) expect(at(fn, t)).toBeCloseTo(integral(t), 7);
  });

  it('says what it wants rather than guessing at one argument', () => {
    expect(fault(readFn(node('conv(t)'), 't'))).toMatch(/two functions/);
  });
});

describe('poles, and what they say', () => {
  it('finds them where they are', () => {
    expect(poles(L('e^{-2t}'))).toEqual([{ re: -2, im: 0 }]);
    expect(poles(L('\\sin(3t)'))).toEqual([
      { re: 0, im: 3 },
      { re: 0, im: -3 },
    ]);
  });

  it('counts a repeated pole as many times as it repeats', () => {
    expect(poles(L('t^2 e^{-t}'))).toEqual([
      { re: -1, im: 0 },
      { re: -1, im: 0 },
      { re: -1, im: 0 },
    ]);
  });

  it('counts a conjugate pair as the two poles it is, not the one it is written as', () => {
    expect(poleText(poles(L('\\sin(3t)')))).toMatch(/^Poles at 3i/);
    expect(poleText(poles(L('e^{-2t}')))).toMatch(/^Pole at -2/);
  });

  it('says whether the thing settles, which is what they are read for', () => {
    expect(poleText(poles(L('e^{-2t}')))).toBe('Pole at -2 — all left of the axis, so it settles.');
    expect(poleText(poles(L('e^{2t}')))).toMatch(/runs away/);
    expect(poleText(poles(L('\\sin(3t)')))).toMatch(/neither settles nor runs away/);
    expect(poleText(poles(L('e^{-t}\\sin(2t)')))).toBe('Poles at -1 ± 2i — all left of the axis, so it settles.');
  });
});

describe('the transfer function', () => {
  const of = (body: string, order: 1 | 2) =>
    got(transferOf({ body: node(body), of: 'x', order, scope: {} }));

  it('is the equation written as what it does to an input', () => {
    expect(latexTransform(of("-y - 0.3y'", 2))).toBe('\\frac{1}{s^{2} + 0.3s + 1}');
    expect(latexTransform(of('-4y', 2))).toBe('\\frac{1}{s^{2} + 4}');
    expect(latexTransform(of('-0.5y', 1))).toBe('\\frac{1}{s + 0.5}');
  });

  it('has nothing to do with the conditions, because a system is not a run', () => {
    expect(latexTransform(of("-y - 0.3y' + \\sin(x)", 2))).toBe('\\frac{1}{s^{2} + 0.3s + 1}');
  });

  it('reads as stable exactly when the equation settles', () => {
    expect(poleText(poles(of("-y - 0.3y'", 2)))).toMatch(/settles/);
    expect(poleText(poles(of('-4y', 2)))).toMatch(/neither/);
    expect(poleText(poles(of('y', 1)))).toMatch(/runs away/);
  });

  it('inverts to the impulse response', () => {
    // 1/(s² + 4) back is sin(2t)/2, which is what the spring does when kicked.
    const h = got(inverse(of('-4y', 2)));
    for (const t of [0.4, 1.6]) expect(at(h, t)).toBeCloseTo(Math.sin(2 * t) / 2, 9);
  });

  it('refuses an equation that has none rather than inventing one', () => {
    expect(fault(transferOf({ body: node('y^2'), of: 'x', order: 1, scope: {} }))).toMatch(/straight/);
  });
});
