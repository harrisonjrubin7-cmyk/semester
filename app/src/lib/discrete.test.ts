import { describe, expect, it } from 'vitest';
import { read } from './calc';
import {
  at,
  atZ,
  inverse,
  latexSeq,
  latexZed,
  poleText,
  poles,
  readSeq,
  readZed,
  transform,
  type Zed,
} from './discrete';

/**
 * The z-transform against the table every course prints, and the sequences
 * behind it against ones somebody can count out on their fingers.
 *
 * A sequence is the one thing here that can be checked completely: `0.5^n` is
 * 1, 0.5, 0.25, and if the inverse says otherwise it is wrong, with no
 * tolerance to argue about. So every inverse is checked term by term against
 * the sequence it should be, and the transforms are checked at values of z
 * nobody used to build them.
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
const Z = (source: string) => got(transform(node(source)));
const back = (source: string) => got(inverse(got(readZed(node(source)))));
/** A transform agrees with a formula where it is asked, not where it was built. */
const agrees = (zed: Zed, f: (z: number) => number, zs = [1.7, 2.4, 3.9, 7]) => {
  for (const z of zs) expect(atZ(zed, z)).toBeCloseTo(f(z), 9);
};
/** A sequence is its first beats, and nothing about it is approximate. */
const counts = (seq: ReturnType<typeof back>, want: number[]) => {
  want.forEach((v, n) => expect(at(seq, n)).toBeCloseTo(v, 8));
};

describe('the table, forwards', () => {
  it('takes the four rows everybody memorises', () => {
    agrees(Z('1'), (z) => z / (z - 1));
    agrees(Z('0.5^n'), (z) => z / (z - 0.5));
    agrees(Z('n'), (z) => z / (z - 1) ** 2);
    agrees(Z('δ(n)'), () => 1);
  });

  it('takes a ratio with a power of n on it', () => {
    agrees(Z('n 2^n'), (z) => (2 * z) / (z - 2) ** 2);
    agrees(Z('n^2'), (z) => (z * (z + 1)) / (z - 1) ** 3);
    agrees(Z('n^3'), (z) => (z * (z ** 2 + 4 * z + 1)) / (z - 1) ** 4);
  });

  it('takes an alternating sequence, which is a ratio below zero', () => {
    agrees(Z('(-2)^n'), (z) => z / (z + 2));
    counts(got(readSeq(node('(-2)^n'))) as never, []);
  });

  it('takes a wave on the beat', () => {
    const w = 0.4;
    agrees(Z('\\cos(0.4n)'), (z) => (z * (z - Math.cos(w))) / (z ** 2 - 2 * z * Math.cos(w) + 1));
    agrees(Z('\\sin(0.4n)'), (z) => (z * Math.sin(w)) / (z ** 2 - 2 * z * Math.cos(w) + 1));
  });

  it('takes a wave that dies away, which is the first shift', () => {
    const w = 0.4;
    const r = 0.8;
    agrees(Z('0.8^n \\cos(0.4n)'), (z) => (z * (z - r * Math.cos(w))) / (z ** 2 - 2 * r * z * Math.cos(w) + r ** 2));
  });

  it('takes a delay, which is a power of z on the bottom', () => {
    agrees(Z('δ(n - 3)'), (z) => z ** -3);
    agrees(Z('u(n - 2)'), (z) => z ** -2 * (z / (z - 1)));
  });

  it('writes a delayed sequence from its own start, not from zero', () => {
    // 2^{n-2} switched on at 2, not 2^n switched on at 2.
    agrees(Z('2^{n - 2} u(n - 2)'), (z) => z ** -2 * (z / (z - 2)));
  });

  it('is linear, which is the only property it is used for', () => {
    agrees(Z('3 \\cdot 0.5^n - 2n + 4'), (z) => (3 * z) / (z - 0.5) - (2 * z) / (z - 1) ** 2 + (4 * z) / (z - 1));
  });
});

