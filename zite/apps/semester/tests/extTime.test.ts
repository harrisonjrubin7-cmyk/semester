import { test, eq } from './harness';
import { multiplierFor, extraMinutes, isLate } from '../src/lib/extTimeRules';

const acc = { state: 'approved', validUntil: '2027-05-01', multiplier: 1.5, letterSections: ['S1'] };
test('an approved, current accommodation sent to the section applies (control)', () => { eq(multiplierFor([acc], 'S1', '2026-10-26'), 1.5); });
test('nothing applies without a letter, approval, validity or multiplier', () => {
  eq(multiplierFor([acc], 'S2', '2026-10-26'), 1);                          // letter not sent to this section
  eq(multiplierFor([{ ...acc, state: 'declined' }], 'S1', '2026-10-26'), 1);
  eq(multiplierFor([{ ...acc, validUntil: '2026-10-25' }], 'S1', '2026-10-26'), 1); // expired
  eq(multiplierFor([{ ...acc, multiplier: null }], 'S1', '2026-10-26'), 1);
  eq(multiplierFor([], 'S1', '2026-10-26'), 1);
});
test('the largest applicable multiplier wins', () => { eq(multiplierFor([acc, { ...acc, multiplier: 2 }], 'S1', '2026-10-26'), 2); });
test('extra minutes round up and untimed gets none', () => {
  eq(extraMinutes(45, 1.5), 23); eq(extraMinutes(60, 2), 60); eq(extraMinutes(null, 2), 0); eq(extraMinutes(30, 1), 0);
});
test('lateness uses the extended limit and close', () => {
  const start = 0, close = 120 * 60_000;
  eq(isLate(62 * 60_000, start, close, 60, 0), false);       // inside grace
  eq(isLate(63 * 60_000, start, close, 60, 0), true);        // past limit + grace
  eq(isLate(63 * 60_000, start, close, 60, 30), false);      // extended student still on time
  eq(isLate(93 * 60_000, start, close, 60, 30), true);
  eq(isLate(121 * 60_000, start, close, null, 0), false);
  eq(isLate(123 * 60_000, start, close, null, 0), true);     // untimed: only the close matters
});
