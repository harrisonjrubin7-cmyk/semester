import { describe, expect, it } from 'vitest';
import { anyAnswered, cardKey, emptyReview, type Reviews } from './review';
import { findEverything } from './find';
import ECON from '../data/courses/econ';
import { buildCatalog } from '../data/catalog';

/**
 * Nowhere says a mastery figure that nobody has earned.
 *
 * `unitMastery` blends what has been answered with what the guide declared,
 * and before the first answer in a course the blend is entirely the declared
 * figure. The Study screen stopped drawing that as measured; four other places
 * were still saying it, and three of them say it to the model rather than to a
 * person:
 *
 *   - the course context: `mastered: "68%"` per unit,
 *   - the drill context: "Drilling ECON 1020 — Monopoly, 68% mastered",
 *   - `coldest()`, which sorted units by the declared figures and named one as
 *     the coldest — behind the suggestion "explain the coldest unit as if I
 *     have not read it",
 *   - the me context: `averageMastery: "52%"`,
 *   - and a unit in the search results: "8 cards · 47% known".
 *
 * A number on a card is read by somebody who can see the rest of the card. A
 * number in the context is read by a model that will answer "what should I
 * drill first?" out of it, in a sentence with all the confidence of the rest
 * of the answer.
 */

const cat = buildCatalog([ECON]);
const course = cat.courses[0];
const guide = cat.guides[course.id]!;

/**
 * One card answered right, in the unit named — not just in the course.
 *
 * The search row is about its own unit, so that is the scope it asks about: a
 * card answered in unit 1 leaves unit 12 not started, which is both true and
 * more use than a course-wide flag would be. The contexts sent to the model
 * ask per course, because what travels there is the course.
 */
function answeredIn(unitName: string): Reviews {
  const now = Date.now();
  const unit = guide.units.find((u) => u.name === unitName) ?? guide.units[0];
  const key = cardKey(course.id, unit.cards[0].q);
  return {
    [key]: { ...emptyReview(now), right: 1, streak: 1, interval: 7, seen: now, due: now + 7 * 86_400_000 },
  };
}

/** The unit the query below matches, so the test answers the right cards. */
const MONOPOLY = guide.units.find((u) => /monopoly/i.test(u.name))!.name;

describe('the reading itself', () => {
  const keys = guide.units.flatMap((u) => u.cards.map((card) => cardKey(course.id, card.q)));

  it('is false before anything is answered', () => {
    expect(anyAnswered(keys, {})).toBe(false);
  });

  it('is true after one card', () => {
    expect(anyAnswered(keys, answeredIn(MONOPOLY))).toBe(true);
  });

  it('does not count a record that has never been answered', () => {
    // A card can have a record with `seen` at nought — that is not an answer,
    // and `neverMet` already counts it as new material.
    const untouched: Reviews = { [keys[0]]: emptyReview(Date.now()) };
    expect(anyAnswered(keys, untouched)).toBe(false);
  });
});

describe('a unit in the search results', () => {
  const subFor = (reviews: Reviews) =>
    findEverything(cat, new Date(), 'monopoly', [], [], undefined, [], reviews)
      .flatMap((g) => g.hits)
      .find((h) => h.kind === 'unit')?.sub;

  it('says not started rather than a percentage it did not measure', () => {
    // It read "9 cards · 47% known" for a unit nobody had opened. "Known" was
    // the strongest word on the row and the least earned.
    expect(subFor({})).toMatch(/cards · not started$/);
  });

  it('is still not started when the answer was in another unit', () => {
    // Per unit, not per course: the row is about this unit and says so.
    expect(subFor(answeredIn(guide.units[0].name))).toMatch(/cards · not started$/);
  });

  it('says what is known once something in it is', () => {
    expect(subFor(answeredIn(MONOPOLY))).toMatch(/cards · \d+% known$/);
  });

  it('says not started for a caller with no reviews to offer', () => {
    // The parameter is optional, and a caller that cannot say must not be made
    // to imply. Silence reads as "not started", which is the safe direction.
    expect(
      findEverything(cat, new Date(), 'monopoly', [], [])
        .flatMap((g) => g.hits)
        .find((h) => h.kind === 'unit')?.sub,
    ).toMatch(/cards · not started$/);
  });
});
