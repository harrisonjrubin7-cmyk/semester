/**
 * Editing the shape of a sheet, rather than what is in one cell of it.
 *
 * `lib/sheet.ts` holds the grid and reads it; `lib/grid.ts` holds the
 * selection over it. What neither could do is the half-dozen moves that make a
 * grid of text boxes into a spreadsheet somebody can actually work in:
 *
 *   - **a row in the middle**. The grid could only grow at the bottom, so
 *     forgetting a reading on line 4 of a gradebook meant retyping everything
 *     under it — and the `=SUM(B2:B9)` at the foot had to be found and edited
 *     by hand afterwards, which is exactly the step nobody remembers.
 *   - **fill down**. One formula written once and dragged, which is how a
 *     column of percentages is produced anywhere else and was thirty pieces of
 *     typing here.
 *   - **copy and paste** of a block, with the formulas moving with it.
 *   - **sort**, because a list of readings in the order they were typed is not
 *     the order anybody wants to read them in.
 *   - **find and replace**, over what was typed rather than what is shown.
 *
 * All five are the same underlying problem, which is why they live together:
 * *a formula is text that names other cells, and moving anything means
 * rewriting those names.* Get that wrong and the sheet still looks right —
 * a total that quietly adds up the wrong nine rows is the worst failure this
 * app can have, and it is invisible. So the rewriting is one function
 * ({@link shift}, {@link translate}), used by all of them, and it is tested
 * harder than anything it is used by.
 *
 * Everything here is pure: a body in, a new body out, no store, no DOM and no
 * clock. The screen hands each result to the same `change()` that a keystroke
 * goes through, so every one of these is a single step of undo for free.
 *
 * ## `$` finally means something
 *
 * `parseRef` has always *read* `$B$3`, because a sheet pasted in from
 * elsewhere carries dollar signs and refusing them would turn a working
 * formula into `#NAME?`. Nothing ever *honoured* them, because nothing moved a
 * formula. Filling and pasting do, so they do now: a `$` before the column
 * holds the column still, a `$` before the row holds the row.
 */

import {
  MAX_COLS,
  MAX_ROWS,
  colIndex,
  colName,
  isFormula,
  parseRef,
  ref,
  type CellStyle,
  type Cells,
} from './sheet';
import { box, cells as cellsIn, type Range } from './grid';

/**
 * The part of a sheet these functions change.
 *
 * The same four fields the screen's history records, and deliberately not a
 * whole `Sheet`: nothing here has any business with a title, a course or a
 * timestamp, and taking the smaller thing is what lets the screen apply a
 * result with the one `change()` call it already had.
 */
export interface Body {
  cells: Cells;
  styles: Record<string, CellStyle>;
  rows: number;
  cols: number;
}

/** The grid part of a sheet, for a caller holding the whole thing. */
export function bodyOf(sheet: {
  cells: Cells;
  styles?: Record<string, CellStyle>;
  rows: number;
  cols: number;
}): Body {
  return {
    cells: sheet.cells,
    styles: sheet.styles ?? {},
    rows: sheet.rows,
    cols: sheet.cols,
  };
}

// ── Rewriting the names in a formula ─────────────────────────────────────

/**
 * A reference as it was written, taken apart.
 *
 * The two `$` flags are kept separately from the numbers because they are
 * answers to different questions: where the cell is, and whether it moves.
 */
interface Written {
  col: number;
  row: number;
  colFixed: boolean;
  rowFixed: boolean;
}

