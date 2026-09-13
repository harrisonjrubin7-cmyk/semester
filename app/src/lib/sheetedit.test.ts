import { describe, expect, it } from 'vitest';
import {
  autoSum,
  clear,
  clipText,
  copy,
  deleteCols,
  deleteRows,
  fill,
  find,
  insertCols,
  insertRows,
  paste,
  readClip,
  replaceAll,
  shift,
  sortRange,
  sortable,
  translate,
  type Body,
} from './sheetedit';
import { display } from './sheet';

/** A body from a sparse map, so a test reads as the sheet it is about. */
function body(cells: Record<string, string>, rows = 12, cols = 6): Body {
  return { cells, styles: {}, rows, cols };
}

/**
 * Moving a formula, which is the thing under every other function here.
 *
 * A total that adds up the wrong rows is the worst failure this app can have,
 * because it is invisible: the sheet still looks right. So this is the part
 * that is tested hardest.
 */
describe('translating a formula', () => {
  it('moves the references with it', () => {
    expect(translate('=SUM(B2:B9)', 0, 2)).toBe('=SUM(D2:D9)');
    expect(translate('=B2*2', 1, 0)).toBe('=B3*2');
  });

  it('holds a reference the dollar signs hold', () => {
    // The rate in F1 keeps being the rate however far down the column the
    // formula is dragged, and the row keeps being this row.
    expect(translate('=B2*$F$1', 3, 0)).toBe('=B5*$F$1');
    expect(translate('=$B2+C$3', 1, 1)).toBe('=$B3+D$3');
  });

  it('leaves function names and text alone', () => {
    // `LOG10(` is one word to a lazy pattern and two things to this one.
    expect(translate('=LOG10(A1)', 1, 0)).toBe('=LOG10(A2)');
    expect(translate('=IF(A1>0,"A1 is positive","")', 1, 0)).toBe(
      '=IF(A2>0,"A1 is positive","")',
    );
  });

  it('says #REF! rather than clamping to the edge', () => {
    // Clamping is the failure that hides — the formula still computes, on the
    // wrong cell, and the number looks like an answer.
    expect(translate('=A1+1', -1, 0)).toBe('=#REF!+1');
    expect(translate('=SUM(A1:A4)', 0, -1)).toBe('=SUM(#REF!:#REF!)');
  });

  it('is not fooled by a sheet with no formula in it', () => {
    expect(translate('12', 3, 3)).toBe('12');
    expect(translate('Midterm', 3, 3)).toBe('Midterm');
  });
});

describe('shifting a formula when the grid moves under it', () => {
  it('moves only what is at or past the change', () => {
    expect(shift('=SUM(B2:B9)', 'row', 3, 1)).toBe('=SUM(B2:B10)');
    expect(shift('=B2+B9', 'row', 0, 2)).toBe('=B4+B11');
  });

  it('ignores dollar signs, because the grid moved rather than the formula', () => {
    expect(shift('=$B$9', 'row', 3, 1)).toBe('=$B$10');
  });

  it('says #REF! for a cell that was deleted', () => {
    expect(shift('=B4+B9', 'row', 3, -2)).toBe('=#REF!+B7');
  });

  /**
   * A range is one thing, not two references.
   *
   * Deleting one reading out of the middle of a gradebook must not break the
   * total under it — which is what handling the two ends separately does.
   */
  it('shrinks a range a deletion reached into', () => {
    expect(shift('=SUM(A2:A3)', 'row', 2, -1)).toBe('=SUM(A2:A2)');
    expect(shift('=SUM(A1:A9)', 'row', 3, -2)).toBe('=SUM(A1:A7)');
  });

  it('clamps an end that was inside the gap to the edge of it', () => {
    // Rows 4 and 5 go; a range of 5:9 starts in the gap and comes back to 4.
    expect(shift('=SUM(A5:A9)', 'row', 3, -2)).toBe('=SUM(A4:A7)');
  });

  it('breaks only a range whose every row went', () => {
    expect(shift('=SUM(A4:A5)', 'row', 3, -2)).toBe('=SUM(#REF!)');
  });

  it('grows a range a row was inserted into', () => {
    expect(shift('=SUM(A2:A3)', 'row', 2, 1)).toBe('=SUM(A2:A4)');
  });
});

