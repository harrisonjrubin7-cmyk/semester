/**
 * The same rows, asked a different question.
 *
 * A table of a hundred marks answers "what did Ada get in week four". A pivot
 * of it answers "what is the average in each course", which is the question
 * the table was collected to answer and the one it cannot be read for.
 *
 * ## It is a view, and it can be made into formulas
 *
 * Drawn under the grid and recomputed from the cells on every read, so it
 * cannot go stale — the same arrangement as a chart, for the same reason.
 *
 * And **Put it in cells** writes it out as a block of `SUMIFS` / `COUNTIFS` /
 * `AVERAGEIFS`, not as the numbers it happens to show. That is the whole
 * difference between this and every "export summary" button: the block stays
 * live, so editing a mark moves the total; it can be charted, because a chart
 * reads cells; and it goes into the `.xlsx` as arithmetic Excel recalculates
 * rather than as a snapshot that was true once.
 *
 * The formulas are the reason `AVERAGEIFS`, `MINIFS` and `MAXIFS` were added
 * to the engine: an aggregate this can show and cannot write down would be a
 * pivot that quietly loses its meaning on the way out.
 */

import {
  clock,
  colName,
  evaluate,
  isError,
  ref,
  writeQualifier,
  type Cells,
  type Ctx,
  type Value,
} from './sheet';
import { corners } from './chart';

export const AGGREGATES = ['count', 'sum', 'average', 'min', 'max'] as const;

export type Aggregate = (typeof AGGREGATES)[number];

export const AGGREGATE_LABELS: Record<Aggregate, string> = {
  count: 'How many',
  sum: 'Total',
  average: 'Average',
  min: 'Smallest',
  max: 'Largest',
};

/** The function each one writes itself as. `count` needs no value column. */
const FUNCTIONS: Record<Aggregate, string> = {
  count: 'COUNTIFS',
  sum: 'SUMIFS',
  average: 'AVERAGEIFS',
  min: 'MINIFS',
  max: 'MAXIFS',
};

export interface Pivot {
  id: string;
  /** The block it reads, as an A1 range — `"A1:D40"`. */
  range: string;
  /** The first row of the range names the columns. */
  headers: boolean;
  /** The grid column whose distinct values become the rows. */
  by: number;
  /** A second dimension, across the top. `null` for a plain grouping. */
  across: number | null;
  /** The grid column being measured. Ignored by `count`. */
  of: number;
  how: Aggregate;
  created: number;
}

export interface PivotCell {
  /** The aggregate, or null where no row matched this pairing. */
  value: number | null;
  /** How many rows of the block fell into it. */
  count: number;
}

export interface PivotRead {
  /** The distinct values down the side, in the order met. */
  rows: string[];
  /** The distinct values across the top. One empty string for a plain grouping. */
  columns: string[];
  /** `cells[row][column]`. */
  cells: PivotCell[][];
  /** One per row, one per column, and the corner. */
  rowTotals: (number | null)[];
  columnTotals: (number | null)[];
  total: number | null;
  /**
   * Rows of the source left out because a dimension had too many values.
   *
   * Zero for the ordinary case. Anything else has to be *said*, because the
   * totals below are then totals of what is shown and not of the table — a
   * summary that quietly answers a narrower question than the one asked is
   * worse than one that refuses, and `chart.ts` carries `dropped` and
   * `beyond` for the same reason.
   */
  beyond: number;
  /** Why it cannot be read, in a sentence, or empty. */
  trouble: string;
}

/** How many distinct values a dimension may take before the table is a smear. */
export const MOST_ROWS = 60;
export const MOST_COLUMNS = 12;

const nothing = (trouble: string): PivotRead => ({
  rows: [],
  columns: [],
  cells: [],
  rowTotals: [],
  columnTotals: [],
  total: null,
  beyond: 0,
  trouble,
});

