import { describe, expect, it } from 'vitest';
import {
  buildQuiz,
  distinctAnswers,
  isAnswered,
  matchableTerms,
  wordRight,
  wordableTerms,
  MATCH_PAIRS,
} from './quiz';
import type { Guide } from './types';

/**
 * A quiz is marked, so its mistakes cost somebody a score.
 *
 * Everything below is about the options rather than the questions: whether
 * four of them are genuinely different, whether the same sentence can appear
 * twice, and whether a run can be reproduced. A flashcard that misleads costs
 * a moment; a graded question that shows the right answer twice and marks one
 * copy wrong teaches a student to distrust the whole exercise.
 */

const guide = (cards: { q: string; a: string }[]): Guide => ({
  code: 'ECON 1020',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: [{ name: 'Supply', mastery: 0, cards }],
  terms: [],
});

/** Six cards with plainly different answers — the ordinary case. */
const SIX = guide(
  ['one', 'two', 'three', 'four', 'five', 'six'].map((n) => ({ q: `Question ${n}?`, a: `Answer ${n}.` })),
);

/**
 * Answers that share a long opening.
 *
 * This is what a study guide actually looks like: the generator is told to
 * answer "in full prose with the numbers in it", so formulaic answers run to
 * a couple of hundred characters and the first hundred of them are the same.
 */
const STEM =
  'The demand curve slopes downward because as the price of a good falls the quantity that buyers wish to purchase will ';
const SAME_OPENING = guide([
  { q: 'q1', a: `${STEM}rise, other things equal.` },
  { q: 'q2', a: `${STEM}increase across the market.` },
  { q: 'q3', a: `${STEM}expand considerably.` },
  { q: 'q4', a: `${STEM}grow steadily over time.` },
  { q: 'q5', a: 'Something else entirely.' },
]);

describe('buildQuiz', () => {
  it('asks up to ten questions, and no more', () => {
    const many = guide(Array.from({ length: 40 }, (_, i) => ({ q: `q${i}`, a: `a${i}` })));
    expect(buildQuiz(many, 1)).toHaveLength(10);
  });

  it('asks nothing at all of an empty guide', () => {
    expect(buildQuiz(guide([]), 1)).toEqual([]);
  });

  it('gives every choice question one right answer and three wrong ones', () => {
    const asked = buildQuiz(SIX, 1).filter((q) => q.kind === 'choice');
    // The control on the filter: a run that fielded no choice questions would
    // pass the loop below over nothing, which is what a broken builder looks
    // like too.
    expect(asked.length).toBeGreaterThan(0);
    for (const q of asked) {
      expect(q.opts).toHaveLength(4);
      expect(q.opts.filter((o) => o.ok)).toHaveLength(1);
    }
  });

  it('draws its decoys from real answers in the same guide', () => {
    // The whole point: every wrong option is true of something, so telling
    // them apart is the discrimination the exam asks for.
    const answers = new Set(SIX.units[0].cards.map((c) => c.a));
    const asked = buildQuiz(SIX, 3).filter((q) => q.kind === 'choice');
    expect(asked.length).toBeGreaterThan(0);
    for (const q of asked) {
      for (const opt of q.opts) expect(answers.has(opt.text)).toBe(true);
    }
  });

  it('keeps the full answer beside the clipped option', () => {
    // The option is trimmed to fit a phone without scrolling past the
    // question; the review afterwards shows what the guide actually says.
    const long = `${STEM}rise, other things equal, which is the law of demand.`;
    const withLong = guide([
      { q: 'Why does demand slope down?', a: long },
      { q: 'q2', a: 'Two' },
      { q: 'q3', a: 'Three' },
      { q: 'q4', a: 'Four' },
      { q: 'q5', a: 'Five' },
    ]);
    const asked = buildQuiz(withLong, 1).find((q) => q.kind === 'choice' && q.full === long);
    expect(asked).toBeTruthy();
    const shown = asked!.opts.find((o) => o.ok)!.text;
    expect(shown.length).toBeLessThan(long.length);
    expect(shown.endsWith('…')).toBe(true);
    expect(asked!.full).toBe(long);
  });

  it('repeats exactly for the same seed, and differs for another', () => {
    const asked = (seed: number) =>
      buildQuiz(SIX, seed).map((q) => `${q.q}|${q.opts.map((o) => o.text).join('/')}`);
    expect(asked(7)).toEqual(asked(7));
    expect(asked(7)).not.toEqual(asked(8));
  });

  it('survives a seed of zero rather than dividing into nothing', () => {
    expect(buildQuiz(SIX, 0).length).toBeGreaterThan(0);
  });

  it('never asks the same question twice in one run', () => {
    const qs = buildQuiz(SIX, 11).map((q) => q.q);
    expect(new Set(qs).size).toBe(qs.length);
  });
});

