import { describe, expect, it } from 'vitest';
import {
  MAX_COLS,
  MAX_ROWS,
  blockIn,
  clock,
  display,
  evaluate,
  landing,
  ref,
  show,
  spillOf,
  type Cells,
} from './sheet';
import { filled, toCsv } from './sheet';
import { blankSheet } from './blank';
import { readChart } from './chart';
import { fromSheet } from './xlsx';

/**
 * A formula that answers with more than one cell.
 *
 * `SPLIT`'s comment in `lib/sheet.ts` has said since it was written that *"a
 * grid has no way to spill one value across several cells"*, and that one
 * sentence is why the engine had 159 functions and none of the six every
 * modern spreadsheet is now built around. This is the model that changes it,
 * and the things worth testing are not the functions — each is a dozen lines —
 * but the placement: what happens when a block does not fit, when two of them
 * want the same cells, and whether the rest of the app can see the result.
 *
 * The one rule underneath all of it: **nothing is written**. A spilled cell is
 * empty in `cells` and always will be, so every test here that reads a value
 * out of one is also a test that the value was derived rather than stored.
 */

const at = clock(Date.UTC(2026, 8, 14, 15, 30));
const read = (cells: Cells, address: string) => display(cells, address, at);

/** A marks table: three students, a mark each, and a pass column beside it. */
const MARKS: Cells = {
  A1: 'Ann', B1: '71',
  A2: 'Ben', B2: '44',
  A3: 'Cy', B3: '88',
  C1: '=B1>60', C2: '=B2>60', C3: '=B3>60',
};

describe('FILTER', () => {
  const cells: Cells = { ...MARKS, E1: '=FILTER(A1:B3,C1:C3)' };

  it('puts the top-left value in the cell the formula is in', () => {
    expect(read(cells, 'E1')).toBe('Ann');
  });

  it('spills the rest into the cells beside and below it', () => {
    expect(read(cells, 'F1')).toBe('71');
    expect(read(cells, 'E2')).toBe('Cy');
    expect(read(cells, 'F2')).toBe('88');
  });

  it('writes nothing into any of them', () => {
    // The whole model in one assertion. A spilled value that was stored would
    // survive its formula being deleted, and go stale the moment a mark did.
    expect(cells.F1).toBeUndefined();
    expect(cells.E2).toBeUndefined();
    expect(Object.keys(cells).sort()).toEqual(
      ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'E1'].sort(),
    );
  });

  it('stops where the kept rows stop', () => {
    // Ben did not pass, so two rows came back and the third is blank. The
    // control on every spill test: a block that ran on would be invisible here
    // and wrong everywhere.
    expect(read(cells, 'E3')).toBe('');
    expect(read(cells, 'F3')).toBe('');
  });

  it('answers #N/A when the test keeps nothing', () => {
    expect(read({ ...MARKS, E1: '=FILTER(A1:B3,B1:B3>100)' }, 'E1')).toBe('#N/A');
  });

  it('answers what the third argument says instead, when there is one', () => {
    expect(read({ ...MARKS, E1: '=FILTER(A1:B3,B1:B3>100,"nobody")' }, 'E1')).toBe('nobody');
  });

  it('refuses a test that is not the length of the range', () => {
    // Guessing which row to drop is how a gradebook comes out shifted by one.
    expect(read({ ...MARKS, E1: '=FILTER(A1:B3,C1:C2)' }, 'E1')).toBe('#VALUE!');
  });

  it('keeps columns when the test lies across the top', () => {
    const across: Cells = { A1: '1', B1: '2', C1: '3', A2: 'TRUE', B2: 'FALSE', C2: 'TRUE', E1: '=FILTER(A1:C1,A2:C2)' };
    expect(read(across, 'E1')).toBe('1');
    expect(read(across, 'F1')).toBe('3');
    expect(read(across, 'G1')).toBe('');
  });
});

