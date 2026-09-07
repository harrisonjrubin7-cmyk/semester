import { describe, expect, it } from 'vitest';
import { anything, piecesFrom, type Pasted } from './pasted';
import { diff, type Held } from './changeset';
import type { Where } from './harvest';
import type { Guide } from './types';

const WHERE: Where = {
  source: 'Reading 7',
  sourceHash: 'abc123',
  as: 'reading',
  at: 1,
};

const nothing: Pasted = {
  cards: [],
  terms: [],
  figures: [],
  frames: [],
  selfTest: [],
  cases: [],
  examples: [],
  body: '',
  title: 'Week 6 reading',
  source: 'Reading 7',
};

const table = {
  type: 'bars' as const,
  title: 'Where the money went',
  caption: 'Federal outlays',
  unit: '%',
  max: 100,
  rows: [
    { l: 'Social Security', v: 21 },
    { l: 'Medicare', v: 14 },
  ],
};

const guide = (over: Partial<Guide> = {}): Guide => ({
  code: 'ECON 1020',
  name: 'Micro',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: [{ name: 'Supply', mastery: 50, cards: [{ q: 'What is supply?', a: 'A schedule.' }] }],
  terms: [],
  ...over,
});

const held = (over: Partial<Held> = {}): Held => ({
  guide: guide(),
  items: [],
  updates: [],
  grading: [],
  sources: [],
  examples: [],
  figures: [],
  ...over,
});

describe('what a paste proposes', () => {
  it('is nothing when nothing was read, so nothing is reviewed', () => {
    expect(anything(nothing)).toBe(false);
    expect(piecesFrom(nothing, WHERE)).toEqual([]);
  });

  it('carries every kind the reader can produce', () => {
    const p: Pasted = {
      ...nothing,
      cards: [{ q: 'Q', a: 'A' }],
      terms: [{ t: 'Elasticity', d: 'Responsiveness.' }],
      figures: [table],
      frames: [{ t: 'The efficiency framing', d: 'Why the crossing is efficient.' }],
      selfTest: [{ q: 'Say it out loud', a: 'Like this.' }],
      cases: [{ title: 'Zoning', when: '1968', claim: 'c', test: 't', verdict: 'v', lesson: 'l' }],
      examples: [{ tag: 'Elasticity', t: 'Dining plan', d: 'Inelastic.' }],
      body: 'Prose that never became a question.',
    };
    expect(anything(p)).toBe(true);
    expect(piecesFrom(p, WHERE).map((x) => x.what)).toEqual([
      'card',
      'term',
      'figure',
      'frame',
      'selftest',
      'case',
      'example',
      'unit',
    ]);
  });

  it('gives the prose the title, so the guide’s contents are not left blank', () => {
    const p = { ...nothing, body: 'Some prose.' };
    const unit = piecesFrom(p, WHERE)[0];
    expect(unit).toMatchObject({ what: 'unit', name: 'Week 6 reading', body: 'Some prose.' });
  });

  it('hashes each piece by its own text, not its position', () => {
    // So pasting the same reading with one card added is nine duplicates and
    // one new card, rather than ten new cards.
    const one = piecesFrom({ ...nothing, cards: [{ q: 'Q', a: 'A' }] }, WHERE);
    const two = piecesFrom(
      { ...nothing, cards: [{ q: 'Fresh', a: 'One' }, { q: 'Q', a: 'A' }] },
      WHERE,
    );
    expect(two.map((p) => p.hash)).toContain(one[0].hash);
  });

  it('does not let a card and a self-test question of the same words collide', () => {
    const p: Pasted = { ...nothing, cards: [{ q: 'Q', a: 'A' }], selfTest: [{ q: 'Q', a: 'A' }] };
    const [a, b] = piecesFrom(p, WHERE);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('a paste, through the same diff a file goes through', () => {
  const set = (p: Partial<Pasted>, h: Partial<Held> = {}) =>
    diff(piecesFrom({ ...nothing, ...p }, WHERE), held(h));

  it('proposes what is new rather than writing it', () => {
    const out = set({ cards: [{ q: 'What is a price ceiling?', a: 'A legal maximum.' }] });
    expect(out.changes).toHaveLength(1);
    expect(out.changes[0].verdict).toBe('new');
  });

  it('counts a card the course already has as a duplicate', () => {
    const out = set({ cards: [{ q: 'What is supply?', a: 'A schedule.' }] });
    expect(out.changes).toHaveLength(0);
    expect(out.duplicates).toBe(1);
  });

  it('knows the whole paste has been seen before', () => {
    const out = set({ cards: [{ q: 'Anything', a: 'At all' }] }, { sources: ['abc123'] });
    expect(out.seenBefore).toBe(true);
  });

  it('stops on a figure that contradicts one already drawn', () => {
    /*
     * The case the review sheet exists for, in figure form: the reading says
     * Social Security is 21% and the guide says 25%. Same title, different
     * numbers — one of them is what the exam uses, and the app must not pick.
     */
    const theirs = { ...table, rows: [{ l: 'Social Security', v: 25 }, { l: 'Medicare', v: 14 }] };
    const out = set({ figures: [table] }, { figures: [theirs] });
    expect(out.changes).toHaveLength(1);
    expect(out.changes[0].verdict).toBe('conflict');
    expect(out.changes[0].because).toContain('21');
    expect(out.changes[0].against).toContain('25');
  });

  it('calls the same figure drawn the same way a duplicate', () => {
    const out = set({ figures: [table] }, { figures: [table] });
    expect(out.changes).toHaveLength(0);
    expect(out.duplicates).toBe(1);
  });

  it('stops on a case whose verdict disagrees', () => {
    const mine = { title: 'Zoning', when: '1968', claim: 'c', test: 't', verdict: 'The grades came first.', lesson: 'l' };
    const theirs = { ...mine, verdict: 'Demand came first, and nothing else mattered.' };
    const out = set({ cases: [mine] }, { guide: guide({ cases: [theirs] }) });
    expect(out.changes[0].verdict).toBe('conflict');
  });

  it('treats a term redefined differently as a conflict, as it always did', () => {
    const out = set(
      { terms: [{ t: 'Elasticity', d: 'How much quantity moves with price.' }] },
      { guide: guide({ terms: [{ t: 'Elasticity', d: 'The slope of the demand curve.' }] }) },
    );
    expect(out.changes[0].verdict).toBe('conflict');
  });

  it('offers a worked example the course already works as a fuller version, not a second one', () => {
    const out = set(
      { examples: [{ tag: 'Elasticity', t: 'Dining plan', d: 'A much longer working of it.' }] },
      { examples: [{ tag: 'Elasticity', t: 'Dining plan', d: 'Short.' }] },
    );
    expect(out.changes[0].verdict).toBe('fuller');
  });
});
