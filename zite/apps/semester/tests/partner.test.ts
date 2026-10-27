import { test, eq } from './harness';
import { normOrgName, scopesOk, accessLive, relStatus, memberChangeBlocker } from '../src/lib/partnerRules';

test('organization names compare normalised', () => { eq(normOrgName('  Acme   Learning '), 'acme learning'); });
test('only published scopes, no duplicates, at least one', () => {
  eq(scopesOk(['publish_listings']), true);
  eq(scopesOk(['publish_listings', 'admin_everything']), false);
  eq(scopesOk(['view_orders', 'view_orders']), false);
  eq(scopesOk([]), false);
});
const now = new Date('2026-10-27T12:00:00Z');
test('access is live only while active and before the end date', () => {
  eq(accessLive('active', new Date('2027-01-01'), now), true);
  eq(accessLive('active', new Date('2026-10-01'), now), false);
  eq(accessLive('suspended', new Date('2027-01-01'), now), false);
  eq(accessLive('agreement_pending', new Date('2027-01-01'), now), false);
  eq(relStatus('active', new Date('2026-10-01'), now), 'Agreement expired — no access until renewed');
  eq(relStatus('offboarded', null, now), 'Offboarded — records kept');
});
test('delegated admin limits', () => {
  eq(memberChangeBlocker({ actorIsAdmin: true, targetIsSelf: false, removingAdmin: false, admins: 1 }), null);
  eq(memberChangeBlocker({ actorIsAdmin: false, targetIsSelf: false, removingAdmin: false, admins: 2 }) !== null, true);
  eq(memberChangeBlocker({ actorIsAdmin: true, targetIsSelf: true, removingAdmin: false, admins: 2 }), 'Another administrator of your organization changes your own role.');
  eq(memberChangeBlocker({ actorIsAdmin: true, targetIsSelf: false, removingAdmin: true, admins: 1 }), 'An organization keeps at least one administrator.');
});
