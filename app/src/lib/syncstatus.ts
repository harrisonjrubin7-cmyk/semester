import type { SyncStatus } from '../state/store';
import { FAILURES, type Code } from './failure';

/**
 * What each sync state is called, in the three sizes the app says it.
 *
 * One table because four screens say it — the soft top bar, the Settings
 * index, Account and Profile — and they had each written their own chain of
 * `status === …`. That was harmless while there were five states and fatal
 * the moment there were eight: a new state fell off the end of each chain
 * into its fallback, which was "On this device only" on one screen and
 * "Local" on another, and neither is true of a device that is offline with
 * edits waiting. `Record<SyncStatus, …>` makes a missing state a type error
 * rather than a wrong word.
 *
 *   short     one word, for the soft bar's card, which has room for one
 *   standing  the Settings row
 *   sentence  Account and Profile, which have room to say what happens next
 *
 * No state is told apart by colour alone anywhere these are shown: the word
 * is the state.
 */
export interface SyncWords {
  short: string;
  standing: string;
  sentence: string;
}

export const SYNC_WORDS: Record<SyncStatus, SyncWords> = {
  off: {
    short: 'Local',
    standing: 'On this device only',
    sentence: 'This build has no account service, so nothing can leave the device.',
  },
  'signed-out': {
    short: 'None',
    standing: 'Not signed in',
    sentence: 'Everything stays on this device. An account is optional.',
  },
  syncing: {
    short: 'Syncing',
    standing: 'Syncing',
    sentence: 'Catching up with your account…',
  },
  synced: {
    short: 'Synced',
    standing: 'Synced',
    sentence: 'Synced',
  },
  offline: {
    short: 'Offline',
    standing: 'Offline',
    sentence: 'No connection. Everything here is saved on this device, and it will sync when the connection is back.',
  },
  queued: {
    short: 'Queued',
    standing: 'Queued to sync',
    sentence: 'No connection. Your latest changes are saved on this device and will go to your account as soon as the connection is back.',
  },
  conflict: {
    short: 'Conflict',
    standing: 'Sync conflict',
    sentence:
      'Another device keeps changing this semester at the same moment. Nothing has been overwritten — each round merges both — and this device will keep trying.',
  },
  error: {
    short: 'Trouble',
    standing: 'Sync trouble',
    sentence: 'Sync failed.',
  },
};

/** The states in which this device holds something the account does not know yet. */
export function waiting(status: SyncStatus): boolean {
  return status === 'queued' || status === 'conflict';
}

/**
 * Whether a failed push should go again on its own.
 *
 * `lib/failure.ts` already answers "could repeating the same request
 * succeed?" per code, and this is that answer with one exception. A
 * validation error is marked retryable there because a person can correct
 * the field and press again; a push has no person and no field, and sending
 * the same copy again would fail the same way forever. Permission and
 * sign-in failures are not retried either — the next edit, or the next
 * sign-in, pushes anyway, and a loop against a refused write says nothing
 * the first refusal did not.
 */
export function retriesOnItsOwn(code: Code): boolean {
  return FAILURES[code].retry && code !== 'VALIDATION_ERROR';
}

/** The quiet before an ordinary push: long enough for typing to stop. */
export const PUSH_SETTLE_MS = 2500;

/**
 * How long before the next push, given how many in a row have lost the race
 * (`lost`) and how many have failed outright (`failed`).
 *
 * Doubling from the settle time either way. A lost race is capped at a
 * minute: another device is live and the merge is cheap. A failure is capped
 * at five, because what fails is usually the network or the service, and
 * neither is helped by being asked every few seconds by every open tab.
 * Coming back online resets `failed`, so a device that was cut off does not
 * sit out the rest of a five-minute wait it no longer needs.
 */
export function pushWait(lost: number, failed: number): number {
  const race = lost === 0 ? PUSH_SETTLE_MS : Math.min(60_000, PUSH_SETTLE_MS * 2 ** lost);
  const fail = failed === 0 ? PUSH_SETTLE_MS : Math.min(300_000, PUSH_SETTLE_MS * 2 ** failed);
  return Math.max(race, fail);
}
