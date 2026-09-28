import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_KEY,
  KEEP_MS,
  NOT_KEPT_LINE,
  answered,
  begun,
  dayOf,
  finished,
  offerLine,
  putBackLine,
  readAttempt,
  receiptLine,
  secondsLeft,
  timeOf,
  withAnswers,
  type Attempt,
} from './examattempt';
import type { Question } from './exam';

const q = (id: string, kind: Question['kind'] = 'choice'): Question => ({
  id,
  kind,
  prompt: `Question ${id}`,
  options: kind === 'choice' ? ['a', 'b', 'c', 'd'] : [],
  answer: kind === 'choice' ? '1' : 'model',
  why: 'because',
  points: kind === 'long' ? 5 : 1,
});

const questions = [q('1'), q('2', 'short'), q('3', 'long'), q('4')];

// A Tuesday afternoon, local time, so the wording below is about the reader's clock.
const AT = new Date(2026, 8, 29, 15, 10, 0).getTime();
const MIN = 60_000;

const paper = (): Attempt =>
  begun({ title: 'PSCI 1150 · paper 7PS4', course: 'PSCI 1150', guideId: 'psci', seed: 12345, minutes: 30, questions }, AT);

describe('a paper begun', () => {
  it('starts with no answers and the whole clock', () => {
    const a = paper();
    expect(a.answers).toEqual({});
    expect(a.startedAt).toBe(AT);
    expect(a.finishedAt).toBeUndefined();
    expect(secondsLeft(a, AT)).toBe(30 * 60);
  });

  it('keeps its own key and week', () => {
    expect(ATTEMPT_KEY).toBe('semester.exam-attempt.v1');
    expect(KEEP_MS).toBe(7 * 86_400_000);
  });
});

describe('the clock', () => {
  it('runs by the wall clock, not by ticks the screen counted', () => {
    const a = paper();
    expect(secondsLeft(a, AT + 12 * MIN)).toBe(18 * 60);
    expect(secondsLeft(a, AT + 12 * MIN + 30_000)).toBe(18 * 60 - 30);
  });

  it('stops at zero rather than going negative', () => {
    expect(secondsLeft(paper(), AT + 45 * MIN)).toBe(0);
  });

  it('has nothing left to count once the paper is finished', () => {
    expect(secondsLeft(finished(paper(), AT + 5 * MIN), AT + 6 * MIN)).toBe(0);
  });
});

describe('answers and finishing', () => {
  it('counts a question as answered once something is written or chosen', () => {
    const a = withAnswers(paper(), { '1': { given: '2' }, '3': { given: 'an essay' }, '4': { given: '' } }, AT + MIN);
    expect(answered(a)).toBe(2);
    expect(a.at).toBe(AT + MIN);
  });

  it('a flag alone is not an answer', () => {
    expect(answered(withAnswers(paper(), { '2': { given: '', flagged: true } }, AT))).toBe(0);
  });

  it('records when Finish was pressed, and keeps the first time when pressed twice', () => {
    const once = finished(paper(), AT + 20 * MIN);
    expect(once.finishedAt).toBe(AT + 20 * MIN);
    expect(finished(once, AT + 25 * MIN).finishedAt).toBe(AT + 20 * MIN);
  });
});

describe('reading a kept paper back', () => {
  const round = (a: Attempt, now = AT) => readAttempt(JSON.stringify(a), now);

  it('is the paper that was written, answers, flags and marks included', () => {
    const a = withAnswers(paper(), { '1': { given: '1' }, '2': { given: 'x', flagged: true }, '3': { given: 'y', mark: 'partly' } }, AT + MIN);
    expect(round(a)).toEqual(a);
    expect(round(finished(a, AT + 2 * MIN))).toEqual(finished(a, AT + 2 * MIN));
  });

  it('reads nothing from nothing, and from text that is not a paper', () => {
    expect(readAttempt(null, AT)).toBeNull();
    expect(readAttempt('', AT)).toBeNull();
    expect(readAttempt('{not json', AT)).toBeNull();
    expect(readAttempt('[]', AT)).toBeNull();
    expect(readAttempt('{"title":"x"}', AT)).toBeNull();
  });

  it('refuses a paper with a question it cannot read, rather than putting back fewer questions', () => {
    const a = paper();
    const broken = { ...a, questions: [...a.questions, { id: '5', kind: 'essay', prompt: 'p', options: [], answer: '', points: 1 }] };
    expect(readAttempt(JSON.stringify(broken), AT)).toBeNull();
    const empty = { ...a, questions: [] };
    expect(readAttempt(JSON.stringify(empty), AT)).toBeNull();
  });

  it('drops an answer it cannot read, and keeps the rest', () => {
    const a = paper();
    const odd = { ...a, answers: { '1': { given: '2' }, '2': 'not an answer', '3': { given: 'z', mark: 'best' } } };
    expect(readAttempt(JSON.stringify(odd), AT)?.answers).toEqual({ '1': { given: '2' }, '3': { given: 'z' } });
  });

  it('fills in what an older write left out', () => {
    const a = paper();
    const { course: _c, seed: _s, ...without } = a;
    expect(readAttempt(JSON.stringify(without), AT)).toEqual({ ...a, course: '', seed: null });
  });

  it('forgets a paper after a week of quiet, and not a moment before', () => {
    const a = withAnswers(paper(), { '1': { given: '1' } }, AT);
    expect(round(a, AT + KEEP_MS)).toEqual(a);
    expect(round(a, AT + KEEP_MS + 1)).toBeNull();
  });
});

