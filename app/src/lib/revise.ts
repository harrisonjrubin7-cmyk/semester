/**
 * What to revise, in the time you actually have.
 *
 * The Revise tab used to be four rows — the weakest unit in each course, one
 * per course, with a number of minutes read off the course module. Three
 * things were wrong with that, and none of them was cosmetic:
 *
 *  1. **It ignored the review schedule.** Every answer is recorded and
 *     scheduled by `lib/review.ts`, so at any moment the app knows exactly
 *     which cards have come round. The plan did not look. A card you missed
 *     last night and a card you have never met were the same to it.
 *  2. **It ignored the calendar.** A unit at 30% in a course with an exam on
 *     Thursday and a unit at 30% in a course with an exam in November ranked
 *     identically, so the ordering was alphabetical by accident.
 *  3. **It could not be sized.** "Tonight's 25 minutes" was 25 minutes whether
 *     you had ten before a shift or an hour before bed, and the minutes shown
 *     were a fixed string in the course module rather than a count of the work
 *     in front of you.
 *
 * So this file ranks every unit in the catalogue against each other, says in a
 * sentence why each one is where it is, and fills whatever budget it is given
 * — which is the whole difference between a plan and a list.
 *
 * ## What it will not do
 *
 * It will not invent precision. A stretch's minutes are cards multiplied by
 * {@link SECONDS_PER_CARD}, stated as "about", and a sitting that runs long is
 * a sitting you stop — the schedule survives being interrupted, because every
 * card is scheduled on its own and nothing depends on finishing a run.
 */

import type { Reviews } from './review';
import { strength } from './review';

/** How long one card takes, end to end: read, try to remember, judge yourself. */
export const SECONDS_PER_CARD = 20;

/** Under this, a stretch is not worth switching courses for. */
export const MIN_STRETCH_MINUTES = 4;

/** An exam this far out or nearer bends the ranking toward its course. */
export const EXAM_HORIZON_DAYS = 14;

export interface UnitFacts {
  courseId: string;
  code: string;
  /** Index into the live guide's units — what `startDrill` needs. */
  index: number;
  name: string;
  /** Mastery as the live guide computes it, 0–100. */
  mastery: number;
  /** Every card key in the unit, in guide order. */
  keys: string[];
  /** Days until this course's next test, or null if it has none scheduled. */
  testInDays: number | null;
  /** What that test is — "quiz", "midterm", "exam". Calling a quiz an exam is a lie the plan does not need to tell. */
  testKind: string | null;
}

