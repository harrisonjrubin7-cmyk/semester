import { describe, expect, it } from 'vitest';
import { shortLength, shortsFor } from '../../../video/src/shorts';
import type { Lesson } from './types';
import econ from '../data/courses/econ/lessons';

/**
 * Cutting a unit's narration into one short per card.
 *
 * The rule lives in `video/src/shorts.ts` with the composition that draws it;
 * the guard lives here because this is where CI runs, and the module is pure —
 * no React, no `remotion` import — so vitest reads it across the root for
 * nothing. Same arrangement as `slidefit.test.ts`, for the same reason.
 *
 * What makes this worth guarding is that it is arithmetic over somebody else's
 * output. `pipeline/lessons.py` decides where a cue falls; this decides where
 * a card starts and stops inside the file. Get the boundary wrong by one cue
 * and every short in the app answers the previous card's question.
 */

const lesson = (cues: Lesson['cues'], seconds = 100): Lesson => ({
  unit: 3,
  title: 'Supply, demand, equilibrium',
  file: '/audio/lessons/econ/unit-3.mp3',
  seconds,
  len: '1:40',
  cues,
});

describe('cutting a unit into shorts', () => {
  it('pairs each question with the answer that follows it', () => {
    const shorts = shortsFor(
      lesson([
        { at: 0, kind: 'title', text: 'Supply, demand, equilibrium' },
        { at: 5, kind: 'q', text: 'Q1' },
        { at: 9, kind: 'a', text: 'A1' },
        { at: 20, kind: 'q', text: 'Q2' },
        { at: 24, kind: 'a', text: 'A2' },
        { at: 40, kind: 'close', text: 'That is the unit' },
      ]),
    );
    expect(shorts.map((s) => [s.question, s.answer])).toEqual([
      ['Q1', 'A1'],
      ['Q2', 'A2'],
    ]);
  });

  it('runs each short from its question to the next card, not to the answer', () => {
    // The answer is the middle of a short, never its end. Ending on the answer
    // cue would cut every short off the instant the payoff started.
    const [first, second] = shortsFor(
      lesson([
        { at: 0, kind: 'title', text: 'T' },
        { at: 5, kind: 'q', text: 'Q1' },
        { at: 9, kind: 'a', text: 'A1' },
        { at: 20, kind: 'q', text: 'Q2' },
        { at: 24, kind: 'a', text: 'A2' },
        { at: 40, kind: 'close', text: 'C' },
      ]),
    );
    expect([first.start, first.answerAt, first.end]).toEqual([5, 9, 20]);
    expect([second.start, second.answerAt, second.end]).toEqual([20, 24, 40]);
  });

  it('ends the last card at the end of the narration when nothing follows', () => {
    const [only] = shortsFor(
      lesson(
        [
          { at: 0, kind: 'title', text: 'T' },
          { at: 5, kind: 'q', text: 'Q' },
          { at: 9, kind: 'a', text: 'A' },
        ],
        77,
      ),
    );
    expect(only.end).toBe(77);
  });

  it('skips a question with no answer rather than inventing one', () => {
    expect(
      shortsFor(
        lesson([
          { at: 0, kind: 'title', text: 'T' },
          { at: 5, kind: 'q', text: 'Orphan' },
          { at: 9, kind: 'close', text: 'C' },
        ]),
      ),
    ).toEqual([]);
  });

  it('finds nothing in a unit that has no cues', () => {
    expect(shortsFor(lesson([]))).toEqual([]);
  });

  it('numbers cards from zero within their unit', () => {
    const shorts = shortsFor(
      lesson([
        { at: 0, kind: 'title', text: 'T' },
        { at: 5, kind: 'q', text: 'Q1' },
        { at: 9, kind: 'a', text: 'A1' },
        { at: 20, kind: 'q', text: 'Q2' },
        { at: 24, kind: 'a', text: 'A2' },
      ]),
    );
    expect(shorts.map((s) => s.card)).toEqual([0, 1]);
  });

  it('cuts a real unit into shorts that tile it without gaps or overlaps', () => {
    /*
     * ECON unit 3 as it actually shipped, rather than a fixture. Every short
     * must start where the last one ended, or a card's audio is either played
     * twice or lost between two clips — the failure that would be invisible
     * in a fixture with tidy round numbers.
     */
    const shorts = shortsFor(econ[3]);
    expect(shorts.length).toBeGreaterThan(0);
    for (let i = 1; i < shorts.length; i += 1) {
      expect(shorts[i].start).toBe(shorts[i - 1].end);
    }
    for (const s of shorts) {
      expect(s.start).toBeLessThan(s.answerAt);
      expect(s.answerAt).toBeLessThan(s.end);
      expect(s.end).toBeLessThanOrEqual(econ[3].seconds);
      // Long enough to say something, short enough to be a short. Measured
      // across all four courses: 8.4s to 35.5s, median 14.8s.
      expect(shortLength(s)).toBeGreaterThan(5);
      expect(shortLength(s)).toBeLessThan(60);
    }
  });
});
