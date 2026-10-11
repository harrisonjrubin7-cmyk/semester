import { COLLECTIONS } from '../state/persist/shape';
import { stopWriting } from '../state/persist';
import { wipe } from '../state/persist/db';
import { clearSnapshots } from './snapshots';
import { clearFiles } from './files';
import { clearVersions } from './docversions';
import { clearOutbox } from './sync/outbox';
import { eraseVaults } from './vault/idb';
import { clearEngineStore } from './sync/engine/persistent';
import { clearOfflineAttachmentPersistence } from './sync/engine/attachments-idb';
import { clearShared } from './shared';
import { clearHistory } from './history/history';

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
  // Sends the student kept for later. Their own material, waiting to go.
  'semester-outbox',
  'semester-history',
  // Encrypted offline records and the key that seals them (`lib/vault`).
  'semester-vault',
  // The engine's queue and rows for personal tasks (`lib/sync/engine`): unsent edits are somebody's writing.
  'semester-engine',
  // Default-off server attachment cache. Never aliases the student's own Files or vault databases.
  'semester-offline-attachments',
];

/** What was actually removed, so the screen can say so rather than assume. */
export interface Erased {
  /** Keys confirmed removed from localStorage and sessionStorage. */
  keys: number;
  /** Browser stores whose clear operation completed. */
  stores: string[];
}

/** A partial erase: every area was attempted, but these could not be confirmed. */
export class DeviceEraseIncompleteError extends Error {
  readonly failed: string[];
  readonly erased: Erased;

  constructor(
    failed: string[],
    erased: Erased,
  ) {
    super(`Device erase could not confirm ${failed.length} storage area${failed.length === 1 ? '' : 's'}.`);
    this.name = 'DeviceEraseIncompleteError';
    this.failed = failed;
    this.erased = erased;
  }
}

interface KeyRead {
  keys: string[];
  complete: boolean;
}

function readKeys(store: Storage): KeyRead {
  const keys: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    return { keys, complete: true };
  } catch {
    return { keys, complete: false };
  }
}

/**
 * The keys under the prefix, read before anything is removed.
 *
 * Split out because a `Storage` cannot be iterated while it is being emptied:
 * `key(i)` re-indexes on every removal, so removing inside the loop skips
 * every other key. The list is taken first and removed second.
 */
export function keysIn(store: Storage): string[] {
  return readKeys(store).keys;
}

function empty(store: Storage): { removed: number; complete: boolean } {
  const read = readKeys(store);
  let removed = 0;
  let complete = read.complete;
  for (const key of read.keys) {
    try {
      store.removeItem(key);
      if (store.getItem(key) === null) removed += 1;
      else complete = false;
    } catch {
      complete = false;
    }
  }
  return { removed, complete };
}

/** Whether any account is connected, read without loading `lib/connect.ts`. */
function holdsTokens(): boolean {
  try {
    const raw = localStorage.getItem('semester.tokens.v1');
    return Boolean(raw && Object.keys(JSON.parse(raw) as object).length > 0);
  } catch {
    return false;
  }
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
 * Everything after that is independent. Every area is attempted even when
 * one refuses access, and the caller reloads only when every clear operation
 * can confirm completion.
 */
export async function eraseDevice(): Promise<Erased> {
  stopWriting();

  /*
   * The connected accounts' tokens are about to go with everything else, so
   * the grants behind them are withdrawn first, where the provider allows it
   * (`lib/revoke.ts`). Deleting a token without that leaves the permission
   * live at the provider with nothing on this device able to withdraw it.
   * Loaded only when something is connected: `lib/connect.ts` is kept out of
   * the first load on purpose (see `main.tsx`).
   */
  if (holdsTokens()) {
    await import('./revoke').then((m) => m.disconnectAll()).catch(() => undefined);
  }

  const cleared: string[] = [];
  const failed: string[] = [];
  const local = empty(localStorage);
  const session = empty(sessionStorage);
  if (local.complete) cleared.push('localStorage');
  else failed.push('localStorage');
  if (session.complete) cleared.push('sessionStorage');
  else failed.push('sessionStorage');

  const attempt = async (name: string, operation: () => Promise<void | boolean>) => {
    try {
      const result = await operation();
      if (result === false) failed.push(name);
      else cleared.push(name);
    } catch {
      failed.push(name);
    }
  };

  // Through each store's own clear rather than `deleteDatabase`: the app holds
  // these open, and a delete blocks on an open handle — silently, with no
  // error and no completion, which is the one failure mode that would leave
  // somebody believing this had worked.
  await attempt('semester-store', () => wipe(COLLECTIONS));
  await attempt('semester-files', clearFiles);
  await attempt('semester-snapshots', clearSnapshots);
  await attempt('semester-drafts', clearVersions);
  await attempt('semester-outbox', clearOutbox);
  await attempt('semester-vault', eraseVaults);
  await attempt('semester-engine', clearEngineStore);
  await attempt('semester-offline-attachments', clearOfflineAttachmentPersistence);
  await attempt('semester-history', () => clearHistory());

  // Not a database: the service worker leaves a shared file in a Cache
  // Storage entry, and one that arrived and was never collected is still a
  // file somebody handed this device.
  await attempt('semester-shared', clearShared);

  const erased = { keys: local.removed + session.removed, stores: cleared };
  if (failed.length > 0) throw new DeviceEraseIncompleteError(failed, erased);
  return erased;
}
