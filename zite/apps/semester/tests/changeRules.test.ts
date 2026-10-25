import { test, eq } from './harness';
import { checkChange, overlaps } from '../src/lib/changeRules';

const A = { id: 'A', term: 'F26', credits: 3, times: 'Mon/Wed 09:00-10:15' };
const B = { id: 'B', term: 'F26', credits: 4, times: 'Tue/Thu 09:00-10:15' };
const C = { id: 'C', term: 'F26', credits: 3, times: 'Mon/Wed 10:00-11:15' };
const D = { id: 'D', term: 'S27', credits: 3, times: 'Fri 09:00-10:00' };
const ok = (x: unknown) => eq(x, null);
const no = (x: unknown) => eq(typeof x, 'string');
test('drop and swap allowed in an open window (control)', () => {
  ok(checkChange({ kind: 'drop', window: 'open', from: A, held: [A, B], maxCredits: null }));
  ok(checkChange({ kind: 'swap', window: 'open', from: A, to: C, held: [A, B], maxCredits: 12 }));
});
test('no calendar behaves as open', () => ok(checkChange({ kind: 'drop', window: 'none', from: A, held: [A], maxCredits: null })));
test('closed or not-yet windows refuse', () => {
  no(checkChange({ kind: 'drop', window: 'closed', from: A, held: [A], maxCredits: null }));
  no(checkChange({ kind: 'drop', window: 'not_yet', from: A, held: [A], maxCredits: null }));
});
test('a seat the student does not hold is refused', () => no(checkChange({ kind: 'drop', window: 'open', from: A, held: [B], maxCredits: null })));
test('swap target must differ, stay in term and not already be held', () => {
  no(checkChange({ kind: 'swap', window: 'open', from: A, to: A, held: [A], maxCredits: null }));
  no(checkChange({ kind: 'swap', window: 'open', from: A, to: D, held: [A], maxCredits: null }));
  no(checkChange({ kind: 'swap', window: 'open', from: A, to: B, held: [A, B], maxCredits: null }));
  no(checkChange({ kind: 'swap', window: 'open', from: A, held: [A], maxCredits: null }));
});
test('the dropped section does not count as a time clash', () => ok(checkChange({ kind: 'swap', window: 'open', from: A, to: C, held: [A], maxCredits: null })));
test('a clash with another held class is refused', () => no(checkChange({ kind: 'swap', window: 'open', from: B, to: C, held: [A, B], maxCredits: null })));
test('credit limit counts the swap, not both sections', () => {
  ok(checkChange({ kind: 'swap', window: 'open', from: A, to: B, held: [A, C], maxCredits: 7 }));
  no(checkChange({ kind: 'swap', window: 'open', from: A, to: B, held: [A, C], maxCredits: 6 }));
});
test('overlap parsing', () => { eq(overlaps(A.times, C.times), true); eq(overlaps(A.times, B.times), false); eq(overlaps('TBA', A.times), false); });
