import { describe, expect, it } from 'vitest';
import {
  CHART_KINDS,
  MAX_POINTS,
  axisText,
  bands,
  baselineFor,
  corners,
  describeChart,
  needsLegend,
  numberAt,
  readChart,
  scaleFor,
  slices,
  suggest,
  wedge,
  type SheetChart,
} from './chart';
import { clock, type Cells } from './sheet';

const AT = Date.parse('2026-09-14T12:00:00Z');
const ctx = clock(AT);

function chart(over: Partial<SheetChart> = {}): SheetChart {
  return {
    id: 'c1',
    kind: 'column',
    range: 'A1:B4',
    title: '',
    headers: true,
    labels: true,
    created: AT,
    ...over,
  };
}

/** A gradebook: a heading row, a name column, and two columns of marks. */
const MARKS: Cells = {
  A1: 'Student', B1: 'Midterm', C1: 'Final',
  A2: 'Ada', B2: '88', C2: '91',
  A3: 'Bo', B3: '74', C3: '69',
  A4: 'Cy', B4: '95', C4: '100',
};

describe('reading a block', () => {
  it('takes columns as series and rows as categories', () => {
    const read = readChart(MARKS, chart({ range: 'A1:C4' }), ctx);
    expect(read.trouble).toBe('');
    expect(read.labels).toEqual(['Ada', 'Bo', 'Cy']);
    expect(read.series.map((s) => s.name)).toEqual(['Midterm', 'Final']);
    expect(read.series[0].values).toEqual([88, 74, 95]);
    expect(read.series[1].values).toEqual([91, 69, 100]);
  });

  it('charts a formula by its answer, not by its text', () => {
    const cells: Cells = { ...MARKS, D1: 'Average', D2: '=AVERAGE(B2:C2)', D3: '=AVERAGE(B3:C3)', D4: '=AVERAGE(B4:C4)' };
    const read = readChart(cells, chart({ range: 'A1:D4' }), ctx);
    expect(read.series[2].values).toEqual([89.5, 71.5, 97.5]);
  });

  /*
   * The difference between "no mark" and "a mark of nothing".
   *
   * A #DIV/0! drawn as a zero is a bar somebody reads as a result. It has to
   * be a gap in the line and a missing bar instead.
   */
  it('reads an error and an empty cell as a gap rather than as zero', () => {
    const cells: Cells = { A1: 'x', B1: 'v', A2: 'a', B2: '=1/0', A3: 'b', B3: '', A4: 'c', B4: '3' };
    const read = readChart(cells, chart({ range: 'A1:B4' }), ctx);
    expect(read.series[0].values).toEqual([null, null, 3]);
  });

  it('reads a typed percentage as its fraction', () => {
    const cells: Cells = { A1: 'x', B1: 'v', A2: 'a', B2: '80%', A3: 'b', B3: '12.5%' };
    const read = readChart(cells, chart({ range: 'A1:B3' }), ctx);
    expect(read.series[0].values).toEqual([0.8, 0.125]);
  });

  it('leaves out a column with no numbers in it at all', () => {
    const cells: Cells = {
      A1: 'Student', B1: 'Grade', C1: 'Mark',
      A2: 'Ada', B2: 'A', C2: '95',
      A3: 'Bo', B3: 'C', C3: '74',
    };
    const read = readChart(cells, chart({ range: 'A1:C3' }), ctx);
    expect(read.series.map((s) => s.name)).toEqual(['Mark']);
  });

  it('names a series by its column and a row by its number when the edges are not names', () => {
    const cells: Cells = { A1: '1', B1: '2', A2: '3', B2: '4' };
    const read = readChart(cells, chart({ range: 'A1:B2', headers: false, labels: false }), ctx);
    expect(read.series.map((s) => s.name)).toEqual(['A', 'B']);
    expect(read.labels).toEqual(['Row 1', 'Row 2']);
  });

  it('says what is wrong rather than drawing an empty chart', () => {
    expect(readChart({}, chart({ range: 'nonsense' }), ctx).trouble).toMatch(/not a range/i);
    expect(readChart(MARKS, chart({ range: 'A1:C1' }), ctx).trouble).toMatch(/heading row/i);
    expect(readChart(MARKS, chart({ range: 'A1:A4' }), ctx).trouble).toMatch(/label column/i);
    expect(readChart({ A1: 'x', A2: 'y' }, chart({ range: 'A1:B2', headers: false, labels: true }), ctx).trouble)
      .toMatch(/is a number/i);
  });

  it('refuses a block too big to be a picture', () => {
    const cells: Cells = {};
    for (let r = 0; r < 60; r++) for (let c = 0; c < 6; c++) cells[`${'ABCDEF'[c]}${r + 1}`] = String(r * c);
    const read = readChart(cells, chart({ range: 'A1:F60', headers: false, labels: false }), ctx);
    expect(read.trouble).toContain(String(MAX_POINTS));
  });

  it('reads the corners of a range either way round', () => {
    expect(corners('C9:A1')).toEqual({ top: 0, left: 0, bottom: 8, right: 2 });
    expect(corners('B2')).toEqual({ top: 1, left: 1, bottom: 1, right: 1 });
    expect(corners('')).toBeNull();
  });
});

