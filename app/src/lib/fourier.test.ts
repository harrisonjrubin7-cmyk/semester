import { describe, expect, it } from 'vitest';
import { read } from './calc';
import { latexSpectrum, sizeAt, spectrumOf } from './fourier';
import { dft, idft, loudest, samplesOf, seriesOf, sizeOf, slowDft } from './fourier';
import {
  HARMONICS,
  amplitude,
  harmonicsOf,
  latexSeries,
  partial,
  sampler,
  spectrumAt,
} from './fourier';

/**
 * Harmonics against the ones a textbook prints.
 *
 * Every series here has coefficients somebody can write down — `4/n\pi` for
 * the square wave, `2(-1)^{n+1}/n` for the sawtooth — and they are checked to
 * eight places, which is the point of finding the jumps rather than
 * integrating straight through them. Four places would pass a version of this
 * file that was quietly wrong.
 */

const node = (source: string) => {
  const got = read(source);
  if (!got.ok) throw new Error(`${source}: ${got.fault}`);
  return got.node;
};
const f = (source: string) => sampler(node(source), 't', {});
const got = <T,>(r: { ok: true; it: T } | { ok: false; fault: string }): T => {
  if (!r.ok) throw new Error(r.fault);
  return r.it;
};
const fault = (r: { ok: boolean; fault?: string }): string => {
  if (r.ok) throw new Error('that was meant to be refused');
  return r.fault ?? '';
};

describe('the square wave, which is the one with the jumps in it', () => {
  const series = harmonicsOf(f('\\text{sign}(\\sin(t))'), 2 * Math.PI, 9);

  it('has the odd sine coefficients a textbook prints, to eight places', () => {
    // b_n = 4/(nπ) for odd n, and nothing else at all.
    for (const h of series.terms) {
      const want = h.n % 2 ? 4 / (h.n * Math.PI) : 0;
      expect(h.b).toBeCloseTo(want, 8);
      expect(h.a).toBeCloseTo(0, 8);
    }
    expect(series.mean).toBeCloseTo(0, 9);
  });

  it('gets there because the jump is found, not integrated through', () => {
    // Simpson straight across a step is first order: b_1 would be right to
    // about four figures. This pins the difference.
    expect(series.terms[0].b).toBeCloseTo(4 / Math.PI, 9);
  });

  it('adds up to the wave it came from, away from the jumps', () => {
    const many = harmonicsOf(f('\\text{sign}(\\sin(t))'), 2 * Math.PI, 80);
    for (const t of [0.8, 2.1, 4.3, 5.6]) {
      expect(partial(many, t)).toBeCloseTo(Math.sign(Math.sin(t)), 1);
    }
  });

  it('overshoots at the jump, which is Gibbs and is not a mistake', () => {
    // The Wilbraham–Gibbs constant: the first peak of the partial sum settles
    // on (2/π)Si(π) = 1.178980, however many terms are taken, and a series
    // that did not overshoot would be the wrong series.
    const gibbs = 1.1789797;
    for (const count of [30, 60, 120]) {
      const many = harmonicsOf(f('\\text{sign}(\\sin(t))'), 2 * Math.PI, count);
      let top = 0;
      const window = (2 * Math.PI) / count;
      for (let i = 0; i <= 600; i += 1) top = Math.max(top, partial(many, (i / 600) * window));
      expect(top).toBeCloseTo(gibbs, 3);
    }
  });
});

describe('the ones without jumps', () => {
  it('takes the sawtooth over the interval a textbook states', () => {
    // t on (-π, π): b_n = 2(-1)^{n+1}/n, and no cosines at all.
    const series = harmonicsOf(f('t'), 2 * Math.PI, 6);
    for (const h of series.terms) {
      expect(h.b).toBeCloseTo((2 * (-1) ** (h.n + 1)) / h.n, 8);
      expect(h.a).toBeCloseTo(0, 8);
    }
  });

  it('takes an even function as cosines, with the average out in front', () => {
    // t² on (-π, π): mean π²/3, a_n = 4(-1)^n/n².
    const series = harmonicsOf(f('t^2'), 2 * Math.PI, 5);
    expect(series.mean).toBeCloseTo(Math.PI ** 2 / 3, 8);
    for (const h of series.terms) {
      expect(h.a).toBeCloseTo((4 * (-1) ** h.n) / h.n ** 2, 8);
      expect(h.b).toBeCloseTo(0, 8);
    }
  });

  it('gives a wave back as itself and nothing else', () => {
    const series = harmonicsOf(f('3\\sin(2t)'), 2 * Math.PI, 5);
    expect(series.terms[1].b).toBeCloseTo(3, 9);
    for (const h of series.terms) if (h.n !== 2) expect(amplitude(h)).toBeCloseTo(0, 8);
  });

  it('works at a period that is not 2π', () => {
    // sign(sin(πt)) has period 2, and the same 4/(nπ) coefficients.
    const series = harmonicsOf(f('\\text{sign}(\\sin(\\pi t))'), 2, 5);
    expect(series.terms[0].b).toBeCloseTo(4 / Math.PI, 8);
    expect(series.terms[2].b).toBeCloseTo(4 / (3 * Math.PI), 8);
  });

  it('takes a rectified sine, which is a corner rather than a jump', () => {
    // |sin t| has period π: mean 2/π, a_n = -4/(π(4n² - 1)).
    const series = harmonicsOf(f('|\\sin(t)|'), Math.PI, 4);
    expect(series.mean).toBeCloseTo(2 / Math.PI, 8);
    for (const h of series.terms) {
      expect(h.a).toBeCloseTo(-4 / (Math.PI * (4 * h.n ** 2 - 1)), 8);
    }
  });

  it('ships a sensible number of harmonics when nobody says', () => {
    expect(harmonicsOf(f('t'), 2 * Math.PI).terms).toHaveLength(HARMONICS);
  });
});

