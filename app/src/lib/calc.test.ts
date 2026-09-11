import { describe, expect, it } from 'vitest';
import { calculate, free, read, text, value, type Val } from './calc';

/**
 * A calculator that lies is worse than no calculator.
 *
 * Everything here is a number somebody would hand in. The cases that matter
 * most are the quiet ones — a minus sign that binds the wrong way, a fraction
 * read upside down, a percentage that is a hundred times out — because those
 * do not look like faults on the screen. They look like answers.
 */

const num = (source: string, vars: Record<string, Val> = {}, degrees = false): Val => {
  const got = calculate(source, { vars, degrees });
  if ('fault' in got) throw new Error(`${source}: ${got.fault}`);
  return got.value;
};

const close = (source: string, want: number, vars: Record<string, Val> = {}) =>
  expect(num(source, vars) as number).toBeCloseTo(want, 9);

describe('the arithmetic', () => {
  it('works out the ordinary operators', () => {
    expect(num('2 + 3 * 4')).toBe(14);
    expect(num('(2 + 3) * 4')).toBe(20);
    expect(num('10 / 4')).toBe(2.5);
    expect(num('2^10')).toBe(1024);
  });

  it('takes powers to the right and the minus sign in front of them', () => {
    expect(num('2^3^2')).toBe(512);
    expect(num('-3^2')).toBe(-9);
    expect(num('(-3)^2')).toBe(9);
    expect(num('10^-3')).toBeCloseTo(0.001, 12);
  });

  it('reads a negative base to an odd root the way an algebra course does', () => {
    // IEEE-754 says NaN; every textbook says −2, and a curve that vanishes for
    // all negative x is the visible form of that disagreement.
    close('(-8)^(1/3)', -2);
    expect(num('(-8)^(1/2)')).toBeNaN();
  });

  it('multiplies what nobody wrote a sign between', () => {
    expect(num('2x', { x: 5 })).toBe(10);
    expect(num('3(1 + 1)')).toBe(6);
    expect(num('(1 + 1)(1 + 2)')).toBe(6);
    expect(num('2\\pi')).toBeCloseTo(Math.PI * 2, 12);
  });

  it('treats letters written together as one name, and a space as a product', () => {
    expect(num('PV', { PV: 40 })).toBe(40);
    expect(num('a b', { a: 3, b: 4 })).toBe(12);
    expect(num('a sin(0) + 1', { a: 9 })).toBe(1);
  });

  it('reads a percentage as a hundredth, not as a modulus', () => {
    expect(num('5%')).toBeCloseTo(0.05, 12);
    expect(num('200 * 15%')).toBeCloseTo(30, 12);
  });

  it('reads a factorial and refuses the halves', () => {
    expect(num('5!')).toBe(120);
    expect(num('0!')).toBe(1);
    expect(num('2.5!')).toBeNaN();
  });

  it('reads the bars as an absolute value', () => {
    expect(num('|3 - 10|')).toBe(7);
    expect(num('2|x|', { x: -4 })).toBe(8);
    expect(num('|a||b|', { a: -2, b: -3 })).toBe(6);
  });
});

