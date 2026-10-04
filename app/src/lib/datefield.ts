/**
 * What is wrong with a date typed or picked into a date box, in words.
 *
 * The native `<input type="date">` hands back `YYYY-MM-DD` or an empty string,
 * and its `min`/`max` only mark the picker: a keyboard user can still type a
 * date outside them. So the range is checked here as well, and the sentence
 * says what to do — "Enter a date on or after 4 October", not "Invalid date".
 *
 * Dates are compared as `YYYY-MM-DD` strings, which sort the same as the dates
 * do, and never through `new Date('2026-10-04')`, which is UTC midnight and
 * reads as the evening before in every timezone west of Greenwich.
 */
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether this is a real calendar date, not just a string of the right shape. */
export function isRealDate(iso: string): boolean {
  const m = ISO.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(y, mo - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d;
}

/** A local-midnight `Date` for an ISO day, for formatting. */
export function localDay(iso: string): Date {
  const m = ISO.exec(iso)!;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export interface DateRules {
  min?: string;
  max?: string;
  required?: boolean;
}

/**
 * The sentence for what is wrong, or `undefined` when nothing is.
 *
 * `say` formats an ISO day for the reader (`formatDate`); it is passed in so
 * this stays pure and testable without a locale.
 */
export function dateProblem(value: string, rules: DateRules, say: (iso: string) => string): string | undefined {
  if (value === '') return rules.required ? 'Enter a date.' : undefined;
  if (!isRealDate(value)) return 'Enter a real date, such as the 4th of October.';
  if (rules.min && isRealDate(rules.min) && value < rules.min) return `Enter a date on or after ${say(rules.min)}.`;
  if (rules.max && isRealDate(rules.max) && value > rules.max) return `Enter a date on or before ${say(rules.max)}.`;
  return undefined;
}