describe('rows and columns', () => {
  it('puts a row in the middle and takes the formulas with it', () => {
    // The whole point: forgetting a reading on line 4 used to mean retyping
    // everything under it and then finding the total by hand.
    const was = body({ A1: 'Mark', A2: '80', A3: '90', A4: '=SUM(A2:A3)' });
    const now = insertRows(was, 1);
    expect(now.cells.A2).toBeUndefined();
    expect(now.cells.A3).toBe('80');
    expect(now.cells.A5).toBe('=SUM(A3:A4)');
    expect(now.rows).toBe(13);
  });

  it('closes the gap when a row goes, and says #REF! for what it held', () => {
    const was = body({ A1: '1', A2: '2', A3: '3', B1: '=A2' });
    const now = deleteRows(was, 1);
    expect(now.cells.A2).toBe('3');
    expect(now.cells.B1).toBe('=#REF!');
    expect(now.rows).toBe(11);
  });

  it('never deletes the last row', () => {
    const one = body({ A1: 'x' }, 1, 1);
    expect(deleteRows(one, 0)).toBe(one);
  });

  it('does the same sideways', () => {
    const was = body({ A1: 'a', B1: 'b', C1: '=A1' });
    const now = insertCols(was, 1);
    expect(now.cells.C1).toBe('b');
    expect(now.cells.D1).toBe('=A1');
    expect(now.cols).toBe(7);
    // And back again: the column that was put in comes out, and everything
    // reads as it did before.
    const back = deleteCols(now, 1);
    expect([back.cells.A1, back.cells.B1, back.cells.C1]).toEqual(['a', 'b', '=A1']);
  });

  it('carries the formatting with the cell', () => {
    const was: Body = { cells: { A3: '0.8' }, styles: { A3: { num: 'percent' } }, rows: 5, cols: 3 };
    expect(insertRows(was, 0).styles.A4).toEqual({ num: 'percent' });
  });
});

describe('filling', () => {
  it('drags one formula down a column', () => {
    const was = body({ B2: '80', B3: '90', C2: '=B2/100' });
    const now = fill(was, { anchor: 'C2', focus: 'C3' }, 'down');
    expect(now.cells.C3).toBe('=B3/100');
  });

  it('holds what the dollar signs hold', () => {
    const was = body({ F1: '0.4', B2: '80', C2: '=B2*$F$1' });
    const now = fill(was, { anchor: 'C2', focus: 'C4' }, 'down');
    expect(now.cells.C3).toBe('=B3*$F$1');
    expect(now.cells.C4).toBe('=B4*$F$1');
  });

  it('fills across as well as down', () => {
    const was = body({ A1: '=A2', A2: '1', B2: '2' });
    expect(fill(was, { anchor: 'A1', focus: 'B1' }, 'right').cells.B1).toBe('=B2');
  });

  it('clears what it is filled over when the source is empty', () => {
    // A fill that skipped the blanks would leave a column half old and half
    // new, which is worse than either.
    const was = body({ A2: 'stale' });
    expect(fill(was, { anchor: 'A1', focus: 'A3' }, 'down').cells.A2).toBeUndefined();
  });

  it('brings the format down with the value', () => {
    const was: Body = {
      cells: { A1: '0.8', A2: '0.9' },
      styles: { A1: { num: 'percent' } },
      rows: 5,
      cols: 3,
    };
    expect(fill(was, { anchor: 'A1', focus: 'A2' }, 'down').styles.A2).toEqual({ num: 'percent' });
  });
});

describe('sorting', () => {
  const marks = body({
    A1: 'Ana',
    B1: '90',
    A2: 'Bo',
    B2: '10',
    A3: 'Cy',
    B3: '2',
  });

  it('reads numbers as numbers', () => {
    // 2, 10, 90 rather than 10, 2, 90, which is what sorting the text gives.
    const now = sortRange(marks, { anchor: 'A1', focus: 'B3' }, 1);
    expect([now.cells.B1, now.cells.B2, now.cells.B3]).toEqual(['2', '10', '90']);
    expect([now.cells.A1, now.cells.A2, now.cells.A3]).toEqual(['Cy', 'Bo', 'Ana']);
  });

  it('moves the whole row, not the column', () => {
    const now = sortRange(marks, { anchor: 'A1', focus: 'B3' }, 1, 'desc');
    expect(now.cells.A1).toBe('Ana');
    expect(now.cells.B1).toBe('90');
  });

  it('leaves the blanks at the bottom either way', () => {
    const gappy = body({ A1: 'b', A3: 'a' });
    const asc = sortRange(gappy, { anchor: 'A1', focus: 'A3' }, 0);
    expect(asc.cells.A1).toBe('a');
    const desc = sortRange(gappy, { anchor: 'A1', focus: 'A3' }, 0, 'desc');
    expect(desc.cells.A3).toBeUndefined();
  });

  it('refuses a block with a formula in it rather than breaking the formula', () => {
    const withSum = body({ A1: '2', A2: '1', A3: '=SUM(A1:A2)' });
    const range = { anchor: 'A1', focus: 'A3' };
    expect(sortable(withSum, range)).toBe(false);
    expect(sortRange(withSum, range, 0)).toBe(withSum);
  });
});

