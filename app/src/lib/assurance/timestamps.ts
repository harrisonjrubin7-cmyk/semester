// The assurance contracts take ISO 8601 timestamps only. Date.parse alone also accepts
// locale forms such as 10/01/2026, which mean different days on different runtimes, and
// it normalises impossible calendar dates such as 2026-02-30 into 2026-03-02 instead of refusing them.
const ISO_8601 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/;

/** Leap seconds (:60) are refused: a Date cannot represent them, so the value would be silently shifted. */
export function isIsoTimestamp(value: string): boolean {
  const match = ISO_8601.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const offsetHour = Number(match[8] ?? 0);
  const offsetMinute = Number(match[9] ?? 0);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  if (offsetHour > 23 || offsetMinute > 59) return false;

  // Setting the calendar fields and reading them back catches 02-30, 04-31 and non-leap 02-29.
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
