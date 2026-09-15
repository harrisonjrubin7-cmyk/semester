import { describe, expect, it } from 'vitest';
import {
  A_SHARE,
  ENOUGH,
  KIND_DEFAULT,
  LEAST,
  VARIED,
  findings,
  nothingYet,
  sameTopic,
  says,
  varied,
  type Logged,
} from './again';

const TODAY = '2026-09-15';

function logged(over: Partial<Logged> = {}): Logged {
  return { courseId: 'econ', topic: 'Elasticity sign', kind: 'Concept', resolved: false, review: '', ...over };
}

/** `n` entries of one kind, each with a topic of its own. */
function many(n: number, over: Partial<Logged> = {}): Logged[] {
  return Array.from({ length: n }, (_, i) => logged({ topic: `Problem number ${i}`, ...over }));
}

describe('the same problem, in the student’s own words', () => {
  it('reads past case, punctuation and spacing', () => {
    expect(sameTopic('Elasticity sign')).toBe(sameTopic('  elasticity, SIGN!  '));
  });

  it('does not read past different words', () => {
    // The trade-off `cardKey` states about its own hashing. Two entries a
    // student wrote differently are two problems as far as anything automatic
    // can tell, and guessing otherwise puts "you keep making this mistake"
    // over two unrelated notes.
    expect(sameTopic('Elasticity sign')).not.toBe(sameTopic('Sign of elasticity'));
  });
});

describe('a mistake that came back', () => {
  it('is one written down again after it was marked reviewed', () => {
    // Newest first, which is the order the journal stores them in.
    const out = findings(
      [logged({ topic: 'Elasticity sign' }), logged({ topic: 'elasticity sign', resolved: true })],
      'econ',
      TODAY,
    );
    expect(out).toContainEqual({ sort: 'cameback', topic: 'Elasticity sign', times: 2 });
  });

  it('is not one written twice and never reviewed', () => {
    // Two notes on a problem still being worked is not a mistake coming back.
    // It is a mistake being worked.
    const out = findings([logged({ topic: 'Elasticity sign' }), logged({ topic: 'Elasticity sign' })], 'econ', TODAY);
    expect(out.some((f) => f.sort === 'cameback')).toBe(false);
  });

  it('is not the newest entry being the reviewed one', () => {
    /*
     * Order is the whole claim. Reviewed *first*, then logged again, is a
     * mistake that came back; logged, then a second note that happens to be
     * ticked, is not. Entries are newest first, so the reviewed one has to be
     * further down the list.
     */
    const out = findings(
      [logged({ topic: 'Elasticity sign', resolved: true }), logged({ topic: 'Elasticity sign' })],
      'econ',
      TODAY,
    );
    expect(out.some((f) => f.sort === 'cameback')).toBe(false);
  });

  it('ignores a topic too short to be a topic', () => {
    // Two entries called "q" are not evidence of anything.
    const out = findings([logged({ topic: 'q' }), logged({ topic: 'q', resolved: true })], 'econ', TODAY);
    expect(out.some((f) => f.sort === 'cameback')).toBe(false);
  });

  it('counts how many times, and names it in the student’s own words', () => {
    const out = findings(
      [
        logged({ topic: 'Elasticity sign' }),
        logged({ topic: 'elasticity sign' }),
        logged({ topic: 'ELASTICITY SIGN', resolved: true }),
      ],
      'econ',
      TODAY,
    );
    const f = out.find((x) => x.sort === 'cameback');
    expect(f).toMatchObject({ times: 3, topic: 'Elasticity sign' });
    expect(says(f!)).toBe('“Elasticity sign” is in here 3 times, and you had marked it reviewed.');
  });
});

