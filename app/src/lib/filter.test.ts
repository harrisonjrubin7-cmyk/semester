import { describe, expect, it } from 'vitest';
import {
  blankFilter,
  columnsIn,
  filterOf,
  headingOf,
  hidden,
  hides,
  keeps,
  saysRule,
  valuesIn,
  withRule,
  withoutRule,
  type FilterRule,
  type SheetFilter,
} from './filter';
import { clock, reading, type Cells } from './sheet';

/**
 * Rows out of sight.
 *
 * The promise this is held to is that it hides rows and changes no number —
 * so the tests are about *which* rows, and about the two cases where a naive
 * filter hides the wrong half of the sheet: a row with nothing in the column
 * being filtered, and the rows underneath the block the filter is over.
 */
const AT = Date.parse('2026-09-14T12:00:00Z');
const ctx = clock(AT);

const MARKS: Cells = {
  A1: 'Student', B1: 'Course', C1: 'Mark',
  A2: 'Ada', B2: 'ECON', C2: '88',
  A3: 'Bo', B3: 'PSCI', C3: '74',
  A4: 'Cy', B4: 'ECON', C4: '95',
  A5: 'Dee', B5: 'ECON', C5: '',
  A7: 'Notes below the table', B7: 'not part of it',
};

const over = (rules: FilterRule[] = []): SheetFilter => ({ ...blankFilter('A1:C5'), rules });

describe('one cell against one rule', () => {
  it('matches text without minding the case', () => {
    expect(keeps({ column: 1, test: 'contains', value: 'econ' }, 'ECON')).toBe(true);
    expect(keeps({ column: 1, test: 'contains', value: 'econ' }, 'PSCI')).toBe(false);
    expect(keeps({ column: 1, test: 'is', value: 'econ' }, 'ECON')).toBe(true);
    expect(keeps({ column: 1, test: 'is', value: 'eco' }, 'ECON')).toBe(false);
  });

  it('compares numbers as numbers, and reads a typed percentage', () => {
    expect(keeps({ column: 2, test: 'greater', value: '90' }, '95')).toBe(true);
    expect(keeps({ column: 2, test: 'less', value: '80' }, '74')).toBe(true);
    expect(keeps({ column: 2, test: 'less', value: '1' }, '55%')).toBe(true);
  });

  /*
   * "Greater than 90" is a question about marks, and a row with no mark is not
   * an answer to it. Keeping it would put the unmarked rows in with the best
   * ones, which is the wrong half of the sheet to be looking at.
   */
  it('hides a row with no number under a numeric rule', () => {
    expect(keeps({ column: 2, test: 'greater', value: '90' }, '')).toBe(false);
    expect(keeps({ column: 2, test: 'greater', value: '90' }, 'absent')).toBe(false);
  });

  it('keeps everything while the box is still empty', () => {
    expect(keeps({ column: 1, test: 'contains', value: '' }, 'anything')).toBe(true);
    expect(keeps({ column: 2, test: 'greater', value: '' }, '10')).toBe(true);
    expect(keeps({ column: 2, test: 'between', value: '60', value2: '' }, '10')).toBe(true);
  });

  it('takes a band from either end', () => {
    const band: FilterRule = { column: 2, test: 'between', value: '79', value2: '60' };
    expect(keeps(band, '70')).toBe(true);
    expect(keeps(band, '95')).toBe(false);
  });

  it('asks only whether there is anything there, for "not empty"', () => {
    expect(keeps({ column: 2, test: 'filled', value: '' }, '0')).toBe(true);
    expect(keeps({ column: 2, test: 'filled', value: '' }, '  ')).toBe(false);
  });
});

