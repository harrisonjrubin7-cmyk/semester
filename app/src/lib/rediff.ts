/**
 * What changes when a course is imported over one you already have.
 *
 * Importing a syllabus twice replaced the course wholesale, silently. Nothing
 * said which dates had moved, which weightings had been corrected, or — the
 * one that matters — which deadlines had disappeared. So the safe thing to do
 * with a corrected syllabus was nothing, and a course that had been updated
 * mid-term stayed wrong on purpose.
 *
 * This is the diff, and it is shown before anything is written.
 *
 * ## Matching, and why it is cautious in the same way `reconcile.ts` is
 *
 * A re-import is not the same file: titles get re-worded, "Reflection #1"
 * becomes "Reflection 1 — play", a paper is split into a proposal and a draft.
 * So items are paired by fuzzy title within the course, using the same scoring
 * `reconcile.ts` uses against a calendar feed — one place for that judgement
 * rather than two that drift.
 *
 * Below the threshold it reports a removal and an addition rather than a
 * confident rename, for the same reason: "this went and that arrived" is
 * checkable at a glance, while a wrong pairing hides a deadline that really
 * did disappear.
 *
 * ## What is never touched
 *
 * Your progress. Ticked boxes are keyed by item id and card reviews by the
 * question's text, both of which live outside the course module — so a
 * re-import cannot lose them, and `keepIds` makes sure an item that survived
 * keeps the id its tick is filed under.
 */

import { movedLine as movedDays } from './date';
import type { CourseModule, GradeRow, Item } from './types';
import { similarity, THRESHOLD } from './reconcile';

export interface Moved {
  before: Item;
  after: Item;
  /** Whole days, signed. Positive means the new syllabus is later. */
  days: number;
}

export interface Renamed {
  before: Item;
  after: Item;
}

export interface Retimed {
  before: Item;
  after: Item;
}

export interface Reweighted {
  what: string;
  before: string;
  after: string;
}

export interface Diff {
  moved: Moved[];
  renamed: Renamed[];
  /** Paired items whose due-time wording changed, independent of their date. */
  retimed: Retimed[];
  added: Item[];
  removed: Item[];
  /** Items in both, unchanged in date, title and due time. */
  same: number;
  /** Grading rows whose weight changed, and rows added or dropped. */
  reweighted: Reweighted[];
  gradingAdded: GradeRow[];
  gradingRemoved: GradeRow[];
  /** Fields on the course itself that differ. */
  fields: { field: string; before: string; after: string }[];
  /** True when nothing at all differs. */
  identical: boolean;
}

export type DateConflictChoice = 'keep_current' | 'use_imported';
export type DateConflictChoices = Readonly<Record<string, DateConflictChoice>>;
export type ReimportConflictChoice = DateConflictChoice;
export type ReimportConflictChoices = DateConflictChoices;

export interface DateConflict {
  id: string;
  kind: 'moved' | 'removed';
  before: Item;
  after?: Item;
}

export interface ReimportConflict {
  id: string;
  kind: 'moved' | 'removed' | 'renamed' | 'retimed' | 'field' | 'reweighted' | 'grading_added' | 'grading_removed';
}

const DAY = 86_400_000;
const COURSE_FIELDS = [
  { field: 'code', label: 'Code' },
  { field: 'name', label: 'Name' },
  { field: 'prof', label: 'Professor' },
  { field: 'email', label: 'Their email' },
  { field: 'meets', label: 'Meets' },
  { field: 'room', label: 'Room' },
  { field: 'credits', label: 'Credits' },
  { field: 'lms', label: 'Course site' },
] as const;

function daysApart(a: Item, b: Item, year: number): number {
  const left = new Date(a.year ?? year, a.month, a.day).getTime();
  const right = new Date(b.year ?? year, b.month, b.day).getTime();
  return Math.round((right - left) / DAY);
}

/**
 * The two item lists, paired greedily on title.
 *
 * Same approach as `reconcile.compare`: best score first, both sides struck
 * out, nothing below the threshold. Greedy rather than optimal because the
 * pairing you can read is the pairing that was made, which is what somebody
 * about to overwrite a course needs.
 */
