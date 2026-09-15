import { describe, expect, it } from 'vitest';
import { allCards, buildCatalog } from '../data/catalog';
import econ from '../data/courses/econ';
import psci from '../data/courses/psci';
import core from '../data/courses/core';
import bus from '../data/courses/bus';
import { cardKey, score, type Reviews } from './review';
import { HORIZON, TESTS, inTime, missingCount, roomBefore, testsNear } from './intime';

/**
 * The census: what the scheduler does about a test, on the four decks that
 * ship with the app.
 *
 * Every figure here is measured rather than argued, and the design decision it
 * settled is in `intime.ts`'s header — whether a stranded card's last look
 * goes on the eve of the test with every other stranded card, or is dealt
 * across the days that are left.
 *
 * ## The controls come first, and they are the point
 *
 * The first version of this census reported that **every card in every deck**
 * would miss its test: 68 of 68, 107 of 107, four decks for four. That is what
 * a real finding looks like and it is also exactly what a broken probe looks
 * like, and it was the probe — it answered every card right on every day, so
 * all 325 cards went down one identical trajectory and arrived at one
 * identical due date.
 *
 * So the controls below run first. They establish that this measurement can
 * report zero: for a course with no test near, for a student who has not
 * studied, and for a card whose own schedule already fits. A census that
 * cannot come back empty is not measuring anything.
 */

const DAY = 86_400_000;
const MODULES = [econ, psci, core, bus];
const CAT = buildCatalog(MODULES);

/**
 * A deterministic coin, so a census is the same census on every run.
 *
 * Seeded off the card key and the day rather than `Math.random`: a figure in a
 * commit message has to be one somebody else can reproduce.
 */