describe('one cell as a number', () => {
  it('is null for an empty cell, a word and an error', () => {
    expect(numberAt({}, 'A1', ctx)).toBeNull();
    expect(numberAt({ A1: 'hello' }, 'A1', ctx)).toBeNull();
    expect(numberAt({ A1: '=1/0' }, 'A1', ctx)).toBeNull();
  });

  it('counts a boolean as one and nothing', () => {
    expect(numberAt({ A1: 'TRUE' }, 'A1', ctx)).toBe(1);
    expect(numberAt({ A1: 'FALSE' }, 'A1', ctx)).toBe(0);
  });
});

describe('guessing what somebody meant', () => {
  it('finds the heading row and the label column of a table', () => {
    const guess = suggest(MARKS, 'A1:C4', AT);
    expect(guess.headers).toBe(true);
    expect(guess.labels).toBe(true);
    expect(guess.kind).toBe('column');
  });

  it('claims neither edge of a block of pure numbers', () => {
    const cells: Cells = { A1: '1', B1: '2', A2: '3', B2: '4' };
    const guess = suggest(cells, 'A1:B2', AT);
    expect(guess.headers).toBe(false);
    expect(guess.labels).toBe(false);
  });

  /* One row of labels beside one column of figures is the shape a pie is for. */
  it('offers a pie for one positive series with few parts', () => {
    const cells: Cells = {
      A1: 'Where', B1: 'Spent',
      A2: 'Books', B2: '240', A3: 'Food', B3: '410', A4: 'Rent', B4: '900',
    };
    expect(suggest(cells, 'A1:B4', AT).kind).toBe('pie');
  });

  it('will not offer a pie when a value is negative', () => {
    const cells: Cells = {
      A1: 'Where', B1: 'Spent',
      A2: 'Books', B2: '240', A3: 'Refund', B3: '-60',
    };
    expect(suggest(cells, 'A1:B3', AT).kind).toBe('column');
  });

  it('does not read a lone column of numbers as having a label column', () => {
    const cells: Cells = { A1: 'Marks', A2: '80', A3: '90' };
    const guess = suggest(cells, 'A1:A3', AT);
    expect(guess.labels).toBe(false);
    expect(guess.headers).toBe(true);
  });
});

