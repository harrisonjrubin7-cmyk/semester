import { describe, expect, it } from 'vitest';
import {
  correlation,
  describe as summarise,
  histogram,
  isNumeric,
  numbersIn,
  pairs,
  parseCsv,
  parseTable,
  quantile,
  regress,
  show,
  tally,
  toNumber,
} from './stats';

describe('parseCsv', () => {
  it('reads a plain file', () => {
    const t = parseCsv('a,b\n1,2\n3,4\n');
    expect(t.headers).toEqual(['a', 'b']);
    expect(t.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    // Splitting on commas shifts every later column by one, silently, and the
    // analysis is then of the wrong variable.
    const t = parseCsv('name,price\n"Widget, large",10\n');
    expect(t.rows[0]).toEqual(['Widget, large', '10']);
  });

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv('a\n"say ""hi"""\n').rows[0][0]).toBe('say "hi"');
  });

  it('keeps a newline inside a quoted field, which a split cannot', () => {
    const t = parseCsv('a,b\n"one\ntwo",3\n');
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0][0]).toBe('one\ntwo');
  });

  it('does not invent a row from a trailing newline', () => {
    expect(parseCsv('a\n1\n').rows).toHaveLength(1);
    expect(parseCsv('a\n1\n\n\n').rows).toHaveLength(1);
  });

  it('survives an empty file', () => {
    expect(parseCsv('').rows).toEqual([]);
  });

  it('handles CRLF, which is what Excel writes', () => {
    expect(parseCsv('a,b\r\n1,2\r\n').rows[0]).toEqual(['1', '2']);
  });
});

describe('parseTable', () => {
  it('reads a tab-separated paste from a spreadsheet', () => {
    const t = parseTable('a\tb\n1\t2');
    expect(t.headers).toEqual(['a', 'b']);
    expect(t.rows[0]).toEqual(['1', '2']);
  });
});

describe('toNumber', () => {
  it('reads what real data actually contains', () => {
    expect(toNumber('1234')).toBe(1234);
    expect(toNumber('$1,234.50')).toBe(1234.5);
    expect(toNumber('-3.5')).toBe(-3.5);
    expect(toNumber('1.2e3')).toBe(1200);
  });

  it('reads an accounting negative as negative', () => {
    // Reading "(1,234)" as nothing loses a row; as 1234 gets the sign wrong.
    expect(toNumber('(1,234)')).toBe(-1234);
  });

  it('reads a percentage as a proportion', () => {
    expect(toNumber('12.5%')).toBe(0.125);
  });

  it('is null for what is not a number', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
    expect(toNumber('12 apples')).toBeNull();
  });
});

describe('isNumeric', () => {
  const table = parseCsv('price,name\n10,a\n20,b\n30,c\n40,d\n50,e\nn/a,f\n');

  it('tolerates the odd bad cell in a column of numbers', () => {
    // Five prices and one "n/a" is a column of prices. The test is a
    // proportion, so a very short column with one gap does not qualify — which
    // is the right way round: on three rows, being told to pick again is cheap.
    expect(isNumeric(table, 0)).toBe(true);
  });

  it('says no to a column of words', () => {
    expect(isNumeric(table, 1)).toBe(false);
  });
});

describe('describe', () => {
  // Worked by hand: 2, 4, 4, 4, 5, 5, 7, 9.
  const s = summarise([2, 4, 4, 4, 5, 5, 7, 9])!;

  it('gets the mean and the median', () => {
    expect(s.mean).toBe(5);
    expect(s.median).toBe(4.5);
  });

  it('uses the sample standard deviation, dividing by n−1', () => {
    // Population sd here is 2; the sample sd is √(32/7) ≈ 2.138.
    expect(s.sd).toBeCloseTo(2.138, 3);
  });

  it('gets the quartiles the way R and Excel do', () => {
    expect(s.q1).toBeCloseTo(4, 6);
    expect(s.q3).toBeCloseTo(5.5, 6);
  });

  it('does not divide by zero on a single value', () => {
    const one = summarise([7])!;
    expect(one.sd).toBe(0);
    expect(one.mean).toBe(7);
  });

  it('is null for nothing rather than NaN everywhere', () => {
    expect(summarise([])).toBeNull();
  });
});

describe('quantile', () => {
  it('interpolates between the two neighbours', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 6);
  });

  it('returns the ends exactly', () => {
    expect(quantile([1, 2, 3], 0)).toBe(1);
    expect(quantile([1, 2, 3], 1)).toBe(3);
  });
});

