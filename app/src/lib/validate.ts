/**
 * What a cell is allowed to hold.
 *
 * A gradebook column that should hold a mark out of a hundred, a column that
 * should hold one of four course codes, a column that should hold a whole
 * number of credits. The rule is written once over the block, and every cell
 * in it is checked against it.
 *
 * ## It marks; it never blocks and never changes anything
 *
 * This is the decision the rest of the file follows from, and it was forced by
 * how the grid works: a cell is written on **every keystroke**, not on Enter.
 * There is no commit to refuse at. A rule of *between 50 and 100* that refused
 * bad input would refuse the `8` on the way to `85`, so the column could never
 * be typed into at all.
 *
 * That turned out to be the better answer anyway, for the reason `condfmt.ts`
 * gives about colour: a rule that *changes* what a cell holds is a rule that
 * can lose what somebody typed. So a broken rule is shown — on the cell, and
 * counted in the status bar — and the number underneath is always still the
 * number they typed.
 *
 * It also means the marking is worth having. Excel validates what is *typed*
 * and lets everything else through: paste, fill, and import all bypass it
 * silently, which is exactly how a validated column ends up full of values
 * that break its own rule. Here the rule is re-read on every render, so a
 * value that arrived by any road at all is checked the same way.
 *
 * ## A list is also an offer
 *
 * The one thing a rule can do for you rather than to you: where it names a
 * list of values, the cell offers them. That is the half of data validation
 * people actually want — not being told off for typing `ECON 1O2O`, but not
 * having to type it.
 */

import { asNumber, isError, type Value } from './sheet';

/** What a rule checks. */
export const CHECKS = ['list', 'whole', 'decimal', 'between', 'length'] as const;

export type Check = (typeof CHECKS)[number];

export const CHECK_LABELS: Record<Check, string> = {
  list: 'One of these',
  whole: 'A whole number',
  decimal: 'A number',
  between: 'A number from … to …',
  length: 'Text no longer than',
};

export interface DataRule {
  id: string;
  /** The block it covers, as an A1 range — `"B2:B40"`. */
  range: string;
  check: Check;
  /** The allowed values for a `list`, separated by commas. */
  values: string;
  /** The bounds, as typed. Empty means unbounded on that side. */
  min: string;
  max: string;
  /**
   * Whether an empty cell passes. True on nearly every rule, and the reason
   * is that a column is filled in over a term: a blank that is going to be a
   * mark next week is not a mistake, and a sheet that says so about forty
   * cells has said nothing about any of them.
   */
  blankOk: boolean;
  created: number;
}

export function blankRule(range: string, now = Date.now()): DataRule {
  return {
    id: crypto.randomUUID(),
    range,
    check: 'list',
    values: '',
    min: '',
    max: '',
    blankOk: true,
    created: now,
  };
}

/** The values a `list` rule offers, trimmed and with the empties dropped. */
export function choicesOf(rule: DataRule): string[] {
  if (rule.check !== 'list') return [];
  const seen: string[] = [];
  for (const raw of rule.values.split(',')) {
    const text = raw.trim();
    if (text && !seen.includes(text)) seen.push(text);
  }
  return seen;
}

/**
 * Whether a rule is complete enough to check anything.
 *
 * An unfinished rule marks nothing rather than marking everything: somebody
 * halfway through typing the list of course codes has not yet said that every
 * cell in the column is wrong.
 */
export function ready(rule: DataRule): boolean {
  if (rule.check === 'list') return choicesOf(rule).length > 0;
  if (rule.check === 'between') return asNumber(rule.min) !== null && asNumber(rule.max) !== null;
  if (rule.check === 'length') return asNumber(rule.max) !== null;
  return true;
}

/**
 * Whether a cell's value satisfies the rule.
 *
 * Takes the computed value, not the text, so `=40+45` is checked as 85 — the
 * rule is about what the cell *is*, and a column of marks half typed and half
 * computed is one column.
 */
export function allows(rule: DataRule, value: Value, text: string): boolean {
  if (!ready(rule)) return true;
  const empty = text.trim() === '' && value === '';
  if (empty) return rule.blankOk;
  // An error is never a value the rule can have meant to allow, and saying so
  // here is better than a `#DIV/0!` sitting quietly inside a checked column.
  if (isError(value)) return false;

  if (rule.check === 'list') {
    const said = typeof value === 'string' && value !== '' ? value : text;
    return choicesOf(rule).some((choice) => choice.toLowerCase() === said.trim().toLowerCase());
  }

  if (rule.check === 'length') {
    const most = asNumber(rule.max);
    const said = typeof value === 'string' ? value : text;
    return most === null || said.trim().length <= most;
  }

  const n = typeof value === 'number' ? value : asNumber(text);
  if (n === null) return false;
  if (rule.check === 'whole' && !Number.isInteger(n)) return false;

  const low = asNumber(rule.min);
  const high = asNumber(rule.max);
  if (low !== null && n < low) return false;
  if (high !== null && n > high) return false;
  return true;
}

/**
 * Why a cell breaks its rule, in the words the screen shows.
 *
 * A sentence rather than a flag, because "that is not allowed" is the least
 * useful thing a validated column can say: the point of the rule is that
 * somebody wrote down what it should hold, so the cell can say it.
 */
export function whyNot(rule: DataRule): string {
  if (rule.check === 'list') {
    const choices = choicesOf(rule);
    const said =
      choices.length <= 4
        ? choices.join(', ')
        : `${choices.slice(0, 4).join(', ')} and ${choices.length - 4} more`;
    return `Should be one of: ${said}.`;
  }
  if (rule.check === 'length') return `Should be no longer than ${rule.max} characters.`;
  const low = asNumber(rule.min);
  const high = asNumber(rule.max);
  const kind = rule.check === 'whole' ? 'a whole number' : 'a number';
  if (low !== null && high !== null) return `Should be ${kind} from ${rule.min} to ${rule.max}.`;
  if (low !== null) return `Should be ${kind}, ${rule.min} or more.`;
  if (high !== null) return `Should be ${kind}, ${rule.max} or less.`;
  return `Should be ${kind}.`;
}

/** What a rule reads as on the row that lists it. */
export function saysRule(rule: DataRule): string {
  const what =
    rule.check === 'list'
      ? `one of ${choicesOf(rule).length || 'no'} values`
      : whyNot(rule).replace(/^Should be /, '').replace(/\.$/, '');
  return `${rule.range} · ${what}`;
}

/** The rules a sheet holds, with anything malformed dropped. See `rulesOf` in `condfmt.ts`. */
export function checksOf(sheet: { checks?: unknown }): DataRule[] {
  if (!Array.isArray(sheet.checks)) return [];
  const out: DataRule[] = [];
  for (const row of sheet.checks) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<DataRule>;
    if (typeof r.id !== 'string' || typeof r.range !== 'string') continue;
    if (!CHECKS.includes(r.check as Check)) continue;
    out.push({
      id: r.id,
      range: r.range,
      check: r.check as Check,
      values: typeof r.values === 'string' ? r.values : '',
      min: typeof r.min === 'string' ? r.min : '',
      max: typeof r.max === 'string' ? r.max : '',
      blankOk: r.blankOk !== false,
      created: typeof r.created === 'number' ? r.created : 0,
    });
  }
  return out;
}
