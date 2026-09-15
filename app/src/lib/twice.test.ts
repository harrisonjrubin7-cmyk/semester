import { describe, expect, it } from 'vitest';
import { allCards, unitCards } from '../data/catalog';
import { loadSeed } from '../data/seed';
import { guideDeck, mixedDeck } from './drilldeck';
import { aSitting, cardKey, comeRound, dueCount, emptyReview, neverMet, tallyBy, tallyKeys } from './review';
import type { Guide } from './types';

/**
 * One question, one card, however many places the guide writes it.
 *
 * A guide's self-test recaps: it re-asks a question or two from the units in
 * its own words, and all four shipped guides do it — five questions across
 * them, ECON's moral-hazard one, PSCI's four hurdles, CORE's chessboard and
 * ACTN3, BUS's Blockbuster. That is how the source is written and the guide
 * should keep reading that way.
 *
 * A deck cannot. `cardKey` hashes the question and nothing else, so the two
 * entries are one card with one review row, and dealing both meant the same
 * question came round twice in one sitting — the second time already answered,
 * because answering the first had written the row they share. That is the part
 * a student sees, so it is the part pinned down here, against the decks the
 * drill screen actually builds (`lib/drilldeck`, which is that memo) and the
 * guides it actually ships, rather than against a fixture and a copy of the
 * code under test.
 */

const T0 = Date.UTC(2026, 8, 15, 9, 0, 0);
const NO_ANSWERS = {};

const keysOf = (cards: { key: string }[]) => cards.map((c) => c.key);

const repeated = (keys: string[]) => {
  const seen = new Set<string>();
  return keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
};

describe('the shipped guides, drilled', () => {
  it('never deals one card twice in a sitting', async () => {
    const modules = await loadSeed();
    expect(modules.length).toBeGreaterThan(0);

    for (const m of modules) {
      const deck = guideDeck(m.guide, m.course.id, null, NO_ANSWERS, T0);
      // The whole deck, and the twenty-five a sitting actually hands over.
      expect(repeated(keysOf(deck)), `${m.course.code}: whole deck`).toEqual([]);
      expect(repeated(keysOf(aSitting(deck).cards)), `${m.course.code}: one sitting`).toEqual([]);
    }

    const mixed = mixedDeck(modules, NO_ANSWERS, T0);
    expect(repeated(keysOf(mixed)), 'mixed deck').toEqual([]);
    expect(repeated(keysOf(aSitting(mixed).cards)), 'mixed sitting').toEqual([]);
  });

  /*
   * The other half of the same fix, and the one a blanket de-duplication would
   * have broken: the field guide drills the self-test with a button of its own
   * that prints `guide.selfTest.length`. Had the scoped deck been the collapsed
   * list filtered by `ui`, CORE's would have dealt eight cards under a button
   * saying ten — trading a visible repeat for a silent deletion.
   */
  it('still deals every unit, and every self-test, in full', async () => {
    for (const m of await loadSeed()) {
      m.guide.units.forEach((u, ui) => {
        expect(
          guideDeck(m.guide, m.course.id, ui, NO_ANSWERS, T0).map((c) => c.q).sort(),
          `${m.course.code} unit ${ui}`,
        ).toEqual(u.cards.map((c) => c.q).sort());
      });
      const self = m.guide.selfTest ?? [];
      expect(
        guideDeck(m.guide, m.course.id, -1, NO_ANSWERS, T0).map((c) => c.q).sort(),
        `${m.course.code} self-test`,
      ).toEqual(self.map((c) => c.q).sort());
      expect(guideDeck(m.guide, m.course.id, -1, NO_ANSWERS, T0)).toHaveLength(self.length);
    }
  });

  /*
   * Which repeats are allowed, stated rather than assumed.
   *
   * A self-test that re-asks a unit's question is a recap and the source's
   * decision. Two *units* carrying the same question is not — it is the
   * editing slip this looks like from the outside, and the one nobody has
   * argued for. Distinguishing them is the whole reason the counting
   * de-duplicates instead of the data being trimmed, so it is checked.
   */
  it('repeats a question only between a unit and the self-test', async () => {
    for (const m of await loadSeed()) {
      const inUnits = new Map<string, number[]>();
      m.guide.units.forEach((u, ui) => {
        for (const c of u.cards) inUnits.set(c.q, [...(inUnits.get(c.q) ?? []), ui]);
      });
      for (const [q, where] of inUnits) {
        expect(where, `${m.course.code}: "${q}" is in units ${where.join(' and ')}`).toHaveLength(1);
      }
    }
  });
});

describe('allCards', () => {
  const guide = (): Guide =>
    ({
      code: 'TEST 100',
      name: 'A course',
      blurb: '',
      source: '',
      mastery: 0,
      audio: false,
      units: [
        { name: '1 · First', mastery: 0, cards: [{ q: 'Shared question?', a: 'The unit says this.' }] },
        { name: '2 · Second', mastery: 0, cards: [{ q: 'Only here?', a: 'Yes.' }] },
      ],
      selfTest: [
        { q: 'Shared question?', a: 'The self-test says it another way.' },
        { q: 'Asked out loud only?', a: 'Also yes.' },
      ],
      terms: [],
    }) as Guide;

  it('keeps the unit’s copy of a question the self-test recaps', () => {
    const cards = allCards(guide());
    expect(cards.map((c) => c.q)).toEqual(['Shared question?', 'Only here?', 'Asked out loud only?']);

    // The unit's, not the self-test's: it is where the card is taught, and the
    // unit name is what a drill prints under the question.
    const shared = cards.find((c) => c.q === 'Shared question?');
    expect(shared).toMatchObject({ unit: '1 · First', ui: 0, a: 'The unit says this.' });
  });

  it('leaves the self-test itself untouched', () => {
    const g = guide();
    // The field guide renders `guide.selfTest`, so the recap's own wording is
    // still read — it is only the deck that holds one of the two.
    expect(g.selfTest).toHaveLength(2);
    expect(unitCards(g, -1).map((c) => c.a)).toEqual([
      'The self-test says it another way.',
      'Also yes.',
    ]);
  });

  it('collapses a question two units both carry', () => {
    const g = guide();
    g.units[1].cards.push({ q: 'Shared question?', a: 'And unit two says this.' });
    expect(allCards(g).filter((c) => c.q === 'Shared question?')).toHaveLength(1);
  });
});

describe('the counts, given a key twice', () => {
  const KEY = cardKey('econ', 'Shared question?');
  const OTHER = cardKey('econ', 'Only here?');

  it('reads it once', () => {
    const answered = { ...emptyReview(T0), right: 3, wrong: 1, seen: T0 - 1, due: T0 - 1 };
    const reviews = { [KEY]: answered };
    const twice = [KEY, KEY, OTHER];

    // One card come round, one never met — not two and one.
    expect(comeRound(twice, reviews, T0)).toBe(1);
    expect(neverMet(twice, reviews)).toBe(1);
    expect(dueCount(twice, reviews, T0)).toBe(2);

    const t = tallyKeys(twice, reviews);
    expect(t).toMatchObject({ cards: 1, right: 3, wrong: 1 });

    expect(tallyBy(reviews, [{ courseId: 'econ', questions: ['Shared question?', 'Shared question?'] }]))
      .toEqual({ econ: { right: 3, wrong: 1 } });
  });
});