describe('the notation the app already writes', () => {
  it('reads a fraction', () => {
    expect(num('\\frac{1}{4}')).toBe(0.25);
    expect(num('\\frac{a + b}{2}', { a: 3, b: 7 })).toBe(5);
  });

  it('reads a root, a log and a trigonometric function without brackets', () => {
    expect(num('\\sqrt{16}')).toBe(4);
    expect(num('\\sqrt 9')).toBe(3);
    expect(num('\\log_2 8')).toBeCloseTo(3, 12);
    expect(num('log(1000)')).toBeCloseTo(3, 12);
    expect(num('sin 0 + 1')).toBe(1);
  });

  it('reads the greek out of the same table the renderer draws from', () => {
    expect(num('2\\sigma', { σ: 3 })).toBe(6);
    expect(num('\\mu + 1', { μ: 10 })).toBe(11);
  });

  it('reads a subscripted name as a name, which is how the formulas are written', () => {
    expect(num('P_2 - P_1', { P_2: 9, P_1: 4 })).toBe(5);
    expect(num('Q_{max} / 2', { Q_max: 10 })).toBe(5);
  });

  it('reads a word as a variable, so a named formula can be filled in', () => {
    expect(num('\\text{Nominal} / 2', { Nominal: 50 })).toBe(25);
  });

  it('reads the ± as notation rather than picking one of its answers', () => {
    const got = calculate('3 \\pm 1');
    expect('fault' in got).toBe(true);
  });

  it('works the term after a sum, not the line', () => {
    expect(num('\\sum_{i=1}^{4} i')).toBe(10);
    expect(num('\\sum_{i=1}^{3} i^2 + 1')).toBe(15);
    expect(num('\\prod_{i=1}^{4} i')).toBe(24);
  });

  it('sums a present value the way a business course writes it', () => {
    // NPV of £100 a year for three years at 10%, discounted from t = 1.
    close('\\sum_{t=1}^{3} \\frac{C}{(1 + r)^t}', 100 / 1.1 + 100 / 1.21 + 100 / 1.331, {
      C: 100,
      r: 0.1,
    });
  });

  it('has an empty sum come to nothing and an empty product to one', () => {
    expect(num('\\sum_{i=1}^{0} i')).toBe(0);
    expect(num('\\prod_{i=1}^{0} i')).toBe(1);
  });
});

describe('the formulas the app ships', () => {
  it('works the midpoint elasticity', () => {
    // 50/125 over −2/9: elastic, and negative, as demand is.
    close('((Q_2 - Q_1)/((Q_2 + Q_1)/2)) / ((P_2 - P_1)/((P_2 + P_1)/2))', -1.8, {
      Q_1: 100,
      Q_2: 150,
      P_1: 10,
      P_2: 8,
    });
  });

  it('works a present value', () => {
    close('\\frac{FV}{(1 + r)^n}', 1000 / 1.05 ** 3, { FV: 1000, r: 0.05, n: 3 });
  });

  it('works a break-even quantity', () => {
    expect(num('\\frac{F}{P - V}', { F: 4000, P: 25, V: 15 })).toBe(400);
  });

  it('works a z-score', () => {
    expect(num('\\frac{x - \\mu}{\\sigma}', { x: 74, μ: 68, σ: 3 })).toBe(2);
  });

  it('works a margin of error', () => {
    close('z \\sqrt{\\frac{p(1 - p)}{n}}', 1.96 * Math.sqrt((0.52 * 0.48) / 1000), {
      z: 1.96,
      p: 0.52,
      n: 1000,
    });
  });
});

