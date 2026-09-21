/**
 * Getting a card back in front of you before the test, rather than after it.
 *
 * `lib/review.ts` schedules cards on a forgetting curve, and a forgetting
 * curve does not know what a semester is. Measured on this app's own numbers,
 * a card answered right every time it comes up goes: two days, **eleven**,
 * forty-six, then a hundred and sixty-three. So a student who starts revising
 * a fortnight out answers a card on day 0, day 2 and day 13 — and on day 13
 * the scheduler puts it away until day 59. The exam is on day 14. The card is
 * never seen again before it, and the reason is that nothing in the scheduler
 * had ever been told the exam exists.
 *
 * That is worse than it was, not better, and the direction is the thing to
 * notice. Under the SM-2 variant this module was written against the ladder
 * ran one, six, sixteen, forty-five, and the census below found 67 of the 320
 * shipped cards stranded by a test three weeks out. Under FSRS the same census
 * finds **87** — a scheduler with a real model of memory is *more* willing to
 * let a well-known card sleep through a midterm, because from memory's point
 * of view it is right to. Nothing here needed changing when it landed, which
 * is the argument for having put the adjustment at the read rather than in the
 * record.
 *
 * The app knows. `testedIn` in `lib/select.ts` has answered "when is this
 * course's next test" since the study plan needed it; it was only ever read to
 * write a sentence.
 *
 * ## Adjusted where it is read, never where it is written
 *
 * Nothing here writes to a card's record. `inTime` takes the reviews and hands
 * back a copy in which a stranded card's `due` has been brought forward. The
 * stored schedule is untouched, and three things follow from that which are
 * worth more than the simplicity:
 *
 *  - **It expires by itself.** The day after the test the adjustment is simply
 *    not applied, and the card's own long-term schedule — which was never
 *    damaged — carries on. A ceiling written into the record would have
 *    shortened that card's interval permanently, for a test that is over.
 *  - **It reaches cards already scheduled past the test.** Those are most of
 *    them for anybody who has been studying. A rule that only applied on the
 *    next answer would never fire on a card that is not due until March.
 *  - **Every existing reader gets it for nothing.** `dueFirst`, `dueCount`,
 *    `comeRound`, `catching` and `strength` all read `due`, so a screen opts in
 *    by passing adjusted reviews and changes nothing else.
 *
 * The course a card belongs to comes out of the key: `cardKey` is
 * `${courseId}:${hash}`, so the map can be walked without the catalogue.
 *
 * ## Why the last looks are dealt out rather than piled on the eve
 *
 * The obvious rule — every stranded card comes due the day before the test —
 * is one line shorter and wrong in a way the census shows immediately: it
 * leaves the days before an exam with nothing due in them and then deals a
 * fortnight of cards on the last one. Fourteen days out on the shipped ECON
 * deck that is 52 cards on one evening and nothing on the other thirteen.
 *
 * The second attempt spread them by `strength`, and barely spread them at all:
 * 45 of those 52 still landed on the eve. `strength` saturates — it is
 * `STEP[min(streak, 3)]` — and a card anybody has actually revised is at three
 * already, so almost every card scored 1 and asked for the same day. That was
 * a measurement of the probe, not of the deck.
 *
 * So the looks are **dealt across the days that are left, least-certain
 * first**, ranked by the interval the scheduler itself assigned. That needs no
 * threshold anybody has to defend, it cannot saturate, and it puts a card the
 * scheduler trusts for forty-five days on the eve while one it only trusts for
 * sixteen comes back with room to be missed in — which is the entire reason
 * intervals exist.
 */

import { upcomingItems } from './select';
import { daysBetween } from './date';
import type { Reviews } from './review';
import type { CourseId } from './types';
import type { Catalog } from '../data/catalog';


/**
 * The same clock time, `days` calendar days earlier.
 *
 * Through a `Date` rather than by subtracting `days * DAY`, for the reason
 * `shiftIso` in `lib/date.ts` gives: a day is not always 86,400,000
 * milliseconds long. Twice a year one is an hour shorter or longer, and
 * millisecond arithmetic across that boundary lands on the wrong calendar day.
 *
 * Found by measurement rather than reasoning. The census's histogram disagreed
 * with `slotFor`'s own distribution by exactly one card — a day that should
 * have held one held three — because a slot computed in milliseconds had
 * slipped across the end of daylight saving. `npm run test:zones` runs this
 * suite in Chicago and Kiritimati precisely to catch the class.
 */
