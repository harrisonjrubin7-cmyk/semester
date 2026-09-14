import { describe, expect, it } from 'vitest';
import {
  AGGREGATE_LABELS,
  MOST_ROWS,
  asCells,
  headingOf,
  pivotNote,
  pivotsOf,
  readPivot,
  saysPivot,
  suggest,
  type Pivot,
} from './pivot';
import { clock, evaluate, type Cells } from './sheet';

/**
 * The same rows, asked a different question.
 *
 * Two things here are worth more than the grouping itself. One is the totals:
 * a row total for an average is the average of that row's *numbers*, never the
 * average of the averages across it, and those differ whenever the groups are
 * different sizes. The other is that the block it writes into cells is made of
 * formulas — so the last test evaluates them back and asks whether they agree
 * with the table they came from.
 */
const AT = Date.parse('2026-09-14T12:00:00Z');
const ctx = clock(AT);

/** A gradebook: course, term, mark. ECON is uneven across the two terms. */
const MARKS: Cells = {
  A1: 'Course', B1: 'Term', C1: 'Mark',
  A2: 'ECON', B2: 'Fall', C2: '88',
  A3: 'PSCI', B3: 'Fall', C3: '74',
  A4: 'ECON', B4: 'Fall', C4: '96',
  A5: 'ECON', B5: 'Spring', C5: '62',
  A6: 'PSCI', B6: 'Spring', C6: '80',
  A8: 'Notes', B8: 'below the table',
};

const over = (o: Partial<Pivot> = {}): Pivot => ({
  ...suggest(MARKS, 'A1:C6', AT),
  id: 'p1',
  by: 0,
  of: 2,
  how: 'sum',
  ...o,
});

describe('grouping one column by another', () => {
  it('takes the distinct values in the order met', () => {
    const read = readPivot(MARKS, over(), ctx);
    expect(read.rows).toEqual(['ECON', 'PSCI']);
    expect(read.cells.map((r) => r[0].value)).toEqual([246, 154]);
    expect(read.total).toBe(400);
  });

  it('counts, averages, and takes the ends', () => {
    expect(readPivot(MARKS, over({ how: 'count' }), ctx).cells.map((r) => r[0].value)).toEqual([3, 2]);
    expect(readPivot(MARKS, over({ how: 'average' }), ctx).cells[0][0].value).toBe(82);
    expect(readPivot(MARKS, over({ how: 'min' }), ctx).cells[0][0].value).toBe(62);
    expect(readPivot(MARKS, over({ how: 'max' }), ctx).cells[0][0].value).toBe(96);
  });

  /*
   * A row nobody has classified is not a group. Giving it one puts a nameless
   * bucket at the top of every pivot of every half-finished table.
   */
  it('leaves out a row with nothing in the grouping column', () => {
    const half: Cells = { ...MARKS, A5: '' };
    const read = readPivot(half, over({ how: 'count' }), ctx);
    expect(read.rows).toEqual(['ECON', 'PSCI']);
    expect(read.cells.map((r) => r[0].value)).toEqual([2, 2]);
  });

  it('never reads a row outside the range', () => {
    expect(readPivot(MARKS, over(), ctx).rows).not.toContain('Notes');
  });

  /*
   * A mark written `absent` is not a mark. It is still a row, though, so
   * `count` counts it and the numeric aggregates do not measure it — which is
   * what `COUNTIFS` and `SUMIFS` do, and the agreement matters because those
   * are what **Put it in cells** writes.
   */
  it('measures only the numbers, and still counts the rows', () => {
    const gap: Cells = { ...MARKS, C4: 'absent' };
    expect(readPivot(gap, over({ how: 'count' }), ctx).cells[0][0].value).toBe(3);
    expect(readPivot(gap, over({ how: 'sum' }), ctx).cells[0][0].value).toBe(150);
    expect(readPivot(gap, over({ how: 'average' }), ctx).cells[0][0].value).toBe(75);
  });

  it('reads a formula by its answer', () => {
    const computed: Cells = { ...MARKS, C2: '=44*2' };
    expect(readPivot(computed, over(), ctx).cells[0][0].value).toBe(246);
  });

  it('says what is wrong rather than drawing an empty table', () => {
    expect(readPivot(MARKS, over({ range: 'nonsense' }), ctx).trouble).toMatch(/not a range/i);
    expect(readPivot(MARKS, over({ range: 'A1:C1' }), ctx).trouble).toMatch(/heading row/i);
    expect(readPivot(MARKS, over({ by: 9 }), ctx).trouble).toMatch(/groups by/i);
    expect(readPivot(MARKS, over({ of: 9 }), ctx).trouble).toMatch(/measures/i);
    expect(readPivot({ A1: 'Course', A2: '' }, over({ range: 'A1:A2', of: 0 }), ctx).trouble)
      .toMatch(/to group by/i);
  });
});

