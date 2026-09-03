/**
 * Data analysis, with the arithmetic done by arithmetic.
 *
 * The tempting build is to hand a spreadsheet to a language model and ask what
 * the mean is. That produces a number that looks right and sometimes is not,
 * and there is no way to tell which from the answer. So the division here is
 * strict and it is the whole design: **every statistic on this page is
 * computed in this file**, by code that is tested against values worked out by
 * hand. The model is given the finished numbers and asked what they mean —
 * which is the part it is actually good at and the part a textbook cannot do
 * for your data.
 *
 * The formulas are the ones a course teaches, and where a choice exists it is
 * the one a course means. Sample standard deviation divides by n−1, not n.
 * Quartiles use the linear-interpolation method that R calls type 7 and that
 * Excel's QUARTILE returns, because that is what a student's other tool will
 * say. A correlation drops pairs where either side is missing rather than
 * treating a blank as zero, because a blank is not a zero and the difference
 * shows up in every coefficient.
 */

export interface Table {
  headers: string[];
  rows: string[][];
}

/**
 * CSV, parsed properly.
 *
 * Splitting on commas is wrong for real data and the failure is silent: one
 * quoted field containing a comma shifts every column after it by one, and the
 * analysis is then of the wrong variable. This walks the text character by
 * character instead, handling quoted fields, doubled quotes inside them, and
 * newlines inside a quoted field, which a split cannot do at all.
 */
export function parseCsv(text: string): Table {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let any = false;

  const endField = () => {
    row.push(field);
    field = '';
    any = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    any = false;
  };

  const source = text.replace(/^﻿/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      any = true;
    } else if (ch === ',') endField();
    else if (ch === '\r') continue;
    else if (ch === '\n') endRow();
    else field += ch;
  }
  if (any || field) endRow();

  const [headers = [], ...body] = rows;
  // A trailing newline makes one empty row; a genuinely blank line in the
  // middle of a file is also noise. Neither is data.
  const clean = body.filter((r) => r.some((c) => c.trim() !== ''));
  return { headers: headers.map((h) => h.trim()), rows: clean };
}

/** Tab-separated too, because that is what pasting from a spreadsheet gives. */
export function parseTable(text: string): Table {
  const firstLine = text.split('\n')[0] ?? '';
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    const rows = text
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((l) => l.split('\t'));
    const [headers = [], ...body] = rows;
    return { headers: headers.map((h) => h.trim()), rows: body };
  }
  return parseCsv(text);
}

/**
 * One cell as a number, or null.
 *
 * Real data carries currency symbols, thousands separators, percentages and
 * parenthesised negatives from accounting exports. Reading "(1,234)" as
 * nothing loses a row; reading it as 1234 gets the sign wrong. Both matter.
 */
export function toNumber(cell: string): number | null {
  const raw = (cell ?? '').trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw);
  const percent = /%\s*$/.test(raw);
  const bare = raw
    .replace(/^\(|\)$/g, '')
    .replace(/[$£€¥]/g, '')
    .replace(/,/g, '')
    .replace(/%\s*$/, '')
    .trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(bare)) return null;
  let value = Number(bare);
  if (!Number.isFinite(value)) return null;
  if (percent) value /= 100;
  return negative ? -value : value;
}

export function column(table: Table, index: number): string[] {
  return table.rows.map((r) => r[index] ?? '');
}

export function numbersIn(table: Table, index: number): number[] {
  return column(table, index)
    .map(toNumber)
    .filter((n): n is number => n !== null);
}

/** Whether a column is worth offering as a number. */
export function isNumeric(table: Table, index: number): boolean {
  const cells = column(table, index).filter((c) => c.trim() !== '');
  if (cells.length === 0) return false;
  const numeric = cells.filter((c) => toNumber(c) !== null).length;
  // Most of it, not all: one "n/a" in a column of prices should not disqualify it.
  return numeric / cells.length >= 0.8;
}

export interface Summary {
  n: number;
  missing: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  sum: number;
}

export function describe(values: number[], missing = 0): Summary | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  // Sample standard deviation: n−1, because these are almost always a sample.
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    missing,
    mean,
    median: quantile(sorted, 0.5),
    sd: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[n - 1],
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    sum,
  };
}

