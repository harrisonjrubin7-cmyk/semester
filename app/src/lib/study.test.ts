import { describe, expect, it } from 'vitest';
import {
  MOST,
  addedLine,
  describeStudyParts,
  readCases,
  readFrames,
  readSelfTest,
  readStudyParts,
} from './study';

describe('exam frames', () => {
  it('come through as a framing and what it is testing', () => {
    expect(
      readFrames([{ t: 'The efficiency question', d: 'Asks why the crossing point is efficient.' }]),
    ).toEqual([{ t: 'The efficiency question', d: 'Asks why the crossing point is efficient.' }]);
  });

  it('need both halves — a title with no explanation is not a frame', () => {
    expect(readFrames([{ t: 'Something' }, { d: 'Something else' }, { t: '', d: 'x' }])).toEqual([]);
  });

  it('stop at the cap, because a cram sheet is short by design', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ t: `F${i}`, d: 'x' }));
    expect(readFrames(many)).toHaveLength(MOST.frames);
  });

  it('are empty for anything that is not a list', () => {
    for (const v of [null, undefined, {}, 'frames', 3]) expect(readFrames(v)).toEqual([]);
  });
});

describe('questions to answer out loud', () => {
  it('need a question and an answer', () => {
    expect(readSelfTest([{ q: 'Why is the crossing efficient?', a: 'Because both curves are marginal.' }]))
      .toHaveLength(1);
    expect(readSelfTest([{ q: 'Why?' }, { a: 'Because.' }])).toEqual([]);
  });

  it('stop at the cap', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ q: `Q${i}`, a: 'x' }));
    expect(readSelfTest(many)).toHaveLength(MOST.tests);
  });
});

describe('a claim and the test of it', () => {
  const whole = {
    title: 'Did zoning follow the grades?',
    when: '1930-1960',
    claim: 'Local zoning simply reflected demand.',
    test: 'Trounstine matched HOLC grades to zoning changes in 239 cities.',
    verdict: 'The grades came first.',
    lesson: 'Federal policy shaped what looks like a local market.',
  };

  it('comes through whole', () => {
    expect(readCases([whole])).toEqual([whole]);
  });

  it('is dropped entirely when a field is missing', () => {
    // A case rendered without its `test` reads as "people believed X, and in
    // fact Y" — a claim the app would be making on its own account.
    for (const field of Object.keys(whole)) {
      expect(readCases([{ ...whole, [field]: '' }]), field).toEqual([]);
      const without = { ...whole } as Record<string, unknown>;
      delete without[field];
      expect(readCases([without]), `missing ${field}`).toEqual([]);
    }
  });

  it('keeps the good ones beside a broken one', () => {
    const got = readCases([{ ...whole, verdict: '' }, { ...whole, title: 'Second' }]);
    expect(got.map((c) => c.title)).toEqual(['Second']);
  });

  it('stops at the cap', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...whole, title: `C${i}` }));
    expect(readCases(many)).toHaveLength(MOST.cases);
  });
});

describe('a whole reply', () => {
  it('reads all three, and tolerates any of them being absent', () => {
    const got = readStudyParts({ frames: [{ t: 'A', d: 'B' }] });
    expect(got.frames).toHaveLength(1);
    expect(got.selfTest).toEqual([]);
    expect(got.cases).toEqual([]);
  });

  it('says what it found, for the confirmation before it is saved', () => {
    expect(
      describeStudyParts({
        frames: [{ t: 'A', d: 'B' }],
        selfTest: [{ q: 'Q', a: 'A' }, { q: 'Q2', a: 'A2' }],
        cases: [],
        examples: [],
      }),
    ).toBe('1 exam frame · 2 to answer out loud');
  });

  it('says nothing at all when there is nothing, which is the common case', () => {
    expect(describeStudyParts({ frames: [], selfTest: [], cases: [], examples: [] })).toBe('');
  });
});

describe('the line that says part of a section arrived later', () => {
  it('is nothing when nothing was added', () => {
    expect(addedLine(0, 'framings')).toBe('');
    expect(addedLine(-1, 'framings')).toBe('');
  });

  it('agrees with itself about number', () => {
    expect(addedLine(1, 'framings')).toContain('1 of these is from material you added');
    expect(addedLine(3, 'framings')).toContain('3 of these are from material you added');
  });
});
