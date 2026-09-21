/**
 * What a unit's evidence actually supports, said in words rather than a
 * percentage.
 *
 * `lib/review.ts` measures: every answer is recorded against the card and
 * `unitMastery` blends those answers with the figure the guide shipped with.
 * That blend is right for what it does — it keeps a part-answered unit moving
 * by one card's worth per answer — and it is the wrong thing to *print*.
 *
 * ## Why the number is the problem
 *
 * A percentage reads as a measurement of the student. "68%" says you know
 * roughly two thirds of this unit, and nothing in the app can support that
 * sentence. What the app knows is narrower and more useful: how many of these
 * cards you have met, how many you have got right twice running, and how many
 * have come round again since. Those are counts. The percentage is the counts
 * put through a curve, mixed with an estimate somebody wrote by hand, and
 * rounded — and every one of those three steps throws away the thing a student
 * would act on.
 *
 * It also cannot be argued with. A student who is certain they know a unit has
 * nothing to do about a number that says 41, because the number does not say
 * where it came from. `why` and `forgetting` are the other half of this
 * module for exactly that reason: the state comes with the counts it was read
 * from, and the evidence can be cleared by the person it is about.
 *
 * ## The five states
 *
 * Unseen, Introduced, Practising, Retained, Needs review. They are ordered,
 * they are disjoint, and each one answers "what do I do next" without further
 * reading:
 *
 *   Unseen        nothing answered. Start it.
 *   Introduced    you have met a little of it. Keep going.
 *   Practising    you are working through it and it has not held yet.
 *   Retained      enough of it has held, and nothing has come round.
 *   Needs review  it has come round, or what you have answered you are
 *                 getting wrong.
 *
 * The order is deliberate and `RANK` publishes it, because "weakest first" is
 * a sort a dozen screens want and every one of them computing its own opinion
 * of weak is how the app ended up with two mastery figures that disagreed.
 *
 * **Not a score.** There is no "percentage retained" here and adding one would
 * undo the point. A caller that needs a bar to draw should draw `held / cards`
 * and label it as that — a count of cards, which is a thing that happened.
 */

import { cardIdentity, type CardReview, type Reviews } from './review';

/** The five states, weakest first. */
export type Knowing = 'unseen' | 'introduced' | 'practising' | 'retained' | 'review';

/**
 * The states in order, for a caller that wants to sort by them.
 *
 * `review` sits at the bottom rather than the top: it is the most urgent thing
 * to do and it is not the *least known* thing, which is what this order is
 * about. A sort that wants urgency should say so and use `urgent`.
 */
export const RANK: Record<Knowing, number> = {
  unseen: 0,
  introduced: 1,
  practising: 2,
  review: 3,
  retained: 4,
};

/**
 * Consecutive correct answers before a card counts as holding.
 *
 * Two, not one. One correct answer to a card you have just read the answer to
 * measures the last ten seconds; the second one, a day or more later, is the
 * first evidence that anything stayed. Two is also where `lib/review.ts` puts
 * the same line from the other direction — `score` graduates the interval to
 * six days at `streak === 2`, and `keepsCatching` stops calling a card a
 * problem at `streak >= 2` — so the three should not drift apart.
 */
export const HELD = 2;

/** Share of a unit's cards that must be holding before it reads as retained. */
export const KNOWN_SHARE = 0.8;

/** Share of a unit's cards that must be answered before it reads as practising. */
export const WORKING_SHARE = 1 / 3;

/**
 * Accuracy below which the evidence says review regardless of coverage.
 *
 * Applied only past `ENOUGH_ANSWERS`, because the alternative is a unit going
 * to "Needs review" on two unlucky taps — which is both wrong and the exact
 * kind of jumpy readout that gets a study app closed.
 */
export const SHAKY = 0.6;

/** Answers before accuracy is allowed to decide anything. */
export const ENOUGH_ANSWERS = 4;

/**
 * The counts a state is read from — and, on screen, the counts it is explained
 * with.
 *
 * Every field is something that happened, which is the property that makes
 * this worth passing around rather than recomputing. A screen showing the
 * state and a screen showing the reason are reading the same object, so they
 * cannot disagree.
 */
export interface Evidence {
  /** How many cards the unit holds. */
  cards: number;
  /** Distinct cards answered at least once. */
  answered: number;
  /** Every right answer ever given to these cards. */
  right: number;
  /** Every wrong one. */
  wrong: number;
  /** Cards with `HELD` or more correct answers running. */
  held: number;
  /** Answered cards whose next review has come round. */
  due: number;
  /**
   * Answered cards a full further interval past due.
   *
   * Counted apart from `due` because the two mean different things to a
   * student: a card that came round this morning is today's work, and one
   * that came round three weeks ago is evidence that the unit has gone.
   */
  lapsed: number;
  /** When one of these cards was last answered, epoch ms. Zero if never. */
  last: number;
}

const DAY = 86_400_000;

/** An empty reading, for a unit with no cards — or none the caller found. */
export function noEvidence(): Evidence {
  return { cards: 0, answered: 0, right: 0, wrong: 0, held: 0, due: 0, lapsed: 0, last: 0 };
}

/**
 * Read the evidence for a set of cards.
 *
 * `keys` are `cardIdentity` keys, the same ones `lib/review.ts` schedules
 * against. A key with no row is a card never answered: it counts toward
 * `cards` and toward nothing else, which is what makes `answered / cards`
 * coverage rather than a score.
 */
