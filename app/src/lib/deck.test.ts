import { describe, expect, it } from 'vitest';
import type { Figure } from './types';
import {
  KINDS,
  SYSTEM,
  brief,
  figureSlide,
  fromTable,
  fromUnit,
  holes,
  kind,
  readPlan,
  sentences,
  slidesFor,
  speakerNotes,
  toDeck,
  type Ask,
  type Planned,
} from './deck';
import type { Guide } from './types';

const guide = (): Guide =>
  ({
    code: 'PSCI 1104',
    name: 'American Government',
    units: [
      {
        name: '3 · Federalism',
        mastery: 0,
        cards: [
          { q: 'What is dual federalism?', a: 'Two spheres, each supreme in its own. Neither is a delegate of the other.' },
          { q: 'Why does it matter?', a: 'It decides who can be sued and who pays.' },
        ],
        terms: [],
        test: [],
      },
    ],
  }) as unknown as Guide;

const ask = (over: Partial<Ask> = {}): Ask => ({
  kindId: 'present',
  topic: 'Federalism',
  material: 'Chapter 3 notes.',
  instructions: '',
  minutes: 10,
  audience: 'a seminar',
  ...over,
});

const plan = (over: Partial<Planned> = {}): Planned => ({
  title: 'Federalism is contested by design',
  subtitle: 'PSCI 1104',
  slides: [
    { title: 'Two sovereigns', bullets: ['States', 'The union'], say: 'Neither delegates.' },
  ],
  ...over,
});


describe('a unit deck carries more than its cards', () => {
  const table: Figure = {
    type: 'bars',
    title: 'Where the money went',
    caption: 'Federal outlays',
    unit: '% of outlays',
    max: 100,
    rows: [
      { l: 'Social Security', v: 21 },
      { l: 'Medicare', v: 14 },
    ],
  };

  it('turns a table into the bullets a slide can hold', () => {
    // `lib/pptx.ts` writes titles and bullets, no pictures — but a table is a
    // label and a value, which is exactly what a bullet is.
    expect(figureSlide(table)).toEqual({
      title: 'Where the money went',
      bullets: ['Social Security — 21 % of outlays', 'Medicare — 14 % of outlays'],
      note: 'Federal outlays',
    });
  });

  it('turns a process into numbered bullets', () => {
    const got = figureSlide({
      type: 'steps',
      title: 'How a bill becomes law',
      caption: 'The short version',
      steps: [
        { n: '1', t: 'Introduced', d: 'A member files it.' },
        { n: '2', t: 'Committee', d: 'Where most stop.' },
      ],
    });
    expect(got.bullets).toEqual([
      '1. Introduced — A member files it.',
      '2. Committee — Where most stop.',
    ]);
  });

  it('says a diagram could not travel rather than shipping a blank slide', () => {
    // Handing somebody a deck whose figures are silently missing is worse than
    // one that names what it could not draw.
    const got = figureSlide({ type: 'diagram', title: 'The market', caption: 'x', kind: 'supply-demand' });
    expect(got.bullets[0]).toContain('supply demand');
    expect(got.bullets[0]).toContain('Figures');
  });

  it('puts the figures and the prose in, after the cards and before Questions', () => {
    const deck = fromUnit(guide(), 0, {
      figures: [table],
      notes: [{ title: 'Week 6 reading', text: 'Prose that never became a question.', from: 'Reading 7' }],
    });
    const titles = deck.slides.map((sl) => sl.title);
    expect(titles).toContain('Where the money went');
    expect(titles).toContain('Week 6 reading');
    expect(titles.indexOf('Where the money went')).toBeLessThan(titles.indexOf('Week 6 reading'));
    expect(titles.indexOf('Week 6 reading')).toBeLessThan(titles.lastIndexOf('Questions'));
  });

  it('is unchanged for a unit with neither, which is most of them', () => {
    expect(fromUnit(guide(), 0, {})).toEqual(fromUnit(guide(), 0));
    expect(fromUnit(guide(), 0, { figures: [], notes: [] })).toEqual(fromUnit(guide(), 0));
  });
});

