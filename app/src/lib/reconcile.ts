/**
 * The app's dates against the ones the LMS is showing today.
 *
 * Every deadline in the app came out of a syllabus PDF, read once, before the
 * semester started. Syllabi move. A reflection re-dated in week three is a
 * missed reflection, and until now the app would go on saying the old date
 * with complete confidence — which is the worst way to be wrong, because
 * nothing about the screen suggests checking.
 *
 * The calendar feed is already here. It is parsed, matched to courses and
 * stored; it was only ever drawn beside the syllabus dates rather than checked
 * against them. This compares the two and says what disagrees.
 *
 * ## Matching, and why it is deliberately cautious
 *
 * Titles never match exactly. A syllabus says "Reflection #1 — Should play be
 * more serious?" and Brightspace says "Reflection 1". So matching is fuzzy,
 * scoped to the course where both sides know it, and greedy on the best score
 * — and the threshold is set high enough that an unmatched pair is reported as
 * two separate findings rather than as a wrong match.
 *
 * That is the right way round. "These two things might be the same, and if so
 * the date moved" is a claim a person can check in five seconds. A confident
 * wrong pairing sends somebody to change a date that was already right.
 */

import { dateToIso, movedLine as movedDays, realMonthDay } from './date';
import type { DatedItem, FeedEvent, Item } from './types';

/** Words that appear in half of all assignment titles and carry no signal. */
const NOISE = new Set([
  'assignment',
  'due',
  'submit',
  'submission',
  'the',
  'a',
  'an',
  'of',
  'for',
  'and',
  'to',
  'in',
  'on',
  'at',
  'is',
  'be',
  'homework',
  'hw',
  'week',
  'wk',
]);

/**
 * A title reduced to the words that identify it.
 *
 * Punctuation goes, case goes, and a numeral keeps its digits — "#1" and "1"
 * have to land in the same place or every numbered assignment in a course
 * matches every other one equally badly.
 *
 * The course code goes too, and that one is not cosmetic. An LMS prefixes
 * every entry with it — "CORE 2500 - Reflection 1" — while the syllabus title
 * never repeats it. Left in, the code and its number are two words the two
 * sides can never share, and they dragged a real match from 0.53 down to 0.40,
 * under the threshold. The course is compared separately and properly.
 */
export function words(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/\b[a-z]{2,5}\s*[-–]?\s*\d{3,5}\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w));
}

/**
 * How alike two titles are, from 0 to 1.
 *
 * Jaccard over the identifying words, with one adjustment that matters here:
 * a number appearing in both is worth more than a word appearing in both,
 * because "Reflection 1" and "Reflection 2" are the same words and different
 * assignments, and getting that pair wrong is the failure mode of the whole
 * feature.
 */
export function similarity(a: string, b: string): number {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  let sharedNumbers = 0;
  let clashingNumbers = 0;
  for (const w of left) {
    if (right.has(w)) {
      shared++;
      if (/^\d+$/.test(w)) sharedNumbers++;
    } else if (/^\d+$/.test(w) && [...right].some((r) => /^\d+$/.test(r))) {
      clashingNumbers++;
    }
  }

  const union = new Set([...left, ...right]).size;
  const base = shared / union;
  // A number on one side that is a different number on the other is close to
  // proof they are not the same thing, whatever else they share.
  if (clashingNumbers > 0) return Math.max(0, base - 0.5);
  return Math.min(1, base + sharedNumbers * 0.15);
}

/** Below this, two titles are treated as two different things. */
export const THRESHOLD = 0.45;

export interface Moved {
  item: DatedItem;
  event: FeedEvent;
  /** The date the app holds, and the one the feed holds. Both ISO. */
  was: string;
  now: string;
  /** Whole days apart, signed — positive means the feed is later. */
  days: number;
  score: number;
}

export interface Report {
  /** Same thing, different date. */
  moved: Moved[];
  /** In the app, with nothing in the feed that looks like it. */
  onlyHere: DatedItem[];
  /** In the feed, with nothing in the app that looks like it. */
  onlyThere: FeedEvent[];
  /** Matched, and the dates agree. */
  agreed: number;
}

const DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const left = new Date(ay, am - 1, ad).getTime();
  const right = new Date(by, bm - 1, bd).getTime();
  return Math.round((right - left) / DAY);
}

/**
 * Every pair, scored, best first.
 *
 * Greedy rather than optimal: the best pair is taken, both sides are struck
 * out, and it goes again. An optimal assignment would be better on paper and
 * the difference never shows up on twenty items — while greedy has the
 * property that the pairing you can see is the pairing that was made, which
 * matters more when somebody is deciding whether to trust it.
 */
