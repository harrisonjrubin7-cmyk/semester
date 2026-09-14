/**
 * A picture of what is in the grid.
 *
 * The one thing a spreadsheet in this app could not do. Every other half of a
 * sheet was here — formulas, formats, sort, fill, find, a real `.xlsx` — and
 * the answer to "so what does that column actually look like" was to export
 * the file and open it in Excel. A chart is not decoration on a gradebook or a
 * budget; it is the step where somebody *sees* that one course is carrying the
 * term, or that the money ran out in week nine.
 *
 * ## It reads answers, not text
 *
 * Every value goes through `evaluate`, so a column of `=B2*C2` charts as the
 * products and not as thirty copies of the word "formula". That is also why
 * nothing here caches: the chart is derived from `cells` on every render, the
 * same way the grid's own display is, so editing a cell moves the bar with no
 * invalidation to get wrong.
 *
 * ## What is stored, and what is worked out
 *
 * Stored (on the sheet, in {@link SheetChart}): the range, the kind, the
 * title, and whether the edges of the range are names rather than numbers.
 * Five short fields, so a chart survives a reload and an export without the
 * numbers being written down twice — a copy of the values would be a second
 * truth, and the moment somebody edited a cell it would be the wrong one.
 *
 * Worked out here: everything else.
 *
 * ## Bars start at zero. Lines do not have to.
 *
 * A bar is read by its *length*, so a bar chart whose axis starts at 40 makes
 * a 5% difference look like a doubling — the best known way to lie with a
 * chart, and it happens by accident whenever an axis is fitted to the data. A
 * line is read by its *slope*, and forcing a zero baseline on a line of exam
 * marks in the nineties flattens the whole term into one stripe. So the
 * baseline is a property of the mark rather than a setting: `zero` for column,
 * bar and pie; `fit` for line — and `fit` still takes in zero when the values
 * cross it, because a line crossing an axis that is not drawn is worse than a
 * tall chart.
 *
 * ## Everything here is pure
 *
 * Cells in, numbers out. No store, no DOM, no clock beyond the one `evaluate`
 * is handed. `components/SheetChart.tsx` turns the result into SVG and
 * `lib/xlsx.ts` turns the same result into the chart part of a real workbook,
 * which is the whole reason the arithmetic is not inside either of them.
 */

import { asNumber, asPercent, clock, colName, evaluate, isError, parseRef, ref, type Cells, type Ctx } from './sheet';

/** The four shapes a sheet can be drawn as. */
export const CHART_KINDS = ['column', 'bar', 'line', 'pie'] as const;

export type ChartKind = (typeof CHART_KINDS)[number];

export const CHART_LABELS: Record<ChartKind, string> = {
  column: 'Columns',
  bar: 'Bars',
  line: 'Line',
  pie: 'Pie',
};

/** What each one is for, in the words the picker shows under the name. */
export const CHART_SAYS: Record<ChartKind, string> = {
  column: 'Compare a handful of things',
  bar: 'The same, with long names',
  line: 'A figure over time',
  pie: 'Parts of one whole',
};

/**
 * A chart somebody asked for, as it is stored on the sheet.
 *
 * Deliberately not the numbers. See the head of this file.
 */
export interface SheetChart {
  id: string;
  kind: ChartKind;
  /** The block it reads, as an A1 range — `"A1:C9"`. */
  range: string;
  /** Its own title. Empty means the chart is drawn without one. */
  title: string;
  /** The first row of the range names the series rather than holding numbers. */
  headers: boolean;
  /** The first column of the range names the categories. */
  labels: boolean;
  created: number;
}

export interface ChartSeries {
  name: string;
  /** One per category, in order. `null` where the cell was empty or not a number. */
  values: (number | null)[];
  /** Which column of the grid it came out of. */
  column: number;
}

