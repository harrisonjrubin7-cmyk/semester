import type { SyncStatus } from '../state/store';

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
