import type { CommitmentDay } from '../domains/today';
import { clock } from '../lib/date';
import { itemSource, type CommitmentRow } from '../lib/today-center';
import type { Appointment, DatedItem } from '../lib/types';

/**
 * The commitment rows the Action Center draws, read from the domain's look-ahead.
 *
 * The domain's entries say what is on which day and when. A row also says what to
 * call it and where it came from (the course code, the place, how far to trust the
 * date), which is the legacy record's business, so this is the shell joining the
 * two. It is the only place that knows both shapes.
 *
 * Held to `lib/commitment-rows.ts`, the code it replaces, case by case in
 * `commitments.test.ts`: the same rows, and the same `planCommitments` answer.
 */

/** How to find the legacy record behind an entry. Plain functions, so a test passes arrays. */
export interface CommitmentLookups {
  readonly deadline: (itemId: string) => DatedItem | undefined;
  readonly appointment: (id: string) => Appointment | undefined;
  /** A course's short code ("ECON 1020"), or nothing for a course the catalogue does not know. */
  readonly courseCode: (courseId: string) => string | undefined;
}

/** Classes only for today and tomorrow: a timetable repeated for ten days would push every deadline off the list. */
export const CLASS_DAYS = 2;

const midnight = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

const CLASS_ID = /^class:(\d{4}-\d{2}-\d{2}):(.*):(\d+)$/;

/**
 * The rows, or `null` when an entry has no record to draw it from.
 *
 * `null` and not a shorter list: a row silently missing from "what is coming up"
 * is wrong in the way that is hardest to see, so the caller falls back to the rows
 * it built before, which are complete.
 */
export function commitmentRowsFromDomain(days: readonly CommitmentDay[], lookups: CommitmentLookups): CommitmentRow[] | null {
  const out: CommitmentRow[] = [];
  for (let i = 0; i < days.length; i++) {
    const { on, entries } = days[i];
    const base = midnight(on);
    for (const e of entries) {
      if (e.kind === 'deadline') {
        if (e.done) continue;
        const itemId = e.id.replace(/^deadline:/, '');
        const item = lookups.deadline(itemId);
        if (!item) return null;
        out.push({
          id: `course:${itemId}`,
          at: base + (e.startMin ?? 24 * 60 - 1) * 60_000,
          title: e.title,
          meta: lookups.courseCode(item.c) || 'Course deadline',
          kind: 'deadline',
          group: item.c,
          source: itemSource(item),
          itemId,
        });
      } else if (e.kind === 'task') {
        if (e.done) continue;
        out.push({
          id: e.id,
          at: base + (e.startMin ?? 24 * 60 - 1) * 60_000,
          title: e.title,
          meta: 'Your action',
          kind: 'task',
          source: 'student_entered',
        });
      } else if (e.kind === 'appointment') {
        const id = /^appointment:(.*)@\d{4}-\d{2}-\d{2}$/.exec(e.id)?.[1];
        const appointment = id === undefined ? undefined : lookups.appointment(id);
        if (id === undefined || !appointment) return null;
        out.push({
          id: `appointment:${id}:${on}`,
          at: base + (e.startMin ?? 0) * 60_000,
          title: e.title,
          meta: appointment.where || 'Your appointment',
          kind: 'appointment',
          source: 'student_entered',
        });
      } else if (e.kind === 'class') {
        if (i >= CLASS_DAYS) continue;
        const parts = CLASS_ID.exec(e.id);
        if (!parts || e.startMin === null) return null;
        out.push({
          id: e.id,
          at: base + e.startMin * 60_000,
          title: e.title,
          meta: `Class · ${clock(e.startMin)}`,
          kind: 'class',
          group: parts[2] || undefined,
        });
      }
    }
  }
  return out;
}