function daysBack(at: number, days: number): Date {
  const d = new Date(at);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Kinds of deadline that revising is *for*.
 *
 * The same four `lib/select.ts` uses, and deliberately the same list rather
 * than a second opinion about what a test is: a card pulled forward for a
 * "Quiz" the study plan does not count as a test would be the two halves of
 * the app disagreeing about Thursday.
 */
export const TESTS: ReadonlySet<string> = new Set(['Exam', 'Midterm', 'Quiz', 'Final']);

/** A course's next test. */
export interface Test {
  /** Midnight at the start of the day it falls on, epoch ms. */
  at: number;
  /** "Exam", "Midterm", "Quiz", "Final" — carried so a screen can name it. */
  kind: string;
  /** Whole days from now. 0 is today. */
  days: number;
}

/** What each course is next tested on, by course id. */
export type Tests = Record<CourseId, Test>;

/**
 * How far out a test still changes what comes due.
 *
 * Three weeks. Long enough to catch the sixteen- and forty-five-day intervals
 * that are the whole problem, and short enough that a final in December does
 * not quietly govern October's revision — which would collapse the schedule to
 * "everything, always" and is the failure mode of every cramming feature
 * anybody has shipped.
 */
export const HORIZON = 21;

/** The least room a last look needs: it has to be *before* the test. */
export const LAST_LOOK = 1;

/**
 * Each course's next test, from the catalogue.
 *
 * Only tests inside {@link HORIZON}: a course whose next test is in April must
 * leave the schedule alone. A course with nothing near is absent from the map
 * rather than present with a null, because an absent key is exactly what
 * {@link inTime} reads as "nothing to do here".
 */
export function testsNear(cat: Catalog, now: Date, horizon = HORIZON): Tests {
  const out: Tests = {};
  for (const item of upcomingItems(cat, now)) {
    if (!TESTS.has(item.kind)) continue;
    // The first is the next: `upcomingItems` is in date order.
    if (out[item.c]) continue;
    const days = Math.max(0, daysBetween(now, item.date));
    if (days > horizon) continue;
    /*
     * `decorateItem` builds the date as `new Date(year, month, day)`, so it is
     * already midnight at the start of the day and this takes it as it comes.
     * That is the reading this module wants — a test has an hour the app does
     * not reliably know, and the card wants to be back *before* it — and
     * `intime.test.ts` asserts the invariant rather than this file
     * re-establishing it, so a `date` that ever grows an hour fails a test
     * instead of quietly moving every last look half a day.
     */
    out[item.c] = { at: item.date.getTime(), kind: item.kind, days };
  }
  return out;
}

/** The last moment a look still counts as being before the test. */
export function eveOf(test: Test): number {
  return daysBack(test.at, LAST_LOOK).getTime();
}

/**
 * How many days are left to deal last looks into, counting today.
 *
 * **Calendar days, not elapsed milliseconds**, and the difference is the whole
 * feature. Written as `Math.floor((eve - now) / DAY)` this is one too few
 * whenever the clock is past midnight — which is always — so the earliest slot
 * landed later today or tomorrow and never at or before `now`. Nothing became
 * due; the set was simply re-dealt the next day, one day shorter, and again,
 * until the room ran out and every card fell on the eve at once.
 *
 * That is the exact pile-up the dealing exists to prevent, and it survived the
 * census because a census is one snapshot and this is a rollout. Simulated
 * over the twenty days before the shipped ECON midterm it was nineteen days of
 * nothing, then 68 cards on one evening, of which a 25-card sitting could
 * reach 25. See `intime.rollout.test.ts`, which walks the days.
 */
export function roomBefore(test: Test, now: number): number {
  return daysBetween(new Date(now), new Date(eveOf(test)));
}

/**
 * Which of the remaining days a card's last look falls on.
 *
 * Slot 0 is the eve of the test; slot `room` is today. A card ranked `i` of
 * `n` — most certain first — is dealt the slot that keeps the whole set evenly
 * spaced, so the most certain lands on the eve and the least certain gets the
 * earliest day there is.
 *
 * Pure arithmetic, and exported for that reason: it is the one place a bug
 * here would be silent, because a wrong slot still produces a card that comes
 * back before the test and nothing on screen would look wrong.
 */
export function slotFor(rank: number, n: number, room: number): number {
  if (n <= 0 || room <= 0) return 0;
  return Math.min(room, Math.floor((rank * (room + 1)) / n));
}

/**
 * When the run-up to a test begins: {@link HORIZON} before it.
 *
 * What a card has to have had a look inside of. The window is the same length
 * as the horizon on purpose — a test is either near enough to change the
 * schedule or it is not, and having two lengths would mean a card could be
 * pulled forward for a test whose run-up it was not yet in.
 */
export function runUpFrom(test: Test): number {
  return daysBack(test.at, HORIZON).getTime();
}

/**
 * Whether a card needs a look brought forward for this test.
 *
 * Two things have to be true, and the second is the one that took a rollout to
 * find. The card's own schedule has to miss the test — and it has to have had
 * **no look at all inside the run-up**.
 *
 * Without that second clause the guarantee has no end. A forced look updates
 * `seen` and the card's own interval sends it further out than ever, so it is
 * stranded again the next day and dealt again, and again; the set never
 * shrinks, and on the eve — where there is only one slot left — every card in
 * the deck falls due at once. Simulated across the twenty days before the
 * shipped ECON midterm that was 68 cards on one evening with a 25-card sitting
 * to meet them. `intime.rollout.test.ts` is that simulation.
 *
 * So what this promises is exactly one thing, and it is worth saying plainly:
 * **every card gets at least one look in the three weeks before the test.**
 * Not a second, and not a revision plan — the card's own schedule is the
 * revision plan, and this is the floor under it.
 *
 * Read against the *unadjusted* reviews: after {@link inTime} has run there
 * are none left to find. A card nobody has answered is not stranded either —
 * it has never been scheduled anywhere, and `dueFirst` already deals it as
 * unseen.
 */
export function wouldMiss(reviews: Reviews, key: string, test: Test | undefined): boolean {
  if (!test) return false;
  const r = reviews[key];
  if (!r || r.seen === 0) return false;
  return r.due > eveOf(test) && r.seen < runUpFrom(test);
}

/** How many of a set of cards their own schedule would have missed the test by. */
export function missingCount(keys: string[], reviews: Reviews, test: Test | undefined): number {
  return keys.filter((k) => wouldMiss(reviews, k, test)).length;
}

/**
 * The same reviews, with any card that would miss its course's test brought
 * back for one more look before it.
 *
 * Three cards are left exactly as they are, each for its own reason:
 *
 *  - one whose own schedule already brings it back before the test — it needs
 *    nothing;
 *  - one that has **already been seen** inside the final window — it has had
 *    its last look, and bringing it forward again is how the eve of an exam
 *    turns into the same twenty-five cards in a loop with no way out of it;
 *  - one in a course with no test near.
 *
 * Returns the very same object when nothing moved, so a screen that memoises
 * on it does not re-render for an adjustment that did not happen.
 */
export function inTime(reviews: Reviews, tests: Tests, now: number): Reviews {
  /** The stranded cards of each course, so they can be dealt as a set. */
  const byCourse = new Map<string, string[]>();
  for (const key of Object.keys(reviews)) {
    const test = tests[key.slice(0, key.indexOf(':'))];
    if (!test || !wouldMiss(reviews, key, test)) continue;
    const list = byCourse.get(key.slice(0, key.indexOf(':')));
    if (list) list.push(key);
    else byCourse.set(key.slice(0, key.indexOf(':')), [key]);
  }
  if (byCourse.size === 0) return reviews;

  const out: Reviews = { ...reviews };
  for (const [courseId, keys] of byCourse) {
    const test = tests[courseId];
    const eve = eveOf(test);
    const room = Math.max(0, roomBefore(test, now));
    /*
     * Most certain first, by the interval the scheduler itself assigned. Ties
     * broken by key so the order is the same on every render — a deck that
     * reshuffles between two renders of one day is the fault `dueFirst`'s
     * callers already memoise around.
     */
    keys.sort((a, b) => reviews[b].interval - reviews[a].interval || (a < b ? -1 : 1));
    keys.forEach((key, i) => {
      /*
       * Always earlier than the card's own schedule, never later — a card is
       * only in this list because `wouldMiss` found its `due` past the eve,
       * and every slot is the eve or before it. The clamp that used to sit
       * here could not fire, so it is not here.
       */
      out[key] = {
        ...reviews[key],
        due: daysBack(eve, slotFor(i, keys.length, room)).getTime(),
      };
    });
  }
  return out;
}