/** `$B$3` → column 1, row 2, both held. Nothing for anything that is not a reference. */
function readWritten(text: string): Written | null {
  const m = /^(\$?)([A-Za-z]{1,2})(\$?)(\d{1,4})$/.exec(text);
  if (!m) return null;
  const col = colIndex(m[2]);
  const row = Number.parseInt(m[4], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { col, row, colFixed: m[1] === '$', rowFixed: m[3] === '$' };
}

/**
 * A word, as the engine's own lexer reads one.
 *
 * The same pattern `lex` uses in `sheet.ts`, so `LOG10` is a name and `B3` is
 * a reference by the same rule the evaluator applies — a second, laxer
 * pattern here would rewrite `LOG10` into `LOG11`.
 */
const WORD = /^\$?[A-Za-z][A-Za-z0-9_.]*\$?\d*/;

/** The other way, keeping the dollar signs it was written with. */
function writeWritten(w: Written): string {
  return `${w.colFixed ? '$' : ''}${colName(w.col)}${w.rowFixed ? '$' : ''}${w.row + 1}`;
}

/**
 * Every reference in a formula, replaced by whatever a function makes of it.
 *
 * The one piece of machinery under all of this, and the reason it is written
 * once. Two things it has to get right and a naïve regex does not:
 *
 *   - **strings are not formulas.** `=IF(A1>0,"A1 is positive","")` holds the
 *     text `A1` inside quotes, and rewriting that would corrupt the message
 *     rather than the arithmetic — which nobody would notice until it was
 *     printed.
 *   - **a function name is not a reference.** `LOG10(` looks close enough to
 *     one that a lazy pattern eats the `10`. The scan takes whole words and
 *     asks {@link readWritten}, exactly as the engine's own lexer does, so
 *     `LOG10` is a name and `B3` is a reference by the same rule the evaluator
 *     uses. A word followed by `(` is a call, never a cell.
 *
 * A function returning `null` leaves the reference alone; returning a string
 * puts that string in its place, which is how `#REF!` gets in.
 *
 * ## A range is one thing, not two references
 *
 * `changeRange` is given both ends of an `A2:A9` together, and it earns its
 * complication on exactly one case: a row deleted *inside* a range. Excel
 * shrinks `SUM(A2:A3)` to `SUM(A2:A2)` when row 3 goes, because only part of
 * what was summed has gone; handling the two ends separately makes it
 * `SUM(A2:#REF!)`, which breaks a gradebook's total for deleting one reading
 * out of the middle of it. A caller with no opinion about ranges leaves it
 * off and both ends go through `change` as before.
 */
export function rewrite(
  formula: string,
  change: (was: Written) => string | null,
  changeRange?: (from: Written, to: Written) => string | null,
): string {
  if (!isFormula(formula)) return formula;
  const lead = formula.slice(0, formula.length - formula.trimStart().length);
  const body = formula.trimStart().slice(1);
  let out = '';
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"') {
      const end = body.indexOf('"', i + 1);
      const stop = end < 0 ? body.length : end + 1;
      out += body.slice(i, stop);
      i = stop;
      continue;
    }
    const word = WORD.exec(body.slice(i));
    if (word) {
      const text = word[0];
      const after = body[i + text.length];
      const written = after === '(' ? null : readWritten(text);
      if (written && changeRange && after === ':') {
        const tail = WORD.exec(body.slice(i + text.length + 1));
        const end = tail ? readWritten(tail[0]) : null;
        if (tail && end) {
          out += changeRange(written, end) ?? `${text}:${tail[0]}`;
          i += text.length + 1 + tail[0].length;
          continue;
        }
      }
      out += written ? (change(written) ?? text) : text;
      i += text.length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return `${lead}=${out}`;
}

/**
 * A formula moved `dr` rows and `dc` columns, the way a fill or a paste moves it.
 *
 * Relative references move with it and held ones do not, which is the whole of
 * what `$` is for: `=B2*$F$1` filled down column C becomes `=B3*$F$1`, so the
 * rate in F1 keeps being the rate and the row keeps being this row.
 *
 * A reference that would land off the grid becomes `#REF!` rather than being
 * clamped to the edge. Clamping is the failure that hides: the formula still
 * computes, on the wrong cell, and the number it produces looks like an
 * answer.
 */
export function translate(formula: string, dr: number, dc: number): string {
  return rewrite(formula, (was) => {
    const row = was.rowFixed ? was.row : was.row + dr;
    const col = was.colFixed ? was.col : was.col + dc;
    if (row < 0 || col < 0 || row >= MAX_ROWS || col >= MAX_COLS) return '#REF!';
    return writeWritten({ ...was, row, col });
  });
}

/**
 * A formula after rows or columns have been put in or taken out.
 *
 * Different from {@link translate} in the way that matters: the formula is not
 * moving, the *grid under it* is. So a reference shifts only if it is at or
 * past the place the change happened — inserting a row at 4 leaves `B2` alone
 * and makes `B9` into `B10` — and `$` does not protect anything, because
 * holding a reference still says "do not move when I am copied", not "do not
 * notice that a row was deleted above you".
 *
 * A reference to something deleted becomes `#REF!`. That is the honest answer
 * and it is loud, which is the point: the alternative used by no spreadsheet
 * worth trusting is to point it at the next row down and say nothing.
 */
export function shift(
  formula: string,
  axis: 'row' | 'col',
  at: number,
  by: number,
): string {
  const limit = axis === 'row' ? MAX_ROWS : MAX_COLS;
  const on = (w: Written) => (axis === 'row' ? w.row : w.col);
  const put = (w: Written, n: number) =>
    writeWritten(axis === 'row' ? { ...w, row: n } : { ...w, col: n });

  const one = (was: Written): string | null => {
    const where = on(was);
    if (where < at) return null;
    // Taking out rows 4 and 5 and asking about row 5: it is gone, not moved.
    if (by < 0 && where < at - by) return '#REF!';
    const moved = where + by;
    if (moved < 0 || moved >= limit) return '#REF!';
    return put(was, moved);
  };

  /**
   * Both ends of a range at once, so a deletion inside it shrinks it.
   *
   * Growing needs no special case — each end moves on its own and the range
   * comes out right. Shrinking does: an end that was *in* the deleted block
   * has to come back to the edge of the gap rather than become `#REF!`, and
   * only a range whose every row went is gone.
   */
  const pair = (from: Written, to: Written): string | null => {
    if (by >= 0) return `${one(from) ?? writeWritten(from)}:${one(to) ?? writeWritten(to)}`;
    const count = -by;
    const lo = Math.min(on(from), on(to));
    const hi = Math.max(on(from), on(to));
    const nextLo = lo >= at + count ? lo - count : lo >= at ? at : lo;
    const nextHi = hi >= at + count ? hi - count : hi >= at ? at - 1 : hi;
    if (nextLo > nextHi) return '#REF!';
    const forward = on(from) <= on(to);
    return `${put(from, forward ? nextLo : nextHi)}:${put(to, forward ? nextHi : nextLo)}`;
  };

  return rewrite(formula, one, pair);
}

// ── Rows and columns ─────────────────────────────────────────────────────

/**
 * Every cell and style moved by the same rule, with the formulas rewritten.
 *
 * The two halves have to happen together and in one pass over a copy: a cell
 * that moves and a formula that points at it are the same edit, and doing them
 * as two passes over the live table is how a reference ends up pointing at
 * where a cell used to be.
 */
function reshape(
  body: Body,
  axis: 'row' | 'col',
  at: number,
  by: number,
  rows: number,
  cols: number,
): Body {
  const cells: Cells = {};
  const styles: Record<string, CellStyle> = {};
  const move = (address: string): string | null => {
    const where = parseRef(address);
    if (!where) return null;
    const on = axis === 'row' ? where.row : where.col;
    if (on < at) return address;
    if (by < 0 && on < at - by) return null; // deleted outright
    const moved = on + by;
    if (moved >= (axis === 'row' ? rows : cols)) return null; // pushed off the end
    return axis === 'row' ? ref(moved, where.col) : ref(where.row, moved);
  };

  for (const [address, text] of Object.entries(body.cells)) {
    const to = move(address);
    if (to) cells[to] = isFormula(text) ? shift(text, axis, at, by) : text;
  }
  for (const [address, style] of Object.entries(body.styles)) {
    const to = move(address);
    if (to) styles[to] = style;
  }
  return { cells, styles, rows, cols };
}

/** Rows put in above `at`, pushing everything below it down. */
export function insertRows(body: Body, at: number, count = 1): Body {
  const n = Math.max(1, count);
  return reshape(body, 'row', at, n, Math.min(MAX_ROWS, body.rows + n), body.cols);
}

/**
 * Rows taken out, closing the gap.
 *
 * The grid never shrinks below one row: a sheet with no rows is a screen with
 * nothing to click on and no way back.
 */
export function deleteRows(body: Body, at: number, count = 1): Body {
  const n = Math.min(count, body.rows - 1);
  if (n < 1) return body;
  return reshape(body, 'row', at, -n, body.rows - n, body.cols);
}

export function insertCols(body: Body, at: number, count = 1): Body {
  const n = Math.max(1, count);
  return reshape(body, 'col', at, n, body.rows, Math.min(MAX_COLS, body.cols + n));
}

export function deleteCols(body: Body, at: number, count = 1): Body {
  const n = Math.min(count, body.cols - 1);
  if (n < 1) return body;
  return reshape(body, 'col', at, -n, body.rows, body.cols - n);
}

// ── Filling ──────────────────────────────────────────────────────────────

/**
 * The top row of a selection copied down it, or the left column across.
 *
 * The move that turns one written formula into a column of them, and the
 * reason {@link translate} exists. The style comes with the value — a column
 * filled from a cell showing two decimal places shows two decimal places all
 * the way down, which is what somebody filling it meant and what they would
 * otherwise do by hand afterwards.
 *
 * An empty source clears what it is filled over rather than leaving the old
 * values in place. Filling *is* overwriting; a fill that skipped the blanks
 * would leave a column half old and half new, which is worse than either.
 */
export function fill(body: Body, range: Range, way: 'down' | 'right'): Body {
  const b = box(range);
  const cells = { ...body.cells };
  const styles = { ...body.styles };
  for (let r = b.top; r <= b.bottom; r += 1) {
    for (let c = b.left; c <= b.right; c += 1) {
      const from = way === 'down' ? ref(b.top, c) : ref(r, b.left);
      const to = ref(r, c);
      if (from === to) continue;
      const source = body.cells[from] ?? '';
      const moved = isFormula(source)
        ? translate(source, way === 'down' ? r - b.top : 0, way === 'right' ? c - b.left : 0)
        : source;
      if (moved === '') delete cells[to];
      else cells[to] = moved;
      const style = body.styles[from];
      if (style) styles[to] = style;
      else delete styles[to];
    }
  }
  return { ...body, cells, styles };
}

// ── Sorting ──────────────────────────────────────────────────────────────

/**
 * A block of rows put in order by one of its columns.
 *
 * What is compared is the *typed* text read as a number where it is one and as
 * text where it is not, so a column of marks sorts 2, 10, 90 rather than 10,
 * 2, 90. Blanks go last in both directions, because a blank is not a small
 * value — it is the absence of one, and burying the filled rows under the
 * empty ones is nobody's idea of sorted.
 *
 * ## Why a sheet with formulas in it is refused
 *
 * Sorting moves whole rows, so every formula in the block would have to be
 * rewritten to point at where its neighbours went — and a formula pointing
 * *outside* the block cannot be rewritten at all, because the thing it names
 * has not moved and the row it lives on has. Excel does this and gets it
 * wrong often enough to be a known hazard. Here the block is refused and the
 * screen says so, which is the same rule the rest of this app runs on: a
 * refusal is honest, a quietly wrong total is not.
 */
export function sortable(body: Body, range: Range): boolean {
  return !cellsIn(range).some((address) => isFormula(body.cells[address] ?? ''));
}

export function sortRange(
  body: Body,
  range: Range,
  by: number,
  direction: 'asc' | 'desc' = 'asc',
): Body {
  if (!sortable(body, range)) return body;
  const b = box(range);
  const order = Array.from({ length: b.bottom - b.top + 1 }, (_, i) => b.top + i);
  const at = Math.min(Math.max(b.left, by), b.right);
  const rank = (row: number): { blank: boolean; n: number | null; text: string } => {
    const text = (body.cells[ref(row, at)] ?? '').trim();
    const n = text === '' ? null : Number(text.replace(/[$,\s]/g, '').replace(/%$/, ''));
    return {
      blank: text === '',
      n: n !== null && Number.isFinite(n) ? n : null,
      text: text.toLowerCase(),
    };
  };
  order.sort((x, y) => {
    const a = rank(x);
    const c = rank(y);
    if (a.blank !== c.blank) return a.blank ? 1 : -1;
    if (a.blank) return x - y;
    let cmp: number;
    if (a.n !== null && c.n !== null) cmp = a.n - c.n;
    else if (a.n !== null) cmp = -1;
    else if (c.n !== null) cmp = 1;
    else cmp = a.text.localeCompare(c.text);
    // A stable tie-break on the original position, so sorting twice by the
    // same column does not shuffle the rows that tie.
    return (direction === 'desc' ? -cmp : cmp) || x - y;
  });

  const cells = { ...body.cells };
  const styles = { ...body.styles };
  order.forEach((from, i) => {
    const to = b.top + i;
    for (let c = b.left; c <= b.right; c += 1) {
      const source = body.cells[ref(from, c)];
      const target = ref(to, c);
      if (source === undefined) delete cells[target];
      else cells[target] = source;
      const style = body.styles[ref(from, c)];
      if (style === undefined) delete styles[target];
      else styles[target] = style;
    }
  });
  return { ...body, cells, styles };
}

// ── Finding and replacing ────────────────────────────────────────────────

export interface Found {
  address: string;
  /** What is actually in the cell — the formula, not the answer. */
  text: string;
}

/**
 * Every cell whose typed text holds the query, in reading order.
 *
 * The *typed* text, which is the choice worth defending: searching what is
 * shown would find the `162` a `SUM` produced and not the `=SUM(D2:D5)` that
 * produced it, so replacing it would do nothing anybody could see. Looking for
 * `D2` and finding the formulas that mention it is the useful search, and it
 * is the one that makes replace safe.
 */
export function find(body: Body, query: string, matchCase = false): Found[] {
  if (query === '') return [];
  const needle = matchCase ? query : query.toLowerCase();
  const out: Found[] = [];
  for (let r = 0; r < body.rows; r += 1) {
    for (let c = 0; c < body.cols; c += 1) {
      const address = ref(r, c);
      const text = body.cells[address];
      if (text === undefined) continue;
      const hay = matchCase ? text : text.toLowerCase();
      if (hay.includes(needle)) out.push({ address, text });
    }
  }
  return out;
}

/** The same query, replaced everywhere it appears. Returns the body and how many changed. */
export function replaceAll(
  body: Body,
  query: string,
  with_: string,
  matchCase = false,
): { body: Body; changed: number } {
  const hits = find(body, query, matchCase);
  if (hits.length === 0) return { body, changed: 0 };
  const cells = { ...body.cells };
  for (const hit of hits) {
    const next = matchCase
      ? hit.text.split(query).join(with_)
      : splitInsensitive(hit.text, query).join(with_);
    if (next === '') delete cells[hit.address];
    else cells[hit.address] = next;
  }
  return { body: { ...body, cells }, changed: hits.length };
}

/** `split` that ignores case, which `String.prototype.split` will not do with a string. */
function splitInsensitive(text: string, query: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at < 0) break;
    out.push(text.slice(from, at));
    from = at + needle.length;
  }
  out.push(text.slice(from));
  return out;
}