export interface ChartRead {
  /** One per category. Never empty when `trouble` is empty. */
  labels: string[];
  series: ChartSeries[];
  /** Why it cannot be drawn, in a sentence, or empty when it can. */
  trouble: string;
  /**
   * Columns inside the range that are not drawn, by name.
   *
   * A column of grade letters beside a column of marks has to be left out —
   * see {@link readChart} — and leaving it out *silently* is how somebody
   * ends up believing a chart covers a table it only covers half of. The
   * names come back so the screen can say which.
   */
  dropped: string[];
  /**
   * Where in the grid the drawing came from.
   *
   * The screen does not need this — it has the numbers. A real `.xlsx` does:
   * a chart in a workbook is not a copy of the figures, it is
   * `'Term marks'!$B$2:$B$5`, which is why editing the cell in Excel moves the
   * bar. Working those addresses out a second time in `lib/xlsx.ts` would be a
   * second copy of the rule about which row is a heading and which column is a
   * label — and the two would disagree the first time either changed.
   */
  at: {
    firstRow: number;
    lastRow: number;
    /** The row the series names came from, or null when they are column letters. */
    headerRow: number | null;
    /** The column the category names came from, or null when they are row numbers. */
    labelColumn: number | null;
  };
  /**
   * Columns of real numbers past the eighth, by name.
   *
   * Held apart from `dropped` because the reason is different and so is the
   * remedy: "that column has no numbers in it" is a fact about the sheet,
   * "this chart is already carrying eight series" is a fact about the chart,
   * and telling somebody the wrong one sends them to fix the wrong thing.
   */
  beyond: string[];
}

/** The largest block this will chart. Past it the picture is a smear anyway. */
export const MAX_POINTS = 200;
export const MAX_SERIES = 8;

// ── Reading the block ─────────────────────────────────────────────────────

/**
 * One cell as a number, or null.
 *
 * Through `evaluate` so a formula charts as its answer, and an error charts as
 * a gap rather than as zero — a `#DIV/0!` drawn as a bar of height nothing is
 * indistinguishable from a real zero, and one of those is a result.
 *
 * `asPercent` is why `80%` typed into a cell charts as 0.8 and not as nothing:
 * the grid stores what was typed, and a percentage is the one thing people
 * type with its unit attached.
 */
export function numberAt(cells: Cells, address: string, ctx: Ctx): number | null {
  const raw = cells[address];
  if (raw === undefined || raw === '') return null;
  const value = evaluate(cells, address, new Set(), ctx);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isError(value)) return null;
  const percent = asPercent(String(value));
  if (percent) return percent.value;
  return asNumber(String(value));
}

