import { describe, expect, it } from 'vitest';
import { EMPTY_QUIZ_FEEDBACK, leftOut, readQuizFeedback, report, reportFor, withdraw, type QuizReport } from './quiz-feedback';

const r = (key: string, extra: Partial<QuizReport> = {}): QuizReport => ({
  key,
  courseId: 'econ',
  q: 'What is opportunity cost?',
  reason: 'answer',
  at: 1_760_000_000_000,
  ...extra,
});

describe('quiz feedback', () => {
  it('keeps one report per card, the latest', () => {
    let f = report(EMPTY_QUIZ_FEEDBACK, r('econ:a'));
    f = report(f, r('econ:a', { reason: 'unclear' }));
    expect(f.reports).toHaveLength(1);
    expect(reportFor(f, 'econ:a')?.reason).toBe('unclear');
  });

  it('brings a card back only when its report is taken back', () => {
    const f = report(report(EMPTY_QUIZ_FEEDBACK, r('econ:a')), r('econ:b'));
    expect([...leftOut(f, 'econ')].sort()).toEqual(['econ:a', 'econ:b']);
    expect([...leftOut(withdraw(f, 'econ:a'), 'econ')]).toEqual(['econ:b']);
  });

  it('leaves cards out of their own course only', () => {
    const f = report(EMPTY_QUIZ_FEEDBACK, r('psci:a', { courseId: 'psci' }));
    expect(leftOut(f, 'econ').size).toBe(0);
    expect(leftOut(f, 'psci').has('psci:a')).toBe(true);
  });

  it('reads back what it wrote, and drops what it cannot trust', () => {
    const good = report(EMPTY_QUIZ_FEEDBACK, r('econ:a'));
    expect(readQuizFeedback(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(readQuizFeedback(null)).toEqual(EMPTY_QUIZ_FEEDBACK);
    expect(readQuizFeedback({ reports: 'x' })).toEqual(EMPTY_QUIZ_FEEDBACK);
    const mixed = readQuizFeedback({
      reports: [r('econ:a'), { ...r('econ:b'), reason: 'hate it' }, { ...r('econ:c'), at: 'yesterday' }, r('econ:a'), { ...r(''), key: '' }],
    });
    expect(mixed.reports.map((x) => x.key)).toEqual(['econ:a']);
  });
});
