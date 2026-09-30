/**
 * Local time at a dining location, and the week a meal plan counts in.
 *
 * A meal plan's week begins on a named weekday at local midnight in the
 * school's time zone — not in the student's, and not in UTC. A swipe at 23:50
 * on the last night of the week belongs to that week even when the server's
 * clock already says tomorrow. So every date here is a local calendar date,
 * worked out from an instant and an IANA zone, and the SQL does the same with
 * `at time zone` (`private.dining_local_date`).
 */

export interface LocalParts {
  /** The local calendar date, YYYY-MM-DD. */
  date: string;
  /** 0 = Sunday … 6 = Saturday, as Postgres `extract(dow …)` counts. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Whether a string names a time zone this runtime knows. */
export function validTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function localParts(at: number, timeZone: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(at))) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: DAYS[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** A local date moved by whole days. Calendar arithmetic, so no DST drift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from one local date to another. */
export function daysFrom(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** The weekday of a local date, 0 = Sunday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The first local date of the week containing `date`, for a week that starts on `weekStartsOn`. */
export function weekStartOf(date: string, weekStartsOn: number): string {
  return addDays(date, -((weekdayOf(date) - weekStartsOn + 7) % 7));
}