describe('fromUnit', () => {
  it('puts the question before its answer, never beside it', () => {
    const deck = fromUnit(guide(), 0);
    const q = deck.slides.findIndex((s) => s.note === '1 of 2');
    expect(deck.slides[q].bullets).toEqual([]);
    expect(deck.slides[q + 1].bullets.length).toBeGreaterThan(0);
  });

  it('opens on the unit and closes on questions', () => {
    const deck = fromUnit(guide(), 0);
    expect(deck.slides[0].opening).toBe(true);
    expect(deck.slides[deck.slides.length - 1].title).toBe('Questions');
  });

  it('strips the numbering the unit name carries for the sidebar', () => {
    expect(fromUnit(guide(), 0).title).toBe('Federalism');
  });

  it('returns an empty deck rather than throwing on a unit that is not there', () => {
    expect(fromUnit(guide(), 9).slides).toEqual([]);
  });
});

describe('sentences', () => {
  it('cuts an answer into bullets at sentence ends', () => {
    expect(sentences('One thing. Then another.')).toEqual(['One thing.', 'Then another.']);
  });

  it('does not break on an abbreviation, which this material is full of', () => {
    expect(sentences('The U.S. did it. Then France.')).toEqual(['The U.S. did it.', 'Then France.']);
    expect(sentences('Goods, e.g. steel, are taxed.')).toEqual(['Goods, e.g. steel, are taxed.']);
  });

  it('breaks a very long sentence at its weakest joint', () => {
    const long = `${'a'.repeat(90)}; ${'b'.repeat(90)}`;
    expect(sentences(long).length).toBe(2);
  });

  it('gives back something rather than nothing for text it cannot split', () => {
    expect(sentences('Short')).toEqual(['Short']);
  });
});

describe('slidesFor', () => {
  it('is about a slide and a half a minute, which is the real rate', () => {
    expect(slidesFor(15)).toBe(10);
  });

  it('gives a very short talk a shape and a long one a limit', () => {
    expect(slidesFor(1)).toBe(3);
    expect(slidesFor(90)).toBe(24);
  });
});

describe('the system prompt', () => {
  it('forbids inventing a figure, which on a slide is believed by a whole room', () => {
    expect(SYSTEM).toContain('Do not invent a statistic');
    expect(SYSTEM).toContain('believed by a whole room');
  });

  it('bans the empty slides people add when they have nothing to say', () => {
    expect(SYSTEM).toContain('"Agenda"');
    expect(SYSTEM).toContain('Any questions');
  });

  it('separates what is written from what is said', () => {
    expect(SYSTEM).toContain('does NOT write on it');
  });
});

describe('brief', () => {
  it('fences the deck to the material given', () => {
    expect(brief(ask())).toContain('Use this and only this');
  });

  it('says plainly when there is no material rather than leaving a gap', () => {
    expect(brief(ask({ material: '' }))).toContain('every specific claim must be a blank');
  });

  it('turns the time limit into a slide count', () => {
    expect(brief(ask({ minutes: 10 }))).toContain('about 7 content slides');
  });
});

describe('readPlan', () => {
  it('reads a plain plan', () => {
    const p = readPlan('{"title":"T","subtitle":"S","slides":[{"title":"A","bullets":["b"]}]}');
    expect(p.title).toBe('T');
    expect(p.slides[0].bullets).toEqual(['b']);
  });

  it('survives a code fence and an apology around the JSON', () => {
    const p = readPlan('Here you go:\n```json\n{"title":"T","slides":[{"title":"A"}]}\n```\nHope that helps.');
    expect(p.slides[0].title).toBe('A');
  });

  it('drops a slide with no title rather than writing a blank one', () => {
    const p = readPlan('{"slides":[{"title":"A"},{"bullets":["x"]},{"title":"  "}]}');
    expect(p.slides.length).toBe(1);
  });

  it('falls back to the first slide for a missing deck title', () => {
    expect(readPlan('{"slides":[{"title":"A"}]}').title).toBe('A');
  });

  it('throws on a plan with no slides, because the screen has to say so', () => {
    expect(() => readPlan('{"slides":[]}')).toThrow(/no slides/i);
    expect(() => readPlan('sorry, I cannot')).toThrow();
    expect(() => readPlan('{ nope }')).toThrow(/malformed/i);
  });

  it('drops a bullet that is not a string instead of rendering "undefined"', () => {
    const p = readPlan('{"slides":[{"title":"A","bullets":["ok",null,3,""]}]}');
    expect(p.slides[0].bullets).toEqual(['ok']);
  });
});

