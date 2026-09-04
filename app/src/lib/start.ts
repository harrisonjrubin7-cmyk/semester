/**
 * When something has to *begin*.
 *
 * Every deadline in this app is an end date, and almost no student
 * procrastination is a forgotten deadline. It is a missing start date: the
 * paper due on the 30th is perfectly well known about on the 12th, and nothing
 * anywhere says that a ten-hour paper and four hours of evenings a week means
 * the 12th *is* the day.
 *
 * The app has both halves already — every due date, and an estimate of how
 * long that kind of work takes this student — and has never put them together.
 *
 * ## Backwards through the hours that exist
 *
 * Not "due date minus three days". The runway is walked back a day at a time
 * through the student's own work windows, taking whatever each day actually
 * offers, until the estimate is covered. A Tuesday with two free hours and a
 * Saturday with six are not the same day and a fixed lead time treats them as
 * though they were.
 *
 * ## It refuses where it cannot know
 *
 * Work the app has never timed gets no start date. Not a default, not an
 * average of other kinds — nothing, and it is counted separately so a quiet
 * list is never quiet because the app could not see. A made-up start date is
 * worse than none: it is the one number in the app somebody would arrange
 * their fortnight around.
 *
 * ## The first action, which is the other half of starting
 *
 * "Opera Philadelphia case, 30% of the grade" is paralysing and "read the case
 * and list what it is actually asking" is not. The openers here are generic by
 * kind and say so — they are prompts to get a person into the document, not
 * claims about the assignment, which the app has not read.
 */

import type { DatedItem } from './types';
import { estimate, type Spent } from './pace';
import { hoursOn, WAKING_HOURS, type Window } from './windows';
import { corrected, type Calibration } from './worth';

/**
 * The share of a day's working hours any one piece of work may claim.
 *
 * A student with four hours on a Tuesday does not spend all four on one paper;
 * they have three other courses. Half is a deliberate under-claim — the effect
 * of getting it wrong in this direction is starting earlier than strictly
 * necessary, and in the other direction it is a start date that was never
 * achievable.
 */
export const SHARE = 0.5;

/** How far back a runway is walked before giving up. A term, not a year. */
export const FURTHEST = 120;

export interface Start {
  id: string;
  title: string;
  courseId: string;
  kind: string;
  daysAway: number;
  /** Minutes it is likely to take, calibrated. Null when never timed. */
  minutes: number | null;
  /** Days before the deadline it needs to begin. Null without an estimate. */
  runway: number | null;
  /** `YYYY-MM-DD` to begin. Empty without an estimate. */
  startOn: string;
  /** True when that day is today. */
  today: boolean;
  /** True when the day to begin has already gone. */
  late: boolean;
  /** A generic opener for this kind of work. Never a claim about this item. */
  first: string;
  says: string;
}

/**
 * Openers by kind.
 *
 * Generic on purpose, and the screen says so. The app has not read the
 * assignment and an opener invented for it would be a confident guess about
 * somebody's coursework; what these are is a way out of a blank page, which is
 * the actual problem.
 */
const OPENERS: [RegExp, string][] = [
  [/problem set|pset|homework/i, 'Do question 1. Not all of it — question 1.'],
  [/quiz/i, 'Skim the material once and write down the three things you would ask about.'],
  [/exam|midterm|final|test/i, 'List every topic on it from the syllabus. That list is the plan.'],
  [/essay|paper|memo/i, 'Write the question you are answering in one sentence. If you cannot, that is the first task.'],
  [/read/i, 'Read the first and last paragraphs and the section headings, then start properly.'],
  [/case/i, 'Read the case once without notes and write down what it is actually asking.'],
  [/present|deck|slides/i, 'Write the one sentence each slide has to earn. Slides after that.'],
  [/reflect|response|journal|discussion/i, 'Write the worst possible first paragraph. It is faster to fix than to start.'],
  [/lab/i, 'Read the procedure through before touching anything.'],
  [/project|group/i, 'Write down who is doing what and when they hand it over.'],
];