/** One cell as the words in it — a heading, a category name. */
function textAt(cells: Cells, address: string, ctx: Ctx): string {
  const raw = cells[address];
  if (raw === undefined) return '';
  const value = evaluate(cells, address, new Set(), ctx);
  if (isError(value)) return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/** The corners of an `A1:C9`, in row and column indices. Null when it is not one. */
export function corners(
  range: string,
): { top: number; left: number; bottom: number; right: number } | null {
  const [from, to] = range.split(':');
  const a = parseRef(from ?? '');
  const b = parseRef(to ?? from ?? '');
  if (!a || !b) return null;
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

/**
 * The block behind a chart, as categories and series.
 *
 * Columns are series and rows are categories, always — which is the shape a
 * table on a screen already has, with a heading row across the top and the
 * names down the side. A `bar` chart is the same reading drawn sideways
 * rather than a second arrangement of the data, because "swap the axes" is a
 * question about the picture and not about what the numbers mean.
 *
 * A column with no numbers in it at all is left out rather than drawn as a
 * flat line along zero. That is the second text column somebody has in the
 * middle of a table — a grade letter beside a mark — and drawing it would put
 * a meaningless series in the legend for every such table in the world.
 */
export function readChart(cells: Cells, chart: SheetChart, ctx: Ctx = clock()): ChartRead {
  const none = (trouble: string): ChartRead => ({
    labels: [],
    series: [],
    trouble,
    dropped: [],
    beyond: [],
    at: { firstRow: 0, lastRow: 0, headerRow: null, labelColumn: null },
  });
  const at = corners(chart.range);
  if (!at) return none('That is not a range this can read.');

  const firstRow = at.top + (chart.headers ? 1 : 0);
  const firstCol = at.left + (chart.labels ? 1 : 0);
  if (firstRow > at.bottom) return none('The range is only its heading row.');
  if (firstCol > at.right) return none('The range is only its label column.');

  const rows = at.bottom - firstRow + 1;
  const cols = at.right - firstCol + 1;
  if (rows * cols > MAX_POINTS) {
    return none(`That is ${rows * cols} cells. Chart ${MAX_POINTS} or fewer at a time.`);
  }

  const labels: string[] = [];
  for (let r = firstRow; r <= at.bottom; r++) {
    const name = chart.labels ? textAt(cells, ref(r, at.left), ctx) : '';
    labels.push(name || `Row ${r + 1}`);
  }

  const series: ChartSeries[] = [];
  const dropped: string[] = [];
  const beyond: string[] = [];
  for (let c = firstCol; c <= at.right; c++) {
    const values: (number | null)[] = [];
    for (let r = firstRow; r <= at.bottom; r++) values.push(numberAt(cells, ref(r, c), ctx));
    const named = (chart.headers ? textAt(cells, ref(at.top, c), ctx) : '') || colName(c);
    if (values.every((v) => v === null)) {
      dropped.push(named);
      continue;
    }
    if (series.length === MAX_SERIES) {
      beyond.push(named);
      continue;
    }
    series.push({ name: named, values, column: c });
  }

  if (!series.length) return none('Nothing in that range is a number.');
  return {
    labels,
    series,
    trouble: '',
    dropped,
    beyond,
    at: {
      firstRow,
      lastRow: at.bottom,
      headerRow: chart.headers ? at.top : null,
      labelColumn: chart.labels ? at.left : null,
    },
  };
}

/**
 * Whether a row of cells reads as names rather than as figures.
 *
 * What decides the two checkboxes for somebody who has not thought about
 * them. "Mostly" rather than "all", because a heading row of `Week 1 · Week 2`
 * is names that happen to end in digits, and a label column of years is
 * numbers that are plainly labels — so it takes a majority and lets the
 * checkbox be the appeal.
 */
function mostlyWords(texts: string[]): boolean {
  const said = texts.filter((t) => t.trim() !== '');
  if (!said.length) return false;
  const words = said.filter((t) => asNumber(t) === null && !asPercent(t));
  return words.length * 2 > said.length;
}

/**
 * The chart a selection most likely wants, before anybody adjusts it.
 *
 * Every field is a guess somebody can overrule on the chart itself, which is
 * the point: a dialogue asking four questions before drawing anything is how
 * charting became a thing people avoid.
 */
export function suggest(cells: Cells, range: string, now = Date.now()): SheetChart {
  const at = corners(range);
  const blank: SheetChart = {
    id: crypto.randomUUID(),
    kind: 'column',
    range,
    title: '',
    headers: false,
    labels: false,
    created: now,
  };
  if (!at) return blank;

  const ctx = clock(now);
  const topRow: string[] = [];
  for (let c = at.left; c <= at.right; c++) topRow.push(textAt(cells, ref(at.top, c), ctx));
  const leftCol: string[] = [];
  for (let r = at.top; r <= at.bottom; r++) leftCol.push(textAt(cells, ref(r, at.left), ctx));

  /*
   * The corner cell is judged by neither.
   *
   * The top-left of a table with both a heading row and a label column is
   * usually empty, and sometimes holds the word "Name" — so counting it as
   * evidence either way lets one ambiguous cell decide both checkboxes. It is
   * left out of both votes whenever the range has more than one row and more
   * than one column, which is exactly when it is ambiguous.
   *
   * A single row or column is its own series besides: nothing above one cell
   * is a heading and nothing beside it is a label, whatever the words look
   * like, which is what the two size tests below are for.
   */
  const block = at.bottom > at.top && at.right > at.left;
  const headers = at.bottom > at.top && mostlyWords(block ? topRow.slice(1) : topRow);
  const labels = at.right > at.left && mostlyWords(block ? leftCol.slice(1) : leftCol);
  const out: SheetChart = { ...blank, headers, labels };

  // One series of a handful of parts is the shape a pie is honest about, and
  // the shape people reach for it for. More than that and the slices stop
  // being tellable apart, so it stays columns.
  const read = readChart(cells, out, ctx);
  if (!read.trouble && read.series.length === 1 && read.labels.length <= 8 && labels) {
    const only = read.series[0].values;
    if (only.every((v) => v === null || v >= 0)) return { ...out, kind: 'pie' };
  }
  return out;
}

// ── The axis ──────────────────────────────────────────────────────────────

export interface Scale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Where the axis starts. See the head of this file. */
export type Baseline = 'zero' | 'fit';

export function baselineFor(kind: ChartKind): Baseline {
  return kind === 'line' ? 'fit' : 'zero';
}

/** The 1 · 2 · 5 ladder, which is the only set of gaps a reader adds up in their head. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const scaled = rough / power;
  if (scaled <= 1) return power;
  if (scaled <= 2) return 2 * power;
  if (scaled <= 5) return 5 * power;
  return 10 * power;
}

/**
 * An axis whose labels are round numbers.
 *
 * Four cases this gets wrong if written as the obvious two lines, all of them
 * real in a student's sheet: every value the same (a column of 100s), every
 * value zero (a term not started), one value only, and values that straddle
 * zero (a budget with a refund in it).
 */
export function scaleFor(values: number[], baseline: Baseline = 'zero', want = 5): Scale {
  const real = values.filter((v) => Number.isFinite(v));
  let lo = real.length ? Math.min(...real) : 0;
  let hi = real.length ? Math.max(...real) : 0;

  if (baseline === 'zero' || lo * hi < 0) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    /*
     * A flat series still needs an axis with two ends to it.
     *
     * A tenth either way rather than doubling, so a line of marks all at 88
     * draws along the middle of a chart reading 80 to 96 — not along the
     * middle of one reading 0 to 176, which says "this figure could have been
     * anything" about a figure that could not.
     *
     * Under a zero baseline the bottom stays at zero and only the top moves,
     * because moving the bottom is the thing a zero baseline exists to stop.
     */
    const pad = Math.abs(lo) * 0.1 || 1;
    if (baseline === 'zero') {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, lo + pad);
    } else {
      lo -= pad;
      hi += pad;
    }
  }

  const step = niceStep((hi - lo) / Math.max(1, want));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Counted rather than accumulated: adding 0.1 twenty times lands on
  // 2.0000000000000004 and prints an axis nobody wants to look at.
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) ticks.push(round(min + i * step));
  return { min: round(min), max: round(max), step, ticks };
}