function coin(key: string, day: number): number {
  let h = 0x811c9dc5 ^ day;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * A student who revised across the term and then stopped.
 *
 * The window matters and took two attempts to get right. A fortnight of
 * revision only reaches a sixteen-day interval — three right answers, 1 then 6
 * then 16 — and sixteen days is short enough that the card comes back on its
 * own well before the test. Nothing is stranded, and the census reported zero
 * for all four decks, which is a measurement of the simulation rather than of
 * the app.
 *
 * It is the *fourth* right answer that does the damage: it puts the card away
 * for forty-five days. So this revises from `from` days before the test until
 * `until` days before it — a term's work, finishing before the run-up begins,
 * which is the ordinary shape of a midterm on material covered in the first
 * month.
 *
 * Not a perfect student: roughly one answer in six is missed and one in five is
 * a right answer they say they guessed at, which is what `lib/sure.ts` reads.
 * That is the *pessimistic* direction here — a missed card stays on a short
 * interval and cannot be stranded, so every miss removes a card from the count
 * this exists to establish.
 */
function revised(
  courseId: string,
  questions: string[],
  testAt: number,
  from: number,
  until: number,
): Reviews {
  const reviews: Reviews = {};
  for (let day = from; day > until; day -= 1) {
    const now = testAt - day * DAY;
    for (const q of questions) {
      const key = cardKey(courseId, q);
      const r = reviews[key];
      // Only what has come round, which is what the drill deals.
      if (r && r.due > now) continue;
      const c = coin(key, day);
      reviews[key] = score(r, c >= 0.17, now, c >= 0.17 && c < 0.37);
    }
  }
  return reviews;
}

interface Seen {
  code: string;
  kind: string;
  cards: number;
  missed: number;
  /** Days of run-up left to deal into, counting today. */
  room: number;
  /** How many last looks land on each day before the test. */
  perDay: number[];
}

/**
 * The distinct cards of a guide.
 *
 * `allCards` used to return what the guide *wrote*, and each shipped guide's
 * self-test recaps a question or two from its units — so the deck that said
 * "68 cards" had 67 distinct `cardKey`s. Counting the list rather than the set
 * made this census report 31 stranded cards where `inTime` dealt 30, and one
 * day of the histogram hold three where the dealer can only put two. A third
 * probe in this change that was wrong before it was right.
 *
 * That duplication is fixed at the source now: `allCards` collapses the recap,
 * so this set takes nothing out. It stays because it says the thing this
 * census depends on — a measurement of the scheduler counts cards, and a card
 * is a key — rather than because `allCards` cannot be trusted to.
 */
function deckKeys(m: (typeof MODULES)[number]): string[] {
  return [...new Set(allCards(m.guide).map((c) => cardKey(m.course.id, c.q)))];
}

function look(m: (typeof MODULES)[number], quiet: number): Seen | null {
  const qs = allCards(m.guide).map((c) => c.q);
  const keys = deckKeys(m);
  const firstTest = CAT.items.find((i) => i.c === m.course.id && TESTS.has(i.kind));
  if (!firstTest || qs.length === 0) return null;
  const at = new Date(firstTest.year ?? 2026, firstTest.month, firstTest.day).getTime();
  // Standing at the moment the test comes inside the horizon.
  const now = at - HORIZON * DAY;

  const tests = testsNear(CAT, new Date(now));
  const test = tests[m.course.id];
  if (!test) return null;

  // A term's revision, finishing `quiet` days before the test.
  const reviews = revised(m.course.id, qs, at, quiet + 60, quiet);
  const missed = missingCount(keys, reviews, test);
  const fixed = inTime(reviews, tests, now);

  const perDay: number[] = [];
  for (const k of keys) {
    if (fixed[k]?.due === reviews[k]?.due) continue;
    const d = Math.round((test.at - fixed[k].due) / DAY);
    perDay[d] = (perDay[d] ?? 0) + 1;
  }
  return { code: m.course.code, kind: test.kind, cards: keys.length, missed, room: roomBefore(test, now), perDay };
}

describe('the controls: this measurement can report nothing', () => {
  it('finds nothing to do for a course whose test is beyond the horizon', () => {
    const m = econ;
    const qs = allCards(m.guide).map((c) => c.q);
    const first = CAT.items.find((i) => i.c === m.course.id && TESTS.has(i.kind))!;
    const at = new Date(first.year ?? 2026, first.month, first.day).getTime();
    // Standing far enough back that the test is outside `HORIZON`.
    const now = at - (HORIZON + 30) * DAY;
    const reviews = revised(m.course.id, qs, at, HORIZON + 67, HORIZON + 7);
    const tests = testsNear(CAT, new Date(now));
    expect(tests[m.course.id]).toBeUndefined();
    // The identical object, not an equal one: a screen memoises on this.
    expect(inTime(reviews, tests, now)).toBe(reviews);
  });

  it('finds nothing to do for a student who has not studied', () => {
    const first = CAT.items.find((i) => i.c === 'econ' && TESTS.has(i.kind))!;
    const at = new Date(first.year ?? 2026, first.month, first.day).getTime();
    const now = at - 10 * DAY;
    const tests = testsNear(CAT, new Date(now));
    expect(tests.econ).toBeDefined();
    expect(inTime({}, tests, now)).toEqual({});
    expect(missingCount(deckKeys(econ), {}, tests.econ)).toBe(0);
  });

  it('leaves a card whose own schedule already fits exactly where it was', () => {
    const first = CAT.items.find((i) => i.c === 'econ' && TESTS.has(i.kind))!;
    const at = new Date(first.year ?? 2026, first.month, first.day).getTime();
    const now = at - 10 * DAY;
    const tests = testsNear(CAT, new Date(now));
    const key = cardKey('econ', allCards(econ.guide)[0].q);
    // Due in two days, with a test ten days off. Nothing to fix.
    const reviews: Reviews = {
      [key]: { right: 3, wrong: 0, streak: 3, ease: 2.6, interval: 2, seen: now, due: now + 2 * DAY },
    };
    expect(missingCount([key], reviews, tests.econ)).toBe(0);
    expect(inTime(reviews, tests, now)).toBe(reviews);
  });
});

describe('what a test does to the schedule, on the shipped decks', () => {
  /*
   * The finding, in one number per deck. A student revising daily for a
   * fortnight, getting most of them right, is dropped by the scheduler on
   * three cards in four — because only a *right* answer earns a sixteen-day
   * interval, and sixteen days is longer than the exam is away.
   */
  it('drops part of a revised deck before the test, and not all of it', () => {
    /*
     * The finding, in one number per deck. The cards at risk are the ones the
     * student knows *best*: only a fourth consecutive right answer earns the
     * forty-five-day interval that outruns an exam three weeks out, so this
     * drops the work somebody did well and keeps the work they struggled
     * with — which is precisely backwards.
     *
     * Bounded on both sides deliberately. "All of them" is what a broken probe
     * says, and this file's first version said exactly that.
     */
    const rows = MODULES.map((m) => look(m, HORIZON + 7)).filter((r): r is Seen => r !== null);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.missed, r.code).toBeGreaterThan(0);
      expect(r.missed, r.code).toBeLessThan(r.cards);
    }
    // And together they are a real slice of the four decks, not a rounding
    // error: the figure quoted for this change.
    const missed = rows.reduce((n, r) => n + r.missed, 0);
    const cards = rows.reduce((n, r) => n + r.cards, 0);
    // 320 cards across the four decks. The guides write 325 questions: five
    // are asked once in a unit and again in that guide's self-test, and
    // `allCards` deals each card once. See `deckKeys`.
    expect(cards).toBe(320);
    expect(missed).toBeGreaterThan(cards * 0.1);
  });

  it('brings every one of them back, dealt as thinly as the days allow', () => {
    for (const quiet of [HORIZON + 3, HORIZON + 10, HORIZON + 24]) {
      for (const m of MODULES) {
        const r = look(m, quiet);
        if (!r) continue;
        const placed = r.perDay.reduce((n, x) => n + (x ?? 0), 0);
        expect(placed, `${r.code} quiet ${quiet}d`).toBe(r.missed);

        /*
         * Dealt out, not piled up. With fewer cards than days every day that
         * gets one gets exactly one; with more, they divide as evenly as
         * whole cards can. The eve-only rule put 87% on a single evening and
         * the strength-ranked rule 45 of 52 — see this module's header.
         */
        const slots = r.room + 1;
        const days = r.perDay.filter((n) => n > 0).length;
        expect(days, `${r.code} quiet ${quiet}d spread`).toBe(Math.min(r.missed, slots));
        const worst = Math.max(...r.perDay.filter((n) => n > 0));
        expect(worst, `${r.code} quiet ${quiet}d heaviest day`).toBeLessThanOrEqual(
          Math.ceil(r.missed / slots),
        );
      }
    }
  });

  it('never schedules a last look on or after the test itself', () => {
    for (const m of MODULES) {
      const r = look(m, HORIZON + 7);
      if (!r) continue;
      // Index 0 is the day of the test; nothing may land there.
      expect(r.perDay[0] ?? 0, r.code).toBe(0);
    }
  });

});
