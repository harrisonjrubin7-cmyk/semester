import { test, eq } from './harness';
import { next, openSteps, agreementBlocker, readinessComplete, reconcileBlocker, approveBlocker, CHECKLIST } from '../src/lib/abroadRules';

const L = [{ hostCourse: 'ECO 210', hostTitle: 'European Economy', homeCode: 'ECON 2100', credits: 3 }, { hostCourse: 'FR 101', hostTitle: 'French I', homeCode: 'FREN 1101', credits: 4 }];

test('full path (control)', () => {
  eq(next('submitted', 'approve', 'advisor'), 'approved');
  eq(next('approved', 'approve_agreement', 'advisor'), 'agreed');
  eq(next('agreed', 'confirm_ready', 'advisor'), 'ready');
  eq(next('ready', 'depart', 'advisor'), 'abroad');
  eq(next('abroad', 'come_back', 'student'), 'returned');
  eq(next('returned', 'reconcile', 'advisor'), 'reconciled');
});
test('changing an approved agreement sends it back for approval', () => { eq(next('agreed', 'propose', 'student'), 'approved'); eq(next('ready', 'propose', 'student'), null); });
test('only the right party takes each step', () => {
  eq(next('submitted', 'approve', 'student'), null);
  eq(next('approved', 'propose', 'advisor'), null);
  eq(next('returned', 'reconcile', 'student'), null);
});
test('nothing opens after an end state; abroad cannot withdraw', () => {
  for (const s of ['reconciled', 'declined', 'withdrawn', 'cancelled'] as const) { eq(openSteps(s, 'student').length, 0); eq(openSteps(s, 'advisor').length, 0); }
  eq(next('abroad', 'withdraw', 'student'), null);
});
test('agreement lines', () => {
  eq(agreementBlocker(L), null);
  eq(agreementBlocker([]) !== null, true);
  eq(agreementBlocker([{ ...L[0], credits: 0 }]) !== null, true);
  eq(agreementBlocker([L[0], { ...L[1], hostCourse: 'eco 210' }]), 'A host course appears twice.');
});
test('readiness needs every item', () => {
  const all = Object.fromEntries(CHECKLIST.map((k) => [k, true]));
  eq(readinessComplete(all), true);
  eq(readinessComplete({ ...all, health_insurance: false }), false);
});
test('reconciliation covers every line and never exceeds the agreement', () => {
  eq(reconcileBlocker(L, [{ credits: 3, grade: 'B' }, { credits: 4, grade: 'A' }]), null);
  eq(reconcileBlocker(L, [{ credits: 3, grade: 'B' }]) !== null, true);
  eq(reconcileBlocker(L, [{ credits: 3, grade: 'B' }, { credits: 5, grade: 'A' }]) !== null, true);
  eq(reconcileBlocker(L, [{ credits: 0, grade: 'W' }, { credits: 4, grade: '' }]) !== null, true);
});
test('approval blockers', () => {
  const ok = { self: false, capacity: 2, placesHeld: 1, programActive: true };
  eq(approveBlocker(ok), null);
  eq(approveBlocker({ ...ok, placesHeld: 2 }), 'This program is full.');
  eq(approveBlocker({ ...ok, self: true }) !== null, true);
  eq(approveBlocker({ ...ok, programActive: false }) !== null, true);
});