export function opener(kind: string, title: string): string {
  const text = `${kind} ${title}`;
  for (const [re, said] of OPENERS) if (re.test(text)) return said;
  return 'Open it and write one line. Starting badly beats not starting.';
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Hours a given weekday actually offers this piece of work.
 *
 * From the student's own windows where they set any, and a plain waking day
 * where they have not — which is stated on screen rather than passed off as a
 * measurement.
 */
export function hoursFor(windows: Window[], weekday: number): number {
  const day = windows.length > 0 ? hoursOn(windows, weekday) : WAKING_HOURS;
  return Math.max(0, day * SHARE);
}

/**
 * The day to begin, walked back through the days that exist.
 *
 * Returns null where nothing can be estimated. Never a fallback: a made-up
 * start date is the one number somebody would arrange a fortnight around.
 */
export function startFor(
  due: Date,
  minutes: number,
  windows: Window[],
): { on: Date; runway: number } | null {
  if (!(minutes > 0)) return null;
  let left = minutes / 60;
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  for (let back = 0; back <= FURTHEST; back++) {
    const hours = hoursFor(windows, day.getDay());
    left -= hours;
    if (left <= 0) return { on: new Date(day), runway: back };
    day.setDate(day.getDate() - 1);
  }
  // More work than a term of windows holds. Real, and worth saying rather than
  // silently returning the earliest day.
  return null;
}

export interface StartInput {
  items: DatedItem[];
  done: Record<string, boolean>;
  spent: Spent[];
  windows: Window[];
  now: Date;
  /** How wrong your own guesses have been, from `lib/worth.ts`. Optional. */
  bias?: Calibration | null;
  /** How far ahead to look. */
  horizon?: number;
}

export interface Plan {
  starts: Start[];
  /** Pieces of work with no estimate, and so no start date. */
  unweighed: number;
  /** Pieces whose start date has already gone. */
  late: number;
}

/**
 * Every dated thing ahead, with the day it has to begin.
 *
 * Sorted by that day rather than by the deadline, which is the whole point: a
 * ten-hour paper due in three weeks starts before a two-hour problem set due
 * on Friday, and a list ordered by deadline says the opposite.
 */
export function plan(input: StartInput): Plan {
  const { items, done, spent, windows, now, bias = null, horizon = 60 } = input;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const starts: Start[] = [];
  let unweighed = 0;

  for (const i of items) {
    if (done[i.id] || i.daysAway < 0 || i.daysAway > horizon) continue;
    const e = estimate(spent, i.c, i.kind);
    const minutes = e.minutes > 0 ? corrected(e.minutes, bias) : null;
    const first = opener(i.kind, i.title);

    if (minutes === null) {
      unweighed += 1;
      starts.push({
        id: i.id,
        title: i.title,
        courseId: i.c,
        kind: i.kind,
        daysAway: i.daysAway,
        minutes: null,
        runway: null,
        startOn: '',
        today: false,
        late: false,
        first,
        says: 'Never timed, so there is no start date. Time it once and there will be.',
      });
      continue;
    }

    const found = startFor(i.date, minutes, windows);
    if (!found) {
      starts.push({
        id: i.id,
        title: i.title,
        courseId: i.c,
        kind: i.kind,
        daysAway: i.daysAway,
        minutes,
        runway: null,
        startOn: '',
        today: false,
        late: true,
        first,
        says: 'More hours than your windows hold between now and then. Something has to give, and it is not arithmetic.',
      });
      continue;
    }

    const startOn = iso(found.on);
    const isToday = startOn === iso(today);
    const gone = found.on < today;
    starts.push({
      id: i.id,
      title: i.title,
      courseId: i.c,
      kind: i.kind,
      daysAway: i.daysAway,
      minutes,
      runway: found.runway,
      startOn,
      today: isToday,
      late: gone,
      first,
      says: gone
        ? `Should have begun ${daysSince(found.on, today)} ${daysSince(found.on, today) === 1 ? 'day' : 'days'} ago, on your own hours.`
        : isToday
          ? 'Today, on your own hours.'
          : `Begin in ${daysSince(today, found.on)} ${daysSince(today, found.on) === 1 ? 'day' : 'days'}.`,
    });
  }

  starts.sort((a, b) => {
    // Anything unstarted and already late first, then by start date, then by
    // deadline. Ordering by deadline is the mistake this file exists to fix.
    if (a.late !== b.late) return a.late ? -1 : 1;
    if (a.startOn && b.startOn && a.startOn !== b.startOn) return a.startOn < b.startOn ? -1 : 1;
    if (!a.startOn && b.startOn) return 1;
    if (a.startOn && !b.startOn) return -1;
    return a.daysAway - b.daysAway;
  });

  return { starts, unweighed, late: starts.filter((s) => s.late).length };
}

function daysSince(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** What has to begin today or is already overdue to begin. */
export function beginNow(p: Plan): Start[] {
  return p.starts.filter((s) => s.late || s.today);
}

/**
 * The headline.
 *
 * Says what it could not weigh, in the same sentence, because a short list is
 * otherwise indistinguishable from a light fortnight.
 */
export function planLine(p: Plan, windows: Window[]): string {
  const now = beginNow(p);
  const basis =
    windows.length === 0
      ? ' Worked out against a plain waking day, because you have not set your working hours.'
      : '';

  if (p.starts.length === 0) return 'Nothing dated ahead to plan backwards from.';
  if (now.length === 0) {
    const head = `Nothing has to begin today.${basis}`;
    return p.unweighed > 0
      ? `${head} ${p.unweighed} ${p.unweighed === 1 ? 'thing has' : 'things have'} never been timed, so ${p.unweighed === 1 ? 'it has' : 'they have'} no start date.`
      : head;
  }
  const late = now.filter((s) => s.late).length;
  const head =
    late > 0
      ? `${now.length} to begin, and ${late} of ${late === 1 ? 'them was' : 'them were'} due to start already.`
      : `${now.length} ${now.length === 1 ? 'thing begins' : 'things begin'} today.`;
  return p.unweighed > 0 ? `${head} ${p.unweighed} more could not be timed.${basis}` : `${head}${basis}`;
}