describe('the second dimension', () => {
  const twoWay = over({ across: 1, how: 'sum' });

  it('spreads the groups across the top', () => {
    const read = readPivot(MARKS, twoWay, ctx);
    expect(read.rows).toEqual(['ECON', 'PSCI']);
    expect(read.columns).toEqual(['Fall', 'Spring']);
    expect(read.cells[0].map((c) => c.value)).toEqual([184, 62]);
    expect(read.cells[1].map((c) => c.value)).toEqual([74, 80]);
  });

  it('is null where no row fell into a pairing', () => {
    const sparse: Cells = { ...MARKS, A6: 'ECON' };
    const read = readPivot(sparse, twoWay, ctx);
    expect(read.rows).toEqual(['ECON', 'PSCI']);
    expect(read.cells[1][1].value).toBeNull();
    expect(read.cells[1][1].count).toBe(0);
  });

  /*
   * The test this whole file exists for. ECON is 88 and 96 in the Fall and 62
   * in the Spring: the average of its numbers is 82, and the average of its
   * two cell averages (92 and 62) is 77. Only the first is the average of
   * ECON's marks.
   */
  it('totals the numbers, not the totals', () => {
    const read = readPivot(MARKS, over({ across: 1, how: 'average' }), ctx);
    expect(read.cells[0].map((c) => c.value)).toEqual([92, 62]);
    expect(read.rowTotals[0]).toBe(82);
    expect(read.total).toBe(80);
  });

  it('totals each column the same way', () => {
    const read = readPivot(MARKS, twoWay, ctx);
    expect(read.columnTotals).toEqual([258, 142]);
    expect(read.total).toBe(400);
  });

  it('leaves out a row with nothing in the second column', () => {
    const half: Cells = { ...MARKS, B5: '' };
    expect(readPivot(half, twoWay, ctx).cells[0][0].value).toBe(184);
    expect(readPivot(half, twoWay, ctx).rowTotals[0]).toBe(184);
  });
});

describe('what the screen shows about one', () => {
  it('names a column by its heading', () => {
    expect(headingOf(MARKS, over(), 0, ctx)).toBe('Course');
    expect(headingOf(MARKS, over({ headers: false }), 0, ctx)).toBe('A');
  });

  it('says what it is doing in a sentence', () => {
    expect(saysPivot(MARKS, over(), ctx)).toBe('Course · total of Mark');
    expect(saysPivot(MARKS, over({ how: 'count' }), ctx)).toBe('Course · how many');
    expect(saysPivot(MARKS, over({ across: 1, how: 'average' }), ctx))
      .toBe('Course by Term · average of Mark');
  });

  /*
   * Not the first two columns: the second of course · term · mark is *term*,
   * which holds words, and measuring it gave a summary of blanks and formulas
   * that came out `#DIV/0!`. Found in a browser.
   */
  it('groups by the first column of names and measures the first of numbers', () => {
    const guess = suggest(MARKS, 'A1:C6', AT);
    expect(guess.by).toBe(0);
    expect(guess.of).toBe(2);
    expect(guess.across).toBeNull();
  });

  it('falls back sensibly on a block that is all numbers or all words', () => {
    const numbers: Cells = { A1: 'x', B1: 'y', A2: '1', B2: '2', A3: '3', B3: '4' };
    expect(suggest(numbers, 'A1:B3', AT).of).toBe(0);
    const words: Cells = { A1: 'x', B1: 'y', A2: 'a', B2: 'b' };
    expect(suggest(words, 'A1:B2', AT).by).toBe(0);
  });

  it('says so when the measured column holds no numbers', () => {
    expect(readPivot(MARKS, over({ of: 1 }), ctx).trouble).toMatch(/is a number/i);
    // Counting rows does not measure anything, so it still works.
    expect(readPivot(MARKS, over({ of: 1, how: 'count' }), ctx).trouble).toBe('');
  });

  it('caps how many groups it will draw', () => {
    const many: Cells = { A1: 'Who', B1: 'N' };
    for (let r = 2; r <= MOST_ROWS + 20; r += 1) {
      many[`A${r}`] = `p${r}`;
      many[`B${r}`] = '1';
    }
    const read = readPivot(many, over({ range: `A1:B${MOST_ROWS + 20}`, by: 0, of: 1 }), ctx);
    expect(read.rows.length).toBe(MOST_ROWS);
  });

  /*
   * A capped table's totals are totals of what is shown, which is a narrower
   * question than the one asked. Shown without saying so, it reads as the
   * answer — so the count of what was left out is carried out of the read and
   * `pivotNote` puts it under the table. See `chartNote`.
   */
  it('counts the rows the cap left out rather than swallowing them', () => {
    const many: Cells = { A1: 'Who', B1: 'N' };
    for (let r = 2; r <= MOST_ROWS + 20; r += 1) {
      many[`A${r}`] = `p${r}`;
      many[`B${r}`] = '1';
    }
    const read = readPivot(many, over({ range: `A1:B${MOST_ROWS + 20}`, by: 0, of: 1 }), ctx);
    // 79 rows of data (2…80), 60 of which fit.
    expect(read.beyond).toBe(19);
    expect(read.total).toBe(MOST_ROWS);
  });

  it('says so under the table, in words', () => {
    const many: Cells = { A1: 'Who', B1: 'N' };
    for (let r = 2; r <= MOST_ROWS + 20; r += 1) {
      many[`A${r}`] = `p${r}`;
      many[`B${r}`] = '1';
    }
    const read = readPivot(many, over({ range: `A1:B${MOST_ROWS + 20}`, by: 0, of: 1 }), ctx);
    expect(pivotNote(read)).toContain('19 rows are not counted');
    expect(pivotNote(read)).toContain('totals');
  });

  it('says nothing at all when nothing was left out', () => {
    expect(pivotNote(readPivot(MARKS, over({}), ctx))).toBe('');
  });
});

