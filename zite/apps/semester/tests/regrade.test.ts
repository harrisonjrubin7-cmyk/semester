import { test, eq } from './harness';
import { requestBlocker, decideBlocker, decisionBlocker } from '../src/lib/regradeRules';

const released = { studentId: 'stu', released: true, grade: 'B' };

test('student can request a regrade of their own released grade', () => eq(requestBlocker(released, 'stu', false), null));
test('cannot request on someone else’s grade', () => eq(typeof requestBlocker(released, 'other', false), 'string'));
test('cannot request before the grade is released', () => eq(typeof requestBlocker({ ...released, released: false }, 'stu', false), 'string'));
test('only one open request per course', () => eq(typeof requestBlocker(released, 'stu', true), 'string'));

const base = { deciderId: 'fac', studentId: 'stu', isInstructor: true, roles: ['Faculty'], status: 'Pending' };
test('instructor of the section can decide', () => eq(decideBlocker(base), null));
test('registrar staff can decide without teaching the section', () => eq(decideBlocker({ ...base, isInstructor: false, roles: ['Staff'] }), null));
test('faculty who do not teach the section cannot decide', () => eq(typeof decideBlocker({ ...base, isInstructor: false }), 'string'));
test('a student who is also staff cannot decide their own request', () => eq(typeof decideBlocker({ ...base, deciderId: 'stu', roles: ['Staff'] }), 'string'));
test('an already-decided request cannot be decided again', () => eq(typeof decideBlocker({ ...base, status: 'Grade Upheld' }), 'string'));
test('advisor role alone cannot decide', () => eq(typeof decideBlocker({ ...base, isInstructor: false, roles: ['Advisor'] }), 'string'));

test('a change needs a valid, different grade and a note', () => {
  eq(decisionBlocker('Grade Changed', 'B', 'A-', 'Rubric misapplied on Q3'), null);
  eq(typeof decisionBlocker('Grade Changed', 'B', 'B', 'Rubric misapplied on Q3'), 'string');
  eq(typeof decisionBlocker('Grade Changed', 'B', 'A++', 'Rubric misapplied on Q3'), 'string');
  eq(typeof decisionBlocker('Grade Changed', 'B', undefined, 'Rubric misapplied on Q3'), 'string');
});
test('upholding needs only a note', () => {
  eq(decisionBlocker('Grade Upheld', 'B', undefined, 'Grading followed the rubric'), null);
  eq(typeof decisionBlocker('Grade Upheld', 'B', undefined, 'ok'), 'string');
});