describe('a range put to a test, inside an argument', () => {
  it('answers the test cell by cell, keeping the shape', () => {
    // `FILTER(A1:B9, B1:B9>60)` is how every spreadsheet writes it. A bare
    // range outside a function is still `#VALUE!`; inside an argument it has a
    // shape, so a comparison against it has one too.
    const cells: Cells = { ...MARKS, E1: '=FILTER(A1:B3,B1:B3>60)' };
    expect([read(cells, 'E1'), read(cells, 'E2')]).toEqual(['Ann', 'Cy']);
  });

  it('works for text and for equality as well as for greater-than', () => {
    const cells: Cells = { A1: 'x', A2: 'y', A3: 'x', C1: '=FILTER(A1:A3,A1:A3="x")' };
    expect([read(cells, 'C1'), read(cells, 'C2'), read(cells, 'C3')]).toEqual(['x', 'x', '']);
  });

  it('refuses a range on both sides rather than comparing to its first cell', () => {
    /*
     * Not a guard this added: a bare range has been `#VALUE!` in an expression
     * since the engine was written, so the right-hand side is an error before
     * anything here sees it. The check that *was* written for this — a block
     * arriving on the right — turned out to be unreachable and was deleted,
     * which a mutation found by surviving. The behaviour is still worth an
     * assertion, because it is what stops half of array arithmetic shipping.
     */
    expect(read({ ...MARKS, E1: '=FILTER(A1:B3,B1:B3>B1:B3)' }, 'E1')).toBe('#VALUE!');
  });

  it('leaves the rest of array arithmetic where it was, visibly', () => {
    // `=B1:B3*2` is still refused, and refused is a thing somebody can see.
    expect(read({ ...MARKS, E1: '=B1:B3*2' }, 'E1')).toBe('#VALUE!');
  });

  it('does not change what a plain range argument means', () => {
    // The control. A `tested` that fired on everything would turn every SUM
    // into a column of TRUE.
    expect(read({ ...MARKS, E1: '=SUM(B1:B3)' }, 'E1')).toBe('203');
  });
});

describe('SORT', () => {
  it('orders by the first column, ascending, by default', () => {
    const cells: Cells = { A1: '3', A2: '1', A3: '2', C1: '=SORT(A1:A3)' };
    expect([read(cells, 'C1'), read(cells, 'C2'), read(cells, 'C3')]).toEqual(['1', '2', '3']);
  });

  it('orders by a named column, and downwards when asked', () => {
    const cells: Cells = { ...MARKS, E1: '=SORT(A1:B3,2,-1)' };
    expect([read(cells, 'E1'), read(cells, 'E2'), read(cells, 'E3')]).toEqual(['Cy', 'Ann', 'Ben']);
    expect([read(cells, 'F1'), read(cells, 'F2'), read(cells, 'F3')]).toEqual(['88', '71', '44']);
  });

  it('puts a missing mark last rather than treating it as a zero', () => {
    // The student who has not sat the exam is not the student who failed it.
    const cells: Cells = { A1: 'Ann', B1: '71', A2: 'Ben', A3: 'Cy', B3: '40', E1: '=SORT(A1:B3,2)' };
    expect([read(cells, 'E1'), read(cells, 'E2'), read(cells, 'E3')]).toEqual(['Cy', 'Ann', 'Ben']);
  });

  it('leaves rows that tie in the order they were typed', () => {
    const cells: Cells = { A1: 'Ann', B1: '70', A2: 'Ben', B2: '70', A3: 'Cy', B3: '10', E1: '=SORT(A1:B3,2,-1)' };
    expect([read(cells, 'E1'), read(cells, 'E2')]).toEqual(['Ann', 'Ben']);
  });

  it('refuses a column that is not in the range', () => {
    expect(read({ ...MARKS, E1: '=SORT(A1:B3,5)' }, 'E1')).toBe('#VALUE!');
  });

  it('refuses an order that is neither up nor down', () => {
    expect(read({ ...MARKS, E1: '=SORT(A1:B3,1,2)' }, 'E1')).toBe('#VALUE!');
  });
});