describe('toDeck', () => {
  it('adds the title slide the model was told not to write', () => {
    const deck = toDeck(plan());
    expect(deck.slides[0].opening).toBe(true);
    expect(deck.slides[0].title).toBe('Federalism is contested by design');
    expect(deck.slides.length).toBe(2);
  });
});

describe('holes', () => {
  it('finds a blank wherever it is, including in what the presenter says', () => {
    const p = plan({
      slides: [{ title: 'A', bullets: ['[the enrolment figure]'], say: 'Cite [the report].' }],
    });
    expect(holes(p)).toEqual(['[the enrolment figure]', '[the report]']);
  });

  it('is empty for a plan with none', () => {
    expect(holes(plan())).toEqual([]);
  });
});

describe('speakerNotes', () => {
  it('numbers from two, because slide one is the title the model did not write', () => {
    expect(speakerNotes(plan())).toContain('## 2. Two sovereigns');
  });

  it('carries what to say, which is the part not on the slide', () => {
    expect(speakerNotes(plan())).toContain('**Say:** Neither delegates.');
  });
});

describe('a deck from a table', () => {
  const rows = () => [
    ['Piece', 'Weight'],
    ...Array.from({ length: 20 }, (_, i) => [`Row ${i + 1}`, `${i}%`]),
  ];

  it('opens on a title slide, then puts the table on slides of its own', () => {
    const built = fromTable('Marks', rows(), 'ECON 1020');
    expect(built.slides[0].opening).toBe(true);
    expect(built.slides[1].table).toBeTruthy();
  });

  it('splits a long table rather than shrinking it out of legibility', () => {
    const built = fromTable('Marks', rows());
    // Twenty rows at eight to a slide is three, plus the title slide.
    expect(built.slides).toHaveLength(4);
  });

  it('repeats the heading row on every part, so the second slide reads alone', () => {
    const built = fromTable('Marks', rows());
    for (const slide of built.slides.slice(1)) {
      expect(slide.table?.[0]).toEqual(['Piece', 'Weight']);
    }
  });

  it('keeps a short table on one slide with no part numbers', () => {
    const built = fromTable('Marks', [
      ['Piece', 'Weight'],
      ['Midterm', '30%'],
    ]);
    expect(built.slides).toHaveLength(2);
    expect(built.slides[1].note).toBeUndefined();
  });

  it('is an empty deck rather than a deck of empty slides', () => {
    expect(fromTable('Nothing', []).slides).toEqual([]);
    expect(fromTable('Nothing', [['', ''], ['', '']]).slides).toEqual([]);
  });
});

describe('kind', () => {
  it('falls back rather than throwing on an id it does not know', () => {
    expect(kind('nonsense').id).toBe(KINDS[0].id);
  });
});

/**
 * The three shapes a plan can come back in beyond a list of bullets.
 *
 * All of it is JSON from a model, which means every field arrives in the
 * wrong type roughly as often as in the right one — `points` as a string, a
 * comparison with one side, a quotation with no words. Each of those is a
 * crash on the screen that was waiting for a deck, so each is a case here.
 */
