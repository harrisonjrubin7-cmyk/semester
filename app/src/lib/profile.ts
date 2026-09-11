/**
 * Who this is, said in the app's own words.
 *
 * The app has known four separate things about the person holding it for a
 * long time — the name they typed, the account they may have signed into, the
 * school they picked and the role they are here in — and never put them in one
 * place. The name was a field on the Courses settings page, the account was a
 * screen about syncing, the school was a picker two pages further down, and
 * the role was a list of radio buttons beside it. There was no screen that
 * answered "who does this app think I am", which is the screen every phone has
 * behind the little round picture at the top right.
 *
 * `screens/Profile.tsx` is that screen and this is its arithmetic. Pure, so
 * the sentences can be tested rather than screenshotted, and separate from the
 * screen so the header's avatar and the screen itself cannot disagree about
 * what your initials are.
 *
 * ## The rule this file is most careful about
 *
 * **A name is asked for, never derived.** `state/shape.ts` says it where the
 * field is declared — "never guessed at from an email address" — and an avatar
 * is exactly where that promise gets quietly broken, because `H` from
 * `harrison@…` looks like a reasonable thing to draw. It is a guess at
 * somebody's name shown back to them as fact, and `initials` returns nothing
 * at all rather than make it. The avatar draws a glyph instead, and the screen
 * asks for the name.
 */

import type { Account } from './cloud';
import type { SyncStatus } from '../state/store';
import type { Row } from './inventory';

/**
 * Up to two letters for the avatar, from the name and only from the name.
 *
 * Two words give two letters, one word gives one, and no name gives an empty
 * string — see the note above about why this does not look at the email.
 * Non-letters are skipped rather than drawn: "J.R.R." is `JR`, not `J.`.
 */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s.]+/)
    .map((w) => [...w].find((c) => /\p{L}/u.test(c)) ?? '')
    .filter(Boolean);
  if (words.length === 0) return '';
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.join('').toUpperCase();
}

/**
 * What to call them in a heading.
 *
 * The name if there is one; otherwise the invitation to give one, because a
 * profile headed with an email address is a profile that has answered "who are
 * you" with "your login", and a blank one reads as a bug.
 */
export function heading(name: string): string {
  return name.trim() || 'Add your name';
}

/** Whether the heading above is the real thing or the prompt. */
export function named(name: string): boolean {
  return name.trim() !== '';
}

export interface AccountState {
  /** The row, when signed in. */
  account: Account | null;
  status: SyncStatus;
  /** When the last sync finished, epoch ms. Zero if never. */
  at: number;
}

export interface Said {
  /** The line under the name: the address, or why there is not one. */
  line: string;
  /** The state of the copy in the account, in a few words. */
  sub: string;
}

/**
 * The two lines under the avatar.
 *
 * Signed out is not an error and is not written as one. The app works on one
 * device and always has, so the second line says what is true — this device —
 * rather than apologising for a wall the app does not have.
 */
export function saidAbout({ account, status, at }: AccountState, now = Date.now()): Said {
  if (!account) {
    return {
      line: status === 'off' ? 'This device' : 'Not signed in',
      sub:
        status === 'off'
          ? 'This build has no account service, so nothing can leave the device.'
          : 'Everything stays on this device. An account is optional.',
    };
  }
  const sub =
    status === 'syncing'
      ? 'Catching up with your account…'
      : status === 'error'
        ? 'Sync failed — open Account for what went wrong.'
        : status === 'synced'
          ? `Synced ${agoLine(at, now)}`
          : `Signed in through ${account.via}.`;
  return { line: account.email, sub };
}

/**
 * "just now", "12 minutes ago", "yesterday".
 *
 * Coarse on purpose: the question behind a sync time is "is this recent", and
 * a clock time answers it only for somebody who knows what time it is now.
 */
export function agoLine(at: number, now = Date.now()): string {
  if (!at) return 'just now';
  const mins = Math.round((now - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * The collections worth naming on a profile, in the order they are shown.
 *
 * A *summary*, and the distinction from `screens/Data.tsx` is the whole reason
 * the two screens can both exist: Data answers "what is in here and how big is
 * it" and lists every key of the persisted state sorted by bytes, which is the
 * right answer when the phone says it is out of space and the wrong one when
 * somebody is looking at their own profile. This is six things a person would
 * recognise as theirs, counted, with the full list one tap away.
 *
 * Keyed off `inventory`'s rows rather than counted again here, so the number
 * beside "Notes" is the same number the data screen shows.
 */
export const SUMMARY: { key: string; label: string }[] = [
  { key: 'courses', label: 'Courses' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'sittings', label: 'Practice papers' },
  { key: 'reviews', label: 'Cards reviewed' },
];

export interface Held {
  label: string;
  count: number;
}

/**
 * What the app holds, as the handful of figures a person would recognise.
 *
 * Rows with nothing in them are dropped rather than shown as zero: a column of
 * noughts is a list of things you have not done, on the one screen that should
 * not be a scolding.
 *
 * ## Why the course count is passed in rather than read off the rows
 *
 * `state.courses` holds the courses somebody imported, and it is **empty**
 * while the semester the app ships with is the one on screen — those live in
 * the catalogue, not in the saved state. So the honest count of a stored
 * collection and the honest answer to "how many courses do I have" are two
 * different numbers, and the first one told a student looking at four courses
 * that the app was holding nothing at all. The catalogue is what every other
 * screen counts, so it is what this counts. Everything else on the list is a
 * collection that exists nowhere but the saved state, and is read straight off
 * the same rows the data screen weighs.
 */
export function held(rows: Row[], courses: number): Held[] {
  const by = new Map(rows.map((r) => [r.key, r]));
  return SUMMARY.map(({ key, label }) => ({
    label,
    count: key === 'courses' ? courses : (by.get(key)?.count ?? 0),
  })).filter((r) => r.count > 0);
}

/**
 * One line about the age of what is here.
 *
 * ## What this is careful not to claim
 *
 * It said "your semester has been on this device for N days", and the number
 * came from `inventory`'s span — the oldest timestamp found anywhere in the
 * saved state. Those are not the same fact. Restore a backup, sign in on a
 * second device, or import a course from last spring, and the oldest record is
 * older than this device has held anything; the app would have reported the
 * age of a note as the age of an install, confidently and wrongly, on the one
 * screen whose job is to say what it knows about you.
 *
 * There is no arrival timestamp to use instead. Nothing in `Persisted` records
 * when the app first ran here — `lastSeen` is when this device last had it
 * *open*, which is a different thing again — so rather than invent one, the
 * sentence now says the thing the span actually measures. `screens/Data.tsx`
 * words the same figure the same way: "Spanning <date> to <date>."
 *
 * Empty where there is nothing dated to measure, which is a new install, and
 * empty under a day, where "0 days old" is a sentence that says nothing.
 */
export function oldestLine(span: { from: number; to: number } | null, now = Date.now()): string {
  if (!span) return '';
  const days = Math.floor((now - span.from) / 86_400_000);
  if (days < 1) return '';
  if (days < 30) return `The oldest record here is ${days} days old.`;
  const months = Math.round(days / 30);
  return `The oldest record here is about ${months} month${months === 1 ? '' : 's'} old.`;
}
