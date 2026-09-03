/**
 * Changing a course after it exists.
 *
 * A syllabus is not a fact, it is a first draft. A paper moves a week, a
 * weighting is corrected in the second lecture, a room changes, a professor
 * turns out to go by something other than what the PDF says. Until now the
 * app could generate a course and never alter it, which meant the first thing
 * that changed made the whole course slightly wrong and there was nothing to
 * do about it except delete and re-import — losing everything you had ticked
 * off and every card you had drilled.
 *
 * So everything a syllabus states is editable, and the edits are ordinary data
 * operations on the module. The functions here are pure so they can be tested
 * without a screen: they take a module and return a new one, and they never
 * mutate what they were handed, because the store compares by identity.
 */

import type { CourseModule, GradeRow, Item, RecurringBlock } from './types';

/** A new id that will not collide with the generator's or the sample's. */
export function itemId(courseId: string, existing: Item[]): string {
  for (let n = existing.length + 1; ; n++) {
    const candidate = `${courseId}-own${n}`;
    if (!existing.some((i) => i.id === candidate)) return candidate;
  }
}

export function blankItem(courseId: string, existing: Item[], now = new Date()): Item {
  return {
    id: itemId(courseId, existing),
    c: courseId as Item['c'],
    title: '',
    kind: 'Assignment',
    month: now.getMonth(),
    day: now.getDate(),
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    // Said plainly, because "Straight from the syllabus" must not appear over
    // something a person typed themselves.
    source: 'Added by you',
  };
}

/** The kinds a deadline is usually one of. Free text is still allowed. */
export const KINDS = [
  'Assignment',
  'Reading',
  'Problem set',
  'Paper',
  'Quiz',
  'Exam',
  'Presentation',
  'Project',
  'Discussion',
  'Lab',
];

export function withCourse(module: CourseModule, patch: Partial<CourseModule['course']>): CourseModule {
  const course = { ...module.course, ...patch };
  return {
    ...module,
    course,
    // The guide carries its own copy of the code and name for every screen
    // that shows a guide without its course. Leaving them behind is how a
    // renamed course keeps its old name on half the screens.
    guide: { ...module.guide, code: course.code, name: course.name },
  };
}

export function withItems(module: CourseModule, items: Item[]): CourseModule {
  return { ...module, items: [...items].sort(byDate) };
}

export function byDate(a: Item, b: Item): number {
  return a.month - b.month || a.day - b.day;
}

export function addItem(module: CourseModule, item: Item): CourseModule {
  return withItems(module, [...module.items, item]);
}

export function patchItem(module: CourseModule, id: string, patch: Partial<Item>): CourseModule {
  return withItems(
    module,
    module.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  );
}

export function dropItem(module: CourseModule, id: string): CourseModule {
  return withItems(
    module,
    module.items.filter((i) => i.id !== id),
  );
}

export function withGrading(module: CourseModule, grading: GradeRow[]): CourseModule {
  return { ...module, course: { ...module.course, grading } };
}

export function withSchedule(module: CourseModule, schedule: RecurringBlock[]): CourseModule {
  return { ...module, schedule };
}

/**
 * Whether the grading adds up, and by how much it does not.
 *
 * Returns null when nothing can be read as a percentage — a syllabus that
 * grades on letters or on a points total is not wrong, and flagging it would
 * train people to ignore the warning that matters.
 */
export function weightTotal(grading: GradeRow[]): number | null {
  let total = 0;
  let any = false;
  for (const row of grading) {
    const m = /(\d+(?:\.\d+)?)\s*%/.exec(row.pct);
    if (!m) continue;
    any = true;
    total += Number(m[1]);
  }
  return any ? Math.round(total * 10) / 10 : null;
}

/** The note under the grading table. Silent when it has nothing useful to say. */
export function weightNote(grading: GradeRow[]): string {
  const total = weightTotal(grading);
  if (total === null) return '';
  if (Math.abs(total - 100) < 0.05) return 'Adds up to 100%.';
  if (total < 100) return `Adds up to ${total}% — ${Math.round((100 - total) * 10) / 10}% unaccounted for.`;
  return `Adds up to ${total}%, which is ${Math.round((total - 100) * 10) / 10}% over.`;
}

/**
 * "2026-09-14" for a date input, from the month and day a course stores.
 *
 * Courses hold a month index and a day rather than a Date, because a semester
 * has one year and storing a full timestamp invited timezone bugs. The date
 * input wants ISO, so this is the join between the two.
 */
export function toInputDate(month: number, day: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function fromInputDate(iso: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { month, day };
}

/** Days of the week, in the order a timetable is read. */
export const DAYS: { day: number; label: string }[] = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'R' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'U' },
];

/** What a course is missing, so the screen can point rather than accuse. */
export function gaps(module: CourseModule): string[] {
  const out: string[] = [];
  const c = module.course;
  if (!c.prof.trim()) out.push('no professor');
  if (!c.email.trim()) out.push('no email to write to');
  if (!c.room.trim()) out.push('no room, so no directions');
  if (c.grading.length === 0) out.push('no grading, so Grades cannot work');
  if (module.items.length === 0) out.push('no deadlines');
  if (module.schedule.length === 0) out.push('no meeting times, so it is on no calendar');
  return out;
}