describe('options that would read as the same thing', () => {
  it('never shows one sentence twice in a single question', () => {
    /*
     * The decoys were de-duplicated on the raw answer and displayed clipped,
     * so two answers sharing their first hundred-odd characters arrived as one
     * option printed twice — with a tick on one copy. A student picking the
     * identical-looking one was marked wrong by a question that had asked them
     * to tell two things apart while showing them the same thing.
     */
    for (const seed of [1, 2, 3, 7, 42, 1000, 99999]) {
      for (const q of buildQuiz(SAME_OPENING, seed)) {
        const texts = q.opts.map((o) => o.text);
        expect(new Set(texts).size, `seed ${seed}`).toBe(texts.length);
      }
    }
  });

  it('asks nothing rather than offering a choice of two', () => {
    // Four cards, one answer between three of them. A two-option "multiple
    // choice" is a coin toss with a score attached.
    const thin = guide([
      { q: 'q1', a: 'The only other answer' },
      { q: 'q2', a: 'Shared' },
      { q: 'q3', a: 'Shared' },
      { q: 'q4', a: 'Shared' },
    ]);
    expect(buildQuiz(thin, 5)).toEqual([]);
  });

  it('still asks when there are exactly four different answers', () => {
    const just = guide([
      { q: 'q1', a: 'One' },
      { q: 'q2', a: 'Two' },
      { q: 'q3', a: 'Three' },
      { q: 'q4', a: 'Four' },
    ]);
    const out = buildQuiz(just, 5);
    expect(out.length).toBeGreaterThan(0);
    for (const q of out.filter((q) => q.kind === 'choice')) expect(q.opts).toHaveLength(4);
  });
});

describe('distinctAnswers', () => {
  it('counts what the student would actually see as different', () => {
    // Four long answers with one opening between them are one option, not
    // four, by the time they reach the screen.
    expect(distinctAnswers(SAME_OPENING)).toBe(2);
    expect(distinctAnswers(SIX)).toBe(6);
  });

  it('counts nothing for an empty guide', () => {
    expect(distinctAnswers(guide([]))).toBe(0);
  });

  it('is what decides whether the Study screen offers a quiz at all', () => {
    // The gate `lib/modes.ts` applies. A guide this thin must not be offered
    // as a mode and then open on nothing.
    const thin = guide([
      { q: 'q1', a: 'A' },
      { q: 'q2', a: 'A' },
      { q: 'q3', a: 'A' },
      { q: 'q4', a: 'B' },
    ]);
    expect(distinctAnswers(thin)).toBeLessThan(4);
    expect(buildQuiz(thin, 1)).toEqual([]);
  });
});

/**
 * A guide with key terms, which is what a matching question is cut from.
 *
 * Separate from `SIX` because the fixtures above deliberately carry no terms:
 * every assertion written before matching existed would otherwise start
 * seeing a kind it was not written for, and a test that quietly changes
 * subject is worse than one that fails.
 */
const TERMED = (): Guide => ({
  ...guide(
    ['one', 'two', 'three', 'four', 'five', 'six'].map((n) => ({
      q: `Question ${n}?`,
      a: `Answer ${n}.`,
    })),
  ),
  terms: [
    { t: 'Elasticity', d: 'How much quantity moves when price moves.' },
    { t: 'Surplus', d: 'The gap between what you would pay and what you did.' },
    { t: 'Marginal cost', d: 'What one more unit adds to total cost.' },
    { t: 'Deadweight loss', d: 'Trades worth making that no longer happen.' },
    { t: 'HHI', d: 'The sum of squared market shares.' },
  ],
});