export function compare(items: DatedItem[], events: FeedEvent[]): Report {
  /*
   * Only the events that name a day can be compared against one.
   *
   * `daysBetween` splits both sides on `-` and subtracts, so an event whose
   * date is not a date — a stored feed row from an older build, a reader that
   * left the field blank — made `NaN`, and the report told the student their
   * deadline had moved "NaN days earlier". A pairing that cannot say how far
   * something moved has nothing to report, so the event goes to `onlyThere`
   * with the rest of what the app does not hold, which is where a row it
   * cannot make sense of honestly belongs.
   */
  const dated = events.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

  const pairs: { i: number; e: number; score: number }[] = [];

  items.forEach((item, i) => {
    dated.forEach((event, e) => {
      // A course on both sides that disagrees is disqualifying. A course on
      // only one side is not — the feed's matcher misses plenty.
      if (item.c && event.courseId && item.c !== event.courseId) return;
      const score = similarity(item.title, event.title);
      if (score >= THRESHOLD) pairs.push({ i, e, score });
    });
  });

  pairs.sort((a, b) => b.score - a.score);

  const usedItems = new Set<number>();
  const usedEvents = new Set<number>();
  const moved: Moved[] = [];
  let agreed = 0;

  for (const pair of pairs) {
    if (usedItems.has(pair.i) || usedEvents.has(pair.e)) continue;
    usedItems.add(pair.i);
    usedEvents.add(pair.e);

    const item = items[pair.i];
    const event = dated[pair.e];
    const was = dateToIso(item.date);
    if (was === event.date) {
      agreed++;
      continue;
    }
    moved.push({
      item,
      event,
      was,
      now: event.date,
      days: daysBetween(was, event.date),
      score: pair.score,
    });
  }

  // Soonest first in both lists: a date that moved next week matters more than
  // one that moved in November, and a list sorted by score reads as arbitrary.
  moved.sort((a, b) => a.was.localeCompare(b.was));

  /** The events that found a partner, by identity rather than by index. */
  const paired = new Set([...usedEvents].map((e) => dated[e]));

  return {
    moved,
    onlyHere: items.filter((_, i) => !usedItems.has(i)),
    // Against `events` rather than `dated`, so an undated row is still listed
    // as something the feed has and the app does not, rather than vanishing.
    onlyThere: events
      .filter((e) => !paired.has(e))
      .sort((a, b) => a.date.localeCompare(b.date)),
    agreed,
  };
}

/** How a move reads in one line. The words are `lib/date.ts`. */
export function movedLine(m: Moved): string {
  return movedDays(m.days);
}

/** The headline over a report. Plain, and it says when nothing is wrong. */
export function summary(r: Report): string {
  if (r.moved.length === 0 && r.onlyThere.length === 0) {
    return r.agreed > 0
      ? `${r.agreed} matched and every date agrees.`
      : 'Nothing to compare — no deadline in the app matched anything in the feed.';
  }
  const bits: string[] = [];
  if (r.moved.length) bits.push(`${r.moved.length} moved`);
  if (r.onlyThere.length) {
    bits.push(`${r.onlyThere.length} in the feed ${r.onlyThere.length === 1 ? 'is' : 'are'} not here`);
  }
  return `${bits.join(', ')}.`;
}

/**
 * A move, as the month and day an Item stores.
 *
 * Items carry month and day rather than a date, because that is what a
 * syllabus states. The year is not stored at all — see `SEMESTER_YEAR` — so
 * this drops it, and a feed entry from the wrong year would move a deadline to
 * the same day of this one. That is a real limitation and it is why the screen
 * shows both dates in full before anything is applied.
 *
 * ## The shape is not the date
 *
 * Four digits, two, two says nothing about whether those numbers name a day.
 * "2026-04-31" matches, and the month and day it yields are stored and then
 * read back through `new Date(year, month, day)`, which rolls: 31 April is
 * drawn as 1 May, "2026-13-01" as 1 January of the *next* year, "2026-00-10"
 * as December of the last one. Not a crash — a deadline quietly somewhere
 * else, after a screen showed both dates in full and asked to be trusted.
 *
 * `lib/edit.ts` already learned this on the same value from the other end:
 * "Not `day <= 31`: the year was in the field and thrown away, so 31 April was
 * accepted and drawn as 1 May." It reaches for `realMonthDay`; so does this,
 * and the caller's "not a date this app can store" becomes true.
 */
export function asItemDate(isoDate: string): Pick<Item, 'month' | 'day'> | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (!realMonthDay(month, day)) return null;
  return { month, day };
}
