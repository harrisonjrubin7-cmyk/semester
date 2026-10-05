import { describe, expect, it } from 'vitest';
import { buildAgenda, candidates } from './officeagenda';
import type { FeedbackItem } from './feedbackloop';
import type { OwnConcept } from './learningmap';

const own = (patch: Partial<OwnConcept>): OwnConcept => ({ id: 'o1', courseId: 'c1', name: 'Confounders', note: 'when do they matter?', label: 'Not started', question: true, ...patch });
const fb = (patch: Partial<FeedbackItem> = {}): FeedbackItem => ({ id: 'f1', courseId: 'c1', work: 'Essay 1', origin: 'Marked paper', comment: 'Claims need support.', category: 'Evidence and citation', next: '', filed: '2026-09-30', ...patch });

describe('office-hours agenda', () => {
  it('offers private questions, review-later concepts, feedback and review concepts for this course only', () => {
    const c = candidates({
      courseId: 'c1',
      own: [own({}), own({ id: 'o2', name: 'Elasticity', question: false, label: 'Review later' }), own({ id: 'o3', name: 'Skip me', question: false, label: 'Exploring' }), own({ id: 'o4', courseId: 'c2', name: 'Other course' })],
      feedback: [fb(), fb({ id: 'f2', courseId: 'c2' })],
      review: ['Supply and demand'],
    });
    expect(c.map((x) => x.title)).toEqual(['Confounders', 'Elasticity', 'Essay 1 — Evidence and citation', 'Supply and demand']);
    expect(c.map((x) => x.kind)).toEqual(['question', 'question', 'feedback', 'review']);
  });

  it('never chooses for the student: the agenda holds exactly what was chosen', () => {
    const all = candidates({ courseId: 'c1', own: [own({}), own({ id: 'o2', name: 'A private worry', note: 'embarrassing detail' })], feedback: [fb()], review: [] });
    const text = buildAgenda({ course: 'ECON 1020', goal: '', tried: '', chosen: [all[0]] });
    expect(text).toContain('Confounders');
    expect(text).not.toContain('A private worry');
    expect(text).not.toContain('embarrassing detail');
    expect(text).not.toContain('Claims need support');
  });

  it('control: choosing everything does include everything', () => {
    const all = candidates({ courseId: 'c1', own: [own({}), own({ id: 'o2', name: 'A private worry' })], feedback: [fb()], review: ['Supply'] });
    const text = buildAgenda({ course: 'ECON 1020', goal: 'Understand confounders', tried: 'Reread ch. 3', chosen: all });
    for (const s of ['Confounders', 'A private worry', 'Claims need support', 'Supply', 'Understand confounders', 'Reread ch. 3']) expect(text).toContain(s);
  });

  it('orders sections questions, feedback, review whatever the order chosen', () => {
    const all = candidates({ courseId: 'c1', own: [own({})], feedback: [fb()], review: ['Supply'] });
    const text = buildAgenda({ course: 'X', goal: '', tried: '', chosen: [...all].reverse() });
    expect(text.indexOf('Questions')).toBeLessThan(text.indexOf('Feedback'));
    expect(text.indexOf('Feedback')).toBeLessThan(text.indexOf('Concepts'));
  });

  it('says so when nothing is chosen, and gives no advice or judgement', () => {
    const text = buildAgenda({ course: 'X', goal: '', tried: '', chosen: [] });
    expect(text).toMatch(/Nothing chosen yet/);
    const full = buildAgenda({ course: 'X', goal: 'g', tried: 't', chosen: candidates({ courseId: 'c1', own: [own({})], feedback: [fb()], review: ['S'] }) });
    expect(full).not.toMatch(/\b(you should|weak|at risk|behind|predict)\b/i);
  });
});