describe('the axis', () => {
  it('starts a bar at zero and lets a line fit', () => {
    expect(baselineFor('column')).toBe('zero');
    expect(baselineFor('bar')).toBe('zero');
    expect(baselineFor('pie')).toBe('zero');
    expect(baselineFor('line')).toBe('fit');
    expect(scaleFor([88, 91, 95], 'zero').min).toBe(0);
    expect(scaleFor([88, 91, 95], 'fit').min).toBeGreaterThan(0);
  });

  it('lands every tick on a round number', () => {
    const scale = scaleFor([0, 37], 'zero');
    expect(scale.ticks[0]).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(37);
    for (const t of scale.ticks) expect(Number.isInteger(t / scale.step)).toBe(true);
  });

  it('does not leave a floating-point tail on a tick', () => {
    for (const t of scaleFor([0, 0.5], 'zero').ticks) expect(String(t)).not.toMatch(/000000|999999/);
  });

  it('gives a flat series an axis with two ends', () => {
    const flat = scaleFor([100, 100, 100], 'fit');
    expect(flat.max).toBeGreaterThan(flat.min);
    expect(flat.min).toBeGreaterThan(0);
    const zeroed = scaleFor([0, 0], 'zero');
    expect(zeroed.min).toBe(0);
    expect(zeroed.max).toBeGreaterThan(0);
  });

  it('takes in zero when the values straddle it, even fitting', () => {
    const scale = scaleFor([-40, 60], 'fit');
    expect(scale.min).toBeLessThanOrEqual(0);
    expect(scale.max).toBeGreaterThanOrEqual(0);
  });

  it('handles a single value and an empty series', () => {
    expect(scaleFor([7], 'zero').max).toBeGreaterThanOrEqual(7);
    expect(scaleFor([], 'zero').max).toBeGreaterThan(scaleFor([], 'zero').min);
  });

  it('shortens a big number and groups a middling one', () => {
    expect(axisText(2_500_000)).toBe('2.5M');
    expect(axisText(42_000)).toBe('42k');
    expect(axisText(1250)).toBe('1,250');
    expect(axisText(0.25)).toBe('0.25');
    expect(axisText(0)).toBe('0');
  });
});

describe('a pie', () => {
  it('turns values into shares that fill the circle', () => {
    const cut = slices(['a', 'b', 'c'], [25, 25, 50]);
    expect(cut.map((s) => s.share)).toEqual([0.25, 0.25, 0.5]);
    expect(cut[0].from).toBe(0);
    expect(cut[2].to).toBeCloseTo(360);
  });

  it('drops what is not a positive part of a whole', () => {
    expect(slices(['a', 'b', 'c'], [10, -5, null]).map((s) => s.label)).toEqual(['a']);
    expect(slices(['a'], [0])).toEqual([]);
  });

  it('draws a whole circle as two arcs rather than as nothing', () => {
    const whole = wedge(50, 50, 40, 0, 360);
    expect(whole.match(/A /g)?.length).toBe(2);
    expect(whole).not.toContain('NaN');
    expect(wedge(50, 50, 40, 0, 90)).not.toContain('NaN');
  });

  it('marks the long way round so a big slice is not drawn inside out', () => {
    expect(wedge(50, 50, 40, 0, 270)).toContain('0 1 1');
    expect(wedge(50, 50, 40, 0, 90)).toContain('0 0 1');
  });
});

describe('where the bars go', () => {
  it('divides the length into one block per category', () => {
    const { band, width, offset } = bands(300, 3, 2);
    expect(band).toBe(100);
    expect(width).toBe(40);
    expect(offset(0)).toBe(10);
    expect(offset(1)).toBe(50);
    // The last bar of a block ends inside it.
    expect(offset(1) + width).toBeLessThanOrEqual(band);
  });

  it('survives a chart with nothing in it', () => {
    expect(() => bands(300, 0, 0)).not.toThrow();
    expect(bands(300, 0, 0).band).toBe(300);
  });
});

describe('what it is called out loud', () => {
  it('names the shape, the series and the categories', () => {
    const read = readChart(MARKS, chart({ range: 'A1:C4' }), ctx);
    const said = describeChart(chart({ range: 'A1:C4', title: 'Marks' }), read);
    expect(said).toContain('Marks');
    expect(said).toContain('Midterm');
    expect(said).toContain('2 series');
  });

  it('says the trouble when there is one', () => {
    const read = readChart(MARKS, chart({ range: 'A1:C1' }), ctx);
    expect(describeChart(chart({ range: 'A1:C1' }), read)).toBe(read.trouble);
  });

  it('wants a legend only when there is more than one thing in it', () => {
    const two = readChart(MARKS, chart({ range: 'A1:C4' }), ctx);
    const one = readChart(MARKS, chart({ range: 'A1:B4' }), ctx);
    expect(needsLegend(two, 'column')).toBe(true);
    expect(needsLegend(one, 'column')).toBe(false);
    expect(needsLegend(one, 'pie')).toBe(true);
  });
});

describe('the set of kinds', () => {
  it('is what the pickers and the exporter both walk', () => {
    expect([...CHART_KINDS]).toEqual(['column', 'bar', 'line', 'pie']);
  });
});
