import { describe, expect, it } from 'vitest';
import { assemble, shapeFor, type Piece, type Where } from './harvest';
import { intakeText, type Intake } from './intake';
import type { Kind } from './classify';

/**
 * What the model says, turned into the shapes the app already holds.
 *
 * `harvest()` asks the model; `assemble()` is everything that happens to the
 * answer, and it is the half worth testing — the checking, the shaping and the
 * refusing. A stub's reply proves nothing about a prompt, but it proves
 * everything about whether a quote that is not in the file can reach a card
 * that a student will revise from.
 */

const MATERIAL = `Slide 1
Conjoint analysis
Session 7 — Marketing Management

Slide 2
Buyers do not rank features. They trade them off.
A study of 240 laptop buyers found price outweighed screen size four to one.

Slide 3
Segmentation follows from the trade-offs, not from demographics.`;

const source: Intake = intakeText(MATERIAL) as Intake;
const withPages: Intake = {
  ...source,
  name: 'Session 7 slides.pptx',
  pages: [
    { page: 1, text: 'Conjoint analysis' },
    { page: 2, text: 'Buyers do not rank features.' },
    { page: 3, text: 'Segmentation follows' },
  ],
};

const base = (as: Kind = 'slides'): Omit<Where, 'page'> => ({
  source: withPages.name,
  sourceHash: withPages.hash,
  as,
  at: 1_760_000_000_000,
});

const run = (reply: object, item: Intake = withPages, as: Kind = 'slides') =>
  assemble(reply, item, base(as));

const only = <T extends Piece['what']>(pieces: Piece[], what: T) =>
  pieces.filter((p): p is Extract<Piece, { what: T }> => p.what === what);

describe('the word-for-word rule', () => {
  it('keeps a quote that is really in the material', () => {
    const out = run({
      cards: [
        {
          q: 'What did the laptop study find?',
          a: 'Price outweighed screen size four to one, across 240 buyers.',
          quote: 'price outweighed screen size four to one',
        },
      ],
    });
    expect(only(out.pieces, 'card')[0].quote).toBeTruthy();
    expect(out.dropped).toEqual([]);
  });

  it('drops a quote that is not, and keeps the card', () => {
    /*
     * The failure this exists to stop. A card is allowed to be the app's own
     * prose; it is not allowed to be dressed as the source's words when it is
     * not — the app prints a quote as the material's own, and a student
     * checking it against the file finds nothing there.
     */
    const out = run({
      cards: [
        {
          q: 'What did the study find?',
          a: 'Price mattered most.',
          quote: 'price was the single dominant factor in every segment',
        },
      ],
    });
    const card = only(out.pieces, 'card')[0];
    expect(card).toBeTruthy();
    expect(card.quote).toBeUndefined();
    expect(out.dropped).toHaveLength(1);
    expect(out.dropped[0]).toContain('single dominant factor');
  });

  it('names what it dropped rather than swallowing it', () => {
    const out = run({ items: [{ title: 'Midterm', month: 9, day: 30, quote: 'not in the file' }] });
    expect(out.dropped[0]).toMatch(/Midterm/);
  });

  it('compares the way cite.ts does, so punctuation does not fail a real quote', () => {
    // A model re-typing a quote with a curly apostrophe or a different dash is
    // quoting correctly; failing it would drop true quotes and teach nobody
    // anything.
    const text = intakeText('The buyers’ trade-off — measured over 240 people.') as Intake;
    const out = assemble(
      { cards: [{ q: 'q', a: 'a', quote: "The buyers' trade-off - measured over 240 people." }] },
      text,
      base(),
    );
    expect(only(out.pieces, 'card')[0].quote).toBeTruthy();
    expect(out.dropped).toEqual([]);
  });
});

describe('page numbers', () => {
  it('carries a slide number the material really has', () => {
    const out = run({ cards: [{ q: 'q', a: 'a', page: 2 }] });
    expect(only(out.pieces, 'card')[0].where.page).toBe(2);
  });

  it('drops one the material does not have', () => {
    // "From Session 7 slides, slide 9" on a three-slide deck is worse than no
    // reference at all: the whole point of carrying one is that it checks out.
    const out = run({ cards: [{ q: 'q', a: 'a', page: 9 }] });
    expect(only(out.pieces, 'card')[0].where.page).toBeUndefined();
  });

  it('carries none at all for material with no pages to speak of', () => {
    const out = run({ cards: [{ q: 'q', a: 'a', page: 2 }] }, source);
    expect(only(out.pieces, 'card')[0].where.page).toBeUndefined();
  });
});

describe('dates', () => {
  it('takes a real one', () => {
    const out = run({
      items: [{ title: 'Problem Set 3', kind: 'Problem set', month: 9, day: 17, weight: '5%' }],
    });
    const it0 = only(out.pieces, 'item')[0];
    expect(it0.month).toBe(9);
    expect(it0.day).toBe(17);
  });

  it('drops a month that is not a month', () => {
    // The same validation the syllabus importer makes: a date that is not a
    // date becomes a row that cannot be shown and cannot be corrected.
    const out = run({
      items: [
        { title: 'Bad month', month: 12, day: 3 },
        { title: 'One-based January', month: 0, day: 3 },
        { title: 'Bad day', month: 1, day: 44 },
        { title: 'Missing', day: 3 },
      ],
    });
    expect(only(out.pieces, 'item').map((p) => p.title)).toEqual(['One-based January']);
  });

  it('drops an item with no title, which cannot be shown as anything', () => {
    expect(only(run({ items: [{ month: 9, day: 30 }] }).pieces, 'item')).toEqual([]);
  });
});

