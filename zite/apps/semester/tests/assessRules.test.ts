import { test, eq } from './harness';
import { validateQuestions, scoreAttempt, studentView, cleanAnswers, totalPoints, Question } from '../src/lib/assessRules';

const qs: Question[] = [
  { id: 'q1', type: 'single', prompt: 'Capital of France?', options: ['Paris', 'Rome'], answer: [0], points: 2 },
  { id: 'q2', type: 'multi', prompt: 'Primes?', options: ['2', '4', '5'], answer: [0, 2], points: 3 },
  { id: 'q3', type: 'short', prompt: 'Explain opportunity cost.', options: [], answer: [], points: 5 },
];
test('a valid set passes (control)', () => { eq(validateQuestions(qs), null); eq(totalPoints(qs), 10); });
test('invalid sets are refused', () => {
  eq(typeof validateQuestions([]), 'string');
  eq(typeof validateQuestions([{ ...qs[0], answer: [0, 1] }]), 'string');
  eq(typeof validateQuestions([{ ...qs[0], answer: [5] }]), 'string');
  eq(typeof validateQuestions([{ ...qs[0], options: ['only'] }]), 'string');
  eq(typeof validateQuestions([qs[0], { ...qs[1], id: 'q1' }]), 'string');
  eq(typeof validateQuestions([{ ...qs[2], answer: [0] }]), 'string');
  eq(typeof validateQuestions([{ ...qs[0], points: 0 }]), 'string');
});
test('students never see the key', () => eq(JSON.stringify(studentView(qs)).includes('answer'), false));
test('scoring: all-or-nothing per choice question; short answers need a person', () => {
  eq(scoreAttempt(qs, { q1: [0], q2: [2, 0], q3: 'Because...' }).auto, 5);
  eq(scoreAttempt(qs, { q1: [0], q2: [2, 0], q3: 'Because...' }).needsManual, true);
  eq(scoreAttempt(qs, { q1: [1], q2: [0] }).auto, 0);
  eq(scoreAttempt(qs, { q2: [0, 1, 2] }).auto, 0);
  eq(scoreAttempt(qs, {}).needsManual, false);
});
test('answers are cleaned to the frozen questions', () => {
  const c = cleanAnswers(qs, { q1: [0, 1], q2: [9, 2, 2], q3: 'x', qX: [0] } as never);
  eq(JSON.stringify(c), JSON.stringify({ q1: [0], q2: [2], q3: 'x' }));
});
