import { test, eq } from './harness';
import { termBalances, signed } from '../src/lib/billingRules';

test('charges add, payments and aid subtract (control)', () => { eq([signed('Charge', 10), signed('Payment', 10), signed('Aid', 5)], [10, -10, -5]); });
test('per-term balances round to cents and show the earliest due date only while money is owed', () => {
  eq(termBalances([
    { type: 'Charge', amount: 1000.105, term: 'Fall 2026', dueDate: '2026-09-15' },
    { type: 'Charge', amount: 200, term: 'Fall 2026', dueDate: '2026-08-30' },
    { type: 'Payment', amount: 500, term: 'Fall 2026', dueDate: '' },
    { type: 'Charge', amount: 300, term: 'Spring 2027', dueDate: '2027-01-10' },
    { type: 'Aid', amount: 300, term: 'Spring 2027', dueDate: '' },
  ]), [{ term: 'Fall 2026', balance: 700.11, nextDue: '2026-08-30' }, { term: 'Spring 2027', balance: 0, nextDue: null }]);
});
