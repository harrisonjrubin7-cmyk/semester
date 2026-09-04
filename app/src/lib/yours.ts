/**
 * A course, as the student thinks of it.
 *
 * The app calls a course whatever its syllabus called it — "Principles of
 * Microeconomics", "Understanding Political Controversy" — and shows the four
 * of them in whatever order they were imported. Nobody thinks in those terms.
 * They think "Econ", "the 8am one", "the hard one", and the course they have
 * a paper due in on Thursday belongs at the top of the list this week whatever
 * order the PDFs were opened in.
 *
 * ## A side table, not an edit
 *
 * None of this touches the course itself. It is a separate record keyed by
 * course id, for three reasons:
 *
 *   1. The four sample courses are compiled in and cannot be edited at all.
 *      Personalisation that lived on the course would work for imported
 *      courses and silently do nothing for those.
 *   2. Re-importing a syllabus rewrites the course. A nickname stored on it
 *      would be lost every time a professor posted a corrected PDF — which is
 *      exactly when somebody is most likely to be looking at the app.
 *   3. It keeps the record of what the syllabus actually says intact. The
 *      student's name for a course sits beside the real one rather than over
 *      it, so Edit the course still shows what was imported.
 *
 * ## The code is not renameable, and that is deliberate
 *
 * The name can be anything. The code — ECON 1020 — stays. It is the registrar's
 * identifier: it is what a re-imported syllabus is matched on, what a shared
 * practice paper carries, and what a classmate would recognise. A student who
 * renamed ECON 1020 to "Econ" would find their next import arriving as a
 * second course rather than an update to this one.
 */

import { ACCENTS, type Accent } from './look';

/** What the student has said about one course. */
export interface Yours {
  /** Their name for it. Absent means the syllabus name stands. */
  name?: string;
  /** An accent id from `lib/look.ts`, or absent for no colour. */
  tint?: string;
  /** Sorts above the rest. */
  pinned?: boolean;
}

export type YoursBy = Record<string, Yours>;

const NONE: Yours = {};

/** A name long enough to be a name and short enough to sit in a list. */
export const LONGEST_NAME = 40;

export function yoursOf(all: YoursBy | undefined, id: string): Yours {
  return all?.[id] ?? NONE;
}

/**
 * What to call a course.
 *
 * The student's name if they gave one, and the syllabus name otherwise. Never
 * empty: a course with no name at all in either place falls back to its code,
 * because a blank row in a list is a bug the student cannot diagnose.
 */
export function nameFor(course: { id: string; code: string; name: string }, all?: YoursBy): string {
  return yoursOf(all, course.id).name || course.name || course.code;
}

/** Whether the name shown is the student's own rather than the syllabus's. */
export function renamed(course: { id: string; name: string }, all?: YoursBy): boolean {
  const mine = yoursOf(all, course.id).name;
  return Boolean(mine && mine !== course.name);
}

/** The colour for a course, or null where none was chosen. */
export function tintFor(all: YoursBy | undefined, id: string): Accent | null {
  const want = yoursOf(all, id).tint;
  return ACCENTS.find((a) => a.id === want) ?? null;
}

/**
 * Store one change, dropping the record when nothing is left in it.
 *
 * An entry that is `{}` would sync forever and mean nothing. This is also why
 * clearing a field passes `undefined` rather than an empty string — a stored
 * `name: ''` reads as "the student named it nothing", which is not a thing
 * anybody meant.
 */
function put(all: YoursBy, id: string, patch: Yours): YoursBy {
  const merged: Yours = { ...yoursOf(all, id), ...patch };
  for (const key of Object.keys(merged) as (keyof Yours)[]) {
    const value = merged[key];
    if (value === undefined || value === '' || value === false) delete merged[key];
  }
  const out = { ...all };
  if (Object.keys(merged).length === 0) delete out[id];
  else out[id] = merged;
  return out;
}

/**
 * Rename a course, or clear the name.
 *
 * A name that matches the syllabus is not stored: it would be an override
 * that overrides nothing, and it would then stop tracking the real name if a
 * corrected syllabus changed it.
 */
export function rename(
  all: YoursBy,
  course: { id: string; name: string },
  to: string,
): YoursBy {
  const want = to.trim().slice(0, LONGEST_NAME);
  return put(all, course.id, { name: want && want !== course.name ? want : undefined });
}

/** Colour a course, or clear it. An unknown accent id clears rather than sticks. */
export function tintTo(all: YoursBy, id: string, tint: string): YoursBy {
  const known = ACCENTS.some((a) => a.id === tint);
  return put(all, id, { tint: known ? tint : undefined });
}

export function togglePin(all: YoursBy, id: string): YoursBy {
  return put(all, id, { pinned: !yoursOf(all, id).pinned });
}

/**
 * The courses, in the order they should be shown.
 *
 * Pinned first, then whatever the student arranged, then anything they have
 * not touched in the order it arrived. Every course comes back exactly once —
 * a sort that could drop a course is a sort that loses a class.
 *
 * The catalogue is built from this, so ordering here reaches every screen at
 * once rather than being reapplied in each of them.
 */
export function arrange<T extends { course: { id: string } }>(
  modules: T[],
  all: YoursBy | undefined,
  order: string[] | undefined,
): T[] {
  const place = new Map((order ?? []).map((id, i) => [id, i]));
  const arrived = new Map(modules.map((m, i) => [m.course.id, i]));

  return [...modules].sort((a, b) => {
    const ap = yoursOf(all, a.course.id).pinned ? 0 : 1;
    const bp = yoursOf(all, b.course.id).pinned ? 0 : 1;
    if (ap !== bp) return ap - bp;

    // Arranged courses lead, in their arranged order; untouched ones follow
    // in import order. `Infinity` is what puts the second group after the
    // first without a second pass.
    const ao = place.get(a.course.id) ?? Infinity;
    const bo = place.get(b.course.id) ?? Infinity;
    if (ao !== bo) return ao - bo;

    return (arrived.get(a.course.id) ?? 0) - (arrived.get(b.course.id) ?? 0);
  });
}

/**
 * Move a course one place along.
 *
 * Takes the ids as they are currently *shown* rather than the stored order,
 * so the arrow next to a course moves it past the course drawn above it —
 * which is what pressing it looks like it should do. The result is a complete
 * order, so the first move also fixes everything that was implicit.
 */
export function reorder(shown: string[], id: string, by: -1 | 1): string[] {
  const at = shown.indexOf(id);
  const to = at + by;
  if (at === -1 || to < 0 || to >= shown.length) return shown;
  const out = [...shown];
  out.splice(at, 1);
  out.splice(to, 0, id);
  return out;
}

/** A one-line summary of what has been changed, for the settings row. */
export function yoursNote(all: YoursBy | undefined, id: string, syllabusName: string): string {
  const mine = yoursOf(all, id);
  const bits: string[] = [];
  if (mine.name && mine.name !== syllabusName) bits.push(`called “${mine.name}”`);
  const tint = tintFor(all, id);
  if (tint) bits.push(tint.label.toLowerCase());
  if (mine.pinned) bits.push('pinned');
  return bits.join(' · ');
}
