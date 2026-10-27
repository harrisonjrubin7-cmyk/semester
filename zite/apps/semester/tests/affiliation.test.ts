import { test, eq } from './harness';
import { pickMembership, joinBlocker } from '../src/lib/affiliationRules';

const personal = { id: 'm1', personal: true, sample: false };
const sample = { id: 'm2', personal: false, sample: true };
const uni = { id: 'm3', personal: false, sample: false };
test('one current membership, chosen on the server', () => {
  eq(pickMembership([], null), null);
  eq(pickMembership([personal], null)?.id, 'm1');
  eq(pickMembership([personal, uni], null)?.id, 'm3');
  eq(pickMembership([personal, sample], null)?.id, 'm2');
  eq(pickMembership([uni, personal], 'm1')?.id, 'm1');
  // a stale preference (membership no longer active) falls back instead of granting it
  eq(pickMembership([personal, uni], 'gone')?.id, 'm3');
  // order of rows never changes the answer
  eq(pickMembership([uni, personal, sample], null)?.id, pickMembership([sample, personal, uni], null)?.id);
});
test('join requests', () => {
  eq(joinBlocker({ role: 'Student', alreadyThere: 'none' }), null);
  eq(joinBlocker({ role: 'Administrator', alreadyThere: 'none' }) !== null, true);
  eq(joinBlocker({ role: 'Student', alreadyThere: 'Active' }), 'You are already a member there. Switch to it instead.');
  eq(joinBlocker({ role: 'Student', alreadyThere: 'Pending' }) !== null, true);
  eq(joinBlocker({ role: 'Faculty', alreadyThere: 'Suspended' }) !== null, true);
});
