import { describe, expect, it } from 'vitest';
import {
  cellsOf,
  coveredBy,
  hiddenBy,
  joinAt,
  joinsOf,
  landOn,
  saysJoin,
  spanOf,
  spansAt,
  whyNotJoin,
  withJoin,
  withoutJoin,
} from './joined';

/**
 * Cells joined into one.
 *
 * The property behind most of these: the covered cells are *cleared*, not
 * hidden. `=SUM(A1:C1)` over a joined block must not add up two values nobody
 * can see — that is the hidden-row trap with no filter visible to explain it.
 * See the head of `lib/joined.ts`.
 */

const span = (range: string) => spanOf(range)!;

describe('reading a range as a block', () => {
  it('takes the two corners and the reach between them', () => {
    expect(spanOf('A1:C1')).toEqual({ anchor: 'A1', rows: 1, cols: 3, range: 'A1:C1' });
  });

  it('normalises one written backwards, so the anchor is always the top-left', () => {
    expect(spanOf('C3:A1')).toEqual({ anchor: 'A1', rows: 3, cols: 3, range: 'A1:C3' });
  });

  /*
   * A single cell is not a join. Storing one would be a row in the list that
   * does nothing except make every map built from it bigger.
   */
  it('refuses a single cell', () => {
    expect(spanOf('A1')).toBeNull();
    expect(spanOf('A1:A1')).toBeNull();
  });

  it('refuses something that is not a range at all', () => {
    expect(spanOf('hello')).toBeNull();
  });
});

describe('the cells a block covers', () => {
  it('counts every one of them, the anchor included', () => {
    expect(cellsOf(span('A1:B2'))).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('and names the ones that get cleared, which is all but the anchor', () => {
    expect(hiddenBy(span('A1:B2'))).toEqual(['B1', 'A2', 'B2']);
  });
});

describe('the two maps the grid asks', () => {
  const joins = [span('A1:C1'), span('E5:E7')];

  it('says which cells are not drawn', () => {
    const covered = coveredBy(joins);
    expect(covered.get('B1')).toBe('A1');
    expect(covered.get('E6')).toBe('E5');
  });

  /*
   * The anchor is deliberately not in the covered map, so `covered.has(a)` is
   * exactly the question *is this cell not drawn* — and a grid that put its
   * anchors in would draw nothing at all.
   */
  it('and never counts an anchor as covered, or the block would not be drawn', () => {
    expect(coveredBy(joins).has('A1')).toBe(false);
    expect(coveredBy(joins).has('E5')).toBe(false);
  });

  it('says what each anchor spans', () => {
    expect(spansAt(joins).get('A1')?.cols).toBe(3);
    expect(spansAt(joins).get('E5')?.rows).toBe(3);
  });
});

/**
 * A covered cell has no box to focus, so an arrow key into one would move the
 * selection somewhere invisible and the grid would stop answering the
 * keyboard. `go` sends every move through this.
 */
describe('where the cursor lands', () => {
  const covered = coveredBy([span('A1:C1')]);

  it('on the cell that draws the block, when it moves onto a covered one', () => {
    expect(landOn(covered, 'B1')).toBe('A1');
  });

  it('on itself, everywhere else', () => {
    expect(landOn(covered, 'D4')).toBe('D4');
  });
});

describe('what stops a block being joined', () => {
  const joins = [span('A1:C1')];

  it('nothing, where it is free', () => {
    expect(whyNotJoin(joins, 'A5:C5')).toBe('');
  });

  it('a single cell, which is not a join', () => {
    expect(whyNotJoin(joins, 'A5')).toContain('more than one cell');
  });

  /*
   * A block cutting across an existing join has no drawing: the alternatives
   * are unjoining somebody's heading without being asked, or a table the
   * browser renders with a hole in it.
   */
  it('a block that would cut an existing one in half', () => {
    expect(whyNotJoin(joins, 'B1:B3')).toContain('already joined');
  });

  it('but not one that swallows an existing join whole', () => {
    expect(whyNotJoin(joins, 'A1:C3')).toBe('');
  });
});

describe('adding and removing', () => {
  it('adds one', () => {
    expect(withJoin([], 'A1:C1').map((s) => s.range)).toEqual(['A1:C1']);
  });

  it('replaces one it completely covers rather than leaving both', () => {
    const after = withJoin([span('A1:C1')], 'A1:C3');
    expect(after.map((s) => s.range)).toEqual(['A1:C3']);
  });

  it('takes one away by any cell inside it, not only by its anchor', () => {
    expect(withoutJoin([span('A1:C1')], 'B1')).toEqual([]);
  });

  it('leaves the others alone', () => {
    const after = withoutJoin([span('A1:C1'), span('A5:C5')], 'B1');
    expect(after.map((s) => s.range)).toEqual(['A5:C5']);
  });

  it('finds the block covering a cell, anchor or not', () => {
    const joins = [span('A1:C1')];
    expect(joinAt(joins, 'A1')?.range).toBe('A1:C1');
    expect(joinAt(joins, 'C1')?.range).toBe('A1:C1');
    expect(joinAt(joins, 'D1')).toBeUndefined();
  });
});

describe('reading them off a stored sheet', () => {
  it('finds them', () => {
    expect(joinsOf({ joins: ['A1:C1'] }).map((s) => s.range)).toEqual(['A1:C1']);
  });

  it('answers with none for a sheet that has never had one', () => {
    expect(joinsOf({})).toEqual([]);
  });

  /*
   * Two blocks each claiming the same cell have no arrangement that draws
   * correctly, and picking one would be this file deciding which of somebody's
   * two headings is real. The earlier one keeps the cell.
   */
  it('drops one that overlaps a block already read', () => {
    expect(joinsOf({ joins: ['A1:C1', 'B1:B3'] }).map((s) => s.range)).toEqual(['A1:C1']);
  });

  it('drops anything that is not a range', () => {
    expect(joinsOf({ joins: ['nonsense', 'A1', null, 7] })).toEqual([]);
  });

  it('survives a sheet whose joins are not even a list', () => {
    expect(joinsOf({ joins: 'A1:C1' })).toEqual([]);
  });

  it('normalises what it reads, so a backwards range is stored forwards', () => {
    expect(joinsOf({ joins: ['C3:A1'] })[0].anchor).toBe('A1');
  });
});

describe('what it says happened', () => {
  it('says across for a row', () => {
    expect(saysJoin(span('A1:C1'))).toBe('A1:C1 joined across');
  });

  it('says down for a column', () => {
    expect(saysJoin(span('A1:A3'))).toBe('A1:A3 joined down');
  });

  it('says into one for a block that is both', () => {
    expect(saysJoin(span('A1:C3'))).toBe('A1:C3 joined into one');
  });
});
