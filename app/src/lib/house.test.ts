import { describe as it_, expect, it } from 'vitest';
import { describe as houseOf, styleFor } from './house';
import BUS from '../data/courses/bus';
import type { Guide, StudyCard } from './types';

/**
 * Whether a new card would stand out among the ones already there.
 *
 * This is the step the brief calls most likely to be skipped, and skipping it
 * is invisible in a test that only checks something was produced — which is
 * why what is checked here is the description itself: that it measures the
 * real course, that it says nothing when there is nothing to measure, and
 * that it never quietly invents a house style for a course that has none.
 *
 * Run against the real BUS 1600 guide rather than a fixture. A house style
 * derived from a fixture is a house style for the fixture.
 */

const card = (q: string, a: string): StudyCard => ({ q, a });

const guideOf = (cards: StudyCard[], names = ['One', 'Two']): Guide => ({
  code: 'X 100',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: names.map((name, i) => ({
    name,
    mastery: 0,
    cards: cards.filter((_, n) => n % names.length === i),
  })),
  terms: [],
});

it_('a course with material to imitate', () => {
  it('measures the real guide rather than a template', () => {
    const house = houseOf(BUS.guide);
    expect(house.from).toBe(10);
    expect(house.rules.some((r) => /Answers in this course run about \d+ characters/.test(r))).toBe(true);
  });

  it('notices that this course numbers its units', () => {
    // "Conjoint analysis" dropped into a guide of "7 · Segmentation" reads as
    // an intruder, and the numbering is the tell.
    const house = houseOf(BUS.guide);
    expect(house.rules.join(' ')).toMatch(/Units are numbered/);
  });

  it('claims a habit only when the course really has it', () => {
    /*
     * Five of the ten sampled BUS 1600 answers attach a qualification with an
     * em dash, and four address the student as "you". So the em dash is a
     * habit of this course and the second person is not quite — which is the
     * measurement doing its job rather than a rule somebody assumed. Written
     * down because it is the kind of thing that would otherwise be "fixed" by
     * lowering the threshold until both fired.
     */
    const rules = houseOf(BUS.guide).rules.join(' ');
    expect(rules).toMatch(/em dash/);
    expect(rules).not.toMatch(/addresses the student as "you"/);
  });

  it('samples from across the guide, not all from one unit', () => {
    /*
     * Ten cards from the first unit teach the shape of that unit. The point is
     * the course, so the sample is drawn round-robin.
     */
    const house = houseOf(BUS.guide);
    const firstUnitCards = BUS.guide.units[0].cards.map((c) => c.q);
    const sampled = house.samples.split('\n').filter((l) => l.startsWith('Q: ')).map((l) => l.slice(3));
    const fromFirst = sampled.filter((q) => firstUnitCards.includes(q)).length;
    expect(sampled.length).toBeGreaterThan(5);
    expect(fromFirst).toBeLessThan(sampled.length);
  });

  it('puts the real cards in front of the generator, not a description of them', () => {
    // Everything no measurement catches — the em dashes, the habit of ending
    // on what costs marks — only survives as the cards themselves.
    const style = styleFor(houseOf(BUS.guide));
    expect(style).toContain('Q: ');
    expect(style).toContain('A: ');
    expect(style).toMatch(/would not stand out among them/);
  });
});

it_('a course with nothing to imitate', () => {
  it('says nothing rather than measuring four accidents', () => {
    const thin = houseOf(guideOf([card('q1', 'a1'), card('q2', 'a2'), card('q3', 'a3')]));
    expect(thin.from).toBe(3);
    expect(thin.rules).toEqual([]);
    expect(thin.samples).toBe('');
  });

  it('falls back to the app’s own voice, stated rather than assumed', () => {
    // A course with nothing to sample still needs telling not to write like a
    // brochure.
    const style = styleFor(houseOf(guideOf([])));
    expect(style).toMatch(/plain, direct, second person/);
    expect(style).toMatch(/no exclamation marks/);
    expect(style).not.toContain('Q: ');
  });

  it('counts material added since the import as this course’s material too', () => {
    // After a term of imports it is most of it.
    const bare = guideOf([]);
    const withAdded = houseOf(bare, [
      {
        id: 'u1',
        courseId: 'x',
        unit: null,
        title: 'Session 7',
        source: '',
        body: '',
        cards: Array.from({ length: 8 }, (_, i) => card(`What is ${i}?`, `Because of ${i}, at length.`)),
        terms: [],
        fileIds: [],
        created: 0,
      },
    ]);
    expect(withAdded.from).toBe(8);
    expect(withAdded.rules.length).toBeGreaterThan(0);
  });
});

it_('what it says about phrasing', () => {
  const many = (make: (i: number) => StudyCard) => guideOf(Array.from({ length: 10 }, (_, i) => make(i)));

  it('says so when fronts are questions', () => {
    const house = houseOf(many((i) => card(`What is ${i}?`, `An answer about ${i} of some length.`)));
    expect(house.rules.join(' ')).toMatch(/written as questions/);
  });

  it('says so when fronts are terms rather than questions', () => {
    const house = houseOf(many((i) => card(`Term ${i}`, `An answer about ${i} of some length.`)));
    expect(house.rules.join(' ')).toMatch(/short prompts or terms/);
  });

  it('does not claim a habit the course does not have', () => {
    const plain = houseOf(many((i) => card(`Term ${i}`, `A plain answer about ${i}.`)));
    expect(plain.rules.join(' ')).not.toMatch(/em dash/);
    expect(plain.rules.join(' ')).not.toMatch(/as "you"/);
  });
});