export function evidenceFor(keys: string[], reviews: Reviews, now: number): Evidence {
  const ev = noEvidence();
  ev.cards = keys.length;
  for (const key of keys) {
    const r: CardReview | undefined = reviews[key];
    if (!r || r.seen === 0) continue;
    ev.answered += 1;
    ev.right += r.right;
    ev.wrong += r.wrong;
    if (r.streak >= HELD) ev.held += 1;
    if (r.due <= now) {
      ev.due += 1;
      if (now - r.due >= Math.max(DAY, r.interval * DAY)) ev.lapsed += 1;
    }
    if (r.seen > ev.last) ev.last = r.seen;
  }
  return ev;
}

/** The same reading, for a course's cards rather than precomputed keys. */
export function evidenceForCards(
  courseId: string,
  cards: { id?: string; q: string }[],
  reviews: Reviews,
  now: number,
): Evidence {
  return evidenceFor(
    cards.map((c) => cardIdentity(courseId, c)),
    reviews,
    now,
  );
}

/** Right as a share of every answer given. Zero when none were. */
export function accuracy(ev: Evidence): number {
  const total = ev.right + ev.wrong;
  return total === 0 ? 0 : ev.right / total;
}

/**
 * Which of the five states this evidence supports.
 *
 * The branches are in order and the order is the argument. Accuracy is asked
 * first because getting things wrong outranks having covered them; holding
 * comes next because it is the only positive evidence there is; coverage comes
 * last because it is the weakest claim of the three — a card answered once is
 * not knowledge, and a state built on coverage alone would call a unit
 * practised that had been clicked through in a minute.
 *
 * A unit with no cards reads `unseen`, and that is the reason the answered
 * check comes first rather than being folded in below. `held >= cards *
 * KNOWN_SHARE` is `0 >= 0` for an empty deck, so a `knowing` that asked about
 * holding first would report an empty unit **Retained — 0 of 0 holding**. An
 * empty deck is not evidence that anything is known.
 */
export function knowing(ev: Evidence): Knowing {
  if (ev.answered === 0) return 'unseen';
  if (ev.right + ev.wrong >= ENOUGH_ANSWERS && accuracy(ev) < SHAKY) return 'review';
  if (ev.held >= ev.cards * KNOWN_SHARE) return ev.due > 0 ? 'review' : 'retained';
  if (ev.answered >= ev.cards * WORKING_SHARE) return 'practising';
  return 'introduced';
}

/** Both halves at once, for the common case. */
export function knowingOf(keys: string[], reviews: Reviews, now: number): {
  state: Knowing;
  evidence: Evidence;
} {
  const evidence = evidenceFor(keys, reviews, now);
  return { state: knowing(evidence), evidence };
}

/** What a state is called on screen. */
export function says(state: Knowing): string {
  switch (state) {
    case 'unseen':
      return 'Unseen';
    case 'introduced':
      return 'Introduced';
    case 'practising':
      return 'Practising';
    case 'retained':
      return 'Retained';
    case 'review':
      return 'Needs review';
  }
}

/**
 * The evidence behind the state, as one sentence of counts.
 *
 * Every sentence names the numbers the branch in `knowing` actually read, and
 * only those. That is the rule this is written to: a student who disagrees
 * with the state should be able to see which count they disagree with, and a
 * sentence quoting a figure the state did not depend on sends them after the
 * wrong one.
 */
export function why(ev: Evidence, state: Knowing = knowing(ev)): string {
  const cards = `${ev.cards} card${ev.cards === 1 ? '' : 's'}`;
  switch (state) {
    case 'unseen':
      return ev.cards === 0 ? 'No cards in this unit yet.' : `None of ${cards} answered yet.`;
    case 'introduced':
      return `${ev.answered} of ${cards} answered.`;
    case 'practising':
      return `${ev.answered} of ${cards} answered, ${ev.held} holding.`;
    case 'retained':
      return `${ev.held} of ${cards} holding, nothing come round.`;
    case 'review':
      // Which of the two branches sent it here, so the sentence is the reason.
      if (ev.right + ev.wrong >= ENOUGH_ANSWERS && accuracy(ev) < SHAKY) {
        return `${ev.right} right of ${ev.right + ev.wrong} answers.`;
      }
      return ev.lapsed > 0
        ? `${ev.held} of ${cards} holding, ${ev.lapsed} long overdue.`
        : `${ev.held} of ${cards} holding, ${ev.due} come round.`;
  }
}

/**
 * Whether this unit is work for today, as opposed to merely unfinished.
 *
 * `review` always is. `unseen` is not — a unit nobody has started is not late,
 * and a plan that says otherwise on the first day of term says it about every
 * unit at once.
 */
export function urgent(state: Knowing): boolean {
  return state === 'review';
}

/**
 * The keys whose evidence a reset would clear.
 *
 * Returned rather than applied, because clearing is a state change and this
 * file does not hold state. The reducer takes the list; see `forgetUnit` in
 * `state/slices/study.ts`.
 *
 * Only answered cards come back, so "Clear" on a unit with nothing recorded is
 * visibly a no-op rather than a button that pretends to have done something.
 */
export function forgetting(keys: string[], reviews: Reviews): string[] {
  return keys.filter((k) => {
    const r = reviews[k];
    return Boolean(r) && r.seen > 0;
  });
}
