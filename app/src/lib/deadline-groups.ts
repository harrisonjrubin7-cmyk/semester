/**
 * The deadline tracker's horizon: Today, Next 48 hours, This week, Later this
 * term, and Needs confirmation.
 *
 * A student needs a current horizon, not a wall of dates, so this only sorts;
 * the screen decides how many groups to open. Two rules keep it calm and
 * honest:
 *
 * - A deadline whose date is missing, estimated or flagged for review goes to
 *   Needs confirmation whatever its date, because a date nobody has confirmed
 *   should not be sitting in "Today" as a fact.
 * - A deadline that has passed stays in Today, marked `passed`, rather than
 *   moving to a red overdue pile. It is still recoverable, and saying so is
 *   the point of `recovery`.
 */

import { SOURCE_TEXT, freshnessLine, type SourceLabel } from './source';

export const GROUPS = ['today', 'next48', 'week', 'later', 'confirm'] as const;
export type Group = (typeof GROUPS)[number];

export const GROUP_TEXT: Record<Group, string> = {
  today: 'Today',
  next48: 'Next 48 hours',
  week: 'This week',
  later: 'Later this term',
  confirm: 'Needs confirmation',
};

export interface Deadline {
  id: string;
  title: string;
  /** Epoch ms, or null when the source gave no date. */
  due: number | null;
  label: SourceLabel;
  /** When the source was last read. */
  at?: number | null;
  done?: boolean;
}

export interface Grouped extends Deadline {
  group: Group;
  passed: boolean;
  status: string;
  /** Where the date came from and how old it is. */
  source: string;
  confidence: 'Institution verified' | 'Student confirmed' | 'Imported, not checked' | 'Estimated';
  action: string;
  recovery: string[];
}

const DAY = 86_400_000;

const endOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const confidenceOf = (l: SourceLabel): Grouped['confidence'] =>
  l === 'institution_verified'
    ? 'Institution verified'
    : l === 'student_entered'
      ? 'Student confirmed'
      : l === 'imported'
        ? 'Imported, not checked'
        : 'Estimated';

function groupOf(d: Deadline, now: number): Group {
  if (d.due === null || d.label === 'estimated' || d.label === 'needs_review') return 'confirm';
  if (d.due <= endOfDay(now)) return 'today';
  if (d.due <= now + 2 * DAY) return 'next48';
  if (d.due <= endOfDay(now) + 6 * DAY) return 'week';
  return 'later';
}

export function group(deadlines: Deadline[], now = Date.now()): Record<Group, Grouped[]> {
  const out: Record<Group, Grouped[]> = { today: [], next48: [], week: [], later: [], confirm: [] };
  for (const d of deadlines) {
    if (d.done) continue;
    const g = groupOf(d, now);
    const passed = d.due !== null && d.due < now;
    const fresh = freshnessLine(d.at, now);
    out[g].push({
      ...d,
      group: g,
      passed,
      status:
        g === 'confirm'
          ? 'Needs review'
          : passed
            ? 'Passed, still recoverable'
            : g === 'today'
              ? 'Due today'
              : 'Upcoming',
      source: fresh ? `${SOURCE_TEXT[d.label]} · ${fresh}` : SOURCE_TEXT[d.label],
      confidence: confidenceOf(d.label),
      action: g === 'confirm' ? 'Open official source' : 'Plan time',
      recovery: ['Reschedule', 'Break into steps', 'Contact course staff', 'Dismiss'],
    });
  }
  for (const g of GROUPS) out[g].sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  return out;
}
