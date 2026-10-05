import { describe, expect, it } from 'vitest';
import type { Reviews } from './review';
import { cardIdentity } from './review';
import {
  EMPTY_READINESS,
  assessmentsAhead,
  markTopic,
  materialsFor,
  papersFor,
  readReadiness,
  recommend,
  signalLine,
  topicSignals,
  type Signals,
} from './study-readiness';
import type { Sitting } from './sitting';
import type { CourseUpdate, DatedItem, Unit } from './types';

/**
 * Phase H's Study Readiness model: the student's own marks, practice as
 * counts, one recommended session, labelled materials — and nothing that
 * predicts a grade or compares the student with anyone.
 */

const unit = (name: string, n: number): Unit => ({ name, mastery: 0, cards: Array.from({ length: n }, (_, i) => ({ q: `${name} q${i}`, a: 'a' })) });
const UNITS = [unit('Supply', 4), unit('Demand', 3), unit('Elasticity', 2)];
const NOW = 1_000_000;
const none: Signals = { cards: 0, seen: 0, right: 0, wrong: 0, due: 0 };

describe('assessments ahead', () => {
  it('are this course’s exams and heavy items, not past and not done', () => {
    const items = [
      { id: 'mid', c: 'econ', title: 'Midterm', kind: 'Exam', weight: '', isPast: false },
      { id: 'ps', c: 'econ', title: 'Problem set 3', kind: 'Problem set', weight: '5%', isPast: false },
      { id: 'proj', c: 'econ', title: 'Project', kind: 'Project', weight: '30%', isPast: false },
      { id: 'old', c: 'econ', title: 'Quiz exam', kind: 'Exam', weight: '', isPast: true },
      { id: 'done', c: 'econ', title: 'Final', kind: 'Exam', weight: '', isPast: false },
      { id: 'hist', c: 'hist', title: 'Midterm', kind: 'Exam', weight: '', isPast: false },
    ] as DatedItem[];
    expect(assessmentsAhead(items, 'econ', { done: true }).map((i) => i.id)).toEqual(['mid', 'proj']);
  });
});

describe('practice signals', () => {
  it('count cards practiced, right, missed and due — from the student’s own reviews', () => {
    const reviews: Reviews = {
      [cardIdentity('econ', UNITS[0].cards[0])]: { right: 3, wrong: 1, streak: 1, ease: 2.5, interval: 1, seen: 4, due: NOW - 1 },
      [cardIdentity('econ', UNITS[0].cards[1])]: { right: 2, wrong: 0, streak: 2, ease: 2.5, interval: 4, seen: 2, due: NOW + 1 },
    } as Reviews;
    const s = topicSignals('econ', UNITS[0], reviews, NOW);
    expect(s).toEqual({ cards: 4, seen: 2, right: 5, wrong: 1, due: 3 });
    expect(signalLine(s)).toBe('2 of 4 cards practiced · 5 right, 1 missed · 3 due now.');
    expect(signalLine({ ...none, cards: 3 })).toBe('3 cards, none practiced yet.');
  });

  it('shows practice papers as they were, newest first, for this course only', () => {
    const sit = (id: string, courseId: string, at: number) => ({ id, courseId, at }) as Sitting;
    expect(papersFor([sit('a', 'econ', 1), sit('b', 'hist', 3), sit('c', 'econ', 2)], 'econ').map((p) => p.id)).toEqual(['c', 'a']);
  });
});

describe('the recommended session', () => {
  const sig = [
    { ...none, cards: 4, due: 1 },
    { ...none, cards: 3, due: 3 },
    { ...none, cards: 2, due: 0 },
  ];

  it('goes to the topic the student marked Needs review, whatever else is due', () => {
    const r = recommend(UNITS, { 2: { status: 'needs_review', confidence: 3 } }, sig)!;
    expect(r.unit).toBe(2);
    expect(r.why).toBe('You marked Elasticity as needing review.');
    expect(r.minutes).toBe(25);
  });

  it('then unmarked topics, lowest confidence, most due', () => {
    const r = recommend(UNITS, { 0: { status: 'practicing', confidence: 1 } }, sig)!;
    expect(r.unit).toBe(1);
    expect(r.why).toBe('Demand is not marked yet, and 3 of its cards are due.');
    expect(r.steps[0]).toBe('Practice the 3 cards due in Demand (about 5 minutes).');
  });

  it('among practicing topics, the lowest confidence', () => {
    const marks = { 0: { status: 'practicing' as const, confidence: 4 }, 1: { status: 'practicing' as const, confidence: 2 }, 2: { status: 'reviewed' as const, confidence: 5 } };
    expect(recommend(UNITS, marks, sig)!.unit).toBe(1);
  });

  it('suggests nothing when every topic is reviewed and nothing is due', () => {
    const marks = { 0: { status: 'reviewed' as const, confidence: 5 }, 1: { status: 'reviewed' as const, confidence: 5 }, 2: { status: 'reviewed' as const, confidence: 5 } };
    expect(recommend(UNITS, marks, [none, none, none])).toBeNull();
  });

  it('never predicts a grade or compares the student with anyone', () => {
    const words = JSON.stringify([recommend(UNITS, {}, sig), signalLine(sig[0])]);
    expect(words).not.toMatch(/grade|score|pass|fail|likely|predict|percent|rank|other students|classmates|average/i);
  });
});

describe('materials for a topic', () => {
  it('are the prepared guide and what was added to that unit, labelled', () => {
    const updates = [
      { id: 'u1', courseId: 'econ', unit: 0, title: 'Reading 3', source: 'Ch. 3', fileIds: ['f1'] },
      { id: 'u2', courseId: 'econ', unit: 0, title: 'My summary', source: '', fileIds: [] },
      { id: 'u3', courseId: 'econ', unit: 1, title: 'Other unit', source: '', fileIds: [] },
    ] as CourseUpdate[];
    expect(materialsFor(0, UNITS[0], updates, 'econ', false)).toEqual([
      { title: 'Supply', detail: 'Prepared course guide, from your syllabus', label: 'imported' },
      { title: 'Reading 3', detail: 'Added material · Ch. 3', label: 'imported' },
      { title: 'My summary', detail: 'Added material', label: 'student_entered' },
    ]);
    expect(materialsFor(1, UNITS[1], updates, 'econ', true).map((m) => m.title)).toEqual(['Other unit']);
  });
});

describe('the device store', () => {
  it('keeps the student’s marks per assessment and topic, and refuses anything else', () => {
    const lib = markTopic(markTopic(EMPTY_READINESS, 'mid', 1, { status: 'practicing' }, 5), 'mid', 1, { confidence: 3 }, 6);
    expect(lib.byItem.mid).toEqual({ topics: { 1: { status: 'practicing', confidence: 3 } }, updated: 6 });
    expect(readReadiness(JSON.parse(JSON.stringify(lib)))).toEqual(lib);
    expect(() => readReadiness({ version: 1, byItem: { mid: { topics: { 1: { status: 'mastered', confidence: 3 } }, updated: 1 } } })).toThrow();
    expect(() => readReadiness({ version: 1, byItem: { mid: { topics: { 1: { status: null, confidence: 9 } }, updated: 1 } } })).toThrow();
    expect(() => readReadiness({ version: 1, byItem: { mid: { topics: { x: { status: null, confidence: null } }, updated: 1 } } })).toThrow();
  });
});
