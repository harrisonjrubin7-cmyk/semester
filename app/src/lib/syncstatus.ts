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
  'read-only': {
    short: 'Read-only',
    standing: 'Read-only mode',
    sentence: 'Read-only mode: this build does not send changes to your account. Everything you change is saved on this device and goes up once read-only mode ends.',
  },
  conflict: {
    short: 'Conflict',
    standing: 'Sync conflict',
    sentence:
      'Another device keeps changing this semester at the same moment. Nothing has been overwritten — each round merges both — and this device will keep trying.',
  },
  review: {
    short: 'Review',
    standing: 'Conflict needs review',
    sentence:
      'Something was changed on two devices before either synced. Both versions are saved on this device — choose which one to use.',
  },
  error: {
    short: 'Trouble',
    standing: 'Sync trouble',
    sentence: 'Sync failed.',
  },
};

/** The states in which this device holds something the account does not know yet. */
export function waiting(status: SyncStatus): boolean {
  return status === 'queued' || status === 'conflict' || status === 'review';
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

/**
 * The one line under the header, for the statuses worth one — or null.
 *
 * `SYNC_WORDS` said all of this already, but only on Account and the soft
 * bar's card, so a student offline with edits waiting, or with two devices'
 * versions of a record waiting on a choice, was told nothing unless they went
 * looking. The state-design brief's rule is a quiet persistent status for the
 * conditions that matter and silence for the rest: syncing, synced and signed
 * out are true and routine, and stay off the screen.
 *
 * A failure always says the work is still here. "Sync failed" on its own is
 * the sentence the brief lists under *avoid* — it leaves the student to guess
 * whether anything was lost.
 */
export interface SyncLine {
  title: string;
  detail: string;
  /** The app's one warning colour, or the panel. Offline is a condition, not a fault. */
  warn: boolean;
  /** What the button says, or empty for none. It opens Account, where the whole story is. */
  act: string;
}

const SAFE = 'Your work is still saved on this device.';

export function syncLine(status: SyncStatus, error: string, online = true): SyncLine | null {
  /*
   * No account to sync to, and no connection. The store's status is about
   * the account, so it stays "signed-out" or "off" here and says nothing —
   * but the student still needs to know, and must not be promised a sync
   * that will not happen. No button: Account has nothing more to say.
   */
  if (!online && (status === 'off' || status === 'signed-out')) {
    return {
      title: 'Offline',
      detail: 'Everything here is saved on this device. Anything that needs the internet waits for the connection.',
      warn: false,
      act: '',
    };
  }
  switch (status) {
    case 'offline':
      return { title: 'Offline', detail: SYNC_WORDS.offline.sentence, warn: false, act: 'Details' };
    case 'queued':
      return { title: 'Offline · changes waiting', detail: SYNC_WORDS.queued.sentence, warn: true, act: 'Details' };
    // Said by `components/ReadOnlyBanner.tsx` on every screen already, for
    // the whole build; a second line under it would say the same thing twice.
    case 'read-only':
      return null;
    case 'conflict':
      return { title: 'Sync conflict', detail: SYNC_WORDS.conflict.sentence, warn: true, act: 'Details' };
    case 'review':
      return { title: 'Two versions need your review', detail: SYNC_WORDS.review.sentence, warn: true, act: 'Choose' };
    case 'error': {
      // The first paragraph only: the rest of an explained failure is a
      // reference code and advice that belong on Account, not in a strip.
      const said = (error.split('\n\n')[0] || SYNC_WORDS.error.sentence).trim();
      const safe = /safe on this device|saved on this device/i.test(error);
      return { title: 'Couldn’t sync yet', detail: safe ? `${said} ${error.split('\n\n').slice(1).join(' ')}`.trim() : `${said} ${SAFE}`, warn: true, act: 'Details' };
    }
    default:
      return null;
  }
}
