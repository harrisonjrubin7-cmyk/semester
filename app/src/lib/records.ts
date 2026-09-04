/**
 * Merging records one at a time, with deletions that survive the trip.
 *
 * `lib/merge.ts` merges the state blob field by field, and for lists its
 * strategy is `union` — both devices' notes survive. That is right, and it has
 * one consequence nobody chose: a union cannot express a deletion. Nothing in
 * the data distinguishes "the laptop never had this note" from "the phone
 * deleted it", so the merge keeps it, and a note deleted on a phone comes back
 * from a laptop every time. `resurrect.test.ts` demonstrates that against the
 * code as it stands.
 *
 * The fix is not a cleverer merge. It is a record that can say it was deleted.
 *
 * ## Per record, and the server holds the clock
 *
 * Each row carries `updatedAt` set by the database — never by the device.
 * Last-write-wins is only trustworthy when the clock is not the device's: a
 * phone set five minutes fast would otherwise win every conflict, forever,
 * until somebody noticed their laptop's edits never survived.
 *
 * ## A tombstone beats a live row of the same age
 *
 * When a deletion and an edit land at the same instant — which happens more
 * often than it sounds, because two devices syncing on the same second is a
 * normal Tuesday — the deletion wins. The reasoning is asymmetric on purpose:
 * a wrongly-kept row is a note that reappears and can be deleted again, and a
 * wrongly-deleted row is gone. One of those is an annoyance and the other is a
 * loss.
 *
 * ## Nothing here talks to the network
 *
 * This is the decision, not the transport. `cloud.ts` will hand it two lists
 * and store what comes back, which is what makes the rule above testable
 * without a database.
 */

/** One record as it travels: the app's own shape, plus what sync needs. */
export interface Row<T> {
  id: string;
  data: T;
  /** Set by the database. A device that sets this is ignored — see above. */
  updatedAt: number;
  /** When it was deleted, or 0 for a live row. */
  deletedAt: number;
}

export function live<T>(rows: Row<T>[]): Row<T>[] {
  return rows.filter((r) => r.deletedAt === 0);
}

/** The records themselves, for a caller that wants what the app renders. */
export function contents<T>(rows: Row<T>[]): T[] {
  return live(rows).map((r) => r.data);
}

/**
 * Which of two versions of one record wins.
 *
 * Newer wins; a tie goes to the tombstone. Where neither is a tombstone a tie
 * keeps `mine`, because a device should not see its own screen change for a
 * write that is not newer than what it already had.
 */
export function pick<T>(mine: Row<T>, theirs: Row<T>): Row<T> {
  if (theirs.updatedAt > mine.updatedAt) return theirs;
  if (mine.updatedAt > theirs.updatedAt) return mine;
  if (theirs.deletedAt > 0 && mine.deletedAt === 0) return theirs;
  return mine;
}

/**
 * Two devices' rows, reconciled.
 *
 * Anything only one side has is kept as it is — that is the union behaviour
 * that was always right. Anything both sides have goes through `pick`.
 */
export function mergeRows<T>(mine: Row<T>[], theirs: Row<T>[]): Row<T>[] {
  const byId = new Map<string, Row<T>>();
  for (const r of mine) byId.set(r.id, r);
  for (const r of theirs) {
    const here = byId.get(r.id);
    byId.set(r.id, here ? pick(here, r) : r);
  }
  return [...byId.values()];
}

/**
 * Mark a record deleted rather than removing it.
 *
 * `at` is a local guess that the database will overwrite on the next push.
 * Keeping it local means the row disappears from the screen immediately rather
 * than after a round trip, which is the difference between an app that feels
 * broken offline and one that does not.
 */
export function bury<T>(rows: Row<T>[], id: string, at: number): Row<T>[] {
  return rows.map((r) => (r.id === id ? { ...r, deletedAt: at, updatedAt: at } : r));
}

/** What needs sending: everything this device changed since the last push. */
export function unsent<T>(rows: Row<T>[], since: number): Row<T>[] {
  return rows.filter((r) => r.updatedAt > since);
}

/** The high-water mark to ask from next time. */
export function watermark<T>(rows: Row<T>[]): number {
  return rows.reduce((n, r) => Math.max(n, r.updatedAt), 0);
}

/**
 * Turning the blob's plain list into rows, once.
 *
 * The first time a device runs a build that syncs per record, its notes are a
 * plain array with no timestamps. They are all treated as written `at` — not
 * as ancient — so the first push sends them rather than letting the account's
 * copy silently win over work that was never uploaded.
 */
export function adopt<T extends { id: string }>(items: T[], at: number): Row<T>[] {
  return items.map((data) => ({ id: data.id, data, updatedAt: at, deletedAt: 0 }));
}

export interface Summary {
  added: number;
  updated: number;
  deleted: number;
}

/** What a merge did, for the line the app shows after a refresh. */
export function summarise<T>(before: Row<T>[], after: Row<T>[]): Summary {
  const was = new Map(before.map((r) => [r.id, r]));
  let added = 0;
  let updated = 0;
  let deleted = 0;
  for (const r of after) {
    const old = was.get(r.id);
    if (!old) {
      if (r.deletedAt === 0) added += 1;
      continue;
    }
    if (r.deletedAt > 0 && old.deletedAt === 0) deleted += 1;
    else if (r.updatedAt > old.updatedAt) updated += 1;
  }
  return { added, updated, deleted };
}

/** That summary, in words, or empty when nothing moved. */
export function summaryLine(s: Summary, what: string): string {
  const bits: string[] = [];
  if (s.added > 0) bits.push(`${s.added} new`);
  if (s.updated > 0) bits.push(`${s.updated} updated`);
  if (s.deleted > 0) bits.push(`${s.deleted} deleted elsewhere`);
  if (bits.length === 0) return '';
  return `${what}: ${bits.join(', ')}.`;
}
