import { describe, expect, it } from 'vitest';
import { allCards, buildCatalog } from '../data/catalog';
import econ from '../data/courses/econ';
import { cardKey, comeRound, score, type Reviews } from './review';
import { A_SITTING, aSitting } from './review';
import { HORIZON, TESTS, inTime, testsNear } from './intime';

/**
 * The rollout: the twenty evenings before an exam, one at a time.
 *
 * This file exists because the census does not answer the question. A census
 * is a **snapshot** — it asks what the schedule looks like from one evening —
 * and `inTime` recomputes from `now` on every render, so a snapshot cannot see
 * what happens when the same student opens the app again tomorrow.
 *
 * Two faults hid in exactly that gap, and both of them made the feature
 * useless while every other test passed:
 *
 *  - **The room was counted in elapsed milliseconds.** `Math.floor((eve - now)
 *    / DAY)` is one day short whenever the clock is past midnight, so the
 *    earliest slot always landed later today or tomorrow and nothing ever
 *    became due. The set was simply re-dealt the next day, one day shorter,
 *    until the room ran out and everything fell on the eve at once: nineteen
 *    evenings of nothing, then 68 cards, of which a sitting can deal 25.
 *  - **The guarantee had no end.** A forced look updates `seen`, the card's
 *    own interval sends it further out than ever, and it is stranded again
 *    tomorrow. The set never shrank, and the eve pile-up came back by a
 *    different road — 209 answers dealt for a 68-card deck.
 *
 * What it walks is one course, because the fault is about days rather than
 * breadth, and the shipped ECON deck against its own midterm is a real
 * semester rather than a fixture.
 */

const DAY = 86_400_000;
const CAT = buildCatalog([econ]);

/** The distinct cards of the deck. A no-op since `allCards` collapses a self-test's recap; see `deckKeys` in `intime.census.test.ts` for why it is still written this way. */
const QS = [...new Set(allCards(econ.guide).map((c) => c.q))];
const KEYS = QS.map((q) => cardKey('econ', q));

function examAt(): number {
  const first = CAT.items.find((i) => i.c === 'econ' && TESTS.has(i.kind));
  if (!first) throw new Error('the shipped ECON deck has no test in it');
  return new Date(first.year ?? 2026, first.month, first.day).getTime();
}

/**
 * A deck revised earlier in the term and then left.
 *
 * Four right answers is the shape that does the damage: 1 day, 6, 16, then
 * **45**. Nothing about a forty-five-day interval is wrong — it is what the
 * card has earned — and nothing in SM-2 knows that the exam is in three weeks.
 */
function putAway(at: number): Reviews {
  const reviews: Reviews = {};
  for (const q of QS) {
    let r;
    for (const back of [44, 43, 37, 30]) r = score(r, true, at - back * DAY);
    reviews[cardKey('econ', q)] = r!;
  }
  return reviews;
}

/** One evening: what is due, and the student drilling up to a sitting of it. */
function evening(reviews: Reviews, at: number, daysOut: number) {
  // Mid-evening, which is when this screen is actually opened — and the hour
  // that made the millisecond arithmetic wrong.
  const now = at - daysOut * DAY + 19 * 3600_000;
  const tests = testsNear(CAT, new Date(now));
  const sched = inTime(reviews, tests, now);
  const due = comeRound(KEYS, sched, now);
  const ready = aSitting(KEYS.filter((k) => sched[k].due <= now).map((key) => ({ key }))).cards;
  const next = { ...reviews };
  for (const c of ready) next[c.key] = score(reviews[c.key], true, now);
  return { due, drilled: ready.length, reviews: next };
}

describe('the twenty evenings before the exam', () => {
  it('puts some of the deck up every evening, rather than all of it on one', () => {
    const at = examAt();
    let reviews = putAway(at);
    const perEvening: number[] = [];
    // Down to the eve. The day of the exam is its own test below: by then
    // every card has had its look and nothing should be up.
    for (let d = HORIZON - 1; d >= 1; d -= 1) {
      const e = evening(reviews, at, d);
      perEvening.push(e.due);
      reviews = e.reviews;
    }

    // Every evening has something, and no evening has a deck-sized pile.
    for (const [i, n] of perEvening.entries()) {
      expect(n, `evening ${i}`).toBeGreaterThan(0);
      expect(n, `evening ${i}`).toBeLessThanOrEqual(A_SITTING);
    }
    // And the heaviest is within reach of the lightest: the eve-only rule put
    // 68 on one evening against 0 on the other nineteen.
    const worst = Math.max(...perEvening);
    expect(worst).toBeLessThan(KEYS.length / 4);
  });

  it('gets through the whole deck, and asks for each card once', () => {
    const at = examAt();
    let reviews = putAway(at);
    let drilled = 0;
    for (let d = HORIZON - 1; d >= 1; d -= 1) {
      const e = evening(reviews, at, d);
      drilled += e.drilled;
      reviews = e.reviews;
    }
    /*
     * Exactly the deck, no more. Fewer would mean cards still stranded on the
     * morning of the exam; more would mean the guarantee re-forcing cards it
     * had already delivered, which is the loop that produced 209 for a
     * 67-card deck.
     */
    expect(drilled).toBe(KEYS.length);
  });

  it('leaves nothing for the morning of the exam', () => {
    const at = examAt();
    let reviews = putAway(at);
    for (let d = HORIZON - 1; d >= 1; d -= 1) reviews = evening(reviews, at, d).reviews;
    // Every card has had its look; the day itself is for the exam.
    const now = at + 8 * 3600_000;
    const sched = inTime(reviews, testsNear(CAT, new Date(now)), now);
    expect(comeRound(KEYS, sched, now)).toBe(0);
  });

  it('does nothing at all for a student whose cards were never put away', () => {
    /*
     * The control. Somebody drilling every day already has short intervals
     * and is in no danger of being dropped, so this must not touch them — a
     * fortnight of identical counts with and without.
     */
    const at = examAt();
    const reviews: Reviews = {};
    for (const q of QS) {
      let r;
      for (const back of [4, 3, 1]) r = score(r, true, at - back * DAY);
      reviews[cardKey('econ', q)] = r!;
    }
    for (let d = HORIZON - 1; d >= 1; d -= 1) {
      const now = at - d * DAY + 19 * 3600_000;
      const tests = testsNear(CAT, new Date(now));
      expect(inTime(reviews, tests, now), `evening ${d}`).toBe(reviews);
    }
  });
});