function pair(before: Item[], after: Item[]): { b: number; a: number }[] {
  const scored: { b: number; a: number; score: number }[] = [];
  before.forEach((x, b) => {
    after.forEach((y, a) => {
      const score = similarity(x.title, y.title);
      if (score >= THRESHOLD) scored.push({ b, a, score });
    });
  });
  scored.sort((p, q) => q.score - p.score);

  const usedB = new Set<number>();
  const usedA = new Set<number>();
  const out: { b: number; a: number }[] = [];
  for (const p of scored) {
    if (usedB.has(p.b) || usedA.has(p.a)) continue;
    usedB.add(p.b);
    usedA.add(p.a);
    out.push({ b: p.b, a: p.a });
  }
  return out;
}

export function diff(before: CourseModule, after: CourseModule, year: number): Diff {
  const pairs = pair(before.items, after.items);
  const pairedB = new Set(pairs.map((p) => p.b));
  const pairedA = new Set(pairs.map((p) => p.a));

  const moved: Moved[] = [];
  const renamed: Renamed[] = [];
  const retimed: Retimed[] = [];
  let same = 0;

  for (const p of pairs) {
    const b = before.items[p.b];
    const a = after.items[p.a];
    const days = daysApart(b, a, year);
    if (days !== 0) moved.push({ before: b, after: a, days });
    if (b.title !== a.title) renamed.push({ before: b, after: a });
    if (b.dueTime !== a.dueTime) retimed.push({ before: b, after: a });
    if (days === 0 && b.title === a.title && b.dueTime === a.dueTime) same++;
  }

  // Grading is matched on the row's own wording, which is how a syllabus
  // identifies a category. A re-worded category reads as one dropped and one
  // added, which is honest — the weights may not correspond.
  const beforeRows = new Map(before.course.grading.map((r) => [r.what, r]));
  const afterRows = new Map(after.course.grading.map((r) => [r.what, r]));
  const reweighted: Reweighted[] = [];
  for (const [what, row] of beforeRows) {
    const now = afterRows.get(what);
    if (now && now.pct !== row.pct) {
      reweighted.push({ what, before: row.pct, after: now.pct });
    }
  }

  const fields = COURSE_FIELDS.map(({ field, label }) => ({
    field: label,
    before: String(before.course[field] ?? ''),
    after: String(after.course[field] ?? ''),
  })).filter((f) => f.before !== f.after);

  const added = after.items.filter((_, i) => !pairedA.has(i));
  const removed = before.items.filter((_, i) => !pairedB.has(i));
  const gradingAdded = after.course.grading.filter((r) => !beforeRows.has(r.what));
  const gradingRemoved = before.course.grading.filter((r) => !afterRows.has(r.what));

  return {
    moved,
    renamed,
    retimed,
    added,
    removed,
    same,
    reweighted,
    gradingAdded,
    gradingRemoved,
    fields,
    identical:
      moved.length === 0 &&
      renamed.length === 0 &&
      retimed.length === 0 &&
      added.length === 0 &&
      removed.length === 0 &&
      reweighted.length === 0 &&
      gradingAdded.length === 0 &&
      gradingRemoved.length === 0 &&
      fields.length === 0,
  };
}

/**
 * The new course, with surviving items keeping their old ids.
 *
 * This is the whole reason a re-import is safe. A tick is filed under an
 * item's id; a freshly generated course invents new ids for everything; so
 * without this, re-importing a syllabus would silently un-tick every deadline
 * you had already done. Cards are keyed by question text and are unaffected.
 */
export function keepIds(before: CourseModule, after: CourseModule): CourseModule {
  const pairs = pair(before.items, after.items);
  const oldId = new Map<number, string>();
  for (const p of pairs) oldId.set(p.a, before.items[p.b].id);

  return {
    ...after,
    // The course id too, or the new copy would sit beside the old one rather
    // than replacing it, and every note filed against the course would orphan.
    course: {
      ...after.course,
      id: before.course.id,
      // These are local controls, not extracted syllabus fields. Re-importing
      // a document must not silently clear the term or the policy the student
      // recorded for AI use.
      term: before.course.term,
      ai: before.course.ai,
    },
    items: after.items.map((item, i) => {
      const kept = oldId.get(i);
      return kept ? { ...item, id: kept, c: before.course.id } : { ...item, c: before.course.id };
    }),
  };
}

