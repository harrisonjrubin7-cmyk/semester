/**
 * The drive's folders.
 *
 * Files live in IndexedDB because they are big; folders live in the store with
 * the rest of the account because they are not. That is the same split
 * `lib/files.ts` opens with — *"notes and tasks are small and live in
 * localStorage with the rest of the app's state; files are not"* — and putting
 * folders on the small side means they are backed up, merged, migrated and
 * synced by machinery that already exists, rather than by a second copy of it
 * written against IndexedDB.
 *
 * A folder is a name and a parent. Nothing else: no colour, no icon, no
 * ordering. What makes a drive usable is knowing where a thing is, and every
 * field beyond those two is a field somebody has to maintain.
 *
 * ## The course folders make themselves
 *
 * Every course the app holds gets a folder named after its code, and it is not
 * a folder somebody had to create and cannot be one they have to keep in step.
 * `withCourses` derives them from the catalogue on every read, so a course
 * added on Monday has its folder on Monday and a course removed does not leave
 * an empty one behind. They can be filed into but not renamed or deleted,
 * because the name is the course's and deleting one would only mean it came
 * back on the next render.
 */

import type { Course } from './types';

export interface Folder {
  id: string;
  name: string;
  /** The folder above, or null at the top of the drive. */
  parentId: string | null;
  created: number;
}

/** A folder plus what the drive needs to draw it. */
export interface Shown extends Folder {
  /**
   * True for the folders derived from courses. They take files like any other
   * and refuse to be renamed or deleted, because neither would survive a
   * reload — the catalogue would put them straight back.
   */
  fromCourse: boolean;
  /** The course a derived folder stands for, so a file dropped in can be tagged. */
  courseId: string | null;
}

/**
 * The id a course's folder has.
 *
 * Derived from the course id rather than minted, so it is the same string on
 * every device and after every reload — which is what lets a file remember it
 * is in ECON's folder without the folder being written down anywhere.
 */
export function courseFolderId(courseId: string): string {
  return `course:${courseId}`;
}

export function isCourseFolder(id: string | null): boolean {
  return typeof id === 'string' && id.startsWith('course:');
}

/** Every folder the drive shows: the course ones, then the student's own. */
export function withCourses(folders: Folder[], courses: Course[]): Shown[] {
  // Courses can repeat across terms in the list this is given; the folder id
  // is derived from the course id, so two of them would be one folder drawn
  // twice.
  const seen = new Set<string>();
  const made: Shown[] = courses
    .filter((course) => !seen.has(course.id) && seen.add(course.id))
    .map((course) => ({
    id: courseFolderId(course.id),
    name: course.code,
    parentId: null,
    created: 0,
    fromCourse: true,
    courseId: course.id,
  }));
  const mine: Shown[] = folders.map((f) => ({ ...f, fromCourse: false, courseId: null }));
  return [...made, ...mine];
}

/**
 * Whether a folder id names a folder that is actually there.
 *
 * The question matters because a file's folder can disappear underneath it in
 * four different ways, and every one of them used to take the file out of
 * sight: the course it belonged to was removed, or is in another term, or the
 * folder was a descendant of one that was deleted, or the folder list hit its
 * cap. The file is still stored, still in the backup, and reachable from
 * nowhere — which is worse than deleting it, because nothing said so.
 */
export function exists(all: Shown[], id: string | null): boolean {
  return id === null || all.some((f) => f.id === id);
}

/**
 * Where a file should be shown, given the folders that exist.
 *
 * A file whose folder is gone comes home to the top of the drive rather than
 * vanishing. One rule, at the point of display, instead of four separate
 * repairs at four points of deletion — and it is the rule that still holds if
 * a fifth way turns up.
 */
export function homeOf(all: Shown[], folderId: string | null): string | null {
  return exists(all, folderId) ? folderId : null;
}

/** The folders directly inside `parentId`, course folders first and then by name. */
export function childrenOf(all: Shown[], parentId: string | null): Shown[] {
  return all
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => {
      if (a.fromCourse !== b.fromCourse) return a.fromCourse ? -1 : 1;
      // `String()` because a folder read back from storage is only as
      // well-formed as what was written, and a name that is not a string
      // would otherwise take the whole drive down inside a sort.
      return String(a.name).localeCompare(String(b.name));
    });
}

/** The path from the top down to a folder, for the row of crumbs above the list. */
export function trail(all: Shown[], id: string | null): Shown[] {
  const out: Shown[] = [];
  const seen = new Set<string>();
  let at = id;
  while (at) {
    // A parent chain that loops would hang the render. It cannot happen through
    // `canMove`, which is exactly why that function exists — this is the guard
    // for a saved account that somehow has one anyway.
    if (seen.has(at)) break;
    seen.add(at);
    const folder = all.find((f) => f.id === at);
    if (!folder) break;
    out.unshift(folder);
    at = folder.parentId;
  }
  return out;
}

/** Every folder at or below `id`, itself included. */
export function subtree(all: Shown[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Whether a folder may be dropped into another.
 *
 * Into itself is a folder that has left the drive; into its own descendant is
 * a ring of folders none of which is reachable from the top, taking every file
 * in them out of sight with no way back. Both are one drag away in any drive
 * that allows dragging, so both are refused here rather than repaired later.
 */
export function canMove(all: Shown[], id: string, into: string | null): boolean {
  if (id === into) return false;
  if (isCourseFolder(id)) return false;
  if (into === null) return true;
  return !subtree(all, id).has(into);
}

/** A name that is not already taken beside it, so two siblings never read the same. */
export function freeName(all: Shown[], parentId: string | null, wanted: string): string {
  const taken = new Set(
    all.filter((f) => f.parentId === parentId).map((f) => f.name.trim().toLowerCase()),
  );
  const base = wanted.trim() || 'New folder';
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n += 1) {
    const tried = `${base} ${n}`;
    if (!taken.has(tried.toLowerCase())) return tried;
  }
  return `${base} ${Date.now()}`;
}