// ── Copy, cut and paste ──────────────────────────────────────────────────

/**
 * A block of cells, out of the sheet and on its way back in.
 *
 * `from` is where it was taken — empty for a clip read off the system
 * clipboard, which knows no such thing — and it is the whole reason this is an
 * object rather than a string of tab-separated text: pasting `=SUM(B2:B9)` two
 * columns to the right has to produce `=SUM(D2:D9)`, and that needs to know
 * where it came from. The text form is kept alongside for the system
 * clipboard, so a block copied here pastes into Excel and a block copied from
 * Excel pastes in here — losing the formulas in both directions, which is what
 * a tab-separated clipboard is and is why the object form exists.
 */
export interface Clip {
  from: string;
  rows: number;
  cols: number;
  /** Row-major, `rows × cols`, holding what was typed. */
  cells: string[][];
  styles: (CellStyle | undefined)[][];
}

export function copy(body: Body, range: Range): Clip {
  const b = box(range);
  const cells: string[][] = [];
  const styles: (CellStyle | undefined)[][] = [];
  for (let r = b.top; r <= b.bottom; r += 1) {
    const row: string[] = [];
    const look: (CellStyle | undefined)[] = [];
    for (let c = b.left; c <= b.right; c += 1) {
      row.push(body.cells[ref(r, c)] ?? '');
      look.push(body.styles[ref(r, c)]);
    }
    cells.push(row);
    styles.push(look);
  }
  return {
    from: ref(b.top, b.left),
    rows: b.bottom - b.top + 1,
    cols: b.right - b.left + 1,
    cells,
    styles,
  };
}