/**
 * A quantile of an already-sorted array, by linear interpolation.
 *
 * The type-7 definition — what R defaults to and what Excel's QUARTILE
 * returns. There are nine definitions in common use and they disagree; picking
 * the one the student's other tool uses is what stops this looking broken.
 */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export interface Pair {
  x: number;
  y: number;
}

/**
 * Rows where both columns have a number.
 *
 * Listwise deletion, which is what a course means by "the data". Treating a
 * blank as zero is the classic quiet error: it moves the mean, flattens the
 * slope, and nothing on the screen says it happened.
 */
export function pairs(table: Table, xi: number, yi: number): Pair[] {
  const out: Pair[] = [];
  for (const row of table.rows) {
    const x = toNumber(row[xi] ?? '');
    const y = toNumber(row[yi] ?? '');
    if (x === null || y === null) continue;
    out.push({ x, y });
  }
  return out;
}

/** Pearson's r. Null when it is undefined — a column that never varies. */
export function correlation(data: Pair[]): number | null {
  const n = data.length;
  if (n < 2) return null;
  const mx = data.reduce((a, p) => a + p.x, 0) / n;
  const my = data.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of data) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface Fit {
  slope: number;
  intercept: number;
  r2: number;
  /** Standard error of the slope. */
  se: number;
  /** t for H₀: slope = 0. */
  t: number;
  /** Residual degrees of freedom, n − 2. */
  df: number;
  n: number;
}

/**
 * Ordinary least squares, y on x.
 *
 * The standard error and t are here because a slope without them is not a
 * result, and a student who reports one without the other loses the marks. No
 * p-value: turning t into p needs the incomplete beta function, and shipping
 * an approximation of it that is wrong in the tail — exactly where a p-value
 * gets read — would be worse than sending someone to a table for it.
 */
export function regress(data: Pair[]): Fit | null {
  const n = data.length;
  if (n < 3) return null;
  const mx = data.reduce((a, p) => a + p.x, 0) / n;
  const my = data.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of data) {
    const dx = p.x - mx;
    sxy += dx * (p.y - my);
    sxx += dx * dx;
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const ssr = data.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const df = n - 2;
  const r2 = syy === 0 ? 1 : 1 - ssr / syy;
  const se = Math.sqrt(ssr / df / sxx);
  return { slope, intercept, r2, se, t: se === 0 ? NaN : slope / se, df, n };
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

/** A histogram, for drawing. Equal-width bins across the observed range. */
export function histogram(values: number[], bins = 10): Bin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, count: values.length }];
  const width = (max - min) / bins;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    // The top value belongs in the last bin, not in a phantom one past the end.
    const i = Math.min(bins - 1, Math.floor((v - min) / width));
    out[i].count++;
  }
  return out;
}

/** Counts per distinct value, for a column that is categories rather than numbers. */
export function tally(cells: string[], limit = 12): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    const key = cell.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

/** A number written for reading, not for storing. */
export function show(value: number, places = 3): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e7)) return value.toExponential(2);
  const rounded = Number(value.toFixed(places));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * What the computed numbers are, as text for the model.
 *
 * This is the only thing the model is given — numbers this file worked out —
 * so it can be asked what they mean without ever being asked what they are.
 */
export function report(name: string, s: Summary): string {
  return [
    `${name}: n = ${s.n}${s.missing ? `, ${s.missing} missing` : ''}`,
    `mean ${show(s.mean)}, median ${show(s.median)}, sd ${show(s.sd)}`,
    `min ${show(s.min)}, Q1 ${show(s.q1)}, Q3 ${show(s.q3)}, max ${show(s.max)}`,
  ].join('; ');
}

export function fitReport(xName: string, yName: string, fit: Fit, r: number | null): string {
  return [
    `OLS of ${yName} on ${xName}, n = ${fit.n}`,
    `slope ${show(fit.slope)} (se ${show(fit.se)}, t = ${show(fit.t, 2)}, df ${fit.df})`,
    `intercept ${show(fit.intercept)}`,
    `R² ${show(fit.r2)}`,
    r === null ? '' : `Pearson r ${show(r)}`,
  ]
    .filter(Boolean)
    .join('; ');
}