describe('UNIQUE', () => {
  it('keeps each distinct row once, in the order first seen', () => {
    const cells: Cells = { A1: 'red', A2: 'blue', A3: 'red', A4: 'green', C1: '=UNIQUE(A1:A4)' };
    expect([read(cells, 'C1'), read(cells, 'C2'), read(cells, 'C3'), read(cells, 'C4')]).toEqual([
      'red', 'blue', 'green', '',
    ]);
  });

  it('compares whole rows rather than first cells', () => {
    const cells: Cells = { A1: 'Lee', B1: '1', A2: 'Lee', B2: '2', D1: '=UNIQUE(A1:B2)' };
    expect([read(cells, 'D1'), read(cells, 'D2')]).toEqual(['Lee', 'Lee']);
  });

  it('keeps two names that differ only in case, because they are two people', () => {
    const cells: Cells = { A1: 'Lee', A2: 'lee', C1: '=UNIQUE(A1:A2)' };
    expect([read(cells, 'C1'), read(cells, 'C2')]).toEqual(['Lee', 'lee']);
  });

  it('cannot be fooled by cells that hold the separator its marks use', () => {
    /*
     * Length-prefixed for the reason `scripts/audiocache.ts` is. The pair
     * below is the one that proves it: joined on a colon, `a:b` beside a blank
     * and `a` beside `b:` are both `a:b:`, so a naive mark folds two different
     * rows into one and `UNIQUE` silently loses a row of somebody's data.
     * Written with lengths they are `3:a:b0:` and `1:a2:b:`, which are two.
     */
    const cells: Cells = { A1: 'a:b', B1: '', A2: 'a', B2: 'b:', D1: '=UNIQUE(A1:B2)' };
    expect([read(cells, 'D1'), read(cells, 'D2')]).toEqual(['a:b', 'a']);
    expect(read(cells, 'E2')).toBe('b:');
  });

  it('works across when asked to', () => {
    const cells: Cells = { A1: '1', B1: '2', C1: '1', A3: '=UNIQUE(A1:C1,TRUE)' };
    expect([read(cells, 'A3'), read(cells, 'B3'), read(cells, 'C3')]).toEqual(['1', '2', '']);
  });
});

describe('SEQUENCE', () => {
  it('counts down a column by default', () => {
    const cells: Cells = { A1: '=SEQUENCE(3)' };
    expect([read(cells, 'A1'), read(cells, 'A2'), read(cells, 'A3')]).toEqual(['1', '2', '3']);
  });

  it('fills a block across and down, reading across first', () => {
    const cells: Cells = { A1: '=SEQUENCE(2,3)' };
    expect([read(cells, 'A1'), read(cells, 'B1'), read(cells, 'C1')]).toEqual(['1', '2', '3']);
    expect([read(cells, 'A2'), read(cells, 'B2'), read(cells, 'C2')]).toEqual(['4', '5', '6']);
  });

  it('starts and steps where it is told', () => {
    const cells: Cells = { A1: '=SEQUENCE(3,1,10,5)' };
    expect([read(cells, 'A1'), read(cells, 'A2'), read(cells, 'A3')]).toEqual(['10', '15', '20']);
  });

  it('refuses a block bigger than the grid rather than building it', () => {
    expect(read({ A1: `=SEQUENCE(${MAX_ROWS + 1})` }, 'A1')).toBe('#SPILL!');
    expect(read({ A1: `=SEQUENCE(1,${MAX_COLS + 1})` }, 'A1')).toBe('#SPILL!');
  });

  it('refuses a size that is not a size', () => {
    expect(read({ A1: '=SEQUENCE(0)' }, 'A1')).toBe('#VALUE!');
    expect(read({ A1: '=SEQUENCE(-2)' }, 'A1')).toBe('#VALUE!');
  });
});

describe('TEXTSPLIT', () => {
  it('lays the pieces across', () => {
    const cells: Cells = { A1: 'one,two,three', C1: '=TEXTSPLIT(A1)' };
    expect([read(cells, 'C1'), read(cells, 'D1'), read(cells, 'E1')]).toEqual(['one', 'two', 'three']);
  });

  it('splits on what it is given', () => {
    const cells: Cells = { A1: 'a|b', C1: '=TEXTSPLIT(A1,"|")' };
    expect([read(cells, 'C1'), read(cells, 'D1')]).toEqual(['a', 'b']);
  });

  it('leaves SPLIT alone, because formulas somebody typed have to keep working', () => {
    expect(read({ A1: 'one two three', C1: '=SPLIT(A1," ",2)' }, 'C1')).toBe('two');
  });
});