describe('what is said', () => {
  // The clock and the day come from `lib/locale.ts`, so the expected strings
  // are built the same way rather than written as English by hand — with no
  // locale chosen, that is the device's own formatting, whatever it is.
  const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  it('tells the time and the day through the locale', () => {
    expect(timeOf(AT)).toBe(clock(AT));
    expect(timeOf(AT)).toMatch(/10/);
    expect(dayOf(AT, AT)).toBe(day(AT));
    expect(dayOf(AT, AT)).not.toMatch(/2026/);
    expect(dayOf(AT, new Date(2027, 0, 2).getTime())).toMatch(/2026/);
  });

  it('offers a paper back by how far it got and how much clock is left', () => {
    const a = withAnswers(paper(), { '1': { given: '1' }, '2': { given: 'x' } }, AT + 5 * MIN);
    expect(offerLine(a, AT + 12 * MIN)).toBe(`Begun at ${clock(AT)}, 2 of 4 answered, 18 min left.`);
    expect(offerLine(a, AT + 40 * MIN)).toBe(`Begun at ${clock(AT)}, 2 of 4 answered, time is up.`);
    expect(offerLine(a, AT + 26 * 60 * MIN)).toBe(`Begun on ${day(AT)} at ${clock(AT)}, 2 of 4 answered, time is up.`);
  });

  it('offers a finished paper back for its marking', () => {
    const a = finished(withAnswers(paper(), { '1': { given: '1' } }, AT), AT + 20 * MIN);
    expect(offerLine(a, AT + 30 * MIN)).toBe(`Finished at ${clock(AT + 20 * MIN)}, 1 of 4 answered. The marking is still here.`);
  });

  it('says what happened to the clock when the paper is put back', () => {
    const a = paper();
    expect(putBackLine(a, AT + 12 * MIN)).toBe('Put back where you left it, with 18 min still on the clock.');
    expect(putBackLine(a, AT + 31 * MIN)).toBe('Put back where you left it. The clock kept running while you were away, and it has run out.');
    expect(putBackLine(finished(a, AT + 20 * MIN), AT + 30 * MIN)).toBe(`Put back as you finished it at ${clock(AT + 20 * MIN)}.`);
  });

  it('gives a receipt with the time, the count, and where it is kept', () => {
    const a = finished(withAnswers(paper(), { '1': { given: '1' }, '4': { given: '0' } }, AT), AT + 22 * MIN);
    expect(receiptLine(a, AT + 22 * MIN)).toBe(
      `Finished at ${clock(AT + 22 * MIN)} — 2 of 4 answered. Kept on this device until you start another paper.`,
    );
  });
});

describe('the Exam screen keeps the paper through this file', () => {
  // Structural, the way `decisionlabels.test.ts` is: the logic above is
  // tested on its own, and this holds the screen to using it. A screen that
  // drops the write-through, the offer or the receipt goes red here, which a
  // test of the pure functions could never notice.
  const screen = readFileSync(new URL('../screens/Exam.tsx', import.meta.url), 'utf8');

  it('reads the kept paper when it opens, and offers it back on the guide it was built from', () => {
    expect(screen).toContain('readAttempt(localStorage.getItem(ATTEMPT_KEY)');
    expect(screen).toContain('paper && paper.guideId === state.guideId ? { paper, line: offerLine(paper, now) } : null');
    expect(screen).toContain('onClick={() => resume(offer.paper)}');
  });

  it('writes every answer through as it is given, and says so only when the write took', () => {
    expect(screen).toMatch(/withAnswers\(attempt\.current, answers, Date\.now\(\)\);\s*setKeptOk\(storeAttempt\(attempt\.current\)\);/);
    expect(screen).toContain('{kept_ ? KEPT_LINE : NOT_KEPT_LINE}');
    expect(NOT_KEPT_LINE).toMatch(/not keeping your answers/);
    expect(NOT_KEPT_LINE).not.toMatch(/still here/);
  });

  it('records the finish, says so, and forgets the paper only on "Another paper"', () => {
    expect(screen).toContain('finished(withAnswers(attempt.current, answers, now), now)');
    expect(screen).toContain('setReceipt(receiptLine(attempt.current, now))');
    expect(screen).toMatch(/onClick=\{\(\) => \{\s*forget\(\);\s*setStage\('setup'\);/);
  });
});
