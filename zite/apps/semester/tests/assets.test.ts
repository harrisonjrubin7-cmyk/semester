import { test, eq } from './harness';
import { nextAsset, normTag, free, reserveBlocker, returnBlocker, countDelta, adjustBlocker } from '../src/lib/assetRules';

test('asset path (control)', () => {
  eq(nextAsset('in_service', 'repair', 'clerk', false), 'in_repair');
  eq(nextAsset('in_repair', 'restore', 'clerk', false), 'in_service');
  eq(nextAsset('in_service', 'request_disposal', 'clerk', false), 'retire_requested');
  eq(nextAsset('retire_requested', 'approve_disposal', 'controller', false), 'disposed');
});
test('disposal: controller only, never the requester; nothing moves after disposal', () => {
  eq(nextAsset('retire_requested', 'approve_disposal', 'clerk', false), null);
  eq(nextAsset('retire_requested', 'approve_disposal', 'controller', true), null);
  eq(nextAsset('disposed', 'restore', 'controller', false), null);
  eq(nextAsset('in_service', 'repair', null, false), null);
});
test('tags normalise', () => { eq(normTag(' lap-0042 '), 'LAP-0042'); });
test('stock cannot be over-reserved', () => {
  eq(free(5, 3), 2);
  eq(reserveBlocker(5, 3, 2), null);
  eq(reserveBlocker(5, 3, 3), 'Only 2 available.');
  eq(reserveBlocker(5, 0, 0) !== null, true);
});
test('returns cannot exceed what was issued', () => { eq(returnBlocker(3, 1, 2), null); eq(returnBlocker(3, 1, 3), 'Only 2 can still be returned.'); });
test('counts create adjustments; approval is independent and keeps reservations covered', () => {
  eq(countDelta(10, 10), null);
  eq(countDelta(10, 7), -3);
  const a = (o: any) => adjustBlocker({ controller: true, countedByMe: false, onHand: 10, reserved: 4, delta: -3, ...o });
  eq(a({}), null);
  eq(a({ countedByMe: true }), 'Someone other than the person who counted must approve.');
  eq(a({ controller: false }) !== null, true);
  eq(a({ delta: -7 }), 'This would leave less than is already reserved; release reservations first.');
  eq(a({ reserved: 0, delta: -11 }), 'Stock cannot go below zero.');
});
