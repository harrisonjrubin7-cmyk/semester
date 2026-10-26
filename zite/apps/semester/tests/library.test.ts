import { test, eq } from './harness';
import { available, borrowBlocker, renewBlocker, dueDate, nextRequest, approveBlocker } from '../src/lib/libraryRules';

const b = (o: Partial<Parameters<typeof borrowBlocker>[0]>) => borrowBlocker({ active: true, copies: 2, activeLoans: 0, readyForOthers: 0, hasReadyHold: false, alreadyBorrowed: false, ...o });
test('borrow when a copy is free (control)', () => { eq(b({}), null); eq(available(2, 1, 0), 1); });
test('never lend more than the copies or seats', () => { eq(b({ activeLoans: 2 }) !== null, true); eq(available(1, 2, 0), 0); });
test('a copy kept ready for someone else is not free', () => { eq(b({ activeLoans: 1, readyForOthers: 1 }) !== null, true); });
test('a ready hold lets its holder borrow', () => { eq(b({ activeLoans: 1, readyForOthers: 0, hasReadyHold: true }), null); });
test('no double borrowing, no borrowing withdrawn items', () => { eq(b({ alreadyBorrowed: true }), 'You already have this item.'); eq(b({ active: false }) !== null, true); });
test('renewal limits', () => {
  eq(renewBlocker(0, 0, false), null);
  eq(renewBlocker(2, 0, false) !== null, true);
  eq(renewBlocker(0, 1, false), 'Someone else is waiting for this item, so it cannot be renewed.');
  eq(renewBlocker(0, 0, true) !== null, true);
});
test('loan periods', () => { eq(dueDate(new Date('2026-10-01T00:00:00Z'), 'ebook').toISOString(), '2026-10-15T00:00:00.000Z'); });
test('requests: staff decide, never their own; approval needs licence and accessibility', () => {
  eq(nextRequest('submitted', 'review', { staff: true, requester: false }), 'license_review');
  eq(nextRequest('license_review', 'approve', { staff: true, requester: true }), null);
  eq(nextRequest('submitted', 'approve', { staff: true, requester: false }), null);
  eq(nextRequest('approved', 'publish', { staff: true, requester: false }), 'published');
  eq(nextRequest('approved', 'withdraw', { staff: false, requester: true }), null);
  eq(approveBlocker('Campus-wide, 3 seats, perpetual', null) !== null, true);
  eq(approveBlocker('Campus-wide, 3 seats, perpetual', false), null);
});