/** The key a pairing is bucketed under. Two strings, kept apart unambiguously. */
function bucketKey(down: string, across: string): string {
  return JSON.stringify([down, across]);
}

/** One cell as the text a dimension groups by. */
function labelAt(cells: Cells, address: string, ctx: Ctx): string {
  const raw = cells[address];
  if (raw === undefined) return '';
  const value = evaluate(cells, address, new Set(), ctx);
  if (value === '') return '';
  if (isError(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).trim();
}

/** One cell as the number being measured, or null. */
function figureAt(cells: Cells, address: string, ctx: Ctx): number | null {
  const value: Value = evaluate(cells, address, new Set(), ctx);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function gather(values: number[], how: Aggregate): number | null {
  if (how === 'count') return values.length;
  if (!values.length) return null;
  if (how === 'sum') return values.reduce((t, n) => t + n, 0);
  if (how === 'average') return values.reduce((t, n) => t + n, 0) / values.length;
  return how === 'min' ? Math.min(...values) : Math.max(...values);
}

/**
 * The block, grouped.
 *
 * A row whose grouping cell is **empty** is left out rather than gathered
 * under a blank heading: an unfilled course column is a row nobody has
 * classified, and giving it a group of its own puts a nameless bucket at the
 * top of every pivot of every half-finished table.
 */
export function readPivot(cells: Cells, pivot: Pivot, ctx: Ctx = clock()): PivotRead {
  const at = corners(pivot.range);
  if (!at) return nothing('That is not a range this can read.');
  const first = at.top + (pivot.headers ? 1 : 0);
  if (first > at.bottom) return nothing('The range is only its heading row.');
  if (pivot.by < at.left || pivot.by > at.right) {
    return nothing('The column it groups by is outside the range.');
  }
  if (pivot.how !== 'count' && (pivot.of < at.left || pivot.of > at.right)) {
    return nothing('The column it measures is outside the range.');
  }

  const rows: string[] = [];
  const columns: string[] = [];
  const buckets = new Map<string, number[]>();
  /** Source rows the caps above left out. Reported, never swallowed. */
  let beyond = 0;

  for (let r = first; r <= at.bottom; r += 1) {
    const down = labelAt(cells, ref(r, pivot.by), ctx);
    if (down === '') continue;
    const across = pivot.across === null ? '' : labelAt(cells, ref(r, pivot.across), ctx);
    if (pivot.across !== null && across === '') continue;
    if (!rows.includes(down)) {
      if (rows.length >= MOST_ROWS) {
        beyond += 1;
        continue;
      }
      rows.push(down);
    }
    if (!columns.includes(across)) {
      if (columns.length >= MOST_COLUMNS) {
        beyond += 1;
        continue;
      }
      columns.push(across);
    }
    const figure = pivot.how === 'count' ? 1 : figureAt(cells, ref(r, pivot.of), ctx);
    if (figure === null) continue;
    const key = bucketKey(down, across);
    const had = buckets.get(key);
    if (had) had.push(figure);
    else buckets.set(key, [figure]);
  }

  if (!rows.length) return nothing('Nothing in that column to group by.');
  /*
   * Groups with no numbers in them at all is a column of words being measured
   * — the commonest way to point this at the wrong column, and a table of
   * blanks does not say so. `count` is exempt: it measures rows, not figures.
   */
  if (pivot.how !== 'count' && buckets.size === 0) {
    return nothing('Nothing in the column it measures is a number.');
  }

  const table: PivotCell[][] = rows.map((down) =>
    columns.map((across) => {
      const got = buckets.get(bucketKey(down, across)) ?? [];
      return { value: gather(got, pivot.how), count: got.length };
    }),
  );

  /*
   * A total of the values, never a total of the totals.
   *
   * The row total for an average is the average of that row's own numbers,
   * not the average of the averages across it — those are different figures
   * whenever the groups are different sizes, and the second is the wrong one
   * every time. So every total re-gathers from the buckets.
   */
  const acrossRow = (down: string) =>
    gather(columns.flatMap((across) => buckets.get(bucketKey(down, across)) ?? []), pivot.how);
  const downColumn = (across: string) =>
    gather(rows.flatMap((down) => buckets.get(bucketKey(down, across)) ?? []), pivot.how);

  return {
    rows,
    columns,
    cells: table,
    rowTotals: rows.map(acrossRow),
    columnTotals: columns.map(downColumn),
    total: gather([...buckets.values()].flat(), pivot.how),
    beyond,
    trouble: '',
  };
}

/**
 * A pivot over a block, guessing the two columns most likely wanted.
 *
 * It reads the cells rather than taking the first two columns, and the reason
 * is a bug this had: the second column of a course · term · mark table is
 * *term*, which holds words, so every figure in the summary came out blank
 * and every formula it wrote came out `#DIV/0!`. Nothing was wrong with either
 * — they were faithfully measuring a column of words.
 *
 * So: group by the first column that reads as names, measure the first that
 * reads as numbers. Both are overridable on the card, which is where a guess
 * belongs.
 */
export function suggest(
  cells: Cells,
  range: string,
  now = Date.now(),
  ctx: Ctx = clock(now),
): Pivot {
  const at = corners(range);
  const blank: Pivot = {
    id: crypto.randomUUID(),
    range,
    headers: true,
    by: at?.left ?? 0,
    across: null,
    of: at ? Math.min(at.left + 1, at.right) : 1,
    how: 'sum',
    created: now,
  };
  if (!at) return blank;

  const first = at.top + 1;
  const numeric: boolean[] = [];
  for (let c = at.left; c <= at.right; c += 1) {
    let numbers = 0;
    let said = 0;
    for (let r = first; r <= at.bottom; r += 1) {
      if (labelAt(cells, ref(r, c), ctx) === '') continue;
      said += 1;
      if (figureAt(cells, ref(r, c), ctx) !== null) numbers += 1;
    }
    numeric.push(said > 0 && numbers * 2 > said);
  }

  const words = numeric.findIndex((n) => !n);
  const figures = numeric.findIndex((n) => n);
  return {
    ...blank,
    by: words >= 0 ? at.left + words : blank.by,
    of: figures >= 0 ? at.left + figures : blank.of,
  };
}

/** The heading a column groups under — `Course` rather than `B`. */
export function headingOf(cells: Cells, pivot: Pivot, column: number, ctx: Ctx = clock()): string {
  const at = corners(pivot.range);
  if (!at || !pivot.headers) return colName(column);
  return labelAt(cells, ref(at.top, column), ctx) || colName(column);
}

// ── Writing it out as formulas ────────────────────────────────────────────

/** A criterion as a formula writes one: bare for a number, quoted for words. */
function criterion(text: string): string {
  const n = Number(text);
  return text !== '' && Number.isFinite(n) ? text : `"${text.replace(/"/g, '""')}"`;
}

/**
 * One column of the source block as an absolute, qualified range.
 *
 * Qualified because the block lands on whichever sheet somebody puts it on,
 * and absolute because the formulas are written once into a rectangle rather
 * than filled — nothing is going to move them, and a relative range in a
 * summary block is one somebody drags and silently breaks.
 */
function columnRef(sheet: string, column: number, first: number, last: number): string {
  const letter = colName(column);
  return `${writeQualifier(sheet)}$${letter}$${first + 1}:$${letter}$${last + 1}`;
}

/**
 * The pivot as a rectangle of cells, ready to be written into a grid.
 *
 * Row 0 is the headings, column 0 the row labels, and everything else a
 * formula. Text rather than values, so the caller writes it through the same
 * path a keystroke goes through — there is no second way into a cell.
 */
export function asCells(cells: Cells, pivot: Pivot, sheet: string, ctx: Ctx = clock()): string[][] {
  const read = readPivot(cells, pivot, ctx);
  if (read.trouble) return [];
  const at = corners(pivot.range);
  if (!at) return [];
  const first = at.top + (pivot.headers ? 1 : 0);
  const last = at.bottom;

  const byRange = columnRef(sheet, pivot.by, first, last);
  const acrossRange = pivot.across === null ? '' : columnRef(sheet, pivot.across, first, last);
  const ofRange = columnRef(sheet, pivot.how === 'count' ? pivot.by : pivot.of, first, last);
  const fn = FUNCTIONS[pivot.how];

  /** One cell: the aggregate over the rows matching this row, and this column. */
  const formula = (down: string, across: string | null): string => {
    const conditions =
      `${byRange},${criterion(down)}` +
      (across !== null && pivot.across !== null ? `,${acrossRange},${criterion(across)}` : '');
    // COUNTIFS takes the pairs alone; the other four are measured over a range.
    return pivot.how === 'count' ? `=${fn}(${conditions})` : `=${fn}(${ofRange},${conditions})`;
  };

  const twoWay = pivot.across !== null;
  const head = [
    headingOf(cells, pivot, pivot.by, ctx),
    ...(twoWay ? read.columns : [AGGREGATE_LABELS[pivot.how]]),
    ...(twoWay ? ['Total'] : []),
  ];

  const body = read.rows.map((down) => [
    down,
    ...(twoWay ? read.columns.map((across) => formula(down, across)) : [formula(down, null)]),
    ...(twoWay ? [formula(down, null)] : []),
  ]);

  return [head, ...body];
}

/** What a pivot reads as on the row that lists it. */
export function saysPivot(cells: Cells, pivot: Pivot, ctx: Ctx = clock()): string {
  const by = headingOf(cells, pivot, pivot.by, ctx);
  const what = AGGREGATE_LABELS[pivot.how].toLowerCase();
  const of = pivot.how === 'count' ? '' : ` of ${headingOf(cells, pivot, pivot.of, ctx)}`;
  const across = pivot.across === null ? '' : ` by ${headingOf(cells, pivot, pivot.across, ctx)}`;
  return `${by}${across} · ${what}${of}`;
}

/**
 * What the summary is leaving out, in a sentence, or empty.
 *
 * The companion of `chartNote`, and there for the same reason: the totals
 * under a capped table are totals of what is shown, and somebody reading
 * *average mark per course* off a table missing forty courses is reading a
 * number that answers a question they did not ask.
 */
export function pivotNote(read: PivotRead): string {
  if (read.trouble || !read.beyond) return '';
  const groups = `${MOST_ROWS} groups and ${MOST_COLUMNS} columns`;
  return read.beyond === 1
    ? `Past ${groups}: 1 row is not counted, here or in the totals.`
    : `Past ${groups}: ${read.beyond} rows are not counted, here or in the totals.`;
}

/** The pivots a sheet holds, with anything malformed dropped. See `chartsOf`. */
export function pivotsOf(sheet: { pivots?: unknown }): Pivot[] {
  if (!Array.isArray(sheet.pivots)) return [];
  const out: Pivot[] = [];
  for (const row of sheet.pivots) {
    if (!row || typeof row !== 'object') continue;
    const p = row as Partial<Pivot>;
    if (typeof p.id !== 'string' || typeof p.range !== 'string' || !corners(p.range)) continue;
    if (!AGGREGATES.includes(p.how as Aggregate)) continue;
    if (typeof p.by !== 'number' || !Number.isInteger(p.by) || p.by < 0) continue;
    out.push({
      id: p.id,
      range: p.range,
      headers: p.headers !== false,
      by: p.by,
      across:
        typeof p.across === 'number' && Number.isInteger(p.across) && p.across >= 0 ? p.across : null,
      of: typeof p.of === 'number' && Number.isInteger(p.of) && p.of >= 0 ? p.of : 0,
      how: p.how as Aggregate,
      created: typeof p.created === 'number' ? p.created : 0,
    });
  }
  return out;
}
