import { test, eq } from './harness';
import { nextState, parseMeeting, validateDraft, scheduleConflicts, reconcile, sectionLabel } from '../src/lib/sectionRequestRules';

test('the happy path moves one step at a time (control)', () => {
  eq(nextState('submitted', 'chair'), 'chair_approved');
  eq(nextState('chair_approved', 'registrar'), 'authorized');
  eq(nextState('authorized', 'begin_create'), 'creating');
  eq(nextState('creating', 'created'), 'created');
  eq(nextState('created', 'reconciled'), 'reconciled');
});
test('rejections and withdrawal end the request', () => {
  eq(nextState('submitted', 'chair', false), 'rejected');
  eq(nextState('chair_approved', 'registrar', false), 'rejected');
  eq(nextState('submitted', 'withdraw'), 'withdrawn');
});
test('steps cannot be skipped or repeated', () => {
  eq(nextState('submitted', 'registrar'), null);   // no registrar decision before the chair
  eq(nextState('chair_approved', 'chair'), null);  // chair cannot decide twice
  eq(nextState('submitted', 'begin_create'), null);
  eq(nextState('rejected', 'chair'), null);
  eq(nextState('chair_approved', 'withdraw'), null);
  eq(nextState('reconciled', 'begin_create'), null);
});
test('a failed creation goes back to authorized so it can be retried', () => { eq(nextState('creating', 'create_failed'), 'authorized'); });

test('meeting times parse in the catalog format', () => {
  eq(parseMeeting('Mon/Wed 09:00-10:15'), { days: ['Mon', 'Wed'], start: 540, end: 615 });
  eq(parseMeeting('Mon/Wed 10:15-09:00'), null);
  eq(parseMeeting('Funday 09:00-10:00'), null);
  eq(parseMeeting('Mon/Mon 09:00-10:00'), null);
  eq(parseMeeting('Mon 08:00-15:00'), null);
  eq(parseMeeting('Mon 25:00-26:00'), null);
});

const ok = { sectionCode: '002', capacity: 30, meetingTimes: 'Tue/Thu 13:00-14:15', roomCapacity: 40, instructorIsFaculty: true };
test('a valid draft passes (control)', () => { eq(validateDraft(ok), null); });
test('invalid drafts are refused', () => {
  for (const bad of [{ sectionCode: '00 2' }, { capacity: 0 }, { capacity: 2.5 }, { meetingTimes: 'Tuesday 1pm' }, { roomCapacity: null }, { roomCapacity: 20 }, { instructorIsFaculty: false }])
    eq(typeof validateDraft({ ...ok, ...bad }), 'string');
});

test('room and instructor clashes are found in the same slot only', () => {
  const req = { roomId: 'R1', instructorId: 'U1', times: 'Mon/Wed 09:00-10:15' };
  eq(scheduleConflicts(req, []), []);
  eq(scheduleConflicts(req, [{ ref: 'A', roomId: 'R1', instructorId: 'U9', times: 'Mon 10:00-11:00' }]).length, 1);
  eq(scheduleConflicts(req, [{ ref: 'B', roomId: 'R2', instructorId: 'U1', times: 'Wed 08:00-09:30' }]).length, 1);
  eq(scheduleConflicts(req, [{ ref: 'C', roomId: 'R1', instructorId: 'U1', times: 'Mon 10:15-11:00' }]), []); // back to back is fine
  eq(scheduleConflicts(req, [{ ref: 'D', roomId: 'R1', instructorId: 'U1', times: 'Tue/Thu 09:00-10:15' }]), []);
  eq(scheduleConflicts(req, [{ ref: 'E', roomId: null, instructorId: 'U1', times: 'Mon 09:00-09:50' }]).length, 1); // existing section, no room
});

const R = { courseId: 'C1', termCode: 'F26', capacity: 30, times: 'Mon 09:00-10:00', instructorId: 'U1', label: sectionLabel('HIST 101', '002', 'F26') };
const S = { course: ['C1'], term: 'F26', capacity: 30, times: 'Mon 09:00-10:00', instructors: ['U1'], label: 'HIST 101 · 002 · F26', state: 'Open' };
test('reconciliation passes only when the section matches (control + mismatches)', () => {
  eq(reconcile(R, S), []);
  eq(reconcile(R, null), ['section missing']);
  eq(reconcile(R, { ...S, capacity: 35 }), ['capacity']);
  eq(reconcile(R, { ...S, instructors: [] }), ['instructor']);
  eq(reconcile(R, { ...S, state: 'Closed' }), ['not open for registration']);
});
