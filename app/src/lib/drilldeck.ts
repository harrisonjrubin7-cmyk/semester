import type { CourseModule, Guide } from './types';
import { allCards, unitCards, type DeckCard } from '../data/catalog';
import { cardKey, dueFirst, type Reviews } from './review';
import { interleave } from './interleave';

/**
 * The deck a drill deals, and the one place that decides what is in it.
 *
 * Lifted out of `screens/Drill`'s memo unchanged, because the ordering is
 * testable and the screen is not: what a run puts in front of somebody is the
 * whole behaviour, and it was only ever checkable by rendering the screen and
 * pressing through it. The memo now calls these two and keeps the part that is
 * genuinely React — when to rebuild, which is the answer to a different
 * question and documented there.
 */

export interface DrillCard extends DeckCard {
  /** `cardKey(courseId, q)` — the card's identity to the review system. */
  key: string;
  courseId: string;
}

const keyed = (cards: DeckCard[], courseId: string): DrillCard[] =>
  cards.map((c) => ({ ...c, key: cardKey(courseId, c.q), courseId }));

/**
 * One guide's deck: the whole guide, or one unit of it.
 *
 * `unit` is an index into `guide.units`, `-1` the guide's own self-test, and
 * `null` everything. The whole-guide deck comes from `allCards`, which holds
 * each card once; a scoped one comes from that unit's own cards rather than
 * from the whole list filtered by `ui`.
 *
 * The two differ on exactly the questions a self-test recaps from a unit.
 * Filtering would have deducted those from whichever side lost the tie — the
 * self-test dealing eight of CORE's ten — where a unit's own list has no
 * repeat in it and needs no collapsing. See `allCards` in `data/catalog` for
 * why the whole-guide deck does.
 */
export function guideDeck(
  guide: Guide,
  courseId: string,
  unit: number | null,
  reviews: Reviews,
  now: number,
): DrillCard[] {
  const cards = unit === null ? allCards(guide) : unitCards(guide, unit);
  return dueFirst(keyed(cards, courseId), reviews, now);
}

/**
 * The mixed deck: every course at once, interleaved.
 *
 * Mixing pulls from the whole catalogue rather than from one guide.
 * Interleaving within a single guide would be a different word for shuffling
 * units — the result it is named for is about having to work out *which kind*
 * of question this is, and two units of one course are not different kinds. So
 * the unit filter is dropped here, because a unit belongs to one course by
 * definition.
 */
export function mixedDeck(modules: CourseModule[], reviews: Reviews, now: number): DrillCard[] {
  const every = modules.flatMap((m) => keyed(allCards(m.guide), m.course.id));
  return interleave(dueFirst(every, reviews, now), (c) => c.courseId);
}
