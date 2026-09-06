import { describe, expect, it } from 'vitest';
import { buildQuiz, distinctAnswers } from './quiz';
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

  it('gives every question one right answer and three wrong ones', () => {
    for (const q of buildQuiz(SIX, 1)) {
      expect(q.opts).toHaveLength(4);
      expect(q.opts.filter((o) => o.ok)).toHaveLength(1);
    }
  });

  it('draws its decoys from real answers in the same guide', () => {
    // The whole point: every wrong option is true of something, so telling
    // them apart is the discrimination the exam asks for.
    const answers = new Set(SIX.units[0].cards.map((c) => c.a));
    for (const q of buildQuiz(SIX, 3)) {
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
    const asked = buildQuiz(withLong, 1).find((q) => q.full === long);
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
    for (const q of out) expect(q.opts).toHaveLength(4);
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
