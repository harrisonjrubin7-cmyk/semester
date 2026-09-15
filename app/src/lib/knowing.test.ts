import { describe, expect, it } from 'vitest';
import {
  ENOUGH_ANSWERS,
  HELD,
  KNOWN_SHARE,
  RANK,
  WORKING_SHARE,
  accuracy,
  evidenceFor,
  evidenceForCards,
  forgetting,
  knowing,
  knowingOf,
  noEvidence,
  says,
  urgent,
  why,
  type Evidence,
  type Knowing,
} from './knowing';
import { cardKey, emptyReview, score, type CardReview, type Reviews } from './review';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-15T09:00:00Z');

/** A card row, spelled out, so a test says exactly what it is testing. */
function row(over: Partial<CardReview> = {}): CardReview {
  return { ...emptyReview(NOW), seen: NOW - DAY, due: NOW + DAY, ...over };
}

/** `n` keys, `k0`…, with the rows the caller gave for the first few. */
function deck(n: number, rows: CardReview[] = []): { keys: string[]; reviews: Reviews } {
  const keys = Array.from({ length: n }, (_, i) => `k${i}`);
  const reviews: Reviews = {};
  rows.forEach((r, i) => {
    reviews[keys[i]] = r;
  });
  return { keys, reviews };
}

/** A card that is holding: `HELD` right in a row, not yet come round. */
const holding = () => row({ right: HELD, streak: HELD, interval: 6 });
/** A card met once and not since. */
const met = () => row({ right: 1, streak: 1, interval: 1 });

describe('reading the evidence', () => {
  it('counts a card with no row as held by the deck and answered by nobody', () => {
    const { keys, reviews } = deck(4);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev).toEqual({ ...noEvidence(), cards: 4 });
  });

  it('ignores a row that exists but was never answered', () => {
    // `emptyReview` writes a row with `seen: 0`. Counting it as answered was
    // the bug that made a card the app had merely *scheduled* look studied.
    const { keys, reviews } = deck(3, [emptyReview(NOW)]);
    expect(evidenceFor(keys, reviews, NOW).answered).toBe(0);
  });

  it('adds up rights, wrongs and the holding count', () => {
    const { keys, reviews } = deck(3, [
      row({ right: 3, wrong: 1, streak: HELD }),
      row({ right: 1, wrong: 2, streak: 0 }),
    ]);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.cards).toBe(3);
    expect(ev.answered).toBe(2);
    expect(ev.right).toBe(4);
    expect(ev.wrong).toBe(3);
    expect(ev.held).toBe(1);
  });

  it('takes the most recent answer as `last`', () => {
    const { keys, reviews } = deck(2, [
      row({ seen: NOW - 5 * DAY, right: 1 }),
      row({ seen: NOW - DAY, right: 1 }),
    ]);
    expect(evidenceFor(keys, reviews, NOW).last).toBe(NOW - DAY);
  });

  it('counts a card as due the moment its time has come, not after', () => {
    const { keys, reviews } = deck(2, [row({ right: 1, due: NOW }), row({ right: 1, due: NOW + 1 })]);
    expect(evidenceFor(keys, reviews, NOW).due).toBe(1);
  });

  it('separates a card that is late from one that is merely due', () => {
    // Overdue by less than one further interval: due, not lapsed.
    const fresh = row({ right: 1, interval: 10, due: NOW - 2 * DAY });
    // Overdue by more than its own interval again: lapsed.
    const gone = row({ right: 1, interval: 10, due: NOW - 20 * DAY });
    const { keys, reviews } = deck(2, [fresh, gone]);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.due).toBe(2);
    expect(ev.lapsed).toBe(1);
  });

  it('gives a short-interval card a floor of a day before it counts as lapsed', () => {
    // interval 0 — a card answered wrong and due again in minutes. Without the
    // `Math.max(DAY, …)` floor every such card would read "long overdue" the
    // instant it came round, which is the opposite of what lapsed means.
    const { keys, reviews } = deck(1, [row({ right: 0, wrong: 1, interval: 0, due: NOW - 60_000 })]);
    expect(evidenceFor(keys, reviews, NOW).lapsed).toBe(0);
    expect(evidenceFor(keys, reviews, NOW + DAY).lapsed).toBe(1);
  });

  it('reads a course by its questions the same way it reads keys', () => {
    const qs = ['What is a deadweight loss?', 'Define elasticity'];
    const reviews: Reviews = { [cardKey('econ', qs[0])]: row({ right: 2, streak: 2 }) };
    const ev = evidenceForCards('econ', qs, reviews, NOW);
    expect(ev.cards).toBe(2);
    expect(ev.answered).toBe(1);
    expect(ev.held).toBe(1);
  });

  it('reports accuracy over answers given, and zero when none were', () => {
    expect(accuracy({ ...noEvidence(), right: 3, wrong: 1 })).toBe(0.75);
    expect(accuracy(noEvidence())).toBe(0);
  });
});

