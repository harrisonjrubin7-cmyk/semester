/**
 * Cells that colour themselves.
 *
 * The one thing the format toolbar could not do: a colour that follows the
 * *number*. A student marking up a gradebook by hand paints the three marks
 * under sixty red, and then edits a mark, and the red stays where it was —
 * which is worse than no colour at all, because it is a claim about a figure
 * that is no longer true.
 *
 * So a rule is stored and the colour is worked out on every read, exactly the
 * way a formula's answer is. There is nothing to keep in step because nothing
 * is written down twice.
 *
 * ## It paints, it never computes
 *
 * A rule reads a value and answers with a colour. It cannot change what a cell
 * holds, cannot add a cell, and is not visible to `evaluate` — so no formula
 * anywhere can depend on one. That is deliberate and it is what keeps this
 * file cheap to be wrong in: the worst a bad rule can do is make a cell the
 * wrong colour, and every number on the screen is still the number.
 *
 * ## The rule wins over the paintbrush
 *
 * Where a rule and a hand-applied style both say what colour a cell is, the
 * rule wins — which is what Excel does, and is the only answer that makes a
 * rule worth setting: a rule you have to un-paint every cell to see is not a
 * rule. Only the properties the rule sets are taken; a bold cell that a rule
 * turns red stays bold.
 */

import { asNumber, asPercent, isError, type CellStyle, type Ink, type Value } from './sheet';

/** What a rule compares. */
export const TESTS = [
  'greater',
  'less',
  'between',
  'equal',
  'contains',
  'empty',
  'error',
] as const;

export type Test = (typeof TESTS)[number];

export const TEST_LABELS: Record<Test, string> = {
  greater: 'Greater than',
  less: 'Less than',
  between: 'Between',
  equal: 'Equal to',
  contains: 'Contains',
  empty: 'Empty',
  error: 'An error',
};

/** Where the colour goes: on the type, or behind it. */
export type Paint = 'ink' | 'wash';

export interface CondRule {
  id: string;
  /** The block it watches, as an A1 range — `"B2:B20"`. */
  range: string;
  test: Test;
  /** What it is compared against. A number for the numeric tests, text for `contains`. */
  value: string;
  /** The far end, for `between`. Ignored by every other test. */
  value2?: string;
  ink: Ink;
  as: Paint;
  created: number;
}

/** A rule with nothing filled in, for the row that has just been added. */
export function blankRule(range: string, now = Date.now()): CondRule {
  return {
    id: crypto.randomUUID(),
    range,
    test: 'less',
    value: '',
    ink: 'red',
    as: 'wash',
    created: now,
  };
}

/**
 * One value read the way a rule compares it.
 *
 * `null` where there is no number to compare — which is not the same as zero,
 * and is why "less than 60" does not paint every empty cell in the column.
 * That is the single commonest way conditional formatting goes wrong in a
 * spreadsheet: a rule meant for the marks colours the whole sheet.
 */
function asFigure(value: Value): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isError(value)) return null;
  const text = String(value);
  if (text.trim() === '') return null;
  const percent = asPercent(text);
  return percent ? percent.value : asNumber(text);
}

/** Whether a rule paints this value. */
export function paints(rule: CondRule, value: Value): boolean {
  if (rule.test === 'empty') return value === '' || value === undefined;
  if (rule.test === 'error') return isError(value);
  if (isError(value)) return false;

  if (rule.test === 'contains') {
    const needle = rule.value.trim().toLowerCase();
    if (!needle) return false;
    return String(value).toLowerCase().includes(needle);
  }

  const figure = asFigure(value);
  const against = asFigure(rule.value);

  /*
   * `equal` is the one test that is also about words.
   *
   * "Equal to A" is a thing somebody wants of a column of letter grades, and
   * refusing it because `A` is not a number would make the test useless on
   * half the columns in a gradebook. Numbers compare as numbers where both
   * sides are numbers, so `equal 80` still matches a cell holding `80.0`.
   */
  if (rule.test === 'equal') {
    if (figure !== null && against !== null) return figure === against;
    if (rule.value.trim() === '') return false;
    return String(value).trim().toLowerCase() === rule.value.trim().toLowerCase();
  }

  if (figure === null || against === null) return false;
  if (rule.test === 'greater') return figure > against;
  if (rule.test === 'less') return figure < against;
  const far = asFigure(rule.value2 ?? '');
  if (far === null) return false;
  return figure >= Math.min(against, far) && figure <= Math.max(against, far);
}

/**
 * Whether a rule is finished enough to paint anything.
 *
 * A rule somebody has begun and not filled in should colour nothing rather
 * than everything — an empty "less than" box read as zero would paint every
 * negative in the sheet the moment the row appeared, before anybody had said
 * what they meant.
 */
export function ready(rule: CondRule): boolean {
  if (rule.test === 'empty' || rule.test === 'error') return true;
  if (rule.test === 'contains' || rule.test === 'equal') return rule.value.trim() !== '';
  if (asFigure(rule.value) === null) return false;
  return rule.test !== 'between' || asFigure(rule.value2 ?? '') !== null;
}

/**
 * What the rules make of one cell, as a style to lay over its own.
 *
 * Later rules win, because they are the ones added last and adding a rule is
 * how somebody says "and this one too, on top". Undefined where no rule
 * matches, so the common cell costs one walk of a short list and allocates
 * nothing.
 */
export function painted(
  rules: readonly CondRule[],
  holds: (range: string) => boolean,
  value: Value,
): Partial<CellStyle> | undefined {
  let out: Partial<CellStyle> | undefined;
  for (const rule of rules) {
    if (!ready(rule) || !holds(rule.range) || !paints(rule, value)) continue;
    out = { ...out, [rule.as]: rule.ink };
  }
  return out;
}

/** The rules on a sheet, with anything malformed dropped. See `chartsOf`. */
export function rulesOf(sheet: { rules?: unknown }, inks: readonly string[]): CondRule[] {
  if (!Array.isArray(sheet.rules)) return [];
  const out: CondRule[] = [];
  for (const row of sheet.rules) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<CondRule>;
    if (typeof r.id !== 'string' || typeof r.range !== 'string') continue;
    if (!TESTS.includes(r.test as Test)) continue;
    if (!inks.includes(r.ink as string)) continue;
    out.push({
      id: r.id,
      range: r.range,
      test: r.test as Test,
      value: typeof r.value === 'string' ? r.value : '',
      ...(typeof r.value2 === 'string' ? { value2: r.value2 } : {}),
      ink: r.ink as Ink,
      as: r.as === 'ink' ? 'ink' : 'wash',
      created: typeof r.created === 'number' ? r.created : 0,
    });
  }
  return out;
}

/** How a rule reads on the screen, for the row that lists it. */
export function saysRule(rule: CondRule): string {
  const what = TEST_LABELS[rule.test].toLowerCase();
  if (rule.test === 'empty' || rule.test === 'error') return `${rule.range} · ${what}`;
  if (rule.test === 'between') return `${rule.range} · ${what} ${rule.value} and ${rule.value2 ?? ''}`;
  return `${rule.range} · ${what} ${rule.value}`;
}