describe('typed answers', () => {
  it('asks some, and the definition is the question', () => {
    const words = buildQuiz(TERMED(), 1).filter((q) => q.kind === 'word');
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      const term = TERMED().terms!.find((t) => t.t === w.full);
      expect(term, `${w.full} is not one of the guide's terms`).toBeDefined();
      expect(w.q).toBe(term!.d);
      // Nothing to pick. A word question that shipped options would be a
      // multiple choice with a keyboard in front of it.
      expect(w.opts).toEqual([]);
    }
  });

  it('never asks for the same term twice in a run', () => {
    for (const seed of [1, 2, 3, 7, 11, 23]) {
      const asked = buildQuiz(TERMED(), seed)
        .filter((q) => q.kind === 'word')
        .map((q) => q.full);
      expect(new Set(asked).size, `seed ${seed}`).toBe(asked.length);
    }
  });

  it('carries the other terms, so the marker can refuse an ambiguous answer', () => {
    for (const w of buildQuiz(TERMED(), 1).filter((q) => q.kind === 'word')) {
      expect(w.others).toBeDefined();
      expect(w.others).not.toContain(w.full);
      expect(w.others!.length).toBe(TERMED().terms!.length - 1);
    }
  });

  it('asks none of a guide with no key terms', () => {
    expect(buildQuiz(SIX, 1).filter((q) => q.kind === 'word')).toHaveLength(0);
  });

  /*
   * The giveaway rule, which is the one that needed real guides to find. A
   * definition that says the term back is a question with its answer printed
   * underneath it, and marking somebody right for reading is worse than not
   * asking. Checked on the normalised forms, so the echo is caught however it
   * was capitalised or hyphenated.
   */
  it('refuses a term its own definition gives away', () => {
    expect(
      wordableTerms({
        ...SIX,
        terms: [
          { t: 'Elasticity', d: 'Elasticity is how much quantity moves.' },
          { t: 'Surplus', d: 'the SURPLUS, roughly.' },
          { t: 'Marginal cost', d: 'What one more unit adds to total cost.' },
        ],
      }).map((t) => t.t),
    ).toEqual(['Marginal cost']);
  });

  /*
   * The control for it: a definition that merely contains the word as part of
   * a longer one is not a giveaway. `costly` is not `cost`, and a rule
   * matching on substrings rather than whole words would drop this term for
   * no reason.
   */
  it('control: a longer word containing the term is not a giveaway', () => {
    expect(
      wordableTerms({
        ...SIX,
        terms: [{ t: 'Cost', d: 'A costly business, measured per unit.' }],
      }).map((t) => t.t),
    ).toEqual(['Cost']);
  });

  it('refuses a term too long to type, and one with no definition', () => {
    expect(
      wordableTerms({
        ...SIX,
        terms: [
          { t: 'A'.repeat(33), d: 'Something.' },
          { t: 'Elasticity', d: '   ' },
          { t: 'Surplus', d: 'The gap.' },
        ],
      }).map((t) => t.t),
    ).toEqual(['Surplus']);
  });

  /*
   * Two entries that normalise to one term are one question, not two — the
   * second would be unanswerable-by-design, since typing either answer marks
   * whichever was asked.
   */
  it('keeps one of two terms that normalise the same', () => {
    expect(
      wordableTerms({
        ...SIX,
        terms: [
          { t: 'Cost-benefit', d: 'Weighing one against the other.' },
          { t: 'cost benefit', d: 'The same idea, spelled differently.' },
        ],
      })
    ).toHaveLength(1);
  });

  it('is answered only once something has been submitted', () => {
    const word = buildQuiz(TERMED(), 1).find((q) => q.kind === 'word')!;
    expect(isAnswered(word, null, {}, null)).toBe(false);
    expect(isAnswered(word, null, {}, '')).toBe(true);
    // A picked option is not an answer to a question with no options, which is
    // what would happen if the kinds shared a branch.
    expect(isAnswered(word, 0, {}, null)).toBe(false);
  });

  it('marks the term right and another term wrong', () => {
    const word = buildQuiz(TERMED(), 1).find((q) => q.kind === 'word')!;
    expect(wordRight(word, word.full)).toBe(true);
    expect(wordRight(word, word.others![0])).toBe(false);
    // And says nothing about a question of another kind, rather than throwing
    // or quietly marking it.
    const choice = buildQuiz(TERMED(), 1).find((q) => q.kind === 'choice')!;
    expect(wordRight(choice, choice.full)).toBe(false);
  });
});

