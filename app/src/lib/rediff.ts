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

export interface Reweighted {
  what: string;
  before: string;
  after: string;
}

export interface Diff {
  moved: Moved[];
  renamed: Renamed[];
  added: Item[];
  removed: Item[];
  /** Items in both, unchanged in date and title. */
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

const DAY = 86_400_000;

function daysApart(a: Item, b: Item, year: number): number {
  const left = new Date(year, a.month, a.day).getTime();
  const right = new Date(year, b.month, b.day).getTime();
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
  let same = 0;

  for (const p of pairs) {
    const b = before.items[p.b];
    const a = after.items[p.a];
    const days = daysApart(b, a, year);
    if (days !== 0) moved.push({ before: b, after: a, days });
    else if (b.title !== a.title) renamed.push({ before: b, after: a });
    else same++;
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

  const FIELDS: { field: keyof CourseModule['course']; label: string }[] = [
    { field: 'code', label: 'Code' },
    { field: 'name', label: 'Name' },
    { field: 'prof', label: 'Professor' },
    { field: 'email', label: 'Their email' },
    { field: 'meets', label: 'Meets' },
    { field: 'room', label: 'Room' },
    { field: 'credits', label: 'Credits' },
  ];
  const fields = FIELDS.map(({ field, label }) => ({
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
    course: { ...after.course, id: before.course.id },
    items: after.items.map((item, i) => {
      const kept = oldId.get(i);
      return kept ? { ...item, id: kept, c: before.course.id } : { ...item, c: before.course.id };
    }),
  };
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
  const weights = d.reweighted.length + d.gradingAdded.length + d.gradingRemoved.length;
  if (weights) bits.push(`${weights} to the grading`);
  return `${bits.join(', ')}.`;
}

/** How a move reads. */
export function movedLine(m: Moved): string {
  const size = Math.abs(m.days);
  const unit = size === 1 ? 'day' : 'days';
  return m.days > 0 ? `${size} ${unit} later` : `${size} ${unit} earlier`;
}
