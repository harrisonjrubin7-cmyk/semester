import { test, eq } from './harness';
import { take, refill, BUDGETS } from '../src/lib/rateLimit';

const b = { capacity: 3, perSecond: 1 / 10 };
test('a full bucket allows a take (control)', () => { const r = take(3, 0, b); eq(r.ok, true); eq(r.left, 2); });
test('an empty bucket refuses with a retry time', () => { const r = take(0, 0, b); eq(r.ok, false); eq(r.retryAfter, 10); });
test('refill never exceeds capacity', () => eq(refill(2, 10_000, b), 3));
test('partial refill counts', () => { const r = take(0, 5, b); eq(r.ok, false); eq(r.retryAfter, 5); eq(take(0, 10, b).ok, true); });
test('negative elapsed time (clock skew) never adds tokens', () => eq(refill(1, -100, b), 1));
test('a cost above capacity can never pass', () => eq(take(3, 0, b, 4).ok, false));
test('burst then refusal for the ask budget', () => {
  let t: number = BUDGETS['ask.user'].capacity, ok = 0;
  for (let i = 0; i < 25; i++) { const r = take(t, 0, BUDGETS['ask.user']); if (r.ok) ok++; t = r.left; }
  eq(ok, 20);
});