describe('which rows go', () => {
  it('hides the rows the rule does not keep', () => {
    const away = hidden(MARKS, over([{ column: 1, test: 'is', value: 'ECON' }]), ctx);
    // Row 3 (index 2) is PSCI.
    expect([...away]).toEqual([2]);
  });

  it('takes every rule at once, so two columns narrow together', () => {
    const away = hidden(
      MARKS,
      over([
        { column: 1, test: 'is', value: 'ECON' },
        { column: 2, test: 'greater', value: '90' },
      ]),
      ctx,
    );
    // Ada 88 and Dee (no mark) go on the second rule; Bo goes on the first.
    expect([...away].sort()).toEqual([1, 2, 4]);
  });

  it('never hides the heading row', () => {
    const away = hidden(MARKS, over([{ column: 1, test: 'is', value: 'nothing' }]), ctx);
    expect(away.has(0)).toBe(false);
  });

  /* A filter is over a block. Hiding what is underneath it is how a filter
     eats the notes somebody keeps at the foot of the sheet. */
  it('never hides a row outside its range', () => {
    const away = hidden(MARKS, over([{ column: 1, test: 'is', value: 'nothing' }]), ctx);
    expect(away.has(6)).toBe(false);
  });

  it('hides nothing at all when there are no rules', () => {
    expect(hidden(MARKS, over(), ctx).size).toBe(0);
  });

  it('ignores a rule on a column outside the range', () => {
    expect(hidden(MARKS, over([{ column: 9, test: 'is', value: 'x' }]), ctx).size).toBe(0);
  });

  it('reads a formula by its answer', () => {
    const cells: Cells = { A1: 'x', A2: '10', A3: '=A2*10' };
    const filter: SheetFilter = { range: 'A1:A3', headers: true, rules: [{ column: 0, test: 'greater', value: '50' }] };
    expect([...hidden(cells, filter, ctx)]).toEqual([1]);
  });

  it('reads a formula that reaches another sheet, under a book', () => {
    const here: Cells = { A1: 'x', A2: '=Marks!C2', A3: '=Marks!C3' };
    const sheets = [
      { title: 'Here', cells: here },
      { title: 'Marks', cells: MARKS },
    ];
    const filter: SheetFilter = { range: 'A1:A3', headers: true, rules: [{ column: 0, test: 'greater', value: '80' }] };
    expect([...hidden(here, filter, reading(sheets, 'Here', AT))]).toEqual([2]);
  });

  it('answers with row indices an address can be checked against', () => {
    const away = hidden(MARKS, over([{ column: 1, test: 'is', value: 'ECON' }]), ctx);
    expect(hides(away, 'B3')).toBe(true);
    expect(hides(away, 'B2')).toBe(false);
    expect(hides(away, 'nonsense')).toBe(false);
  });
});

describe('what the pickers offer', () => {
  it('lists the distinct values in a column, in the order met', () => {
    expect(valuesIn(MARKS, over(), 1, ctx)).toEqual(['ECON', 'PSCI']);
  });

  it('leaves the blanks out and stops at the cap', () => {
    expect(valuesIn(MARKS, over(), 2, ctx)).toEqual(['88', '74', '95']);
    expect(valuesIn(MARKS, over(), 2, ctx, 2)).toEqual(['88', '74']);
  });

  it('names a column by its heading rather than by its letter', () => {
    expect(headingOf(MARKS, over(), 2, ctx)).toBe('Mark');
    expect(headingOf(MARKS, { ...over(), headers: false }, 2, ctx)).toBe('C');
  });

  it('falls back to the letter where the heading is blank', () => {
    expect(headingOf({ A1: '' }, { ...over(), range: 'A1:A3' }, 0, ctx)).toBe('A');
  });

  it('lists the columns the filter covers', () => {
    expect(columnsIn(over()).map((c) => c.label)).toEqual(['A', 'B', 'C']);
  });
});

describe('setting and clearing a rule', () => {
  it('replaces the rule on that column rather than adding a second', () => {
    let f = over([{ column: 1, test: 'is', value: 'ECON' }]);
    f = withRule(f, { column: 1, test: 'is', value: 'PSCI' });
    expect(f.rules).toEqual([{ column: 1, test: 'is', value: 'PSCI' }]);
  });

  it('leaves other columns alone', () => {
    let f = over([{ column: 1, test: 'is', value: 'ECON' }]);
    f = withRule(f, { column: 2, test: 'greater', value: '90' });
    expect(f.rules.map((r) => r.column).sort()).toEqual([1, 2]);
    expect(withoutRule(f, 1).rules.map((r) => r.column)).toEqual([2]);
  });
});

describe('reading one back off a stored sheet', () => {
  it('drops anything malformed rather than taking the screen down', () => {
    const stored = {
      filter: {
        range: 'A1:C5',
        headers: true,
        rules: [
          { column: 1, test: 'is', value: 'ECON' },
          null,
          { column: 1, test: 'is', value: 'again' },
          { column: -1, test: 'is', value: 'x' },
          { column: 2, test: 'from-the-future', value: '' },
        ],
      },
    };
    expect(filterOf(stored)?.rules).toEqual([{ column: 1, test: 'is', value: 'ECON' }]);
  });

  it('is nothing for a sheet with no filter, or a range that is not one', () => {
    expect(filterOf({})).toBeUndefined();
    expect(filterOf({ filter: { range: 'nonsense', rules: [] } })).toBeUndefined();
    expect(filterOf({ filter: 'no' })).toBeUndefined();
  });
});

describe('how a rule reads on a chip', () => {
  it('says the heading and what it asks', () => {
    expect(saysRule({ column: 2, test: 'greater', value: '90' }, 'Mark')).toBe('Mark > 90');
    expect(saysRule({ column: 1, test: 'contains', value: 'ECON' }, 'Course')).toBe('Course · “ECON”');
    expect(saysRule({ column: 2, test: 'between', value: '60', value2: '79' }, 'Mark')).toBe('Mark · 60–79');
    expect(saysRule({ column: 2, test: 'filled', value: '' }, 'Mark')).toBe('Mark · not empty');
  });
});
