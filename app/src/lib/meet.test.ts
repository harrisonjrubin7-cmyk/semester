import { describe, expect, it } from 'vitest';
import {
  alsoLine,
  carrying,
  distinctive,
  elsewhere,
  forms,
  meetings,
  normalise,
  pairings,
  saysIt,
  singular,
  whyLine,
  type Sided,
} from './meet';
import type { CourseId, Guide, StudyCard, Term } from './types';

const card = (q: string, a: string): StudyCard => ({ q, a, ui: 0 }) as StudyCard;

function guide(
  code: string,
  terms: Term[],
  units: { name: string; cards: StudyCard[] }[] = [],
): Guide {
  return {
    code,
    name: code,
    blurb: '',
    source: '',
    mastery: 0.5,
    audio: false,
    units: units.map((u) => ({ name: u.name, mastery: 0.5, cards: u.cards })),
    terms,
  };
}

function side(id: string, code: string, g: Guide): Sided {
  return { courseId: id as CourseId, code, guide: g };
}

describe('normalise', () => {
  it('drops the notation a glossary puts in brackets', () => {
    expect(normalise('Confounding variable (Z)')).toBe('confounding variable');
    expect(normalise('Regression coefficient (b)')).toBe('regression coefficient');
  });

  it('leaves the curly punctuation of a real syllabus alone', () => {
    expect(normalise('Customer’s value')).toBe("customer's value");
  });
});

describe('forms', () => {
  it('matches each half of a contrast as well as the whole', () => {
    expect(forms('Parameter vs. statistic')).toEqual([
      'parameter vs statistic',
      'parameter',
      'statistic',
    ]);
  });

  it('splits the slashes and ampersands a glossary uses as commas', () => {
    expect(forms('Qual / quant / observational')).toContain('observational');
    expect(forms('Revenue & profit')).toContain('profit');
  });
});

describe('distinctive', () => {
  it('refuses a short word on its own', () => {
    expect(distinctive('bias')).toBe(false);
    expect(distinctive('elasticity')).toBe(true);
  });

  it('refuses the furniture of every glossary', () => {
    expect(distinctive('model')).toBe(false);
    expect(distinctive('variables')).toBe(false);
  });

  it('keeps a phrase whose words are generic one at a time', () => {
    // The whole point of the phrase test: "margin of error" is two pieces of
    // furniture and one real shared concept.
    expect(distinctive('margin of error')).toBe(true);
  });
});

describe('saysIt', () => {
  it('matches whole words rather than the inside of one', () => {
    expect(saysIt('the price elasticity of demand', 'elasticity')).toBe(true);
    expect(saysIt('inelasticity is not this', 'elasticity')).toBe(false);
  });

  it('matches at either end of the text', () => {
    expect(saysIt('elasticity of demand', 'elasticity')).toBe(true);
    expect(saysIt('demand and elasticity', 'elasticity')).toBe(true);
  });
});

describe('singular and carrying', () => {
  it('takes plurals back one step and no further', () => {
    expect(singular('costs')).toBe('cost');
    expect(singular('utilities')).toBe('utility');
    expect(singular('bias')).toBe('bias');
    expect(singular('boxes')).toBe('box');
  });

  it('keeps only words that could carry a meeting alone', () => {
    expect(carrying('sampling plan')).toEqual(['sampling']);
    // 'plan' is four letters, 'data' and 'model' are furniture.
    expect(carrying('the data model')).toEqual([]);
  });
});