describe('a spill that will not fit', () => {
  it('says so in the formula’s own cell when something is in the way', () => {
    expect(read({ A1: '=SEQUENCE(3)', A2: 'mine' }, 'A1')).toBe('#SPILL!');
  });

  it('writes nothing at all rather than the part that would have fitted', () => {
    // Half a filtered list is worse than none: it reads as an answer.
    const cells: Cells = { A1: '=SEQUENCE(3)', A3: 'mine' };
    expect(read(cells, 'A1')).toBe('#SPILL!');
    expect(read(cells, 'A2')).toBe('');
    expect(read(cells, 'A3')).toBe('mine');
  });

  it('will not overwrite another formula either', () => {
    expect(read({ A1: '=SEQUENCE(2)', A2: '=1+1' }, 'A1')).toBe('#SPILL!');
  });

  it('says so when the block runs off the bottom of the grid', () => {
    const cells: Cells = { [ref(MAX_ROWS - 2, 0)]: '=SEQUENCE(4)' };
    expect(read(cells, ref(MAX_ROWS - 2, 0))).toBe('#SPILL!');
  });

  it('says so when it runs off the right-hand edge', () => {
    const cells: Cells = { [ref(0, MAX_COLS - 2)]: '=SEQUENCE(1,4)' };
    expect(read(cells, ref(0, MAX_COLS - 2))).toBe('#SPILL!');
  });

  it('lets a block that exactly reaches the last row through', () => {
    // The control on the two above. An off-by-one in the edge check would
    // refuse this one, and nothing else here would notice.
    const cells: Cells = { [ref(MAX_ROWS - 3, 0)]: '=SEQUENCE(3)' };
    expect(read(cells, ref(MAX_ROWS - 3, 0))).toBe('1');
    expect(read(cells, ref(MAX_ROWS - 1, 0))).toBe('3');
  });

  it('blocks the second of two spills that cross, by address', () => {
    /*
     * `B1` runs down through B2 and B3; `A2` runs across through B2 and C2.
     * They want B2. The one earlier by address — down the sheet, then across —
     * takes it, so `B1` lands and `A2` says so. Not whichever was typed first:
     * the same sheet has to read the same way on every machine and after every
     * reload, and object key order is the order somebody typed.
     */
    const fight: Cells = { B1: '=SEQUENCE(3)', A2: '=SEQUENCE(1,3)' };
    expect(read(fight, 'B1')).toBe('1');
    expect(read(fight, 'B2')).toBe('2');
    expect(read(fight, 'A2')).toBe('#SPILL!');
    expect(read(fight, 'C2')).toBe('');
    // Typed the other way round, the same answer.
    const other: Cells = { A2: '=SEQUENCE(1,3)', B1: '=SEQUENCE(3)' };
    expect(read(other, 'B1')).toBe('1');
    expect(read(other, 'A2')).toBe('#SPILL!');
  });
});

describe('the rest of the sheet reading a spill', () => {
  it('sums a spilled range', () => {
    expect(read({ A1: '=SEQUENCE(4)', C1: '=SUM(A1:A4)' }, 'C1')).toBe('10');
  });

  it('reads a single spilled cell by reference', () => {
    expect(read({ A1: '=SEQUENCE(3)', C1: '=A3*10' }, 'C1')).toBe('30');
  });

  it('lets one spill feed another', () => {
    // The rounds earning their keep. Without them the SORT sees three blanks.
    const cells: Cells = { A1: '=SEQUENCE(3,1,3,-1)', C1: '=SORT(A1:A3)' };
    expect([read(cells, 'C1'), read(cells, 'C2'), read(cells, 'C3')]).toEqual(['1', '2', '3']);
  });

  it('stops giving a value the moment the formula is gone', () => {
    const cells: Cells = { A1: '=SEQUENCE(3)' };
    expect(read(cells, 'A3')).toBe('3');
    const { A1: _gone, ...rest } = cells;
    expect(read(rest, 'A3')).toBe('');
  });

  it('follows the source, so a changed mark changes the spilled row', () => {
    const cells: Cells = { ...MARKS, E1: '=FILTER(A1:B3,C1:C3)' };
    expect(read(cells, 'E2')).toBe('Cy');
    expect(read({ ...cells, B2: '99' }, 'E2')).toBe('Ben');
  });
});