describe('a kind of mistake that dominates', () => {
  it('is reported once there is enough to divide', () => {
    const entries = [
      ...many(4, { kind: 'Units or sign' }),
      ...many(2, { kind: 'Calculation' }),
    ];
    const f = findings(entries, 'econ', TODAY).find((x) => x.sort === 'kind');
    expect(f).toEqual({ sort: 'kind', kind: 'Units or sign', n: 4, of: 6 });
    expect(says(f!)).toBe('4 of your 6 entries here are units or sign.');
  });

  it('says nothing about a journal with too little in it', () => {
    // Two of three is not a pattern, however tempting the fraction looks.
    const entries = [...many(2, { kind: 'Units or sign' }), ...many(1, { kind: 'Calculation' })];
    expect(entries).toHaveLength(ENOUGH - 2);
    expect(findings(entries, 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);
  });

  it('holds the line at four entries, which is where the floor actually decides', () => {
    /*
     * Three of one kind and one of another clears both the count and the
     * share — 3 is `LEAST`, and 3 of 4 is well over `A_SHARE` — so `ENOUGH` is
     * the only thing standing between a four-entry journal and a confident
     * claim about it. Written because a mutation that removed the floor
     * survived every other test in this file: the smaller cases were all being
     * caught by the count instead.
     */
    const four = [...many(3, { kind: 'Units or sign' }), logged({ topic: 'One other', kind: 'Evidence' })];
    expect(four).toHaveLength(ENOUGH - 1);
    expect(findings(four, 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);

    // And one more entry, of a kind that changes nothing else, and it speaks.
    const five = [...four, logged({ topic: 'And another', kind: 'Evidence' })];
    expect(findings(five, 'econ', TODAY).find((f) => f.sort === 'kind')).toEqual({
      sort: 'kind',
      kind: 'Units or sign',
      n: 3,
      of: 5,
    });
  });

  it('wants a count as well as a share, so 2 of 5 is not a finding', () => {
    const entries = [
      ...many(2, { kind: 'Units or sign' }),
      ...many(1, { kind: 'Calculation' }),
      ...many(1, { kind: 'Evidence' }),
      ...many(1, { kind: 'Formula' }),
    ];
    expect(2).toBeLessThan(LEAST);
    expect(2 / 5).toBeGreaterThan(A_SHARE);
    expect(findings(entries, 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);
  });

  it('wants a share as well as a count, so 3 of 30 is not a finding', () => {
    const entries = [
      ...many(3, { kind: 'Units or sign' }),
      ...Array.from({ length: 27 }, (_, i) =>
        logged({ topic: `Other ${i}`, kind: ['Calculation', 'Evidence', 'Formula'][i % 3] }),
      ),
    ];
    expect(findings(entries, 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);
  });

  /**
   * The trap this module is mostly written around.
   *
   * "What needs attention" opens on one of its eight options. A student who
   * never touches it produces a journal that is 100% that kind, and an app
   * reading the distribution would tell them they keep making that kind of
   * mistake — a finding about a dropdown, not about their learning, and
   * indistinguishable from the real thing in the stored data.
   */
  it('says nothing when every entry carries the same kind', () => {
    expect(findings(many(9, { kind: KIND_DEFAULT }), 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);
    // And not because the *default* is special — one kind everywhere is the
    // default, whatever it happens to be.
    expect(findings(many(9, { kind: 'Evidence' }), 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(false);
  });

  it('speaks as soon as a second kind shows the field is being chosen', () => {
    const entries = [...many(8, { kind: KIND_DEFAULT }), logged({ topic: 'One other', kind: 'Evidence' })];
    expect(varied(entries)).toBe(true);
    expect(VARIED).toBe(2);
    expect(findings(entries, 'econ', TODAY).some((f) => f.sort === 'kind')).toBe(true);
  });
});

describe('entries that were meant to be revisited', () => {
  it('counts the ones whose date has gone by', () => {
    const entries = [
      logged({ topic: 'A problem', review: '2026-09-01' }),
      logged({ topic: 'B problem', review: '2026-09-14' }),
      logged({ topic: 'C problem', review: '2026-09-30' }),
    ];
    const f = findings(entries, 'econ', TODAY).find((x) => x.sort === 'overdue');
    expect(f).toEqual({ sort: 'overdue', n: 2 });
    expect(says(f!)).toBe('2 entries are past the date you set to come back to them.');
  });

  it('does not count one you have already reviewed', () => {
    const entries = [logged({ topic: 'A problem', review: '2026-09-01', resolved: true })];
    expect(findings(entries, 'econ', TODAY).some((f) => f.sort === 'overdue')).toBe(false);
  });

  it('does not count one with no date on it', () => {
    // A date nobody set is not a date anybody missed.
    expect(findings([logged({ topic: 'A problem', review: '' })], 'econ', TODAY).some((f) => f.sort === 'overdue'))
      .toBe(false);
  });

  it('does not count today itself as gone by', () => {
    expect(findings([logged({ topic: 'A problem', review: TODAY })], 'econ', TODAY).some((f) => f.sort === 'overdue'))
      .toBe(false);
  });

  it('says one as one', () => {
    const f = findings([logged({ topic: 'A problem', review: '2026-09-01' })], 'econ', TODAY).find(
      (x) => x.sort === 'overdue',
    );
    expect(says(f!)).toBe('One entry is past the date you set to come back to it.');
  });
});

describe('which course it is reading', () => {
  it('never mixes one course’s journal into another’s', () => {
    const entries = [
      ...many(6, { courseId: 'econ', kind: 'Units or sign' }),
      ...many(6, { courseId: 'psci', kind: 'Evidence' }),
      logged({ courseId: 'econ', topic: 'A different one', kind: 'Evidence' }),
      logged({ courseId: 'psci', topic: 'Another different one', kind: 'Calculation' }),
    ];
    expect(findings(entries, 'econ', TODAY).find((f) => f.sort === 'kind')).toMatchObject({
      kind: 'Units or sign',
      of: 7,
    });
    expect(findings(entries, 'psci', TODAY).find((f) => f.sort === 'kind')).toMatchObject({
      kind: 'Evidence',
      of: 7,
    });
  });

  it('answers nothing for a course with no entries', () => {
    expect(findings(many(9, { courseId: 'econ', kind: 'Evidence' }), 'core', TODAY)).toEqual([]);
  });
});

describe('the strongest finding first', () => {
  it('puts a mistake that came back above a kind and above a date', () => {
    const entries = [
      logged({ topic: 'Elasticity sign', kind: 'Units or sign', review: '2026-09-01' }),
      logged({ topic: 'elasticity sign', kind: 'Units or sign', resolved: true }),
      ...many(3, { kind: 'Units or sign' }),
      logged({ topic: 'Something else', kind: 'Evidence' }),
    ];
    expect(findings(entries, 'econ', TODAY).map((f) => f.sort)).toEqual(['cameback', 'kind', 'overdue']);
  });
});

describe('when there is nothing to say', () => {
  it('says how many it is reading, rather than going quiet', () => {
    // Silent at four entries and speaking at five looks broken at four.
    expect(nothingYet(many(3), 'econ')).toBe('3 entries so far — too few to call anything a pattern.');
    expect(nothingYet([logged()], 'econ')).toBe('One entry so far — too few to call anything a pattern.');
  });

  it('says so plainly for a course with nothing in it', () => {
    expect(nothingYet([], 'econ')).toBe('Nothing logged for this course yet.');
  });

  it('explains the one thing the student can do about it', () => {
    // A journal filed entirely under one kind cannot produce a kind finding,
    // and the student is the only one who can change that.
    expect(nothingYet(many(9, { kind: KIND_DEFAULT }), 'econ')).toBe(
      '9 entries, all filed under one kind. Choose the kind as you go and this can say more.',
    );
  });

  it('says it is looking and finding nothing, when that is the truth', () => {
    /*
     * Twelve entries spread evenly over four kinds: three of each, which is a
     * quarter apiece and below the share a finding needs. Written out with a
     * topic each rather than through `many`, because the first version of this
     * test used five of one kind and four of another and was simply wrong —
     * five of nine *is* a majority, and the code was right to say so.
     */
    const kinds = ['Evidence', 'Calculation', 'Formula', 'Units or sign'];
    const entries = kinds.flatMap((kind, k) =>
      Array.from({ length: 3 }, (_, i) => logged({ topic: `Problem ${k}-${i}`, kind })),
    );
    expect(entries).toHaveLength(12);
    expect(findings(entries, 'econ', TODAY)).toEqual([]);
    expect(nothingYet(entries, 'econ')).toBe('12 entries, and nothing repeating yet.');
  });
});
