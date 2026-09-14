/**
 * Rows out of sight, and the one thing that must never be out of sight with them.
 *
 * A filter hides rows. That is all it does, and saying so is the whole of the
 * design: **it does not change a single number.** `=SUM(B2:B20)` over a
 * filtered column still adds up all nineteen rows, exactly as it does in
 * Excel, because the cells are still there and the formula still names them.
 *
 * That is the trap this file is arranged around. Filter a gradebook to one
 * course, read the total at the foot, and it is the total of every course —
 * and nothing on the screen looks wrong. Two things answer it, and neither is
 * a clever formula:
 *
 *   - The **status bar** counts what you can see. It is what people actually
 *     read for "so what does this come to", and it is the one figure on the
 *     screen a filter should move. It says so too: *4 of 19 rows*.
 *   - The strip says how many rows are hidden, in the place somebody is
 *     already looking when they set the filter up.
 *
 * ## The rules are conjunctive, one per column
 *
 * A row survives when it satisfies every rule, which is what a spreadsheet
 * means by filtering on two columns at once and is what anybody who has used
 * one expects. One rule per column, because two rules on one column is a
 * question ("either? both?") that no screen this size should be asking.
 */

import { asNumber, asPercent, clock, colName, evaluate, isError, parseRef, ref, type Cells, type Ctx } from './sheet';
import { corners } from './chart';

export const TESTS = ['contains', 'is', 'greater', 'less', 'between', 'filled'] as const;

export type Test = (typeof TESTS)[number];

export const TEST_LABELS: Record<Test, string> = {
  contains: 'Contains',
  is: 'Is exactly',
  greater: 'Greater than',
  less: 'Less than',
  between: 'Between',
  filled: 'Not empty',
};

export interface FilterRule {
  /** The grid column it reads, zero-based. */
  column: number;
  test: Test;
  value: string;
  /** The far end, for `between`. */
  value2?: string;
}

export interface SheetFilter {
  /** The block it covers, as an A1 range — `"A1:C20"`. */
  range: string;
  /** The first row of the range is headings, and is never hidden. */
  headers: boolean;
  rules: FilterRule[];
}

/** A filter over a block, with nothing chosen yet. */
export function blankFilter(range: string, headers = true): SheetFilter {
  return { range, headers, rules: [] };
}

function figure(text: string): number | null {
  if (text.trim() === '') return null;
  const percent = asPercent(text);
  return percent ? percent.value : asNumber(text);
}

/** Whether one cell, as it is shown, satisfies one rule. */
export function keeps(rule: FilterRule, shown: string): boolean {
  const text = shown.trim();
  if (rule.test === 'filled') return text !== '';
  if (rule.test === 'contains') {
    const needle = rule.value.trim().toLowerCase();
    return needle === '' || text.toLowerCase().includes(needle);
  }
  if (rule.test === 'is') {
    const want = rule.value.trim();
    return want === '' || text.toLowerCase() === want.toLowerCase();
  }
  const value = figure(text);
  const against = figure(rule.value);
  if (against === null) return true;
  /*
   * A row with no number in that column is hidden by a numeric rule rather
   * than kept. "Greater than 90" is a question about marks, and a row with no
   * mark is not an answer to it — keeping it would put the unmarked rows in
   * with the best ones, which is the wrong half of the sheet to be looking at.
   */
  if (value === null) return false;
  if (rule.test === 'greater') return value > against;
  if (rule.test === 'less') return value < against;
  const far = figure(rule.value2 ?? '');
  if (far === null) return true;
  return value >= Math.min(against, far) && value <= Math.max(against, far);
}

/**
 * Which rows the filter hides, as grid row indices.
 *
 * Read through `display` rather than `evaluate`, so a filter matches what is
 * *on the screen*: a cell typed `80%` filters as `80%` under "contains 80" and
 * as 0.8 under "less than 1", which is the same double reading the grid itself
 * does and the only one that will not surprise anybody.
 *
 * Rows outside the range are never hidden. A filter is over a block, and
 * hiding the rows under it — which have nothing to do with it — is how a
 * filter eats the notes somebody keeps at the foot of the sheet.
 */
export function hidden(cells: Cells, filter: SheetFilter, ctx: Ctx = clock()): Set<number> {
  const out = new Set<number>();
  const at = corners(filter.range);
  if (!at || !filter.rules.length) return out;
  const first = at.top + (filter.headers ? 1 : 0);
  for (let row = first; row <= at.bottom; row += 1) {
    for (const rule of filter.rules) {
      if (rule.column < at.left || rule.column > at.right) continue;
      if (!keeps(rule, shownAt(cells, ref(row, rule.column), ctx))) {
        out.add(row);
        break;
      }
    }
  }
  return out;
}