describe('what the rest of the app does with a spill', () => {
  it('charts a spilled range, because a chart reads cells', () => {
    const cells: Cells = { A1: 'n', A2: '=SEQUENCE(3,1,10,10)' };
    const read = readChart(
      cells,
      { id: 'c', kind: 'bar', range: 'A1:A4', title: '', headers: true, labels: false, created: 0 },
      at,
    );
    expect(read.trouble).toBe('');
    expect(read.series[0]?.values).toEqual([10, 20, 30]);
  });

  it('exports the formula, and the cells under it as blanks', () => {
    /*
     * The bug this was written for, and it was real: `fromSheet` wrote what a
     * cell *showed*, and a spilled cell shows a value while holding nothing.
     * So the export put typed-in text in exactly the cells Excel was about to
     * spill the same formula into, and Excel answers that with `#SPILL!` — a
     * file that is broken on opening, having looked right on the way out.
     */
    const sheet = { id: 's', ...blankSheet('s'), cells: { A1: '=SEQUENCE(3)' } };
    const tab = fromSheet(sheet, false, at);
    expect(tab.rows[0][0]).toMatchObject({ kind: 'formula', source: 'SEQUENCE(3)', value: '1' });
    expect(tab.rows[1][0]).toEqual({ kind: 'blank' });
    expect(tab.rows[2][0]).toEqual({ kind: 'blank' });
  });

  it('still exports an ordinary formula with the value beside it', () => {
    // The control. A `fromSheet` that blanked everything would pass the test
    // above and lose the export.
    const sheet = { id: 's', ...blankSheet('s'), cells: { A1: '2', A2: '=A1*3' } };
    const tab = fromSheet(sheet, false, at);
    expect(tab.rows[0][0]).toMatchObject({ kind: 'number', value: 2 });
    expect(tab.rows[1][0]).toMatchObject({ kind: 'formula', source: 'A1*3', value: '6' });
  });

  it('writes the spilled values into a CSV, which has no formulas to recalculate', () => {
    // The opposite call from the export above, for the opposite reason: a CSV
    // is the answers with the working thrown away, so the answers are what it
    // has to carry.
    const sheet = { id: 's', ...blankSheet('s'), cells: { A1: '=SEQUENCE(3)' } };
    expect(toCsv(filled(sheet, at))).toBe('1\r\n2\r\n3');
  });
});

describe('the pieces underneath', () => {
  it('reads a block out of a cell that holds one', () => {
    const block = blockIn({ A1: '=SEQUENCE(2,2)' }, 'A1', at);
    expect(block && [block.rows, block.cols]).toEqual([2, 2]);
    expect(block?.values.map(show)).toEqual(['1', '2', '3', '4']);
  });

  it('reads no block out of a formula that merely contains one', () => {
    // `=SEQUENCE(3)+1` asked for a number. Spilling three because a block was
    // seen on the way past would answer a question nobody put.
    expect(blockIn({ A1: '=SEQUENCE(3)+1' }, 'A1', at)).toBeNull();
    expect(blockIn({ A1: '=SUM(SEQUENCE(3))' }, 'A1', at)).toBeNull();
  });

  it('reads no block out of an ordinary formula', () => {
    expect(blockIn({ A1: '=1+1' }, 'A1', at)).toBeNull();
    expect(blockIn({ A1: '12' }, 'A1', at)).toBeNull();
  });

  it('leaves the anchor out of where a block lands', () => {
    const where = landing('B2', { values: [1, 2, 3, 4], rows: 2, cols: 2 });
    expect(where?.map((w) => w.address)).toEqual(['C2', 'B3', 'C3']);
  });

  it('has nothing to place for a block that is one cell', () => {
    expect(landing('B2', { values: [1], rows: 1, cols: 1 })).toEqual([]);
  });

  it('names the formula each spilled cell came from', () => {
    const spill = spillOf({ A1: '=SEQUENCE(3)' }, at);
    expect(spill.from.get('A2')).toBe('A1');
    expect(spill.from.get('A3')).toBe('A1');
    expect(spill.from.has('A1')).toBe(false);
  });

  it('has an empty map for a sheet with no array formula in it', () => {
    // The control on every assertion above: a probe that found spills
    // everywhere would satisfy them all.
    const spill = spillOf({ A1: '1', B1: '=SUM(A1:A1)' }, at);
    expect(spill.at.size).toBe(0);
    expect(spill.blocked.size).toBe(0);
  });

  it('gives the same answer on a second read of the same cells', () => {
    const cells: Cells = { A1: '=SEQUENCE(3)' };
    expect(show(evaluate(cells, 'A2', new Set(), at))).toBe('2');
    expect(show(evaluate(cells, 'A2', new Set(), at))).toBe('2');
  });
});
