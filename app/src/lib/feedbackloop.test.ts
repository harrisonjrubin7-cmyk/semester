import { describe, expect, it } from 'vitest';
import { CATEGORIES, THEME_FLOOR, actionsFor, nothingYet, says, taskFrom, themes, type Category, type FeedbackItem } from './feedbackloop';

const item = (patch: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: 'f1',
  courseId: 'c1',
  work: 'Essay 1',
  origin: 'Marked paper',
  comment: 'Several claims have no support.',
  category: 'Evidence and citation',
  next: '',
  filed: '2026-09-30',
  ...patch,
});

const many = (category: Category, works: string[], courseId = 'c1') =>
  works.map((w, i) => item({ id: `${category}-${i}`, category, work: w, courseId }));

describe('feedback-to-action', () => {
  it('offers at least one explained action for every category', () => {
    for (const c of CATEGORIES) {
      const a = actionsFor(c);
      expect(a.length, c).toBeGreaterThan(0);
      for (const x of a) {
        expect(x.title).not.toBe('');
        expect(x.why).not.toBe('');
      }
    }
  });

  it('is silent below the floor', () => {
    expect(themes(many('Communication', ['A', 'B']))).toEqual([]);
    expect(THEME_FLOOR).toBe(3);
  });

  it('does not call one assignment filed three times a trend', () => {
    expect(themes(many('Communication', ['A', 'A', 'a']))).toEqual([]);
  });

  it('speaks once a category recurs across pieces of work', () => {
    const t = themes(many('Communication', ['A', 'B', 'C']));
    expect(t).toEqual([{ category: 'Communication', count: 3, works: 3 }]);
    expect(says(t[0])).toMatch(/3 pieces of work/);
  });

  it('can be read for one course or across all of them', () => {
    const items = [...many('Communication', ['A', 'B'], 'c1'), ...many('Communication', ['C'], 'c2')];
    expect(themes(items, 'c1')).toEqual([]);
    expect(themes(items)).toHaveLength(1);
  });

  it('never ranks, predicts or labels', () => {
    const words = [says({ category: 'Communication', count: 3, works: 3 }), ...CATEGORIES.flatMap((c) => actionsFor(c).map((a) => a.title + a.why))].join(' ');
    expect(words).not.toMatch(/\b(at risk|weak|predict|rank|grade will|likely to fail)\b/i);
  });

  it('says what to do when empty and how many are filed otherwise', () => {
    expect(nothingYet([])).toMatch(/Nothing filed/);
    expect(nothingYet([item()])).toMatch(/^1 filed/);
  });

  it('turns an action into a task that keeps the original comment and adds no date', () => {
    const it1 = item();
    const first = actionsFor(it1.category)[0];
    const task = taskFrom(it1, first);
    expect(task.date).toBeNull();
    expect(task.note).toContain(it1.comment);
    expect(task.from).toBe(`feedback:f1:${first.title}`);
  });
});
