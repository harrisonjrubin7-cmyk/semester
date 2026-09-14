/**
 * Cells joined into one.
 *
 * A title across the top of a gradebook, a heading spanning the three columns
 * of a term — the one piece of layout a spreadsheet has, and what a sheet that
 * is meant to be *read* rather than only computed needs.
 *
 * Called `joined` rather than `merge` because `lib/merge.ts` is this app's
 * sync: two devices' lists brought together without either losing what it did.
 * Two files named for the same word, one of them about cells and one about
 * accounts, is a mistake waiting in an import line.
 *
 * ## The covered cells are emptied, and that is the honest choice
 *
 * Joining `A1:C1` keeps what is in `A1` and clears `B1` and `C1`. That is what
 * Excel does, and the temptation is to do better — keep them hidden, give them
 * back on unjoining, lose nothing.
 *
 * It would be worse. `=SUM(A1:C1)` would then add up two values nobody can
 * see, on a sheet that shows one. That is the hidden-row trap from
 * `lib/filter.ts` with no filter visible to explain it, and a total that is
 * wrong for a reason nothing on the screen mentions is the fault this whole
 * area of the app is arranged against. So what is shown is what is summed, the
 * clearing is said out loud when it happens, and undo is one step away.
 *
 * ## A join is a fact about the sheet, not about a cell
 *
 * It lives on the sheet as a list of ranges rather than as a flag on a style,
 * because it is a claim about *several* cells at once and no one of them owns
 * it. That also makes the two questions the grid asks cheap: what does this
 * cell span, and is this cell covered by one — each a map built once a render.
 */

import { corners } from './chart';
import { MAX_COLS, MAX_ROWS, ref } from './sheet';

/** Where a join starts and how far it reaches. */
export interface Span {
  /** The top-left cell: the one that is drawn, and the one that holds the value. */
  anchor: string;
  rows: number;
  cols: number;
  /** The whole block, normalised — `"A1:C1"`. */
  range: string;
}

/**
 * A range written the way a join stores one: top-left to bottom-right.
 *
 * `null` for anything that is not a block of more than one cell. A single cell
 * is not a join, and storing one would be a row in the list that does nothing
 * but make every map below bigger.
 */
export function spanOf(range: string): Span | null {
  const at = corners(range);
  if (!at) return null;
  if (at.bottom >= MAX_ROWS || at.right >= MAX_COLS) return null;
  const rows = at.bottom - at.top + 1;
  const cols = at.right - at.left + 1;
  if (rows * cols <= 1) return null;
  return {
    anchor: ref(at.top, at.left),
    rows,
    cols,
    range: `${ref(at.top, at.left)}:${ref(at.bottom, at.right)}`,
  };
}

/** Every address a span covers, the anchor included. */
export function cellsOf(span: Span): string[] {
  const at = corners(span.range);
  if (!at) return [];
  const out: string[] = [];
  for (let r = at.top; r <= at.bottom; r += 1) {
    for (let c = at.left; c <= at.right; c += 1) out.push(ref(r, c));
  }
  return out;
}

/** The addresses a span covers *apart* from its anchor — the ones that are cleared. */
export function hiddenBy(span: Span): string[] {
  return cellsOf(span).filter((a) => a !== span.anchor);
}

/**
 * The joins a sheet holds, normalised, with anything malformed dropped.
 *
 * Overlapping joins are dropped rather than resolved: two blocks each claiming
 * the same cell have no arrangement that draws correctly, and picking one
 * would be this file deciding which of somebody's two headings is real. The
 * earlier one keeps the cell — the same *first wins* every other list of
 * ranges here uses.
 */
export function joinsOf(sheet: { joins?: unknown }): Span[] {
  if (!Array.isArray(sheet.joins)) return [];
  const out: Span[] = [];
  const taken = new Set<string>();
  for (const row of sheet.joins) {
    if (typeof row !== 'string') continue;
    const span = spanOf(row);
    if (!span) continue;
    const cells = cellsOf(span);
    if (cells.some((a) => taken.has(a))) continue;
    for (const a of cells) taken.add(a);
    out.push(span);
  }
  return out;
}

/**
 * Every covered cell, pointing at the anchor that stands for it.
 *
 * Built once a render and asked once a cell. The anchor is deliberately not in
 * it: a cell either draws itself or is answered for by one that does, so
 * `covered.has(address)` is exactly the question *is this cell not drawn*.
 */
export function coveredBy(joins: readonly Span[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const span of joins) {
    for (const a of hiddenBy(span)) out.set(a, span.anchor);
  }
  return out;
}

/** The spans by the anchor that draws them, for the one cell in each that does. */
export function spansAt(joins: readonly Span[]): Map<string, Span> {
  return new Map(joins.map((span) => [span.anchor, span]));
}

/**
 * Where a cursor moving onto an address actually lands.
 *
 * A covered cell is not drawn, so it has no input to focus; without this an
 * arrow key into one moves the selection somewhere invisible and the grid
 * stops answering the keyboard. The anchor is where the cell *is*.
 */
export function landOn(covered: ReadonlyMap<string, string>, address: string): string {
  return covered.get(address) ?? address;
}

/**
 * Whether a block can be joined, and what stops it.
 *
 * Empty where it can. The one thing refused outright is a block covering
 * *part* of an existing join: there is no drawing of that, and the
 * alternatives are unjoining somebody's heading without being asked, or a
 * table the browser renders with a hole in it.
 */
export function whyNotJoin(joins: readonly Span[], range: string): string {
  const span = spanOf(range);
  if (!span) return 'Select more than one cell to join them.';
  const want = new Set(cellsOf(span));
  for (const had of joins) {
    const mine = cellsOf(had);
    const touches = mine.filter((a) => want.has(a)).length;
    if (touches > 0 && touches < mine.length) {
      return `${had.range} is already joined, and this would cut across it.`;
    }
  }
  return '';
}

/** The list with a block joined, replacing any join wholly inside it. */
export function withJoin(joins: readonly Span[], range: string): Span[] {
  const span = spanOf(range);
  if (!span) return [...joins];
  const want = new Set(cellsOf(span));
  const kept = joins.filter((had) => !cellsOf(had).every((a) => want.has(a)));
  return [...kept, span];
}

/** The list with whatever covers this address taken out of it. */
export function withoutJoin(joins: readonly Span[], address: string): Span[] {
  return joins.filter((span) => !cellsOf(span).includes(address));
}

/** The join covering an address, anchor included, or none. */
export function joinAt(joins: readonly Span[], address: string): Span | undefined {
  return joins.find((span) => cellsOf(span).includes(address));
}

/** What a join reads as, for the sentence that says one happened. */
export function saysJoin(span: Span): string {
  const what = span.rows === 1 ? 'across' : span.cols === 1 ? 'down' : 'into one';
  return `${span.range} joined ${what}`;
}
