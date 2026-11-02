import { test, eq } from './harness';
import { approvalEffect, approvalReason } from '../src/lib/approvalEffect';

test('hold release written by the server clears that hold (control)', () =>
  eq(approvalEffect('Release hold: Library fine', 'hold:task_1 paid at the desk'), { kind: 'hold', holdId: 'task_1' }));
test('role change written by the server grants that role (control)', () =>
  eq(approvalEffect('Role change: Ada → Advisor', 'membership:m_1 role:Advisor covering for Sam'), { kind: 'role', membershipId: 'm_1', role: 'Advisor' }));

test('a student cannot smuggle a hold release into a prerequisite override', () =>
  eq(approvalEffect('Prerequisite override · CS 201', 'please approve hold:task_9'), { kind: 'none' }));
test('…even when the reason starts with the reference', () =>
  eq(approvalEffect('Prerequisite override · CS 201', 'hold:task_9 please'), { kind: 'none' }));
test('a role reference typed into an override reason grants nothing', () =>
  eq(approvalEffect('Prerequisite override · CS 201', 'membership:m_2 role:Administrator'), { kind: 'none' }));
test('a second hold typed after the real one is ignored', () =>
  eq(approvalEffect('Release hold: Library fine', 'hold:task_1 also hold:task_9'), { kind: 'hold', holdId: 'task_1' }));
test('a hold reference inside a role change does nothing extra', () =>
  eq(approvalEffect('Role change: Ada → Advisor', 'membership:m_1 role:Advisor hold:task_9'), { kind: 'role', membershipId: 'm_1', role: 'Advisor' }));
test('a role change whose reference is not at the start grants nothing', () =>
  eq(approvalEffect('Role change: Ada → Advisor', 'see membership:m_1 role:Administrator'), { kind: 'none' }));

test('reason drops only the leading reference', () => {
  eq(approvalReason('Release hold: x', 'hold:task_1 paid'), 'paid');
  eq(approvalReason('Prerequisite override · CS 201', 'hold:task_9 please'), 'hold:task_9 please');
});
