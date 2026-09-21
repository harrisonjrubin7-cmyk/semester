import { describe, expect, it } from 'vitest';
import { buildQuiz } from './quiz';
import { LEAVE, ladderFor } from './ladder';
import { buildCatalog } from '../data/catalog';
import ECON from '../data/courses/econ';
import PSCI from '../data/courses/psci';
import BUS from '../data/courses/bus';
import CORE from '../data/courses/core';

/**
 * How thick the ladder actually is, on the decks the app ships with.
 *
 * `ladder.test.ts` proves each rule on a fixture. A fixture is written by the
 * same person as the code and agrees with it by construction, so it cannot
 * answer the question that decides whether this feature is worth having: on a
 * real question, from a real guide, how much help is there?
 *
 * The first answer was **not much**. Striking a pair of options in one rung
 * used the whole narrowing in a single press, and across the four decks:
 *
 *     ECON 1020   rungs 1,1,1,2,1,1,2,2,2,1   4 of 10 with two or more
 *     PSCI 1104   rungs 2,2,1,1,1,2,1,2,2,2   6 of 10
 *     BUS 1600    rungs 1,2,1,2,2,1,2,1,1,2   5 of 10
 *     CORE 2500   rungs 1,1,1,1,2,1,1,1,1,1   1 of 10
 *
 * Sixteen of forty. A ladder offering one rung on most questions is a "take
 * two away" button with a longer name, and no unit test was ever going to say
 * so. Striking one option at a time took it to forty of forty, at the cost of
 * eight lines.
 *
 * The floor below is deliberately under what the tree does today — it is here
 * to catch the feature quietly emptying out, not to pin the exact numbers,
 * which move whenever a guide gains a term or a deck gains a card.
 */
const catalog = buildCatalog([ECON, PSCI, BUS, CORE]);

/** Every question must be able to offer at least this many rungs. */
const FLOOR = 2;

/** How few choice questions in a run of ten would make this census thin. */
const ENOUGH = 4;

describe('the ladder on the shipped decks', () => {
  const rows = catalog.courses.map((c) => {
    const guide = catalog.guides[c.id]!;
    const run = buildQuiz(guide, 1);
    /*
     * Multiple choice only, because that is the only kind the ladder is
     * offered on — see `screens/Drill.tsx`. Its useful rung strikes options
     * out, and striking one of a true-or-false's two is the answer rather
     * than a hint; a matching question has no options at all.
     *
     * Filtering rather than dropping the census: the question it exists to
     * answer — on a real question from a real guide, how much help is there —
     * is still asked of every question that can be helped.
     */
    const quiz = run.filter((q) => q.kind === 'choice');
    return {
      code: guide.code,
      run,
      counts: quiz.map((q) => ladderFor(q, guide.terms ?? []).length),
      quiz,
      guide,
    };
  });

  it('has four decks with ten questions each to measure', () => {
    // The census is worthless if the decks came back empty and every "no
    // question fell short" below passed over nothing. This is the control.
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.run.length, r.code).toBe(10);
  });

  it('still fields enough multiple choice for the census to mean anything', () => {
    // The second half of that control, now that a run is a mix: a change
    // that quietly turned every question into a true-or-false would leave
    // the assertions below passing over almost nothing.
    for (const r of rows) expect(r.quiz.length, r.code).toBeGreaterThanOrEqual(ENOUGH);
  });

  it('offers at least two rungs on every question in every deck', () => {
    const thin = rows.flatMap((r) =>
      r.counts.map((n, i) => ({ code: r.code, i, n })).filter((x) => x.n < FLOOR),
    );
    expect(thin, `questions with fewer than ${FLOOR} rungs`).toEqual([]);
  });

  it('never leaves fewer than two options standing', () => {
    for (const r of rows) {
      for (const q of r.quiz) {
        const last = ladderFor(q, r.guide.terms ?? [])
          .filter((rung) => rung.kind === 'narrow')
          .at(-1);
        expect(q.opts.length - (last?.out?.length ?? 0), `${r.code}: ${q.q}`).toBeGreaterThanOrEqual(
          LEAVE,
        );
      }
    }
  });

  it('never quotes an opening that is on screen as an option', () => {
    // The failure a screenshot caught: the correct option *is* the answer in
    // this quiz, so the opening rung pointed straight at it.
    for (const r of rows) {
      for (const q of r.quiz) {
        for (const rung of ladderFor(q, r.guide.terms ?? [])) {
          if (rung.kind !== 'opening') continue;
          const head = rung.says.toLowerCase();
          for (const o of q.opts) {
            const first = o.text.toLowerCase().slice(0, 24);
            expect(head.includes(first), `${r.code}: ${q.q}`).toBe(false);
          }
        }
      }
    }
  });

  it('never puts the full answer in a rung', () => {
    for (const r of rows) {
      for (const q of r.quiz) {
        for (const rung of ladderFor(q, r.guide.terms ?? [])) {
          expect(rung.says, `${r.code}: ${q.q}`).not.toContain(q.full);
        }
      }
    }
  });
});
