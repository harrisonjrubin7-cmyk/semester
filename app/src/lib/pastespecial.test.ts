import { describe, expect, it } from 'vitest';
import { PASTE_LABELS, PASTE_WAYS, copy, pasteWay, readClip, type Body } from './sheetedit';
import { clock, evaluate, show, type Cells } from './sheet';

/**
 * The five ways a block can be put down.
 *
 * The one that matters is **values**: a formula becoming the answer it had is
 * the only one of the five that cannot be got any other way, and it is how a
 * computed column is frozen before the sheet it was computed from is thrown
 * away. The rest are conveniences; that one is a capability.
 */

const ctx = clock(0);

const CELLS: Cells = {
  A1: 'Course', B1: 'Mark', C1: 'Doubled',
  A2: 'ECON', B2: '88', C2: '=B2*2',
  A3: 'PSCI', B3: '74', C3: '=B3*2',
};

const body = (cells: Cells = CELLS, styles: Body['styles'] = {}): Body => ({
  cells: { ...cells },
  styles: { ...styles },
  rows: 20,
  cols: 8,
});

/** A clip taken the way the screen takes one — with the answers in it. */
const taken = (from: Body, range: { anchor: string; focus: string }) =>
  copy(from, range, (address) => show(evaluate(from.cells, address, new Set(), ctx)));

const at = (anchor: string, focus: string) => ({ anchor, focus });

describe('pasting everything', () => {
  it('is the plain paste, formulas moved to where they land', () => {
    const put = pasteWay(body(), 'E2', taken(body(), at('C2', 'C3')), 'everything');
    expect(put.cells.E2).toBe('=D2*2');
  });
});

describe('pasting values', () => {
  it('puts down what the formula came to, not the formula', () => {
    const put = pasteWay(body(), 'E2', taken(body(), at('C2', 'C3')), 'values');
    expect(put.cells.E2).toBe('176');
    expect(put.cells.E3).toBe('148');
  });

  /*
   * The point of the whole thing: the answer stops moving. A pasted formula
   * would re-read whatever is beside it wherever it lands; a pasted value is
   * the number that was there.
   */
  it('leaves a number that no longer depends on anything', () => {
    const one = body();
    const put = pasteWay(one, 'E2', taken(one, at('C2', 'C3')), 'values');
    const after = { ...put, cells: { ...put.cells, B2: '5' } };
    expect(evaluate(after.cells, 'E2', new Set(), ctx)).toBe(176);
    // Where the original still moves, which is what it is for.
    expect(evaluate(after.cells, 'C2', new Set(), ctx)).toBe(10);
  });

  it('leaves a typed value exactly as it was typed', () => {
    const put = pasteWay(body(), 'E1', taken(body(), at('A2', 'B2')), 'values');
    expect(put.cells.E1).toBe('ECON');
    expect(put.cells.F1).toBe('88');
  });

  it('carries an error across as the error, rather than as an empty cell', () => {
    const broken = body({ A1: '=1/0' });
    const put = pasteWay(broken, 'C1', taken(broken, at('A1', 'A1')), 'values');
    expect(put.cells.C1).toBe('#DIV/0!');
  });

  it('brings no formatting with it', () => {
    const styled = body(CELLS, { C2: { bold: true } });
    const put = pasteWay(styled, 'E2', taken(styled, at('C2', 'C2')), 'values');
    expect(put.styles.E2).toBeUndefined();
  });

  /*
   * Text off the system clipboard has no answers behind it, because it never
   * had formulas. Its text is its value, so this is not a special case in the
   * code — it is what those words mean about text.
   */
  it('pastes plain clipboard text as itself', () => {
    const clip = readClip('7\t8\n9\t10');
    expect(clip).not.toBeNull();
    const put = pasteWay(body(), 'E1', clip!, 'values');
    expect(put.cells.E1).toBe('7');
    expect(put.cells.F2).toBe('10');
  });
});