describe('pairs', () => {
  const table = parseCsv('x,y\n1,2\n2,\n3,6\n');

  it('drops a row where either side is missing', () => {
    // Treating a blank as zero moves the mean and flattens the slope, and
    // nothing on screen says it happened.
    expect(pairs(table, 0, 1)).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 6 },
    ]);
  });
});

describe('correlation', () => {
  it('is 1 for a perfect increasing line', () => {
    const data = [1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    expect(correlation(data)).toBeCloseTo(1, 10);
  });

  it('is −1 for a perfect decreasing line', () => {
    const data = [1, 2, 3, 4].map((x) => ({ x, y: -3 * x }));
    expect(correlation(data)).toBeCloseTo(-1, 10);
  });

  it('matches a hand-worked value', () => {
    // x 1,2,3,4,5; y 2,4,5,4,5 → r = 6/√(10·6) ≈ 0.7746
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 5, 4, 5];
    expect(correlation(xs.map((x, i) => ({ x, y: ys[i] })))!).toBeCloseTo(0.7746, 4);
  });

  it('is null when a column never varies, rather than NaN', () => {
    expect(correlation([{ x: 1, y: 5 }, { x: 2, y: 5 }])).toBeNull();
  });
});

describe('regress', () => {
  it('recovers a line exactly', () => {
    const data = [1, 2, 3, 4, 5].map((x) => ({ x, y: 3 * x - 2 }));
    const fit = regress(data)!;
    expect(fit.slope).toBeCloseTo(3, 10);
    expect(fit.intercept).toBeCloseTo(-2, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
    expect(fit.se).toBeCloseTo(0, 10);
  });

  it('matches a hand-worked fit with scatter', () => {
    // x 1..5, y 2,4,5,4,5: slope 0.6, intercept 2.2, R² = 0.6
    const ys = [2, 4, 5, 4, 5];
    const fit = regress([1, 2, 3, 4, 5].map((x, i) => ({ x, y: ys[i] })))!;
    expect(fit.slope).toBeCloseTo(0.6, 10);
    expect(fit.intercept).toBeCloseTo(2.2, 10);
    expect(fit.r2).toBeCloseTo(0.6, 10);
    expect(fit.df).toBe(3);
    // SSR = Syy − slope·Sxy = 6 − 3.6 = 2.4, so
    // se = √(SSR/df / Sxx) = √((2.4/3)/10) = √0.08 ≈ 0.28284
    expect(fit.se).toBeCloseTo(0.28284, 4);
    expect(fit.t).toBeCloseTo(2.1213, 4);
  });

  it('refuses too few points instead of fitting noise', () => {
    expect(regress([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
  });

  it('refuses a vertical column of x, where the slope is undefined', () => {
    expect(regress([1, 2, 3].map((y) => ({ x: 4, y })))).toBeNull();
  });
});

describe('histogram', () => {
  it('puts everything in a bin and loses nothing', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = histogram(values, 5);
    expect(bins).toHaveLength(5);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(values.length);
  });

  it('puts the maximum in the last bin, not past the end', () => {
    const bins = histogram([0, 5, 10], 5);
    expect(bins[bins.length - 1].count).toBe(1);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(3);
  });

  it('copes with every value being the same', () => {
    expect(histogram([3, 3, 3], 4)).toEqual([{ from: 3, to: 3, count: 3 }]);
  });

  it('is empty for no data', () => {
    expect(histogram([], 5)).toEqual([]);
  });
});

describe('tally', () => {
  it('counts and orders by frequency', () => {
    expect(tally(['a', 'b', 'a', 'c', 'a', 'b'])).toEqual([
      { value: 'a', count: 3 },
      { value: 'b', count: 2 },
      { value: 'c', count: 1 },
    ]);
  });

  it('ignores blanks rather than counting them as a category', () => {
    expect(tally(['a', '', '  ', 'a'])).toEqual([{ value: 'a', count: 2 }]);
  });
});

describe('numbersIn', () => {
  it('keeps only the cells that are numbers', () => {
    expect(numbersIn(parseCsv('x\n1\nn/a\n3\n'), 0)).toEqual([1, 3]);
  });
});

describe('show', () => {
  it('writes a number for reading', () => {
    expect(show(3.14159)).toBe('3.142');
    expect(show(2)).toBe('2');
  });

  it('goes exponential rather than printing a wall of zeros', () => {
    expect(show(0.0000001)).toContain('e');
    expect(show(123456789)).toContain('e');
  });

  it('says nothing rather than NaN', () => {
    expect(show(NaN)).toBe('—');
    expect(show(Infinity)).toBe('—');
  });
});
