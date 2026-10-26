import { test, eq } from './harness';
import { next, canSee, officerBlocker } from '../src/lib/integrityRules';

test('course-level path (control)', () => {
  eq(next('reported', 'respond', 'student'), 'responded');
  eq(next('responded', 'propose', 'reporter'), 'proposed');
  eq(next('proposed', 'accept', 'student'), 'resolved_course');
});
test('formal path with appeal', () => {
  eq(next('proposed', 'decline', 'student'), 'referred');
  eq(next('referred', 'decide', 'officer'), 'decided');
  eq(next('decided', 'appeal', 'student'), 'appealed');
  eq(next('appealed', 'decide_appeal', 'officer'), 'closed');
  eq(next('reported', 'refer', 'reporter'), 'referred');
});
test('wrong actor or wrong state is refused', () => {
  eq(next('reported', 'respond', 'reporter'), null);    // only the student responds
  eq(next('proposed', 'accept', 'reporter'), null);     // the reporter cannot accept for the student
  eq(next('referred', 'decide', 'reporter'), null);     // instructors never decide formally
  eq(next('reported', 'decide', 'officer'), null);      // not before referral
  eq(next('resolved_course', 'appeal', 'student'), null); // an accepted course resolution is final
  eq(next('decided', 'withdraw', 'reporter'), null);    // cannot withdraw after a decision
  eq(next('closed', 'appeal', 'student'), null);
});
test('only the three parties see a case', () => {
  const c = { studentId: 'S', reporterId: 'F' };
  eq([canSee(c, 'S', false), canSee(c, 'F', false), canSee(c, 'O', true)], [true, true, true]);
  eq([canSee(c, 'X', false), canSee(c, 'ADVISOR', false)], [false, false]);
});
test('officer independence', () => {
  const c = { studentId: 'S', reporterId: 'F', decidedBy: 'O1' };
  eq(officerBlocker(c, 'O2', 'decide'), null);
  eq(typeof officerBlocker(c, 'F', 'decide'), 'string');
  eq(typeof officerBlocker(c, 'S', 'decide'), 'string');
  eq(typeof officerBlocker(c, 'O1', 'decide_appeal'), 'string');
  eq(officerBlocker(c, 'O2', 'decide_appeal'), null);
});
