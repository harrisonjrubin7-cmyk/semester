import { describe, expect, it } from 'vitest';
import BUS from '../data/courses/bus';
import CORE from '../data/courses/core';
import ECON from '../data/courses/econ';
import PSCI from '../data/courses/psci';
import { allCards } from '../data/catalog';
import { evidenceForCards } from './knowing';
import { cardIdentity, cardKey, emptyReview, tallyBy, type Reviews } from './review';
import type { CourseModule, StudyCard } from './types';

/**
 * A card's history survives its question being reworded.
 *
 * It did not. `cardKey` hashed the question and nothing else, so a typo fixed
 * in a guide, a sentence tightened, or a question rewritten to ask the same
 * thing read to the app as a brand new card — and the row holding what the
 * student knew about the old one became something nothing would ever look up
 * again. Silently: no message, and the mastery figure simply falls back to the
 * estimate the guide shipped with.
 *
 * The argument for the old behaviour is in the commit and is not silly — a
 * materially different question does deserve to be re-learned. What it leaves
 * out is that the app cannot tell a rewrite from a rewording, and answers both
 * with the harsher of the two.
 *
 * ## What this file is really guarding
 *
 * Not the fix, which is four lines. The **absence of a migration**: every id
 * on the 325 shipped cards was minted as the hash `cardKey` already returned
 * for that card's question, so no review row anybody has stored moves. That
 * held at 325 of 325 when the ids were written, and it is the reason this
 * could land without touching stored state at all.
 *
 * It decays on purpose. The first time a shipped question is reworded its id
 * will stop matching the hash of its text — which is the whole point, and why
 * that measurement is a number in the commit message rather than an assertion
 * here. What is asserted is what must stay true afterwards.
 */

const MODULES: CourseModule[] = [BUS, CORE, ECON, PSCI];
const everyCard = (m: CourseModule): StudyCard[] => [
  ...m.guide.units.flatMap((u) => u.cards),
  ...(m.guide.selfTest ?? []),
];

describe('the ids the shipped guides carry', () => {
  it('is one per card, on all 325, with none left to fall back on its question', () => {
    // A card written without an id is not an error — it keeps exactly the old
    // behaviour — which is why nothing else would ever notice one. This is the
    // only thing standing between "the fallback is there for material a
    // student adds" and "the fallback is what the guides quietly use".
    const cards = MODULES.flatMap(everyCard);
    expect(cards).toHaveLength(325);
    expect(cards.filter((c) => !c.id)).toEqual([]);
  });

  it('gives two cards the same id only where they are the same question', () => {
    // The failure this change made newly possible. A copy-pasted id on two
    // different questions merges two students' worth of history into one row,
    // and reads as a perfectly ordinary line of data.
    //
    // Five questions across the four guides are deliberately written twice —
    // once in the unit that teaches the thing and again in the guide's own
    // self-test — and those pairs share an id because they share a row. That
    // is the only reason a duplicate id is allowed at all.
    for (const m of MODULES) {
      const byId = new Map<string, Set<string>>();
      for (const c of everyCard(m)) {
        if (!c.id) continue;
        (byId.get(c.id) ?? byId.set(c.id, new Set()).get(c.id)!).add(c.q);
      }
      const merged = [...byId].filter(([, questions]) => questions.size > 1);
      expect(merged).toEqual([]);
    }
  });
});

describe('cardIdentity', () => {
  const card: StudyCard = { id: 'k7z', q: 'Define opportunity cost.', a: 'The next best alternative.' };

  it('holds a card still while its question is rewritten from end to end', () => {
    const reworded = { ...card, q: 'In your own words, what does an economist mean by opportunity cost?' };
    expect(cardIdentity('econ', reworded)).toBe(cardIdentity('econ', card));
    expect(cardIdentity('econ', card)).toBe('econ:k7z');
  });

  it('control: a card with no id is still its question, exactly as before', () => {
    // The fallback is not a leftover. Material a student pastes in has no id
    // to give it, and this says that path is untouched rather than quietly
    // rekeyed — which would be a migration nobody asked for.
    const plain = { q: card.q, a: card.a };
    expect(cardIdentity('econ', plain)).toBe(cardKey('econ', card.q));
    expect(cardIdentity('econ', { ...plain, q: 'Reworded.' })).not.toBe(cardIdentity('econ', plain));
  });

  it('control: the same id under a different course is a different card', () => {
    expect(cardIdentity('econ', card)).not.toBe(cardIdentity('bus', card));
  });
});

describe('what a reworded question costs, end to end', () => {
  const NOW = 1_788_000_000_000;
  const first = ECON.guide.units[0].cards[0];
  const answered = (key: string): Reviews => ({
    [key]: { ...emptyReview(NOW), right: 6, streak: 3, seen: NOW, due: NOW + 86_400_000 },
  });

  it('keeps the evidence when a real shipped card is reworded', () => {
    const reviews = answered(cardIdentity('econ', first));
    const reworded = { ...first, q: `${first.q} (rewritten for clarity)` };
    const ev = evidenceForCards('econ', [reworded], reviews, NOW);
    expect(ev.answered).toBe(1);
    expect(ev.right).toBe(6);
  });

  it('control: the same rewording with the id stripped loses all of it', () => {
    // The old behaviour, run on purpose. Six right answers become a card the
    // app has never seen, and nothing anywhere says so.
    const reviews = answered(cardIdentity('econ', first));
    const { id: _id, ...noId } = first;
    const ev = evidenceForCards('econ', [{ ...noId, q: `${first.q} (rewritten for clarity)` }], reviews, NOW);
    expect(ev.answered).toBe(0);
    expect(ev.right).toBe(0);
  });

  it('tallies a reworded card to its course, where questions alone could not', () => {
    // `tallyBy` took question strings until this change and so could not ask
    // `cardIdentity` anything. A course whose guide had been edited would have
    // tallied zero on the term report while the drill went on scheduling the
    // card normally — the two halves of the app disagreeing about what a card
    // is.
    const reviews: Reviews = {
      [cardIdentity('econ', first)]: {
        ...emptyReview(NOW), right: 4, wrong: 1, seen: NOW, due: NOW,
      },
    };
    const reworded = { ...first, q: 'Something else entirely.' };
    expect(tallyBy(reviews, [{ courseId: 'econ', cards: [reworded] }])).toEqual({
      econ: { right: 4, wrong: 1 },
    });
  });
});

describe('the whole-guide deck', () => {
  it('still holds each card once', () => {
    const deck = allCards(ECON.guide);
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
    expect(deck).toHaveLength(67);
  });

  it('collapses a repeat whose two halves no longer read alike', () => {
    // The case that makes this a guard rather than a restatement. ECON's
    // self-test asks one of its units' questions a second time, and the two
    // entries share a review row. Collapsing on the question text agrees with
    // collapsing on the id for exactly as long as the two texts match — so
    // reword one half, as a guide edit eventually will, and a dedupe keyed on
    // text deals the same card twice in one sitting, the second time already
    // answered.
    const repeat = ECON.guide.selfTest?.find((s) =>
      ECON.guide.units.some((u) => u.cards.some((c) => c.id === s.id)),
    );
    expect(repeat).toBeDefined();
    const edited = {
      ...ECON.guide,
      selfTest: ECON.guide.selfTest?.map((c) =>
        c.id === repeat!.id ? { ...c, q: `${c.q} (rewritten for the self-test)` } : c,
      ),
    };
    const deck = allCards(edited);
    expect(deck.filter((c) => c.id === repeat!.id)).toHaveLength(1);
    expect(deck).toHaveLength(67);
  });
});
