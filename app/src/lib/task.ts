import { num, rows, str } from './stored';
import type { PersonalTask } from './types';

/**
 * The saved tasks, with the date every dated view reads.
 *
 * `date` is `string | null`, and the null half is a real state — an undated
 * task sits in "someday". Every reader of it therefore tests truthiness before
 * splitting, including the calendar's month grid, which does `if (t.date)`
 * three lines above the two rows that had no such guard. That check answers
 * "is there a date" and not "is it one": a `date` stored as a number is truthy
 * and `isoToDate` then calls `.split` on it. Measured with `date: 9` in
 * storage: `iso.split is not a function`, and `<MonthView>` replaced by a
 * panel.
 *
 * So the shape is made to match what the type already promises — a string or
 * null, nothing else — and the guards every caller already writes start
 * telling the truth again.
 */
export function readTasks(raw: unknown): PersonalTask[] {
  return rows<PersonalTask>(raw, 'tk').map((t) => ({
    ...t,
    id: t.id as string,
    title: str(t.title),
    date: typeof t.date === 'string' && t.date ? t.date : null,
    time: str(t.time),
    note: str(t.note),
    done: t.done === true,
    created: num(t.created),
    courseId: typeof t.courseId === 'string' ? t.courseId : null,
  })) as PersonalTask[];
}
