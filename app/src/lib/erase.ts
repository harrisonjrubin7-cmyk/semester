import { COLLECTIONS } from '../state/persist/shape';
import { stopWriting } from '../state/persist';
import { wipe } from '../state/persist/db';
import { clearSnapshots } from './snapshots';
import { clearFiles } from './files';
import { clearVersions } from './docversions';
import { clearShared } from './shared';

/**
 * Erase from this device.
 *
 * The app has promised this in two places for as long as the sync has
 * existed — `CLAIMS` in `lib/privacy.ts` says "signing out leaves it alone,
 * and Erase from this device removes it", and `deleteEverything` in
 * `lib/cloud.ts` ends by saying the account is empty and "this device still
 * has its own copy — Erase from this device removes that". No screen offered
 * it. Every piece of it was written and none of them was called, which is how
 * a promise ends up in two files and nowhere else.
 *
 * ## Everything it wrote, not a list of what it wrote
 *
 * The keys are found by prefix rather than named. There are nineteen of them
 * — the store, the drafts, the threads, the archive, the scrollback, the
 * usage counts, the timers, the tokens, the log, the Claude key, and eight
 * more — and a hand-kept list of nineteen is a list that is eighteen long by
 * the time somebody adds the twentieth. The prefix cannot drift: every key
 * this app has ever written begins `semester.`, and `erase.test.ts` fails if
 * one does not.
 *
 * That is the difference between this and the delete-my-account button beside
 * it. That one names its tables, because a server has other people's rows in
 * it and deleting by prefix there would be a catastrophe. This is one origin
 * in one browser, and everything under the prefix is ours.
 *
 * ## What it does not touch
 *
 * The account. Erasing the device signs nobody out of anything and removes no
 * row from the server — `deleteEverything` is the button for that, and the
 * two are deliberately separate because the common case for this one is a
 * shared or borrowed laptop, where the account is the thing you want to keep.
 * The tokens go, so the next session on this device starts signed out.
 */

/** Everything this app writes to a browser store begins with it. */
export const PREFIX = 'semester.';

/**
 * The databases it opens, all named the same way.
 *
 * This list drifted exactly as the paragraph above warns a list will. It said
 * three while the app had opened a fourth — `semester-drafts`, holding up to
 * twenty full copies of every document — and nothing read the list, so nothing
 * noticed. A history of everything somebody wrote survived Erase from this
 * device, on the shared laptop that button exists for.
 *
 * So it is no longer decoration: `erase.test.ts` reads every `store(...)` call
 * in `src` and fails if a database is opened that is not named here, the same
 * way it already reads every `setItem` against the prefix. Adding a name here
 * is not enough on its own — `eraseDevice` has to clear it, and the test
 * checks that too.
 */
export const DATABASES = [
  'semester-store',
  'semester-files',
  'semester-snapshots',
  'semester-drafts',
];

/** What was actually removed, so the screen can say so rather than assume. */
export interface Erased {
  /** Keys removed from localStorage and sessionStorage. */
  keys: number;
}

/**
 * The keys under the prefix, read before anything is removed.
 *
 * Split out because a `Storage` cannot be iterated while it is being emptied:
 * `key(i)` re-indexes on every removal, so removing inside the loop skips
 * every other key. The list is taken first and removed second.
 */
export function keysIn(store: Storage): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) out.push(key);
    }
  } catch {
    // A private window with storage switched off has nothing to enumerate.
  }
  return out;
}

function empty(store: Storage): number {
  const keys = keysIn(store);
  for (const key of keys) {
    try {
      store.removeItem(key);
    } catch {
      // Removing what cannot be read is not a failure worth stopping for.
    }
  }
  return keys.length;
}

/**
 * Take this device back to how it was before the app ran.
 *
 * Order matters in one place and one only: the writer is stopped first.
 * `persist()` settles a quarter of a second after the last change, so a tick
 * box pressed on the way to this screen has a write in flight — and a write
 * that lands after the erase would put a row back into an emptied store and
 * leave the app half-erased, which is worse than not erasing at all.
 *
 * Everything after that is independent and none of it throws: a browser that
 * refuses IndexedDB still gets its keys removed, and a store that is already
 * gone is not an error. The caller reloads.
 */
export async function eraseDevice(): Promise<Erased> {
  stopWriting();

  const keys = empty(localStorage) + empty(sessionStorage);

  // Through each store's own clear rather than `deleteDatabase`: the app holds
  // these open, and a delete blocks on an open handle — silently, with no
  // error and no completion, which is the one failure mode that would leave
  // somebody believing this had worked.
  await wipe(COLLECTIONS).catch(() => undefined);
  await clearFiles().catch(() => undefined);
  await clearSnapshots().catch(() => undefined);
  await clearVersions().catch(() => undefined);

  // Not a database: the service worker leaves a shared file in a Cache
  // Storage entry, and one that arrived and was never collected is still a
  // file somebody handed this device.
  await clearShared().catch(() => undefined);

  return { keys };
}
