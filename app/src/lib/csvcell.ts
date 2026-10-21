/**
 * The one CSV cell writer for text a person typed. Every export of user
 * content (sheets, data tables, statements, records, the finance model) goes
 * through here, so a cell a spreadsheet would run as a formula is defused the
 * same way in every file.
 *
 * A leading `=`, `@`, tab or carriage return is always a formula to a
 * spreadsheet. A leading `+` or `-` is one unless the whole cell is a plain
 * number, so `-12.50` in a statement stays a number and `-1+cmd()` does not.
 * A defused cell gets a leading apostrophe, which is the spreadsheet's own
 * "this is text" marker.
 */
const ALWAYS_FORMULA = /^[=@\t\r]/;
const SIGNED = /^[+-]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function csvCell(v: string | number | null): string {
  if (v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const formula = ALWAYS_FORMULA.test(v) || (SIGNED.test(v) && !PLAIN_NUMBER.test(v));
  const guarded = formula ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
