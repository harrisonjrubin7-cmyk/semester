import { test, eq } from './harness';
import { signalFor, demandRows, courseDemand, DemandSection } from '../src/lib/demandRules';

const sec = (id: string, capacity: number | null, o: Partial<DemandSection> = {}): DemandSection => ({ id, label: id, course: 'HIST 300', term: 'Fall', capacity, state: 'Open', ...o });

test('a waitlist outranks fill', () => eq(signalFor(30, 10, 2, 'Open'), 'waitlisted'));
test('full at capacity', () => eq(signalFor(30, 30, 0, 'Open'), 'full'));
test('near full at 90% (boundary)', () => eq([signalFor(30, 27, 0, 'Open'), signalFor(30, 26, 0, 'Open')], ['near_full', 'open']));
test('low below 30% (boundary)', () => eq([signalFor(30, 8, 0, 'Open'), signalFor(30, 9, 0, 'Open')], ['low', 'open']));
test('closed and cancelled sections are closed whatever the numbers', () => eq([signalFor(30, 40, 5, 'Closed'), signalFor(30, 0, 0, 'Cancelled')], ['closed', 'closed']));
test('missing capacity is reported, not guessed', () => eq(signalFor(null, 5, 0, 'Open'), 'no_capacity'));
test('rows sort by pressure', () => eq(demandRows([sec('a', 30), sec('b', 30), sec('c', 30)], { a: 5, b: 30, c: 29 }, { a: 1 }).map((r) => r.id), ['a', 'b', 'c']));
test('course demand counts seats short across open sections only', () => eq(courseDemand(demandRows([sec('a', 20), sec('b', 20), sec('x', 50, { state: 'Closed' })], { a: 20, b: 18 }, { a: 5, b: 1 })),
  [{ course: 'HIST 300', term: 'Fall', sections: 2, capacity: 40, seated: 38, waiting: 6, seatsShort: 4 }]));
