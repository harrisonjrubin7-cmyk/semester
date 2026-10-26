import { test, eq } from './harness';
import { nextOrder, assignBlocker, evidenceOk, requesterStatus, nextDue } from '../src/lib/facilitiesRules';

const C = { kind: 'coordinator' as const, assignee: false }, A = { kind: 'technician' as const, assignee: true };
test('work order path (control)', () => {
  eq(nextOrder('new', 'authorize', C), 'authorized');
  eq(nextOrder('authorized', 'assign', C), 'assigned');
  eq(nextOrder('assigned', 'start', A), 'in_progress');
  eq(nextOrder('in_progress', 'complete', A), 'completed');
  eq(nextOrder('completed', 'close', C), 'closed');
});
test('no assignment before authorization; only the assignee works it', () => {
  eq(nextOrder('new', 'assign', C), null);
  eq(nextOrder('assigned', 'start', { kind: 'technician', assignee: false }), null);
});
test('the assignee cannot inspect their own work', () => {
  eq(nextOrder('completed', 'close', { kind: 'coordinator', assignee: true }), null);
  eq(nextOrder('completed', 'reopen', C), 'assigned');
});
test('contractor expiry and restricted locations', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  eq(assignBlocker({ kind: 'technician', expiresAt: null, now, restricted: true }), null);
  eq(assignBlocker({ kind: 'contractor', expiresAt: new Date('2026-10-25'), now, restricted: false }), 'That contractor’s access has ended.');
  eq(assignBlocker({ kind: 'contractor', expiresAt: new Date('2026-12-01'), now, restricted: true }), 'Contractors are not assigned to restricted locations.');
  eq(assignBlocker({ kind: 'coordinator', expiresAt: null, now, restricted: false }) !== null, true);
});
test('completion needs evidence', () => { eq(evidenceOk('done'), false); eq(evidenceOk('Replaced valve, tested for 10 min, no leak'), true); });
test('requesters see minimum-necessary status', () => {
  eq(requesterStatus('duplicate', null), 'Already reported — being handled');
  eq(requesterStatus('converted', 'completed'), 'Work done — being checked');
  eq(requesterStatus('open', null), 'Received');
});
test('plans roll forward', () => { eq(nextDue(new Date('2026-10-01T00:00:00Z'), 30).toISOString(), '2026-10-31T00:00:00.000Z'); });