/**
 * One cell as the grid draws it.
 *
 * `display` without the style, which is what the grid falls back to for every
 * cell nobody has formatted — so filtering matches reading in the common case,
 * and in the uncommon one it matches the number rather than the picture over
 * it. Filtering a money column on "greater than 100" should not depend on
 * whether somebody pressed the `$` button.
 */
function shownAt(cells: Cells, address: string, ctx: Ctx): string {
  const raw = cells[address];
  if (raw !== undefined && raw !== '' && !raw.trimStart().startsWith('=')) return raw;
  const value = evaluate(cells, address, new Set(), ctx);
  if (value === '') return '';
  if (isError(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/**
 * The distinct values in one column of the range, in the order met.
 *
 * What the "is exactly" picker offers, so somebody filtering a course column
 * chooses from the four courses that are in it rather than typing one and
 * misspelling it. Capped, because a column of two hundred distinct marks is a
 * list nobody was going to read.
 */
export function valuesIn(
  cells: Cells,
  filter: SheetFilter,
  column: number,
  ctx: Ctx = clock(),
  cap = 30,
): string[] {
  const at = corners(filter.range);
  if (!at) return [];
  const seen: string[] = [];
  const first = at.top + (filter.headers ? 1 : 0);
  for (let row = first; row <= at.bottom && seen.length < cap; row += 1) {
    const text = shownAt(cells, ref(row, column), ctx).trim();
    if (text === '' || seen.includes(text)) continue;
    seen.push(text);
  }
  return seen;
}

/** The columns a filter covers, by their letters, for a picker. */
export function columnsIn(filter: SheetFilter): { column: number; label: string }[] {
  const at = corners(filter.range);
  if (!at) return [];
  const out: { column: number; label: string }[] = [];
  for (let c = at.left; c <= at.right; c += 1) out.push({ column: c, label: colName(c) });
  return out;
}

/**
 * The heading a column filters under, where the range has headings.
 *
 * `Mark` rather than `B`, because a picker offering letters makes somebody
 * count columns to use it.
 */
export function headingOf(
  cells: Cells,
  filter: SheetFilter,
  column: number,
  ctx: Ctx = clock(),
): string {
  const at = corners(filter.range);
  if (!at || !filter.headers) return colName(column);
  return shownAt(cells, ref(at.top, column), ctx).trim() || colName(column);
}

/** One rule set on a column, replacing any rule that column already had. */
export function withRule(filter: SheetFilter, rule: FilterRule): SheetFilter {
  return { ...filter, rules: [...filter.rules.filter((r) => r.column !== rule.column), rule] };
}

/** That column's rule taken off. */
export function withoutRule(filter: SheetFilter, column: number): SheetFilter {
  return { ...filter, rules: filter.rules.filter((r) => r.column !== column) };
}

/** What a rule reads as on a chip — `Mark > 90`. */
export function saysRule(rule: FilterRule, heading: string): string {
  if (rule.test === 'filled') return `${heading} · not empty`;
  if (rule.test === 'between') return `${heading} · ${rule.value}–${rule.value2 ?? ''}`;
  const sign = rule.test === 'greater' ? '>' : rule.test === 'less' ? '<' : '=';
  if (rule.test === 'contains') return `${heading} · “${rule.value}”`;
  return `${heading} ${sign} ${rule.value}`;
}

/** The filter on a sheet, with anything malformed dropped. See `chartsOf`. */
export function filterOf(sheet: { filter?: unknown }): SheetFilter | undefined {
  const raw = sheet.filter;
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Partial<SheetFilter>;
  if (typeof f.range !== 'string' || !corners(f.range)) return undefined;
  const rules: FilterRule[] = [];
  for (const row of Array.isArray(f.rules) ? f.rules : []) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<FilterRule>;
    if (typeof r.column !== 'number' || !Number.isInteger(r.column) || r.column < 0) continue;
    if (!TESTS.includes(r.test as Test)) continue;
    if (rules.some((had) => had.column === r.column)) continue;
    rules.push({
      column: r.column,
      test: r.test as Test,
      value: typeof r.value === 'string' ? r.value : '',
      ...(typeof r.value2 === 'string' ? { value2: r.value2 } : {}),
    });
  }
  return { range: f.range, headers: f.headers !== false, rules };
}

/** Whether an address names a row this filter is hiding. */
export function hides(away: Set<number>, address: string): boolean {
  const where = parseRef(address);
  return where ? away.has(where.row) : false;
}
