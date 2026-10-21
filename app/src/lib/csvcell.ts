/**
 * The one CSV cell writer for text a person typed. Every export of user
 * content (sheets, data tables, statements, records, the finance model, the
 * gradebook and the operating workspace) goes through here, so a cell a
 * spreadsheet would run as a formula is defused the same way in every file.
 *
 * A leading `=`, `@`, `+`, `-`, tab or carriage return is treated as a formula
 * and gets a leading apostrophe, the spreadsheet's own "this is text" marker.
 * That includes `+00123` and `-0007`: a spreadsheet would coerce them and drop
 * the sign or the leading zeroes. A caller that holds a value it formatted as
 * a number, such as a statement amount, passes it through `csvNumber`, which
 * leaves a plain number alone and defuses anything else.
 */
const ALWAYS_FORMULA = /^[=@+\-\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/** Quote a cell only when its text needs it. Never defuses. */
export function quoteCsv(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvCell(v: string | number | null): string {
  if (v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return quoteCsv(ALWAYS_FORMULA.test(v) ? `'${v}` : v);
}

/** A cell the caller formatted as a number, so `-12.50` stays a number. */
export function csvNumber(v: string): string {
  return PLAIN_NUMBER.test(v) ? v : csvCell(v);
}