/** The block emptied where it stood, which is the second half of a cut. */
export function clear(body: Body, range: Range): Body {
  const cells = { ...body.cells };
  const styles = { ...body.styles };
  for (const address of cellsIn(range)) {
    delete cells[address];
    delete styles[address];
  }
  return { ...body, cells, styles };
}

/**
 * A block put down with its top-left corner at `at`.
 *
 * The formulas move with it — see {@link translate} — and the grid grows to
 * hold what is being pasted rather than cropping it, up to the format's own
 * limits. Cropping silently is the other loss this file exists to prevent: a
 * twelve-row paste into a ten-row sheet that quietly becomes ten rows is two
 * readings missing from a gradebook.
 */
export function paste(body: Body, at: string, clip: Clip, withStyles = true): Body {
  const target = parseRef(at);
  if (!target) return body;
  /*
   * A clip with no origin is text off the system clipboard, and a formula in
   * it is put down as written: there is nothing to move it relative to, and a
   * guess would rewrite somebody else's `=SUM(B2:B9)` into a range that exists
   * here and means nothing.
   */
  const source = parseRef(clip.from);
  const dr = source ? target.row - source.row : 0;
  const dc = source ? target.col - source.col : 0;
  const cells = { ...body.cells };
  const styles = { ...body.styles };
  for (let r = 0; r < clip.rows; r += 1) {
    for (let c = 0; c < clip.cols; c += 1) {
      const row = target.row + r;
      const col = target.col + c;
      if (row >= MAX_ROWS || col >= MAX_COLS) continue;
      const address = ref(row, col);
      const text = clip.cells[r]?.[c] ?? '';
      const moved = isFormula(text) ? translate(text, dr, dc) : text;
      if (moved === '') delete cells[address];
      else cells[address] = moved;
      if (!withStyles) continue;
      const style = clip.styles[r]?.[c];
      if (style) styles[address] = style;
      else delete styles[address];
    }
  }
  return {
    cells,
    styles,
    rows: Math.min(MAX_ROWS, Math.max(body.rows, target.row + clip.rows)),
    cols: Math.min(MAX_COLS, Math.max(body.cols, target.col + clip.cols)),
  };
}

