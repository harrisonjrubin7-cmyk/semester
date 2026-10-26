import { test, eq } from './harness';
import { next, openSteps, awardsLeft, linkNext, consentText, applyBlocker } from '../src/lib/scholarshipRules';

test('award path (control)', () => {
  eq(next('submitted', 'shortlist', 'sponsor'), 'shortlisted');
  eq(next('shortlisted', 'award', 'sponsor'), 'awarded');
  eq(next('awarded', 'accept', 'student'), 'accepted');
  eq(next('accepted', 'handoff', 'office'), 'handed_off');
});
test('each step belongs to one party', () => {
  eq(next('submitted', 'award', 'office'), null);
  eq(next('awarded', 'accept', 'sponsor'), null);
  eq(next('accepted', 'handoff', 'sponsor'), null);
  eq(next('awarded', 'withdraw', 'student'), null);
});
test('end states are final', () => {
  for (const s of ['not_selected', 'withdrawn', 'declined_award', 'handed_off'] as const) for (const a of ['student', 'sponsor', 'office'] as const) eq(openSteps(s, a).length, 0);
});
test('awards count awarded, accepted and handed-off only', () => {
  eq(awardsLeft(2, ['awarded', 'declined_award', 'not_selected']), 1);
  eq(awardsLeft(2, ['accepted', 'handed_off']), 0);
});
test('sponsor verification', () => {
  eq(linkNext('requested', 'verify'), 'verified');
  eq(linkNext('verified', 'suspend'), 'suspended');
  eq(linkNext('suspended', 'verify'), 'verified');
  eq(linkNext('verified', 'reject'), null);
});
test('consent names the sponsor and excludes records', () => {
  const t = consentText('Acme Foundation', 'STEM Award');
  eq(t.includes('Acme Foundation') && t.includes('No grades'), true);
});
test('apply blockers', () => {
  const ok = { linkVerified: true, programOpen: true, pastDeadline: false, studentIsSponsor: false, statementLength: 80, consented: true };
  eq(applyBlocker(ok), null);
  eq(applyBlocker({ ...ok, linkVerified: false }) !== null, true);
  eq(applyBlocker({ ...ok, pastDeadline: true }) !== null, true);
  eq(applyBlocker({ ...ok, studentIsSponsor: true }) !== null, true);
  eq(applyBlocker({ ...ok, consented: false }) !== null, true);
});
