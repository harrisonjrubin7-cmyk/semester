/**
 * How much work is filed against each deadline, cheaply enough to ask on
 * every row.
 *
 * `lib/forwork.ts` answers the question; this is what makes asking it forty
 * times in one render affordable, and what lets a marker on a deadline row
 * include files — which live in IndexedDB rather than in the store and so are
 * not there on the first paint.
 *
 * Two problems, one each:
 *
 * ## The files are not in the store
 *
 * So they are read once into a module-level list, shared by every caller, and
 * re-read when `lib/files.ts` says a file changed. Before that list has
 * arrived the counts are the store's five kinds only — a marker that appears a
 * frame late is right; one that never appears is a feature nobody finds.
 *
 * A hook per row, all reading one list, rather than a list per screen: three
 * screens each holding their own copy is three screens showing yesterday's
 * count after somebody used one of the other two, which is exactly the bug the
 * notification in `files.ts` exists to stop.
 *
 * ## Counting is a walk over everything
 *
 * `countsByItem` walks every document, sheet, deck, note, equation and file in
 * the account. Called from a row it would do that once per row — on a heavy
 * Tuesday, forty times over the same lists. So the answer is memoised on the
 * *identity* of the six lists, which is exactly what the store's immutability
 * already gives: nothing is copied unless it changed, so the second row
 * through gets the first row's answer, and the walk happens once per change
 * rather than once per row.
 *
 * A single entry, not a map: every caller in one render passes the same six
 * lists, and a cache of one is what makes that free. Two callers with
 * genuinely different holdings would thrash it, and there are none — the store
 * is one.
 */

import { useSyncExternalStore } from 'react';
import { listFiles, onFilesChanged, type Settled } from './files';
import { countsByItem, type Holdings } from './forwork';

/** Shared so an empty answer is the same object every time, as React wants. */
const NO_FILES: Settled[] = [];
const NO_COUNTS: Record<string, number> = {};

let files: Settled[] = NO_FILES;
let reading = false;
let read = false;
const watchers = new Set<() => void>();

function tell() {
  for (const w of [...watchers]) w();
}

/**
 * Read the list, once, and again whenever it changes.
 *
 * Failing soft is `lib/files.ts`'s own rule — `listFiles` answers with an
 * empty list in a private window rather than throwing — so a browser with
 * storage blocked simply has no file rows, and everything else still counts.
 */
function load() {
  if (reading) return;
  reading = true;
  void listFiles()
    .then((next) => {
      files = next;
      read = true;
    })
    .finally(() => {
      reading = false;
      tell();
    });
}

/** Wired once, at the first subscription, and never taken down. */
let wired = false;

function subscribe(fn: () => void): () => void {
  watchers.add(fn);
  if (!wired) {
    wired = true;
    /*
     * A write to any file re-reads the list. `onFilesChanged` fires after the
     * transaction has committed, so the read that follows it sees the write —
     * this is the ordering the whole notification exists for.
     */
    onFilesChanged(load);
  }
  if (!read) load();
  return () => {
    watchers.delete(fn);
  };
}

function snapshot(): Settled[] {
  return files;
}

/**
 * The account's files, shared.
 *
 * The same list for every caller, so the drive, a deadline's panel and the
 * marker on a row cannot disagree about what is stored. The reference is
 * stable until something changes it, which is what stops a render loop.
 */
export function useFiles(): Settled[] {
  return useSyncExternalStore(subscribe, snapshot, () => NO_FILES);
}

/** Reset the module's state. For tests, which must not share a file list. */
export function forgetFiles(): void {
  files = NO_FILES;
  read = false;
  reading = false;
  cached = null;
}

let cached: { key: readonly unknown[]; counts: Record<string, number> } | null = null;

/**
 * The counts, memoised on the identity of the lists they were built from.
 *
 * Pass the store and the shared file list. Anything with no work filed against
 * it has no key, so a caller reads `counts[id] ?? 0` and a deadline with
 * nothing draws nothing — see the test in `forwork.test.ts` about why a zero
 * would be a paperclip on every deadline in the term.
 */
export function clipCounts(held: Holdings): Record<string, number> {
  const key = [held.documents, held.sheets, held.decks, held.notes, held.equations, held.files] as const;
  if (cached && key.every((part, at) => part === cached?.key[at])) return cached.counts;
  const found = countsByItem(held);
  // An empty answer is the shared object, so a screen full of rows with
  // nothing filed against them compares equal render after render — and the
  // cache holds the same one it hands back, which the first version of this
  // did not.
  const counts = Object.keys(found).length === 0 ? NO_COUNTS : found;
  cached = { key, counts };
  return counts;
}
