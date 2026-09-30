import { fingerprint, type Base, type Conflict } from './conflicts';
import { idOf } from './merge';

/**
 * A deletion is a difference the merge could not see, and this is how it does.
 *
 * `lib/merge.ts` unions the lists you add to, and a union cannot express a
 * deletion: "the laptop never heard of this note" and "the phone deleted it"
 * look the same, so the note comes back. `lib/resurrect.test.ts` set that out
 * as a known fault, and the published limitation "A course deleted offline can
 * come back" is the same fault for courses, whose only defence — a list of
 * deletions kept in memory — was gone the moment the app closed.
 *
 * The version both sides last agreed (`lib/conflicts.ts`, the *base*) is kept
 * on the device and outlives a restart, and it can tell the two apart:
 *
 * - In the base, missing here, still on the account and **unchanged** there:
 *   this device deleted it. The account's copy is kept out of the merge, so
 *   it stays deleted, and the next push tells the account.
 * - In the base, still here and unchanged, missing on the account: another
 *   device deleted it. It goes here too.
 * - Deleted on one side and **edited** on the other since they agreed: not
 *   settled by a clock. The edit is kept, because keeping cannot lose work
 *   and deleting can, and the student is asked — the same list as two edits
 *   of one note.
 *
 * ## What it will not do
 *
 * - **Only lists where the student deletes on purpose** (`DELETABLE`). Every
 *   one has exactly one removal, an explicit delete. A list the app also
 *   trims by itself would spread its own trimming to every device as though
 *   somebody had chosen it. `deletions.test.ts` reads the reducers to hold
 *   each field to one removal.
 * - **Never a whole list at once.** A removal that would empty almost all of
 *   a list (`bulk`) is not believed: an app that dropped rows on load, a
 *   restore or a migration looks exactly like a person deleting everything,
 *   and being wrong deletes from the account. The rows come back, which is
 *   what happened before this existed and is visible, instead.
 * - **Nothing without a base.** A device that has never agreed with the
 *   account has no way to tell a deletion from a record it never had.
 */

/** Lists with exactly one removal, an explicit delete. Courses included. */
export const DELETABLE = ['courses', 'notes', 'tasks', 'appointments', 'documents', 'sheets', 'decks'] as const;
export type Deletable = (typeof DELETABLE)[number];

/** A removal of at least this many, and this share of what was agreed, is not a deletion anybody chose. */
export const BULK_COUNT = 5;
export const BULK_SHARE = 0.8;

export const bulk = (removed: number, agreed: number): boolean =>
  removed >= BULK_COUNT && agreed > 0 && removed / agreed >= BULK_SHARE;

const key = (field: string, id: string) => `${field}/${id}`;

function idsInBase(base: Base, field: string): string[] {
  const prefix = `${field}/`;
  return Object.keys(base)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}

function byId(rows: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const id = idOf(row);
    if (id !== null) out.set(id, row);
  }
  return out;
}

export interface Settled {
  /** The account's copy with what this device deleted taken out, so the merge cannot bring it back. */
  remote: Record<string, unknown>;
  /** What another device deleted and this one still holds unchanged, by field. */
  dropHere: Record<string, string[]>;
  /** Deleted on one side and edited on the other. The edit is the copy in use. */
  conflicts: Conflict[];
  /** Fields whose removal was too large to believe, and so was not applied. */
  heldBack: string[];
}

export function settleDeletions(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  base: Base | null,
  now = Date.now(),
): Settled {
  const out: Settled = { remote, dropHere: {}, conflicts: [], heldBack: [] };
  if (!base) return out;
  let trimmed = remote;

  for (const field of DELETABLE) {
    // A copy that does not carry the list says nothing about it.
    if (!Array.isArray(remote[field]) || !Array.isArray(local[field])) continue;
    const mine = byId(local[field]);
    const theirs = byId(remote[field]);
    const agreedIds = idsInBase(base, field);

    const hereGone = agreedIds.filter((id) => !mine.has(id) && theirs.has(id));
    const thereGone = agreedIds.filter((id) => mine.has(id) && !theirs.has(id));
    if (bulk(hereGone.length, agreedIds.length) || bulk(thereGone.length, agreedIds.length)) {
      out.heldBack.push(field);
      continue;
    }

    const removeFromRemote = new Set<string>();
    for (const id of hereGone) {
      const row = theirs.get(id);
      if (fingerprint(row) === base[key(field, id)]) {
        removeFromRemote.add(id);
      } else {
        // The account's copy was edited after this device deleted its own.
        out.conflicts.push({ key: key(field, id), field, id, mine: null, theirs: row, kept: 'theirs', found: now });
      }
    }
    for (const id of thereGone) {
      const row = mine.get(id);
      if (fingerprint(row) === base[key(field, id)]) {
        (out.dropHere[field] ??= []).push(id);
      } else {
        out.conflicts.push({ key: key(field, id), field, id, mine: row, theirs: null, kept: 'mine', found: now });
      }
    }

    if (removeFromRemote.size > 0) {
      trimmed = { ...trimmed, [field]: (remote[field] as unknown[]).filter((r) => !removeFromRemote.has(idOf(r) ?? '')) };
    }
  }
  out.remote = trimmed;
  return out;
}

/**
 * The courses this device deleted, read from the base rather than from
 * memory, so a deletion made offline is still one after the app is closed.
 * The account deletes exactly these and nothing else.
 */
export function coursesDeletedHere(base: Base | null, courses: readonly unknown[]): string[] {
  if (!base) return [];
  const held = new Set(courses.map((c) => idOf(c)).filter((id): id is string => id !== null));
  const agreed = idsInBase(base, 'courses');
  const gone = agreed.filter((id) => !held.has(id));
  return bulk(gone.length, agreed.length) ? [] : gone;
}
