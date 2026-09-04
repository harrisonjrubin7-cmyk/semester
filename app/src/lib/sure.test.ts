import { describe, expect, it } from 'vitest';
import {
  ENOUGH,
  KEEP,
  beliefs,
  calibration,
  calibrationLine,
  caseOf,
  handle,
  readAnswers,
  remember,
  type Answer,
  type Sure,
} from './sure';

const AT = 1_788_000_000_000;

const answer = (got: boolean, sure: Sure, key = 'k1', at = AT): Answer => ({
  key,
  courseId: 'econ',
  got,
  sure,
  at,
});

const many = (n: number, got: boolean, sure: Sure): Answer[] =>
  Array.from({ length: n }, (_, i) => answer(got, sure, `k${i}`, AT + i));

describe('the four cases', () => {
  it('separates a confident miss from an ordinary one', () => {
    // The single highest-value row in the whole history.
    expect(caseOf({ got: false, sure: 'know' })).toBe('wrongSure');
    expect(caseOf({ got: false, sure: 'think' })).toBe('wrongUnsure');
    expect(caseOf({ got: false, sure: 'guess' })).toBe('wrongUnsure');
  });

  it('separates a lucky guess from knowing it', () => {
    expect(caseOf({ got: true, sure: 'guess' })).toBe('luckyGuess');
    expect(caseOf({ got: true, sure: 'think' })).toBe('rightSure');
    expect(caseOf({ got: true, sure: 'know' })).toBe('rightSure');
  });
});

describe('how the scheduler should treat it', () => {
  it('brings a confident miss back soon and says why', () => {
    const h = handle({ got: false, sure: 'know' });
    expect(h.treatAs).toBe(false);
    expect(h.soon).toBe(true);
    expect(h.because).toContain('belief');
  });

  it('does not let a guess start a long interval', () => {
    // Which is how a card disappears until the week of the exam.
    const h = handle({ got: true, sure: 'guess' });
    expect(h.treatAs).toBe(true);
    expect(h.soon).toBe(true);
    expect(h.because).toContain('closer to a miss');
  });

  it('leaves a settled right answer alone', () => {
    const h = handle({ got: true, sure: 'know' });
    expect(h.soon).toBe(false);
    expect(h.because).toBe('');
  });

  it('treats an admitted miss as ordinary', () => {
    expect(handle({ got: false, sure: 'guess' }).soon).toBe(false);
  });
});

describe('calibration', () => {
  it('says nothing on too little', () => {
    const c = calibration(many(3, true, 'know'));
    expect(c.enough).toBe(false);
    expect(calibrationLine(c)).toContain(`3 of ${ENOUGH}`);
  });

  it('puts two facts about the same person side by side', () => {
    const answers = [
      ...many(8, true, 'know'),
      ...many(2, false, 'know'),
      ...many(2, true, 'guess'),
      ...many(2, false, 'guess'),
    ];
    const said = calibrationLine(calibration(answers));
    expect(said).toContain('certain you were right 80%');
    expect(said).toContain('when you guessed, 50%');
  });

  it('names the confident misses, which is the point', () => {
    const answers = [...many(10, true, 'know'), ...many(3, false, 'know')];
    const c = calibration(answers);
    expect(c.wrongSure).toBe(3);
    expect(calibrationLine(c)).toContain('3 answers were wrong *and* certain');
  });

  it('is never a grade and never has a target', () => {
    // A graded calibration becomes a thing to optimise, and the way to
    // optimise it is to stop saying you are sure — which destroys the only
    // signal it had.
    const said = calibrationLine(calibration(many(20, true, 'know'))).toLowerCase();
    for (const word of ['score', 'grade', 'target', 'should be', 'well calibrated', 'poorly']) {
      expect(said).not.toContain(word);
    }
  });

  it('has something to say when nothing was ever certain', () => {
    const said = calibrationLine(calibration(many(14, true, 'think')));
    expect(said).toContain('not said you were certain');
  });

  it('does not divide by zero on a guessless log', () => {
    const said = calibrationLine(calibration(many(14, true, 'know')));
    expect(said).toBe('When you said you were certain you were right 100% of the time.');
  });
});

describe('the beliefs list', () => {
  it('collapses to the card and counts the repeats', () => {
    const answers = [
      answer(false, 'know', 'a', AT),
      answer(false, 'know', 'a', AT + 10),
      answer(false, 'know', 'b', AT + 20),
      answer(true, 'know', 'c', AT + 30),
      answer(false, 'guess', 'd', AT + 40),
    ];
    const out = beliefs(answers);
    expect(out.map((b) => b.key)).toEqual(['a', 'b']);
    expect(out[0].times).toBe(2);
    expect(out[0].at).toBe(AT + 10);
  });

  it('is empty when nothing was wrong and certain', () => {
    expect(beliefs(many(5, true, 'know'))).toEqual([]);
  });
});

describe('the log', () => {
  it('keeps a cap, dropping the oldest', () => {
    // Several terms of drilling, and the oldest is the least informative —
    // calibration is a thing about how you are now.
    let log: Answer[] = [];
    for (let i = 0; i < KEEP + 20; i++) log = remember(log, answer(true, 'know', `k${i}`, AT + i));
    expect(log).toHaveLength(KEEP);
    expect(log[0].key).toBe('k20');
  });

  it('drops a row with no recognisable confidence', () => {
    const stored = [answer(true, 'know'), { key: 'x', sure: 'sort of', got: true, at: AT }];
    expect(readAnswers(stored)).toHaveLength(1);
  });

  it('takes anything that is not a list as nothing', () => {
    expect(readAnswers(null)).toEqual([]);
    expect(readAnswers('x')).toEqual([]);
  });
});