/**
 * A clip as the system clipboard holds it: tab-separated, newline per row.
 *
 * What Excel and Google Sheets both put on the clipboard for a block, so this
 * is the format that makes copy here and paste there work. A cell holding a
 * tab or a newline is quoted the way a CSV would quote it; without that, one
 * cell with a line break in it turns a 3×4 block into a 4×4 one on the way
 * out.
 */
export function clipText(clip: Clip): string {
  return clip.cells
    .map((row) =>
      row
        .map((cell) => (/[\t\n"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join('\t'),
    )
    .join('\n');
}

/**
 * The other direction: a block of tab-separated text as a clip.
 *
 * `from` is empty, because text off the clipboard has no idea where it came
 * from — so a formula in it is pasted exactly as written, with no translation,
 * which is the only honest thing to do with `=SUM(B2:B9)` arriving out of
 * nowhere.
 */
export function readClip(text: string): Clip | null {
  if (text === '') return null;
  const rows = splitRecords(text).map((line) => splitFields(line));
  if (rows.length === 0) return null;
  const cols = rows.reduce((n, row) => Math.max(n, row.length), 0);
  const cells = rows.map((row) =>
    Array.from({ length: cols }, (_, c) => (row[c] ?? '').trim()),
  );
  return {
    from: '',
    rows: cells.length,
    cols,
    cells,
    styles: cells.map((row) => row.map(() => undefined)),
  };
}

/** Newlines that are not inside quotes end a record. */
function splitRecords(text: string): string[] {
  const out: string[] = [];
  let record = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      quoted = !quoted;
      record += ch;
      continue;
    }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      out.push(record);
      record = '';
      continue;
    }
    record += ch;
  }
  if (record !== '') out.push(record);
  return out;
}