describe('a plan with more than bullets in it', () => {
  const plan = (slide: object) =>
    readPlan(JSON.stringify({ title: 'A talk', subtitle: '', slides: [{ title: 'One', ...slide }] }))
      .slides[0];

  it('reads a comparison as two columns', () => {
    const got = plan({
      compare: {
        left: { heading: 'For', points: ['a', 'b'] },
        right: { heading: 'Against', points: ['c'] },
      },
    });
    expect(got.compare?.left.points).toEqual(['a', 'b']);
    expect(got.compare?.right.heading).toBe('Against');
  });

  it('refuses a comparison with only one side, because that is a list', () => {
    expect(plan({ compare: { left: { heading: 'For', points: ['a'] } } }).compare).toBeUndefined();
  });

  /*
   * A model asked for an array returns a bare string when there is one item,
   * often enough that refusing it would drop real content. It is read as the
   * one point it is — and, more to the point, `.filter` is never called on
   * something that has no `.filter`, which is a crash on the screen that was
   * waiting for a deck.
   */
  it('reads points that came back as one string rather than a list', () => {
    const got = plan({
      compare: { left: { heading: 'For', points: 'a' }, right: { heading: 'Against', points: ['c'] } },
    });
    expect(got.compare?.left.points).toEqual(['a']);
  });

  it('reads no points at all from a number, rather than throwing on it', () => {
    const got = plan({
      compare: { left: { heading: 'For', points: 7 }, right: { heading: 'Against', points: ['c'] } },
    });
    expect(got.compare?.left.points).toEqual([]);
  });

  it('reads a quotation and its source', () => {
    const got = plan({ quote: { text: 'A tariff is a tax on exports.', source: 'Lerner' } });
    expect(got.quote?.text).toBe('A tariff is a tax on exports.');
    expect(got.bullets).toEqual([]);
  });

  it('drops a quotation with no words in it', () => {
    expect(plan({ quote: { source: 'Lerner' } }).quote).toBeUndefined();
  });

  it('reads a figure and what it means', () => {
    expect(plan({ figure: { value: '61%', says: 'never replied' } }).figure?.value).toBe('61%');
  });

  /*
   * A model asked for one of four shapes returns two about as often as none.
   * One shape per slide, most specific first — the alternative draws a
   * quotation and a comparison on top of each other.
   */
  it('keeps one shape per slide when two come back', () => {
    const got = plan({
      quote: { text: 'A passage', source: 'Smith' },
      figure: { value: '61%', says: 'x' },
      bullets: ['a point'],
    });
    expect(got.quote).toBeDefined();
    expect(got.figure).toBeUndefined();
    expect(got.bullets).toEqual([]);
  });

  it('turns each shape into the slide that draws it', () => {
    const made = toDeck(
      readPlan(
        JSON.stringify({
          title: 'A talk',
          subtitle: '',
          slides: [
            { title: 'Both sides', compare: { left: { heading: 'For', points: ['a'] }, right: { heading: 'Against', points: ['b'] } } },
            { title: 'In their words', quote: { text: 'A passage', source: 'Smith' } },
            { title: 'The headline', figure: { value: '61%', says: 'never replied' } },
          ],
        }),
      ),
    );
    expect(made.slides[1].columns).toHaveLength(2);
    expect(made.slides[2].quote?.source).toBe('Smith');
    expect(made.slides[3].big?.value).toBe('61%');
  });

  /*
   * A figure slide's whole content is its value, and that is exactly where
   * the model is told to write `[the enrolment figure from the report]`. A
   * count that read only the bullets reported no blanks on the one slide
   * whose only content is one.
   */
  it('counts a blank wherever it can be written, not only in the bullets', () => {
    const counted = holes(
      readPlan(
        JSON.stringify({
          title: 'A talk',
          subtitle: '',
          slides: [
            { title: 'The headline', figure: { value: '[the enrolment figure from the report]', says: 'x' } },
          ],
        }),
      ),
    );
    expect(counted).toEqual(['[the enrolment figure from the report]']);
  });

  it('writes every shape into the speaker notes', () => {
    const notes = speakerNotes(
      readPlan(
        JSON.stringify({
          title: 'A talk',
          subtitle: '',
          slides: [
            { title: 'In their words', quote: { text: 'A passage', source: 'Smith' } },
            { title: 'The headline', figure: { value: '61%', says: 'never replied' } },
          ],
        }),
      ),
    );
    expect(notes).toContain('> A passage');
    expect(notes).toContain('**61%** — never replied');
  });
});