describe('pasting formulas without formatting', () => {
  it('brings the formula', () => {
    const styled = body(CELLS, { C2: { bold: true, ink: 'red' } });
    const put = pasteWay(styled, 'E2', taken(styled, at('C2', 'C2')), 'formulas');
    expect(put.cells.E2).toBe('=D2*2');
  });

  it('leaves the colours behind', () => {
    const styled = body(CELLS, { C2: { bold: true, ink: 'red' } });
    const put = pasteWay(styled, 'E2', taken(styled, at('C2', 'C2')), 'formulas');
    expect(put.styles.E2).toBeUndefined();
  });

  it('does not disturb formatting already where it lands', () => {
    const styled = body(CELLS, { C2: { bold: true }, E2: { italic: true } });
    const put = pasteWay(styled, 'E2', taken(styled, at('C2', 'C2')), 'formulas');
    expect(put.styles.E2).toEqual({ italic: true });
  });
});

describe('pasting formatting only', () => {
  const styled = body(CELLS, { B2: { bold: true, ink: 'red' } });

  it('brings the formatting', () => {
    const put = pasteWay(styled, 'E5', taken(styled, at('B2', 'B2')), 'formats');
    expect(put.styles.E5).toEqual({ bold: true, ink: 'red' });
  });

  /*
   * The one way that deletes nothing. "Make this column look like that one"
   * is the whole of what somebody means by it, and a version that emptied the
   * cells on the way would be useless for exactly that.
   */
  it('changes no value, which is the whole point of it', () => {
    const put = pasteWay(styled, 'A2', taken(styled, at('B2', 'B3')), 'formats');
    expect(put.cells.A2).toBe('ECON');
    expect(put.cells.A3).toBe('PSCI');
  });

  it('clears formatting where the block it came from had none', () => {
    const both = body(CELLS, { B2: { bold: true }, E5: { italic: true } });
    const put = pasteWay(both, 'E5', taken(both, at('A2', 'A2')), 'formats');
    expect(put.styles.E5).toBeUndefined();
  });
});

describe('pasting transposed', () => {
  it('turns a row into a column', () => {
    const put = pasteWay(body(), 'E1', taken(body(), at('A1', 'C1')), 'transpose');
    expect(put.cells.E1).toBe('Course');
    expect(put.cells.E2).toBe('Mark');
    expect(put.cells.E3).toBe('Doubled');
  });

  it('turns a column into a row', () => {
    const put = pasteWay(body(), 'E1', taken(body(), at('A1', 'A3')), 'transpose');
    expect(put.cells.E1).toBe('Course');
    expect(put.cells.F1).toBe('ECON');
    expect(put.cells.G1).toBe('PSCI');
  });

  it('flips a block both ways at once', () => {
    const put = pasteWay(body(), 'E1', taken(body(), at('A1', 'B2')), 'transpose');
    // A1 B1 / A2 B2  becomes  A1 A2 / B1 B2
    expect([put.cells.E1, put.cells.F1]).toEqual(['Course', 'ECON']);
    expect([put.cells.E2, put.cells.F2]).toEqual(['Mark', '88']);
  });

  it('brings the formatting round with it', () => {
    const styled = body(CELLS, { B1: { bold: true } });
    const put = pasteWay(styled, 'E1', taken(styled, at('A1', 'B1')), 'transpose');
    expect(put.styles.E2).toEqual({ bold: true });
  });

  /*
   * A transposed paste moves a cell by a different amount depending on where
   * it sat in the block — the offset for the cell at (1, 4) is not the offset
   * for the one at (4, 1) — so there is no single translation that is right
   * for the block. Written as it stood rather than moved wrongly.
   */
  it('leaves the formulas as they were written rather than moving them wrongly', () => {
    const put = pasteWay(body(), 'E1', taken(body(), at('C2', 'C3')), 'transpose');
    expect(put.cells.E1).toBe('=B2*2');
    expect(put.cells.F1).toBe('=B3*2');
  });

  it('grows the grid the other way round', () => {
    const narrow: Body = { cells: { A1: '1' }, styles: {}, rows: 1, cols: 1 };
    const wide = copy({ ...narrow, rows: 4, cols: 1, cells: { A1: '1', A2: '2', A3: '3', A4: '4' } }, at('A1', 'A4'));
    const put = pasteWay(narrow, 'A1', wide, 'transpose');
    expect(put.cols).toBeGreaterThanOrEqual(4);
  });
});

it('has a label for every way, so none can reach a menu unnamed', () => {
  for (const way of PASTE_WAYS) {
    expect(PASTE_LABELS[way].length).toBeGreaterThan(0);
  }
});
