/**
 * Storage is not a trusted input, and neither is what is inside it.
 *
 * `state/shape.ts` already says the first half, over the `list()` that fixed
 * the layer above this one:
 *
 * > Storage is not a trusted input. It holds whatever an older build wrote, a
 * > half-finished sync left behind, a quota error truncated, or somebody typed
 * > into devtools.
 *
 * That guard checks a saved list *is* a list. It says nothing about what is in
 * it, and `list<T>(value)` casts the contents to `T` without looking. Driven
 * against the running app with one row carrying nothing but its id, one list
 * at a time, across twenty routes, two of twenty-eight took the whole
 * document down — not one screen's error boundary, but an uncaught TypeError
 * and an empty `#root`, with clearing site data the only way back in:
 *
 *     courses   #/home     Cannot read properties of undefined (reading 'map')
 *     windows   #/behind   Cannot read properties of undefined (reading 'includes')
 *
 * `courses` is the one that matters most, and it is the one `lib/handoff.ts`
 * was already written about — "a pack without `grading` reached the course
 * screen, which maps over it, and the page went white". That file's whole
 * argument is that a course from somewhere the app does not control has to be
 * rebuilt before anything maps over it. A course read out of storage is the
 * same untrusted input. It is also the worst one to get wrong, because the
 * catalogue is built from it before any screen is drawn, so there is no
 * boundary in the way.
 *
 * ## Coercion, not rejection
 *
 * A row is somebody's data. `lib/live.ts` says it about a neighbouring case:
 * "Losing somebody's own material quietly is worse than any of the shapes this
 * file refuses." So a damaged row keeps every field that survives reading and
 * takes a usable default for the rest. Only a row that cannot be addressed at
 * all is dropped — a course with no id, a window with no id — because there is
 * nothing to show and nothing to edit.
 *
 * ## Spread first, then guarantee
 *
 * The opposite of `justTheCourse` in `lib/handoff.ts`, and on purpose: that one
 * narrows because it decides what *leaves* the device. Nothing leaves here, and
 * `lib/migrate.ts` says of a copy from a newer build that "the app reads what it
 * recognises and ignores the rest" — which is not the same as deleting it on the
 * next save. A field this build has never heard of rides through untouched.
 */

import type { CourseModule, Course } from './types';
import type { Window } from './windows';

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** An array, or an empty one — the check `list()` makes, reusable per field. */
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** A finite number, or the fallback. NaN is not a number for this purpose. */
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * One stored course module, safe for the catalogue to walk.
 *
 * `buildCatalog` maps over `items`, splits `course.code`, and indexes by
 * `course.id`; `blocksFor` reads `schedule`; the grades screens map over
 * `course.grading`. Each of those is guaranteed here, and every other field is
 * left exactly as it was found.
 *
 * Returns `null` for a row with no course id: there is no way to address it,
 * no way to open it, and indexing by `undefined` would make two damaged
 * courses overwrite each other.
 */
export function readModule(value: unknown): CourseModule | null {
  const row = obj(value);
  const course = obj(row.course);
  const id = str(course.id);
  if (!id) return null;

  return {
    ...row,
    course: {
      ...course,
      id,
      // Split on the Courses screen and in the filter chips. An empty string
      // splits to [''] rather than throwing, which draws a course with no
      // code — visible, and editable, which a crash is not.
      code: str(course.code),
      name: str(course.name),
      prof: str(course.prof),
      email: str(course.email),
      meets: str(course.meets),
      room: str(course.room),
      credits: str(course.credits),
      source: str(course.source),
      grading: arr(course.grading),
    } as Course,
    items: arr(row.items),
    schedule: arr(row.schedule),
    guide: readGuide(row.guide),
    planMinutes: str(row.planMinutes),
    frameLabel: str(row.frameLabel),
  } as CourseModule;
}

/**
 * A guide with a units list, whatever was stored.
 *
 * Kept separate because `lib/generate.ts` already carries a comment about this
 * exact mistake being fixed for `items` and `grading` — the guide was the one
 * left. Its gate missed a string, because a string has a `length`.
 */
function readGuide(value: unknown): CourseModule['guide'] {
  const guide = obj(value);
  return { ...guide, units: arr(guide.units) } as CourseModule['guide'];
}

/**
 * One stored study window.
 *
 * `hoursOn` filters on `w.days.includes(day)`, and every hour figure in the
 * week ahead comes off that. A window with no `days` is not a window anybody
 * set, so it gets an empty one: it contributes no hours rather than taking
 * the screen down.
 */
export function readWindow(value: unknown): Window | null {
  const row = obj(value);
  const id = str(row.id);
  if (!id) return null;
  return {
    ...row,
    id,
    label: str(row.label),
    days: arr<unknown>(row.days).filter((d): d is number => typeof d === 'number'),
    from: num(row.from, 0),
    to: num(row.to, 0),
  } as Window;
}

/** Read a stored list through one of the readers above, dropping what it drops. */
export function readList<T>(value: unknown, read: (row: unknown) => T | null): T[] {
  return arr<unknown>(value)
    .map(read)
    .filter((row): row is T => row !== null);
}

/**
 * Every door into the state, through one reader.
 *
 * There were three, and only one of them had a guard on it:
 *
 * - **the boot read** — `state/shape.ts` for the localStorage path and
 *   `state/persist/` for the database one, which bypasses `loadPersisted`
 *   entirely because the value is primed before the reducer ever runs;
 * - **`restore`** — a backup file somebody opened. `readBackup` checks each
 *   section is an array or an object, and its own error says why ("restoring
 *   it could put nonsense into your account"), and it could go no further
 *   without duplicating every field rule;
 * - **`hydrate`** — the sync path, arriving from whichever build the other
 *   device was running. Worse than either of the others, because nobody has
 *   to open anything: it opens itself.
 *
 * Only the keys actually carried are returned, so a partial stays partial —
 * `restore` replaces exactly what the copy held, and a copy taken before a
 * field existed must not empty it.
 */
export function readIncoming<T extends Record<string, unknown>>(blob: T): T {
  const out = { ...blob };
  if ('courses' in out) {
    (out as Record<string, unknown>).courses = readList(out.courses, readModule);
  }
  if ('windows' in out) {
    (out as Record<string, unknown>).windows = readList(out.windows, readWindow);
  }
  return out;
}
