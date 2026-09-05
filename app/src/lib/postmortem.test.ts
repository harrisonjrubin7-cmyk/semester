import { describe, expect, it } from 'vitest';
import {
  ENOUGH,
  KINDS,
  OFFER,
  doneLine,
  newMortem,
  pattern,
  readMortem,
  resurface,
  saidSomething,
  tally,
  type MissKind,
  type PostMortem,
} from './postmortem';
import { emptyReview, type Reviews } from './review';

const mortem = (kinds: MissKind[], units: number[] = []): PostMortem => ({
  units,
  other: '',
  kinds,
  at: 1,
});

describe('bringing a unit forward without inventing an answer', () => {
  const now = 1_000_000;

  it('makes a card due now', () => {
    const before: Reviews = { 'econ:q1': { ...emptyReview(0), due: now + 5 * 86_400_000 } };
    expect(resurface(before, ['econ:q1'], now)['econ:q1'].due).toBe(now);
  });

  it('does not mark it wrong, because nobody answered it', () => {
    // The student lost marks on an exam question that touched this material.
    // Writing a wrong answer into the record would corrupt the one honest
    // thing the drill has and drag the ease of cards that are known perfectly
    // well.
    const before: Reviews = {
      'econ:q1': { ...emptyReview(0), right: 4, wrong: 1, streak: 3, ease: 2.6, interval: 9 },
    };
    const after = resurface(before, ['econ:q1'], now)['econ:q1'];
    expect(after.right).toBe(4);
    expect(after.wrong).toBe(1);
    expect(after.streak).toBe(3);
    expect(after.ease).toBe(2.6);
  });

  it('starts a record for a card nobody has seen', () => {
    const after = resurface({}, ['econ:q9'], now)['econ:q9'];
    expect(after.due).toBe(now);
    expect(after.right).toBe(0);
    expect(after.wrong).toBe(0);
  });

  it('leaves everything it was not asked about alone', () => {
    const before: Reviews = { 'econ:q1': emptyReview(0), 'psci:q1': emptyReview(0) };
    const after = resurface(before, ['econ:q1'], now);
    expect(after['psci:q1']).toEqual(before['psci:q1']);
  });

  it('does nothing at all when no unit was named', () => {
    const before: Reviews = { 'econ:q1': emptyReview(0) };
    expect(resurface(before, [], now)).toBe(before);
  });
});

describe('what counts as having said something', () => {
  it('is nothing on a blank one', () => {
    expect(saidSomething(newMortem(1))).toBe(false);
  });

  it('is enough to have named a unit, or a kind, or typed a line', () => {
    expect(saidSomething({ ...newMortem(1), units: [2] })).toBe(true);
    expect(saidSomething({ ...newMortem(1), kinds: ['careless'] })).toBe(true);
    expect(saidSomething({ ...newMortem(1), other: 'the graph question' })).toBe(true);
  });
});

describe('the pattern across a term', () => {
  it('says nothing about one paper', () => {
    // One paper is what happened on one morning.
    expect(pattern([mortem(['careless'])])).toBe('');
    expect(ENOUGH).toBe(2);
  });

  it('names the share that more studying would not have fixed', () => {
    const said = pattern([
      mortem(['careless']),
      mortem(['careless']),
      mortem(['did-not-know']),
      mortem(['misread']),
    ]);
    expect(said).toContain('75%');
    expect(said).toContain('careless');
    expect(said).toContain('Re-reading the material does not fix those');
  });

  it('says so plainly when it really was all gaps', () => {
    const said = pattern([mortem(['did-not-know']), mortem(['did-not-know'])]);
    expect(said).toContain('More studying is the answer');
    expect(said).toContain('which is not always true');
  });

  it('says so plainly when none of it was', () => {
    const said = pattern([mortem(['careless']), mortem(['out-of-time'])]);
    expect(said).toContain('none of the marks');
    expect(said).toContain('would not have caught any of them');
  });

  it('never calls the person careless', () => {
    // Where the marks went is a fact about the papers. What kind of person
    // somebody is, is not something a mark can tell anybody.
    const said = pattern([mortem(['careless']), mortem(['careless'])]).toLowerCase();
    expect(said).not.toContain('you are');
    expect(said).not.toContain('you tend');
  });

  it('says nothing when two post-mortems named no kinds', () => {
    expect(pattern([mortem([], [1]), mortem([], [2])])).toBe('');
  });

  it('counts each kind across every paper', () => {
    const counts = tally([mortem(['careless', 'misread']), mortem(['careless'])]);
    expect(counts.careless).toBe(2);
    expect(counts.misread).toBe(1);
    expect(counts['out-of-time']).toBe(0);
  });
});

describe('a stored one, read back', () => {
  it('drops a shape it does not recognise', () => {
    expect(readMortem(null)).toBeUndefined();
    expect(readMortem('careless')).toBeUndefined();
    expect(readMortem({})).toBeUndefined();
  });

  it('drops a kind that is not one of the four', () => {
    const got = readMortem({ units: [1], kinds: ['careless', 'vibes'], other: '', at: 5 });
    expect(got?.kinds).toEqual(['careless']);
  });

  it('drops a unit index that is not one', () => {
    const got = readMortem({ units: [1, -2, 'three', 1.5], kinds: [], other: 'x', at: 5 });
    expect(got?.units).toEqual([1]);
  });
});

describe('what it says on the screen', () => {
  it('offers it as a minute rather than as homework', () => {
    expect(OFFER).toMatch(/under a minute/);
    expect(OFFER.toLowerCase()).not.toContain('please');
  });

  it('gives every kind a reason it is worth distinguishing', () => {
    for (const k of KINDS) {
      expect(k.blurb.length, k.id).toBeGreaterThan(20);
    }
  });

  it('says what happened to the cards, in the words of the units', () => {
    const said = doneLine(mortem(['careless'], [0, 2]), ['Supply', 'Demand', 'Elasticity']);
    expect(said).toContain('Supply, Elasticity');
    expect(said).toContain('brought forward');
    expect(said).toContain('careless slip');
  });

  it('says something rather than nothing for an empty one', () => {
    expect(doneLine(newMortem(1), [])).toBe('Recorded.');
  });
});