describe('writing a series down', () => {
  it('writes the square wave the way it is printed', () => {
    const series = harmonicsOf(f('\\text{sign}(\\sin(t))'), 2 * Math.PI, 9);
    expect(latexSeries(series)).toBe(
      '1.27324\\sin(t) + 0.424413\\sin(3t) + 0.254648\\sin(5t) + 0.181891\\sin(7t) + 0.141471\\sin(9t)',
    );
    expect(latexSeries(series, 't', 3)).toBe(
      '1.27324\\sin(t) + 0.424413\\sin(3t) + 0.254648\\sin(5t) + \\cdots',
    );
  });

  it('puts the average first where there is one', () => {
    expect(latexSeries(harmonicsOf(f('t^2'), 2 * Math.PI, 2), 't', 3)).toBe(
      '3.28987 - 4\\cos(t) + \\cos(2t)',
    );
  });

  it('writes a frequency as the multiple of π it is', () => {
    expect(latexSeries(harmonicsOf(f('\\text{sign}(\\sin(\\pi t))'), 2, 5), 't', 2)).toBe(
      '1.27324\\sin(\\pi t) + 0.424413\\sin(3\\pi t) + \\cdots',
    );
  });

  it('says nothing rather than a run of zeros', () => {
    expect(latexSeries(harmonicsOf(f('0 t'), 2 * Math.PI, 3))).toBe('0');
  });
});

/**
 * The transform, against the four rows everybody meets — and the refusals,
 * which are the part that keeps it honest.
 */
describe('the transform', () => {
  const F = (source: string) => got(spectrumOf(node(source), 't'));
  const size = (source: string, w: number) => {
    const s = F(source);
    return sizeAt(s.rat, w, s.even);
  };

  it('takes a decaying exponential', () => {
    // F(ω) = 1/(2 + iω), so |F| = 1/√(4 + ω²).
    for (const w of [0, 1.3, 4]) expect(size('e^{-2t}', w)).toBeCloseTo(1 / Math.hypot(2, w), 10);
    expect(latexSpectrum(F('e^{-2t}').rat)).toBe('\\frac{1}{i\\omega + 2}');
  });

  it('takes a two-sided one, which is its own half read twice', () => {
    // e^{-|t|} → 2/(1 + ω²), real and even.
    for (const w of [0, 0.7, 2.5]) expect(size('e^{-|t|}', w)).toBeCloseTo(2 / (1 + w * w), 10);
    const s = F('e^{-|t|}');
    expect(s.even).toBe(true);
    expect(spectrumAt(s.rat, 1.4, true).im).toBe(0);
  });

  it('is symmetric about zero, the way a real signal spectrum is', () => {
    for (const w of [0.5, 2, 6]) expect(size('e^{-t}\\sin(3t)', w)).toBeCloseTo(size('e^{-t}\\sin(3t)', -w), 12);
  });

  it('peaks where the signal rings', () => {
    // e^{-0.1t}sin(5t) is a slow-dying wobble at five, so its spectrum has a
    // spike there and very little elsewhere.
    expect(size('e^{-0.1t}\\sin(5t)', 5)).toBeGreaterThan(20 * size('e^{-0.1t}\\sin(5t)', 1));
  });

  it('turns the phase for a delay and leaves the size alone', () => {
    const plain = F('e^{-2t}');
    const late = F('e^{-2(t - 3)} u(t - 3)');
    for (const w of [0.4, 2.2]) {
      expect(sizeAt(late.rat, w)).toBeCloseTo(sizeAt(plain.rat, w), 9);
    }
  });

  it('refuses a signal that never dies away rather than half-answering', () => {
    expect(fault(spectrumOf(node('1'), 't'))).toMatch(/impulse in frequency/);
    expect(fault(spectrumOf(node('\\sin(t)'), 't'))).toMatch(/impulse in frequency/);
    expect(fault(spectrumOf(node('t'), 't'))).toMatch(/impulse in frequency/);
  });

  it('refuses one that grows, and says which', () => {
    expect(fault(spectrumOf(node('e^{2t}'), 't'))).toMatch(/grows rather than settles/);
  });

  it('passes a fault about the family straight through', () => {
    expect(fault(spectrumOf(node('\\ln(t)'), 't'))).toMatch(/ln/);
  });
});

