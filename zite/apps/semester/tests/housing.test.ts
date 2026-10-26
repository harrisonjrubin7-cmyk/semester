import { test, eq } from './harness';
import { next, openSteps, bedsLeft, offerBlocker, acceptBlocker, nextMaint, canSeeMaint } from '../src/lib/housingRules';

test('application path (control)', () => {
  eq(next('submitted', 'offer', 'staff'), 'offered');
  eq(next('offered', 'accept', 'student'), 'accepted');
  eq(next('accepted', 'move_in', 'staff'), 'moved_in');
  eq(next('moved_in', 'move_out', 'staff'), 'moved_out');
});
test('only the right party takes each step', () => {
  eq(next('submitted', 'offer', 'student'), null);
  eq(next('offered', 'accept', 'staff'), null);
  eq(next('accepted', 'move_in', 'student'), null);
});
test('no step out of a closed application', () => {
  for (const s of ['moved_out', 'withdrawn', 'cancelled'] as const) { eq(openSteps(s, 'staff').length, 0); eq(openSteps(s, 'student').length, 0); }
});
test('a declined offer can be re-offered; a moved-in resident cannot withdraw', () => {
  eq(next('declined', 'offer', 'staff'), 'offered');
  eq(next('moved_in', 'withdraw', 'student'), null);
});
test('beds count offered, accepted and moved-in only', () => {
  eq(bedsLeft(2, ['offered', 'declined', 'withdrawn', 'moved_out']), 1);
  eq(bedsLeft(2, ['accepted', 'moved_in']), 0);
});
test('offer blockers', () => {
  const ok = { self: false, capacity: 2, occupantStates: [] as never[], roomActive: true, termsLength: 80 };
  eq(offerBlocker(ok), null);
  eq(offerBlocker({ ...ok, self: true }) !== null, true);
  eq(offerBlocker({ ...ok, capacity: 1, occupantStates: ['accepted'] as never[] }), 'That room is full.');
  eq(offerBlocker({ ...ok, roomActive: false }) !== null, true);
  eq(offerBlocker({ ...ok, termsLength: 10 }) !== null, true);
});
test('acceptance is pinned to the terms shown', () => {
  eq(acceptBlocker('abc', 'abc'), null);
  eq(acceptBlocker('abc', 'abd') !== null, true);
});
test('maintenance: staff work it, the reporter can reopen', () => {
  eq(nextMaint('open', 'start', 'staff'), 'in_progress');
  eq(nextMaint('open', 'start', 'reporter'), null);
  eq(nextMaint('resolved', 'reopen', 'reporter'), 'open');
  eq(nextMaint('resolved', 'reopen', 'staff'), null);
  eq(nextMaint('resolved', 'close', 'reporter'), 'closed');
});
test('resident assistants see their own building only', () => {
  eq(canSeeMaint({ kind: 'ra', myBuilding: 'Hall A', ticketBuilding: 'Hall A', isReporter: false }), true);
  eq(canSeeMaint({ kind: 'ra', myBuilding: 'Hall A', ticketBuilding: 'Hall B', isReporter: false }), false);
  eq(canSeeMaint({ kind: null, myBuilding: null, ticketBuilding: 'Hall B', isReporter: false }), false);
  eq(canSeeMaint({ kind: null, myBuilding: null, ticketBuilding: 'Hall B', isReporter: true }), true);
});