/**
 * Consequential date differences that a person must resolve before a
 * re-import can replace their current course copy.
 *
 * New dates are already individually selectable in Import's review list.
 * A moved date or one that disappeared is different: accepting the import
 * would otherwise overwrite or remove an existing reminder. Stable ids keep
 * choices attached to the current row instead of to array order.
 */
export function dateConflicts(d: Diff): DateConflict[] {
  return [
    ...d.removed.map((before) => ({
      id: `removed:${before.id}`,
      kind: 'removed' as const,
      before,
    })),
    ...d.moved.map(({ before, after }) => ({
      id: `moved:${before.id}`,
      kind: 'moved' as const,
      before,
      after,
    })),
  ];
}

export function unresolvedDateConflictIds(d: Diff, choices: DateConflictChoices): string[] {
  return dateConflicts(d).map((conflict) => conflict.id).filter((id) => {
    const choice = choices[id];
    return choice !== 'keep_current' && choice !== 'use_imported';
  });
}

/**
 * Every imported value that would overwrite or remove current course data.
 *
 * New dates remain individually selectable in Import's source review. Course
 * metadata, reworded titles, changed due times and grading rows have no
 * equivalent per-value review, so all of their differences belong here
 * alongside moved and removed dates. IDs use the current item/field/row
 * identity, not array order, so choices survive render changes and can be
 * checked again by the pure merge guard.
 */
export function reimportConflicts(d: Diff): ReimportConflict[] {
  return [
    ...dateConflicts(d),
    ...d.renamed.map(({ before }) => ({ id: `title:${before.id}`, kind: 'renamed' as const })),
    ...d.retimed.map(({ before }) => ({ id: `time:${before.id}`, kind: 'retimed' as const })),
    ...d.fields.map((change) => ({ id: `field:${change.field}`, kind: 'field' as const })),
    ...d.reweighted.map((row) => ({ id: `grading:reweighted:${row.what}`, kind: 'reweighted' as const })),
    ...d.gradingRemoved.map((row) => ({ id: `grading:removed:${row.what}`, kind: 'grading_removed' as const })),
    ...d.gradingAdded.map((row) => ({ id: `grading:added:${row.what}`, kind: 'grading_added' as const })),
  ];
}

export function unresolvedReimportConflictIds(d: Diff, choices: ReimportConflictChoices): string[] {
  return reimportConflicts(d).map((conflict) => conflict.id).filter((id) => {
    const choice = choices[id];
    return choice !== 'keep_current' && choice !== 'use_imported';
  });
}

/**
 * Apply explicit date-conflict choices while preserving the existing course
 * and item ids. The function refuses an incomplete decision map so a future
 * caller cannot accidentally restore the old replace-everything behaviour.
 */
export function applyDateConflictChoices(
  before: CourseModule,
  after: CourseModule,
  year: number,
  choices: DateConflictChoices,
): CourseModule {
  const changes = diff(before, after, year);
  const unresolved = unresolvedDateConflictIds(changes, choices);
  if (unresolved.length > 0) throw new Error('Every moved or removed date must be resolved before re-import.');

  const merged = keepIds(before, after);
  const currentById = new Map(before.items.map((item) => [item.id, item]));
  const movedById = new Map(changes.moved.map((move) => [move.before.id, move]));

  const items = merged.items.map((item) => {
    const move = movedById.get(item.id);
    if (!move || choices[`moved:${item.id}`] !== 'keep_current') return item;
    const current = currentById.get(item.id);
    return current
      ? { ...item, year: current.year, month: current.month, day: current.day }
      : item;
  });

  for (const removed of changes.removed) {
    if (choices[`removed:${removed.id}`] === 'keep_current') {
      items.push({ ...removed, c: before.course.id });
    }
  }

  return { ...merged, items };
}

