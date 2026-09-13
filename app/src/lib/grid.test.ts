import { describe, expect, it } from 'vitest';
import {
  at,
  box,
  cells,
  holds,
  label,
  many,
  saySize,
  size,
  step,
  summarise,
} from './grid';

/**
 * The selection, which is the idea the grid was missing.
 *
 * Everything here is about a rectangle described by two corners, and the
 * reason each test exists is a thing a spreadsheet does that a grid of text
 * boxes cannot.
 */
describe('a selection', () => {
  it('is one cell when it starts', () => {
    expect(label(at('B4'))).toBe('B4');
    expect(many(at('B4'))).toBe(false);
    expect(size(at('B4'))).toBe(1);
  });

  it('reads the same however it was dragged', () => {
    // Anchored bottom-right and dragged up-left is the same block as the
    // other way round. Without this the name box says `B7:A1`, which is not
    // a range any spreadsheet has ever printed.
    const up = { anchor: 'B7', focus: 'A1' };
    expect(label(up)).toBe('A1:B7');
    expect(size(up)).toBe(14);
    expect(box(up)).toEqual({ top: 0, left: 0, bottom: 6, right: 1 });
  });

  it('holds every cell inside it and nothing outside', () => {
    const sel = { anchor: 'A1', focus: 'B2' };
    expect(cells(sel)).toEqual(['A1', 'B1', 'A2', 'B2']);
    expect(holds(sel, 'B2')).toBe(true);
    expect(holds(sel, 'C1')).toBe(false);
    expect(holds(sel, 'A3')).toBe(false);
  });

  it('says its shape in words for anybody listening rather than looking', () => {
    expect(saySize(at('A1'))).toBe('A1');
    expect(saySize({ anchor: 'A1', focus: 'B7' })).toBe('A1:B7, 7 rows by 2 columns');
    expect(saySize({ anchor: 'A1', focus: 'A3' })).toBe('A1:A3, 3 rows by 1 column');
  });
});

describe('moving the cursor', () => {
  it('clamps at the edges rather than wrapping', () => {
    // An arrow key held down at the top of a column stays in A1. Wrapping to
    // the bottom of the sheet is the behaviour of a text field, not a grid.
    expect(step('A1', -1, 0, 12, 6)).toBe('A1');
    expect(step('A1', 0, -1, 12, 6)).toBe('A1');
    expect(step('F12', 1, 0, 12, 6)).toBe('F12');
    expect(step('F12', 0, 1, 12, 6)).toBe('F12');
  });

  it('stops at the sheet’s own size, not the format’s maximum', () => {
    // The grid draws `cols` columns. A cursor that walked into G on a
    // six-column sheet would be focused on an input that is not rendered.
    expect(step('E1', 0, 1, 12, 6)).toBe('F1');
    expect(step('F1', 0, 1, 12, 6)).toBe('F1');
  });

  it('moves by one in each direction', () => {
    expect(step('B2', 1, 0, 12, 6)).toBe('B3');
    expect(step('B2', -1, 0, 12, 6)).toBe('B1');
    expect(step('B2', 0, 1, 12, 6)).toBe('C2');
    expect(step('B2', 0, -1, 12, 6)).toBe('A2');
  });
});

describe('what the status line says', () => {
  const cellValues = { A1: '10', A2: '20', A3: '30', A4: 'Midterm', A5: '' };

  it('totals what is numeric and counts what is there', () => {
    const s = summarise(cellValues, ['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(s.sum).toBe(60);
    expect(s.average).toBe(20);
    // COUNT counts numbers; the word and the empty cell are not numbers, and
    // an average over four would be the wrong answer quietly.
    expect(s.count).toBe(3);
    expect(s.filled).toBe(4);
    expect(s.min).toBe(10);
    expect(s.max).toBe(30);
    expect(s.wrong).toBe(false);
  });

  it('reads formulas rather than their text', () => {
    const s = summarise({ A1: '2', A2: '=A1*3' }, ['A1', 'A2']);
    expect(s.sum).toBe(8);
    expect(s.count).toBe(2);
  });

  it('says when something in the block is an error rather than silently skipping it', () => {
    // A sum with a `#DIV/0!` in it is missing something, and the status line
    // that did not say so would be the app breaking the promise `sheet.ts`
    // makes in the cell.
    const s = summarise({ A1: '10', A2: '=1/0' }, ['A1', 'A2']);
    expect(s.wrong).toBe(true);
    expect(s.sum).toBe(10);
  });

  it('answers nothing rather than zero when there is nothing to average', () => {
    const s = summarise({ A1: 'one', A2: 'two' }, ['A1', 'A2']);
    expect(s.count).toBe(0);
    expect(s.average).toBe(0);
    expect(s.filled).toBe(2);
  });

  it('reads a typed percentage as its value, the way the engine does', () => {
    const s = summarise({ A1: '80%', A2: '20%' }, ['A1', 'A2']);
    expect(s.sum).toBeCloseTo(1);
  });
});