describe('find and replace', () => {
  const sheet = body({ A1: 'Midterm', A2: 'midterm two', B1: '=SUM(A1:A2)' });

  it('searches what was typed, not what is shown', () => {
    // The formula, not the 162 it produced — otherwise replacing does nothing
    // anybody can see.
    expect(find(sheet, 'SUM').map((f) => f.address)).toEqual(['B1']);
  });

  it('ignores case unless asked not to', () => {
    expect(find(sheet, 'midterm')).toHaveLength(2);
    expect(find(sheet, 'midterm', true)).toHaveLength(1);
  });

  it('replaces everywhere and says how many', () => {
    const { body: now, changed } = replaceAll(sheet, 'midterm', 'Final');
    expect(changed).toBe(2);
    expect(now.cells.A1).toBe('Final');
    expect(now.cells.A2).toBe('Final two');
  });

  it('empties a cell whose whole content was replaced away', () => {
    const { body: now } = replaceAll(body({ A1: 'x' }), 'x', '');
    expect(now.cells.A1).toBeUndefined();
  });
});

describe('copy and paste', () => {
  const marks = body({ B2: '80', B3: '90', B4: '=SUM(B2:B3)' });

  it('moves the formulas with the block', () => {
    const clip = copy(marks, { anchor: 'B2', focus: 'B4' });
    const now = paste(marks, 'D2', clip);
    expect(now.cells.D4).toBe('=SUM(D2:D3)');
    expect(display(now.cells, 'D4')).toBe('170');
  });

  it('leaves the original where it was, and a cut does not', () => {
    const range = { anchor: 'B2', focus: 'B3' };
    expect(copy(marks, range).cells).toEqual([['80'], ['90']]);
    expect(clear(marks, range).cells.B2).toBeUndefined();
  });

  it('grows the grid rather than cropping the paste', () => {
    // A twelve-row paste into a ten-row sheet quietly becoming ten rows is two
    // readings missing from a gradebook.
    const small = body({ A1: '1' }, 3, 2);
    const clip = copy(body({ A1: '1', A2: '2', A3: '3' }), { anchor: 'A1', focus: 'A3' });
    const now = paste(small, 'B2', clip);
    expect(now.rows).toBe(4);
    expect(now.cells.B4).toBe('3');
  });

  it('goes out as the tab-separated text every other spreadsheet reads', () => {
    const clip = copy(body({ A1: 'a', B1: 'b', A2: 'c', B2: 'd' }), {
      anchor: 'A1',
      focus: 'B2',
    });
    expect(clipText(clip)).toBe('a\tb\nc\td');
  });

  it('reads that text back, newlines inside a cell and all', () => {
    const clip = readClip('a\tb\n"one\ntwo"\td');
    expect(clip?.rows).toBe(2);
    expect(clip?.cells[1][0]).toBe('one\ntwo');
  });

  it('pastes clipboard text where it lands, without translating it', () => {
    // Text off the clipboard has no idea where it came from, so a formula in
    // it is put down as written rather than moved by a guess.
    const clip = readClip('=SUM(B2:B9)');
    expect(clip && paste(body({}), 'D4', clip).cells.D4).toBe('=SUM(B2:B9)');
  });
});

describe('autosum', () => {
  it('puts a total under a selected block', () => {
    const marks = body({ B2: '80', B3: '90' });
    expect(autoSum(marks, { anchor: 'B2', focus: 'B3' })).toEqual({
      at: 'B4',
      formula: '=SUM(B2:B3)',
    });
  });

  it('takes the run of filled cells above a single cell', () => {
    const marks = body({ B1: 'Mark', B2: '80', B3: '90' });
    expect(autoSum(marks, { anchor: 'B4', focus: 'B4' })?.formula).toBe('=SUM(B1:B3)');
  });

  it('looks left when there is nothing above', () => {
    const row = body({ A1: '1', B1: '2' });
    expect(autoSum(row, { anchor: 'C1', focus: 'C1' })?.formula).toBe('=SUM(A1:B1)');
  });

  it('has nothing to offer an empty sheet', () => {
    expect(autoSum(body({}), { anchor: 'C3', focus: 'C3' })).toBeNull();
  });

  it('goes under a block that reaches the last row, rather than inside it', () => {
    // Clamping put the SUM in its own range, and the cell read #CYCLE!. The
    // caller grows the grid by the row this asks for.
    const short = body({ A1: '1', A2: '2' }, 2, 2);
    expect(autoSum(short, { anchor: 'A1', focus: 'A2' })).toEqual({
      at: 'A3',
      formula: '=SUM(A1:A2)',
    });
  });

  it('writes whatever function it was asked for', () => {
    const marks = body({ B2: '80', B3: '90' });
    expect(autoSum(marks, { anchor: 'B2', focus: 'B3' }, 'AVERAGE')?.formula).toBe(
      '=AVERAGE(B2:B3)',
    );
  });
});
