/**
 * Pulling down to check, and saying plainly what came of it.
 *
 * The app checks the account once, on sign-in, and never again while it is
 * open. Somebody who imports a syllabus on their laptop and then looks at
 * their phone sees yesterday's app and no way to ask it to look. Leaving a tab
 * open for a week is how most people use this.
 *
 * ## The result is a sentence, not a spinner
 *
 * Almost every pull-to-refresh in existence spins for a moment and then shows
 * exactly what it showed before, and the user is left to guess whether it
 * found nothing or failed silently. Those are very different facts, and the
 * only honest way to tell them apart is to say which happened.
 *
 * So this returns a sentence for every outcome, including the boring one.
 * "Nothing new" is a real answer and worth the line it takes.
 *
 * ## It never claims more than it did
 *
 * A refresh that could not reach the server says so. A refresh on a device
 * that was never signed in says that, rather than "up to date" — a phone with
 * no account is not up to date with anything, and telling somebody it is, is
 * the exact failure that makes people stop trusting a sync indicator.
 */

/** What actually happened, for the sentence to describe. */
export interface Outcome {
  /** Whether this build has an account service at all. */
  cloud: boolean;
  /** Whether this device is signed in to one. */
  signedIn: boolean;
  /** Whether a newer copy was found and taken. */
  took: boolean;
  /** How many courses came with it. */
  courses: number;
  /** Non-empty when the check could not be made. */
  error: string;
  /** When the copy that was taken was written, epoch ms. Zero when none was. */
  at: number;
}

const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * How long ago, in the words a person would use.
 *
 * Deliberately coarse. "Updated 4 minutes ago" and "updated just now" mean the
 * same thing to somebody deciding whether to trust what is on screen, and the
 * precise version invites them to work out whether four minutes is too long.
 */
export function whenAgo(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${s(hours, 'hour')} ago`;
  const days = Math.round(hours / 24);
  return `${s(days, 'day')} ago`;
}

/** What to say once the check is done. */
export function said(o: Outcome, now: number): string {
  if (o.error) {
    // The error is already a sentence — `explainSyncError` writes it. Prefixed
    // rather than replaced, so somebody can tell a failed check from a check
    // that succeeded and found nothing.
    return `Could not check. ${o.error}`;
  }
  if (!o.cloud) {
    return 'Everything here is on this device only, so there is nothing to check for.';
  }
  if (!o.signedIn) {
    return 'Not signed in on this device, so there is no other copy to check against.';
  }
  if (!o.took) {
    return 'Checked. Nothing new since your other devices last saved.';
  }
  const when = o.at > 0 ? ` It was saved ${whenAgo(o.at, now)}.` : '';
  if (o.courses > 0) {
    return `Took a newer copy, with ${s(o.courses, 'course')}.${when}`;
  }
  return `Took a newer copy.${when}`;
}

/**
 * How far the finger has to travel before it counts.
 *
 * Far enough that a flick past the top of a list does not fire it, close
 * enough that it does not feel like a fight. The number is here rather than in
 * the component so the test can name it.
 */
export const PULL_TO_FIRE = 64;

/** Past this, dragging further does nothing — the rubber band has run out. */
export const PULL_MAX = 96;

/**
 * How far to draw the indicator for a given drag.
 *
 * Resisted rather than linear: the first pixels move nearly one-for-one and
 * the last barely move at all, which is what tells a finger it has reached the
 * end without anything having to say so.
 */
export function pulled(dragged: number): number {
  if (dragged <= 0) return 0;
  return Math.min(PULL_MAX, PULL_MAX * (1 - Math.exp(-dragged / PULL_MAX)));
}

/** Whether letting go now would fire it. */
export function fires(dragged: number): boolean {
  return pulled(dragged) >= PULL_TO_FIRE;
}

/** What the indicator says while the finger is still down. */
export function pullLabel(dragged: number): string {
  return fires(dragged) ? 'Let go to check' : 'Pull to check';
}