describe('true-or-false', () => {
  it('asks some, and never as many as the whole run', () => {
    const out = buildQuiz(SIX, 1);
    const tf = out.filter((q) => q.kind === 'truefalse');
    expect(tf.length).toBeGreaterThan(0);
    expect(tf.length).toBeLessThan(out.length);
  });

  it('offers exactly True and False, with exactly one of them right', () => {
    for (const q of buildQuiz(SIX, 4).filter((q) => q.kind === 'truefalse')) {
      expect(q.opts.map((o) => o.text)).toEqual(['True', 'False']);
      expect(q.opts.filter((o) => o.ok)).toHaveLength(1);
    }
  });

  /*
   * The one that would cost a student a mark.
   *
   * A statement is false only because the answer under it belongs to a
   * different question. If the borrowed answer reads the same as the real
   * one, the honest response is "true" and the quiz marks it wrong — and
   * unlike a fourth option, there is nothing on screen to show it coming.
   */
  it('never proposes the right answer and calls it false', () => {
    for (const seed of [1, 2, 3, 7, 42, 1000, 99999]) {
      for (const q of buildQuiz(SIX, seed).filter((q) => q.kind === 'truefalse')) {
        const holds = q.opts.find((o) => o.text === 'True')!.ok;
        if (holds) expect(q.claim).toBe(q.full);
        else expect(q.claim).not.toBe(q.full);
      }
    }
  });

  it('keeps the real answer to reveal, whichever way the statement went', () => {
    const cards = new Map(SIX.units[0].cards.map((c) => [c.q, c.a]));
    for (const q of buildQuiz(SIX, 9).filter((q) => q.kind === 'truefalse')) {
      expect(q.full).toBe(cards.get(q.q));
      expect(q.claim).toBeTruthy();
    }
  });

  it('asks both ways across a spread of seeds, rather than always one', () => {
    // A generator stuck on "true" is a generator a student beats without
    // reading, and every individual run would still look correct.
    const said = new Set<boolean>();
    for (let seed = 1; seed < 40; seed++) {
      for (const q of buildQuiz(SIX, seed).filter((q) => q.kind === 'truefalse')) {
        said.add(q.opts.find((o) => o.text === 'True')!.ok);
      }
    }
    expect([...said].sort()).toEqual([false, true]);
  });
});

describe('matching', () => {
  it('asks one round when the guide has terms, and never two', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const matches = buildQuiz(TERMED(), seed).filter((q) => q.kind === 'match');
      expect(matches).toHaveLength(1);
      expect(matches[0].pairs).toHaveLength(MATCH_PAIRS);
    }
  });

  it('asks none at all when the guide has no terms', () => {
    // The control: `SIX` is the same deck without terms, so a matching
    // question appearing here would mean it is being invented rather than
    // cut from the guide.
    expect(buildQuiz(SIX, 1).filter((q) => q.kind === 'match')).toEqual([]);
  });

  it('shows every definition once, and knows which term owns it', () => {
    const q = buildQuiz(TERMED(), 3).find((q) => q.kind === 'match')!;
    expect([...(q.shown ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    // `shown` indexes into `pairs`, so the truth is `left i` ↔ `right i` and
    // the scramble is only about the order they are drawn in.
    expect(new Set(q.pairs!.map((p) => p.right)).size).toBe(MATCH_PAIRS);
    expect(new Set(q.pairs!.map((p) => p.left)).size).toBe(MATCH_PAIRS);
  });

  it('refuses two terms that share a definition', () => {
    // Two identical right-hand sides is a question a student can get wrong
    // while being right, which is the same fault the option de-duplication
    // above exists to prevent.
    const same = 'The same definition, twice.';
    const terms = [
      { t: 'A', d: same },
      { t: 'B', d: same },
      { t: 'C', d: 'Something else.' },
      { t: 'D', d: 'A third thing.' },
      { t: 'E', d: 'A fourth thing.' },
    ];
    expect(matchableTerms({ ...SIX, terms })).toHaveLength(4);
    const q = buildQuiz({ ...SIX, terms }, 2).find((q) => q.kind === 'match')!;
    expect(new Set(q.pairs!.map((p) => p.right)).size).toBe(MATCH_PAIRS);
  });

  it('asks nothing when there are too few terms to match', () => {
    const thin = { ...SIX, terms: [{ t: 'A', d: 'One.' }, { t: 'B', d: 'Two.' }] };
    expect(buildQuiz(thin, 1).filter((q) => q.kind === 'match')).toEqual([]);
  });
});

describe('the run as a whole', () => {
  it('never asks one card twice, across kinds', () => {
    // A card asked as a choice and again as a true-or-false is the same
    // question with its answer already given away by the first of them.
    for (const seed of [1, 2, 3, 7, 42, 1000]) {
      const asked = buildQuiz(TERMED(), seed).map((q) => q.q);
      expect(new Set(asked).size).toBe(asked.length);
    }
  });

  it('still repeats exactly for the same seed, with the new kinds in it', () => {
    const shape = (seed: number) =>
      buildQuiz(TERMED(), seed)
        .map((q) => `${q.kind}|${q.q}|${q.claim ?? ''}|${(q.shown ?? []).join('')}`)
        .join('\n');
    expect(shape(5)).toBe(shape(5));
    expect(shape(5)).not.toBe(shape(6));
  });

  it('mixes every kind when the guide can field them', () => {
    const kinds = new Set(buildQuiz(TERMED(), 1).map((q) => q.kind));
    expect([...kinds].sort()).toEqual(['choice', 'match', 'truefalse', 'word']);
  });
});
