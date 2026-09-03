import { describe, expect, it } from 'vitest';
import {
  KINDS,
  SYSTEM,
  brief,
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

describe('kind', () => {
  it('falls back rather than throwing on an id it does not know', () => {
    expect(kind('nonsense').id).toBe(KINDS[0].id);
  });
});