describe('the five states', () => {
  it('calls an untouched unit unseen', () => {
    const { keys, reviews } = deck(10);
    expect(knowingOf(keys, reviews, NOW).state).toBe('unseen');
  });

  it('calls an empty unit unseen rather than retained', () => {
    // `held >= cards * KNOWN_SHARE` is 0 >= 0 for an empty deck, so asking
    // about holding before asking about answers reads "Retained — 0 of 0
    // holding" on a unit with nothing in it. This is what pins the order.
    expect(knowing(noEvidence())).toBe('unseen');
  });

  it('calls a barely-started unit introduced', () => {
    const { keys, reviews } = deck(12, [met()]);
    expect(knowingOf(keys, reviews, NOW).state).toBe('introduced');
  });

  it('calls a unit practising once enough of it has been answered', () => {
    // Four of twelve is a third exactly — the share, not past it.
    const { keys, reviews } = deck(12, [met(), met(), met(), met()]);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.answered / ev.cards).toBe(WORKING_SHARE);
    expect(knowing(ev)).toBe('practising');
  });

  it('holds the line one card below the working share', () => {
    const { keys, reviews } = deck(12, [met(), met(), met()]);
    expect(knowingOf(keys, reviews, NOW).state).toBe('introduced');
  });

  it('calls a unit retained when enough holds and nothing has come round', () => {
    const rows = Array.from({ length: 8 }, holding);
    const { keys, reviews } = deck(10, rows);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.held / ev.cards).toBe(KNOWN_SHARE);
    expect(knowing(ev)).toBe('retained');
  });

  it('does not call a unit retained on one card short of the share', () => {
    const { keys, reviews } = deck(10, Array.from({ length: 7 }, holding));
    expect(knowingOf(keys, reviews, NOW).state).toBe('practising');
  });

  it('sends a retained unit to review the moment one card comes round', () => {
    const rows = Array.from({ length: 8 }, holding);
    rows[0] = row({ right: HELD, streak: HELD, interval: 6, due: NOW - DAY });
    const { keys, reviews } = deck(10, rows);
    expect(knowingOf(keys, reviews, NOW).state).toBe('review');
  });

  it('sends a unit to review on accuracy however well it is covered', () => {
    // Eight of ten answered and holding by streak, but two right in ten
    // answers. Coverage must not outrank getting things wrong.
    const rows = Array.from({ length: 8 }, () => row({ right: 1, wrong: 4, streak: HELD }));
    const { keys, reviews } = deck(10, rows);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(accuracy(ev)).toBeLessThan(0.6);
    expect(knowing(ev)).toBe('review');
  });

  it('does not let two unlucky answers decide anything', () => {
    // Both wrong — 0% — but under `ENOUGH_ANSWERS`, so coverage still speaks.
    const { keys, reviews } = deck(3, [row({ wrong: 1 }), row({ wrong: 1 })]);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.right + ev.wrong).toBeLessThan(ENOUGH_ANSWERS);
    expect(knowing(ev)).toBe('practising');
  });

  it('lets the accuracy floor speak as soon as there are enough answers', () => {
    const { keys, reviews } = deck(3, [row({ right: 1, wrong: 3 })]);
    const ev = evidenceFor(keys, reviews, NOW);
    expect(ev.right + ev.wrong).toBe(ENOUGH_ANSWERS);
    expect(knowing(ev)).toBe('review');
  });

  it('orders the states weakest first, with retained last', () => {
    const order: Knowing[] = ['unseen', 'introduced', 'practising', 'review', 'retained'];
    expect([...order].sort((a, b) => RANK[a] - RANK[b])).toEqual(order);
  });

  it('calls only review urgent', () => {
    const all: Knowing[] = ['unseen', 'introduced', 'practising', 'retained', 'review'];
    expect(all.filter(urgent)).toEqual(['review']);
  });
});