describe('the table, backwards', () => {
  it('counts out the rows it went out on', () => {
    counts(back('z/(z - 0.5)'), [1, 0.5, 0.25, 0.125, 0.0625]);
    counts(back('z/(z - 1)'), [1, 1, 1, 1]);
    counts(back('z/(z - 1)^2'), [0, 1, 2, 3, 4]);
    counts(back('1'), [1, 0, 0, 0]);
  });

  it('splits a fraction into the sequences it is a sum of', () => {
    // z/((z-1)(z-2)) = 2^n - 1.
    counts(back('z/((z - 1)(z - 2))'), [0, 1, 3, 7, 15]);
  });

  it('gets a repeated pole right, which is where the easy method fails', () => {
    // z/(z - 2)^2 is n·2^{n-1}.
    counts(back('z/(z - 2)^2'), [0, 1, 4, 12, 32]);
    // z(z+1)/(z-1)^3 is n².
    counts(back('z(z + 1)/(z - 1)^3'), [0, 1, 4, 9, 16, 25]);
  });

  it('gets a pair of complex poles right', () => {
    // z(z - cos w)/(z² - 2z cos w + 1) is cos(wn).
    const w = 0.4;
    const seq = back('z(z - 0.921061)/(z^2 - 1.842122z + 1)');
    for (const n of [0, 1, 2, 5, 9]) expect(at(seq, n)).toBeCloseTo(Math.cos(w * n), 5);
  });

  it('gives back spikes where the top is not smaller than the bottom', () => {
    // (z + 1)/z is δ[n] + δ[n-1].
    counts(back('(z + 1)/z'), [1, 1, 0, 0]);
    counts(back('(2z - 1)/(z - 1)'), [2, 1, 1, 1]);
  });

  it('goes out and comes back as what it started as', () => {
    for (const source of ['0.5^n', 'n 2^n', '\\cos(0.4n)', '3 - n + 0.5^n', '0.8^n \\sin(0.3n)']) {
      const there = got(transform(node(source)));
      const home = got(inverse(there));
      const start = got(readSeq(node(source)));
      for (const n of [0, 1, 2, 5, 9]) expect(at(home, n)).toBeCloseTo(at(start, n), 6);
    }
  });
});

describe('poles, and the unit circle', () => {
  it('reads as dying away exactly when it dies away', () => {
    expect(poleText(poles(Z('0.5^n')))).toBe('Pole at 0.5 — all inside the unit circle, so it dies away.');
    expect(poleText(poles(Z('2^n')))).toMatch(/outside the unit circle, so it runs away/);
    expect(poleText(poles(Z('1')))).toMatch(/on the unit circle/);
    expect(poleText(poles(Z('\\cos(0.4n)')))).toMatch(/on the unit circle/);
  });

  it('counts a repeated pole as many times as it repeats', () => {
    expect(poles(Z('n 2^n'))).toEqual([
      { re: 2, im: 0 },
      { re: 2, im: 0 },
    ]);
  });
});

describe('what it refuses, and says', () => {
  it('names the function it has no row for', () => {
    expect(fault(transform(node('\\ln(n)')))).toMatch(/ln/);
    expect(fault(transform(node('n!')))).toMatch(/not something the z-transform reads/);
  });

  it('refuses half a beat, because there is no such index', () => {
    expect(fault(transform(node('u(n - 1.5)')))).toMatch(/whole number of beats/);
  });

  it('refuses to divide by something with n in it', () => {
    expect(fault(transform(node('1/n')))).toMatch(/Dividing/);
  });

  it('refuses a letter with no value rather than treating it as zero', () => {
    expect(fault(transform(node('k 0.5^n')))).toMatch(/k has no value/);
    expect(got(transform(node('k 0.5^n'), 'n', { vars: { k: 3 } }))).toHaveLength(1);
  });
});

describe('writing it down', () => {
  it('writes a transform the way a table prints it', () => {
    expect(latexZed(Z('0.5^n'))).toBe('\\frac{z}{z - 0.5}');
    expect(latexZed(Z('1'))).toBe('\\frac{z}{z - 1}');
    expect(latexZed(Z('n'))).toBe('\\frac{z}{(z - 1)^{2}}');
    expect(latexZed(Z('n 2^n'))).toBe('\\frac{2z}{(z - 2)^{2}}');
    expect(latexZed(Z('0.8^n \\cos(0.4n)'))).toMatch(/^\\frac\{.*\}\{z\^\{2\} - 1\.47/);
    expect(latexZed(Z('δ(n - 2)'))).toBe('\\frac{1}{z^{2}}');
  });

  it('writes a sequence with the square brackets a sequence has', () => {
    expect(latexSeq(back('z/(z - 0.5)'))).toBe('0.5^{n}');
    expect(latexSeq(back('z/(z - 1)^2'))).toBe('n');
    expect(latexSeq(back('z/((z - 1)(z - 2))'))).toBe('2^{n} - 1');
    expect(latexSeq(back('(z + 1)/z'))).toBe('\\delta[n] + \\delta[n - 1]');
  });

  it('says nothing as nothing rather than as an empty string', () => {
    expect(latexSeq({ beats: [], spikes: [] })).toBe('0');
    expect(latexZed([])).toBe('0');
  });
});