/** Floating-point crumbs off, at the precision a tick can actually carry. */
function round(n: number): number {
  return Number(n.toPrecision(12));
}

/**
 * A number as short as it can be and still be read.
 *
 * Axis labels have about five characters before they start overlapping on a
 * phone, so a thousand-separated `1,250,000` is four ticks of mush. Thousands
 * and millions get their letter; everything else is grouped.
 */
export function axisText(n: number): string {
  if (!Number.isFinite(n)) return '';
  const size = Math.abs(n);
  if (size >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (size >= 10_000) return `${trim(n / 1000)}k`;
  return trim(n);
}

function trim(n: number): string {
  const fixed = Math.abs(n) < 1 && n !== 0 ? n.toPrecision(2) : n.toFixed(2);
  const bare = Number(fixed);
  return bare.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ── Where the marks go ────────────────────────────────────────────────────

/** A slice of a pie: where it starts, where it ends, and what share it is. */
export interface Slice {
  label: string;
  value: number;
  /** 0–1. */
  share: number;
  /** Degrees clockwise from twelve o'clock. */
  from: number;
  to: number;
}

/**
 * One series as slices.
 *
 * Negatives are dropped rather than reflected: a pie is parts of a whole, and
 * a negative part of a whole is not a thing. Dropping them and saying so beats
 * drawing a slice whose angle is a lie about its sign.
 */
export function slices(labels: string[], values: (number | null)[]): Slice[] {
  const kept = labels
    .map((label, i) => ({ label, value: values[i] ?? 0 }))
    .filter((s) => s.value > 0);
  const total = kept.reduce((sum, s) => sum + s.value, 0);
  if (!total) return [];
  let cursor = 0;
  return kept.map((s) => {
    const share = s.value / total;
    const from = cursor;
    cursor += share * 360;
    return { ...s, share, from, to: cursor };
  });
}

/** A wedge of a circle as an SVG path, clockwise from twelve o'clock. */
export function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
  // A full circle has no two distinct ends, so an arc cannot draw it: the two
  // points coincide and the path collapses to nothing. Two half arcs do.
  if (to - from >= 359.999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx} ${cy - r} Z`;
  }
  const a = point(cx, cy, r, from);
  const b = point(cx, cy, r, to);
  const big = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${big} 1 ${b.x} ${b.y} Z`;
}

function point(cx: number, cy: number, r: number, degrees: number): { x: number; y: number } {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
}

/**
 * How wide each category's block is, and where each bar inside it sits.
 *
 * The gaps are shares of the block rather than pixels, so four series across a
 * phone and four across a laptop are the same picture at two sizes.
 */
export function bands(
  length: number,
  count: number,
  series: number,
): { band: number; width: number; offset: (i: number) => number } {
  const band = count > 0 ? length / count : length;
  // A fifth of the block to the gap between blocks, which keeps categories
  // tellable apart without the bars becoming threads.
  const inner = band * 0.8;
  const width = series > 0 ? inner / series : inner;
  return { band, width, offset: (i: number) => band * 0.1 + i * width };
}

/** Whether this chart's picture needs a legend — more than one series does. */
export function needsLegend(read: ChartRead, kind: ChartKind): boolean {
  return kind === 'pie' ? read.labels.length > 1 : read.series.length > 1;
}

/**
 * What the picture is quietly leaving out, in a sentence, or nothing.
 *
 * Every chart in every application does one of these two things without
 * saying so, and both are the same failure: the picture covers less than the
 * range it names, and looks complete. A pie can only draw one series, and a
 * column of words cannot be drawn at all — so both are said, under the chart,
 * where somebody about to paste it into a paper will read it.
 */
export function chartNote(chart: SheetChart, read: ChartRead): string {
  if (read.trouble) return '';
  const said: string[] = [];
  if (chart.kind === 'pie' && read.series.length > 1) {
    said.push(`A pie draws one series, so this is ${read.series[0].name} alone.`);
  }
  if (read.dropped.length) {
    const names = read.dropped.join(', ');
    said.push(
      read.dropped.length === 1
        ? `${names} holds no numbers and is not drawn.`
        : `${names} hold no numbers and are not drawn.`,
    );
  }
  if (read.beyond.length) {
    said.push(`Past ${MAX_SERIES} series: ${read.beyond.join(', ')} ${read.beyond.length === 1 ? 'is' : 'are'} not drawn.`);
  }
  return said.join(' ');
}

/**
 * What a screen reader is told the picture shows.
 *
 * An `<svg role="img">` with no name is a hole in the page, and "chart" is not
 * better. This is the sentence somebody hears instead of seeing it, so it
 * names the shape, the series and the categories, and the whole table is under
 * the chart besides — see `components/SheetChart.tsx`.
 */
export function describeChart(chart: SheetChart, read: ChartRead): string {
  if (read.trouble) return read.trouble;
  const what = CHART_LABELS[chart.kind].toLowerCase();
  const named = chart.title ? `${chart.title}: ` : '';
  if (chart.kind === 'pie') {
    return `${named}pie of ${read.labels.length} parts, from ${read.series[0]?.name ?? 'the range'}.`;
  }
  const names = read.series.map((s) => s.name).join(', ');
  return `${named}${what} chart of ${read.series.length} series (${names}) across ${read.labels.length} categories.`;
}

// ── Reading them back off a stored sheet ──────────────────────────────────

/**
 * The charts on a sheet, with anything malformed dropped.
 *
 * Sheets are restored from localStorage through `list()` in `lib/stored.ts`,
 * which takes the holes out of an array and trusts what is left — right for
 * cells, where every value is a string somebody typed, and not enough here,
 * where a chart is an object with a kind that has to be one of four. A stored
 * copy from a future build, or one edited by hand, must not be able to put
 * `undefined` through `CHART_LABELS[kind]` and take the screen down with it.
 */
export function chartsOf(sheet: { charts?: unknown }): SheetChart[] {
  if (!Array.isArray(sheet.charts)) return [];
  const out: SheetChart[] = [];
  for (const row of sheet.charts) {
    if (!row || typeof row !== 'object') continue;
    const c = row as Partial<SheetChart>;
    if (typeof c.id !== 'string' || typeof c.range !== 'string') continue;
    if (!CHART_KINDS.includes(c.kind as ChartKind)) continue;
    if (!corners(c.range)) continue;
    out.push({
      id: c.id,
      kind: c.kind as ChartKind,
      range: c.range,
      title: typeof c.title === 'string' ? c.title : '',
      headers: c.headers === true,
      labels: c.labels === true,
      created: typeof c.created === 'number' ? c.created : 0,
    });
  }
  return out;
}