describe('lists', () => {
  it('reads a list and the run written with a …', () => {
    expect(num('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(num('[1, ..., 5]')).toEqual([1, 2, 3, 4, 5]);
    expect(num('[0, 0.5, ..., 2]')).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it('works arithmetic over every member of one', () => {
    expect(num('2 * [1, 2, 3]')).toEqual([2, 4, 6]);
    expect(num('[1, 2, 3] + [10, 20, 30]')).toEqual([11, 22, 33]);
  });

  it('refuses two lists of different lengths rather than truncating the longer', () => {
    expect(num('[1, 2, 3] + [1, 2]')).toBeNaN();
  });

  it('summarises one', () => {
    expect(num('mean([2, 4, 9])')).toBe(5);
    expect(num('median([3, 1, 2])')).toBe(2);
    expect(num('total([1, 2, 3])')).toBe(6);
    expect(num('count([1, 2, 3])')).toBe(3);
    close('stdev([2, 4, 4, 4, 5, 5, 7, 9])', 2.13808993529939);
    close('stdevp([2, 4, 4, 4, 5, 5, 7, 9])', 2);
  });

  it('takes a list from a binding, which is what a slider over a family does', () => {
    expect(num('a^2', { a: [1, 2, 3] })).toEqual([1, 4, 9]);
  });
});

describe('the functions', () => {
  it('does trigonometry in radians, and in degrees when asked', () => {
    close('sin(\\pi / 2)', 1);
    expect(num('sin(90)', {}, true)).toBeCloseTo(1, 12);
    expect(num('cos(180)', {}, true)).toBeCloseTo(-1, 12);
    expect(num('asin(1)', {}, true)).toBeCloseTo(90, 12);
  });

  it('rounds to the places it is given', () => {
    expect(num('round(2.567, 2)')).toBe(2.57);
    expect(num('round(2.4)')).toBe(2);
  });

  it('knows the combinatorics a probability course opens with', () => {
    expect(num('nCr(5, 2)')).toBe(10);
    expect(num('npr(5, 2)')).toBe(20);
  });

  it('takes a modulus that is positive for a negative left-hand side', () => {
    expect(num('mod(-1, 3)')).toBe(2);
  });
});

describe('what it refuses, and how', () => {
  it('never throws, whatever it is given', () => {
    for (const bad of ['', '   ', '2 +', '(1', 'sin(', '\\frac{1}', '1 ] 2', '@@', '[1, ...]']) {
      expect(() => read(bad)).not.toThrow();
      expect(read(bad).ok).toBe(false);
    }
  });

  it('says what is wrong in a sentence rather than a code', () => {
    const got = read('(1 + 2');
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.fault).toMatch(/\)/);
  });

  it('reads an unknown name as a variable rather than as an error', () => {
    const got = read('2 widgets');
    expect(got.ok).toBe(true);
    if (got.ok) expect(free(got.node)).toEqual(['widgets']);
  });

  it('names what is unset, and does not name what is bound or constant', () => {
    const got = read('\\frac{FV}{(1 + r)^n} + \\pi');
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(free(got.node, { vars: { FV: 1 } })).toEqual(['r', 'n']);
      expect(free(got.node, { vars: { FV: 1, r: 0.1, n: 2 } })).toEqual([]);
    }
  });

  it('leaves a counter out of what is unset, since the sum binds it', () => {
    const got = read('\\sum_{i=1}^{n} i x');
    expect(got.ok).toBe(true);
    if (got.ok) expect(free(got.node)).toEqual(['n', 'x']);
  });

  it('comes to nothing rather than to a number where the arithmetic has none', () => {
    expect(num('1/0')).toBe(Infinity);
    expect(num('0/0')).toBeNaN();
    expect(num('ln(-1)')).toBeNaN();
    expect(num('x + 1')).toBeNaN();
  });

  it('stops a definition that stands on itself rather than taking the tab with it', () => {
    const got = read('f(2)');
    expect(got.ok).toBe(true);
    if (got.ok) {
      const self = read('f(x) + 1');
      expect(self.ok).toBe(true);
      if (self.ok) {
        const out = value(got.node, { funs: { f: { params: ['x'], body: self.node } } });
        expect(out).toBeNaN();
      }
    }
  });

  it('refuses a run longer than anybody meant to type', () => {
    expect(num('[1, ..., 100000]')).toBeNaN();
    expect(num('\\sum_{i=1}^{100000} i')).toBeNaN();
  });
});

describe('showing an answer', () => {
  it('rounds off the floating-point tail, as the sheet does', () => {
    expect(text(0.1 + 0.2)).toBe('0.3');
    expect(text(1 / 3)).toBe('0.333333333333');
  });

  it('says nothing rather than NaN', () => {
    expect(text(NaN)).toBe('—');
    expect(text(Infinity)).toBe('∞');
  });

  it('shows a list, and how long a long one is', () => {
    expect(text([1, 2, 3])).toBe('[1, 2, 3]');
    expect(text(Array.from({ length: 20 }, (_, i) => i))).toContain('20 in all');
  });
});