describe('what the hashes are taken on', () => {
  it('hashes a card on its answer, so the same fact asked twice is one card', () => {
    /*
     * Substance, not string equality. A deck and the reading behind it will
     * phrase the same question differently and give the same answer, and the
     * second one is a duplicate rather than something new.
     */
    const a = run({ cards: [{ q: 'What did the study find?', a: 'Price outweighed size.' }] });
    const b = run({ cards: [{ q: 'In the laptop study, what won?', a: 'Price outweighed size.' }] });
    expect(only(a.pieces, 'card')[0].hash).toBe(only(b.pieces, 'card')[0].hash);
  });

  it('hashes an item on what and when, not on the wording', () => {
    // A revised syllabus that renames "Midterm" to "Midterm 1" must not read
    // as a second deadline in the same week.
    const a = run({ items: [{ title: 'Midterm', month: 9, day: 30 }] });
    const b = run({ items: [{ title: 'Midterm', month: 9, day: 30, detail: 'in class' }] });
    expect(only(a.pieces, 'item')[0].hash).toBe(only(b.pieces, 'item')[0].hash);
  });

  it('gives a moved deadline a different hash, because it is a different fact', () => {
    const a = run({ items: [{ title: 'Midterm', month: 9, day: 30 }] });
    const b = run({ items: [{ title: 'Midterm', month: 9, day: 7 }] });
    expect(only(a.pieces, 'item')[0].hash).not.toBe(only(b.pieces, 'item')[0].hash);
  });

  it('hashes a term on the term, so a reworded definition is the same entry', () => {
    const a = run({ terms: [{ t: 'Conjoint analysis', d: 'Measuring trade-offs.' }] });
    const b = run({ terms: [{ t: 'conjoint analysis', d: 'A way of measuring what buyers trade.' }] });
    expect(only(a.pieces, 'term')[0].hash).toBe(only(b.pieces, 'term')[0].hash);
  });
});

describe('what it refuses to build', () => {
  it('drops a half-written card rather than showing a blank side', () => {
    const out = run({
      cards: [
        { q: 'Kept?', a: 'Yes.' },
        { q: 'No answer' },
        { q: '', a: 'No question' },
      ],
    });
    expect(only(out.pieces, 'card')).toHaveLength(1);
  });

  it('drops a grading row missing either half', () => {
    const out = run({ grading: [{ what: 'Midterm', pct: '25%' }, { what: 'Final' }, { pct: '10%' }] });
    expect(only(out.pieces, 'grade')).toHaveLength(1);
  });

  it('returns nothing at all from a reply with nothing in it', () => {
    expect(run({}).pieces).toEqual([]);
    expect(run({ says: 'I could not make anything of that.' }).pieces).toEqual([]);
  });
});

describe('every class maps onto something that already exists', () => {
  it('says what each becomes, and none of them a new content type', () => {
    const kinds: Kind[] = [
      'syllabus', 'slides', 'reading', 'problem-set', 'assignment', 'exam',
      'returned', 'announcement', 'notes', 'reference', 'unclear',
    ];
    for (const k of kinds) expect(shapeFor(k)).toBeTruthy();
  });

  it('makes a note of what does not fit, rather than a sixth kind of thing', () => {
    // A formula sheet is not material to drill — turning it into flashcards
    // gives twenty cards whose answer is a symbol.
    const out = run({ note: { title: 'Formula sheet', body: 'Elasticity, MC, MR.' } }, withPages, 'reference');
    const note = only(out.pieces, 'note')[0];
    expect(note.title).toBe('Formula sheet');
    expect(note.why).toBe(shapeFor('reference'));
  });
});

describe('provenance', () => {
  it('puts the source, its hash and the classification on every piece', () => {
    const out = run({
      unit: { name: 'Conjoint analysis', body: 'What buyers trade off.' },
      cards: [{ q: 'q', a: 'a' }],
      terms: [{ t: 'Conjoint', d: 'Trade-offs.' }],
    });
    expect(out.pieces).toHaveLength(3);
    for (const p of out.pieces) {
      expect(p.where.source).toBe('Session 7 slides.pptx');
      expect(p.where.sourceHash).toBe(withPages.hash);
      expect(p.where.as).toBe('slides');
      expect(p.where.at).toBeGreaterThan(0);
    }
  });

  it('files cards against the unit the material is, not a parallel one', () => {
    const out = run({
      unit: { name: 'Conjoint analysis', body: '' },
      cards: [{ q: 'q', a: 'a' }],
    });
    expect(only(out.pieces, 'card')[0].unit).toBe('Conjoint analysis');
  });
});

/**
 * The sentence that named a validation this branch had already changed.
 *
 * The comment here says "the same validation the syllabus importer makes, and
 * for the same reason: a date that is not a date becomes a row that cannot be
 * shown and cannot be corrected". The importer was moved to `realDate`; this
 * copy of the sentence was left checking `day <= 31`, which admits 31 April
 * and 30 February.
 */
describe('a harvested date that is not one', () => {
  it('is dropped, the way the importer drops it', () => {
    expect(only(run({ items: [{ title: 'Essay', month: 3, day: 31 }] }).pieces, 'item')).toEqual([]);
    expect(only(run({ items: [{ title: 'Essay', month: 1, day: 30 }] }).pieces, 'item')).toEqual([]);
  });

  it('still takes a date the calendar has', () => {
    expect(only(run({ items: [{ title: 'Essay', month: 9, day: 31 }] }).pieces, 'item')).toHaveLength(1);
    expect(only(run({ items: [{ title: 'Essay', month: 1, day: 29 }] }).pieces, 'item')).toHaveLength(1);
  });
});
