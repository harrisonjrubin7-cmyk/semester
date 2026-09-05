/**
 * Which of the store's eighty-six fields goes where.
 *
 * The whole account has been one localStorage key, `semester.v1`, written as a
 * single `JSON.stringify` on every dispatch. That has three costs and the
 * first one is the serious one:
 *
 *  1. **The app deletes your work as normal operation.** localStorage caps
 *     around 5MB, this store passes it, and `lib/keep.ts` exists to shed
 *     practice papers and blank the bodies of old notes so the next write
 *     fits. It says so afterwards, which is the honest thing to do about a
 *     thing that should not be happening.
 *  2. Every write is synchronous, so it blocks the main thread, and the cost
 *     grows with the size of the store rather than the size of the edit.
 *  3. One opaque blob cannot be queried, so anything server-side — push
 *     scheduling, a digest — needs a shadow table of its own.
 *
 * IndexedDB fixes all three, and the constraint that makes the change safe is
 * that **only the storage layer moves**. The state object the app holds in
 * memory is identical before and after, the reducer is untouched, and no
 * screen knows this happened.
 *
 * ## How a field is classified, and why not by hand
 *
 * By its merge strategy, which `lib/merge.ts` already declares for every
 * field, because that map has spent a year describing exactly this: whether a
 * field is a list of records, a bag of flags, or a single value.
 *
 *   `union`  → a list of records → an object store of its own
 *   `ticks`  → a bag of flags    → one row in `maps`
 *   anything else                → one row in `settings`
 *
 * A hand-written list would be a second source of truth that goes stale the
 * first time somebody adds a field and updates only one of them. This cannot:
 * a field with no merge strategy lands in `settings`, which is the safe
 * default, and `shape.test.ts` fails if any field is unclassified.
 *
 * One exception, and it is the only one: `archivedTerms` merges as a union but
 * holds strings rather than records. There is nothing to key it by, so it is a
 * setting.
 */

import { STRATEGY } from '../../lib/merge';
import { DEFAULT_PERSISTED, type Persisted } from '../shape';

export type Kind = 'collection' | 'map' | 'setting';

/**
 * A union of things that are not records.
 *
 * `archivedTerms` is `string[]`. Splitting it into rows would mean inventing a
 * key for each, and a term id is already the value — there is no gain and a
 * migration to get wrong.
 */
const NOT_RECORDS = new Set<string>(['archivedTerms']);

export function kindOf(key: string): Kind {
  const how = (STRATEGY as Record<string, string | undefined>)[key];
  if (how === 'union' && !NOT_RECORDS.has(key)) return 'collection';
  if (how === 'ticks') return 'map';
  return 'setting';
}

/** Every field the app persists, from the defaults rather than from a list. */
export const PERSISTED_KEYS = Object.keys(DEFAULT_PERSISTED) as (keyof Persisted)[];

export const COLLECTIONS = PERSISTED_KEYS.filter((k) => kindOf(k) === 'collection');
export const MAPS = PERSISTED_KEYS.filter((k) => kindOf(k) === 'map');
export const SETTINGS = PERSISTED_KEYS.filter((k) => kindOf(k) === 'setting');

/**
 * The key one record is stored under.
 *
 * Almost every record carries `id`. A course carries `course.id` instead,
 * because a course module wraps the course. Anything with neither falls back
 * to its position, which is no worse than the whole-blob write it replaces —
 * that had no per-record identity at all — and `shape.test.ts` reports which
 * collections rely on it so the fallback stays visible rather than becoming a
 * quiet default.
 */
export function idOf(record: unknown, index: number): string {
  if (record && typeof record === 'object') {
    const r = record as { id?: unknown; course?: { id?: unknown } };
    if (typeof r.id === 'string' && r.id) return r.id;
    if (typeof r.id === 'number') return String(r.id);
    if (r.course && typeof r.course.id === 'string' && r.course.id) return r.course.id;
  }
  return `#${index}`;
}

/** Whether a collection can be keyed properly, or is falling back to position. */
export function keyed(records: unknown[]): boolean {
  return records.every((r, i) => !idOf(r, i).startsWith('#'));
}