export interface Stretch extends UnitFacts {
  /** Cards in the unit whose review has come round, or that are unseen. */
  due: number;
  /** Cards in the unit, whatever their state. */
  cards: number;
  /** About how long the due cards take. Never zero for a stretch worth doing. */
  minutes: number;
  /**
   * Cards this stretch is actually about — the due ones, or a short pass over
   * a unit with nothing due.
   *
   * Carried rather than re-derived from `minutes`, because minutes are rounded
   * and the round trip does not come back: four cards is one minute, and one
   * minute is three cards.
   */
  cardsToDo: number;
  /** Where this ranks. Higher is more worth doing now. Not shown to anyone. */
  score: number;
  /** Why it is here, in the second person, short enough for one line. */
  why: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Cards whose review has come round — or that have never been answered. */
export function dueIn(keys: string[], reviews: Reviews, now: number): number {
  return keys.filter((k) => {
    const r = reviews[k];
    return !r || r.seen === 0 || r.due <= now;
  }).length;
}

/**
 * How much a test in the calendar should bend the ranking.
 *
 * Flat 1 beyond the horizon, rising to 2.5 the day before. Deliberately not
 * unbounded: an exam tomorrow should dominate the order, but a student with
 * two exams in one week still needs the second course to appear.
 */
export function testWeight(days: number | null): number {
  if (days === null || days > EXAM_HORIZON_DAYS) return 1;
  const near = clamp((EXAM_HORIZON_DAYS - Math.max(days, 0)) / EXAM_HORIZON_DAYS, 0, 1);
  return 1 + near * 1.5;
}

/**
 * How overdue a unit's cards are, 0–1.
 *
 * A card six weeks past its date is worth more than one that came round this
 * morning, and `strength` already decays with lateness — so the gap between
 * what a card should be worth and what it is worth is the measure.
 */
function staleness(keys: string[], reviews: Reviews, now: number): number {
  const seen = keys.map((k) => reviews[k]).filter((r) => r && r.seen > 0);
  if (seen.length === 0) return 0;
  const lost = seen.reduce((sum, r) => sum + (1 - strength(r, now)), 0);
  return lost / seen.length;
}

/**
 * One line saying why this unit is in the plan.
 *
 * A plan with no reasons is an instruction, and the student is the one who
 * knows whether the reason holds — they were in the lecture.
 */
export function reasonFor(s: UnitFacts & { due: number; cards: number }): string {
  const parts: string[] = [];
  if (s.testInDays !== null && s.testInDays <= EXAM_HORIZON_DAYS) {
    const what = (s.testKind ?? 'exam').toLowerCase();
    parts.push(
      s.testInDays <= 0
        ? `${what} today`
        : `${what} in ${s.testInDays} ${s.testInDays === 1 ? 'day' : 'days'}`,
    );
  }
  if (s.due === s.cards && s.cards > 0) parts.push(`all ${s.cards} cards waiting`);
  else if (s.due > 0) parts.push(`${s.due} of ${s.cards} cards due`);
  if (s.mastery < 40) parts.push(`${s.mastery}% mastered`);
  else if (parts.length === 0) parts.push(`${s.mastery}% mastered — keeping it warm`);
  // Sentence case, and the parts read as one clause rather than a list of tags.
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * Every unit worth an evening, best first.
 *
 * The score is four things multiplied rather than added, because they are not
 * independent: cold material in a course being examined on Thursday is not
 * "cold plus soon", it is the thing to do tonight.
 */
export function rank(units: UnitFacts[], reviews: Reviews, now: number): Stretch[] {
  return units
    .filter((u) => u.keys.length > 0)
    .map((u) => {
      const due = dueIn(u.keys, reviews, now);
      const cards = u.keys.length;
      // What the sitting is actually about. A unit with nothing due is still
      // revisable — that is what "keeping it warm" means — but it is a
      // shorter sitting than one with the whole deck waiting.
      const working = due > 0 ? due : Math.min(cards, 10);
      const cold = clamp((100 - u.mastery) / 100, 0.1, 1);
      const waiting = clamp(due / Math.max(cards, 1), 0, 1);
      const late = staleness(u.keys, reviews, now);
      const score = cold * (0.35 + waiting) * (1 + late) * testWeight(u.testInDays);
      const facts = { ...u, due, cards };
      return {
        ...facts,
        minutes: Math.max(1, Math.round((working * SECONDS_PER_CARD) / 60)),
        cardsToDo: working,
        score,
        why: reasonFor(facts),
      };
    })
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
}

/**
 * The sitting itself: the best stretches that fit in the time available.
 *
 * Two rules beyond "take the best ones". Courses are served round by round, so
 * every course gets a unit before any course gets a second — an evening spent
 * entirely inside one course is a course-shaped evening, and escaping that is
 * the point of ranking across the catalogue at all. And nothing is started
 * with less than {@link MIN_STRETCH_MINUTES} left: the cost of picking up a
 * new unit is real, and four minutes of it is worse than four more minutes of
 * the one you are already in.
 *
 * The budget is a ceiling, never a quota. When the ranking runs out first the
 * plan is short and the screen says so; padding an evening with units that
 * did not need doing is how a plan stops being worth reading.
 */
export function planFor(
  ranked: Stretch[],
  budgetMinutes: number,
  /** One course only, when the student has said so. */
  courseId: string | null = null,
): Stretch[] {
  const pool = courseId ? ranked.filter((s) => s.courseId === courseId) : ranked;
  const out: Stretch[] = [];
  const used = new Set<string>();
  let left = budgetMinutes;

  // Round by round, best first, one unit per course per round. Everything
  // gets a turn before anything gets a second one — an hour is four courses
  // twice over rather than one course eight times — and the rounds keep going
  // until the time is spent or the ranking runs out.
  for (let guard = 0; guard < 64 && left >= MIN_STRETCH_MINUTES; guard += 1) {
    const servedThisRound = new Set<string>();
    let took = 0;
    for (const s of pool) {
      if (left < MIN_STRETCH_MINUTES) break;
      const id = `${s.courseId}-${s.index}`;
      if (used.has(id)) continue;
      if (!courseId && servedThisRound.has(s.courseId)) continue;
      servedThisRound.add(s.courseId);
      used.add(id);
      // The last stretch is trimmed to what is left rather than dropped: told
      // "nine minutes on unit 4" you do nine minutes and stop, which is how
      // spaced review is supposed to work.
      out.push(
        s.minutes <= left
          ? s
          : // Trimmed to the time left, and the card count trimmed with it —
            // a stretch that says nine minutes and forty cards is lying about
            // one of them.
            { ...s, minutes: left, cardsToDo: Math.round((left * 60) / SECONDS_PER_CARD) },
      );
      left -= Math.min(s.minutes, left);
      took += 1;
    }
    if (took === 0) break;
  }

  return out;
}

/** Minutes and cards a plan adds up to, for the line above it. */
export function planTotals(plan: Stretch[]): { minutes: number; cards: number } {
  return {
    minutes: plan.reduce((n, s) => n + s.minutes, 0),
    cards: plan.reduce((n, s) => n + s.cardsToDo, 0),
  };
}

/**
 * What has been done today, for the line under the plan.
 *
 * A review records only when a card was last answered, so this counts cards
 * touched today rather than answers given — the same card drilled twice this
 * evening is one card. Said that way on screen, because the difference matters
 * to somebody checking whether they have done their reviewing.
 */
export function doneToday(reviews: Reviews, now: Date): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Object.values(reviews).filter((r) => r.seen >= start && r.seen <= now.getTime()).length;
}