describe('putting it in cells', () => {
  /*
   * The point of the whole feature. What goes into the grid is arithmetic, not
   * the numbers the table happens to show — so editing a mark moves the total,
   * a chart can read it, and Excel recalculates it.
   */
  it('writes formulas, and they come to what the table said', () => {
    const block = asCells(MARKS, over(), 'Marks', ctx);
    expect(block[0]).toEqual(['Course', AGGREGATE_LABELS.sum]);
    expect(block[1][0]).toBe('ECON');
    expect(block[1][1]).toMatch(/^=SUMIFS\(/);

    // Written into a second sheet, and read back against the first.
    const put: Cells = { A1: block[0][0], B1: block[0][1], A2: block[1][0], B2: block[1][1], A3: block[2][0], B3: block[2][1] };
    const sheets = [
      { title: 'Summary', cells: put },
      { title: 'Marks', cells: MARKS },
    ];
    const over_ = { now: AT, book: Object.fromEntries(sheets.map((s) => [s.title.toLowerCase(), s.cells])), here: 'summary' };
    expect(evaluate(put, 'B2', new Set(), over_)).toBe(246);
    expect(evaluate(put, 'B3', new Set(), over_)).toBe(154);
  });

  it('quotes a word and leaves a number bare', () => {
    const numbered: Cells = { A1: 'Year', B1: 'N', A2: '2024', B2: '5', A3: '2025', B3: '7' };
    const block = asCells(numbered, over({ range: 'A1:B3', by: 0, of: 1 }), 'Data', ctx);
    expect(block[1][1]).toContain(',2024)');
    expect(asCells(MARKS, over(), 'Marks', ctx)[1][1]).toContain(',"ECON")');
  });

  it('writes COUNTIFS without a measured range, and the others with one', () => {
    expect(asCells(MARKS, over({ how: 'count' }), 'Marks', ctx)[1][1]).toMatch(/^=COUNTIFS\(/);
    expect(asCells(MARKS, over({ how: 'average' }), 'Marks', ctx)[1][1]).toMatch(/^=AVERAGEIFS\(\$?/);
    expect(asCells(MARKS, over({ how: 'min' }), 'Marks', ctx)[1][1]).toMatch(/^=MINIFS\(/);
  });

  it('qualifies and pins every range, because nothing is going to move these', () => {
    const block = asCells(MARKS, over(), 'Q1 marks', ctx);
    expect(block[1][1]).toContain("'Q1 marks'!$A$2:$A$6");
    expect(block[1][1]).toContain("'Q1 marks'!$C$2:$C$6");
  });

  it('gives a two-way pivot a column each and a total beside them', () => {
    const block = asCells(MARKS, over({ across: 1 }), 'Marks', ctx);
    expect(block[0]).toEqual(['Course', 'Fall', 'Spring', 'Total']);
    expect(block[1][1]).toContain(',"Fall")');
    // The row total names only the row, so it is every term rather than one.
    expect(block[1][3]).not.toContain('Fall');
  });

  it('writes nothing for a pivot it cannot read', () => {
    expect(asCells(MARKS, over({ range: 'nonsense' }), 'Marks', ctx)).toEqual([]);
  });
});

describe('reading them back off a stored sheet', () => {
  it('drops anything malformed rather than taking the screen down', () => {
    const stored = {
      pivots: [
        { id: 'a', range: 'A1:C6', headers: true, by: 0, across: null, of: 2, how: 'sum', created: 1 },
        null,
        { id: 'b', range: 'nonsense', by: 0, of: 1, how: 'sum' },
        { id: 'c', range: 'A1:C6', by: 0, of: 1, how: 'median' },
        { range: 'A1:C6', by: 0, of: 1, how: 'sum' },
      ],
    };
    expect(pivotsOf(stored).map((p) => p.id)).toEqual(['a']);
  });

  it('reads a bad second dimension as none rather than as column zero', () => {
    const out = pivotsOf({
      pivots: [{ id: 'a', range: 'A1:C6', by: 0, of: 2, how: 'sum', across: 'sideways' }],
    });
    expect(out[0].across).toBeNull();
  });

  it('is empty for a sheet nobody has pivoted', () => {
    expect(pivotsOf({})).toEqual([]);
    expect(pivotsOf({ pivots: 'no' })).toEqual([]);
  });
});

describe('the table and the formulas it writes must agree', () => {
  /*
   * The one way this feature can be quietly wrong: the panel gathers numbers
   * in TypeScript and the block it writes gathers them with `SUMIFS` in the
   * formula engine, and nothing else would notice the two drifting apart. So
   * every aggregate, over a block with an absent mark and an uneven second
   * dimension in it, is read both ways and compared.
   */
  const awkward: Cells = { ...MARKS, C4: 'absent', A7: 'CORE', B7: 'Spring', C7: '55' };
  const range = 'A1:C7';

  /** The written block, evaluated back against the sheet it summarises. */
  function through(pivot: Pivot): (number | string)[] {
    const block = asCells(awkward, pivot, 'Marks', ctx);
    const put: Cells = {};
    block.forEach((line, r) => {
      line.forEach((text, c) => {
        put[`${String.fromCharCode(65 + c)}${r + 1}`] = text;
      });
    });
    const book = { marks: awkward, summary: put };
    const reading = { now: AT, book, here: 'summary' };
    return block.slice(1).map((_, i) => {
      const value = evaluate(put, `B${i + 2}`, new Set(), reading);
      return typeof value === 'number' ? Number(value.toFixed(9)) : String(value);
    });
  }

  for (const how of ['count', 'sum', 'average', 'min', 'max'] as const) {
    it(`agrees for ${how}`, () => {
      const pivot = over({ range, how, by: 0, of: 2 });
      const shown = readPivot(awkward, pivot, ctx).cells.map((row) =>
        row[0].value === null ? '' : Number(row[0].value.toFixed(9)),
      );
      expect(through(pivot)).toEqual(shown);
    });
  }

  it('agrees across a second dimension too', () => {
    const pivot = over({ range, across: 1, how: 'average', by: 0, of: 2 });
    const block = asCells(awkward, pivot, 'Marks', ctx);
    const put: Cells = {};
    block.forEach((line, r) => {
      line.forEach((text, c) => {
        put[`${String.fromCharCode(65 + c)}${r + 1}`] = text;
      });
    });
    const reading = { now: AT, book: { marks: awkward, summary: put }, here: 'summary' };
    const read = readPivot(awkward, pivot, ctx);
    read.rows.forEach((_, r) => {
      read.columns.forEach((__, c) => {
        const want = read.cells[r][c].value;
        const got = evaluate(put, `${String.fromCharCode(66 + c)}${r + 2}`, new Set(), reading);
        if (want === null) expect(String(got)).toBe('#DIV/0!');
        else expect(Number(Number(got).toFixed(9))).toBe(Number(want.toFixed(9)));
      });
      // And the row total, which is the number the naive version gets wrong.
      const total = read.rowTotals[r] as number;
      const got = evaluate(put, `${String.fromCharCode(66 + read.columns.length)}${r + 2}`, new Set(), reading);
      expect(Number(Number(got).toFixed(9))).toBe(Number(total.toFixed(9)));
    });
  });
});