/** Tabs that are not inside quotes end a field. */
function splitFields(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (ch === '\t' && !quoted) {
      out.push(field);
      field = '';
      continue;
    }
    field += ch;
  }
  out.push(field);
  return out;
}

// ── Autosum ──────────────────────────────────────────────────────────────

/**
 * Where a `SUM` goes and what it adds up, worked out from the selection.
 *
 * The button every spreadsheet puts under a Σ, and the thing about it worth
 * copying is that it is a *guess with a visible answer*: what lands in the
 * cell is the formula, so the range can be read and corrected. A button that
 * dropped the number in would be a guess nobody could check.
 *
 * The rule is Excel's: a block selected is added up under itself; a single
 * cell takes the run of filled cells above it, or to its left if there is
 * nothing above.
 */
export function autoSum(
  body: Body,
  range: Range,
  fn = 'SUM',
): { at: string; formula: string } | null {
  const b = box(range);
  if (b.top !== b.bottom || b.left !== b.right) {
    /*
     * The row under the block, even where the grid has not got one yet.
     *
     * Clamping this to the last row was the bug worth writing down: selecting
     * a whole column put the `SUM` *inside* its own range, and the cell then
     * read `#CYCLE!`. The caller grows the grid by a row instead, which is
     * what pressing Σ under a full column has always meant.
     */
    if (b.bottom + 1 >= MAX_ROWS) return null;
    return {
      at: ref(b.bottom + 1, b.left),
      formula: `=${fn}(${ref(b.top, b.left)}:${ref(b.bottom, b.right)})`,
    };
  }
  const here = parseRef(range.focus);
  if (!here) return null;
  const run = (dr: number, dc: number): string | null => {
    let r = here.row + dr;
    let c = here.col + dc;
    if (r < 0 || c < 0 || (body.cells[ref(r, c)] ?? '') === '') return null;
    while (r + dr >= 0 && c + dc >= 0 && (body.cells[ref(r + dr, c + dc)] ?? '') !== '') {
      r += dr;
      c += dc;
    }
    return `${ref(r, c)}:${ref(here.row + dr, here.col + dc)}`;
  };
  const range_ = run(-1, 0) ?? run(0, -1);
  return range_ ? { at: range.focus, formula: `=${fn}(${range_})` } : null;
}
