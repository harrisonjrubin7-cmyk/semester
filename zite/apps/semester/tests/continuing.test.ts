import { test, eq } from './harness';
import { attendancePct, completionBlocker, autoRefundOnWithdraw, refundAllowed, summary, money } from '../src/lib/continuingRules';

const ok = { state: 'enrolled', payment: 'paid', completion: 'in_progress', refund: 'none' } as const;
test('attendance percentage rounds down, no sessions is zero', () => {
  eq(attendancePct(3, 2), 66);
  eq(attendancePct(0, 0), 0);
  eq(attendancePct(4, 4), 100);
});
test('completion needs active, settled, finished and attended', () => {
  eq(completionBlocker({ e: ok, sessionsAhead: 0, pct: 80, min: 75 }), null);
  eq(completionBlocker({ e: { ...ok, payment: 'unpaid' }, sessionsAhead: 0, pct: 100, min: 75 }), 'Payment is not settled.');
  eq(completionBlocker({ e: { ...ok, state: 'withdrawn' }, sessionsAhead: 0, pct: 100, min: 0 }), 'This enrollment is not active.');
  eq(completionBlocker({ e: ok, sessionsAhead: 1, pct: 100, min: 0 }), 'Sessions are still to come.');
  eq(completionBlocker({ e: ok, sessionsAhead: 0, pct: 50, min: 75 }), 'Attendance is 50%; this offering requires 75%.');
  eq(completionBlocker({ e: { ...ok, payment: 'sponsored' }, sessionsAhead: 0, pct: 75, min: 75 }), null);
});
test('refunds stay separate from completion', () => {
  eq(autoRefundOnWithdraw(10000, false), true);
  eq(autoRefundOnWithdraw(10000, true), false);
  eq(autoRefundOnWithdraw(0, false), false);
  eq(refundAllowed({ ...ok, completion: 'completed' }, 10000), false);
  eq(refundAllowed({ ...ok, refund: 'denied' }, 10000), true);
  eq(refundAllowed(ok, 0), false);
});
test('labels show every dimension', () => {
  eq(summary({ state: 'withdrawn', payment: 'paid', completion: 'in_progress', refund: 'issued' }), 'Withdrawn · paid · refund issued');
  eq(summary({ ...ok, completion: 'completed' }), 'Enrolled · paid · completed');
  eq(money(25000), '$250.00');
});
