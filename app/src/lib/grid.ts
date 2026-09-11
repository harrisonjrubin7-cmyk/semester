/**
 * A selection, and moving one around.
 *
 * The grid in `screens/Sheet.tsx` had a cursor and nothing else: one cell at a
 * time, reached by tapping it, cleared by deleting its text. That is a table of
 * inputs rather than a spreadsheet, and the gap shows in the three things
 * anybody does with a sheet within a minute of opening one — run down a column
 * with the arrow keys, drag across a block to see what it adds up to, and
 * press Bold on more than one cell.
 *
 * All three are the same missing idea: a *range*. So a range is what the screen
 * holds, and everything about it is here — pure, with no DOM and no store, for
 * the reason the note at the top of `sheet.ts` gives about the arithmetic.
 *
 * ## Two corners, not a list
 *
 * A selection is `anchor` and `focus`: where it started and where it has got
 * to. Shift-clicking or shift-arrowing moves the focus and leaves the anchor,
 * which is what makes a selection grow and shrink from the end you are
 * holding rather than jumping. The list of cells is derived when something
 * needs it, so a selection of a thousand cells costs two strings.
 */

import {
  MAX_COLS,
  MAX_ROWS,
  asNumber,
  evaluate,
  isError,
  parseRef,
  ref,
  type Cells,
  type Value,
} from './sheet';

/** Where a selection started and where it has got to. */
export interface Range {
  anchor: string;
  focus: string;
}

/** One cell, selected. */
export function at(address: string): Range {
  return { anchor: address, focus: address };
}

/** The rectangle two corners describe, in row and column indices. */
export function box(range: Range): { top: number; left: number; bottom: number; right: number } {
  const a = parseRef(range.anchor) ?? { row: 0, col: 0 };
  const b = parseRef(range.focus) ?? a;
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

/** Whether a cell is inside the selection — what draws the highlight. */
export function holds(range: Range, address: string): boolean {
  const where = parseRef(address);
  if (!where) return false;
  const b = box(range);
  return where.row >= b.top && where.row <= b.bottom && where.col >= b.left && where.col <= b.right;
}

/** How many cells are in it. Cheap, for a screen that asks on every render. */
export function size(range: Range): number {
  const b = box(range);
  return (b.bottom - b.top + 1) * (b.right - b.left + 1);
}

/** Every cell in the selection, in reading order. */
export function cells(range: Range): string[] {
  const b = box(range);
  const out: string[] = [];
  for (let r = b.top; r <= b.bottom; r += 1) {
    for (let c = b.left; c <= b.right; c += 1) out.push(ref(r, c));
  }
  return out;
}

/**
 * What the name box says.
 *
 * `A1` for one cell and `A1:B7` for a block — the two forms Google Sheets and
 * Excel both use, and the second is the one worth having: it is how somebody
 * checks that the range they are about to total is the range they meant.
 */
export function label(range: Range): string {
  const b = box(range);
  const from = ref(b.top, b.left);
  const to = ref(b.bottom, b.right);
  return from === to ? from : `${from}:${to}`;
}

/** How big the selection is, said in words, for a screen reader and the status line. */
export function saySize(range: Range): string {
  const b = box(range);
  const rows = b.bottom - b.top + 1;
  const cols = b.right - b.left + 1;
  if (rows === 1 && cols === 1) return label(range);
  return `${label(range)}, ${rows} ${rows === 1 ? 'row' : 'rows'} by ${cols} ${cols === 1 ? 'column' : 'columns'}`;
}

/**
 * A step from a cell, clamped to the grid.
 *
 * Clamped rather than wrapped or refused: an arrow key held down at the top of
 * a column stays in A1, which is what every spreadsheet does and what the hand
 * expects. The bounds are the sheet's own size, not the format's maximum, so
 * the cursor cannot walk off into columns the grid is not drawing.
 */
export function step(
  address: string,
  dr: number,
  dc: number,
  rows: number,
  cols: number,
): string {
  const where = parseRef(address);
  if (!where) return address;
  const top = Math.min(rows, MAX_ROWS) - 1;
  const right = Math.min(cols, MAX_COLS) - 1;
  return ref(
    Math.min(Math.max(0, where.row + dr), Math.max(0, top)),
    Math.min(Math.max(0, where.col + dc), Math.max(0, right)),
  );
}

/** What the bottom-right of a spreadsheet says about what you have selected. */
export interface Summary {
  /** Cells holding a number. The rest are not counted, as `COUNT` does not. */
  count: number;
  /** Cells holding anything at all, which is what `COUNTA` answers. */
  filled: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  /** Whether anything in the selection is an error, so the line can say so. */
  wrong: boolean;
}

/**
 * The numbers under a selection.
 *
 * Sum, average, count, minimum and maximum — the five a spreadsheet puts in
 * its status bar, and the reason that bar exists: the commonest question about
 * a column is answered by looking at it rather than by writing a formula,
 * deciding where to put it, and then deleting it again.
 *
 * Errors are counted as errors rather than skipped. A selection with a
 * `#DIV/0!` in it has a sum that is missing something, and saying so is the
 * same promise the engine makes in the cell.
 */
export function summarise(cellValues: Cells, addresses: string[]): Summary {
  let count = 0;
  let filled = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let wrong = false;

  for (const address of addresses) {
    const value: Value = evaluate(cellValues, address);
    if (value === '') continue;
    filled += 1;
    if (isError(value)) {
      wrong = true;
      continue;
    }
    const n = typeof value === 'number' ? value : asNumber(String(value));
    if (n === null || !Number.isFinite(n)) continue;
    count += 1;
    sum += n;
    min = Math.min(min, n);
    max = Math.max(max, n);
  }

  return {
    count,
    filled,
    sum,
    average: count === 0 ? 0 : sum / count,
    min: count === 0 ? 0 : min,
    max: count === 0 ? 0 : max,
    wrong,
  };
}

/** Whether the selection is more than one cell. */
export function many(range: Range): boolean {
  return size(range) > 1;
}