describe('meetings', () => {
  const psci = side(
    'psci',
    'PSCI 1104',
    guide('PSCI 1104', [
      { t: 'Margin of error', d: 'How far a sample estimate may sit from the population.' },
      { t: 'Random sampling', d: 'Every member of the population has a known chance.' },
    ]),
  );

  const bus = side(
    'bus',
    'BUS 1600',
    guide('BUS 1600', [
      { t: 'Margin of error', d: '≈ 1 ÷ √n, so n = 1,000 gives roughly ±3%.' },
      { t: 'Sampling plan', d: 'Sampling unit, sample size, sampling procedure.' },
      { t: 'Price elasticity', d: 'How much quantity responds to a price change.' },
    ]),
  );

  const econ = side(
    'econ',
    'ECON 1020',
    guide(
      'ECON 1020',
      [{ t: 'Elasticity (midpoint)', d: '%ΔQ ÷ %ΔP, using midpoints.' }],
      [
        {
          name: 'Surplus and elasticity',
          cards: [card('What is consumer surplus?', 'Willingness to pay minus price paid.')],
        },
      ],
    ),
  );

  it('finds a term two courses both define, and keeps both definitions', () => {
    const found = meetings([psci, bus]);
    const margin = found.find((m) => m.key === 'margin of error');
    expect(margin?.why).toBe('both-define');
    expect(margin?.sides.map((s) => s.code)).toEqual(['BUS 1600', 'PSCI 1104']);
    // The payload: each course's own words, so they can be read against each
    // other rather than merged into one claim.
    expect(margin?.sides[0].term?.d).toContain('√n');
    expect(margin?.sides[1].term?.d).toContain('population');
  });

  it('finds one phrase sitting inside another', () => {
    const found = meetings([bus, econ]);
    const inside = found.find((m) => m.key === 'elasticity');
    expect(inside?.why).toBe('one-inside-the-other');
    expect(inside?.sides).toHaveLength(2);
  });

  it('falls back to a single shared word, and says which word it was', () => {
    const found = meetings([psci, bus]);
    const shared = found.find((m) => m.key === 'sampling');
    expect(shared?.why).toBe('a-word-in-common');
    expect(shared?.word).toBe('sampling');
    expect(whyLine(shared!)).toContain('“sampling”');
  });

  it('never lets a course meet itself', () => {
    const alone = side(
      'econ',
      'ECON 1020',
      guide('ECON 1020', [
        { t: 'Price elasticity', d: 'One.' },
        { t: 'Elasticity of supply', d: 'Two.' },
      ]),
    );
    expect(meetings([alone])).toEqual([]);
    expect(meetings([alone, side('x', 'X 1000', guide('X 1000', []))])).toEqual([]);
  });

  it('will not join two courses on academic furniture', () => {
    const a = side('a', 'A 100', guide('A 100', [{ t: 'Regression model', d: 'One.' }]));
    const b = side('b', 'B 200', guide('B 200', [{ t: 'Business model', d: 'Two.' }]));
    expect(meetings([a, b])).toEqual([]);
  });

  it('finds a word one course defines and another only uses', () => {
    const defines = side(
      'econ',
      'ECON 1020',
      guide('ECON 1020', [{ t: 'Opportunity cost', d: 'The next best thing given up.' }]),
    );
    const uses = side(
      'bus',
      'BUS 1600',
      guide('BUS 1600', [], [
        {
          name: 'Pricing',
          cards: [card('Why price above cost?', 'Because opportunity cost sets the floor.')],
        },
      ]),
    );
    const found = meetings([defines, uses]);
    expect(found).toHaveLength(1);
    expect(found[0].why).toBe('defined-and-used');
    const side2 = found[0].sides.find((s) => s.kind === 'uses');
    expect(side2?.unit).toBe(0);
    expect(side2?.where).toBe('Pricing');
    // Quoted rather than asserted: the row shows the sentence it found.
    expect(side2?.quote).toContain('opportunity cost sets the floor');
  });

  it('prefers the stronger reason when a pair qualifies under two rules', () => {
    // 'Margin of error' is an exact match and also shares the word 'margin'.
    const found = meetings([psci, bus]);
    expect(found.filter((m) => m.label.toLowerCase().includes('margin'))).toHaveLength(1);
    expect(found[0].why).toBe('both-define');
  });

  it('puts a third course on the same row rather than starting another', () => {
    const third = side(
      'core',
      'CORE 1000',
      guide('CORE 1000', [], [
        {
          name: 'Measurement',
          cards: [card('What is a margin of error?', 'The give in a survey number.')],
        },
      ]),
    );
    const found = meetings([psci, bus, third]);
    const margin = found.find((m) => m.key === 'margin of error');
    expect(margin?.sides).toHaveLength(3);
    // Two definitions and one use — the row says so rather than picking one.
    expect(whyLine(margin!)).toContain('each define it');
    expect(whyLine(margin!)).toContain('without defining it');
  });

  it('is ordered by how much the evidence is worth', () => {
    const found = meetings([psci, bus, econ]);
    const ranks = found.map((m) => m.why);
    expect(ranks[0]).toBe('both-define');
    expect(ranks[ranks.length - 1]).toBe('a-word-in-common');
  });

  it('says nothing at all about a semester of one course', () => {
    expect(meetings([econ])).toEqual([]);
    expect(meetings([])).toEqual([]);
  });
});