/**
 * The discrete transform, against answers that can be written out by hand and
 * against itself computed the slow way.
 *
 * A DFT is finite and exact, so unlike the two above there is nothing to
 * approximate and no tolerance to argue about: an impulse transforms to a flat
 * spectrum, a constant to a single spike, and a cosine to two. The fast method
 * and the definition are checked against each other because a fast method that
 * quietly disagreed with its own definition is the one bug here that would
 * never show itself on a picture.
 */
describe('the discrete transform', () => {
  const sizes = (xs: number[]) => dft(xs).map(sizeOf);

  it('turns one spike into a flat spectrum, and a flat run into one spike', () => {
    expect(sizes([1, 0, 0, 0])).toEqual([1, 1, 1, 1]);
    expect(sizes([1, 1, 1, 1])).toEqual([4, 0, 0, 0]);
    expect(sizes([2, 2, 2, 2, 2, 2, 2, 2])[0]).toBe(16);
  });

  it('puts a cosine in the two bins it belongs in, and nowhere else', () => {
    // cos(2π·2n/16) is two cycles across sixteen samples: bins 2 and 14, at N/2.
    const xs = Array.from({ length: 16 }, (_, n) => Math.cos((2 * Math.PI * 2 * n) / 16));
    const got = sizes(xs);
    expect(got[2]).toBeCloseTo(8, 9);
    expect(got[14]).toBeCloseTo(8, 9);
    got.forEach((v, k) => {
      if (k !== 2 && k !== 14) expect(v).toBeCloseTo(0, 9);
    });
  });

  it('is symmetric about the middle, because the data is real', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6];
    const got = sizes(xs);
    for (let k = 1; k < xs.length / 2; k += 1) expect(got[k]).toBeCloseTo(got[xs.length - k], 12);
  });

  it('agrees with its own definition, which is what the fast one has to do', () => {
    for (const n of [8, 16, 64]) {
      const xs = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) + 0.3 * i - 2);
      const fast = dft(xs);
      const slow = slowDft(xs.map((v) => ({ re: v, im: 0 })));
      fast.forEach((b, k) => {
        expect(b.re).toBeCloseTo(slow[k].re, 9);
        expect(b.im).toBeCloseTo(slow[k].im, 9);
      });
    }
    // And at a count the fast one cannot take, so the fallback is exercised.
    const odd = [1, 2, 3, 4, 5, 6];
    expect(dft(odd).map((b) => b.re)).toEqual(slowDft(odd.map((v) => ({ re: v, im: 0 }))).map((b) => b.re));
  });

  it('goes out and comes back as what it started as', () => {
    for (const xs of [[1, 0, -1, 0], [3, -1, 4, 1, -5, 9, 2, 6], [2, 7, 1, 8, 2, 8]]) {
      idft(dft(xs)).forEach((v, i) => expect(v).toBeCloseTo(xs[i], 9));
    }
  });

  it('keeps the energy it was given, which is Parseval', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6];
    const there = xs.reduce((t, v) => t + v * v, 0);
    const back = dft(xs).reduce((t, b) => t + sizeOf(b) ** 2, 0) / xs.length;
    expect(back).toBeCloseTo(there, 9);
  });

  it('reads out as the waves it is, in the notation the series uses', () => {
    const xs = Array.from({ length: 8 }, (_, n) => 2 + 3 * Math.cos((2 * Math.PI * n) / 8));
    const series = seriesOf(xs);
    expect(series.mean).toBeCloseTo(2, 9);
    expect(series.terms[0].a).toBeCloseTo(3, 9);
    expect(series.terms[0].b).toBeCloseTo(0, 9);
    for (const h of series.terms.slice(1)) expect(amplitude(h)).toBeCloseTo(0, 9);
  });

  it('sums back through the samples exactly, which a series of data must', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6];
    const series = seriesOf(xs);
    xs.forEach((v, n) => expect(partial(series, n)).toBeCloseTo(v, 9));
  });

  it('names the biggest frequency in it', () => {
    const xs = Array.from({ length: 32 }, (_, n) => Math.sin((2 * Math.PI * 5 * n) / 32) + 0.1 * Math.cos((2 * Math.PI * 11 * n) / 32));
    expect(loudest(xs)?.k).toBe(5);
    expect(loudest([1, 1, 1, 1])?.k).toBeUndefined();
  });

  it('asks for data rather than guessing at a formula', () => {
    const say = (source: string, count: string | null) => {
      const got = samplesOf(node(source), count ? node(count) : null, {});
      return got.ok ? got.it : got.fault;
    };
    expect(say('[1, 0, -1, 0]', null)).toEqual([1, 0, -1, 0]);
    expect(say('\\cos(n)', null)).toMatch(/wants the data/);
    expect(say('[1]', null)).toMatch(/fewest/);
    expect(say('\\cos(0)n', '4')).toEqual([0, 1, 2, 3]);
    expect(say('n', '2.5')).toMatch(/whole number/);
    expect(say('1/n', '4')).toMatch(/no value at n = 0/);
  });
});
