import { test, eq } from './harness';
import { grantLive, grantBlocker, isSha256, findingStep, nextFindingState } from '../src/lib/auditRules';

const now = new Date('2026-10-27T12:00:00Z');
const g = { auditorId: 'a1', areas: ['finance'], expiresAt: new Date('2026-12-01'), revokedAt: null };
test('grant is live only for its areas, before expiry, unrevoked', () => {
  eq(grantLive(g, 'finance', now), true);
  eq(grantLive(g, 'registrar', now), false);
  eq(grantLive({ ...g, expiresAt: new Date('2026-10-01') }, 'finance', now), false);
  eq(grantLive({ ...g, revokedAt: new Date('2026-10-20') }, 'finance', now), false);
});
test('grants are given by someone else, with a purpose, areas and a bounded term', () => {
  const ok = { adminId: 'adm', userId: 'a1', purpose: 'Annual cash controls review', areas: ['finance'], days: 60 };
  eq(grantBlocker(ok), null);
  eq(grantBlocker({ ...ok, userId: 'adm' }), 'Ask another administrator to grant you audit access.');
  eq(grantBlocker({ ...ok, purpose: 'audit' }) !== null, true);
  eq(grantBlocker({ ...ok, areas: [] }) !== null, true);
  eq(grantBlocker({ ...ok, areas: ['everything'] }) !== null, true);
  eq(grantBlocker({ ...ok, areas: ['finance', 'finance'] }) !== null, true);
  eq(grantBlocker({ ...ok, days: 181 }) !== null, true);
  eq(grantBlocker({ ...ok, days: 0 }) !== null, true);
});
test('evidence hashes are lowercase SHA-256', () => {
  eq(isSha256('a'.repeat(64)), true);
  eq(isSha256('A'.repeat(64)), false);
  eq(isSha256('a'.repeat(63)), false);
});
test('finding lifecycle and independence', () => {
  const base = { owner: 'mgr', remediator: null as string | null, auditorLive: true };
  eq(findingStep({ ...base, state: 'issued', step: 'respond', actor: 'mgr' }), null);
  eq(findingStep({ ...base, state: 'issued', step: 'respond', actor: 'aud' }) !== null, true);
  eq(findingStep({ ...base, state: 'issued', step: 'remediate', actor: 'mgr' }), 'Record a management response first.');
  eq(findingStep({ ...base, state: 'responded', step: 'remediate', actor: 'mgr' }), null);
  const rem = { ...base, remediator: 'mgr', state: 'awaiting_verification' as const };
  eq(findingStep({ ...rem, step: 'verify_accept', actor: 'mgr' }), 'The management owner cannot verify their own finding.');
  eq(findingStep({ ...rem, owner: 'boss', step: 'verify_accept', actor: 'mgr' }), 'Someone other than the person who remediated verifies closure.');
  eq(findingStep({ ...rem, step: 'verify_accept', actor: 'aud', auditorLive: false }), 'You need live audit access to this area.');
  eq(findingStep({ ...rem, step: 'verify_accept', actor: 'aud' }), null);
  eq(findingStep({ ...rem, state: 'closed', step: 'respond', actor: 'mgr' }), 'This finding is closed.');
  eq(nextFindingState('verify_reject'), 'responded');
  eq(nextFindingState('verify_accept'), 'closed');
});