describe('pairings', () => {
  it('counts each pair once per meeting, widest first', () => {
    const found = meetings([
      side('a', 'A 100', guide('A 100', [{ t: 'Elasticity', d: 'One.' }])),
      side('b', 'B 200', guide('B 200', [{ t: 'Price elasticity', d: 'Two.' }])),
      side('c', 'C 300', guide('C 300', [{ t: 'Elasticity of demand', d: 'Three.' }])),
    ]);
    const pairs = pairings(found);
    expect(pairs).toHaveLength(3);
    expect(pairs.every((p) => p.count === 1)).toBe(true);
    expect(pairs.map((p) => `${p.a}/${p.b}`)).toEqual(['A 100/B 200', 'A 100/C 300', 'B 200/C 300']);
  });
});

describe('whyLine', () => {
  it('never claims two courses mean the same thing', () => {
    const found = meetings([
      side('a', 'A 100', guide('A 100', [{ t: 'Margin of error', d: 'One.' }])),
      side('b', 'B 200', guide('B 200', [{ t: 'Margin of error', d: 'Two.' }])),
    ]);
    const line = whyLine(found[0]);
    expect(line).toContain('may not mean the same thing');
    expect(line).not.toContain('the same idea');
  });
});

describe('elsewhere', () => {
  const psci = side(
    'psci',
    'PSCI 1104',
    guide('PSCI 1104', [
      { t: 'Margin of error', d: 'How far a sample estimate may sit from the population.' },
      { t: 'Falsifiability', d: 'A claim that could be shown wrong by evidence.' },
    ]),
  );
  const bus = side(
    'bus',
    'BUS 1600',
    guide(
      'BUS 1600',
      [{ t: 'Margin of error', d: '≈ 1 ÷ √n.' }],
      [
        {
          name: 'Positioning',
          cards: [card('What makes a claim testable?', 'Falsifiability — it could come out wrong.')],
        },
      ],
    ),
  );

  it('keys on the term as that course wrote it', () => {
    const found = meetings([psci, bus]);
    const mine = elsewhere(found, 'psci' as CourseId);
    expect(mine.get('Margin of error')).toEqual([
      { code: 'BUS 1600', kind: 'defines', why: 'both-define' },
    ]);
    expect(mine.get('Falsifiability')).toEqual([
      { code: 'BUS 1600', kind: 'uses', why: 'defined-and-used' },
    ]);
  });

  it('annotates only rows the course itself defines', () => {
    // BUS has no glossary entry for falsifiability, so its side of that
    // meeting has no row to hang the note on.
    const theirs = elsewhere(meetings([psci, bus]), 'bus' as CourseId);
    expect(theirs.has('Falsifiability')).toBe(false);
    expect(theirs.get('Margin of error')).toEqual([
      { code: 'PSCI 1104', kind: 'defines', why: 'both-define' },
    ]);
  });

  it('says who has it, and how firmly, in one line', () => {
    expect(alsoLine([{ code: 'BUS 1600', kind: 'defines', why: 'both-define' }])).toBe(
      'BUS 1600 defines this too',
    );
    expect(
      alsoLine([
        { code: 'BUS 1600', kind: 'defines', why: 'both-define' },
        { code: 'ECON 1020', kind: 'uses', why: 'defined-and-used' },
      ]),
    ).toBe('BUS 1600 defines this too · ECON 1020 uses the word');
    expect(alsoLine([])).toBe('');
  });

  it('will not call a shared word a shared definition', () => {
    // The failure this phrasing exists to prevent: PSCI's "random sampling"
    // and BUS's "sampling plan" are one word apart, and a row saying BUS
    // "defines this too" would be the app upgrading its own weakest evidence.
    const line = alsoLine([{ code: 'BUS 1600', kind: 'defines', why: 'a-word-in-common' }]);
    expect(line).toBe('BUS 1600 has a term close to it');
    expect(line).not.toContain('defines this too');
  });
});
