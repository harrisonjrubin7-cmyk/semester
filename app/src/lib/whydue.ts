/**
 * Why this card, now — said on the card, in one line.
 *
 * The drill has decided the order of every card for a long time: overdue
 * first, then unseen, then the known, weakest first, with a test three weeks
 * out pulling stranded cards forward (`lib/intime.ts`). None of that was ever
 * visible. A student saw a card they got right yesterday come back, or one
 * they have never met arrive before one they missed, and had no way to tell a
 * schedule from a shuffle. The learning-platform audit names this failure
 * outright — "Hidden algorithm: students do not understand why cards appear"
 * — and asks for a "why this is due" explanation on the card.
 *
 * ## Read from the stored record, not the run's copy
 *
 * `Drill` deals its deck from an adjusted copy of the reviews that is fixed
 * when the run starts, and "Run it again" does not rebuild it. Reading the
 * reason off that copy would explain the second run with the first run's
 * records — a card answered right a minute ago still labelled "due three days
 * ago". So this reads the live, stored reviews and asks `wouldMiss` the test
 * question itself, against the same unadjusted record `inTime` reads.
 *
 * ## One reason, the most specific that is true
 *
 * A card is usually true on several counts at once — overdue *and* missed
 * last time *and* before a quiz. Listing them all is a paragraph on a card,
 * so the reasons are ranked and the first true one is said. The order puts
 * what the student can least infer first: that a test is pulling the card
 * forward is invisible from anywhere else in the app; that it is overdue is
 * the plain default.
 *
 * ## Calm language, and no counts that scold
 *
 * The audit is as specific about tone as about the feature: no shame
 * language, no streak guilt. So "due three days ago" is followed by what that
 * means for memory rather than by anything about the student, and a card that
 * keeps catching them is named as a card problem — the same stance
 * `keepsCatching` in `lib/review.ts` takes.
 */

import { daysBetween } from './date';
import { wouldMiss, type Tests } from './intime';
import { keepsCatching, type Reviews } from './review';

/** Which reason applied. Carried so a test can pin the ranking, not the prose. */
export type WhyKind = 'new' | 'test' | 'catching' | 'missed' | 'due' | 'early';

export interface Why {
  kind: WhyKind;
  /** The line the card shows. */
  says: string;
}

/** "today", "tomorrow", "in 6 days". */
function when(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** "1 day", "3 days". */
function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * The reason a card is in front of the student now.
 *
 * `reviews` is the **stored** record, never the `inTime`-adjusted copy — see
 * the note at the top of the file. `tests` is `testsNear` for the same `now`.
 */
export function whyDue(
  key: string,
  courseId: string,
  reviews: Reviews,
  tests: Tests,
  now: number,
): Why {
  const r = reviews[key];
  if (!r || r.seen === 0) {
    return { kind: 'new', says: 'New to you. You have not answered this one yet.' };
  }

  const test = tests[courseId];
  if (wouldMiss(reviews, key, test)) {
    return {
      kind: 'test',
      says: `Brought forward. On its own schedule it would not come back before the ${test.kind.toLowerCase()} ${when(test.days)}.`,
    };
  }

  if (keepsCatching(r)) {
    return {
      kind: 'catching',
      says: `Missed ${r.wrong} times. If it catches you again, the reading it came from is the place to look.`,
    };
  }

  /*
   * Ahead of the due check rather than inside it. A miss puts the card back in
   * ten minutes, so "Run it again" straight after a run deals it while it is
   * still not due — and "not due until later today" would be true and useless
   * next to the reason it is actually here.
   */
  if (r.streak === 0 && r.wrong > 0) {
    return { kind: 'missed', says: 'Missed last time, so it came back sooner.' };
  }

  const late = daysBetween(new Date(r.due), new Date(now));
  if (r.due <= now) {
    return {
      kind: 'due',
      says:
        late <= 0
          ? 'Due today. About when you would start to forget it.'
          : `Due ${days(late)} ago. Recalling it now still resets the clock.`,
    };
  }

  return {
    kind: 'early',
    says: `${late === 0 ? 'Not due until later today' : late === -1 ? 'Not due until tomorrow' : `Not due for ${days(-late)}`}. Here because nothing more urgent is left in this deck.`,
  };
}
