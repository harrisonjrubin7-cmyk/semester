import { test, eq } from './harness';
import { nextTicket, ticketSteps, ticketBlocker, canSeeTicket, nextChange, changeDone, changeOutcome, overdue } from '../src/lib/itsmRules';

test('request path (control)', () => {
  eq(nextTicket('open', 'assign', 'agent'), 'assigned');
  eq(nextTicket('assigned', 'fulfill', 'agent'), 'fulfilled');
  eq(nextTicket('fulfilled', 'confirm', 'requester'), 'closed');
});
test('only the requester confirms or reopens; only agents fulfill', () => {
  eq(nextTicket('fulfilled', 'confirm', 'agent'), null);
  eq(nextTicket('fulfilled', 'reopen', 'agent'), null);
  eq(nextTicket('assigned', 'fulfill', 'requester'), null);
  eq(nextTicket('fulfilled', 'reopen', 'requester'), 'assigned');
});
test('nothing moves out of closed or cancelled', () => {
  eq(ticketSteps('closed', 'agent').length + ticketSteps('closed', 'requester').length, 0);
  eq(ticketSteps('cancelled', 'agent').length + ticketSteps('cancelled', 'requester').length, 0);
});
test('incidents cannot close without a problem review', () => {
  eq(ticketBlocker('incident', 'close', 'fixed'), 'Closing an incident needs a problem review: the cause and what prevents it again (at least 20 characters).');
  eq(ticketBlocker('incident', 'close', 'Disk filled; added alerting at 80% usage'), null);
  eq(ticketBlocker('request', 'fulfill', 'done'), 'Say what was done (at least 10 characters).');
});
test('security incidents are hidden from ordinary agents', () => {
  eq(canSeeTicket('security_incident', false, { agent: true, security: false }), false);
  eq(canSeeTicket('security_incident', false, { agent: false, security: true }), true);
  eq(canSeeTicket('security_incident', true, { agent: false, security: false }), true);
  eq(canSeeTicket('incident', false, { agent: true, security: false }), true);
  eq(canSeeTicket('request', false, { agent: false, security: false }), false);
});
const ch = (state: any, emergency = false, approved = false) => ({ state, emergency, approved });
test('change path: owner approves, raiser implements, verification is separate', () => {
  eq(nextChange(ch('submitted'), 'approve', { owner: true, raiser: false }), 'approved');
  eq(nextChange(ch('approved', false, true), 'implement', { owner: false, raiser: true }), 'implemented');
  eq(nextChange(ch('implemented', false, true), 'verify', { owner: false, raiser: true }), 'verified');
  eq(changeDone(ch('implemented', false, true)), false);
  eq(changeDone(ch('verified', false, true)), true);
});
test('nobody approves their own change, even as service owner', () => {
  eq(nextChange(ch('submitted'), 'approve', { owner: true, raiser: true }), null);
});
test('a normal change cannot be made before approval', () => {
  eq(nextChange(ch('submitted'), 'implement', { owner: false, raiser: true }), null);
});
test('editing an approved plan sends it back for approval', () => {
  eq(nextChange(ch('approved', false, true), 'edit', { owner: false, raiser: true }), 'submitted');
});
test('an emergency change made without approval stays open until reviewed', () => {
  eq(nextChange(ch('submitted', true), 'implement', { owner: false, raiser: true }), 'implemented');
  eq(changeDone(ch('verified', true, false)), false);
  eq(nextChange(ch('verified', true, false), 'review', { owner: true, raiser: false }), 'reviewed');
  eq(nextChange(ch('verified', true, false), 'review', { owner: true, raiser: true }), null);
  eq(changeDone(ch('reviewed', true, false)), true);
});
test('a ticket closing is not a change outcome', () => {
  eq(changeOutcome('implemented'), 'Made, not yet verified');
});
test('overdue only while open or assigned', () => {
  const t0 = new Date('2026-10-26T00:00:00Z'), t9 = new Date('2026-10-26T09:00:00Z');
  eq(overdue('incident', 'assigned', t0, t9), true);
  eq(overdue('incident', 'fulfilled', t0, t9), false);
  eq(overdue('request', 'open', t0, t9), false);
});
test('an incident is confirmed only after its problem review; requests have no review step', () => {
  eq(ticketSteps('fulfilled', 'requester', 'incident', false).includes('confirm'), false);
  eq(ticketSteps('fulfilled', 'requester', 'incident', true).includes('confirm'), true);
  eq(ticketSteps('fulfilled', 'agent', 'request').includes('review'), false);
  eq(ticketSteps('fulfilled', 'agent', 'incident').includes('review'), true);
});
