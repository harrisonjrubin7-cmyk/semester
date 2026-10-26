import { test, eq } from './harness';
import { next, createsCycle, syllabusBlocker, prereqBlocker, codesIn, normCode } from '../src/lib/curriculumRules';

const S = { weeks: 15, assessments: [{ name: 'Midterm', weight: 40 }, { name: 'Final', weight: 60 }], policies: 'Attendance expected; late work loses 10% per day.' };
const O = ['Explain supply and demand equilibrium.'];

test('governance path (control)', () => {
  eq(next('submitted', 'endorse', 'chair'), 'chair_endorsed');
  eq(next('chair_endorsed', 'approve', 'committee'), 'committee_approved');
});
test('order and roles are enforced', () => {
  eq(next('submitted', 'approve', 'committee'), null);
  eq(next('submitted', 'endorse', 'committee'), null);
  eq(next('chair_endorsed', 'return', 'chair'), null);
  eq(next('committee_approved', 'withdraw', 'author'), null);
});
test('codes are normalised and found in free text', () => {
  eq(normCode(' econ 1010 '), 'ECON1010');
  eq(codesIn('ECON 1010 and MATH1100').join(','), 'ECON1010,MATH1100');
});
test('cycle detection', () => {
  const g = { ECON2010: ['ECON1010'], ECON3010: ['ECON2010'] };
  eq(createsCycle(g, 'ECON 1010', ['ECON 3010']), true);
  eq(createsCycle(g, 'ECON 4010', ['ECON 3010']), false);
});
test('syllabus template', () => {
  eq(syllabusBlocker(S, O), null);
  eq(syllabusBlocker({ ...S, assessments: [{ name: 'Final', weight: 90 }] }, O)?.startsWith('Assessment weights'), true);
  eq(syllabusBlocker(S, []) !== null, true);
  eq(syllabusBlocker({ ...S, weeks: 0 }, O) !== null, true);
  eq(syllabusBlocker({ ...S, policies: 'none' }, O) !== null, true);
});
test('prerequisites must be published and loop-free', () => {
  const pub = new Set(['ECON1010', 'ECON2010']);
  const g = { ECON2010: ['ECON1010'] };
  eq(prereqBlocker('ECON 3010', ['ECON 2010'], pub, g), null);
  eq(prereqBlocker('ECON 3010', ['ECON 9999'], pub, g)?.startsWith('Not in the published'), true);
  eq(prereqBlocker('ECON 1010', ['ECON 2010'], pub, g), 'These prerequisites would create a loop back to this course.');
  eq(prereqBlocker('ECON 1010', ['econ1010'], pub, g), 'A course cannot be its own prerequisite.');
});
