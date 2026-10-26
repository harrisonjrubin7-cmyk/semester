import { test, eq } from './harness';
import { cardRefOk, nextGrant, holderGrantStatus, replaceBlocker, isStale } from '../src/lib/idCardRules';

test('card references are labels, never card numbers', () => {
  eq(cardRefOk('VU-2026-0412'), true);
  eq(cardRefOk('6011000990139424'), false);
  eq(cardRefOk('A-12345678'), false);
  eq(cardRefOk('x'), false);
});
const O = (o: any = {}) => ({ role: 'officer' as const, requester: false, restricted: false, ...o });
test('grant path (control): approve asks the controller; only a confirmation makes it active', () => {
  eq(nextGrant('requested', 'approve', O()), 'provision_requested');
  eq(nextGrant('provision_requested', 'confirm', O()), 'active');
});
test('restricted zones need security, never the requester', () => {
  eq(nextGrant('requested', 'approve', O({ restricted: true })), null);
  eq(nextGrant('requested', 'approve', { role: 'security', requester: false, restricted: true }), 'provision_requested');
  eq(nextGrant('requested', 'approve', { role: 'security', requester: true, restricted: true }), null);
});
test('revocation requested is not revocation confirmed', () => {
  eq(nextGrant('active', 'revoke', O()), 'revoke_requested');
  eq(holderGrantStatus('revoke_requested'), 'Being removed — not yet confirmed');
  eq(nextGrant('revoke_requested', 'confirm', O()), 'revoked');
  eq(nextGrant('revoke_requested', 'confirm', { role: 'security', requester: false, restricted: false }), null);
});
test('replacement only after confirmed revocation', () => {
  eq(replaceBlocker('revoke_requested', []), 'Confirm the old card is revoked before issuing a replacement.');
  eq(replaceBlocker('revoked', ['revoke_requested']) !== null, true);
  eq(replaceBlocker('revoked', ['revoked', 'denied']), null);
});
test('unconfirmed requests go stale after 24 hours', () => {
  eq(isStale(new Date('2026-10-25T10:00:00Z'), new Date('2026-10-26T11:00:00Z')), true);
  eq(isStale(new Date('2026-10-26T10:00:00Z'), new Date('2026-10-26T11:00:00Z')), false);
});
