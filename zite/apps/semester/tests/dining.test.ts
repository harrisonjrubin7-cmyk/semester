import { test, eq } from './harness';
import { next, unacknowledged, orderBlocker, isOpen, closeBlocker } from '../src/lib/diningRules';

const L = [{ priceCents: 650, qty: 2, stock: 5, available: true }];
const B = { swipes: 3, dollarsCents: 2000 };

test('fulfillment path (control)', () => {
  eq(next('placed', 'prepare', 'staff'), 'preparing');
  eq(next('preparing', 'ready', 'staff'), 'ready');
  eq(next('ready', 'pick_up', 'staff'), 'picked_up');
});
test('students cancel only before preparation; staff cannot cancel for them', () => {
  eq(next('placed', 'cancel', 'student'), 'cancelled');
  eq(next('preparing', 'cancel', 'student'), null);
  eq(next('placed', 'cancel', 'staff'), null);
  eq(next('placed', 'prepare', 'student'), null);
  eq(next('ready', 'reject', 'staff'), null);
});
test('declared allergens need acknowledgement', () => {
  eq(unacknowledged([['milk', 'wheat'], ['soy']], ['peanuts', 'milk'], false).join(), 'milk');
  eq(unacknowledged([['milk']], ['milk'], true).length, 0);
  eq(unacknowledged([['milk']], [], false).length, 0);
});
test('order blockers', () => {
  eq(orderBlocker(L, 'dollars', B, true), null);
  eq(orderBlocker(L, 'dollars', { ...B, dollarsCents: 1000 }, true), 'Not enough dining dollars.');
  eq(orderBlocker(L, 'swipe', { ...B, swipes: 0 }, true), 'You have no swipes left.');
  eq(orderBlocker([{ ...L[0], stock: 1 }], 'swipe', B, true), 'Not enough left of an item.');
  eq(orderBlocker(L, 'swipe', null, true), 'You have no meal plan for this term.');
  eq(orderBlocker(L, 'swipe', B, false), 'This location is closed now.');
  eq(orderBlocker([{ ...L[0], available: false }], 'swipe', B, true) !== null, true);
});
test('hours', () => {
  const h = { '1': ['07:00', '20:00'] as [string, string], '0': null };
  eq(isOpen(h, 1, '12:30'), true);
  eq(isOpen(h, 1, '20:00'), false);
  eq(isOpen(h, 0, '12:00'), false);
});
test('day close needs a note only when counts differ', () => {
  eq(closeBlocker({ swipes: 10, dollarsCents: 500 }, { swipes: 10, dollarsCents: 500 }, ''), null);
  eq(closeBlocker({ swipes: 10, dollarsCents: 500 }, { swipes: 9, dollarsCents: 500 }, '') !== null, true);
  eq(closeBlocker({ swipes: 10, dollarsCents: 500 }, { swipes: 9, dollarsCents: 500 }, 'One comp meal for a guest'), null);
});
