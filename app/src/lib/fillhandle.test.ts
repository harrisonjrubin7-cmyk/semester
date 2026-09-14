import { describe, expect, it } from 'vitest';
import { fill, reachOf, wayOf, type Body } from './sheetedit';
import { at as oneCell } from './grid';
import type { Cells } from './sheet';

/**
 * The corner you drag, and the corner you press.
 *
 * The dragging is a gesture and is tested in a browser. Everything it has to
 * *decide* is here: how far a press should fill, and which of the two
 * directions a drag resolved to — both of which are wrong in the same way if
 * guessed, by quietly filling over something.
 */
const body = (cells: Cells, rows = 10, cols = 5): Body => ({ cells, styles: {}, rows, cols });

/** A gradebook: names down A, marks down B, and a formula in C2 to pull down. */
const TABLE: Cells = {
  A1: 'Student', B1: 'Mark', C1: 'Half',
  A2: 'Ada', B2: '88', C2: '=B2/2',
  A3: 'Bo', B3: '74',
  A4: 'Cy', B4: '95',
  A5: 'Dee', B5: '61',
};

describe('how far a press fills', () => {
  it('follows the column to the left, to where it stops', () => {
    expect(reachOf(body(TABLE), oneCell('C2'), 'down')).toBe('C5');
  });

  it('follows the column to the right when the selection starts at A', () => {
    expect(reachOf(body({ A2: '=1', B2: 'x', B3: 'y', B4: 'z' }), oneCell('A2'), 'down')).toBe('A4');
  });

  /* A handle that would fill nowhere should not offer to. */
  it('is nothing when the neighbour stops where the selection already does', () => {
    expect(reachOf(body(TABLE), oneCell('C5'), 'down')).toBeNull();
    expect(reachOf(body({ A1: 'x' }), oneCell('B1'), 'down')).toBeNull();
  });

  it('is nothing when there is no neighbour at all', () => {
    expect(reachOf(body({ A1: '1' }, 10, 1), oneCell('A1'), 'down')).toBeNull();
  });

  it('stops at the foot of the grid rather than past it', () => {
    const deep: Cells = { A1: 'x' };
    for (let r = 1; r <= 20; r += 1) deep[`A${r + 1}`] = String(r);
    // Six rows means row 6 is the last one there is.
    expect(reachOf(body(deep, 6, 3), oneCell('B1'), 'down')).toBe('B6');
  });

  it('does the same across, for a row', () => {
    const across: Cells = { A1: 'q1', B1: 'q2', C1: 'q3', D1: 'q4', A2: '=1' };
    expect(reachOf(body(across), oneCell('A2'), 'right')).toBe('D2');
  });

  it('carries a whole block, not just one cell', () => {
    expect(reachOf(body(TABLE), { anchor: 'C2', focus: 'D2' }, 'down')).toBe('D5');
  });
});

describe('which way a drag went', () => {
  it('takes the axis the finger moved further along', () => {
    expect(wayOf(oneCell('C2'), 'C9')).toBe('down');
    expect(wayOf(oneCell('C2'), 'H2')).toBe('right');
    // Diagonal: further down than across.
    expect(wayOf(oneCell('C2'), 'D9')).toBe('down');
    expect(wayOf(oneCell('C2'), 'H3')).toBe('right');
  });

  /*
   * Up and left are not shorter fills, they are a different gesture. Guessing
   * at one is how a handle eats the row above the thing being filled.
   */
  it('is nothing for a drag back onto itself or behind it', () => {
    expect(wayOf(oneCell('C2'), 'C2')).toBeNull();
    expect(wayOf(oneCell('C5'), 'C2')).toBeNull();
    expect(wayOf(oneCell('C5'), 'A5')).toBeNull();
    expect(wayOf(oneCell('C5'), 'nonsense')).toBeNull();
  });

  it('breaks an exact tie downwards, the way a column of formulas usually goes', () => {
    expect(wayOf(oneCell('C2'), 'D3')).toBe('down');
  });
});

describe('the fill a press then runs', () => {
  /* The point of the whole affordance: one formula written once, and `$`
     finally meaning something because something finally moves a reference. */
  it('pulls a formula down, moving the relative reference', () => {
    const reach = reachOf(body(TABLE), oneCell('C2'), 'down');
    const out = fill(body(TABLE), { anchor: 'C2', focus: reach as string }, 'down');
    expect(out.cells.C3).toBe('=B3/2');
    expect(out.cells.C4).toBe('=B4/2');
    expect(out.cells.C5).toBe('=B5/2');
  });

  it('holds a pinned reference still while it does', () => {
    const cells: Cells = { A1: 'x', A2: 'y', A3: 'z', B1: '=A1*$D$1', D1: '0.5' };
    const out = fill(body(cells), { anchor: 'B1', focus: 'B3' }, 'down');
    expect(out.cells.B2).toBe('=A2*$D$1');
    expect(out.cells.B3).toBe('=A3*$D$1');
  });
});

describe('filling while rows are hidden', () => {
  /*
   * The hazard the fill handle makes easy to hit: filter a gradebook to one
   * course, drag a formula down, and it has silently overwritten the rows of
   * the other three — an edit nobody can see, to data nobody can see.
   */
  it('writes nothing into a row the filter is hiding', () => {
    const cells: Cells = { A1: 'x', A2: 'a', A3: 'b', A4: 'c', B2: '=A2&"!"', B3: 'keep me' };
    const out = fill(body(cells), { anchor: 'B2', focus: 'B4' }, 'down', new Set([2]));
    expect(out.cells.B3).toBe('keep me');
    expect(out.cells.B4).toBe('=A4&"!"');
  });

  it('still moves the references of the rows it does write', () => {
    const cells: Cells = { A1: 'x', B1: '=A1*2' };
    const out = fill(body(cells), { anchor: 'B1', focus: 'B4' }, 'down', new Set([1, 2]));
    expect(out.cells.B2).toBeUndefined();
    expect(out.cells.B3).toBeUndefined();
    expect(out.cells.B4).toBe('=A4*2');
  });

  it('is the same fill as before when nothing is hidden', () => {
    const cells: Cells = { A1: 'x', B1: '=A1*2' };
    expect(fill(body(cells), { anchor: 'B1', focus: 'B3' }, 'down', new Set())).toEqual(
      fill(body(cells), { anchor: 'B1', focus: 'B3' }, 'down'),
    );
  });
});
