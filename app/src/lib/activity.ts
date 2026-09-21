/**
 * The three numbers the pilot is judged on, and the one call that produces
 * them.
 *
 * `supabase/migrations/20260921151000_activity.sql` is the other half and
 * carries nearly all of the reasoning, because nearly all of it is about what
 * a browser may write about a person and that can only be settled in the
 * database. This module is the app's half: working out what is true of the
 * account right now, and saying so no more often than it has to.
 *
 * The build-out plan asks for activation, weekly active use and 30-day
 * retention. `ANALYTICS.md` is where those are defined and queried. Nothing
 * here counts anything else, and adding a fourth mark means adding a fourth
 * question to that document first.
 *
 * ## Why this reads state rather than listening for events
 *
 * The ordinary build puts a call at each moment worth counting: one where a
 * syllabus import finishes, one where a drill ends. Every one of those is a
 * place the count can be forgotten by somebody refactoring a screen, and the
 * failure is silent in the worst direction — a call that was never made looks
 * exactly like a student who never did the thing, and the figure it feeds is
 * *activation*, which the whole pilot is being judged on.
 *
 * So the marks are derived, in one place, from state the app already holds.
 * There is one call site, it cannot be forgotten by anybody editing a screen,
 * and the derivation is a pure function that a test can walk.
 *
 * What that costs is stated rather than hidden. A mark's date is the first day
 * the app was **open** with it true, which for a student who imports a
 * syllabus and closes the tab immediately is their next visit rather than
 * today. `noteToday` re-sends when the derived set changes, so the usual
 * window is the moment between the state changing and the next render — but
 * it is not zero. No figure downstream should be read as accurate to the day
 * for one account; every question in `ANALYTICS.md` is about a population
 * over weeks.
 *
 * ## Why signed out is not a special case here
 *
 * It is a special case in the database — `note_activity` reads `auth.uid()`
 * and returns without writing when there is not one — and it is a special
 * case at the call site, which is inside the branch that runs when a session
 * arrives. This module is deliberately not a third place that knows: a module
 * that checks for a session itself would be a module somebody could call from
 * a screen, and there would then be two answers to "when does this fire".
 */

import { cloud, cloudConfigured } from './cloud';

/**
 * The closed vocabulary, which is also the funnel.
 *
 * Stated here and in the migration's `check` constraint, in two languages, in
 * two deployments that cannot import from each other. `activity.test.ts` reads
 * that file as text and fails if the two lists stop agreeing — the instrument
 * `lib/referral.test.ts` and `lib/allowance.test.ts` use for the same shape of
 * gap, where each side is correct on its own and no unit test of either can
 * see the drift.
 */
export const MARKS = ['opened', 'course', 'studied'] as const;

export type Mark = (typeof MARKS)[number];

/**
 * How long the database keeps a row, in days. Pinned to the migration by the
 * same test, and written down in `RETENTION.md` where the schedule lives.
 *
 * Nothing in this module uses it. It is exported so that the test has one
 * place to compare against and so that a reader of this file knows the answer
 * without opening the SQL — the number is a promise, and a promise stated in
 * only one of the two places it is true is how `RETENTION.md` came to exist.
 */
export const PRUNE_DAYS = 400;

/** Where the last ping is remembered, so a refresh does not repeat it. */
export const SAID_KEY = 'semester.activity';

/** The little of the account's state the marks are derived from. */
export interface Standing {
  /** Courses of this account's own. The sample semester is not one of them. */
  courses: unknown[];
  /** Cards answered, ever, keyed by card. */
  reviews: Record<string, unknown>;
}

/**
 * What is true of this account now.
 *
 * `opened` is unconditional and it is not padding: it is the whole of weekly
 * active use and half of retention, and a set that could come back empty would
 * make "no marks" mean both "signed in and did nothing" and "did not sign in".
 *
 * `course` counts courses the account added. The sample semester is a boolean
 * on the state row rather than an entry in this list, which is what makes the
 * distinction free — somebody reading the sample has not onboarded, and a
 * count that included it would report every new account as activated.
 */
export function marksFor(state: Standing): Mark[] {
  const marks: Mark[] = ['opened'];
  if (state.courses.length > 0) marks.push('course');
  if (Object.keys(state.reviews).length > 0) marks.push('studied');
  return marks;
}

/**
 * Today, as the database will see it.
 *
 * UTC, because the row's `day` is UTC — a guard keyed to the device's local
 * date would stop a student in Nashville pinging for the five hours a day
 * their date and the database's disagree, and those five hours are the
 * evening. What this cannot survive is a device whose clock is actually
 * wrong by a day, which would cost that account one day's row; nothing else
 * in this app survives that either.
 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The line remembered after a successful ping. */
const line = (marks: Mark[]): string => `${today()}|${[...marks].sort().join(',')}`;

/**
 * Send today's marks, unless the same ones have already been sent today.
 *
 * It takes the marks rather than the state, which is a concession to the one
 * caller: the store has to name in a dependency array exactly what a re-run
 * depends on, and `state` is not that — it changes on every keystroke in a
 * note. So the derivation happens there, where the memo that makes the array
 * stable can live beside it, and this function's job is the wire.
 *
 * The guard is written **after** the call rather than before it, which is the
 * difference between a failed ping costing a retry and costing a day: a
 * student who is offline when the app opens would otherwise be recorded as
 * having been told about, and never asked again until tomorrow.
 *
 * Returns whether anything was sent, which is for the test rather than for the
 * caller — nothing on screen waits for this, and the caller discards it.
 */
export async function noteToday(marks: Mark[]): Promise<boolean> {
  if (!cloudConfigured || marks.length === 0) return false;
  const said = line(marks);
  try {
    if (window.localStorage.getItem(SAID_KEY) === said) return false;
  } catch {
    // Private browsing, or storage switched off. The ping still goes; the
    // cost of a storage that cannot be read is a repeated upsert, which the
    // primary key absorbs.
  }

  const { error } = await (await cloud()).rpc('note_activity', { marks });
  if (error) throw new Error(error.message);

  try {
    window.localStorage.setItem(SAID_KEY, said);
  } catch {
    // As above.
  }
  return true;
}