describe('the sentence under the state', () => {
  const states: Knowing[] = ['unseen', 'introduced', 'practising', 'retained', 'review'];

  it('names every state', () => {
    expect(states.map(says)).toEqual([
      'Unseen',
      'Introduced',
      'Practising',
      'Retained',
      'Needs review',
    ]);
  });

  it('quotes the count the accuracy branch actually read', () => {
    const ev: Evidence = { ...noEvidence(), cards: 10, answered: 8, right: 2, wrong: 8, held: 8 };
    expect(knowing(ev)).toBe('review');
    expect(why(ev)).toBe('2 right of 10 answers.');
  });

  it('quotes come-round rather than accuracy when that is what sent it', () => {
    const ev: Evidence = { ...noEvidence(), cards: 10, answered: 8, right: 16, held: 8, due: 3 };
    expect(knowing(ev)).toBe('review');
    expect(why(ev)).toBe('8 of 10 cards holding, 3 come round.');
  });

  it('says long overdue when cards have properly lapsed', () => {
    const ev: Evidence = {
      ...noEvidence(),
      cards: 10,
      answered: 8,
      right: 16,
      held: 8,
      due: 3,
      lapsed: 2,
    };
    expect(why(ev)).toBe('8 of 10 cards holding, 2 long overdue.');
  });

  it('distinguishes a unit with no cards from one with cards nobody opened', () => {
    expect(why(noEvidence())).toBe('No cards in this unit yet.');
    expect(why({ ...noEvidence(), cards: 9 })).toBe('None of 9 cards answered yet.');
  });

  it('says card rather than cards for a unit of one', () => {
    expect(why({ ...noEvidence(), cards: 1 })).toBe('None of 1 card answered yet.');
  });

  it('gives a sentence for every state, with no empties', () => {
    for (const state of states) {
      const sentence = why(noEvidence(), state);
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence.endsWith('.')).toBe(true);
    }
  });
});

describe('clearing a unit', () => {
  it('returns only the cards that actually carry evidence', () => {
    const { keys, reviews } = deck(4, [row({ right: 1 }), emptyReview(NOW)]);
    expect(forgetting(keys, reviews)).toEqual(['k0']);
  });

  it('returns nothing for a unit nobody has answered, so Clear cannot lie', () => {
    const { keys, reviews } = deck(5);
    expect(forgetting(keys, reviews)).toEqual([]);
  });

  it('takes a unit back to unseen once its keys are dropped', () => {
    const { keys, reviews } = deck(3, [holding(), holding(), holding()]);
    expect(knowingOf(keys, reviews, NOW).state).toBe('retained');
    const left = { ...reviews };
    for (const k of forgetting(keys, reviews)) delete left[k];
    expect(knowingOf(keys, left, NOW).state).toBe('unseen');
  });
});

describe('against the scheduler it reads', () => {
  // Not a mock: these drive `score` from `lib/review.ts`, so a change to the
  // scheduler that moves what a streak means shows up here rather than in a
  // number nobody re-checks.
  it('walks a card from unseen to retained on real answers', () => {
    const keys = ['k0'];
    let reviews: Reviews = {};
    expect(knowingOf(keys, reviews, NOW).state).toBe('unseen');

    // One card, answered: the whole unit is covered, so it is practising
    // rather than introduced. `introduced` is what partial coverage reads as,
    // and a deck of one has no partial.
    reviews = { k0: score(undefined, true, NOW) };
    expect(knowingOf(keys, reviews, NOW).state).toBe('practising');

    // A day later, right again: streak 2, interval 6 days, nothing due.
    reviews = { k0: score(reviews.k0, true, NOW + DAY) };
    expect(knowingOf(keys, reviews, NOW + DAY).state).toBe('retained');

    // Seven days on, the card has come round.
    expect(knowingOf(keys, reviews, NOW + 8 * DAY).state).toBe('review');
  });

  it('drops a card out of holding when it is missed', () => {
    const keys = ['k0'];
    let reviews: Reviews = { k0: score(score(undefined, true, NOW), true, NOW + DAY) };
    expect(evidenceFor(keys, reviews, NOW + DAY).held).toBe(1);
    reviews = { k0: score(reviews.k0, false, NOW + 8 * DAY) };
    expect(evidenceFor(keys, reviews, NOW + 8 * DAY).held).toBe(0);
  });
});