/**
 * Apply every explicit re-import choice after independently proving that the
 * decision map covers all current differences. No caller can silently accept
 * changed course metadata or grading rows by bypassing the Import screen.
 */
export function applyReimportConflictChoices(
  before: CourseModule,
  after: CourseModule,
  year: number,
  choices: ReimportConflictChoices,
): CourseModule {
  const changes = diff(before, after, year);
  const unresolved = unresolvedReimportConflictIds(changes, choices);
  if (unresolved.length > 0) {
    throw new Error('Every re-import source conflict must be resolved before replacing the course.');
  }

  const merged = applyDateConflictChoices(before, after, year, choices);
  const currentTitles = new Map(changes.renamed.map(({ before }) => [before.id, before.title]));
  const currentTimes = new Map(changes.retimed.map(({ before }) => [before.id, before.dueTime]));
  const items = merged.items.map((item) => {
    const currentTitle = currentTitles.get(item.id);
    const titled = currentTitle !== undefined && choices[`title:${item.id}`] === 'keep_current'
      ? { ...item, title: currentTitle }
      : item;
    const currentTime = currentTimes.get(item.id);
    return currentTime !== undefined && choices[`time:${item.id}`] === 'keep_current'
      ? { ...titled, dueTime: currentTime }
      : titled;
  });
  const course = { ...merged.course };
  for (const change of changes.fields) {
    if (choices[`field:${change.field}`] === 'keep_current') {
      const field = COURSE_FIELDS.find((candidate) => candidate.label === change.field);
      if (field) Object.assign(course, { [field.field]: before.course[field.field] });
    }
  }

  let grading = course.grading.map((row) => ({ ...row }));
  for (const change of changes.reweighted) {
    if (choices[`grading:reweighted:${change.what}`] === 'keep_current') {
      grading = grading.map((row) => row.what === change.what ? { ...row, pct: change.before } : row);
    }
  }
  const rejectedAdded = new Set(
    changes.gradingAdded
      .filter((row) => choices[`grading:added:${row.what}`] === 'keep_current')
      .map((row) => row.what),
  );
  grading = grading.filter((row) => !rejectedAdded.has(row.what));
  for (const row of changes.gradingRemoved) {
    if (choices[`grading:removed:${row.what}`] === 'keep_current') {
      const currentIndex = before.course.grading.findIndex((candidate) => candidate.what === row.what);
      grading.splice(Math.min(currentIndex, grading.length), 0, { ...row });
    }
  }

  return { ...merged, course: { ...course, grading }, items };
}

/** How many ticks survive a re-import, so the screen can promise it. */
export function ticksKept(
  before: CourseModule,
  after: CourseModule,
  done: Record<string, boolean>,
): { kept: number; lost: number } {
  const pairs = pair(before.items, after.items);
  const surviving = new Set(pairs.map((p) => before.items[p.b].id));
  const ticked = before.items.filter((i) => done[i.id]);
  return {
    kept: ticked.filter((i) => surviving.has(i.id)).length,
    lost: ticked.filter((i) => !surviving.has(i.id)).length,
  };
}

/** The diff in one line. Leads with removals, which are what people lose. */
export function summary(d: Diff): string {
  if (d.identical) return 'Nothing has changed.';
  const bits: string[] = [];
  if (d.removed.length) bits.push(`${d.removed.length} gone`);
  if (d.moved.length) bits.push(`${d.moved.length} moved`);
  if (d.added.length) bits.push(`${d.added.length} new`);
  if (d.renamed.length) bits.push(`${d.renamed.length} reworded`);
  if (d.retimed.length) bits.push(`${d.retimed.length} ${d.retimed.length === 1 ? 'time changed' : 'times changed'}`);
  const weights = d.reweighted.length + d.gradingAdded.length + d.gradingRemoved.length;
  if (weights) bits.push(`${weights} to the grading`);
  return `${bits.join(', ')}.`;
}

/** How a move reads. The words are `lib/date.ts`, shared with reconcile. */
export function movedLine(m: Moved): string {
  return movedDays(m.days);
}
